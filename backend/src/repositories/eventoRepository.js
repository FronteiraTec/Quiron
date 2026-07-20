/**
 * Repositorio de Eventos (camada de acesso a dados).
 * Tabelas relacionadas: evento, evento_startups, evento_confirmacao,
 * evento_presenca (schema.sql).
 *
 * Direcionamento: um evento sem linhas em evento_startups e GERAL (visivel a
 * todas as startups do tenant); com linhas, e visivel apenas as listadas.
 */
const { query } = require("../config/db")

// Evento + nome de quem criou + startups direcionadas (agregadas em JSON).
const SELECT_EVENTO = `
  SELECT e.id_evento, e.id_tenant, e.titulo, e.descricao, e.categoria, e.local,
         e.inicio_ts, e.fim_ts, e.mentor_nome, e.anexos, e.vagas, e.obrigatorio,
         e.ativo, e.criado_por, u.nome AS criado_por_nome, e.criado_ts, e.atualizado_ts,
         COALESCE(
           (SELECT json_agg(json_build_object('id_startup', st.id_startup, 'nome', st.nome) ORDER BY st.nome)
              FROM evento_startups es
              JOIN startup st ON st.id_startup = es.id_startup
             WHERE es.id_evento = e.id_evento),
           '[]'
         ) AS startups
    FROM evento e
    LEFT JOIN usuarios u ON u.id_usuario = e.criado_por
`

/**
 * Lista os eventos ativos de um tenant, opcionalmente filtrando por periodo.
 *
 * @param {number} idTenant
 * @param {{inicio?: string, fim?: string}} [periodo]
 * @param {number[]|null} [idsStartupsPermitidos] - Quando informado, restringe
 *   aos eventos gerais (sem startups) OU direcionados a alguma dessas startups.
 *   `null` = sem restricao (admin/mentor veem tudo).
 */
async function listarPorTenant(idTenant, periodo = {}, idsStartupsPermitidos = null) {
  const { inicio, fim } = periodo
  const condicoes = ["e.id_tenant = $1", "e.ativo = TRUE"]
  const params = [idTenant]

  if (inicio) {
    params.push(inicio)
    condicoes.push(`e.inicio_ts >= $${params.length}`)
  }
  if (fim) {
    params.push(fim)
    condicoes.push(`e.inicio_ts <= $${params.length}`)
  }

  if (idsStartupsPermitidos) {
    params.push(idsStartupsPermitidos)
    condicoes.push(`(
      NOT EXISTS (SELECT 1 FROM evento_startups es WHERE es.id_evento = e.id_evento)
      OR EXISTS (
        SELECT 1 FROM evento_startups es
         WHERE es.id_evento = e.id_evento AND es.id_startup = ANY($${params.length}::int[])
      )
    )`)
  }

  const { rows } = await query(
    `${SELECT_EVENTO} WHERE ${condicoes.join(" AND ")} ORDER BY e.inicio_ts`,
    params
  )
  return rows
}

/** Busca um evento pelo id. */
async function buscarPorId(id) {
  const { rows } = await query(`${SELECT_EVENTO} WHERE e.id_evento = $1`, [id])
  return rows[0]
}

/** Substitui as startups direcionadas de um evento (lista vazia = geral). */
async function definirStartups(idEvento, idsStartups, client) {
  const executor = client || { query }
  await executor.query(`DELETE FROM evento_startups WHERE id_evento = $1`, [idEvento])
  if (idsStartups?.length) {
    const values = idsStartups.map((_, i) => `($1, $${i + 2})`).join(", ")
    await executor.query(
      `INSERT INTO evento_startups (id_evento, id_startup) VALUES ${values}`,
      [idEvento, ...idsStartups]
    )
  }
}

/** Cria um novo evento. */
async function criar(dados) {
  const {
    idTenant, titulo, descricao, categoria, local, inicioTs, fimTs,
    idsStartups, mentorNome, anexos, vagas, obrigatorio, criadoPor,
  } = dados
  const { rows } = await query(
    `INSERT INTO evento
       (id_tenant, titulo, descricao, categoria, local, inicio_ts, fim_ts,
        mentor_nome, anexos, vagas, obrigatorio, criado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING id_evento`,
    [
      idTenant, titulo, descricao ?? null, categoria, local ?? null, inicioTs, fimTs ?? null,
      mentorNome ?? null, JSON.stringify(anexos ?? []), vagas ?? null, obrigatorio ?? false, criadoPor,
    ]
  )
  const idEvento = rows[0].id_evento
  await definirStartups(idEvento, idsStartups)
  return buscarPorId(idEvento)
}

/** Atualiza um evento existente. */
async function atualizar(id, dados) {
  const {
    titulo, descricao, categoria, local, inicioTs, fimTs,
    idsStartups, mentorNome, anexos, vagas, obrigatorio,
  } = dados
  const { rows } = await query(
    `UPDATE evento
        SET titulo = $1, descricao = $2, categoria = $3, local = $4,
            inicio_ts = $5, fim_ts = $6, mentor_nome = $7,
            anexos = $8, vagas = $9, obrigatorio = $10, atualizado_ts = NOW()
      WHERE id_evento = $11 AND ativo = TRUE
      RETURNING id_evento`,
    [
      titulo, descricao ?? null, categoria, local ?? null, inicioTs, fimTs ?? null,
      mentorNome ?? null, JSON.stringify(anexos ?? []), vagas ?? null, obrigatorio ?? false, id,
    ]
  )
  if (!rows[0]) return undefined
  await definirStartups(id, idsStartups)
  return buscarPorId(id)
}

/** Remove (soft delete) um evento. */
async function excluir(id) {
  const { rows } = await query(
    `UPDATE evento SET ativo = FALSE, atualizado_ts = NOW()
      WHERE id_evento = $1 AND ativo = TRUE
      RETURNING id_evento`,
    [id]
  )
  return rows[0]
}

// ---------------------------------------------------------------------------
// PRESENCA (check-in) — nao confundir com CONFIRMACAO (RSVP), abaixo.
//
// evento_confirmacao = "pretendo ir", escrito pelo proprio usuario.
// evento_presenca    = "esteve la", escrito por um admin (marcado_por).
//
// As funcoes confirmarPresenca/listarParticipantes tem "presenca" no nome mas
// tratam do RSVP — o nome e anterior a esta distincao.
// ---------------------------------------------------------------------------

/**
 * Quem foi convidado para um evento.
 *
 * Um evento sem linhas em evento_startups e GERAL: vale para todas as startups
 * incubadas. Com linhas, so para as listadas.
 *
 * ESTA REGRA PRECISA CONCORDAR com SQL_PUBLICO_EVENTOS em relatorioRepository,
 * que calcula o mesmo publico em lote para o relatorio de engajamento. Se as
 * duas divergirem, a tela de presenca marca gente que o relatorio nao conta (ou
 * o contrario) e a taxa de presenca fica sem sentido. Sao dois SQLs porque as
 * formas sao diferentes — aqui uma linha por PESSOA de UM evento, la uma linha
 * por (evento, pessoa) de um periodo inteiro — mas o criterio e o mesmo:
 * membros ativos de startups nao encerradas do tenant, respeitando o
 * direcionamento.
 *
 * Uma pessoa aparece UMA vez mesmo pertencendo a varias startups: a presenca e
 * por (evento, usuario), entao duas linhas seriam dois checkboxes editando o
 * mesmo registro. As startups dela vem agregadas em `startups`.
 */
async function listarPublico(idEvento) {
  const { rows } = await query(
    `SELECT u.id_usuario, u.nome, u.email, u.foto_url,
            json_agg(json_build_object('id_startup', s.id_startup, 'nome', s.nome)
                     ORDER BY s.nome) AS startups,
            c.status                        AS confirmacao,
            p.presente,
            p.checkin_ts,
            mp.nome                         AS marcado_por_nome
       FROM evento ev
       JOIN startup s
         ON s.id_tenant = ev.id_tenant AND s.status <> 'ENCERRADA'
       JOIN startup_membros sm
         ON sm.id_startup = s.id_startup AND sm.ativo = TRUE
       JOIN usuarios u ON u.id_usuario = sm.id_usuario
       LEFT JOIN evento_confirmacao c
              ON c.id_evento = ev.id_evento AND c.id_usuario = u.id_usuario
       LEFT JOIN evento_presenca p
              ON p.id_evento = ev.id_evento AND p.id_usuario = u.id_usuario
       LEFT JOIN usuarios mp ON mp.id_usuario = p.marcado_por
      WHERE ev.id_evento = $1
        AND ev.ativo = TRUE
        AND (
          NOT EXISTS (SELECT 1 FROM evento_startups es WHERE es.id_evento = ev.id_evento)
          OR EXISTS (
            SELECT 1 FROM evento_startups es
             WHERE es.id_evento = ev.id_evento AND es.id_startup = s.id_startup
          )
        )
      GROUP BY u.id_usuario, u.nome, u.email, u.foto_url,
               c.status, p.presente, p.checkin_ts, mp.nome
      ORDER BY u.nome`,
    [idEvento]
  )
  return rows
}

/**
 * Eventos ja iniciados do tenant com o andamento da marcacao de presenca.
 *
 * `marcados` conta quem ja tem linha em evento_presenca (presente OU ausente):
 * e o que diz se o admin ja passou por este evento. Sem essa distincao, um
 * evento onde todos faltaram pareceria "nao marcado".
 */
async function listarResumoPresenca(idTenant, dias) {
  const { rows } = await query(
    `SELECT ev.id_evento, ev.titulo, ev.categoria, ev.inicio_ts, ev.local,
            ev.obrigatorio,
            -- ::int porque COUNT devolve bigint, que o pg entrega como STRING:
            -- sem o cast a tela compara e soma texto ("10" < "9").
            COUNT(DISTINCT u.id_usuario)::int                             AS publico,
            COUNT(DISTINCT u.id_usuario) FILTER (WHERE p.id_usuario IS NOT NULL)::int AS marcados,
            COUNT(DISTINCT u.id_usuario) FILTER (WHERE p.presente)::int   AS presentes
       FROM evento ev
       JOIN startup s
         ON s.id_tenant = ev.id_tenant AND s.status <> 'ENCERRADA'
       JOIN startup_membros sm
         ON sm.id_startup = s.id_startup AND sm.ativo = TRUE
       JOIN usuarios u ON u.id_usuario = sm.id_usuario
       LEFT JOIN evento_presenca p
              ON p.id_evento = ev.id_evento AND p.id_usuario = u.id_usuario
      WHERE ev.id_tenant = $1
        AND ev.ativo = TRUE
        AND ev.inicio_ts <= NOW()
        AND ev.inicio_ts >= NOW() - make_interval(days => $2)
        AND (
          NOT EXISTS (SELECT 1 FROM evento_startups es WHERE es.id_evento = ev.id_evento)
          OR EXISTS (
            SELECT 1 FROM evento_startups es
             WHERE es.id_evento = ev.id_evento AND es.id_startup = s.id_startup
          )
        )
      GROUP BY ev.id_evento, ev.titulo, ev.categoria, ev.inicio_ts, ev.local,
               ev.obrigatorio
      ORDER BY ev.inicio_ts DESC`,
    [idTenant, dias]
  )
  return rows
}

/**
 * Marca presenca/ausencia de varias pessoas de uma vez.
 *
 * Serve tanto para uma pessoa (lista de um) quanto para o lote da tela. O
 * checkin_ts e refeito a cada marcacao: o que interessa e quando a presenca foi
 * registrada da ultima vez, nao a primeira tentativa.
 *
 * @param {number[]} idsUsuarios
 * @param {boolean} presente
 * @param {number} marcadoPor - admin que esta marcando (evento_presenca.marcado_por).
 */
async function marcarPresenca(idEvento, idsUsuarios, presente, marcadoPor) {
  const { rows } = await query(
    `INSERT INTO evento_presenca (id_evento, id_usuario, presente, marcado_por)
     SELECT $1, id_usuario, $3, $4 FROM unnest($2::int[]) AS id_usuario
     ON CONFLICT (id_evento, id_usuario) DO UPDATE
        SET presente = EXCLUDED.presente,
            checkin_ts = NOW(),
            marcado_por = EXCLUDED.marcado_por
     RETURNING id_usuario, presente`,
    [idEvento, idsUsuarios, presente, marcadoPor]
  )
  return rows
}

/** Registra a confirmacao de presenca de um usuario (CONFIRMADO/RECUSADO/TALVEZ). */
async function confirmarPresenca(idEvento, idUsuario, status) {
  const { rows } = await query(
    `INSERT INTO evento_confirmacao (id_evento, id_usuario, status)
     VALUES ($1, $2, $3)
     ON CONFLICT (id_evento, id_usuario) DO UPDATE SET status = EXCLUDED.status
     RETURNING *`,
    [idEvento, idUsuario, status]
  )
  return rows[0]
}

/** Lista os participantes (confirmacoes) de um evento, com o nome do usuario. */
async function listarParticipantes(idEvento) {
  const { rows } = await query(
    `SELECT ec.id_usuario, u.nome, u.foto_url, ec.status, ec.confirmado_ts
       FROM evento_confirmacao ec
       JOIN usuarios u ON u.id_usuario = ec.id_usuario
      WHERE ec.id_evento = $1
      ORDER BY ec.confirmado_ts`,
    [idEvento]
  )
  return rows
}

module.exports = {
  listarPorTenant,
  buscarPorId,
  criar,
  atualizar,
  excluir,
  listarPublico,
  listarResumoPresenca,
  marcarPresenca,
  confirmarPresenca,
  listarParticipantes,
}
