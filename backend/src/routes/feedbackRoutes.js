/**
 * Rotas de Feedback. Todas exigem Bearer Token.
 *
 * O feedback e sempre do usuario autenticado (req.usuario.id), por isso nao
 * ha id na URL - so o POST de envio.
 */
const express = require("express")
const router = express.Router()

const ctrl = require("../controllers/feedbackController")
const { autenticar } = require("../middlewares/auth")

router.use(autenticar)

router.post("/", ctrl.enviar)

module.exports = router
