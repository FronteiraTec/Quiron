/**
 * Rotas de Mentores. Todas exigem Bearer Token (middleware autenticar).
 *
 * A autorizacao real (admin da incubadora ou root) fica no service, porque o
 * JWT nao carrega o papel — ver mentorService / tenantService.garantirAcessoTenant.
 */
const express = require("express")
const router = express.Router()

const ctrl = require("../controllers/mentorController")
const { autenticar } = require("../middlewares/auth")

router.use(autenticar)

router.get("/", ctrl.listar) // ?id_tenant=
router.get("/:idUsuario/startups", ctrl.detalhar) // ?id_tenant= -> acompanha + disponiveis
router.post("/:idUsuario/startups", ctrl.vincular) // body: id_tenant, id_startup
router.delete("/:idUsuario/startups/:idStartup", ctrl.desvincular) // ?id_tenant=

module.exports = router
