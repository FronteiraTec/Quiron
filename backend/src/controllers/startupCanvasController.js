/**
 * Controller do Business Model Canvas de uma startup (HTTP). Delega ao startupCanvasService.
 */
const startupCanvasService = require("../services/startupCanvasService")

async function listar(req, res, next) {
  try {
    res.json({ blocos: await startupCanvasService.listar(req.params.id, req.usuario) })
  } catch (err) {
    next(err)
  }
}

async function salvarBloco(req, res, next) {
  try {
    const bloco = await startupCanvasService.salvarBloco(req.params.id, req.params.bloco, req.body.conteudo, req.usuario)
    res.json({ bloco })
  } catch (err) {
    next(err)
  }
}

module.exports = { listar, salvarBloco }
