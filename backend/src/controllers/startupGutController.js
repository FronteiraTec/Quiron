/**
 * Controller da Matriz GUT de uma startup (HTTP). Delega ao startupGutService.
 */
const startupGutService = require("../services/startupGutService")

async function listar(req, res, next) {
  try {
    res.json({ itens: await startupGutService.listar(req.params.id) })
  } catch (err) {
    next(err)
  }
}

async function criar(req, res, next) {
  try {
    const item = await startupGutService.criar(req.params.id, req.body)
    res.status(201).json({ item })
  } catch (err) {
    next(err)
  }
}

async function remover(req, res, next) {
  try {
    await startupGutService.remover(req.params.id, req.params.idGut)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}

module.exports = { listar, criar, remover }
