/**
 * Controller de Modulos (HTTP). Delega ao moduloService.
 */
const moduloService = require("../services/moduloService")

async function listar(req, res, next) {
  try {
    res.json({ modulos: await moduloService.listar(req.query.id_fase) })
  } catch (err) {
    next(err)
  }
}

async function buscar(req, res, next) {
  try {
    res.json({ modulo: await moduloService.buscar(req.params.id) })
  } catch (err) {
    next(err)
  }
}

async function criar(req, res, next) {
  try {
    const { id_fase, nome, descricao, ordem } = req.body
    const modulo = await moduloService.criar({ idFase: id_fase, nome, descricao, ordem })
    res.status(201).json({ modulo })
  } catch (err) {
    next(err)
  }
}

module.exports = { listar, buscar, criar }
