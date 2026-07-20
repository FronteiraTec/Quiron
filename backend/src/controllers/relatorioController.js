/**
 * Controller de Relatorios (HTTP). Delega ao relatorioService.
 *
 * Todos recebem ?id_tenant= e os de periodo aceitam ?dias= (padrao 90).
 */
const relatorioService = require("../services/relatorioService")

/** GET /relatorios/progresso — avanco de cada startup na trilha. */
async function progresso(req, res, next) {
  try {
    res.json(await relatorioService.progresso(req.query.id_tenant, req.usuario))
  } catch (err) {
    next(err)
  }
}

/** GET /relatorios/entregas — funil, fila de avaliacao e desempenho dos mentores. */
async function entregas(req, res, next) {
  try {
    res.json(await relatorioService.entregas(req.query.id_tenant, req.query.dias, req.usuario))
  } catch (err) {
    next(err)
  }
}

/** GET /relatorios/gargalos — os passos da trilha que mais travam startups. */
async function gargalos(req, res, next) {
  try {
    res.json(await relatorioService.gargalos(req.query.id_tenant, req.usuario))
  } catch (err) {
    next(err)
  }
}

/** GET /relatorios/engajamento — presenca em eventos por evento e por startup. */
async function engajamento(req, res, next) {
  try {
    res.json(await relatorioService.engajamento(req.query.id_tenant, req.query.dias, req.usuario))
  } catch (err) {
    next(err)
  }
}

module.exports = { progresso, entregas, gargalos, engajamento }
