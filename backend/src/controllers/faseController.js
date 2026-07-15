/**
 * Controller de Fases (HTTP). Delega ao faseService.
 */
const faseService = require("../services/faseService")

async function listar(req, res, next) {
  try {
    res.json({ fases: await faseService.listar(req.query.id_tenant) })
  } catch (err) {
    next(err)
  }
}

async function buscar(req, res, next) {
  try {
    res.json({ fase: await faseService.buscar(req.params.id) })
  } catch (err) {
    next(err)
  }
}

async function criar(req, res, next) {
  try {
    const { id_tenant, nome, descricao, ordem } = req.body
    const fase = await faseService.criar({ idTenant: id_tenant, nome, descricao, ordem })
    res.status(201).json({ fase })
  } catch (err) {
    next(err)
  }
}

module.exports = { listar, buscar, criar }
