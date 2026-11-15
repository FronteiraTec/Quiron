/**
 * Integracoes de Inteligencia Artificial da incubadora (docs/reunioes.md,
 * secao 5.1). Todas exigem Bearer Token; as chaves sao
 * `configuracoes.ia.visualizar` e `configuracoes.ia.editar`.
 */
const express = require("express")
const router = express.Router()

const ctrl = require("../controllers/iaConfigController")
const { autenticar } = require("../middlewares/auth")

router.use(autenticar)

router.get("/", ctrl.listar) // ?id_tenant=
// Antes de "/:finalidade": senao "retencao" seria lida como uma finalidade.
router.put("/retencao", ctrl.salvarRetencao)
router.put("/:finalidade", ctrl.salvar)
router.post("/:finalidade/testar", ctrl.testar)

module.exports = router
