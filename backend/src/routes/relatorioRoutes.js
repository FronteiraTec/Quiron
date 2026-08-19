/**
 * Rotas de Relatorios. Todas exigem Bearer Token e sao somente leitura.
 *
 * Cada rota e um relatorio fechado, e nao um /relatorios generico com um
 * parametro "tipo": as agregacoes nao tem nada em comum entre si alem do
 * tenant, e um seletor so esconderia cinco consultas diferentes atras da
 * mesma porta.
 */
const express = require("express")
const router = express.Router()

const ctrl = require("../controllers/relatorioController")
const { autenticar } = require("../middlewares/auth")

router.use(autenticar)

router.get("/progresso", ctrl.progresso) // ?id_tenant=
router.get("/entregas", ctrl.entregas) // ?id_tenant=&dias=
router.get("/gargalos", ctrl.gargalos) // ?id_tenant=
router.get("/engajamento", ctrl.engajamento) // ?id_tenant=&dias=
router.get("/tempo", ctrl.tempo) // ?id_tenant=

module.exports = router
