/**
 * Service do plano de acao 5W2H de uma startup.
 */
const startup5w2hRepository = require("../repositories/startup5w2hRepository")
const startupService = require("./startupService")
const { erroNegocio } = require("../utils/erros")

/** Lista os itens 5W2H de uma startup. */
async function listar(idStartup, usuario) {
  await startupService.buscarComPermissao(idStartup, usuario, "startups.cinco_w2h.visualizar")
  return startup5w2hRepository.listar(idStartup)
}

/** Cria um item 5W2H. */
async function criar(idStartup, dados, usuario) {
  const { o_que: oQue, por_que: porQue, onde, quando, quem, como, quanto_custa: quantoCusta } = dados
  if (!oQue) throw erroNegocio(400, "Informe o campo 'O que'.")
  await startupService.buscarComPermissao(idStartup, usuario, "startups.cinco_w2h.criar")
  return startup5w2hRepository.criar(idStartup, { oQue, porQue, onde, quando, quem, como, quantoCusta })
}

/** Remove um item 5W2H. */
async function remover(idStartup, id5w2h, usuario) {
  await startupService.buscarComPermissao(idStartup, usuario, "startups.cinco_w2h.excluir")
  const item = await startup5w2hRepository.remover(idStartup, id5w2h)
  if (!item) throw erroNegocio(404, "Item 5W2H nao encontrado nesta startup.")
  return item
}

module.exports = { listar, criar, remover }
