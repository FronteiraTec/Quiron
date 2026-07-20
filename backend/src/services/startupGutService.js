/**
 * Service da Matriz GUT de uma startup.
 */
const startupGutRepository = require("../repositories/startupGutRepository")
const startupService = require("./startupService")
const { erroNegocio } = require("../utils/erros")

function validarNota(valor, campo) {
  const numero = Number(valor)
  if (!Number.isInteger(numero) || numero < 1 || numero > 5) {
    throw erroNegocio(400, `${campo} deve ser um numero inteiro entre 1 e 5.`)
  }
  return numero
}

/** Lista os itens GUT de uma startup. */
async function listar(idStartup, usuario) {
  await startupService.buscarComPermissao(idStartup, usuario, "startups.gut.visualizar")
  return startupGutRepository.listar(idStartup)
}

/** Cria um item da matriz GUT. */
async function criar(idStartup, dados, usuario) {
  const { problema, gravidade, urgencia, tendencia } = dados
  if (!problema) throw erroNegocio(400, "Informe o problema.")
  await startupService.buscarComPermissao(idStartup, usuario, "startups.gut.criar")
  return startupGutRepository.criar(idStartup, {
    problema,
    gravidade: validarNota(gravidade, "Gravidade"),
    urgencia: validarNota(urgencia, "Urgencia"),
    tendencia: validarNota(tendencia, "Tendencia"),
  })
}

/** Remove um item da matriz GUT. */
async function remover(idStartup, idGut, usuario) {
  await startupService.buscarComPermissao(idStartup, usuario, "startups.gut.excluir")
  const item = await startupGutRepository.remover(idStartup, idGut)
  if (!item) throw erroNegocio(404, "Item GUT nao encontrado nesta startup.")
  return item
}

module.exports = { listar, criar, remover }
