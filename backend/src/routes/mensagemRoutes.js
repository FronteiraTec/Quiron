/**
 * Rotas de Mensagens internas. Todas exigem Bearer Token.
 *
 * A caixa de entrada e sempre a de quem chamou (o service filtra por
 * req.usuario.id), por isso nao ha id de usuario na URL.
 *
 * Os caminhos fixos ("/nao-lidas", "/opcoes", "/enviadas", "/lidas") vem antes
 * dos que tem parametro: registrados depois, "/:id/..." os capturaria como se
 * "enviadas" fosse o id de uma mensagem.
 */
const express = require("express")
const router = express.Router()

const ctrl = require("../controllers/mensagemController")
const { autenticar } = require("../middlewares/auth")

router.use(autenticar)

router.get("/", ctrl.caixaDeEntrada) // ?id_tenant=&limite=&nao_lidas=
router.get("/nao-lidas", ctrl.contarNaoLidas) // ?id_tenant=
router.get("/opcoes", ctrl.opcoes) // ?id_tenant=
router.get("/enviadas", ctrl.listarEnviadas) // ?id_tenant=&limite=

// Conversas (migracao 013). O ":id" aqui e a OUTRA PESSOA, nao a mensagem: a
// conversa nao tem id proprio, e o par (voce, ele).
router.get("/conversas", ctrl.listarConversas) // ?id_tenant=
router.get("/conversas/:id", ctrl.abrirConversa) // ?id_tenant=&limite=&marcar=
router.post("/conversas/:id", ctrl.responder) // body: id_tenant, corpo
router.post("/conversas/:id/lidas", ctrl.marcarConversaLida) // body: id_tenant

router.post("/", ctrl.enviar)
router.post("/lidas", ctrl.marcarTodasLidas) // body: id_tenant

router.get("/:id/destinatarios", ctrl.listarDestinatarios)
router.post("/:id/lida", ctrl.marcarLida)
router.delete("/:id", ctrl.excluir)

module.exports = router
