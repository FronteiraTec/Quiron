/**
 * Service da GESTAO DE TAREFAS (regra de negocio).
 *
 * QUEM ENXERGA O QUE — a regra central deste modulo, em duas camadas:
 *
 *   `tarefas.tarefas.visualizar` da o QUADRO INTEIRO da incubadora. E a chave
 *   de quem coordena: ve o que cada um esta fazendo, onde o trabalho empilhou,
 *   o que ninguem puxou.
 *
 *   SEM ela, a pessoa continua enxergando as tarefas em que esta envolvida —
 *   as que e responsavel e as que criou —, e mais nada. Isso NAO passa por
 *   permissao, pelo mesmo motivo que receber mensagem nao passa: uma tarefa
 *   atribuida e a unica coisa no sistema que entra na lista de alguem sem que
 *   essa pessoa tenha feito nada, e exigir uma chave para ela ver o que lhe
 *   pediram so criaria um jeito novo de deixar gente trabalhando no escuro.
 *
 * O AUTOR entra junto do responsavel nesse escopo reduzido porque nao ha
 * sentido em criar uma tarefa, atribui-la a um colega e perde-la de vista no
 * mesmo instante — e porque ele tem o direito de exclui-la (abaixo), que seria
 * impossivel exercer sobre algo invisivel.
 *
 * O corte de baixo e o TENANT: quem nao pertence a incubadora nao passa daqui,
 * com chave ou sem.
 *
 * QUEM MEXE NO QUE — a mesma logica, um degrau acima:
 *
 *   O RESPONSAVEL sempre pode editar a propria tarefa, tenha ou nao a chave
 *   `editar`. A chave existe para controlar quem mexe no trabalho DOS OUTROS —
 *   quem recebeu uma tarefa precisa poder move-la de coluna e marca-la como
 *   feita, senao o quadro vira um mural que so o coordenador atualiza e para de
 *   refletir a realidade em uma semana.
 *
 *   O AUTOR sempre pode excluir a que criou. Mesmo desenho de `excluir` nas
 *   mensagens: apagar o proprio engano nao e poder sobre ninguem.
 *
 * ANEXOS seguem a visibilidade da TAREFA, e nao a do arquivo: quem enxerga a
 * tarefa abre os anexos dela. Ver `abrirAnexo` — e o motivo de `tarefa_anexo`
 * ser tabela de ligacao e nao uma coluna de JSON.
 */
const tarefaRepository = require("../repositories/tarefaRepository")
const tarefaConfigRepository = require("../repositories/tarefaConfigRepository")
const arquivoRepository = require("../repositories/arquivoRepository")
const arquivoService = require("./arquivoService")
const startupRepository = require("../repositories/startupRepository")
const tenantRepository = require("../repositories/tenantRepository")
const rbacService = require("./rbacService")
const auditLogService = require("./auditLogService")
const notificacaoService = require("./notificacaoService")
const { montarCamposExtras } = require("../campos/valores")
const { PRIORIDADES_VALIDAS, PRIORIDADE_PADRAO } = require("../tarefas/padroes")
const { erroNegocio } = require("../utils/erros")

const VISUALIZAR = "tarefas.tarefas.visualizar"
const CRIAR = "tarefas.tarefas.criar"
const EDITAR = "tarefas.tarefas.editar"
const EXCLUIR = "tarefas.tarefas.excluir"

/** Texto vazio vira NULL: "" numa coluna opcional so polui o banco. */
function texto(valor, limite) {
  const limpo = String(valor ?? "").trim()
  if (!limpo) return null
  return limite ? limpo.slice(0, limite) : limpo
}

/**
 * O prazo, no formato que a coluna DATE aceita.
 *
 * Aceita "YYYY-MM-DD" (o que o <input type="date"> devolve) e recusa o resto em
 * vez de deixar o Postgres adivinhar: "03/04" e 3 de abril para quem digitou e
 * 4 de marco para o banco, e um prazo errado por seis meses e pior que um erro
 * de validacao.
 */
function prazoValido(valor) {
  if (valor === null || valor === undefined || valor === "") return null
  const dia = String(valor).trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) {
    throw erroNegocio(400, "Prazo invalido. Use o formato AAAA-MM-DD.")
  }
  // Data impossivel (31/02) passaria pelo regex e o banco a rejeitaria com uma
  // mensagem em ingles sobre o tipo da coluna. O round-trip pelo Date pega isso:
  // "2026-02-31" volta como "2026-03-03" e nao bate com o que entrou.
  const data = new Date(`${dia}T00:00:00Z`)
  if (Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== dia) {
    throw erroNegocio(400, "Prazo invalido: esta data nao existe.")
  }
  return dia
}

// ---------------------------------------------------------------------------
// ACESSO
// ---------------------------------------------------------------------------

/**
 * Quem nao pertence a incubadora nao entra, com chave ou sem.
 *
 * E o corte de baixo do modulo, e vem antes de qualquer outra pergunta: sem
 * ele, o escopo reduzido ("vejo o que e meu") seria a unica barreira, e uma
 * barreira que depende do CONTEUDO da tabela nao e barreira — basta uma linha
 * mal gravada para ela deixar de existir.
 */
async function garantirMembro(idTenant, usuario) {
  if (usuario?.root) return
  const papel = await tenantRepository.buscarPapel(idTenant, usuario?.id)
  if (!papel) throw erroNegocio(403, "Voce nao pertence a esta incubadora.")
}

/** A pessoa enxerga o quadro INTEIRO, ou so o que e dela? */
async function enxergaTudo(idTenant, usuario) {
  if (usuario?.root) return true
  return rbacService.temPermissao(idTenant, usuario, VISUALIZAR)
}

/** Esta tarefa especifica esta ao alcance desta pessoa? */
function alcanca(tarefa, usuario, tudo) {
  if (tudo) return true
  return (
    Number(tarefa.id_responsavel) === Number(usuario?.id) ||
    Number(tarefa.criado_por) === Number(usuario?.id)
  )
}

/**
 * Carrega uma tarefa, confere que ela e do tenant informado e que a pessoa a
 * enxerga.
 *
 * O id_tenant vem de quem chama (a rota), e nao da tarefa: sem essa
 * conferencia, saber o id de uma tarefa bastaria para edita-la de outra
 * incubadora — a permissao teria sido checada no tenant errado.
 *
 * NAO ENCONTRADA, e nao "sem permissao", para quem nao alcanca: responder 403
 * confirmaria a existencia de uma tarefa que a pessoa nao deveria saber que
 * existe, e o id e sequencial — daria para varrer o quadro inteiro contando os
 * 403.
 */
async function carregarVisivel(idTarefa, idTenant, usuario, tudo) {
  const tarefa = await tarefaRepository.buscarPorId(idTarefa)
  if (!tarefa || Number(tarefa.id_tenant) !== Number(idTenant)) {
    throw erroNegocio(404, "Tarefa nao encontrada.")
  }
  if (!alcanca(tarefa, usuario, tudo)) throw erroNegocio(404, "Tarefa nao encontrada.")
  return tarefa
}

/**
 * Quem pode MEXER nesta tarefa: quem tem a chave, ou o proprio responsavel.
 * Ver o cabecalho do arquivo.
 */
async function garantirPodeEditar(idTenant, usuario, tarefa) {
  if (Number(tarefa.id_responsavel) === Number(usuario?.id)) return
  await rbacService.garantirPermissao(idTenant, usuario, EDITAR)
}

// ---------------------------------------------------------------------------
// PREPARO DOS DADOS
// ---------------------------------------------------------------------------

/**
 * Os anexos informados, conferidos.
 *
 * `undefined` significa "nao mexi nos anexos" e devolve null, para o service
 * nao tocar na tabela; `[]` significa "removi todos". Sem essa distincao,
 * qualquer PUT que nao mandasse anexos apagaria a lista inteira em silencio —
 * a mesma regra dos contatos de startup.
 *
 * Cada id precisa ser um arquivo DESTA incubadora: a FK aponta para `arquivo`,
 * que e global, e sem esta checagem daria para anexar a uma tarefa o UUID de um
 * arquivo de outro tenant — e a rota de download passaria a servi-lo, porque
 * ela autoriza justamente pelo vinculo.
 */
async function prepararAnexos(idTenant, anexos) {
  if (anexos === undefined || anexos === null) return null
  if (!Array.isArray(anexos)) throw erroNegocio(400, "Anexos invalidos.")

  const ids = [
    ...new Set(anexos.map((a) => String(a?.id_arquivo ?? a ?? "").trim()).filter(Boolean)),
  ]
  // Teto para o corpo da requisicao nao virar uma lista infinita de UUIDs, e
  // porque uma tarefa com 50 anexos e um problema de organizacao, nao de campo.
  if (ids.length > 20) throw erroNegocio(400, "Uma tarefa aceita no maximo 20 anexos.")

  for (const id of ids) {
    // O id vem do cliente e pode nao ser UUID nenhum: o `catch` transforma o
    // erro de sintaxe do Postgres (22P02) na mesma recusa de negocio.
    const arquivo = await arquivoRepository.buscarPorId(id).catch(() => null)
    if (!arquivo || Number(arquivo.id_tenant) !== Number(idTenant)) {
      throw erroNegocio(400, "Anexo invalido para esta incubadora.")
    }
  }
  return ids
}

/**
 * Valida e normaliza o corpo de uma tarefa, resolvendo tudo que depende do
 * tenant: o status, o responsavel, a startup e os campos personalizaveis.
 *
 * Uma funcao so para criar e atualizar porque as duas gravam o mesmo conjunto —
 * duas copias garantiriam que uma regra nova entrasse em uma e faltasse na
 * outra.
 */
async function prepararDados(idTenant, dados) {
  const titulo = texto(dados.titulo, 160)
  if (!titulo) throw erroNegocio(400, "Informe o titulo da tarefa.")

  // O status e conferido contra os ATIVOS, e nao so contra os existentes: sem
  // esta checagem daria para criar tarefa numa coluna desativada passando a
  // chave direto na requisicao, e ela reapareceria no quadro sozinha.
  let status = texto(dados.status, 40)
  if (status) {
    const encontrado = await tarefaConfigRepository.buscarStatus(idTenant, status)
    if (!encontrado || !encontrado.ativo) {
      throw erroNegocio(400, "Coluna invalida para esta incubadora.")
    }
  } else {
    // Sem status informado, a tarefa nasce na primeira coluna do quadro — que e
    // o que "anotar para fazer depois" significa.
    const ativos = await tarefaConfigRepository.listarStatus(idTenant)
    if (!ativos.length) {
      throw erroNegocio(400, "Esta incubadora nao tem nenhuma coluna de tarefas configurada.")
    }
    status = ativos[0].chave
  }

  const prioridade = texto(dados.prioridade, 20) || PRIORIDADE_PADRAO
  if (!PRIORIDADES_VALIDAS.includes(prioridade)) {
    throw erroNegocio(400, `Prioridade invalida. Use: ${PRIORIDADES_VALIDAS.join(", ")}.`)
  }

  // O responsavel precisa ser gente DESTA incubadora, e ativa. Sem a checagem,
  // um id qualquer atribuiria a tarefa a alguem de outro tenant — a FK aponta
  // para `usuarios`, que e global, e nao teria como recusar.
  const idResponsavel = dados.idResponsavel ? Number(dados.idResponsavel) : null
  if (idResponsavel) {
    const vinculo = await tenantRepository.buscarUsuarioVinculado(idTenant, idResponsavel)
    if (!vinculo || !vinculo.ativo) {
      throw erroNegocio(400, "O responsavel precisa ser um usuario ativo desta incubadora.")
    }
  }

  // A startup e opcional, mas quando vem tem que ser desta incubadora — pelo
  // mesmo motivo do responsavel.
  const idStartup = dados.idStartup ? Number(dados.idStartup) : null
  if (idStartup) {
    const startup = await startupRepository.buscarPorId(idStartup)
    if (!startup || Number(startup.id_tenant) !== Number(idTenant)) {
      throw erroNegocio(400, "Startup invalida para esta incubadora.")
    }
  }

  // Os campos personalizaveis sao validados contra os ATIVOS: um campo
  // desativado nao volta a ser exigido nem aceita valor novo, mas o que ja
  // estava gravado continua no documento da tarefa.
  const definicoes = await tarefaConfigRepository.listarCampos(idTenant)
  const camposExtras = montarCamposExtras(definicoes, dados.camposExtras)

  return {
    idTenant,
    titulo,
    descricao: texto(dados.descricao),
    status,
    prioridade,
    idResponsavel,
    idStartup,
    prazo: prazoValido(dados.prazo),
    camposExtras,
  }
}

/**
 * A tarefa com os anexos junto — o formato que a tela de edicao precisa.
 *
 * REESCREVE `total_anexos`, e nao so acrescenta a lista. A contagem vem da
 * consulta que carregou a tarefa, e em criar/atualizar essa consulta acontece
 * ANTES de os anexos serem gravados: sem esta linha, salvar uma tarefa com dois
 * anexos devolveria `total_anexos: 0` e o clipe do cartao so apareceria no
 * refresh seguinte. A lista aqui e a autoritativa.
 */
async function comAnexos(tarefa) {
  const anexos = await tarefaRepository.listarAnexos(tarefa.id_tarefa)
  return { ...tarefa, anexos, total_anexos: anexos.length }
}

// ---------------------------------------------------------------------------
// LEITURA
// ---------------------------------------------------------------------------

/**
 * As tarefas que esta pessoa enxerga. Ver o cabecalho.
 *
 * NUNCA responde 403 para quem pertence a incubadora: sem a chave do quadro, a
 * lista simplesmente vem recortada — e vem vazia para quem nao tem tarefa
 * nenhuma, que e a resposta correta e nao um erro.
 *
 * @param {object} [filtros] - `id_responsavel`, `id_startup` e `abertas`
 *   recortam no banco. Os demais filtros da tela (prioridade, prazo, campos
 *   personalizaveis) sao aplicados no front sobre a lista ja carregada, como
 *   nas outras listagens: a tela precisa do conjunto inteiro de qualquer forma
 *   para montar o kanban.
 */
async function listar(idTenant, filtros, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await garantirMembro(idTenant, usuario)
  const tudo = await enxergaTudo(idTenant, usuario)

  return tarefaRepository.listarPorTenant(idTenant, {
    doUsuario: tudo ? null : usuario?.id,
    idResponsavel: filtros?.idResponsavel ? Number(filtros.idResponsavel) : null,
    idStartup: filtros?.idStartup ? Number(filtros.idStartup) : null,
    apenasAbertas: filtros?.apenasAbertas === true,
  })
}

async function buscar(idTarefa, idTenant, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await garantirMembro(idTenant, usuario)
  const tudo = await enxergaTudo(idTenant, usuario)
  return comAnexos(await carregarVisivel(idTarefa, idTenant, usuario, tudo))
}

/**
 * Os numeros do topo da tela: total, abertas, atrasadas e "minhas".
 *
 * Conta dentro do MESMO escopo da listagem: dizer "12 abertas" para quem
 * enxerga tres seria pior do que nao ter contagem nenhuma.
 */
async function resumo(idTenant, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await garantirMembro(idTenant, usuario)
  const tudo = await enxergaTudo(idTenant, usuario)

  return {
    ...(await tarefaRepository.resumoPorTenant(idTenant, usuario?.id, {
      doUsuario: tudo ? null : usuario?.id,
    })),
    // A tela precisa saber de que escopo os numeros falam, para dizer a quem ve
    // so as proprias que e isso mesmo que esta acontecendo.
    escopo: tudo ? "TODAS" : "MINHAS",
  }
}

/**
 * A equipe da incubadora, para o seletor de responsavel.
 *
 * ENDPOINT PROPRIO DO MODULO, e nao um reaproveitamento de
 * `GET /tenants/:id/usuarios`: aquela rota e de administracao de usuarios e so
 * o admin da incubadora passa por ela. Um mentor com a chave de criar tarefa
 * receberia 403 ao abrir o seletor e ficaria sem conseguir atribuir a ninguem —
 * quer dizer, com metade da permissao que lhe foi dada.
 *
 * A porta aqui e PERTENCER A INCUBADORA, e nao uma chave de tarefas: sai so o
 * nome, o e-mail e o papel dos colegas, que e o que ja aparece escrito em cada
 * cartao. Exigir mais tornaria impossivel a quem recebeu uma tarefa passa-la
 * adiante.
 *
 * So os ATIVOS: atribuir tarefa a quem foi desligado da incubadora e criar uma
 * pendencia que ninguem vai ver.
 */
async function listarEquipe(idTenant, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await garantirMembro(idTenant, usuario)

  const pessoas = await tenantRepository.listarUsuarios(idTenant)
  return pessoas
    .filter((p) => p.ativo)
    .map((p) => ({
      id_usuario: p.id_usuario,
      nome: p.nome,
      email: p.email,
      papel: p.papel,
    }))
}

/**
 * Serve um anexo, autorizado pela visibilidade da TAREFA.
 *
 * Rota propria em vez de `GET /arquivos/:id` porque a regra generica de la nao
 * serve aqui: ela libera o arquivo privado para quem tem
 * `avaliacoes.entregas.baixar` — o mentor avaliando entrega —, que nao tem nada
 * a ver com quem participa de uma tarefa. Aqui a pergunta e outra: "voce
 * enxerga a tarefa onde este arquivo esta?". E o vinculo em `tarefa_anexo` que
 * a responde.
 *
 * Consequencia util: saber o UUID nao basta. O anexo so abre pela tarefa a que
 * pertence, e so para quem alcanca aquela tarefa.
 */
async function abrirAnexo(idTarefa, idArquivo, idTenant, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await garantirMembro(idTenant, usuario)
  const tudo = await enxergaTudo(idTenant, usuario)
  await carregarVisivel(idTarefa, idTenant, usuario, tudo)

  const pertence = await tarefaRepository
    .anexoPertence(idTarefa, idArquivo)
    .catch(() => false) // UUID malformado: 404, nao 500.
  if (!pertence) throw erroNegocio(404, "Anexo nao encontrado nesta tarefa.")

  return arquivoService.carregar(idArquivo, { idTenant })
}

// ---------------------------------------------------------------------------
// ESCRITA
// ---------------------------------------------------------------------------

async function criar(idTenant, dados, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, CRIAR)

  const preparados = await prepararDados(idTenant, dados)
  const anexos = await prepararAnexos(idTenant, dados.anexos)

  const tarefa = await tarefaRepository.criar({ ...preparados, criadoPor: usuario?.id })
  if (anexos) await tarefaRepository.definirAnexos(tarefa.id_tarefa, anexos, usuario?.id)

  await auditLogService.registrar({
    idTenant,
    idUsuario: usuario?.id,
    acao: "CRIAR",
    entidade: "tarefa",
    entidadeId: String(tarefa.id_tarefa),
    descricao: `Criou a tarefa "${tarefa.titulo}".`,
    dadosDepois: tarefa,
  })

  // Sem `await`: notificar e efeito colateral do fato, nao parte dele. O
  // service de notificacao devolve na hora e nunca lanca.
  notificacaoService.tarefaAtribuida({ tarefa, idAutor: usuario?.id })

  return comAnexos(tarefa)
}

async function atualizar(idTarefa, idTenant, dados, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await garantirMembro(idTenant, usuario)
  const tudo = await enxergaTudo(idTenant, usuario)

  const antes = await carregarVisivel(idTarefa, idTenant, usuario, tudo)
  await garantirPodeEditar(idTenant, usuario, antes)

  const preparados = await prepararDados(idTenant, dados)
  const anexos = await prepararAnexos(idTenant, dados.anexos)

  const tarefa = await tarefaRepository.atualizar(idTarefa, preparados)
  if (anexos) await tarefaRepository.definirAnexos(idTarefa, anexos, usuario?.id)

  await auditLogService.registrar({
    idTenant,
    idUsuario: usuario?.id,
    acao: "EDITAR",
    entidade: "tarefa",
    entidadeId: String(idTarefa),
    descricao: `Editou a tarefa "${tarefa.titulo}".`,
    dadosAntes: antes,
    dadosDepois: tarefa,
  })

  // SO QUANDO O RESPONSAVEL MUDA. Um email a cada gravacao — inclusive ao
  // corrigir uma virgula no titulo — ensinaria a pessoa a ignorar os avisos
  // deste sistema.
  if (Number(antes.id_responsavel) !== Number(tarefa.id_responsavel)) {
    notificacaoService.tarefaAtribuida({ tarefa, idAutor: usuario?.id })
  }
  // Idem para a conclusao: so na TRAVESSIA para concluida. Reeditar uma tarefa
  // que ja estava fechada nao e uma conclusao nova.
  if (antes.status_categoria !== "CONCLUIDA" && tarefa.status_categoria === "CONCLUIDA") {
    notificacaoService.tarefaConcluida({ tarefa, idAutor: usuario?.id })
  }

  return comAnexos(tarefa)
}

/**
 * O arrasto do kanban: muda a coluna e/ou a posicao.
 *
 * Endpoint proprio, e nao um PUT com o corpo inteiro, por duas razoes. A
 * primeira e que arrastar um cartao nao deveria exigir do front todos os
 * campos da tarefa — um PUT parcial apagaria o que nao fosse mandado. A segunda
 * e o registro: "moveu de Em andamento para Concluida" e o fato que interessa
 * na auditoria, e ele se perde no meio de um EDITAR generico.
 */
async function mover(idTarefa, idTenant, { status, ordem }, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await garantirMembro(idTenant, usuario)
  const tudo = await enxergaTudo(idTenant, usuario)

  const antes = await carregarVisivel(idTarefa, idTenant, usuario, tudo)
  await garantirPodeEditar(idTenant, usuario, antes)

  const chave = texto(status, 40)
  if (!chave) throw erroNegocio(400, "Informe a coluna de destino.")

  const destino = await tarefaConfigRepository.buscarStatus(idTenant, chave)
  if (!destino || !destino.ativo) throw erroNegocio(400, "Coluna invalida para esta incubadora.")

  const posicao = Number.isFinite(Number(ordem)) ? Math.max(0, Number(ordem)) : 0
  const tarefa = await tarefaRepository.mover(idTarefa, idTenant, chave, posicao)

  // Reposicionar dentro da mesma coluna e ajuste de prioridade visual, nao um
  // fato de gestao: registrar cada arrasto encheria a auditoria de ruido e
  // esconderia as mudancas que importam.
  if (antes.status !== chave) {
    await auditLogService.registrar({
      idTenant,
      idUsuario: usuario?.id,
      acao: "MOVER",
      entidade: "tarefa",
      entidadeId: String(idTarefa),
      descricao: `Moveu a tarefa "${tarefa.titulo}" de "${antes.status_rotulo || antes.status}" para "${tarefa.status_rotulo || chave}".`,
      dadosAntes: antes,
      dadosDepois: tarefa,
    })

    if (antes.status_categoria !== "CONCLUIDA" && tarefa.status_categoria === "CONCLUIDA") {
      notificacaoService.tarefaConcluida({ tarefa, idAutor: usuario?.id })
    }
  }

  return tarefa
}

/**
 * Exclui uma tarefa. O AUTOR sempre pode excluir a que criou; para as dos
 * outros, e preciso a chave `excluir` (ver o cabecalho).
 */
async function excluir(idTarefa, idTenant, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await garantirMembro(idTenant, usuario)
  const tudo = await enxergaTudo(idTenant, usuario)

  const tarefa = await carregarVisivel(idTarefa, idTenant, usuario, tudo)
  if (Number(tarefa.criado_por) !== Number(usuario?.id)) {
    await rbacService.garantirPermissao(idTenant, usuario, EXCLUIR)
  }

  await tarefaRepository.excluir(idTarefa, idTenant)

  await auditLogService.registrar({
    idTenant,
    idUsuario: usuario?.id,
    acao: "EXCLUIR",
    entidade: "tarefa",
    entidadeId: String(idTarefa),
    descricao: `Excluiu a tarefa "${tarefa.titulo}".`,
    dadosAntes: tarefa,
  })

  return { excluida: true }
}

module.exports = {
  listar,
  buscar,
  resumo,
  listarEquipe,
  abrirAnexo,
  criar,
  atualizar,
  mover,
  excluir,
}
