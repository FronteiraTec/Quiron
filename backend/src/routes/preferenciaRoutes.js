/**
 * Rotas de Preferencias do usuario. Todas exigem Bearer Token.
 *
 * As preferencias sempre pertencem ao usuario autenticado (req.usuario.id),
 * por isso nao ha id na URL.
 */
const express = require("express")
const router = express.Router()

const ctrl = require("../controllers/preferenciaController")
const { autenticar } = require("../middlewares/auth")

// Protege TODAS as rotas deste modulo.
router.use(autenticar)

router.get("/", ctrl.obter)
router.put("/", ctrl.atualizar)

module.exports = router
