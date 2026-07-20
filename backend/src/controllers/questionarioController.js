/**
 * Controller de Questionarios (HTTP). Delega ao questionarioService.
 */
const questionarioService = require("../services/questionarioService")

async function listar(req, res, next) {
  try {
    res.json({ questionarios: await questionarioService.listar(req.query.id_tenant, req.usuario) })
  } catch (err) {
    next(err)
  }
}

async function buscar(req, res, next) {
  try {
    res.json({ questionario: await questionarioService.buscar(req.params.id, req.usuario) })
  } catch (err) {
    next(err)
  }
}

async function criar(req, res, next) {
  try {
    const { id_tenant, titulo, descricao, perguntas } = req.body
    const questionario = await questionarioService.criar(
      { idTenant: id_tenant, titulo, descricao, perguntas },
      req.usuario
    )
    res.status(201).json({ questionario })
  } catch (err) {
    next(err)
  }
}

async function alternarAtivo(req, res, next) {
  try {
    const questionario = await questionarioService.alternarAtivo(
      req.params.id,
      !!req.body.ativo,
      req.usuario
    )
    res.json({ questionario })
  } catch (err) {
    next(err)
  }
}

module.exports = { listar, buscar, criar, alternarAtivo }
