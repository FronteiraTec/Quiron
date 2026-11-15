/**
 * Rotas do Mini CRM (migracao 026). Todas exigem Bearer Token.
 *
 * Todas levam a startup na URL (/crm/:idStartup/...), e nenhuma confia nela:
 * cada service confere, no banco, que quem pede e membro ativo daquela startup
 * e que o beneficio CRM esta ativo (crmAcessoService.exigirAcesso). Sem isso,
 * 403 — inclusive para admin e mentor, que nao trabalham no CRM da startup.
 */
const express = require("express")
const router = express.Router()

const ctrl = require("../controllers/crmController")
const { autenticar } = require("../middlewares/auth")

router.use(autenticar)

// As etapas do funil, os membros (responsaveis possiveis) e as origens.
router.get("/:idStartup/contexto", ctrl.contexto)
router.get("/:idStartup/painel", ctrl.painel) // ?periodo=30d|90d|12m|tudo

router.get("/:idStartup/clientes", ctrl.listarClientes)
router.post("/:idStartup/clientes", ctrl.criarCliente)
router.get("/:idStartup/clientes/:idCliente", ctrl.buscarCliente)
router.put("/:idStartup/clientes/:idCliente", ctrl.atualizarCliente)
router.delete("/:idStartup/clientes/:idCliente", ctrl.excluirCliente)
router.get("/:idStartup/clientes/:idCliente/historico", ctrl.historicoCliente) // ?antes=&limite=
router.post("/:idStartup/clientes/:idCliente/atividades", ctrl.atividadeCliente)

router.get("/:idStartup/oportunidades", ctrl.listarOportunidades) // ?situacao=
router.post("/:idStartup/oportunidades", ctrl.criarOportunidade)
router.get("/:idStartup/oportunidades/:idOportunidade", ctrl.buscarOportunidade)
router.put("/:idStartup/oportunidades/:idOportunidade", ctrl.atualizarOportunidade)
router.delete("/:idStartup/oportunidades/:idOportunidade", ctrl.excluirOportunidade)
// O arrasto do kanban: muda a etapa e nada mais.
router.patch("/:idStartup/oportunidades/:idOportunidade/etapa", ctrl.moverOportunidade)
router.post("/:idStartup/oportunidades/:idOportunidade/ganhar", ctrl.ganharOportunidade)
router.post("/:idStartup/oportunidades/:idOportunidade/perder", ctrl.perderOportunidade)
router.post("/:idStartup/oportunidades/:idOportunidade/reabrir", ctrl.reabrirOportunidade)
router.get("/:idStartup/oportunidades/:idOportunidade/historico", ctrl.historicoOportunidade) // ?antes=&limite=
router.post("/:idStartup/oportunidades/:idOportunidade/atividades", ctrl.atividadeOportunidade)

router.get("/:idStartup/tarefas", ctrl.listarTarefas) // ?id_oportunidade=&id_cliente=
router.post("/:idStartup/tarefas", ctrl.criarTarefa)
router.get("/:idStartup/tarefas/:idTarefa", ctrl.buscarTarefa)
router.put("/:idStartup/tarefas/:idTarefa", ctrl.atualizarTarefa)
// Iniciar, concluir, cancelar, reabrir: cada troca tem evento proprio.
router.patch("/:idStartup/tarefas/:idTarefa/status", ctrl.mudarStatusTarefa)

module.exports = router
