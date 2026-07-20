/**
 * Rotas da Trilha. Todas exigem Bearer Token (middleware autenticar).
 *
 * Substitui faseRoutes + moduloRoutes + tarefaRoutes: como os tres niveis
 * viraram uma arvore so, existe um recurso so. O nivel do no vem do campo
 * `tipo`, nao do caminho da URL.
 */
const express = require("express")
const router = express.Router()

const ctrl = require("../controllers/trilhaController")
const { autenticar } = require("../middlewares/auth")

router.use(autenticar)

// Arvore e nos
router.get("/", ctrl.arvore) // ?id_tenant=
router.post("/", ctrl.criar)
router.get("/:id", ctrl.buscar)
router.patch("/:id", ctrl.atualizar)
router.delete("/:id", ctrl.excluir)

// Estrutura
router.get("/:id/filhos", ctrl.listarFilhos)
router.patch("/:id/filhos/ordem", ctrl.reordenarFilhos) // body: { ids: [...] }
router.patch("/:id/mover", ctrl.mover) // body: { id_pai }

// Conteudos da Biblioteca vinculados ao passo
router.get("/:id/conteudos", ctrl.listarConteudos)
router.post("/:id/conteudos", ctrl.vincularConteudo) // body: { id_conteudo }
router.delete("/:id/conteudos/:idConteudo", ctrl.desvincularConteudo)

module.exports = router
