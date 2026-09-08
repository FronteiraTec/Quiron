/**
 * Rotas dos selos: a definicao, a concessao e o mural. Todas exigem Bearer
 * Token — a pagina PUBLICA da credencial e outro modulo (credencialRoutes),
 * justamente porque nao exige.
 *
 * REVOGAR e PATCH .../revogar, e nao DELETE: revogacao e ESTADO, nao remocao.
 * A credencial que ja circula no LinkedIn passa a dizer "revogada" em vez de
 * virar link quebrado, e e isso que sustenta a credibilidade dos selos de
 * todo mundo.
 *
 * `/meus` e `/concessoes/:id/publico` sao do proprio usuario e nao passam por
 * RBAC (ver o service): expor o proprio nome numa pagina aberta e decisao de
 * quem tem o nome.
 */
const express = require("express")
const router = express.Router()

const ctrl = require("../controllers/seloController")
const { autenticar } = require("../middlewares/auth")

router.use(autenticar)

// Caminhos literais antes dos parametrizados.
router.get("/meus", ctrl.meus) // ?id_tenant=
router.get("/concessoes", ctrl.listarConcessoes) // ?id_tenant=&id_selo=&id_usuario=
router.patch("/concessoes/:id/publico", ctrl.alterarPublico)
router.patch("/concessoes/:id/revogar", ctrl.revogar)

router.get("/", ctrl.listar) // ?id_tenant=&incluir_inativos=
router.post("/", ctrl.criar)
router.put("/:id", ctrl.atualizar)
router.patch("/:id/ativo", ctrl.alterarAtivo)
router.delete("/:id", ctrl.excluir) // ?id_tenant=
router.post("/:id/conceder", ctrl.conceder)

module.exports = router
