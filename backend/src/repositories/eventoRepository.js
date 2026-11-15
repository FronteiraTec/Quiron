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
         e.id_local, e.inicio_ts, e.fim_ts, e.id_usuario_mentor, e.anexos, e.vagas,
         e.obrigatorio,
         -- O responsavel em duas formas, so uma gravada por vez (mesmo desenho
         -- do local, acima): o usuario quando e um mentor da incubadora, o
         -- texto quando e alguem de fora. Resolver aqui mantem mentor_nome
         -- significando "o nome do responsavel" para as sete telas e os dois
         -- servicos (e-mail, Google Agenda) que ja o exibem — e, vindo do
         -- usuario, ele acompanha a troca de nome em vez de envelhecer.
         COALESCE(mentor.nome, e.mentor_nome) AS mentor_nome,
         e.ativo, e.criado_por, u.nome AS criado_por_nome, e.criado_ts, e.atualizado_ts,
         -- Rotulo/cor/icone vem da configuracao da incubadora, nao do evento:
         -- renomear a categoria reetiqueta o historico inteiro de graca.
         cat.rotulo AS categoria_rotulo,
         cat.cor    AS categoria_cor,
         cat.icone  AS categoria_icone,
         -- O nome do local sai do cadastro quando ha id_local, e do texto livre
         -- quando nao ha. Resolver aqui evita que cada tela do front repita o
         -- COALESCE — sao sete lugares que exibem local.
         COALESCE(loc.nome, e.local) AS local_nome,
         COALESCE(
           (SELECT json_agg(json_build_object('id_startup', st.id_startup, 'nome', st.nome) ORDER BY st.nome)
              FROM evento_startups es
              JOIN startup st ON st.id_startup = es.id_startup
             WHERE es.id_evento = e.id_evento),
           '[]'
         ) AS startups,
         -- A reuniao por video deste evento, quando ha (migracao 027). E o que
         -- faz a Agenda oferecer "Abrir reuniao" no lugar de editar: o evento
         -- de uma reuniao se edita pela tela de Reunioes.
         reu.id_reuniao,
         reu.status AS reuniao_status
    FROM evento e
    LEFT JOIN reuniao reu ON reu.id_evento = e.id_evento
    LEFT JOIN usuarios u ON u.id_usuario = e.criado_por
    LEFT JOIN evento_categoria cat
           ON cat.id_tenant = e.id_tenant AND cat.chave = e.categoria
    LEFT JOIN evento_local loc ON loc.id_local = e.id_local
    LEFT JOIN usuarios mentor ON mentor.id_usuario = e.id_usuario_mentor
`

/**
 * Lista os eventos ativos de um tenant, opcionalmente filtrando por periodo.
 *
 * @param {number} idTenant
 * @param {{inicio?: string, fim?: string}} [periodo]
 * @param {number[]|null} [idsStartupsPermitidos] - Quando informado, restringe
 *   aos eventos gerais (sem startups) OU direcionados a alguma dessas startups.
 *   `null` = sem restricao (admin/mentor veem tudo).
 * @param {number|null} [idUsuario] - Quem esta olhando, usado so junto com a
 *   restricao acima: o evento de uma REUNIAO nao segue as startups, segue os
 *   convidados (migracao 027) — aparece so para quem foi convidado.
 */
async function listarPorTenant(idTenant, periodo = {}, idsStartupsPermitidos = null, idUsuario = null) {
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
    const pStartups = params.length
    params.push(idUsuario)
    const pUsuario = params.length
    condicoes.push(`(
      (
        reu.id_reuniao IS NULL
        AND (
          NOT EXISTS (SELECT 1 FROM evento_startups es WHERE es.id_evento = e.id_evento)
          OR EXISTS (
            SELECT 1 FROM evento_startups es
             WHERE es.id_evento = e.id_evento AND es.id_startup = ANY($${pStartups}::int[])
          )
        )
      )
      OR EXISTS (
        SELECT 1 FROM reuniao_participante rp
         WHERE rp.id_reuniao = reu.id_reuniao AND rp.id_usuario = $${pUsuario}::int
      )
    )`)
  }

  const { rows } = await query(
    `${SELECT_EVENTO} WHERE ${condicoes.join(" AND ")} ORDER BY e.inicio_ts`,
    params
  )
  return rows
}

/**
 * Busca um evento pelo id.
 * @param {import('pg').PoolClient} [client] - dentro de uma transacao, para
 *   enxergar o evento que ela acabou de gravar.
 */
async function buscarPorId(id, client) {
  const executor = client || { query }
  const { rows } = await executor.query(`${SELECT_EVENTO} WHERE e.id_evento = $1`, [id])
  return rows[0]
}

/**
 * Predicado SQL de "esta pessoa enxerga este evento".
 *
 * E a mesma regra que listar() aplica em duas etapas (permissao + papel),
 * escrita de uma vez em SQL — necessaria porque a integracao com o Google
 * Agenda precisa perguntar isso nas DUAS direcoes:
 *
 *   "quais eventos vao para a agenda desta pessoa?"  (o usuario e fixo)
 *   "para quem mando este evento que acabou de ser criado?" (o evento e fixo)
 *
 * A segunda pergunta nao cabe em listar(), que parte do tenant e do usuario
 * logado. Repetir a regra num terceiro lugar seria pedir para ela divergir —
 * a mesma armadilha ja anotada entre listarPublico e SQL_PUBLICO_EVENTOS do
 * relatorioRepository. Aqui ela vira um trecho so, montado com o alias e a
 * expressao de usuario que cada consulta tem em maos.
 *
 * As formas de enxergar um evento, na ordem em que aparecem abaixo:
 *   1. criou o evento (mesmo sem vinculo com startup nenhuma);
 *   2. foi convidado para a REUNIAO do evento (migracao 027);
 *   3. e admin do tenant do evento (a agenda inteira e dele);
 *   4. e membro ou mentor de alguma startup do publico do evento.
 *
 * O EVENTO DE UMA REUNIAO so vale pela forma 1 ou pela 2. Nem as startups nem
 * o papel de admin o levam ao Google de ninguem: a mentoria marcada com tres
 * pessoas vai para a agenda dessas tres. (Na TELA da Agenda o admin continua
 * vendo todas — ver listarPorTenant —, que e a visao da coordenacao, e nao o
 * compromisso dele.)
 *
 * @param {string} alias - Alias da tabela `evento` na consulta (ex.: "e").
 * @param {string} usuario - Expressao SQL do id do usuario: um placeholder
 *   ("$1") quando a pessoa e fixa, ou uma coluna ("gc.id_usuario") quando a
 *   consulta varre varias.
 */
function sqlUsuarioVeEvento(alias, usuario) {
  return `(
    ${alias}.criado_por = ${usuario}
    OR EXISTS (
      SELECT 1
        FROM reuniao rv
        JOIN reuniao_participante rvp ON rvp.id_reuniao = rv.id_reuniao
       WHERE rv.id_evento = ${alias}.id_evento
         AND rvp.id_usuario = ${usuario}
    )
    OR (
      NOT EXISTS (SELECT 1 FROM reuniao rv WHERE rv.id_evento = ${alias}.id_evento)
      AND (
        EXISTS (
          SELECT 1 FROM tenant_usuarios tu
           WHERE tu.id_tenant = ${alias}.id_tenant
             AND tu.id_usuario = ${usuario}
             AND tu.ativo = TRUE
             AND tu.papel = 'admin'
        )
        OR EXISTS (
          SELECT 1
            FROM startup s
           WHERE s.id_tenant = ${alias}.id_tenant
             AND s.status <> 'ENCERRADA'
             -- Direcionamento: sem linhas em evento_startups o evento e GERAL.
             AND (
               NOT EXISTS (SELECT 1 FROM evento_startups es WHERE es.id_evento = ${alias}.id_evento)
               OR EXISTS (
                 SELECT 1 FROM evento_startups es
                  WHERE es.id_evento = ${alias}.id_evento AND es.id_startup = s.id_startup
               )
             )
             AND (
               EXISTS (
                 SELECT 1 FROM startup_membros sm
                  WHERE sm.id_startup = s.id_startup
                    AND sm.id_usuario = ${usuario}
                    AND sm.ativo = TRUE
               )
               OR EXISTS (
                 SELECT 1 FROM mentor_startup ms
                  WHERE ms.id_startup = s.id_startup
                    AND ms.id_usuario_mentor = ${usuario}
               )
             )
        )
      )
    )
  )`
}

/**
 * Eventos futuros que uma pessoa enxerga, em TODOS os tenants dela.
 *
 * Sem id_tenant de proposito, ao contrario de listarPorTenant: quem participa
 * de duas incubadoras tem uma agenda no Google so, e separar por tenant aqui
 * obrigaria a chamar isto uma vez por vinculo e juntar em memoria.
 *
 * @param {number} idUsuario
 * @param {{desde?: string, ate?: string}} periodo
 */
async function listarVisiveisParaUsuario(idUsuario, { desde, ate } = {}) {
  const condicoes = ["e.ativo = TRUE", sqlUsuarioVeEvento("e", "$1")]
  const params = [idUsuario]

  if (desde) {
    params.push(desde)
    condicoes.push(`e.inicio_ts >= $${params.length}`)
  }
  if (ate) {
    params.push(ate)
    condicoes.push(`e.inicio_ts <= $${params.length}`)
  }

  const { rows } = await query(
    `${SELECT_EVENTO} WHERE ${condicoes.join(" AND ")} ORDER BY e.inicio_ts`,
    params
  )
  return rows
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

/**
 * Cria um novo evento.
 * @param {import('pg').PoolClient} [client] - para criar o evento na mesma
 *   transacao de quem depende dele (a reuniao, migracao 027).
 */
async function criar(dados, client) {
  const executor = client || { query }
  const {
    idTenant, titulo, descricao, categoria, local, idLocal, inicioTs, fimTs,
    idsStartups, idUsuarioMentor, mentorNome, anexos, vagas, obrigatorio, criadoPor,
  } = dados
  const { rows } = await executor.query(
    `INSERT INTO evento
       (id_tenant, titulo, descricao, categoria, local, id_local, inicio_ts, fim_ts,
        id_usuario_mentor, mentor_nome, anexos, vagas, obrigatorio, criado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING id_evento`,
    [
      idTenant, titulo, descricao ?? null, categoria, local ?? null, idLocal ?? null,
      inicioTs, fimTs ?? null,
      // Um ou outro, nunca os dois — ver o COALESCE em SELECT_EVENTO.
      idUsuarioMentor ?? null, mentorNome ?? null,
      JSON.stringify(anexos ?? []), vagas ?? null, obrigatorio ?? false, criadoPor,
    ]
  )
  const idEvento = rows[0].id_evento
  await definirStartups(idEvento, idsStartups, client)
  return buscarPorId(idEvento, client)
}

/**
 * Atualiza um evento existente.
 * @param {import('pg').PoolClient} [client] - ver criar().
 */
async function atualizar(id, dados, client) {
  const executor = client || { query }
  const {
    titulo, descricao, categoria, local, idLocal, inicioTs, fimTs,
    idsStartups, idUsuarioMentor, mentorNome, anexos, vagas, obrigatorio,
  } = dados
  const { rows } = await executor.query(
    `UPDATE evento
        SET titulo = $1, descricao = $2, categoria = $3, local = $4, id_local = $5,
            inicio_ts = $6, fim_ts = $7, id_usuario_mentor = $8, mentor_nome = $9,
            anexos = $10, vagas = $11, obrigatorio = $12, atualizado_ts = NOW()
      WHERE id_evento = $13 AND ativo = TRUE
      RETURNING id_evento`,
    [
      titulo, descricao ?? null, categoria, local ?? null, idLocal ?? null,
      inicioTs, fimTs ?? null,
      idUsuarioMentor ?? null, mentorNome ?? null,
      JSON.stringify(anexos ?? []), vagas ?? null, obrigatorio ?? false, id,
    ]
  )
  if (!rows[0]) return undefined
  await definirStartups(id, idsStartups, client)
  return buscarPorId(id, client)
}

/**
 * Remove (soft delete) um evento.
 * @param {import('pg').PoolClient} [client] - ver criar().
 */
async function excluir(id, client) {
  const executor = client || { query }
  const { rows } = await executor.query(
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
 * O PUBLICO de um conjunto de eventos: uma linha por (id_evento, id_usuario,
 * id_startup). E a UNICA definicao de "quem foi convidado" — a tela de
 * presenca, o resumo dela, o e-mail de evento novo e o relatorio de
 * engajamento leem daqui. Antes eram tres copias do mesmo criterio, cada uma
 * com o aviso de "mexeu aqui, mexa la".
 *
 * Duas regras, que nao se misturam:
 *   - EVENTO COMUM: os membros ativos das startups nao encerradas do tenant.
 *     Sem linhas em evento_startups o evento e GERAL (todas as startups); com
 *     linhas, so as listadas.
 *   - EVENTO DE REUNIAO (migracao 027): os convidados da reuniao, e so eles —
 *     uma mentoria com tres pessoas nao convoca a incubadora inteira.
 *     `id_startup` vem preenchido quando o convidado e membro da startup da
 *     reuniao, e NULL para quem nao e (o mentor, a coordenacao).
 *
 * @param {string} filtroEventos - condicao SQL sobre `ev` (a tabela evento)
 *   que escolhe os eventos. E repetida nas duas metades da uniao.
 * @returns {string} SQL de um SELECT (id_evento, id_usuario, id_startup).
 */
function sqlPublicoEventos(filtroEventos) {
  return `
    SELECT ev.id_evento, sm.id_usuario, s.id_startup
      FROM evento ev
      JOIN startup s
        ON s.id_tenant = ev.id_tenant AND s.status <> 'ENCERRADA'
      JOIN startup_membros sm
        ON sm.id_startup = s.id_startup AND sm.ativo = TRUE
     WHERE ${filtroEventos}
       AND NOT EXISTS (SELECT 1 FROM reuniao rpub WHERE rpub.id_evento = ev.id_evento)
       AND (
         NOT EXISTS (SELECT 1 FROM evento_startups es WHERE es.id_evento = ev.id_evento)
         OR EXISTS (
           SELECT 1 FROM evento_startups es
            WHERE es.id_evento = ev.id_evento AND es.id_startup = s.id_startup
         )
       )
    UNION ALL
    SELECT ev.id_evento, rpp.id_usuario, smr.id_startup
      FROM evento ev
      JOIN reuniao rpub ON rpub.id_evento = ev.id_evento
      JOIN reuniao_participante rpp ON rpp.id_reuniao = rpub.id_reuniao
      LEFT JOIN startup_membros smr
             ON smr.id_startup = rpub.id_startup
            AND smr.id_usuario = rpp.id_usuario
            AND smr.ativo = TRUE
     WHERE ${filtroEventos}
  `
}

/**
 * Quem foi convidado para um evento. O criterio e o de sqlPublicoEventos.
 *
 * Uma pessoa aparece UMA vez mesmo pertencendo a varias startups: a presenca e
 * por (evento, usuario), entao duas linhas seriam dois checkboxes editando o
 * mesmo registro. As startups dela vem agregadas em `startups` (vazio para o
 * convidado de reuniao que nao e de startup nenhuma).
 */
async function listarPublico(idEvento) {
  const { rows } = await query(
    `WITH publico AS (${sqlPublicoEventos("ev.id_evento = $1 AND ev.ativo = TRUE")})
     SELECT u.id_usuario, u.nome, u.email, u.foto_url,
            COALESCE(
              json_agg(json_build_object('id_startup', s.id_startup, 'nome', s.nome)
                       ORDER BY s.nome) FILTER (WHERE s.id_startup IS NOT NULL),
              '[]'
            ) AS startups,
            c.status                        AS confirmacao,
            p.presente,
            p.checkin_ts,
            mp.nome                         AS marcado_por_nome
       FROM publico pu
       JOIN usuarios u ON u.id_usuario = pu.id_usuario
       LEFT JOIN startup s ON s.id_startup = pu.id_startup
       LEFT JOIN evento_confirmacao c
              ON c.id_evento = pu.id_evento AND c.id_usuario = u.id_usuario
       LEFT JOIN evento_presenca p
              ON p.id_evento = pu.id_evento AND p.id_usuario = u.id_usuario
       LEFT JOIN usuarios mp ON mp.id_usuario = p.marcado_por
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
    `WITH publico AS (${sqlPublicoEventos(`
        ev.id_tenant = $1
        AND ev.ativo = TRUE
        AND ev.inicio_ts <= NOW()
        AND ev.inicio_ts >= NOW() - make_interval(days => $2)`)})
     SELECT ev.id_evento, ev.titulo, ev.categoria, ev.inicio_ts, ev.local,
            ev.obrigatorio,
            -- ::int porque COUNT devolve bigint, que o pg entrega como STRING:
            -- sem o cast a tela compara e soma texto ("10" < "9").
            COUNT(DISTINCT pu.id_usuario)::int                             AS publico,
            COUNT(DISTINCT pu.id_usuario) FILTER (WHERE p.id_usuario IS NOT NULL)::int AS marcados,
            COUNT(DISTINCT pu.id_usuario) FILTER (WHERE p.presente)::int   AS presentes
       FROM publico pu
       JOIN evento ev ON ev.id_evento = pu.id_evento
       LEFT JOIN evento_presenca p
              ON p.id_evento = ev.id_evento AND p.id_usuario = pu.id_usuario
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
  // Exportado para o googleAgendaRepository montar a pergunta inversa ("quem
  // recebe este evento?") com a MESMA regra de visibilidade.
  sqlUsuarioVeEvento,
  // Exportado para o relatorio de engajamento contar o MESMO publico que a
  // tela de presenca marca.
  sqlPublicoEventos,
  listarVisiveisParaUsuario,
  criar,
  atualizar,
  excluir,
  listarPublico,
  listarResumoPresenca,
  marcarPresenca,
  confirmarPresenca,
  listarParticipantes,
}
