/**
 * Rotas da configuracao do cadastro de startup: tipos, situacoes e campos
 * personalizaveis. Todas exigem Bearer Token (middleware autenticar).
 *
 * Montado em /startups-config (ver routes/index.js), e nao em /startups/config,
 * pelo mesmo motivo de /agenda-config: /startups/:id capturaria "config" como
 * id de startup.
 *
 * Desativar usa PATCH /status, e nao DELETE: a operacao e reversivel e nao
 * apaga nada. Ver o comentario em startupConfigRepository.
 */
const express = require("express")
const router = express.Router()

const ctrl = require("../controllers/startupConfigController")
const { autenticar } = require("../middlewares/auth")

router.use(autenticar)

// Tipos. A chave e o identificador na URL (nao ha id numerico).
router.get("/tipos", ctrl.listarTipos) // ?id_tenant=&incluir_inativos=
router.get("/tipos/:chave/uso", ctrl.usoDoTipo) // ?id_tenant=
router.post("/tipos", ctrl.criarTipo)
router.put("/tipos/:chave", ctrl.atualizarTipo)
router.patch("/tipos/:chave/status", ctrl.alterarStatusTipo)

// Situacoes (o "status" configuravel de cada incubadora).
router.get("/situacoes", ctrl.listarSituacoes) // ?id_tenant=&incluir_inativas=
router.get("/situacoes/:chave/uso", ctrl.usoDaSituacao) // ?id_tenant=
router.post("/situacoes", ctrl.criarSituacao)
router.put("/situacoes/:chave", ctrl.atualizarSituacao)
router.patch("/situacoes/:chave/status", ctrl.alterarStatusSituacao)

// Campos personalizaveis. Aqui ha id numerico: o campo tem chave estavel, mas
// e a definicao que se edita, e ela nasce e morre por linha.
router.get("/campos", ctrl.listarCampos) // ?id_tenant=&incluir_inativos=
router.get("/campos/:id/uso", ctrl.usoDoCampo) // ?id_tenant=
router.post("/campos", ctrl.criarCampo)
router.put("/campos/:id", ctrl.atualizarCampo)
router.patch("/campos/:id/status", ctrl.alterarStatusCampo)

module.exports = router
