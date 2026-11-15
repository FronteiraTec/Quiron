/**
 * Rotas dos beneficios vistos pela pessoa logada. Exigem Bearer Token.
 *
 * Conceder e revogar ficam em /startups/:id/beneficios (startupRoutes): sao
 * atos sobre UMA startup, com a mesma traducao de UUID das demais rotas dela.
 */
const express = require("express")
const router = express.Router()

const ctrl = require("../controllers/beneficioController")
const { autenticar } = require("../middlewares/auth")

router.use(autenticar)

// Os beneficios ativos das startups de que a pessoa e membro (o menu do CRM).
router.get("/meus", ctrl.meus) // ?id_tenant=

module.exports = router
