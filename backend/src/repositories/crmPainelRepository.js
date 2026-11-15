/**
 * Repositorio do painel do CRM (migracao 026): os numeros da operacao
 * comercial de UMA startup, contados no banco.
 *
 * O PERIODO vale para o que se ENCERROU (ganhas, perdidas, taxa de conversao):
 * "quanto vendemos nos ultimos 90 dias". O que esta EM ABERTO (funil, tarefas)
 * e sempre o retrato de agora — nao existe "funil aberto nos ultimos 90 dias".
 */
const { query } = require("../config/db")
const { instante, dia, AGORA_UTC, TAREFA_ABERTA } = require("../crm/sql")

/** @param {string|null} desde - "AAAA-MM-DD" ou null para todo o historico. */
async function indicadores(idStartup, desde) {
  const { rows } = await query(
    `WITH op AS (
        SELECT situacao, valor_estimado, valor_vendido, fechamento_dt
          FROM crm_oportunidade
         WHERE id_startup = $1 AND excluido_ts IS NULL
     ),
     ta AS (
        SELECT vencimento_ts
          FROM crm_tarefa
         WHERE id_startup = $1 AND status IN ${TAREFA_ABERTA}
     )
     SELECT
       (SELECT COUNT(*) FROM crm_cliente WHERE id_startup = $1 AND excluido_ts IS NULL)::int AS total_clientes,
       (SELECT COUNT(*) FROM op WHERE situacao = 'ABERTA')::int AS oportunidades_abertas,
       (SELECT COALESCE(SUM(valor_estimado), 0) FROM op WHERE situacao = 'ABERTA')::float8 AS valor_funil,
       (SELECT COUNT(*) FROM op WHERE situacao = 'GANHA'
          AND ($2::date IS NULL OR fechamento_dt >= $2::date))::int AS ganhas,
       (SELECT COALESCE(SUM(valor_vendido), 0) FROM op WHERE situacao = 'GANHA'
          AND ($2::date IS NULL OR fechamento_dt >= $2::date))::float8 AS valor_ganho,
       (SELECT COUNT(*) FROM op WHERE situacao = 'PERDIDA'
          AND ($2::date IS NULL OR fechamento_dt >= $2::date))::int AS perdidas,
       (SELECT COUNT(*) FROM ta)::int AS tarefas_pendentes,
       (SELECT COUNT(*) FROM ta WHERE vencimento_ts < ${AGORA_UTC})::int AS tarefas_atrasadas`,
    [idStartup, desde]
  )
  const r = rows[0]
  const encerradas = r.ganhas + r.perdidas
  // Sem nada encerrado no periodo a taxa nao existe — nao e zero por cento.
  r.taxa_conversao = encerradas > 0 ? Math.round((r.ganhas / encerradas) * 1000) / 10 : null
  return r
}

/** As etapas ativas com quantas oportunidades abertas e quanto valem. */
async function distribuicaoPorEtapa(idStartup) {
  const { rows } = await query(
    `SELECT e.id_etapa, e.nome, e.cor, e.ordem,
            COUNT(o.id_oportunidade)::int AS quantidade,
            COALESCE(SUM(o.valor_estimado), 0)::float8 AS valor
       FROM crm_etapa e
       LEFT JOIN crm_oportunidade o
              ON o.id_startup = e.id_startup AND o.id_etapa = e.id_etapa
             AND o.situacao = 'ABERTA' AND o.excluido_ts IS NULL
      WHERE e.id_startup = $1 AND e.ativo = TRUE
      GROUP BY e.id_etapa
      ORDER BY e.ordem, e.id_etapa`,
    [idStartup]
  )
  return rows
}

/** As proximas tarefas em aberto: atrasadas primeiro, depois por vencimento. */
async function proximasTarefas(idStartup, limite = 6) {
  const { rows } = await query(
    `SELECT t.id_tarefa, t.titulo, t.prioridade, t.status,
            ${instante("t.vencimento_ts", "vencimento_ts")},
            (t.vencimento_ts < ${AGORA_UTC}) AS atrasada,
            t.id_oportunidade, o.titulo AS oportunidade_titulo,
            t.id_cliente, c.nome AS cliente_nome,
            ur.nome AS responsavel_nome, ur.foto_url AS responsavel_foto
       FROM crm_tarefa t
       LEFT JOIN crm_oportunidade o ON o.id_startup = t.id_startup AND o.id_oportunidade = t.id_oportunidade
       LEFT JOIN crm_cliente c ON c.id_startup = t.id_startup AND c.id_cliente = t.id_cliente
       LEFT JOIN usuarios ur ON ur.id_usuario = t.id_responsavel
      WHERE t.id_startup = $1 AND t.status IN ${TAREFA_ABERTA}
      ORDER BY t.vencimento_ts ASC NULLS LAST, t.id_tarefa
      LIMIT $2`,
    [idStartup, limite]
  )
  return rows
}

/** As oportunidades abertas com movimento mais recente (evento ou edicao). */
async function oportunidadesRecentes(idStartup, limite = 6) {
  const { rows } = await query(
    `SELECT o.id_oportunidade, o.titulo, o.situacao, o.valor_estimado::float8 AS valor_estimado,
            e.nome AS etapa_nome, e.cor AS etapa_cor, c.nome AS cliente_nome,
            ${instante("GREATEST(o.atualizado_ts, ua.ultima)", "ultima_atividade_ts")}
       FROM crm_oportunidade o
       JOIN crm_etapa e ON e.id_startup = o.id_startup AND e.id_etapa = o.id_etapa
       JOIN crm_cliente c ON c.id_startup = o.id_startup AND c.id_cliente = o.id_cliente
       LEFT JOIN LATERAL (
         SELECT MAX(ev.criado_ts) AS ultima FROM crm_evento ev WHERE ev.id_oportunidade = o.id_oportunidade
       ) ua ON TRUE
      WHERE o.id_startup = $1 AND o.excluido_ts IS NULL
      ORDER BY GREATEST(o.atualizado_ts, ua.ultima) DESC NULLS LAST
      LIMIT $2`,
    [idStartup, limite]
  )
  return rows
}

/**
 * O faturamento da startup como a INCUBADORA o ve: so somas das vendas ganhas
 * (valor efetivamente vendido, pela data de fechamento). Nenhum cliente,
 * nenhuma negociacao, nenhum valor de funil sai daqui.
 *
 * `hoje` vem do service, no fuso da incubadora: e ele que decide qual e o mes
 * corrente e onde comecam os 12 meses.
 *
 * @returns {Promise<{resumo: object, meses: Array<{mes: string, valor: number, vendas: number}>}>}
 */
async function faturamento(idStartup, hoje) {
  const [resumo, meses] = await Promise.all([
    query(
      `SELECT COUNT(*)::int AS vendas,
              COALESCE(SUM(valor_vendido), 0)::float8 AS total,
              COALESCE(SUM(valor_vendido) FILTER (
                WHERE fechamento_dt >= date_trunc('year', $2::date::timestamp)
              ), 0)::float8 AS ano_atual,
              ${dia("MIN(fechamento_dt)", "primeira_venda")},
              ${dia("MAX(fechamento_dt)", "ultima_venda")}
         FROM crm_oportunidade
        WHERE id_startup = $1 AND situacao = 'GANHA' AND excluido_ts IS NULL`,
      [idStartup, hoje]
    ),
    // Os 12 meses ate o corrente, inclusive os sem venda nenhuma: o mes zerado
    // e informacao, e um grafico que pula meses mentiria sobre o ritmo.
    query(
      `SELECT to_char(m.mes, 'YYYY-MM') AS mes,
              COALESCE(SUM(o.valor_vendido), 0)::float8 AS valor,
              COUNT(o.id_oportunidade)::int AS vendas
         FROM generate_series(
                date_trunc('month', $2::date::timestamp) - INTERVAL '11 months',
                date_trunc('month', $2::date::timestamp),
                INTERVAL '1 month'
              ) AS m(mes)
         LEFT JOIN crm_oportunidade o
                ON o.id_startup = $1 AND o.situacao = 'GANHA' AND o.excluido_ts IS NULL
               AND date_trunc('month', o.fechamento_dt::timestamp) = m.mes
        GROUP BY m.mes
        ORDER BY m.mes`,
      [idStartup, hoje]
    ),
  ])
  return { resumo: resumo.rows[0], meses: meses.rows }
}

module.exports = { indicadores, distribuicaoPorEtapa, proximasTarefas, oportunidadesRecentes, faturamento }
