/**
 * Rotas de Entregas. Todas exigem Bearer Token (middleware autenticar).
 */
const express = require("express")
const router = express.Router()

const ctrl = require("../controllers/entregaController")
const { autenticar } = require("../middlewares/auth")

router.use(autenticar)

router.get("/", ctrl.listar) // ?id_startup=
// Antes de "/:id": senao "fila" seria lido como um id de entrega.
router.get("/fila", ctrl.fila) // ?id_tenant= -> fila de avaliacao do mentor
router.get("/:id", ctrl.buscar) // inclui respostas
router.get("/:id/detalhe", ctrl.detalhe) // contexto completo p/ avaliar
router.post("/", ctrl.criar)
router.post("/questionario", ctrl.responder) // entrega de tarefa QUESTIONARIO

module.exports = router
