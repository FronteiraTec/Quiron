/**
 * Rotas da Jornada do incubado. Todas exigem Bearer Token.
 *
 * E a trilha (/trilha) vista pelo lado da startup: so o que esta ativo, com o
 * estado da entrega de cada passo. Por isso um recurso proprio, e nao mais um
 * parametro em /trilha — o recorte e a regra de negocio sao outros.
 */
const express = require("express")
const router = express.Router()

const ctrl = require("../controllers/jornadaController")
const espacoMentor = require("../controllers/espacoMentorController")
const { autenticar } = require("../middlewares/auth")

router.use(autenticar)

// Antes de "/": nao ha conflito de rota aqui, mas manter as listagens juntas
// deixa claro que a Jornada agora tem duas entradas — a lista de trilhas e
// uma trilha especifica.
router.get("/trilhas", ctrl.listarTrilhas) // ?id_startup=
router.get("/", ctrl.carregar) // ?id_startup=&id_trilha=

// Os materiais que os mentores entregaram a startup (Espaco do Mentor,
// migracao 020), lidos pelo mesmo vinculo com que ela le a propria trilha. O
// arquivo de um material pessoal so sai por aqui — saber o UUID nao basta, e
// preciso alcancar a startup que o recebeu.
router.get("/materiais", espacoMentor.listarRecebidos) // ?id_startup=&id_trilha=
router.get("/materiais/:id/arquivo", espacoMentor.baixarRecebido)
router.get("/materiais/:id", espacoMentor.buscarRecebido)

// Entregas do incubado. Rascunho e envio sao o mesmo upsert com status
// diferente; reenviar tambem limpa as avaliacoes anteriores.
router.post("/rascunho", ctrl.salvarRascunho)
router.post("/enviar", ctrl.enviar)
router.post("/reenviar", ctrl.reenviar)

// Passo sem entrega (so conteudo): a propria startup marca que concluiu.
router.post("/concluir", ctrl.concluirPasso)
router.post("/desfazer-conclusao", ctrl.desfazerConclusao)

module.exports = router
