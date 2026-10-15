/**
 * Controller de Audit Log (HTTP). Delega ao auditLogService.
 */
const auditLogService = require("../services/auditLogService")

async function listar(req, res, next) {
  try {
    const logs = await auditLogService.listar(req.query.id_tenant, req.query.limite, req.usuario)
    res.json({ logs })
  } catch (err) {
    next(err)
  }
}

module.exports = { listar }
