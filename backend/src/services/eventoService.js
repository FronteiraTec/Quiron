/**
 * Service de Eventos (regra de negocio).
 *
 * "Evento" e o registro generico usado pelo calendario da incubacao: cobre
 * mentorias, workshops, entregas, reunioes, pitches, prazos e visitas -
 * distinguidos pelo campo "categoria" (ver eventoCategoria no schema.sql).
 *
 * Direcionamento: um evento pode ser GERAL (visivel a todas as startups do
 * tenant) ou direcionado a uma ou mais startups especificas (idsStartups).
 *
 * Duas camadas que nao se confundem: a PERMISSAO (eventos.agenda.*) decide se
 * a pessoa acessa a agenda; o PAPEL decide quanto dela ela ve — admin enxerga
 * o tenant inteiro, mentor e usuario so os eventos gerais + os direcionados as
 * startups a que estao ligados.
 */
const eventoRepository = require("../repositories/eventoRepository")
const tenantRepository = require("../repositories/tenantRepository")
const startupRepository = require("../repositories/startupRepository")
const rbacService = require("./rbacService")
const auditLogService = require("./auditLogService")
const { erroNegocio } = require("../utils/erros")

const STATUS_CONFIRMACAO = ["CONFIRMADO", "RECUSADO", "TALVEZ"]
// Janela padrao da tela de presenca: eventos dos ultimos 3 meses. Presenca se
// marca logo depois do evento; o que passou muito disso ja virou relatorio.
const DIAS_PRESENCA_PADRAO = 90
const CATEGORIAS = [
  "MENTORIA", "WORKSHOP", "ENTREGA", "REUNIAO", "EVENTO", "PITCH", "PRAZO", "VISITA",
]

/**
 * Lista os eventos de um tenant, opcionalmente filtrando por periodo e
 * restringindo a visibilidade conforme o papel do usuario logado.
 * @param {number} idTenant
 * @param {{inicio?: string, fim?: string}} periodo
 * @param {number} idUsuario - usuario autenticado (define a restricao).
 */
async function listar(idTenant, periodo, idUsuario, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, "eventos.agenda.visualizar")

  // O papel abaixo NAO autoriza — recorta. Permissao responde "pode ver a
  // agenda?"; o papel responde "quais eventos desta agenda sao seus?". Sao
  // perguntas diferentes e as duas continuam valendo.
  const papel = await tenantRepository.buscarPapel(idTenant, idUsuario)
  // Mentor e usuario ficam restritos aos eventos gerais + os das startups a
  // que estao ligados. O admin (e o root/superusuario, que nao tem papel no
  // tenant) veem todos os eventos.
  const restringir = papel === "usuario" || papel === "mentor"
  const idsPermitidos = restringir
    ? await startupRepository.listarIdsPorUsuario(idTenant, idUsuario)
    : null

  return eventoRepository.listarPorTenant(idTenant, periodo, idsPermitidos)
}

/** Busca um evento pelo id. */
async function buscar(id, usuario) {
  const evento = await eventoRepository.buscarPorId(id)
  if (!evento) throw erroNegocio(404, "Evento nao encontrado.")
  await rbacService.garantirPermissao(evento.id_tenant, usuario, "eventos.agenda.visualizar")
  return evento
}

/** Valida os campos comuns a criacao/edicao de um evento. */
function validarDados({ titulo, categoria, inicioTs }) {
  if (!titulo || !inicioTs) {
    throw erroNegocio(400, "Informe titulo e inicio_ts.")
  }
  if (categoria && !CATEGORIAS.includes(categoria)) {
    throw erroNegocio(400, `Categoria invalida. Use: ${CATEGORIAS.join(", ")}.`)
  }
}

/**
 * Cria um evento. O criado_por vem do token (usuario autenticado); a
 * permissao "eventos.agenda.criar" (RBAC) e exigida (root sempre passa).
 * @param {object} dados
 * @param {{id:number, root?:boolean}} usuarioAutenticado
 */
async function criar(dados, usuarioAutenticado) {
  const { idTenant, criadoPor } = dados
  if (!idTenant || !criadoPor) {
    throw erroNegocio(400, "Informe id_tenant.")
  }
  await rbacService.garantirPermissao(idTenant, usuarioAutenticado, "eventos.agenda.criar")
  validarDados(dados)
  const evento = await eventoRepository.criar({ ...dados, categoria: dados.categoria || "EVENTO" })

  await auditLogService.registrar({
    idTenant,
    idUsuario: criadoPor,
    acao: "CRIAR",
    entidade: "evento",
    entidadeId: String(evento.id_evento),
    descricao: `Criou o evento "${evento.titulo}".`,
    dadosDepois: evento,
  })

  return evento
}

/**
 * Atualiza um evento existente.
 * @param {number} id
 * @param {object} dados
 * @param {{id:number}} usuarioAutenticado
 */
async function atualizar(id, dados, usuarioAutenticado) {
  validarDados(dados)
  const antes = await eventoRepository.buscarPorId(id)
  if (!antes) throw erroNegocio(404, "Evento nao encontrado.")
  await rbacService.garantirPermissao(antes.id_tenant, usuarioAutenticado, "eventos.agenda.editar")

  const evento = await eventoRepository.atualizar(id, { ...dados, categoria: dados.categoria || "EVENTO" })
  if (!evento) throw erroNegocio(404, "Evento nao encontrado.")

  await auditLogService.registrar({
    idTenant: antes.id_tenant,
    idUsuario: usuarioAutenticado?.id,
    acao: "EDITAR",
    entidade: "evento",
    entidadeId: String(evento.id_evento),
    descricao: `Editou o evento "${evento.titulo}".`,
    dadosAntes: antes,
    dadosDepois: evento,
  })

  return evento
}

/**
 * Exclui (soft delete) um evento.
 * @param {number} id
 * @param {{id:number}} usuarioAutenticado
 */
async function excluir(id, usuarioAutenticado) {
  const antes = await eventoRepository.buscarPorId(id)
  if (!antes) throw erroNegocio(404, "Evento nao encontrado.")
  await rbacService.garantirPermissao(antes.id_tenant, usuarioAutenticado, "eventos.agenda.excluir")

  const evento = await eventoRepository.excluir(id)
  if (!evento) throw erroNegocio(404, "Evento nao encontrado.")

  await auditLogService.registrar({
    idTenant: antes.id_tenant,
    idUsuario: usuarioAutenticado?.id,
    acao: "EXCLUIR",
    entidade: "evento",
    entidadeId: String(id),
    descricao: `Excluiu o evento "${antes.titulo}".`,
    dadosAntes: antes,
  })
}

// ---------------------------------------------------------------------------
// PRESENCA (check-in) — quem realmente apareceu.
//
// Distinto da CONFIRMACAO (RSVP) logo abaixo: confirmar e ato do participante
// ("pretendo ir"); marcar presenca e ato do ADMIN ("esteve la"), e por isso
// evento_presenca guarda `marcado_por`.
//
// Autorizacao: as chaves eventos.presenca.*. Ate a migracao 005 este bloco
// usava "admin do tenant ou root", porque as roles padrao nao existiam e exigir
// uma chave deixaria todo admin de fora — agora existem, com permissoes.
// ---------------------------------------------------------------------------

/** Carrega o evento e exige a chave de presenca no tenant DELE. */
async function garantirGestaoDoEvento(idEvento, usuario, chave) {
  const evento = await eventoRepository.buscarPorId(idEvento)
  if (!evento) throw erroNegocio(404, "Evento nao encontrado.")
  // O tenant vem do EVENTO, nao da query: assim nao da para passar o id de um
  // tenant onde se tem a chave para mexer no evento de outro.
  await rbacService.garantirPermissao(evento.id_tenant, usuario, chave)
  return evento
}

/** Lista de chamada de um evento: convidados, RSVP e presenca ja marcada. */
async function listarPresenca(idEvento, usuario) {
  const evento = await garantirGestaoDoEvento(idEvento, usuario, "eventos.presenca.visualizar")
  const publico = await eventoRepository.listarPublico(idEvento)
  return { evento, publico }
}

/** Eventos ja realizados e o andamento da marcacao de cada um. */
async function resumoPresenca(idTenant, dias, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, "eventos.presenca.visualizar")
  const janela = Number(dias) > 0 ? Number(dias) : DIAS_PRESENCA_PADRAO
  return eventoRepository.listarResumoPresenca(idTenant, janela)
}

/**
 * Marca presenca/ausencia de uma ou varias pessoas.
 *
 * So aceita quem esta no publico do evento. Sem essa checagem daria para
 * gravar presenca de um usuario de outra incubadora: a linha ficaria invisivel
 * (o relatorio so conta quem esta no publico) mas seria escrita cross-tenant
 * do mesmo jeito.
 *
 * NAO exige que o evento ja tenha comecado: marcar presenca de um evento
 * passado que ficou para tras e caso legitimo, e bloquear por data so quebraria
 * o preenchimento retroativo.
 *
 * @param {number[]} idsUsuarios
 * @param {boolean} presente
 */
async function marcarPresenca(idEvento, idsUsuarios, presente, usuario) {
  const evento = await garantirGestaoDoEvento(idEvento, usuario, "eventos.presenca.marcar")

  const ids = (Array.isArray(idsUsuarios) ? idsUsuarios : [idsUsuarios])
    .map(Number)
    .filter((n) => Number.isInteger(n))
  if (ids.length === 0) throw erroNegocio(400, "Informe ao menos um usuario.")
  if (typeof presente !== "boolean") {
    throw erroNegocio(400, "Informe `presente` como true ou false.")
  }

  const publico = await eventoRepository.listarPublico(idEvento)
  const convidados = new Set(publico.map((p) => p.id_usuario))
  const intrusos = ids.filter((id) => !convidados.has(id))
  if (intrusos.length > 0) {
    throw erroNegocio(400, "Ha usuarios que nao foram convidados para este evento.")
  }

  const marcados = await eventoRepository.marcarPresenca(idEvento, ids, presente, usuario.id)

  // Uma linha de auditoria por LOTE, nao por pessoa: a marcacao individual ja
  // guarda quem marcou e quando na propria linha (marcado_por / checkin_ts),
  // entao registrar cada clique aqui so inflaria o log.
  await auditLogService.registrar({
    idTenant: evento.id_tenant,
    idUsuario: usuario.id,
    acao: "EDITAR",
    entidade: "evento_presenca",
    entidadeId: String(idEvento),
    descricao:
      `Marcou ${ids.length} ${ids.length === 1 ? "pessoa" : "pessoas"} como ` +
      `${presente ? "presente" : "ausente"} no evento "${evento.titulo}".`,
  })

  return marcados
}

/** Confirma a presenca de um usuario em um evento. */
async function confirmarPresenca(idEvento, idUsuario, status) {
  if (!STATUS_CONFIRMACAO.includes(status)) {
    throw erroNegocio(400, `Status invalido. Use: ${STATUS_CONFIRMACAO.join(", ")}.`)
  }
  return eventoRepository.confirmarPresenca(idEvento, idUsuario, status)
}

/** Lista os participantes (confirmacoes) de um evento. */
async function listarParticipantes(idEvento) {
  return eventoRepository.listarParticipantes(idEvento)
}

module.exports = {
  listar,
  buscar,
  criar,
  atualizar,
  excluir,
  listarPresenca,
  resumoPresenca,
  marcarPresenca,
  confirmarPresenca,
  listarParticipantes,
}
