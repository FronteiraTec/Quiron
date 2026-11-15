/**
 * Repositorio das REUNIOES POR VIDEO (migracao 027).
 * Tabelas: reuniao, reuniao_participante, reuniao_sessao.
 *
 * O titulo, o horario, a descricao e a categoria NAO moram aqui: toda reuniao
 * e um evento da Agenda, e esses campos sao lidos do `evento` pelo JOIN. O
 * evento e criado e editado pelo eventoRepository, na mesma transacao.
 *
 * DOIS RELOGIOS, e a consulta devolve cada um no seu formato:
 *   - `inicio_ts` / `fim_ts` sao do EVENTO: horario de parede da incubadora,
 *     sem fuso (ver frontend/src/utils/horaEvento.js). Saem como texto
 *     "AAAA-MM-DDTHH:mm:ss", sem "Z".
 *   - os `*_ts` da reuniao e das sessoes sao instantes em UTC. Saem com "Z".
 *
 * `segundos_para_inicio` compara os dois do jeito certo: converte o horario de
 * parede para instante no fuso da agenda (TZ_AGENDA) e subtrai o agora. E por
 * ele que o service decide se a sala ja abriu.
 */
const { query } = require("../config/db")
const { instante } = require("../crm/sql")

/**
 * O fuso da agenda, para converter o horario de parede em instante.
 *
 * Entra no SQL como literal (e nao como parametro) porque o mesmo SELECT e
 * usado por consultas com numeros de parametro diferentes. Por isso so passa
 * um nome de fuso bem formado — qualquer outra coisa cai no padrao.
 */
const FUSO = /^[A-Za-z][A-Za-z0-9_+\-/]{1,60}$/.test(process.env.TZ_AGENDA || "")
  ? process.env.TZ_AGENDA
  : "America/Sao_Paulo"

/** Horario de parede (TIMESTAMP sem fuso) -> "AAAA-MM-DDTHH:mm:ss". */
const parede = (coluna, alias) => `to_char(${coluna}, 'YYYY-MM-DD"T"HH24:MI:SS') AS ${alias}`

/** O que a reuniao precisa do evento, mais os nomes ja resolvidos. */
const SELECT_REUNIAO = `
  SELECT r.id_reuniao, r.id_tenant, r.id_evento, r.sala, r.status, r.gravar_audio,
         r.transcricao, r.transcricao_obs,
         r.id_startup, st.nome AS startup_nome, st.uuid AS startup_uuid,
         r.id_anfitriao, anf.nome AS anfitriao_nome, anf.foto_url AS anfitriao_foto,
         ${instante("r.iniciada_ts", "iniciada_ts")},
         ${instante("r.encerrada_ts", "encerrada_ts")},
         r.encerrada_por, enc.nome AS encerrada_por_nome,
         r.criado_por,
         ${instante("r.criado_ts", "criado_ts")},
         ${instante("r.atualizado_ts", "atualizado_ts")},
         e.titulo, e.descricao, e.categoria, e.ativo AS evento_ativo,
         cat.rotulo AS categoria_rotulo, cat.cor AS categoria_cor,
         ${parede("e.inicio_ts", "inicio_ts")},
         ${parede("e.fim_ts", "fim_ts")},
         EXTRACT(EPOCH FROM ((e.inicio_ts AT TIME ZONE '${FUSO}') - NOW()))::int AS segundos_para_inicio,
         (SELECT COUNT(*)::int FROM reuniao_participante p WHERE p.id_reuniao = r.id_reuniao)
           AS total_participantes,
         -- Quantos estao na sala agora: sessao aberta. Para a listagem dizer
         -- "3 na sala" sem abrir a reuniao.
         (SELECT COUNT(DISTINCT s.identidade_livekit)::int FROM reuniao_sessao s
           WHERE s.id_reuniao = r.id_reuniao AND s.saiu_ts IS NULL) AS na_sala
    FROM reuniao r
    JOIN evento e ON e.id_evento = r.id_evento
    LEFT JOIN evento_categoria cat ON cat.id_tenant = e.id_tenant AND cat.chave = e.categoria
    LEFT JOIN startup st ON st.id_startup = r.id_startup
    LEFT JOIN usuarios anf ON anf.id_usuario = r.id_anfitriao
    LEFT JOIN usuarios enc ON enc.id_usuario = r.encerrada_por
`

// ---------------------------------------------------------------------------
// LEITURA
// ---------------------------------------------------------------------------

/**
 * As reunioes de um tenant.
 *
 * @param {number} idTenant
 * @param {object} filtros
 * @param {number|null} filtros.doUsuario - so as reunioes em que esta pessoa e
 *   convidada (quem nao tem `reunioes.reunioes.visualizar`). null = todas.
 * @param {number|null} filtros.idUsuario - quem esta olhando, para `meu_papel`.
 * @param {string|null} filtros.de - horario de parede: inicio >= de.
 * @param {string|null} filtros.ate - horario de parede: inicio <= ate.
 * @param {string[]|null} filtros.status
 */
async function listarPorTenant(idTenant, { doUsuario = null, idUsuario = null, de = null, ate = null, status = null } = {}) {
  const params = [idTenant, idUsuario]
  const condicoes = ["r.id_tenant = $1"]

  if (doUsuario) {
    params.push(doUsuario)
    condicoes.push(`EXISTS (
      SELECT 1 FROM reuniao_participante pf
       WHERE pf.id_reuniao = r.id_reuniao AND pf.id_usuario = $${params.length}
    )`)
  }
  if (de) {
    params.push(de)
    condicoes.push(`e.inicio_ts >= $${params.length}::timestamp`)
  }
  if (ate) {
    params.push(ate)
    condicoes.push(`e.inicio_ts <= $${params.length}::timestamp`)
  }
  if (status?.length) {
    params.push(status)
    condicoes.push(`r.status = ANY($${params.length}::reuniaoStatus[])`)
  }

  // `inicio_ts` ja sai como texto "AAAA-MM-DDTHH:mm:ss", que ordena como data.
  const { rows } = await query(
    `SELECT base.*,
            (SELECT p.papel FROM reuniao_participante p
              WHERE p.id_reuniao = base.id_reuniao AND p.id_usuario = $2::int) AS meu_papel
       FROM (${SELECT_REUNIAO} WHERE ${condicoes.join(" AND ")}) base
      ORDER BY base.inicio_ts, base.id_reuniao`,
    params
  )
  return rows
}

async function buscarPorId(idReuniao) {
  const { rows } = await query(`${SELECT_REUNIAO} WHERE r.id_reuniao = $1`, [idReuniao])
  return rows[0]
}

/** A reuniao pelo nome da sala no LiveKit — o que o webhook traz. */
async function buscarPorSala(sala) {
  const { rows } = await query(`${SELECT_REUNIAO} WHERE r.sala = $1`, [sala])
  return rows[0]
}

/** A reuniao de um evento da Agenda. */
async function buscarPorEvento(idEvento) {
  const { rows } = await query(`${SELECT_REUNIAO} WHERE r.id_evento = $1`, [idEvento])
  return rows[0]
}

/**
 * Os convidados, o anfitriao primeiro.
 *
 * `na_sala` = tem sessao aberta agora. `papel_incubadora` e o papel da pessoa
 * na incubadora (admin/mentor/usuario), para a tela dizer quem e o mentor.
 */
async function listarParticipantes(idReuniao) {
  const { rows } = await query(
    `SELECT p.id_usuario, u.nome, u.email, u.foto_url, p.papel,
            tu.papel AS papel_incubadora,
            ${instante("p.consentiu_ts", "consentiu_ts")},
            ${instante("p.consentimento_revogado_ts", "consentimento_revogado_ts")},
            ${instante("p.convidado_ts", "convidado_ts")},
            EXISTS (
              SELECT 1 FROM reuniao_sessao s
               WHERE s.id_reuniao = p.id_reuniao AND s.id_usuario = p.id_usuario
                 AND s.saiu_ts IS NULL
            ) AS na_sala
       FROM reuniao_participante p
       JOIN usuarios u ON u.id_usuario = p.id_usuario
       LEFT JOIN tenant_usuarios tu
              ON tu.id_tenant = p.id_tenant AND tu.id_usuario = p.id_usuario
      WHERE p.id_reuniao = $1
      ORDER BY (p.papel = 'ANFITRIAO') DESC, u.nome`,
    [idReuniao]
  )
  return rows
}

/** O vinculo de uma pessoa com a reuniao, ou undefined se nao foi convidada. */
async function buscarParticipante(idReuniao, idUsuario) {
  if (!idReuniao || !idUsuario) return undefined
  const { rows } = await query(
    `SELECT id_tenant, id_reuniao, id_usuario, papel,
            ${instante("consentiu_ts", "consentiu_ts")},
            ${instante("consentimento_revogado_ts", "consentimento_revogado_ts")}
       FROM reuniao_participante
      WHERE id_reuniao = $1 AND id_usuario = $2`,
    [idReuniao, idUsuario]
  )
  return rows[0]
}

/**
 * Cada entrada e saida da sala, na ordem em que aconteceram.
 * `duracao_s` fica NULL enquanto a pessoa ainda esta na sala.
 */
async function listarSessoes(idReuniao) {
  const { rows } = await query(
    `SELECT s.id_sessao, s.id_usuario, u.nome, u.foto_url, s.identidade_livekit,
            ${instante("s.entrou_ts", "entrou_ts")},
            ${instante("s.saiu_ts", "saiu_ts")},
            EXTRACT(EPOCH FROM (s.saiu_ts - s.entrou_ts))::int AS duracao_s
       FROM reuniao_sessao s
       LEFT JOIN usuarios u ON u.id_usuario = s.id_usuario
      WHERE s.id_reuniao = $1
      ORDER BY s.entrou_ts, s.id_sessao`,
    [idReuniao]
  )
  return rows
}

// ---------------------------------------------------------------------------
// ESCRITA (dentro da transacao do service)
// ---------------------------------------------------------------------------

/**
 * Cria a linha da reuniao. O evento ja precisa existir (mesma transacao).
 * @returns {Promise<number>} id_reuniao
 */
async function criar({ idTenant, idEvento, idStartup, gravarAudio, idAnfitriao, criadoPor }, client) {
  const { rows } = await client.query(
    `INSERT INTO reuniao (id_tenant, id_evento, id_startup, gravar_audio, id_anfitriao, criado_por)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id_reuniao`,
    [idTenant, idEvento, idStartup ?? null, gravarAudio ?? true, idAnfitriao, criadoPor ?? null]
  )
  return rows[0].id_reuniao
}

/** O que e da reuniao e nao do evento: a startup e a gravacao. */
async function atualizar(idReuniao, { idStartup, gravarAudio }, client) {
  await client.query(
    `UPDATE reuniao
        SET id_startup = $2, gravar_audio = $3, atualizado_ts = NOW()
      WHERE id_reuniao = $1`,
    [idReuniao, idStartup ?? null, gravarAudio]
  )
}

/**
 * Deixa a lista de convidados exatamente como pedida, sem mexer em quem fica.
 *
 * Quem continua convidado NAO e reinserido: a linha dele guarda o
 * consentimento de gravacao (Etapa 4), e apagar e recriar o convite o perderia
 * em silencio. Por isso e um DELETE do que saiu mais um INSERT ... DO NOTHING
 * do que entrou, e nao "apaga tudo e grava de novo".
 *
 * O anfitriao nunca sai por aqui: ele e quem esta editando a lista.
 *
 * @returns {Promise<{adicionados: number[], removidos: number[]}>}
 */
async function definirParticipantes({ idTenant, idReuniao, idAnfitriao, idsConvidados, convidadoPor }, client) {
  const ids = [...new Set(idsConvidados.map(Number))].filter((id) => id !== Number(idAnfitriao))

  const { rows: removidos } = await client.query(
    `DELETE FROM reuniao_participante
      WHERE id_reuniao = $1 AND papel = 'PARTICIPANTE' AND NOT (id_usuario = ANY($2::int[]))
      RETURNING id_usuario`,
    [idReuniao, ids]
  )

  await client.query(
    `INSERT INTO reuniao_participante (id_tenant, id_reuniao, id_usuario, papel, convidado_por)
     VALUES ($1, $2, $3, 'ANFITRIAO', $4)
     ON CONFLICT (id_reuniao, id_usuario) DO UPDATE SET papel = 'ANFITRIAO'`,
    [idTenant, idReuniao, idAnfitriao, convidadoPor ?? null]
  )

  const { rows: adicionados } = ids.length
    ? await client.query(
        `INSERT INTO reuniao_participante (id_tenant, id_reuniao, id_usuario, papel, convidado_por)
         SELECT $1, $2, id_usuario, 'PARTICIPANTE', $4 FROM unnest($3::int[]) AS id_usuario
         ON CONFLICT (id_reuniao, id_usuario) DO NOTHING
         RETURNING id_usuario`,
        [idTenant, idReuniao, ids, convidadoPor ?? null]
      )
    : { rows: [] }

  return {
    adicionados: adicionados.map((l) => l.id_usuario),
    removidos: removidos.map((l) => l.id_usuario),
  }
}

/**
 * Encerra pelo botao. So a partir de AGENDADA ou EM_ANDAMENTO: encerrar duas
 * vezes (dois cliques, o botao e o webhook) nao reescreve quem encerrou.
 * @returns {Promise<boolean>} true se esta chamada encerrou.
 */
async function encerrar(idReuniao, idUsuario, client) {
  const executor = client || { query }
  const { rowCount } = await executor.query(
    `UPDATE reuniao
        SET status = 'ENCERRADA', encerrada_ts = NOW(), encerrada_por = $2, atualizado_ts = NOW()
      WHERE id_reuniao = $1 AND status IN ('AGENDADA', 'EM_ANDAMENTO')`,
    [idReuniao, idUsuario ?? null]
  )
  return rowCount > 0
}

/** Cancela uma reuniao que ainda nao comecou. */
async function cancelar(idReuniao, client) {
  const executor = client || { query }
  const { rowCount } = await executor.query(
    `UPDATE reuniao SET status = 'CANCELADA', atualizado_ts = NOW()
      WHERE id_reuniao = $1 AND status = 'AGENDADA'`,
    [idReuniao]
  )
  return rowCount > 0
}

/**
 * Apaga a reuniao (os convidados vao junto, em cascata). So enquanto
 * AGENDADA: depois que alguem entrou na sala, ha sessao para guardar.
 */
async function excluir(idReuniao, client) {
  const executor = client || { query }
  const { rowCount } = await executor.query(
    `DELETE FROM reuniao WHERE id_reuniao = $1 AND status = 'AGENDADA'`,
    [idReuniao]
  )
  return rowCount > 0
}

// ---------------------------------------------------------------------------
// WEBHOOK DO LIVEKIT
//
// Todo carimbo chega em milissegundos desde a epoca e vira UTC no banco. Cada
// funcao e idempotente: o LiveKit reenvia o que nao recebeu 200, e pode
// entregar fora de ordem.
// ---------------------------------------------------------------------------

const DE_MS = (param) => `(to_timestamp(${param}::double precision / 1000) AT TIME ZONE 'UTC')`

/** `room_started`: a sala abriu. Nao ressuscita reuniao encerrada. */
async function marcarIniciada(idReuniao, ms) {
  const { rowCount } = await query(
    `UPDATE reuniao
        SET status = 'EM_ANDAMENTO',
            iniciada_ts = COALESCE(iniciada_ts, ${DE_MS("$2")}),
            atualizado_ts = NOW()
      WHERE id_reuniao = $1 AND status IN ('AGENDADA', 'EM_ANDAMENTO')`,
    [idReuniao, ms]
  )
  return rowCount > 0
}

/**
 * `participant_joined`: abre a sessao. O reenvio do mesmo evento cai no
 * UNIQUE do sid e nao duplica.
 */
async function registrarEntrada({ idTenant, idReuniao, idUsuario, identidade, sid, ms }) {
  await query(
    `INSERT INTO reuniao_sessao
       (id_tenant, id_reuniao, id_usuario, identidade_livekit, sid_participante, entrou_ts)
     VALUES ($1, $2, $3, $4, $5, ${DE_MS("$6")})
     ON CONFLICT (sid_participante) DO NOTHING`,
    [idTenant, idReuniao, idUsuario ?? null, identidade, sid, ms]
  )
}

/**
 * `participant_left`: fecha a sessao. Se o `joined` ainda nao chegou (ou se
 * perdeu), cria a sessao ja fechada, com a entrada que o proprio evento traz.
 * Uma saida repetida nao move o horario de saida ja gravado.
 */
async function registrarSaida({ idTenant, idReuniao, idUsuario, identidade, sid, msEntrada, msSaida }) {
  await query(
    `INSERT INTO reuniao_sessao
       (id_tenant, id_reuniao, id_usuario, identidade_livekit, sid_participante, entrou_ts, saiu_ts)
     VALUES ($1, $2, $3, $4, $5,
             LEAST(${DE_MS("$6")}, ${DE_MS("$7")}),
             ${DE_MS("$7")})
     ON CONFLICT (sid_participante) DO UPDATE
        SET saiu_ts = GREATEST(reuniao_sessao.entrou_ts, EXCLUDED.saiu_ts)
      WHERE reuniao_sessao.saiu_ts IS NULL`,
    [idTenant, idReuniao, idUsuario ?? null, identidade, sid, msEntrada ?? msSaida, msSaida]
  )
}

/**
 * `room_finished`: a sala fechou (o botao, ou o ultimo saiu e o prazo de
 * espera venceu). Encerra a reuniao se ninguem tinha encerrado, e fecha as
 * sessoes que ficaram abertas — as saidas que o LiveKit nao chegou a mandar.
 * @returns {Promise<boolean>} true se a reuniao foi encerrada agora.
 */
async function marcarFinalizada(idReuniao, ms, client) {
  const executor = client || { query }
  const { rowCount } = await executor.query(
    `UPDATE reuniao
        SET status = 'ENCERRADA',
            encerrada_ts = COALESCE(encerrada_ts, ${DE_MS("$2")}),
            atualizado_ts = NOW()
      WHERE id_reuniao = $1 AND status IN ('AGENDADA', 'EM_ANDAMENTO')`,
    [idReuniao, ms]
  )
  await executor.query(
    `UPDATE reuniao_sessao
        SET saiu_ts = GREATEST(entrou_ts, ${DE_MS("$2")})
      WHERE id_reuniao = $1 AND saiu_ts IS NULL`,
    [idReuniao, ms]
  )
  return rowCount > 0
}

module.exports = {
  FUSO,
  listarPorTenant,
  buscarPorId,
  buscarPorSala,
  buscarPorEvento,
  listarParticipantes,
  buscarParticipante,
  listarSessoes,
  criar,
  atualizar,
  definirParticipantes,
  encerrar,
  cancelar,
  excluir,
  marcarIniciada,
  registrarEntrada,
  registrarSaida,
  marcarFinalizada,
}
