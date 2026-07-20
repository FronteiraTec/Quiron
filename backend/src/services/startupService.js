/**
 * Service de Startups (regra de negocio).
 */
const startupRepository = require("../repositories/startupRepository")
const tenantRepository = require("../repositories/tenantRepository")
const rbacService = require("./rbacService")
const { erroNegocio } = require("../utils/erros")

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

/** Busca sem checar nada — primitiva interna (ver trilhaService.buscarNo). */
async function buscarStartup(id) {
  const startup = await startupRepository.buscarPorId(id)
  if (!startup) throw erroNegocio(404, "Startup nao encontrada.")
  return startup
}

/** Carrega a startup e exige a permissao no tenant DELA. */
async function buscarComPermissao(id, usuario, chave) {
  const startup = await buscarStartup(id)
  await rbacService.garantirPermissao(startup.id_tenant, usuario, chave)
  return startup
}

/** Busca uma startup pelo id. */
async function buscar(id, usuario) {
  return buscarComPermissao(id, usuario, "startups.startups.visualizar")
}

/** Cria uma startup. */
async function criar(dados, usuario) {
  const { idTenant, nome } = dados
  if (!idTenant || !nome) {
    throw erroNegocio(400, "Informe id_tenant e nome da startup.")
  }
  await rbacService.garantirPermissao(idTenant, usuario, "startups.startups.criar")
  return startupRepository.criar(dados)
}

/** Atualiza os dados cadastrais (nome/cnpj) de uma startup. */
async function atualizar(id, dados, usuario) {
  const { nome, cnpj } = dados
  if (!nome) throw erroNegocio(400, "Informe o nome da startup.")
  await buscarComPermissao(id, usuario, "startups.startups.editar")
  return startupRepository.atualizar(id, { nome, cnpj })
}

const STATUS_VALIDOS = ["ATIVA", "PAUSADA", "ENCERRADA"]

/** Altera o status (ATIVA/PAUSADA/ENCERRADA) de uma startup. */
async function atualizarStatus(id, status, usuario) {
  if (!STATUS_VALIDOS.includes(status)) {
    throw erroNegocio(400, "Status invalido. Use ATIVA, PAUSADA ou ENCERRADA.")
  }
  await buscarComPermissao(id, usuario, "startups.startups.editar")
  return startupRepository.atualizarStatus(id, status)
}

/** Adiciona um membro (usuario) a uma startup. */
async function adicionarMembro(idStartup, idUsuario, lider, usuario) {
  if (!idUsuario) throw erroNegocio(400, "Informe o id_usuario.")
  await buscarComPermissao(idStartup, usuario, "startups.membros.adicionar")
  try {
    return await startupRepository.adicionarMembro(idStartup, idUsuario, !!lider)
  } catch (err) {
    // 23505 = violacao de UNIQUE (usuario ja e membro desta startup).
    if (err.code === "23505") {
      throw erroNegocio(409, "Este usuario ja e membro da startup.")
    }
    throw err
  }
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
  return startup
}

/** Lista as fases ja concluidas (aprovadas) de uma startup. */
async function listarFasesConcluidas(idStartup, usuario) {
  await buscarComPermissao(idStartup, usuario, "startups.startups.visualizar")
  return startupRepository.listarFasesConcluidas(idStartup)
}

module.exports = {
  listar,
  buscar,
  // Usado pelos services dos modelos de gestao (canvas/gut/5w2h), que precisam
  // da mesma checagem com a chave DELES.
  buscarComPermissao,
  criar,
  atualizar,
  atualizarStatus,
  adicionarMembro,
  listarMembros,
  listarMembrosDoTenant,
  removerMembro,
  buscarMinha,
  listarFasesConcluidas,
}
