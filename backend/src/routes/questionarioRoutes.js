/**
 * Rotas de Questionarios. Todas exigem Bearer Token (middleware autenticar).
 */
const express = require("express")
const router = express.Router()

const ctrl = require("../controllers/questionarioController")
const { autenticar } = require("../middlewares/auth")

router.use(autenticar)

router.get("/", ctrl.listar) // ?id_tenant=
router.get("/:id", ctrl.buscar) // inclui perguntas e alternativas
router.post("/", ctrl.criar) // admin: cria com perguntas/alternativas
router.put("/:id", ctrl.atualizar) // edita; perguntas so enquanto ninguem respondeu
router.patch("/:id/ativo", ctrl.alternarAtivo) // admin: ativa/desativa

module.exports = router
