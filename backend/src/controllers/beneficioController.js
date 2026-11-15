/**
 * Controller dos beneficios da startup (HTTP). Delega ao beneficioService.
 */
const beneficioService = require("../services/beneficioService")

async function listarDaStartup(req, res, next) {
  try {
    res.json({ beneficios: await beneficioService.listarDaStartup(req.params.id, req.usuario) })
  } catch (err) {
    next(err)
  }
}

async function definir(req, res, next) {
  try {
    const beneficio = await beneficioService.definir(
      req.params.id,
      req.params.beneficio,
      req.body?.ativo,
      req.usuario
    )
    res.json({ beneficio })
  } catch (err) {
    next(err)
  }
}

async function meus(req, res, next) {
  try {
    res.json({ beneficios: await beneficioService.meus(req.query.id_tenant, req.usuario) })
  } catch (err) {
    next(err)
  }
}

module.exports = { listarDaStartup, definir, meus }
