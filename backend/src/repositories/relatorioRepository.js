/**
 * Repositorio de Relatorios (camada de acesso a dados).
 * Tabelas relacionadas: startup, startup_membros, mentor_startup, trilha_no,
 * entrega, avaliacao, startup_trilha, evento, evento_startups,
 * evento_confirmacao, evento_presenca (schema.sql).
 *
 * Os relatorios NAO guardam nada: sao leituras agregadas do mesmo estado que a
 * Jornada e o Construtor ja produzem. Por isso o estado de um passo e derivado
 * aqui exatamente como em jornadaService.derivarStatus — se as duas contas
 * divergissem, o relatorio contradiria a tela que o incubado ve.
 */
const { query } = require("../config/db")

// ---------------------------------------------------------------------------
// Bloco compartilhado: o estado de cada PASSO ativo para cada startup.
//
// E o produto cartesiano "startups incubadas x passos ativos da trilha do
// tenant", com a entrega daquela startup naquele passo e a ultima avaliacao
// daquela entrega. Dois relatorios leem dele em recortes diferentes:
// "Progresso" agrupa por startup, "Gargalos" agrupa por passo.
//
// Startups ENCERRADAS ficam de fora: elas ja sairam do programa e manteriam
// eternamente passos "nao iniciados" no denominador, afundando toda media.
//
// $1 = id_tenant
// ---------------------------------------------------------------------------
const SQL_ESTADO_PASSOS = `
  SELECT s.id_startup,
         s.nome   AS startup,
         s.status AS startup_status,

         n.id_no,
         n.id_pai AS id_modulo,
         n.nome   AS passo,
         n.obrigatoria,
         n.prazo,

         e.criado_ts     AS entrega_criado_ts,
         e.atualizado_ts AS entrega_atualizado_ts,
         a.criado_ts     AS avaliacao_ts,

         -- Mesma ordem de precedencia de jornadaService.derivarStatus.
         CASE
           WHEN e.id_entrega IS NULL  THEN 'NAO_INICIADA'
           WHEN e.status = 'RASCUNHO' THEN 'RASCUNHO'
           WHEN a.status IS NULL      THEN 'AGUARDANDO'
           WHEN a.status = 'APROVADO' THEN 'APROVADO'
           ELSE 'AJUSTE'
         END AS estado

    FROM startup s

    JOIN trilha_no n
      ON n.id_tenant = s.id_tenant
     AND n.tipo = 'PASSO'
     AND n.ativo = TRUE

    LEFT JOIN entrega e
      ON e.id_no = n.id_no AND e.id_startup = s.id_startup

    -- So a avaliacao mais recente: o mentor pode pedir ajuste e depois
    -- aprovar, e o estado do passo e sempre o da ultima palavra.
    LEFT JOIN LATERAL (
      SELECT status, criado_ts
        FROM avaliacao
       WHERE id_entrega = e.id_entrega
       ORDER BY criado_ts DESC, id_avaliacao DESC
       LIMIT 1
    ) a ON TRUE

   WHERE s.id_tenant = $1
     AND s.status <> 'ENCERRADA'
`

// ---------------------------------------------------------------------------
// RELATORIO 1 — Progresso das startups
// ---------------------------------------------------------------------------

/**
 * Uma linha por startup incubada, com a contagem de passos em cada estado,
 * a fase atual e quando foi a ultima atividade.
 *
 * @param {number} idTenant
 */
async function progressoStartups(idTenant) {
  const { rows } = await query(
    `WITH estado AS (${SQL_ESTADO_PASSOS}),
     agg AS (
       SELECT id_startup, startup, startup_status,
              COUNT(*)                                              AS total_passos,
              COUNT(*) FILTER (WHERE estado = 'APROVADO')           AS aprovados,
              COUNT(*) FILTER (WHERE estado = 'AGUARDANDO')         AS aguardando,
              COUNT(*) FILTER (WHERE estado = 'AJUSTE')             AS ajuste,
              COUNT(*) FILTER (WHERE estado = 'RASCUNHO')           AS rascunho,
              COUNT(*) FILTER (WHERE estado = 'NAO_INICIADA')       AS nao_iniciados,

              -- Atrasado = passo com prazo vencido que ainda nao foi aprovado.
              COUNT(*) FILTER (
                WHERE estado <> 'APROVADO'
                  AND prazo IS NOT NULL
                  AND prazo < CURRENT_DATE
              ) AS atrasados,

              -- GREATEST ignora NULL no Postgres: startup sem nenhuma entrega
              -- cai em NULL, e a service traduz para "nunca".
              MAX(GREATEST(entrega_atualizado_ts, avaliacao_ts)) AS ultima_atividade_ts
         FROM estado
        GROUP BY id_startup, startup, startup_status
     )
     SELECT agg.*,
            prox.nome        AS fase_atual,
            COALESCE(eq.membros, 0)  AS membros,
            COALESCE(mt.mentores, '{}') AS mentores

       FROM agg

       -- Fase atual = a primeira fase ativa que a startup ainda nao aprovou.
       -- Mesma regra do startupRepository, para as duas telas concordarem.
       LEFT JOIN LATERAL (
         SELECT f.nome
           FROM trilha_no f
          WHERE f.id_tenant = $1 AND f.tipo = 'FASE' AND f.ativo = TRUE
            AND NOT EXISTS (
              SELECT 1 FROM startup_trilha x
               WHERE x.id_startup = agg.id_startup
                 AND x.id_no = f.id_no
                 AND x.status = 'APROVADA'
            )
          ORDER BY f.ordem
          LIMIT 1
       ) prox ON TRUE

       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS membros
           FROM startup_membros sm
          WHERE sm.id_startup = agg.id_startup AND sm.ativo = TRUE
       ) eq ON TRUE

       LEFT JOIN LATERAL (
         SELECT ARRAY_AGG(u.nome ORDER BY u.nome) AS mentores
           FROM mentor_startup ms
           JOIN usuarios u ON u.id_usuario = ms.id_usuario_mentor
          WHERE ms.id_startup = agg.id_startup
       ) mt ON TRUE

      ORDER BY agg.startup`,
    [idTenant]
  )
  return rows
}

// ---------------------------------------------------------------------------
// RELATORIO 2 — Entregas e avaliacoes
// ---------------------------------------------------------------------------

/** Funil do tenant: quantos passos-startup em cada estado, somando tudo. */
async function funilEntregas(idTenant) {
  const { rows } = await query(
    `WITH estado AS (${SQL_ESTADO_PASSOS})
     SELECT COUNT(*)                                        AS total,
            COUNT(*) FILTER (WHERE estado = 'NAO_INICIADA') AS nao_iniciados,
            COUNT(*) FILTER (WHERE estado = 'RASCUNHO')     AS rascunho,
            COUNT(*) FILTER (WHERE estado = 'AGUARDANDO')   AS aguardando,
            COUNT(*) FILTER (WHERE estado = 'AJUSTE')       AS ajuste,
            COUNT(*) FILTER (WHERE estado = 'APROVADO')     AS aprovados
       FROM estado`,
    [idTenant]
  )
  return rows[0]
}

/**
 * Fila de avaliacao: entregas enviadas que ainda nao receberam avaliacao,
 * da mais antiga para a mais nova — a lista de trabalho do mentor.
 *
 * @param {number} idTenant
 * @param {number} limite
 */
async function filaAvaliacao(idTenant, limite = 50) {
  const { rows } = await query(
    `SELECT e.id_entrega,
            e.atualizado_ts AS enviada_ts,
            EXTRACT(DAY FROM (NOW() - e.atualizado_ts))::INTEGER AS dias_parada,
            s.id_startup, s.nome AS startup,
            n.id_no, n.nome AS passo,
            COALESCE(mt.mentores, '{}') AS mentores

       FROM entrega e
       JOIN startup s   ON s.id_startup = e.id_startup AND s.id_tenant = $1
       JOIN trilha_no n ON n.id_no = e.id_no

       LEFT JOIN LATERAL (
         SELECT ARRAY_AGG(u.nome ORDER BY u.nome) AS mentores
           FROM mentor_startup ms
           JOIN usuarios u ON u.id_usuario = ms.id_usuario_mentor
          WHERE ms.id_startup = s.id_startup
       ) mt ON TRUE

      WHERE e.status = 'ENVIADA'
        AND NOT EXISTS (
          SELECT 1 FROM avaliacao a WHERE a.id_entrega = e.id_entrega
        )
      ORDER BY e.atualizado_ts
      LIMIT $2`,
    [idTenant, limite]
  )
  return rows
}

/**
 * Desempenho por mentor no periodo: quantas avaliacoes fez, como decidiu,
 * nota media e quanto tempo a startup esperou por ela.
 *
 * O tempo de resposta usa entrega.atualizado_ts (o momento do envio) porque a
 * entrega e um upsert: reenviar reescreve a linha. E o melhor marco disponivel
 * do "relogio comecou a correr".
 *
 * @param {number} idTenant
 * @param {number} dias - janela do relatorio
 */
async function desempenhoMentores(idTenant, dias) {
  const { rows } = await query(
    `SELECT u.id_usuario, u.nome AS mentor,
            COUNT(*)                                          AS avaliacoes,
            COUNT(*) FILTER (WHERE a.status = 'APROVADO')     AS aprovadas,
            COUNT(*) FILTER (WHERE a.status = 'AJUSTE')       AS ajustes,
            COUNT(*) FILTER (WHERE a.status = 'REPROVADO')    AS reprovadas,
            ROUND(AVG(a.nota), 1)                             AS nota_media,
            ROUND(AVG(
              EXTRACT(EPOCH FROM (a.criado_ts - e.atualizado_ts)) / 86400
            )::NUMERIC, 1)                                    AS dias_resposta_media,
            COUNT(DISTINCT e.id_startup)                      AS startups_atendidas

       FROM avaliacao a
       JOIN entrega e  ON e.id_entrega = a.id_entrega
       JOIN startup s  ON s.id_startup = e.id_startup AND s.id_tenant = $1
       JOIN usuarios u ON u.id_usuario = a.id_avaliador

      WHERE a.criado_ts >= NOW() - make_interval(days => $2)
      GROUP BY u.id_usuario, u.nome
      ORDER BY avaliacoes DESC, u.nome`,
    [idTenant, dias]
  )
  return rows
}

/**
 * Volume semanal de envios e de avaliacoes no periodo — mostra se a
 * incubadora esta acompanhando o ritmo das startups ou acumulando fila.
 */
async function volumeSemanal(idTenant, dias) {
  const { rows } = await query(
    `WITH semanas AS (
       SELECT generate_series(
                DATE_TRUNC('week', NOW() - make_interval(days => $2)),
                DATE_TRUNC('week', NOW()),
                '1 week'
              ) AS semana
     ),
     envios AS (
       SELECT DATE_TRUNC('week', e.atualizado_ts) AS semana, COUNT(*) AS total
         FROM entrega e
         JOIN startup s ON s.id_startup = e.id_startup AND s.id_tenant = $1
        WHERE e.status = 'ENVIADA'
          AND e.atualizado_ts >= NOW() - make_interval(days => $2)
        GROUP BY 1
     ),
     avaliadas AS (
       SELECT DATE_TRUNC('week', a.criado_ts) AS semana, COUNT(*) AS total
         FROM avaliacao a
         JOIN entrega e ON e.id_entrega = a.id_entrega
         JOIN startup s ON s.id_startup = e.id_startup AND s.id_tenant = $1
        WHERE a.criado_ts >= NOW() - make_interval(days => $2)
        GROUP BY 1
     )
     SELECT w.semana,
            COALESCE(en.total, 0) AS enviadas,
            COALESCE(av.total, 0) AS avaliadas
       FROM semanas w
       LEFT JOIN envios en    ON en.semana = w.semana
       LEFT JOIN avaliadas av ON av.semana = w.semana
      ORDER BY w.semana`,
    [idTenant, dias]
  )
  return rows
}

// ---------------------------------------------------------------------------
// RELATORIO 3 — Gargalos do programa
// ---------------------------------------------------------------------------

/**
 * Uma linha por PASSO da trilha, com quantas startups estao presas nele e
 * quanto tempo leva para ser aprovado.
 *
 * Nao ha metrica de "taxa historica de reprovacao": o reenvio apaga as
 * avaliacoes anteriores (jornadaRepository.reenviar), entao o historico de
 * pedidos de ajuste ja atendidos nao existe mais no banco. Medir sobre o que
 * sobrou daria um numero que so cai com o tempo e nao significa nada.
 *
 * @param {number} idTenant
 */
async function gargalosPrograma(idTenant) {
  const { rows } = await query(
    `WITH estado AS (${SQL_ESTADO_PASSOS})
     SELECT est.id_no,
            est.passo,
            est.obrigatoria,
            m.nome AS modulo,
            f.nome AS fase,
            f.ordem AS fase_ordem,

            COUNT(*)                                            AS startups,
            COUNT(*) FILTER (WHERE estado <> 'NAO_INICIADA')    AS iniciaram,
            COUNT(*) FILTER (WHERE estado = 'APROVADO')         AS aprovados,
            COUNT(*) FILTER (WHERE estado = 'AGUARDANDO')       AS aguardando,
            COUNT(*) FILTER (WHERE estado = 'AJUSTE')           AS em_ajuste,
            COUNT(*) FILTER (WHERE estado = 'RASCUNHO')         AS rascunho,
            COUNT(*) FILTER (WHERE estado = 'NAO_INICIADA')     AS nao_iniciados,

            COUNT(*) FILTER (
              WHERE estado <> 'APROVADO'
                AND est.prazo IS NOT NULL
                AND est.prazo < CURRENT_DATE
            ) AS atrasados,

            -- Do primeiro envio ate a aprovacao, so entre os ja aprovados.
            ROUND((AVG(
              EXTRACT(EPOCH FROM (est.avaliacao_ts - est.entrega_criado_ts)) / 86400
            ) FILTER (WHERE estado = 'APROVADO'))::NUMERIC, 1) AS dias_ate_aprovar,

            -- Ha quanto tempo espera quem esta parado aguardando avaliacao.
            ROUND((AVG(
              EXTRACT(EPOCH FROM (NOW() - est.entrega_atualizado_ts)) / 86400
            ) FILTER (WHERE estado = 'AGUARDANDO'))::NUMERIC, 1) AS dias_na_fila

       FROM estado est
       LEFT JOIN trilha_no m ON m.id_no = est.id_modulo
       LEFT JOIN trilha_no f ON f.id_no = m.id_pai

      GROUP BY est.id_no, est.passo, est.obrigatoria, m.nome, f.nome, f.ordem
      ORDER BY f.ordem NULLS LAST, m.nome, est.passo`,
    [idTenant]
  )
  return rows
}

// ---------------------------------------------------------------------------
// RELATORIO 4 — Engajamento e eventos
// ---------------------------------------------------------------------------

// Publico-alvo de cada evento do periodo.
//
// Um evento sem linhas em evento_startups e GERAL: vale para todas as startups
// incubadas. Com linhas, so para as listadas (ver schema.sql). O publico e a
// soma dos membros ativos dessas startups — sem isso, "taxa de presenca" nao
// tem denominador.
//
// MESMO CRITERIO de eventoRepository.listarPublico, que monta a lista da tela
// de presenca. Mexeu aqui, mexa la: a tela marca quem esta na lista dela, e
// este relatorio conta quem esta na lista daqui. Divergir faz a taxa de
// presenca contar um denominador que ninguem consegue marcar.
//
// $1 = id_tenant, $2 = dias
const SQL_PUBLICO_EVENTOS = `
  SELECT ev.id_evento, sm.id_usuario, sm.id_startup
    FROM evento ev
    JOIN startup s
      ON s.id_tenant = $1 AND s.status <> 'ENCERRADA'
    JOIN startup_membros sm
      ON sm.id_startup = s.id_startup AND sm.ativo = TRUE
   WHERE ev.id_tenant = $1
     AND ev.ativo = TRUE
     AND ev.inicio_ts >= NOW() - make_interval(days => $2)
     AND ev.inicio_ts <= NOW()
     AND (
       NOT EXISTS (SELECT 1 FROM evento_startups es WHERE es.id_evento = ev.id_evento)
       OR EXISTS (
         SELECT 1 FROM evento_startups es
          WHERE es.id_evento = ev.id_evento AND es.id_startup = s.id_startup
       )
     )
`

/**
 * Uma linha por evento ja realizado no periodo: publico, confirmacoes e
 * presencas efetivas.
 *
 * @param {number} idTenant
 * @param {number} dias
 */
async function engajamentoEventos(idTenant, dias) {
  const { rows } = await query(
    `WITH publico AS (${SQL_PUBLICO_EVENTOS})
     SELECT ev.id_evento, ev.titulo, ev.categoria, ev.inicio_ts,
            ev.obrigatorio, ev.local,

            COUNT(*)                                                   AS publico,
            COUNT(*) FILTER (WHERE c.status = 'CONFIRMADO')            AS confirmados,
            COUNT(*) FILTER (WHERE p.presente)                         AS presentes,

            -- Quem disse que ia e nao foi: o numero que explica sala vazia.
            COUNT(*) FILTER (
              WHERE c.status = 'CONFIRMADO' AND COALESCE(p.presente, FALSE) = FALSE
            ) AS faltaram_confirmados

       FROM publico pu
       JOIN evento ev ON ev.id_evento = pu.id_evento
       LEFT JOIN evento_confirmacao c
              ON c.id_evento = pu.id_evento AND c.id_usuario = pu.id_usuario
       LEFT JOIN evento_presenca p
              ON p.id_evento = pu.id_evento AND p.id_usuario = pu.id_usuario

      GROUP BY ev.id_evento, ev.titulo, ev.categoria, ev.inicio_ts,
               ev.obrigatorio, ev.local
      ORDER BY ev.inicio_ts DESC`,
    [idTenant, dias]
  )
  return rows
}

/**
 * Uma linha por startup: a quantos eventos foi convidada e em quantos
 * apareceu. Revela a startup que sumiu antes que ela peca desligamento.
 *
 * @param {number} idTenant
 * @param {number} dias
 */
async function engajamentoStartups(idTenant, dias) {
  const { rows } = await query(
    `WITH publico AS (${SQL_PUBLICO_EVENTOS})
     SELECT s.id_startup, s.nome AS startup,

            COUNT(DISTINCT pu.id_evento)                                AS eventos_convidada,
            COUNT(DISTINCT pu.id_evento) FILTER (WHERE p.presente)      AS eventos_presente,
            COUNT(DISTINCT pu.id_evento) FILTER (
              WHERE ev.obrigatorio AND COALESCE(p.presente, FALSE) = FALSE
            ) AS faltas_obrigatorias,

            MAX(p.checkin_ts) AS ultima_presenca_ts

       FROM publico pu
       JOIN startup s ON s.id_startup = pu.id_startup
       JOIN evento ev ON ev.id_evento = pu.id_evento
       LEFT JOIN evento_presenca p
              ON p.id_evento = pu.id_evento AND p.id_usuario = pu.id_usuario

      GROUP BY s.id_startup, s.nome
      ORDER BY s.nome`,
    [idTenant, dias]
  )
  return rows
}

module.exports = {
  progressoStartups,
  funilEntregas,
  filaAvaliacao,
  desempenhoMentores,
  volumeSemanal,
  gargalosPrograma,
  engajamentoEventos,
  engajamentoStartups,
}
