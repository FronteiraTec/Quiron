/**
 * Controller do plano de acao 5W2H de uma startup (HTTP). Delega ao startup5w2hService.
 */
const startup5w2hService = require("../services/startup5w2hService")

async function listar(req, res, next) {
  try {
    res.json({ itens: await startup5w2hService.listar(req.params.id) })
  } catch (err) {
    next(err)
  }
}

async function criar(req, res, next) {
  try {
    const item = await startup5w2hService.criar(req.params.id, req.body)
    res.status(201).json({ item })
  } catch (err) {
    next(err)
  }
}

async function remover(req, res, next) {
  try {
    await startup5w2hService.remover(req.params.id, req.params.id5w2h)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}

module.exports = { listar, criar, remover }
