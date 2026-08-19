/**
 * Service de Tempo por Etapa (regra de negocio).
 *
 * Responde a pergunta que o relatorio de Progresso nao responde: nao QUANTO a
 * startup avancou, mas HA QUANTO TEMPO ela esta onde esta — e, principalmente,
 * de quem e esse tempo.
 *
 * A conta que importa
 *   tempo na fase = tempo com a startup + tempo bloqueada
 *
 * "Bloqueada" e o periodo em que TODO passo que faltava estava na fila do
 * mentor: a startup nao tinha o que fazer nem que quisesse. Sem essa separacao
 * a metrica pune o incubado por uma demora da incubadora, que e exatamente o
 * erro de leitura que o relatorio existe para evitar.
 *
 * O repositorio devolve segundos porque e a unidade em que a conta fecha; a
 * traducao para dias, percentual e rotulo mora aqui — mesma divisao dos demais
 * relatorios.
 */
const tempoEtapaRepository = require("../repositories/tempoEtapaRepository")
const rbacService = require("./rbacService")
const { erroNegocio } = require("../utils/erros")

const SEGUNDOS_DIA = 86_400

// Uma entrega parada mais de uma semana nao e "o mentor esta olhando", e fila.
// Mesmo corte que o relatorio de Entregas usa em `fila_atrasada`, para as duas
// telas nao chamarem de atraso coisas diferentes.
const SLA_MENTOR_DIAS = 7

// A partir daqui a fila deixou de ser detalhe e virou a explicacao do prazo:
// quase metade do tempo da etapa a startup passou sem ter o que fazer.
const PCT_BLOQUEIO_ALTO = 40

/** Numero seguro: o driver do Postgres devolve BIGINT/NUMERIC como string. */
const num = (v) => (v == null ? 0 : Number(v))

/** Segundos em dias, com uma casa — a precisao que uma incubadora usa. */
const dias = (segundos) => Math.round((num(segundos) / SEGUNDOS_DIA) * 10) / 10

/** Percentual inteiro 0-100 com denominador zero seguro. */
const pct = (parte, total) => (total > 0 ? Math.round((num(parte) / num(total)) * 100) : 0)

/** Dias inteiros desde um timestamp, ou null se nunca aconteceu. */
function diasDesde(ts) {
  if (!ts) return null
  return Math.floor((Date.now() - new Date(ts).getTime()) / 86_400_000)
}

/**
 * De quem e o tempo desta etapa.
 *
 * Duas perguntas, nesta ordem — a primeira e sobre o presente (tem alguem
 * esperando resposta agora?), a segunda sobre o acumulado (a fila explicou o
 * prazo?). A regra e curta de proposito: quem le precisa conseguir dizer por
 * que a linha ficou marcada, senao ignora a marca.
 */
function atribuir({ esperaDias, aguardando, pctBloqueada, diasBloqueada }) {
  const motivos = []

  if (aguardando > 0 && esperaDias != null && esperaDias >= SLA_MENTOR_DIAS) {
    motivos.push(
      `${aguardando} entrega(s) esperando correcao ha ${esperaDias} dias`
    )
  }
  if (pctBloqueada >= PCT_BLOQUEIO_ALTO && diasBloqueada >= 1) {
    motivos.push(`${pctBloqueada}% do tempo da etapa sem nada nas maos da startup`)
  }

  if (motivos.length > 0) return { atribuicao: "MENTORIA", motivos }

  // Sem fila relevante, o relogio e da startup: o tempo que passa e o dela.
  if (diasBloqueada < 1) return { atribuicao: "STARTUP", motivos }

  return { atribuicao: "MISTA", motivos }
}

/** Todo relatorio e do escopo de uma incubadora. */
function exigirTenant(idTenant) {
  const n = Number(idTenant)
  if (!Number.isInteger(n) || n <= 0) {
    throw erroNegocio(400, "Informe o id_tenant.")
  }
  return n
}

/**
 * Tempo de cada startup em cada etapa da trilha, com o atraso separado por
 * dono.
 *
 * @param {number|string} idTenant
 * @param {{id:number, root?:boolean}} usuario - autenticado.
 */
async function tempoEtapa(idTenant, usuario) {
  const tenant = exigirTenant(idTenant)
  await rbacService.garantirPermissao(tenant, usuario, "relatorios.tempo.visualizar")

  const [linhasFase, linhasPasso] = await Promise.all([
    tempoEtapaRepository.tempoPorFase(tenant),
    tempoEtapaRepository.tempoPorPasso(tenant),
  ])

  // -------------------------------------------------------------------------
  // Etapas: uma linha por (startup, fase alcancada)
  // -------------------------------------------------------------------------
  const etapas = linhasFase.map((l) => {
    const diasTotal = dias(l.seg_total)
    const diasBloqueada = dias(l.seg_bloqueada)
    const diasComStartup = Math.max(0, Math.round((diasTotal - diasBloqueada) * 10) / 10)
    const pctBloqueada = pct(l.seg_bloqueada, l.seg_total)
    const esperaDias = diasDesde(l.espera_desde_ts)
    const aguardando = num(l.aguardando_agora)

    const { atribuicao, motivos } = atribuir({
      esperaDias,
      aguardando,
      pctBloqueada,
      diasBloqueada,
    })

    return {
      id_startup: l.id_startup,
      startup: l.startup,
      id_programa: l.id_programa,
      programa: l.programa,
      id_fase: l.id_fase,
      fase: l.fase,
      ordem: num(l.ordem),

      concluida: l.concluida,
      situacao: l.concluida ? "CONCLUIDA" : "EM_ANDAMENTO",
      entrada_ts: l.entrada_ts ?? null,
      saida_ts: l.saida_ts ?? null,

      passos: num(l.entregaveis),
      aprovados: num(l.aprovados),

      dias_total: diasTotal,
      // O tempo em que a startup tinha ao menos um passo nas maos. Nao e
      // "tempo trabalhando" — e tempo em que dava para trabalhar.
      dias_startup: diasComStartup,
      dias_bloqueada: diasBloqueada,
      pct_bloqueada: pctBloqueada,
      // Soma das esperas de correcao dentro da etapa, mesmo as que a startup
      // conseguiu contornar tocando outro passo em paralelo.
      dias_em_fila: dias(l.seg_mentor),

      aguardando_agora: aguardando,
      espera_dias: esperaDias,
      devolucoes: num(l.devolucoes),

      atribuicao,
      motivos,
    }
  })

  // -------------------------------------------------------------------------
  // Startups: onde cada uma esta agora e ha quanto tempo
  // -------------------------------------------------------------------------
  const porStartup = new Map()
  for (const e of etapas) {
    if (!porStartup.has(e.id_startup)) {
      porStartup.set(e.id_startup, {
        id_startup: e.id_startup,
        startup: e.startup,
        programa: e.programa,
        etapas_concluidas: 0,
        dias_no_programa: 0,
        dias_bloqueada_total: 0,
        etapa_atual: null,
      })
    }
    const s = porStartup.get(e.id_startup)

    // As fases ladrilham o tempo (a proxima comeca onde a anterior acabou),
    // entao somar as duracoes da o tempo de programa sem contar dia duas vezes.
    s.dias_no_programa = Math.round((s.dias_no_programa + e.dias_total) * 10) / 10
    s.dias_bloqueada_total = Math.round((s.dias_bloqueada_total + e.dias_bloqueada) * 10) / 10

    if (e.concluida) s.etapas_concluidas += 1
    // A etapa atual e a primeira aberta — as posteriores nem comecaram.
    else if (!s.etapa_atual || e.ordem < s.etapa_atual.ordem) s.etapa_atual = e
  }

  const startups = [...porStartup.values()].map((s) => ({
    ...s,
    etapa_atual: s.etapa_atual
      ? {
          fase: s.etapa_atual.fase,
          ordem: s.etapa_atual.ordem,
          dias_total: s.etapa_atual.dias_total,
          dias_bloqueada: s.etapa_atual.dias_bloqueada,
          pct_bloqueada: s.etapa_atual.pct_bloqueada,
          aguardando_agora: s.etapa_atual.aguardando_agora,
          espera_dias: s.etapa_atual.espera_dias,
          atribuicao: s.etapa_atual.atribuicao,
          aprovados: s.etapa_atual.aprovados,
          passos: s.etapa_atual.passos,
        }
      : null, // sem etapa aberta = trilha concluida
    pct_bloqueada: pct(s.dias_bloqueada_total, s.dias_no_programa),
  }))
  startups.sort((a, b) => a.startup.localeCompare(b.startup, "pt-BR"))

  // -------------------------------------------------------------------------
  // Passos: onde no desenho da trilha o tempo se perde
  // -------------------------------------------------------------------------
  const passos = linhasPasso.map((l) => {
    const diasMentor = dias(l.seg_mentor_medio)
    const diasIncubado = dias(l.seg_incubado_medio)

    return {
      id_no: l.id_no,
      passo: l.passo,
      modulo: l.modulo ?? null,
      fase: l.fase ?? null,
      fase_ordem: num(l.fase_ordem),
      obrigatoria: l.obrigatoria,

      startups: num(l.startups),
      dias_startup_medio: diasIncubado,
      dias_mentor_medio: diasMentor,
      dias_mentor_maximo: dias(l.seg_mentor_maximo),
      // Quanto do tempo do passo e fila. E o numero que diz se o passo e
      // dificil de fazer ou dificil de corrigir.
      pct_mentor: pct(diasMentor, diasMentor + diasIncubado),

      aguardando_agora: num(l.aguardando_agora),
      espera_dias: diasDesde(l.espera_desde_ts),
      devolucoes: num(l.devolucoes),
    }
  })

  // Ranking do que a mentoria mais segura. Passo que ninguem alcancou fica de
  // fora: zero dias de fila em zero startups nao e um passo rapido, e um passo
  // sem historia.
  const ranking = passos
    .filter((p) => p.startups > 0 && p.dias_mentor_medio > 0)
    .sort((a, b) => b.dias_mentor_medio - a.dias_mentor_medio)
    .slice(0, 10)

  // -------------------------------------------------------------------------
  // Resumo
  // -------------------------------------------------------------------------
  const abertas = etapas.filter((e) => !e.concluida)
  const concluidas = etapas.filter((e) => e.concluida)

  const somaTotal = etapas.reduce((s, e) => s + e.dias_total, 0)
  const somaBloqueada = etapas.reduce((s, e) => s + e.dias_bloqueada, 0)

  const esperas = etapas.map((e) => e.espera_dias).filter((d) => d != null)

  return {
    etapas,
    startups,
    passos,
    ranking,
    parametros: { sla_mentor_dias: SLA_MENTOR_DIAS, pct_bloqueio_alto: PCT_BLOQUEIO_ALTO },
    resumo: {
      startups: startups.length,
      etapas_em_andamento: abertas.length,

      // Media sobre as ETAPAS JA FECHADAS: incluir as abertas misturaria
      // "levou 30 dias" com "esta ha 3 dias e ainda vai levar", e puxaria a
      // media para baixo justamente quando uma turma nova entra.
      dias_medio_etapa_concluida: concluidas.length
        ? Math.round((concluidas.reduce((s, e) => s + e.dias_total, 0) / concluidas.length) * 10) / 10
        : null,

      dias_medio_etapa_aberta: abertas.length
        ? Math.round((abertas.reduce((s, e) => s + e.dias_total, 0) / abertas.length) * 10) / 10
        : null,

      // A manchete: da soma de todo o tempo de trilha do programa, quanto foi
      // fila de correcao.
      pct_tempo_bloqueado: pct(somaBloqueada, somaTotal),
      dias_bloqueados_total: Math.round(somaBloqueada * 10) / 10,

      etapas_travadas_na_mentoria: abertas.filter((e) => e.atribuicao === "MENTORIA").length,
      startups_travadas_na_mentoria: new Set(
        abertas.filter((e) => e.atribuicao === "MENTORIA").map((e) => e.id_startup)
      ).size,

      espera_mais_antiga_dias: esperas.length ? Math.max(...esperas) : null,
      entregas_na_fila: etapas.reduce((s, e) => s + e.aguardando_agora, 0),
    },
  }
}

module.exports = { tempoEtapa }
