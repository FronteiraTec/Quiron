/**
 * Rotas da gestao de tarefas. Todas exigem Bearer Token (middleware autenticar).
 */
const express = require("express")
const router = express.Router()

const ctrl = require("../controllers/tarefaController")
const { autenticar } = require("../middlewares/auth")

router.use(autenticar)

router.get("/", ctrl.listar) // ?id_tenant=&id_responsavel=&id_startup=&abertas=

// Antes de "/:id", senao "resumo" e "equipe" seriam lidos como id de tarefa.
router.get("/resumo", ctrl.resumo) // ?id_tenant=
// Quem pode receber uma tarefa. Mora aqui, e nao em /tenants/:id/usuarios, que
// e rota de administracao e so o admin alcanca — ver tarefaService.listarEquipe.
router.get("/equipe", ctrl.equipe) // ?id_tenant=

// Anexo de tarefa. NAO passa por /arquivos/:id de proposito: la a autorizacao
// de arquivo privado e a do mentor avaliando entrega, que nao tem relacao com
// quem participa de uma tarefa. Aqui quem autoriza e o vinculo em
// `tarefa_anexo` mais a visibilidade da tarefa — saber o UUID nao basta.
// Antes de "/:id" pelo mesmo motivo dos outros: a rota mais especifica primeiro.
router.get("/:id/anexos/:idArquivo", ctrl.baixarAnexo) // ?id_tenant=

router.get("/:id", ctrl.buscar) // ?id_tenant=
router.post("/", ctrl.criar)
router.put("/:id", ctrl.atualizar)

// O arrasto do kanban. PATCH e nao PUT: muda a coluna e a posicao, e nada mais
// — mandar a tarefa inteira a cada cartao arrastado apagaria o que o front nao
// tivesse em maos. Ver tarefaService.mover.
router.patch("/:id/mover", ctrl.mover) // body: id_tenant, status, ordem

router.delete("/:id", ctrl.excluir) // ?id_tenant=

module.exports = router
