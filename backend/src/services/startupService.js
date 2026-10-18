/**
 * Service de Startups (regra de negocio).
 */
const startupRepository = require("../repositories/startupRepository")
const startupConfigRepository = require("../repositories/startupConfigRepository")
const tenantRepository = require("../repositories/tenantRepository")
const trilhaRepository = require("../repositories/trilhaRepository")
const rbacService = require("./rbacService")
const { montarCamposExtras } = require("../campos/valores")
const { SITUACAO_FALLBACK } = require("../startups/padroes")
const { erroNegocio } = require("../utils/erros")

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]

/** Texto vazio vira NULL: "" numa coluna opcional so polui o banco. */
function texto(valor, limite) {
  const limpo = String(valor ?? "").trim()
  if (!limpo) return null
  return limite ? limpo.slice(0, limite) : limpo
}

/** So os digitos, do jeito que as colunas de documento guardam. */
function digitos(valor, limite) {
  const limpo = String(valor ?? "").replace(/\D/g, "")
  if (!limpo) return null
  return limite ? limpo.slice(0, limite) : limpo
}

/**
 * Valida e normaliza o corpo do cadastro, resolvendo tudo que depende do
 * tenant: tipo, situacao e a definicao dos campos personalizaveis.
 *
 * Uma funcao so para criar e atualizar porque as duas gravam o mesmo conjunto —
 * duas copias garantiriam que uma regra nova entrasse em uma e faltasse na
 * outra.
 */
async function prepararCadastro(idTenant, dados) {
  const nome = texto(dados.nome, 150)
  if (!nome) throw erroNegocio(400, "Informe o nome da startup.")

  const cnpj = digitos(dados.cnpj, 14)
  if (cnpj && cnpj.length !== 14) throw erroNegocio(400, "O CNPJ deve ter 14 digitos.")

  const email = texto(dados.email, 150)
  if (email && !EMAIL.test(email)) throw erroNegocio(400, "E-mail da startup invalido.")

  const cep = digitos(dados.cep, 8)
  if (cep && cep.length !== 8) throw erroNegocio(400, "O CEP deve ter 8 digitos.")

  const uf = texto(dados.uf, 2)?.toUpperCase() ?? null
  if (uf && !UFS.includes(uf)) throw erroNegocio(400, "UF invalida.")

  // TIPO e SITUACAO precisam existir NESTE tenant e estar ativos. A FK ja
  // garante a primeira metade, mas com uma mensagem de banco; e nao garante a
  // segunda — sem esta checagem daria para gravar um tipo desativado passando a
  // chave direto na requisicao, e ele reapareceria so naquela startup.
  let tipo = texto(dados.tipo, 40)
  if (tipo) {
    const encontrado = await startupConfigRepository.buscarTipo(idTenant, tipo)
    if (!encontrado || !encontrado.ativo) {
      throw erroNegocio(400, "Tipo de startup invalido para esta incubadora.")
    }
  }

  const situacao = texto(dados.situacao, 40) || SITUACAO_FALLBACK
  const situacaoEncontrada = await startupConfigRepository.buscarSituacao(idTenant, situacao)
  if (!situacaoEncontrada || !situacaoEncontrada.ativo) {
    throw erroNegocio(400, "Situacao invalida para esta incubadora.")
  }

  // Os campos personalizaveis sao validados contra os ATIVOS: um campo
  // desativado nao volta a ser exigido nem aceita valor novo, mas o que ja
  // estava gravado continua no documento da startup.
  const definicoes = await startupConfigRepository.listarCampos(idTenant)
  const camposExtras = montarCamposExtras(definicoes, dados.camposExtras)

  return {
    idTenant,
    nome,
    cnpj,
    inscricao_estadual: digitos(dados.inscricaoEstadual, 20),
    email,
    tipo,
    situacao,
    observacoes: texto(dados.observacoes),
    cep,
    uf,
    cidade: texto(dados.cidade, 100),
    bairro: texto(dados.bairro, 100),
    rua: texto(dados.rua, 150),
    numero: texto(dados.numero, 20),
    complemento: texto(dados.complemento, 100),
    camposExtras,
  }
}

/**
 * Normaliza a lista de contatos vinda do formulario.
 *
 * `undefined` significa "nao mexi nos contatos" e devolve null, para o service
 * nao tocar na tabela; `[]` significa "apaguei todos". Sem essa distincao,
 * qualquer PUT que nao mandasse contatos apagaria a lista inteira em silencio.
 */
function prepararContatos(contatos) {
  if (contatos === undefined || contatos === null) return null
  if (!Array.isArray(contatos)) throw erroNegocio(400, "Os contatos devem vir em uma lista.")

  const preparados = contatos
    // Linha em branco que o usuario adicionou e nao preencheu nao e erro, e so
    // uma linha em branco: descartar e o que ele espera ao salvar.
    .filter((c) => c && (c.nome || c.email || c.telefone || c.cargo))
    .map((c) => {
      const nome = texto(c.nome, 150)
      if (!nome) throw erroNegocio(400, "Todo contato precisa de um nome.")
      const email = texto(c.email, 150)
      if (email && !EMAIL.test(email)) throw erroNegocio(400, `E-mail invalido no contato "${nome}".`)
      return {
        nome,
        cargo: texto(c.cargo, 100),
        email,
        telefone: digitos(c.telefone, 15),
        principal: Boolean(c.principal),
      }
    })

  // Um principal so — o indice parcial do banco barraria o segundo com erro de
  // constraint, que nao diz nada a quem esta preenchendo o formulario.
  const principais = preparados.filter((c) => c.principal)
  if (principais.length > 1) {
    throw erroNegocio(400, "Marque apenas um contato como principal.")
  }
  // Sem nenhum marcado, o primeiro assume: o card da startup precisa de alguem
  // para mostrar, e "o primeiro da lista" e a escolha que quem cadastrou fez.
  if (principais.length === 0 && preparados.length > 0) preparados[0].principal = true

  return preparados
}

/**
 * Lista as startups de um tenant, restringindo a visibilidade conforme o papel
 * do usuario logado.
 * @param {number} idTenant
 * @param {number} idUsuario - usuario autenticado (define a restricao).
 */
async function listar(idTenant, idUsuario, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, "startups.startups.visualizar")

  // Como na agenda: a chave decide se VE a lista; o papel decide QUANTO dela.
  const papel = await tenantRepository.buscarPapel(idTenant, idUsuario)
  // Mentor e usuario so enxergam as startups a que estao ligados (como mentor
  // ou membro). O admin (e o root, que nao tem papel no tenant) veem todas.
  const restringir = papel === "usuario" || papel === "mentor"
  const idsPermitidos = restringir
    ? await startupRepository.listarIdsPorUsuario(idTenant, idUsuario)
    : null

  return startupRepository.listarPorTenant(idTenant, idsPermitidos)
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Traduz o `:id` da rota para o id_startup: a URL da tela de detalhe leva o
 * UUID da startup (migracao 022), as chamadas internas seguem com o id.
 *
 * Nao checa acesso, de proposito: o UUID e so outro nome da startup. Quem
 * decide se a pessoa a alcanca e o buscarComPermissao do handler, que roda em
 * seguida com o id ja traduzido — e responde do mesmo jeito para os dois.
 */
async function resolverId(valor) {
  if (!UUID.test(valor)) return valor
  const id = await startupRepository.buscarIdPorUuid(valor)
  if (!id) throw erroNegocio(404, "Startup nao encontrada.")
  return id
}

/** Busca sem checar nada — primitiva interna (ver trilhaService.buscarNo). */
async function buscarStartup(id) {
  const startup = await startupRepository.buscarPorId(id)
  if (!startup) throw erroNegocio(404, "Startup nao encontrada.")
  return startup
}

/**
 * Carrega a startup e exige a permissao no tenant DELA e o vinculo com ELA.
 *
 * Sao os dois eixos de sempre: a chave diz O QUE a pessoa faz, o vinculo diz
 * COM QUAL startup. So a chave nao basta (QRN-08): a role Colaborador tem
 * `startups.canvas.editar`, e sem o vinculo isso valia para o Canvas de toda
 * startup da incubadora, inclusive a concorrente da sala ao lado.
 */
async function buscarComPermissao(id, usuario, chave) {
  const startup = await buscarStartup(id)
  await rbacService.garantirPermissao(startup.id_tenant, usuario, chave)
  await exigirVinculo(startup, usuario)
  return startup
}

/**
 * O mesmo recorte de `listar`, aplicado a UMA startup: root e admin do tenant
 * alcancam todas; mentor e incubado, so as que acompanham ou de que sao
 * membros. Quem nao tem vinculo ativo com o tenant nao alcanca nenhuma.
 */
async function exigirVinculo(startup, usuario) {
  if (usuario?.root) return

  const papel = await tenantRepository.buscarPapel(startup.id_tenant, usuario?.id)
  if (!papel) throw erroNegocio(403, "Voce nao tem acesso a esta incubadora.")
  if (papel === "admin") return

  const ids = await startupRepository.listarIdsPorUsuario(startup.id_tenant, usuario.id)
  if (!ids.includes(startup.id_startup)) {
    throw erroNegocio(403, "Voce nao tem vinculo com esta startup.")
  }
}

/**
 * Exige vinculo com a startup, sem chave RBAC.
 *
 * Para as leituras que o proprio incubado faz da sua startup (a Jornada, as
 * entregas) e que nao tem chave no catalogo: o menu "Minha Jornada" aparece
 * para todo mundo, e o que limita e de quem e a startup.
 */
async function garantirVinculo(idStartup, usuario) {
  const startup = await buscarStartup(idStartup)
  await exigirVinculo(startup, usuario)
  return startup
}

/**
 * Exige que o usuario seja MEMBRO ativo da startup — para escrever em nome
 * dela (entregas). Nem admin nem mentor passam: a entrega e o trabalho do
 * time, e e o time que responde por ela. O root tambem nao, pelo mesmo motivo.
 */
async function garantirMembro(idStartup, usuario) {
  const startup = await buscarStartup(idStartup)
  const papel = await tenantRepository.buscarPapel(startup.id_tenant, usuario?.id)
  const membro = papel && (await startupRepository.ehMembroDe(startup.id_startup, usuario.id))
  if (!membro) throw erroNegocio(403, "So os membros da startup enviam entregas por ela.")
  return startup
}

/**
 * Busca uma startup pelo id, com os contatos.
 *
 * Os contatos vem junto, e nao num endpoint proprio, porque a tela de detalhe
 * mostra os dois ao mesmo tempo e nao existe leitura de contato sem a startup a
 * que ele pertence — separar renderia duas requisicoes para desenhar um card.
 */
async function buscar(id, usuario) {
  const startup = await buscarComPermissao(id, usuario, "startups.startups.visualizar")
  startup.contatos = await startupRepository.listarContatos(id)
  return startup
}

/** Cria uma startup. */
/**
 * Cria a startup e ja a matricula numa trilha.
 *
 * `idTrilha` e opcional: sem ele vale a trilha marcada como padrao no
 * Construtor. Quem cadastra ainda pode escolher outra — a padrao e sugestao,
 * nao imposicao. Se o tenant nao tem trilha nenhuma, a startup e criada
 * mesmo assim e fica sem matricula, para o cadastro nao ficar refem da ordem
 * em que a incubadora monta as coisas.
 */
async function criar(dados, usuario) {
  const { idTenant, idTrilha } = dados
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, "startups.startups.criar")

  const cadastro = await prepararCadastro(idTenant, dados)
  const contatos = prepararContatos(dados.contatos)

  const startup = await startupRepository.criar(cadastro)
  startup.contatos = contatos
    ? await startupRepository.substituirContatos(startup.id_startup, contatos)
    : []

  const alvo = idTrilha
    ? await trilhaRepository.buscarPorId(idTrilha)
    : await trilhaRepository.programaPadrao(idTenant)

  if (alvo) {
    // A trilha escolhida precisa ser deste tenant e ser a raiz. O trigger do
    // banco tambem barra, mas aqui a mensagem sai no idioma do cadastro.
    if (Number(alvo.id_tenant) !== Number(idTenant) || alvo.tipo !== "PROGRAMA") {
      throw erroNegocio(400, "Trilha invalida para esta incubadora.")
    }
    await trilhaRepository.matricular(alvo.id_no, startup.id_startup)
    startup.id_trilha = alvo.id_no
    startup.trilha = alvo.nome
  }

  return startup
}

/**
 * Atualiza os dados cadastrais de uma startup.
 *
 * O tenant vem da startup GRAVADA, nunca do corpo: com ele vindo da requisicao,
 * um PUT com id_tenant de outra incubadora validaria o tipo contra o
 * vocabulario errado — e a startup mudaria de dono.
 */
async function atualizar(id, dados, usuario) {
  const startup = await buscarComPermissao(id, usuario, "startups.startups.editar")

  const cadastro = await prepararCadastro(startup.id_tenant, dados)
  const contatos = prepararContatos(dados.contatos)

  const atualizada = await startupRepository.atualizar(id, cadastro)
  atualizada.contatos = contatos
    ? await startupRepository.substituirContatos(id, contatos)
    : await startupRepository.listarContatos(id)

  return atualizada
}

/**
 * Troca a SITUACAO de uma startup — o "status" que a incubadora ve.
 *
 * O `status` do ciclo (ATIVA/PAUSADA/ENCERRADA) sai da situacao escolhida e nao
 * e aceito da requisicao: ver o comentario em startupRepository.
 */
async function atualizarSituacao(id, situacao, usuario) {
  const startup = await buscarComPermissao(id, usuario, "startups.startups.editar")

  const chave = String(situacao ?? "").trim()
  if (!chave) throw erroNegocio(400, "Informe a situacao.")

  const encontrada = await startupConfigRepository.buscarSituacao(startup.id_tenant, chave)
  if (!encontrada || !encontrada.ativo) {
    throw erroNegocio(400, "Situacao invalida para esta incubadora.")
  }

  return startupRepository.atualizarSituacao(id, startup.id_tenant, chave)
}

/** Adiciona um membro (usuario) a uma startup. */
async function adicionarMembro(idStartup, idUsuario, lider, usuario) {
  if (!idUsuario) throw erroNegocio(400, "Informe o id_usuario.")
  await buscarComPermissao(idStartup, usuario, "startups.membros.adicionar")
  // Sem linha de volta = o vinculo ja existia e estava ativo. Quem saiu da
  // equipe (ativo = FALSE) e reativado pelo repository, nao cai aqui.
  const membro = await startupRepository.adicionarMembro(idStartup, idUsuario, !!lider)
  if (!membro) throw erroNegocio(409, "Este usuario ja e membro da startup.")
  return membro
}

/** Lista os membros ativos de uma startup. */
async function listarMembros(idStartup, usuario) {
  await buscarComPermissao(idStartup, usuario, "startups.membros.visualizar")
  return startupRepository.listarMembros(idStartup)
}

/**
 * Membros de TODAS as startups do tenant, mais os incubados sem vinculo.
 *
 * As duas listas vem juntas porque a tela existe para cruzar as duas: ver quem
 * esta onde e, principalmente, quem ficou de fora. Exige
 * startups.membros.visualizar — e uma visao de toda a incubadora.
 */
async function listarMembrosDoTenant(idTenant, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, "startups.membros.visualizar")

  const [membros, semStartup] = await Promise.all([
    startupRepository.listarMembrosPorTenant(idTenant),
    startupRepository.listarSemStartup(idTenant),
  ])
  return { membros, semStartup }
}

/** Remove (desativa) um membro de uma startup. */
async function removerMembro(idStartup, idUsuario, usuario) {
  await buscarComPermissao(idStartup, usuario, "startups.membros.remover")
  const membro = await startupRepository.removerMembro(idStartup, idUsuario)
  if (!membro) throw erroNegocio(404, "Membro nao encontrado nesta startup.")
  return membro
}

/** Busca a startup do usuario logado (dentro do seu tenant). */
async function buscarMinha(idTenant, idUsuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  const startup = await startupRepository.buscarStartupDoUsuario(idTenant, idUsuario)
  if (!startup) throw erroNegocio(404, "Voce nao esta vinculado a nenhuma startup.")
  startup.contatos = await startupRepository.listarContatos(startup.id_startup)
  return startup
}

/** Lista as fases ja concluidas (aprovadas) de uma startup. */
async function listarFasesConcluidas(idStartup, usuario) {
  await buscarComPermissao(idStartup, usuario, "startups.startups.visualizar")
  return startupRepository.listarFasesConcluidas(idStartup)
}

module.exports = {
  listar,
  resolverId,
  buscar,
  // Usado pelos services dos modelos de gestao (canvas/gut/5w2h), que precisam
  // da mesma checagem com a chave DELES.
  buscarComPermissao,
  // Usados pela Jornada, entregas e avaliacoes: o recorte por startup sem
  // chave RBAC (leitura) e o de membro (escrita).
  garantirVinculo,
  garantirMembro,
  criar,
  atualizar,
  atualizarSituacao,
  adicionarMembro,
  listarMembros,
  listarMembrosDoTenant,
  removerMembro,
  buscarMinha,
  listarFasesConcluidas,
}
