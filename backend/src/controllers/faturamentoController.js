/**
 * Controller do faturamento da startup (HTTP). Delega ao faturamentoService.
 */
const faturamentoService = require("../services/faturamentoService")

async function daStartup(req, res, next) {
  try {
    res.json(await faturamentoService.daStartup(req.params.id, req.usuario))
  } catch (err) {
    next(err)
  }
}

module.exports = { daStartup }
