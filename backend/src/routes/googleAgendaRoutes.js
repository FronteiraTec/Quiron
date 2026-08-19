/**
 * Rotas da integracao com o Google Agenda.
 *
 * Este modulo NAO faz `router.use(autenticar)` como os outros: o /callback
 * precisa ser publico. Ele e o retorno do navegador vindo da tela de
 * consentimento do Google, um salto em que nao existe cabecalho Authorization
 * — quem identifica a pessoa la e o `state` assinado. Por isso a autenticacao
 * e declarada rota a rota, como no arquivoRoutes.
 *
 * Nao ha permissao RBAC aqui, de proposito: conectar a PROPRIA conta Google e
 * ato pessoal, como as preferencias de aparencia. As chaves eventos.agenda.*
 * continuam decidindo o que a pessoa enxerga da agenda — e o que ela nao
 * enxerga simplesmente nao e enviado.
 */
const express = require("express")
const router = express.Router()

const ctrl = require("../controllers/googleAgendaController")
const { autenticar } = require("../middlewares/auth")

// PUBLICA — ver o cabecalho acima. Declarada antes das demais para deixar
// obvio que a ausencia de `autenticar` e escolha, e nao esquecimento.
router.get("/callback", ctrl.callback)

router.get("/status", autenticar, ctrl.status)
router.get("/autorizar", autenticar, ctrl.autorizar)
router.post("/sincronizar", autenticar, ctrl.sincronizar)
router.patch("/sincronizacao", autenticar, ctrl.alterarSincronizacao)
router.delete("/conexao", autenticar, ctrl.desconectar)

module.exports = router
