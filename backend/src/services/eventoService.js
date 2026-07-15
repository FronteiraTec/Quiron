/**
 * Service de Eventos (regra de negocio).
 *
 * "Evento" e o registro generico usado pelo calendario da incubacao: cobre
 * mentorias, workshops, entregas, reunioes, pitches, prazos e visitas -
 * distinguidos pelo campo "categoria" (ver eventoCategoria no schema.sql).
 *
 * Direcionamento: um evento pode ser GERAL (visivel a todas as startups do
 * tenant) ou direcionado a uma ou mais startups especificas (idsStartups).
 * Admin/mentor sempre veem todos os eventos do tenant; um usuario comum
 * (papel "usuario", vinculado a startup) so ve eventos gerais + os
 * direcionados as startups das quais e membro ou mentor.
 */
const eventoRepository = require("../repositories/eventoRepository")
const tenantRepository = require("../repositories/tenantRepository")
const startupRepository = require("../repositories/startupRepository")
const rbacService = require("./rbacService")
const auditLogService = require("./auditLogService")
const { erroNegocio } = require("../utils/erros")

const STATUS_CONFIRMACAO = ["CONFIRMADO", "RECUSADO", "TALVEZ"]
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
async function listar(idTenant, periodo, idUsuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")

  const papel = await tenantRepository.buscarPapel(idTenant, idUsuario)
  const restringir = papel === "usuario"
  const idsPermitidos = restringir
    ? await startupRepository.listarIdsPorUsuario(idTenant, idUsuario)
    : null

  return eventoRepository.listarPorTenant(idTenant, periodo, idsPermitidos)
}

/** Busca um evento pelo id. */
async function buscar(id) {
  const evento = await eventoRepository.buscarPorId(id)
  if (!evento) throw erroNegocio(404, "Evento nao encontrado.")
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
  confirmarPresenca,
  listarParticipantes,
}
