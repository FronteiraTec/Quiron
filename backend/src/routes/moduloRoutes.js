/**
 * Rotas de Modulos. Todas exigem Bearer Token (middleware autenticar).
 */
const express = require("express")
const router = express.Router()

const ctrl = require("../controllers/moduloController")
const { autenticar } = require("../middlewares/auth")

router.use(autenticar)

router.get("/", ctrl.listar) // ?id_fase=
router.get("/:id", ctrl.buscar)
router.post("/", ctrl.criar)

module.exports = router
