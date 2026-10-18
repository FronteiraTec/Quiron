/**
 * Controller da analise SWOT de uma startup (HTTP). Delega ao startupSwotService.
 */
const startupSwotService = require("../services/startupSwotService")

async function listar(req, res, next) {
  try {
    res.json({ quadrantes: await startupSwotService.listar(req.params.id, req.usuario) })
  } catch (err) {
    next(err)
  }
}

async function salvarQuadrante(req, res, next) {
  try {
    const quadrante = await startupSwotService.salvarQuadrante(
      req.params.id,
      req.params.quadrante,
      req.body.conteudo,
      req.usuario
    )
    res.json({ quadrante })
  } catch (err) {
    next(err)
  }
}

module.exports = { listar, salvarQuadrante }
