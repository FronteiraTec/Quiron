/**
 * Rotas do engajamento: placar, painel da propria pessoa, extrato e os
 * lancamentos manuais da coordenacao. Todas exigem Bearer Token.
 *
 * `/meu-painel` e o `/extrato` do proprio usuario NAO passam por RBAC (ver o
 * service): sao dado da propria pessoa, como /jornada e o Perfil.
 *
 * O estorno e DELETE /pontos/:id e vale so para lancamento manual. Ponto de
 * presenca se desfaz desmarcando a presenca na lista de chamada — o service
 * devolve 409 explicando, em vez de criar um segundo jeito de mexer no mesmo
 * numero.
 */
const express = require("express")
const router = express.Router()

const ctrl = require("../controllers/engajamentoController")
const { autenticar } = require("../middlewares/auth")

router.use(autenticar)

router.get("/ranking", ctrl.ranking) // ?id_tenant=&id_temporada=
router.get("/meu-painel", ctrl.meuPainel) // ?id_tenant=&id_temporada=
router.get("/extrato", ctrl.extrato) // ?id_tenant=&id_usuario=&id_temporada=
// Quem pode receber ponto ou selo, com a liga de cada um. E a lista das duas
// telas de acao (lancar participacao, conceder selo) — basta UMA das duas
// chaves de acao para abri-la.
router.get("/participantes", ctrl.participantes) // ?id_tenant=

router.post("/pontos", ctrl.lancar)
router.delete("/pontos/:id", ctrl.estornar)

module.exports = router
