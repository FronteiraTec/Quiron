/**
 * Rotas de Eventos. Todas exigem Bearer Token (middleware autenticar).
 */
const express = require("express")
const router = express.Router()

const ctrl = require("../controllers/eventoController")
const { autenticar } = require("../middlewares/auth")

router.use(autenticar)

router.get("/", ctrl.listar) // ?id_tenant=&inicio=&fim=
router.get("/:id", ctrl.buscar)
router.get("/:id/participantes", ctrl.listarParticipantes)
router.post("/", ctrl.criar)
router.put("/:id", ctrl.atualizar)
router.delete("/:id", ctrl.excluir)
router.post("/:id/confirmar", ctrl.confirmarPresenca)

module.exports = router
