/**
 * Rotas de Startups. Todas exigem Bearer Token (middleware autenticar).
 */
const express = require("express")
const router = express.Router()

const ctrl = require("../controllers/startupController")
const { autenticar } = require("../middlewares/auth")

router.use(autenticar)

router.get("/", ctrl.listar) // ?id_tenant=
router.get("/minha", ctrl.buscarMinha) // ?id_tenant= (startup do usuario logado)
// Antes de "/:id", como o /minha acima: senao "membros" seria lido como o id
// de uma startup.
router.get("/membros", ctrl.listarMembrosDoTenant) // ?id_tenant= (todas as startups)
router.get("/:id", ctrl.buscar)
router.post("/", ctrl.criar)
router.put("/:id", ctrl.atualizar)
router.patch("/:id/situacao", ctrl.atualizarSituacao)
router.get("/:id/membros", ctrl.listarMembros)
router.post("/:id/membros", ctrl.adicionarMembro)
router.delete("/:id/membros/:idUsuario", ctrl.removerMembro)
// Quem acompanha esta startup. O vinculo e gerido em /mentores; aqui e so a
// leitura pelo lado da startup, ao lado dos membros.
router.get("/:id/mentores", require("../controllers/mentorController").listarPorStartup)
router.get("/:id/fases-concluidas", ctrl.listarFasesConcluidas)

const canvasCtrl = require("../controllers/startupCanvasController")
router.get("/:id/canvas", canvasCtrl.listar)
router.put("/:id/canvas/:bloco", canvasCtrl.salvarBloco)

const gutCtrl = require("../controllers/startupGutController")
router.get("/:id/gut", gutCtrl.listar)
router.post("/:id/gut", gutCtrl.criar)
router.delete("/:id/gut/:idGut", gutCtrl.remover)

const cincoW2hCtrl = require("../controllers/startup5w2hController")
router.get("/:id/5w2h", cincoW2hCtrl.listar)
router.post("/:id/5w2h", cincoW2hCtrl.criar)
router.delete("/:id/5w2h/:id5w2h", cincoW2hCtrl.remover)

module.exports = router
