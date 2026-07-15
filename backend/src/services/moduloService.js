/**
 * Service de Modulos (regra de negocio).
 */
const moduloRepository = require("../repositories/moduloRepository")
const { erroNegocio } = require("../utils/erros")

/** Lista os modulos de uma fase. */
async function listar(idFase) {
  if (!idFase) throw erroNegocio(400, "Informe o id_fase.")
  return moduloRepository.listarPorFase(idFase)
}

/** Busca um modulo pelo id. */
async function buscar(id) {
  const modulo = await moduloRepository.buscarPorId(id)
  if (!modulo) throw erroNegocio(404, "Modulo nao encontrado.")
  return modulo
}

/** Cria um modulo. */
async function criar(dados) {
  const { idFase, nome, descricao, ordem } = dados
  if (!idFase || !nome || !descricao || ordem == null) {
    throw erroNegocio(400, "Informe id_fase, nome, descricao e ordem.")
  }
  return moduloRepository.criar(dados)
}

module.exports = { listar, buscar, criar }
