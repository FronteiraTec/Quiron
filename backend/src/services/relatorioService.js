/**
 * Service de Relatorios (regra de negocio).
 *
 * Transforma as agregacoes cruas do repositorio no que a tela mostra:
 * percentuais, classificacao de risco e os poucos numeros de destaque que
 * respondem "como vai o programa?" sem obrigar a ler a tabela inteira.
 *
 * Duas conversoes acontecem aqui e nao no SQL:
 *   - COUNT do Postgres chega como string (BIGINT). Sem Number(), somas viram
 *     concatenacao de texto no frontend.
 *   - Percentuais precisam de um denominador zero seguro; em SQL isso exigiria
 *     NULLIF espalhado por toda consulta.
 */
const relatorioRepository = require("../repositories/relatorioRepository")
const rbacService = require("./rbacService")
const { erroNegocio } = require("../utils/erros")

// Janela padrao dos relatorios de periodo. Um trimestre e o ciclo em que uma
// incubadora costuma revisar o programa.
const DIAS_PADRAO = 90
const DIAS_MAX = 365

// Uma startup sem nenhuma entrega ou avaliacao por este tempo esta parada, nao
// "indo devagar" — e o corte em que vale uma conversa.
const DIAS_INATIVA = 14

/** Numero seguro: o driver do Postgres devolve BIGINT/NUMERIC como string. */
const num = (v) => (v == null ? 0 : Number(v))

/** Percentual inteiro 0-100 com denominador zero seguro. */
const pct = (parte, total) => (total > 0 ? Math.round((num(parte) / num(total)) * 100) : 0)

/** Dias inteiros desde um timestamp, ou null se nunca aconteceu. */
function diasDesde(ts) {
  if (!ts) return null
  return Math.floor((Date.now() - new Date(ts).getTime()) / 86_400_000)
}

/** Valida e normaliza a janela em dias vinda da query string. */
function normalizarDias(dias) {
  const n = Number(dias)
  if (!Number.isFinite(n) || n <= 0) return DIAS_PADRAO
  return Math.min(Math.trunc(n), DIAS_MAX)
}

/**
 * Exige o tenant e a chave daquele relatorio.
 *
 * Uma chave POR RELATORIO, e nao uma unica "relatorios.visualizar": sao
 * leituras de dominios diferentes (trilha, avaliacoes, eventos) e o desempenho
 * por mentor, em especial, nem sempre e para todo mundo ver.
 */
async function exigirAcesso(idTenant, usuario, recurso) {
  const tenant = exigirTenant(idTenant)
  await rbacService.garantirPermissao(tenant, usuario, `relatorios.${recurso}.visualizar`)
  return tenant
}

/** Todo relatorio e do escopo de uma incubadora. */
function exigirTenant(idTenant) {
  const n = Number(idTenant)
  if (!Number.isInteger(n) || n <= 0) {
    throw erroNegocio(400, "Informe o id_tenant.")
  }
  return n
}

// ---------------------------------------------------------------------------
// RELATORIO 1 — Progresso das startups
// ---------------------------------------------------------------------------

/**
 * Classifica o risco de uma startup a partir de tres sinais objetivos:
 * passos atrasados, tempo sem atividade e avanco na trilha.
 *
 * A regra e deliberadamente simples e explicavel — quem le o relatorio precisa
 * conseguir dizer POR QUE uma startup ficou vermelha, senao ignora o rotulo.
 */
function classificarRisco({ atrasados, diasSemAtividade, progressoPct }) {
  const motivos = []

  if (atrasados > 0) motivos.push(`${atrasados} passo(s) com prazo vencido`)
  if (diasSemAtividade == null) motivos.push("nunca enviou nada")
  else if (diasSemAtividade >= DIAS_INATIVA) motivos.push(`${diasSemAtividade} dias sem atividade`)

  // Dois ou mais sinais, ou um atraso relevante, ja pedem atencao imediata.
  const parada = diasSemAtividade == null || diasSemAtividade >= DIAS_INATIVA
  if (atrasados > 0 && parada) return { risco: "ALTO", motivos }
  if (atrasados > 0 || parada) return { risco: "MEDIO", motivos }
  if (progressoPct === 0) return { risco: "MEDIO", motivos: ["ainda nao concluiu nenhum passo"] }

  return { risco: "OK", motivos }
}

/**
 * Progresso de cada startup na trilha, com risco e um resumo do conjunto.
 * @param {number|string} idTenant
 */
async function progresso(idTenant, usuario) {
  const tenant = await exigirAcesso(idTenant, usuario, "progresso")
  const linhas = await relatorioRepository.progressoStartups(tenant)

  const startups = linhas.map((l) => {
    const total = num(l.total_passos)
    const aprovados = num(l.aprovados)
    const atrasados = num(l.atrasados)
    const diasSemAtividade = diasDesde(l.ultima_atividade_ts)
    const progressoPct = pct(aprovados, total)

    const { risco, motivos } = classificarRisco({ atrasados, diasSemAtividade, progressoPct })

    return {
      id_startup: l.id_startup,
      startup: l.startup,
      status: l.startup_status,
      fase_atual: l.fase_atual ?? null, // sem fase pendente = trilha concluida
      membros: num(l.membros),
      mentores: l.mentores ?? [],

      total_passos: total,
      aprovados,
      aguardando: num(l.aguardando),
      ajuste: num(l.ajuste),
      rascunho: num(l.rascunho),
      nao_iniciados: num(l.nao_iniciados),
      atrasados,

      progresso_pct: progressoPct,
      // Em andamento = ja mexeu, ainda nao aprovado. E o "trabalho em curso".
      em_andamento: num(l.aguardando) + num(l.ajuste) + num(l.rascunho),

      ultima_atividade_ts: l.ultima_atividade_ts ?? null,
      dias_sem_atividade: diasSemAtividade,
      risco,
      motivos_risco: motivos,
    }
  })

  const totalPassos = startups.reduce((s, x) => s + x.total_passos, 0)
  const totalAprovados = startups.reduce((s, x) => s + x.aprovados, 0)

  return {
    startups,
    resumo: {
      startups: startups.length,
      progresso_medio_pct: pct(totalAprovados, totalPassos),
      em_risco: startups.filter((s) => s.risco === "ALTO").length,
      atencao: startups.filter((s) => s.risco === "MEDIO").length,
      paradas: startups.filter(
        (s) => s.dias_sem_atividade == null || s.dias_sem_atividade >= DIAS_INATIVA
      ).length,
      com_atraso: startups.filter((s) => s.atrasados > 0).length,
      dias_inativa: DIAS_INATIVA,
    },
  }
}

// ---------------------------------------------------------------------------
// RELATORIO 2 — Entregas e avaliacoes
// ---------------------------------------------------------------------------

/**
 * Funil de entregas, fila de avaliacao parada, ritmo semanal e desempenho por
 * mentor.
 *
 * @param {number|string} idTenant
 * @param {number|string} dias
 */
async function entregas(idTenant, dias, usuario) {
  const tenant = await exigirAcesso(idTenant, usuario, "entregas")
  const janela = normalizarDias(dias)

  const [funil, fila, mentores, semanal] = await Promise.all([
    relatorioRepository.funilEntregas(tenant),
    relatorioRepository.filaAvaliacao(tenant),
    relatorioRepository.desempenhoMentores(tenant, janela),
    relatorioRepository.volumeSemanal(tenant, janela),
  ])

  const total = num(funil.total)

  // Ordem do funil: o caminho que uma entrega percorre, do nada ate aprovada.
  const etapas = [
    { chave: "NAO_INICIADA", rotulo: "Nao iniciado", quantidade: num(funil.nao_iniciados) },
    { chave: "RASCUNHO", rotulo: "Rascunho", quantidade: num(funil.rascunho) },
    { chave: "AGUARDANDO", rotulo: "Aguardando avaliacao", quantidade: num(funil.aguardando) },
    { chave: "AJUSTE", rotulo: "Em ajuste", quantidade: num(funil.ajuste) },
    { chave: "APROVADO", rotulo: "Aprovado", quantidade: num(funil.aprovados) },
  ].map((e) => ({ ...e, pct: pct(e.quantidade, total) }))

  const filaNormalizada = fila.map((f) => ({
    id_entrega: f.id_entrega,
    id_startup: f.id_startup,
    startup: f.startup,
    id_no: f.id_no,
    passo: f.passo,
    mentores: f.mentores ?? [],
    enviada_ts: f.enviada_ts,
    dias_parada: num(f.dias_parada),
  }))

  const equipe = mentores.map((m) => {
    const avaliacoes = num(m.avaliacoes)
    return {
      id_usuario: m.id_usuario,
      mentor: m.mentor,
      avaliacoes,
      aprovadas: num(m.aprovadas),
      ajustes: num(m.ajustes),
      reprovadas: num(m.reprovadas),
      taxa_aprovacao_pct: pct(m.aprovadas, avaliacoes),
      nota_media: m.nota_media == null ? null : Number(m.nota_media),
      dias_resposta_media:
        m.dias_resposta_media == null ? null : Number(m.dias_resposta_media),
      startups_atendidas: num(m.startups_atendidas),
    }
  })

  const enviadasPeriodo = semanal.reduce((s, w) => s + num(w.enviadas), 0)
  const avaliadasPeriodo = semanal.reduce((s, w) => s + num(w.avaliadas), 0)

  // Media ponderada pelo volume: um mentor com 30 avaliacoes pesa mais que um
  // com 2 na resposta a "quanto tempo a incubadora leva para responder".
  const comTempo = equipe.filter((m) => m.dias_resposta_media != null)
  const pesoTotal = comTempo.reduce((s, m) => s + m.avaliacoes, 0)
  const tempoMedio = pesoTotal
    ? Number(
        (
          comTempo.reduce((s, m) => s + m.dias_resposta_media * m.avaliacoes, 0) / pesoTotal
        ).toFixed(1)
      )
    : null

  return {
    dias: janela,
    funil: { total, etapas },
    fila: filaNormalizada,
    mentores: equipe,
    semanal: semanal.map((w) => ({
      semana: w.semana,
      enviadas: num(w.enviadas),
      avaliadas: num(w.avaliadas),
    })),
    resumo: {
      na_fila: filaNormalizada.length,
      fila_mais_antiga_dias: filaNormalizada.length ? filaNormalizada[0].dias_parada : 0,
      // O que ja passou de uma semana parado e o que constrange de verdade.
      fila_atrasada: filaNormalizada.filter((f) => f.dias_parada >= 7).length,
      tempo_resposta_medio_dias: tempoMedio,
      enviadas_periodo: enviadasPeriodo,
      avaliadas_periodo: avaliadasPeriodo,
      taxa_aprovacao_pct: pct(funil.aprovados, num(funil.total) - num(funil.nao_iniciados)),
    },
  }
}

// ---------------------------------------------------------------------------
// RELATORIO 3 — Gargalos do programa
// ---------------------------------------------------------------------------

/**
 * Passos da trilha ordenados por atrito.
 *
 * O indice de atrito pesa cada forma de ficar preso pela gravidade: refazer
 * apos um ajuste custa mais que esperar avaliacao, que por sua vez custa mais
 * que um rascunho abandonado; prazo vencido soma por cima. Os pesos cobrem
 * exatamente as mesmas situacoes contadas em `presos` — se um deles ficasse
 * de fora, um passo apareceria travando gente e sumiria do ranking.
 *
 * E uma heuristica de ORDENACAO: serve para trazer os piores passos ao topo,
 * nao para virar meta.
 *
 * @param {number|string} idTenant
 */
async function gargalos(idTenant, usuario) {
  const tenant = await exigirAcesso(idTenant, usuario, "gargalos")
  const linhas = await relatorioRepository.gargalosPrograma(tenant)

  const passos = linhas.map((l) => {
    const startups = num(l.startups)
    const iniciaram = num(l.iniciaram)
    const emAjuste = num(l.em_ajuste)
    const aguardando = num(l.aguardando)
    const atrasados = num(l.atrasados)
    const rascunho = num(l.rascunho)

    // Presos = quem entrou no passo e nao saiu aprovado.
    const presos = emAjuste + aguardando + rascunho

    return {
      id_no: l.id_no,
      passo: l.passo,
      modulo: l.modulo ?? null,
      fase: l.fase ?? null,
      obrigatoria: l.obrigatoria,

      startups,
      iniciaram,
      aprovados: num(l.aprovados),
      aguardando,
      em_ajuste: emAjuste,
      rascunho,
      nao_iniciados: num(l.nao_iniciados),
      atrasados,
      presos,

      taxa_aprovacao_pct: pct(l.aprovados, iniciaram),
      taxa_ajuste_pct: pct(emAjuste, iniciaram),
      dias_ate_aprovar: l.dias_ate_aprovar == null ? null : Number(l.dias_ate_aprovar),
      dias_na_fila: l.dias_na_fila == null ? null : Number(l.dias_na_fila),

      atrito: emAjuste * 3 + aguardando * 2 + rascunho + atrasados * 2,
    }
  })

  // Um passo que ninguem comecou nao e gargalo, e trilha nova: fica de fora do
  // ranking para nao empurrar os problemas reais para baixo.
  const ranking = [...passos]
    .filter((p) => p.iniciaram > 0 && p.atrito > 0)
    .sort((a, b) => b.atrito - a.atrito)
    .slice(0, 10)

  const maisLento = [...passos]
    .filter((p) => p.dias_ate_aprovar != null)
    .sort((a, b) => b.dias_ate_aprovar - a.dias_ate_aprovar)[0]

  return {
    passos,
    ranking,
    resumo: {
      passos_ativos: passos.length,
      passos_com_travamento: passos.filter((p) => p.presos > 0).length,
      startups_presas: passos.reduce((s, p) => s + p.presos, 0),
      passos_atrasados: passos.filter((p) => p.atrasados > 0).length,
      passo_mais_lento: maisLento
        ? { passo: maisLento.passo, dias: maisLento.dias_ate_aprovar }
        : null,
    },
  }
}

// ---------------------------------------------------------------------------
// RELATORIO 4 — Engajamento e eventos
// ---------------------------------------------------------------------------

/**
 * Presenca por evento e por startup no periodo.
 *
 * Cobre apenas eventos JA REALIZADOS: taxa de presenca de um evento que ainda
 * nao aconteceu seria sempre zero e poluiria toda media.
 *
 * @param {number|string} idTenant
 * @param {number|string} dias
 */
async function engajamento(idTenant, dias, usuario) {
  const tenant = await exigirAcesso(idTenant, usuario, "engajamento")
  const janela = normalizarDias(dias)

  const [linhasEventos, linhasStartups] = await Promise.all([
    relatorioRepository.engajamentoEventos(tenant, janela),
    relatorioRepository.engajamentoStartups(tenant, janela),
  ])

  const eventos = linhasEventos.map((e) => {
    const publico = num(e.publico)
    const confirmados = num(e.confirmados)
    const presentes = num(e.presentes)

    return {
      id_evento: e.id_evento,
      titulo: e.titulo,
      categoria: e.categoria,
      local: e.local ?? null,
      inicio_ts: e.inicio_ts,
      obrigatorio: e.obrigatorio,

      publico,
      confirmados,
      presentes,
      faltaram_confirmados: num(e.faltaram_confirmados),

      taxa_confirmacao_pct: pct(confirmados, publico),
      taxa_presenca_pct: pct(presentes, publico),
      // Dos que confirmaram, quantos apareceram. Mede o valor da confirmacao:
      // se for baixo, a lista de confirmados nao serve para planejar.
      comparecimento_pct: pct(presentes, confirmados),
    }
  })

  const startups = linhasStartups.map((s) => {
    const convidada = num(s.eventos_convidada)
    const presente = num(s.eventos_presente)
    const diasSemPresenca = diasDesde(s.ultima_presenca_ts)

    return {
      id_startup: s.id_startup,
      startup: s.startup,
      eventos_convidada: convidada,
      eventos_presente: presente,
      faltas: convidada - presente,
      faltas_obrigatorias: num(s.faltas_obrigatorias),
      taxa_presenca_pct: pct(presente, convidada),
      ultima_presenca_ts: s.ultima_presenca_ts ?? null,
      dias_sem_presenca: diasSemPresenca,
      // Nao apareceu em nada no periodo: o sinal mais barato de desengajamento.
      desengajada: convidada > 0 && presente === 0,
    }
  })

  const publicoTotal = eventos.reduce((s, e) => s + e.publico, 0)
  const presentesTotal = eventos.reduce((s, e) => s + e.presentes, 0)
  const confirmadosTotal = eventos.reduce((s, e) => s + e.confirmados, 0)

  return {
    dias: janela,
    eventos,
    startups,
    resumo: {
      eventos_realizados: eventos.length,
      presenca_media_pct: pct(presentesTotal, publicoTotal),
      confirmacao_media_pct: pct(confirmadosTotal, publicoTotal),
      comparecimento_pct: pct(presentesTotal, confirmadosTotal),
      startups_desengajadas: startups.filter((s) => s.desengajada).length,
      faltas_obrigatorias: startups.reduce((s, x) => s + x.faltas_obrigatorias, 0),
    },
  }
}

module.exports = { progresso, entregas, gargalos, engajamento }
