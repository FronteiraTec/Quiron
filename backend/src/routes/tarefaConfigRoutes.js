/**
 * Rotas da configuracao da gestao de tarefas: os STATUS (as colunas do quadro) e
 * os campos personalizaveis. Todas exigem Bearer Token (middleware autenticar).
 *
 * Montado em /tarefas-config (ver routes/index.js), e nao em /tarefas/config,
 * pelo mesmo motivo de /startups-config: /tarefas/:id capturaria "config" como
 * id de tarefa.
 *
 * Desativar usa PATCH /status, e nao DELETE: a operacao e reversivel e nao
 * apaga nada. Ver o comentario em tarefaConfigRepository.
 */
const express = require("express")
const router = express.Router()

const ctrl = require("../controllers/tarefaConfigController")
const { autenticar } = require("../middlewares/auth")

router.use(autenticar)

// Colunas do quadro. A chave e o identificador na URL (nao ha id numerico).
// "/status/:chave/status" seria ilegivel, entao o interruptor virou /ativo.
router.get("/status", ctrl.listarStatus) // ?id_tenant=&incluir_inativos=
router.get("/status/:chave/uso", ctrl.usoDoStatus) // ?id_tenant=
router.post("/status", ctrl.criarStatus)
router.put("/status/:chave", ctrl.atualizarStatus)
router.patch("/status/:chave/ativo", ctrl.alterarStatusDoStatus)

// Campos personalizaveis. Aqui ha id numerico: o campo tem chave estavel, mas
// e a definicao que se edita, e ela nasce e morre por linha.
router.get("/campos", ctrl.listarCampos) // ?id_tenant=&incluir_inativos=
router.get("/campos/:id/uso", ctrl.usoDoCampo) // ?id_tenant=
router.post("/campos", ctrl.criarCampo)
router.put("/campos/:id", ctrl.atualizarCampo)
router.patch("/campos/:id/status", ctrl.alterarStatusCampo)

module.exports = router
