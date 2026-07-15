/**
 * Rotas de Avaliacoes. Todas exigem Bearer Token (middleware autenticar).
 */
const express = require("express")
const router = express.Router()

const ctrl = require("../controllers/avaliacaoController")
const { autenticar } = require("../middlewares/auth")

router.use(autenticar)

router.get("/", ctrl.listar) // ?id_entrega=
router.post("/", ctrl.criar)

module.exports = router
