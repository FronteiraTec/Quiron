/**
 * Service da analise SWOT de uma startup.
 */
const startupSwotRepository = require("../repositories/startupSwotRepository")
const startupService = require("./startupService")
const { erroNegocio } = require("../utils/erros")

/** Lista os quadrantes da SWOT de uma startup. */
async function listar(idStartup, usuario) {
  await startupService.buscarComPermissao(idStartup, usuario, "startups.swot.visualizar")
  return startupSwotRepository.listar(idStartup)
}

/** Salva o conteudo de um quadrante da SWOT. */
async function salvarQuadrante(idStartup, quadrante, conteudo, usuario) {
  if (!startupSwotRepository.QUADRANTES.includes(quadrante)) {
    throw erroNegocio(400, "Quadrante da SWOT invalido.")
  }
  await startupService.buscarComPermissao(idStartup, usuario, "startups.swot.editar")
  return startupSwotRepository.salvarQuadrante(idStartup, quadrante, conteudo ?? "")
}

module.exports = { listar, salvarQuadrante }
