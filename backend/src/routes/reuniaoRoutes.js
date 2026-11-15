/**
 * Rotas das reunioes por video (docs/reunioes.md). Todas exigem Bearer Token.
 * O webhook do LiveKit, que e publico, mora em livekitRoutes.js.
 */
const express = require("express")
const router = express.Router()

const ctrl = require("../controllers/reuniaoController")
const { autenticar } = require("../middlewares/auth")

router.use(autenticar)

// O pedaco de audio chega CRU (audio/webm, audio/ogg, audio/mp4), ate 512 KB.
// Qualquer tipo e lido aqui; o service confere se bate com o da gravacao.
const audioCru = express.raw({ type: () => true, limit: "512kb" })

// Antes de "/:id": senao "disponibilidade" seria lida como o id de uma reuniao.
router.get("/disponibilidade", ctrl.disponibilidade)
router.get("/convidaveis", ctrl.convidaveis) // ?id_tenant=
router.post("/processamentos/:idProcessamento/cancelar", ctrl.cancelarProcessamento)

router.get("/", ctrl.listar) // ?id_tenant=&de=&ate=&status=
router.post("/", ctrl.criar)

router.get("/:id", ctrl.buscar)
router.put("/:id", ctrl.atualizar)
router.delete("/:id", ctrl.excluir)

router.put("/:id/participantes", ctrl.definirParticipantes)
router.post("/:id/cancelar", ctrl.cancelar)
router.post("/:id/token", ctrl.token)
router.post("/:id/encerrar", ctrl.encerrar)

// Gravacao e transcricao (Etapa 4, docs/reunioes.md secao 5.1).
router.post("/:id/consentimento", ctrl.consentimento)
router.post("/:id/gravacoes", ctrl.abrirGravacao)
router.put("/:id/gravacoes/:idAudio/partes/:n", audioCru, ctrl.receberParte)
router.post("/:id/gravacoes/:idAudio/fechar", ctrl.fecharGravacao)
router.get("/:id/transcricao", ctrl.transcricao)
router.get("/:id/processamentos", ctrl.processamentos)
router.post("/:id/processamentos", ctrl.reprocessar)

module.exports = router
