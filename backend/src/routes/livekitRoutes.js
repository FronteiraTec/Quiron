/**
 * Webhook do LiveKit: PUBLICO, protegido pela assinatura do proprio LiveKit
 * (ver reuniaoWebhookService). No painel do projeto, aponte para
 *   https://<dominio do ambiente>/api/livekit/webhook
 *
 * O corpo chega cru: o app.js monta o express.raw para este caminho antes do
 * express.json, que reserializaria o JSON e quebraria a conferencia do sha256.
 */
const express = require("express")
const router = express.Router()

const ctrl = require("../controllers/reuniaoController")

router.post("/webhook", ctrl.webhook)

module.exports = router
