/**
 * O painel do CRM: os indicadores da operacao comercial da startup e as listas
 * curtas da pagina inicial (proximas tarefas, oportunidades com movimento,
 * ultimas atividades, distribuicao por etapa). Tudo contado no banco, so com os
 * dados da startup do contexto.
 */
const crmPainelRepository = require("../repositories/crmPainelRepository")
const crmEventoRepository = require("../repositories/crmEventoRepository")
const acesso = require("./crmAcessoService")
const v = require("../crm/validacao")

/** Quantos dias cada periodo cobre (null = todo o historico). */
const PERIODOS = { "30d": 30, "90d": 90, "12m": 365, tudo: null }
const PERIODO_PADRAO = "90d"

/** "AAAA-MM-DD" de `dias` atras, contado a partir de hoje no fuso da incubadora. */
function diasAtras(dias) {
  const [a, m, d] = v.hojeNoFuso().split("-").map(Number)
  return new Date(Date.UTC(a, m - 1, d) - dias * 86400000).toISOString().slice(0, 10)
}

async function painel(idStartup, query = {}, usuario) {
  const ctx = await acesso.exigirAcesso(idStartup, usuario)
  const periodo = Object.hasOwn(PERIODOS, query.periodo) ? query.periodo : PERIODO_PADRAO
  const desde = PERIODOS[periodo] === null ? null : diasAtras(PERIODOS[periodo])

  const [indicadores, etapas, proximasTarefas, oportunidadesRecentes, atividades] = await Promise.all([
    crmPainelRepository.indicadores(ctx.idStartup, desde),
    crmPainelRepository.distribuicaoPorEtapa(ctx.idStartup),
    crmPainelRepository.proximasTarefas(ctx.idStartup),
    crmPainelRepository.oportunidadesRecentes(ctx.idStartup),
    crmEventoRepository.listar(ctx.idStartup, {}, { limite: 8 }),
  ])

  return {
    periodo,
    desde,
    indicadores,
    etapas,
    proximas_tarefas: proximasTarefas,
    oportunidades_recentes: oportunidadesRecentes,
    atividades: atividades.eventos,
  }
}

module.exports = { painel, PERIODOS }
