/**
 * Service de Startups (regra de negocio).
 */
const startupRepository = require("../repositories/startupRepository")
const { erroNegocio } = require("../utils/erros")

/** Lista as startups de um tenant. */
async function listar(idTenant) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  return startupRepository.listarPorTenant(idTenant)
}

/** Busca uma startup pelo id. */
async function buscar(id) {
  const startup = await startupRepository.buscarPorId(id)
  if (!startup) throw erroNegocio(404, "Startup nao encontrada.")
  return startup
}

/** Cria uma startup. */
async function criar(dados) {
  const { idTenant, nome } = dados
  if (!idTenant || !nome) {
    throw erroNegocio(400, "Informe id_tenant e nome da startup.")
  }
  return startupRepository.criar(dados)
}

/** Atualiza os dados cadastrais (nome/cnpj) de uma startup. */
async function atualizar(id, dados) {
  const { nome, cnpj } = dados
  if (!nome) throw erroNegocio(400, "Informe o nome da startup.")
  await buscar(id) // garante que a startup existe (404 se nao)
  return startupRepository.atualizar(id, { nome, cnpj })
}

const STATUS_VALIDOS = ["ATIVA", "PAUSADA", "ENCERRADA"]

/** Altera o status (ATIVA/PAUSADA/ENCERRADA) de uma startup. */
async function atualizarStatus(id, status) {
  if (!STATUS_VALIDOS.includes(status)) {
    throw erroNegocio(400, "Status invalido. Use ATIVA, PAUSADA ou ENCERRADA.")
  }
  await buscar(id) // garante que a startup existe (404 se nao)
  return startupRepository.atualizarStatus(id, status)
}

/** Adiciona um membro (usuario) a uma startup. */
async function adicionarMembro(idStartup, idUsuario, lider) {
  if (!idUsuario) throw erroNegocio(400, "Informe o id_usuario.")
  await buscar(idStartup) // garante que a startup existe (404 se nao)
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
async function listarMembros(idStartup) {
  await buscar(idStartup) // garante que a startup existe (404 se nao)
  return startupRepository.listarMembros(idStartup)
}

/** Remove (desativa) um membro de uma startup. */
async function removerMembro(idStartup, idUsuario) {
  await buscar(idStartup) // garante que a startup existe (404 se nao)
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
async function listarFasesConcluidas(idStartup) {
  await buscar(idStartup) // garante que a startup existe (404 se nao)
  return startupRepository.listarFasesConcluidas(idStartup)
}

module.exports = {
  listar,
  buscar,
  criar,
  atualizar,
  atualizarStatus,
  adicionarMembro,
  listarMembros,
  removerMembro,
  buscarMinha,
  listarFasesConcluidas,
}
