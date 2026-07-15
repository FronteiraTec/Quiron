/**
 * Controller de Preferencias (HTTP). Delega ao preferenciaService.
 *
 * Fino de proposito: le a requisicao, chama o service e devolve a resposta.
 * As preferencias sao sempre do usuario autenticado (req.usuario.id).
 */
const preferenciaService = require("../services/preferenciaService")

/**
 * GET /preferencias
 * Retorna as preferencias do usuario logado (ou o padrao).
 */
async function obter(req, res, next) {
  try {
    const preferencias = await preferenciaService.obter(req.usuario.id)
    res.json({ preferencias })
  } catch (err) {
    next(err)
  }
}

/**
 * PUT /preferencias
 * Atualiza as preferencias do usuario logado.
 */
async function atualizar(req, res, next) {
  try {
    const preferencias = await preferenciaService.atualizar(req.usuario.id, req.body)
    res.json({ mensagem: "Preferencias atualizadas.", preferencias })
  } catch (err) {
    next(err)
  }
}

module.exports = { obter, atualizar }
