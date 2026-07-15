/**
 * Rotas de Entregas. Todas exigem Bearer Token (middleware autenticar).
 */
const express = require("express")
const router = express.Router()

const ctrl = require("../controllers/entregaController")
const { autenticar } = require("../middlewares/auth")

router.use(autenticar)

router.get("/", ctrl.listar) // ?id_startup=
router.get("/:id", ctrl.buscar) // inclui respostas
router.post("/", ctrl.criar)
router.post("/questionario", ctrl.responder) // entrega de tarefa QUESTIONARIO

module.exports = router
