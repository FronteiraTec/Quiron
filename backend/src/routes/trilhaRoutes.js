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

// Trilhas do tenant (os nos PROGRAMA). ANTES de "/:id": o Express casa na
// ordem de registro, e depois de "/:id" a palavra "programas" seria lida como
// um id de no.
router.get("/programas", ctrl.listarProgramas) // ?id_tenant=
router.get("/programas/:id", ctrl.arvoreDoPrograma)

// Arvore e nos
router.get("/", ctrl.arvore) // ?id_tenant= — todas as trilhas do tenant
router.post("/", ctrl.criar)
router.get("/:id", ctrl.buscar)
router.patch("/:id", ctrl.atualizar)
router.delete("/:id", ctrl.excluir)

// Trilha padrao (a sugerida no cadastro de startup)
router.patch("/:id/padrao", ctrl.definirPadrao)

// Matricula: quais startups fazem esta trilha
router.get("/:id/startups", ctrl.listarStartupsDoPrograma)
router.post("/:id/startups", ctrl.matricular) // body: { id_startup }
router.patch("/:id/startups/:idStartup", ctrl.definirStatusMatricula) // { status }
router.delete("/:id/startups/:idStartup", ctrl.desmatricular)

// Estrutura
router.get("/:id/filhos", ctrl.listarFilhos)
router.patch("/:id/filhos/ordem", ctrl.reordenarFilhos) // body: { ids: [...] }
router.patch("/:id/mover", ctrl.mover) // body: { id_pai }

// Conteudos da Biblioteca vinculados ao passo
router.get("/:id/conteudos", ctrl.listarConteudos)
router.post("/:id/conteudos", ctrl.vincularConteudo) // body: { id_conteudo }
router.delete("/:id/conteudos/:idConteudo", ctrl.desvincularConteudo)

module.exports = router
