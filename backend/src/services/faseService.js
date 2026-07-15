/**
 * Service de Fases (regra de negocio).
 */
const faseRepository = require("../repositories/faseRepository")
const { erroNegocio } = require("../utils/erros")

/** Lista as fases de um tenant. */
async function listar(idTenant) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  return faseRepository.listarPorTenant(idTenant)
}

/** Busca uma fase pelo id. */
async function buscar(id) {
  const fase = await faseRepository.buscarPorId(id)
  if (!fase) throw erroNegocio(404, "Fase nao encontrada.")
  return fase
}

/** Cria uma fase. */
async function criar(dados) {
  const { idTenant, nome, descricao, ordem } = dados
  if (!idTenant || !nome || !descricao || ordem == null) {
    throw erroNegocio(400, "Informe id_tenant, nome, descricao e ordem.")
  }
  return faseRepository.criar(dados)
}

module.exports = { listar, buscar, criar }
