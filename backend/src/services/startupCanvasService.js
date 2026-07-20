/**
 * Service do Business Model Canvas de uma startup.
 */
const startupCanvasRepository = require("../repositories/startupCanvasRepository")
const startupService = require("./startupService")
const { erroNegocio } = require("../utils/erros")

/** Lista os blocos do canvas de uma startup. */
async function listar(idStartup, usuario) {
  await startupService.buscarComPermissao(idStartup, usuario, "startups.canvas.visualizar")
  return startupCanvasRepository.listar(idStartup)
}

/** Salva o conteudo de um bloco do canvas. */
async function salvarBloco(idStartup, bloco, conteudo, usuario) {
  if (!startupCanvasRepository.BLOCOS.includes(bloco)) {
    throw erroNegocio(400, "Bloco de canvas invalido.")
  }
  await startupService.buscarComPermissao(idStartup, usuario, "startups.canvas.editar")
  return startupCanvasRepository.salvarBloco(idStartup, bloco, conteudo ?? "")
}

module.exports = { listar, salvarBloco }
