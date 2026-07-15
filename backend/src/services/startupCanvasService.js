/**
 * Service do Business Model Canvas de uma startup.
 */
const startupCanvasRepository = require("../repositories/startupCanvasRepository")
const startupService = require("./startupService")
const { erroNegocio } = require("../utils/erros")

/** Lista os blocos do canvas de uma startup. */
async function listar(idStartup) {
  await startupService.buscar(idStartup) // garante que a startup existe (404 se nao)
  return startupCanvasRepository.listar(idStartup)
}

/** Salva o conteudo de um bloco do canvas. */
async function salvarBloco(idStartup, bloco, conteudo) {
  if (!startupCanvasRepository.BLOCOS.includes(bloco)) {
    throw erroNegocio(400, "Bloco de canvas invalido.")
  }
  await startupService.buscar(idStartup) // garante que a startup existe (404 se nao)
  return startupCanvasRepository.salvarBloco(idStartup, bloco, conteudo ?? "")
}

module.exports = { listar, salvarBloco }
