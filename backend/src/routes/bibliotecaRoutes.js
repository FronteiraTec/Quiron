/**
 * Rotas da Biblioteca. Todas exigem Bearer Token (middleware autenticar).
 *
 * O acervo reutilizavel do que a incubadora ensina. O vinculo de um conteudo
 * com um passo da trilha nao mora aqui — fica em /trilha/:id/conteudos, junto
 * do passo que o referencia.
 */
const express = require("express")
const router = express.Router()

const ctrl = require("../controllers/bibliotecaController")
const { autenticar } = require("../middlewares/auth")

router.use(autenticar)

router.get("/", ctrl.listar) // ?id_tenant=&tipo=&tag=&termo=
router.post("/", ctrl.criar)
router.get("/:id", ctrl.buscar)
router.patch("/:id", ctrl.atualizar)
router.delete("/:id", ctrl.excluir)
router.post("/:id/duplicar", ctrl.duplicar)

module.exports = router
