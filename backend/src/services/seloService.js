/**
 * Service dos SELOS: a definicao, a concessao e a credencial publica.
 *
 * O SELO E A OUTRA MOEDA DO ENGAJAMENTO, e nao se converte na primeira. Mede
 * EVOLUCAO e PROTAGONISMO — justamente o que a coordenacao decidiu que NAO
 * pode virar ponto: experimento, entrevista, validacao de hipotese, pivotagem,
 * conclusao de momento formativo, aplicacao de orientacao, ajudar outro
 * empreendedor, compartilhar conhecimento, publicar conteudo.
 *
 * Reconhecer isso com PONTO faria a pessoa fazer o trabalho pelo ponto, e a
 * incubadora perderia o sinal que queria medir. Reconhecer com SELO da o que
 * essas conquistas realmente valem: uma credencial verificavel, com o nome de
 * quem concedeu e o criterio escrito, que a pessoa leva para o LinkedIn.
 *
 * Por isso este arquivo NAO importa engajamentoService nem toca em
 * `engajamento_ponto`. Conceder selo nao mexe em ranking nenhum.
 *
 * NAO HA CONCESSAO AUTOMATICA POR REGRA, e isso e desenho. "Ajudou outro
 * empreendedor" e "aplicou a orientacao" sao julgamentos humanos; um gatilho
 * automatico transformaria o selo exatamente naquilo que ele existe para nao
 * ser — mais uma metrica para perseguir.
 */
const crypto = require("crypto")

const seloRepository = require("../repositories/seloRepository")
const rbacService = require("./rbacService")
const auditLogService = require("./auditLogService")
const { erroNegocio } = require("../utils/erros")
const { ICONES_VALIDOS } = require("../engajamento/padroes")

const HEX = /^#[0-9a-fA-F]{6}$/

/**
 * Codigo da credencial: 16 caracteres aleatorios, URL-safe.
 *
 * ALEATORIO, e nao o id da concessao: o codigo vai na URL de uma pagina
 * publica, e um numero sequencial deixaria qualquer pessoa varrer as
 * credenciais da incubadora inteira trocando um digito.
 *
 * O retry existe porque colisao, ainda que improvavel (2^96), tem tratamento
 * barato — e a alternativa e um 500 no meio de uma concessao em lote.
 */
async function gerarCodigo() {
  for (let tentativa = 0; tentativa < 5; tentativa += 1) {
    const codigo = crypto.randomBytes(12).toString("base64url")
    if (!(await seloRepository.codigoEmUso(codigo))) return codigo
  }
  throw erroNegocio(500, "Não foi possível gerar o código da credencial. Tente novamente.")
}

// ---------------------------------------------------------------------------
// DEFINICAO DOS SELOS
// ---------------------------------------------------------------------------

/**
 * Lista os selos. LER exige so `engajamento.selos.visualizar`: o mural e o
 * catalogo do que a incubadora reconhece, e escondê-lo de quem participa
 * tiraria o unico efeito que um selo tem antes de ser concedido — dizer o que
 * vale a pena fazer.
 */
async function listar(idTenant, usuario, incluirInativos = false) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, "engajamento.selos.visualizar")
  if (incluirInativos) {
    await rbacService.garantirPermissao(idTenant, usuario, "engajamento.selos.editar")
  }
  const [selos, categorias] = await Promise.all([
    seloRepository.listarSelos(idTenant, incluirInativos),
    seloRepository.categoriasEmUso(idTenant),
  ])
  return { selos, categorias }
}

function validarSelo(dados) {
  const nome = dados.nome?.trim()
  if (!nome) throw erroNegocio(400, "Informe o nome do selo.")
  if (nome.length > 80) throw erroNegocio(400, "O nome deve ter no máximo 80 caracteres.")
  if (dados.cor && !HEX.test(dados.cor)) {
    throw erroNegocio(400, "Cor inválida. Use hexadecimal, como #7c3aed.")
  }
  if (dados.icone && !ICONES_VALIDOS.includes(dados.icone)) {
    throw erroNegocio(400, "Ícone inválido.")
  }
  return {
    nome,
    descricao: dados.descricao?.trim() || null,
    // O criterio e o que a credencial publica mostra para quem nao conhece a
    // incubadora. Sem ele o selo e enfeite; com ele, e declaracao verificavel.
    criterio: dados.criterio?.trim() || null,
    categoria: dados.categoria?.trim() || null,
    cor: dados.cor || "#7c3aed",
    icone: dados.icone || "MilitaryTech",
    imagem_url: dados.imagem_url?.trim() || null,
    permite_repetir: Boolean(dados.permite_repetir),
  }
}

async function criar(idTenant, dados, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, "engajamento.selos.criar")
  const limpos = validarSelo(dados)

  let selo
  try {
    selo = await seloRepository.criarSelo(idTenant, limpos, usuario?.id)
  } catch (err) {
    if (err.code === "23505") throw erroNegocio(409, "Já existe um selo com esse nome.")
    throw err
  }

  await auditLogService.registrar({
    idTenant,
    idUsuario: usuario?.id,
    acao: "CRIAR",
    entidade: "selo",
    entidadeId: String(selo.id_selo),
    descricao: `Criou o selo "${selo.nome}".`,
    dadosDepois: selo,
  })
  return selo
}

async function atualizar(idTenant, idSelo, dados, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, "engajamento.selos.editar")

  const antes = await seloRepository.buscarSelo(idTenant, idSelo)
  if (!antes) throw erroNegocio(404, "Selo não encontrado.")
  const limpos = validarSelo(dados)

  let selo
  try {
    selo = await seloRepository.atualizarSelo(idTenant, idSelo, limpos)
  } catch (err) {
    if (err.code === "23505") throw erroNegocio(409, "Já existe um selo com esse nome.")
    throw err
  }

  await auditLogService.registrar({
    idTenant,
    idUsuario: usuario?.id,
    acao: "EDITAR",
    entidade: "selo",
    entidadeId: String(idSelo),
    // A credencial publica le a definicao ATUAL: corrigir o criterio conserta
    // todas as credenciais ja emitidas de uma vez.
    descricao: `Editou o selo "${selo.nome}".`,
    dadosAntes: antes,
    dadosDepois: selo,
  })
  return selo
}

async function alterarAtivo(idTenant, idSelo, ativo, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, "engajamento.selos.editar")

  const selo = await seloRepository.alterarAtivoSelo(idTenant, idSelo, Boolean(ativo))
  if (!selo) throw erroNegocio(404, "Selo não encontrado.")

  await auditLogService.registrar({
    idTenant,
    idUsuario: usuario?.id,
    acao: "EDITAR",
    entidade: "selo",
    entidadeId: String(idSelo),
    // Desativar tira o selo da lista de concessao; as credenciais ja emitidas
    // continuam validas e publicas. Sao coisas diferentes de proposito.
    descricao: `${ativo ? "Reativou" : "Desativou"} o selo "${selo.nome}".`,
    dadosDepois: selo,
  })
  return selo
}

/**
 * Exclui um selo que NUNCA foi concedido.
 *
 * Selo ja concedido nao pode sumir: ha credencial publicada apontando para
 * ele, e o link viraria 404 no perfil de quem recebeu. Para esse caso existe
 * desativar — e a mensagem diz isso em vez de devolver um erro de banco.
 */
async function excluir(idTenant, idSelo, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, "engajamento.selos.excluir")

  const selo = await seloRepository.buscarSelo(idTenant, idSelo)
  if (!selo) throw erroNegocio(404, "Selo não encontrado.")

  const concedidos = await seloRepository.contarConcessoes(idSelo)
  if (concedidos > 0) {
    throw erroNegocio(
      409,
      `Este selo já foi concedido ${concedidos} vez(es) e não pode ser excluído — há credenciais publicadas apontando para ele. Desative-o para tirá-lo da lista de concessão.`
    )
  }

  await seloRepository.excluirSelo(idTenant, idSelo)
  await auditLogService.registrar({
    idTenant,
    idUsuario: usuario?.id,
    acao: "EXCLUIR",
    entidade: "selo",
    entidadeId: String(idSelo),
    descricao: `Excluiu o selo "${selo.nome}" (nunca concedido).`,
    dadosAntes: selo,
  })
  return { excluido: true }
}

// ---------------------------------------------------------------------------
// CONCESSAO
// ---------------------------------------------------------------------------

/**
 * Concede o selo a uma ou varias pessoas.
 *
 * EM LOTE porque o ato real e em lote ("os cinco que apresentaram no
 * Demoday"), e uma requisicao por pessoa deixaria metade concedida se a rede
 * caisse no meio.
 *
 * A JUSTIFICATIVA E EXIGIDA. E o que separa um selo de um adesivo: ela aparece
 * na credencial publica, e sem ela a pagina diz apenas que alguem ganhou algo
 * — que nao prova nada para quem le de fora.
 *
 * A concessao nasce PRIVADA (`publico = false`). A credencial expoe o nome da
 * pessoa numa pagina aberta, e quem decide isso e ela, nao quem concedeu.
 */
async function conceder(idTenant, idSelo, dados, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, "engajamento.selos.conceder")

  const selo = await seloRepository.buscarSelo(idTenant, idSelo)
  if (!selo) throw erroNegocio(404, "Selo não encontrado.")
  if (!selo.ativo) throw erroNegocio(409, "Este selo está desativado.")

  const ids = [...new Set((dados.ids_usuarios ?? []).map(Number).filter(Boolean))]
  if (!ids.length) throw erroNegocio(400, "Selecione ao menos uma pessoa.")

  const justificativa = dados.justificativa?.trim()
  if (!justificativa) {
    throw erroNegocio(400, "Escreva a justificativa: é ela que aparece na credencial pública.")
  }
  if (justificativa.length > 500) {
    throw erroNegocio(400, "A justificativa deve ter no máximo 500 caracteres.")
  }

  const destinatarios = []
  const ignorados = []
  for (const idUsuario of ids) {
    if (!selo.permite_repetir && (await seloRepository.jaConcedido(idSelo, idUsuario))) {
      ignorados.push({ id_usuario: idUsuario, motivo: "Já possui este selo." })
      continue
    }
    destinatarios.push({
      id_usuario: idUsuario,
      id_startup: dados.id_startup ?? null,
      codigo: await gerarCodigo(),
    })
  }

  if (!destinatarios.length) {
    throw erroNegocio(409, "Todas as pessoas selecionadas já possuem este selo.")
  }

  let concedidas
  try {
    concedidas = await seloRepository.conceder(
      idTenant,
      idSelo,
      destinatarios,
      { justificativa, evidencia_url: dados.evidencia_url?.trim() || null },
      usuario?.id
    )
  } catch (err) {
    // FK do usuario: alguem de fora da incubadora na lista.
    if (err.code === "23503") throw erroNegocio(400, "Uma das pessoas selecionadas é inválida.")
    throw err
  }

  await auditLogService.registrar({
    idTenant,
    idUsuario: usuario?.id,
    acao: "CRIAR",
    entidade: "selo_concessao",
    entidadeId: String(idSelo),
    descricao: `Concedeu o selo "${selo.nome}" a ${concedidas.length} pessoa(s).`,
    dadosDepois: { id_selo: idSelo, justificativa, pessoas: concedidas.length },
  })

  return { concedidas, ignorados }
}

/**
 * Revoga uma concessao. ESTADO, NUNCA DELETE: a credencial que ja circula no
 * LinkedIn passa a dizer "revogada" em vez de virar link quebrado — e e isso
 * que sustenta a credibilidade dos selos de todo mundo.
 */
async function revogar(idTenant, idConcessao, motivo, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, "engajamento.selos.revogar")

  const antes = await seloRepository.buscarConcessao(idTenant, idConcessao)
  if (!antes) throw erroNegocio(404, "Concessão não encontrada.")
  if (antes.revogado_ts) throw erroNegocio(409, "Esta concessão já foi revogada.")

  const texto = motivo?.trim()
  if (!texto) {
    throw erroNegocio(400, "Informe o motivo da revogação: ele fica registrado na credencial.")
  }

  const concessao = await seloRepository.revogar(idTenant, idConcessao, usuario?.id, texto)
  await auditLogService.registrar({
    idTenant,
    idUsuario: usuario?.id,
    acao: "EXCLUIR",
    entidade: "selo_concessao",
    entidadeId: String(idConcessao),
    descricao: `Revogou o selo "${antes.selo}" de ${antes.usuario}: ${texto}`,
    dadosAntes: antes,
  })
  return concessao
}

/** O mural da incubadora: quem recebeu o que, do mais recente para tras. */
async function listarConcessoes(idTenant, filtros, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, "engajamento.selos.visualizar")
  return seloRepository.listarDoTenant(idTenant, {
    idSelo: filtros?.id_selo ? Number(filtros.id_selo) : null,
    idUsuario: filtros?.id_usuario ? Number(filtros.id_usuario) : null,
  })
}

/** Os selos da PROPRIA pessoa. Nao passa por RBAC — e dado dela. */
async function meusSelos(idTenant, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  return seloRepository.listarDoUsuario(idTenant, usuario.id)
}

/**
 * Liga/desliga a credencial publica. SO O DONO — o repositorio amarra o
 * id_usuario na propria query, para nenhum caminho de chamada conseguir
 * publicar a conquista de outra pessoa.
 *
 * Nao passa por RBAC pelo mesmo motivo: expor o proprio nome e decisao de
 * quem tem o nome, e uma chave de permissao aqui daria a coordenacao um poder
 * que ela nao deve ter.
 */
async function alterarPublico(idTenant, idConcessao, publico, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  const concessao = await seloRepository.alterarPublico(
    idTenant,
    idConcessao,
    usuario.id,
    Boolean(publico)
  )
  if (!concessao) {
    throw erroNegocio(404, "Conquista não encontrada, revogada, ou não pertence a você.")
  }
  return concessao
}

/**
 * A credencial publica, pelo codigo. SEM AUTENTICACAO — e o ponto dela.
 *
 * Devolve tambem a REVOGADA, com a marca: quem clicar no link precisa
 * descobrir que a credencial nao vale mais, e nao encontrar um 404 que parece
 * link quebrado.
 *
 * Devolve `null` quando o codigo nao existe OU quando a concessao nao foi
 * tornada publica pelo dono — os dois casos respondem 404 por fora, de
 * proposito: distinguir "nao existe" de "existe mas e privada" ja seria
 * vazamento.
 */
async function buscarCredencial(codigo) {
  if (!codigo) return null
  const credencial = await seloRepository.buscarPorCodigo(codigo)
  if (!credencial || !credencial.publico) return null
  return credencial
}

module.exports = {
  listar,
  criar,
  atualizar,
  alterarAtivo,
  excluir,

  conceder,
  revogar,
  listarConcessoes,
  meusSelos,
  alterarPublico,
  buscarCredencial,
}
