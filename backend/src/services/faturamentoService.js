/**
 * O faturamento de uma startup, visto pela INCUBADORA no cadastro dela.
 *
 * E a unica leitura do CRM que sai da startup, e sai so em SOMA: o total
 * vendido (valor efetivamente vendido das oportunidades ganhas, pela data de
 * fechamento) por periodo e mes a mes. Clientes, negociacoes, funil e tarefas
 * continuam so com os membros (crmAcessoService).
 *
 * Exige `startups.faturamento.visualizar` no tenant da startup e o vinculo com
 * ela (startupService.buscarComPermissao, o par de sempre). O Administrador
 * nasce com a chave; o mentor nao — a incubadora decide se quem acompanha a
 * startup ve o quanto ela vende.
 *
 * Vale com o beneficio revogado: o que foi vendido continua tendo sido vendido,
 * e a resposta diz se o CRM esta ativo para a tela explicar por que o numero
 * parou de andar.
 */
const crmPainelRepository = require("../repositories/crmPainelRepository")
const beneficioRepository = require("../repositories/beneficioRepository")
const startupService = require("./startupService")
const { hojeNoFuso } = require("../crm/validacao")

async function daStartup(idStartup, usuario) {
  const startup = await startupService.buscarComPermissao(idStartup, usuario, "startups.faturamento.visualizar")
  const crm = (await beneficioRepository.listarDaStartup(startup.id_startup)).find((b) => b.beneficio === "CRM")

  // Startup que nunca teve o CRM nao tem de onde tirar faturamento: a tela diz
  // isso, em vez de mostrar zeros que pareceriam "nao vendeu nada".
  if (!crm) return { usa_crm: false, crm_ativo: false }

  const hoje = hojeNoFuso()
  const { resumo, meses } = await crmPainelRepository.faturamento(startup.id_startup, hoje)
  const ultimos12 = meses.reduce((soma, m) => soma + m.valor, 0)
  const vendas12 = meses.reduce((soma, m) => soma + m.vendas, 0)

  return {
    usa_crm: true,
    crm_ativo: crm.ativo,
    hoje,
    resumo: {
      ...resumo,
      ultimos_12_meses: Math.round(ultimos12 * 100) / 100,
      vendas_12_meses: vendas12,
      ticket_medio: resumo.vendas > 0 ? Math.round((resumo.total / resumo.vendas) * 100) / 100 : null,
    },
    meses,
  }
}

module.exports = { daStartup }
