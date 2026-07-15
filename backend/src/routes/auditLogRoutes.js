/**
 * Rotas de Audit Log. Todas exigem Bearer Token (middleware autenticar).
 */
const express = require("express")
const router = express.Router()

const ctrl = require("../controllers/auditLogController")
const { autenticar } = require("../middlewares/auth")

router.use(autenticar)

router.get("/", ctrl.listar) // ?id_tenant=&limite=

module.exports = router
