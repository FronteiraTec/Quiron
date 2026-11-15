/**
 * Repositorio da GRAVACAO E TRANSCRICAO das reunioes (migracao 028).
 * Tabelas: reuniao_audio, reuniao_trecho; e o consentimento, que mora em
 * reuniao_participante (027); e reuniao.transcricao.
 *
 * Os `*_ts` sao instantes em UTC e saem com "Z" (como na 027). O horario de
 * cada trecho e calculado NO BANCO — inicio da gravacao + deslocamento —, para
 * nao depender do fuso do processo Node.
 */
const { query } = require("../config/db")
const { instante } = require("../crm/sql")

const executor = (client) => client || { query }

const SELECT_AUDIO = `
  SELECT a.id_audio, a.id_tenant, a.id_reuniao, a.id_usuario, u.nome AS usuario_nome,
         a.status, a.mime, a.partes, a.ultima_parte, a.tamanho_bytes::bigint AS tamanho_bytes, a.erro,
         ${instante("a.inicio_ts", "inicio_ts")},
         ${instante("a.ultima_parte_ts", "ultima_parte_ts")},
         ${instante("a.fim_ts", "fim_ts")},
         ${instante("a.transcrito_ts", "transcrito_ts")},
         ${instante("a.excluido_ts", "excluido_ts")},
         EXTRACT(EPOCH FROM (COALESCE(a.fim_ts, a.ultima_parte_ts, a.inicio_ts) - a.inicio_ts))::int AS duracao_s
    FROM reuniao_audio a
    JOIN usuarios u ON u.id_usuario = a.id_usuario
`

// ---------------------------------------------------------------------------
// CONSENTIMENTO
//
//   consentiu_ts preenchido e revogado vazio  -> grava a fala
//   consentiu_ts vazio e revogado preenchido  -> recusou (sem nunca aceitar)
//   os dois preenchidos                       -> aceitou e depois retirou
//   os dois vazios                            -> ainda nao respondeu
// ---------------------------------------------------------------------------

/**
 * Aceita ou recusa/retira. Aceitar de novo zera a retirada.
 * @returns {Promise<object|undefined>} a linha do participante, ou undefined.
 */
async function definirConsentimento(idReuniao, idUsuario, aceito) {
  const sql = aceito
    ? `UPDATE reuniao_participante
          SET consentiu_ts = NOW(), consentimento_revogado_ts = NULL
        WHERE id_reuniao = $1 AND id_usuario = $2
        RETURNING id_reuniao`
    : `UPDATE reuniao_participante
          SET consentimento_revogado_ts = NOW()
        WHERE id_reuniao = $1 AND id_usuario = $2
        RETURNING id_reuniao`
  const { rowCount } = await query(sql, [idReuniao, idUsuario])
  return rowCount > 0
}

// ---------------------------------------------------------------------------
// GRAVACOES
// ---------------------------------------------------------------------------

/**
 * Fecha as gravacoes que esta pessoa deixou abertas nesta reuniao. Abrir uma
 * nova (reconexao, troca de microfone, pagina recarregada) encerra a anterior
 * pelo ultimo pedaco recebido. Sem nenhum pedaco, ela nao tem o que guardar.
 */
async function fecharAbertasDoUsuario(idReuniao, idUsuario, client) {
  await executor(client).query(
    `UPDATE reuniao_audio
        SET status = CASE WHEN partes > 0 THEN 'DISPONIVEL'::reuniaoAudioStatus ELSE 'EXCLUIDO'::reuniaoAudioStatus END,
            fim_ts = COALESCE(ultima_parte_ts, inicio_ts),
            excluido_ts = CASE WHEN partes > 0 THEN NULL ELSE NOW() END
      WHERE id_reuniao = $1 AND id_usuario = $2 AND status = 'GRAVANDO'`,
    [idReuniao, idUsuario]
  )
}

/** Abre uma gravacao. O `inicio_ts` e o relogio do servidor. */
async function criarAudio({ idTenant, idReuniao, idUsuario, mime }, client) {
  const { rows } = await executor(client).query(
    `INSERT INTO reuniao_audio (id_tenant, id_reuniao, id_usuario, mime)
     VALUES ($1, $2, $3, $4)
     RETURNING id_audio`,
    [idTenant, idReuniao, idUsuario, mime]
  )
  return rows[0].id_audio
}

/** Quantas gravacoes esta pessoa ja abriu nesta reuniao (teto contra abuso). */
async function contarDoUsuario(idReuniao, idUsuario) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS n FROM reuniao_audio WHERE id_reuniao = $1 AND id_usuario = $2`,
    [idReuniao, idUsuario]
  )
  return rows[0].n
}

async function buscarAudio(idAudio) {
  const { rows } = await query(`${SELECT_AUDIO} WHERE a.id_audio = $1`, [idAudio])
  return rows[0]
}

/** O placar de um pedaco novo. So chamado quando o arquivo foi criado agora. */
async function registrarParte(idAudio, n, bytes) {
  await query(
    `UPDATE reuniao_audio
        SET partes = partes + 1,
            ultima_parte = GREATEST(COALESCE(ultima_parte, -1), $2),
            tamanho_bytes = tamanho_bytes + $3,
            ultima_parte_ts = NOW()
      WHERE id_audio = $1`,
    [idAudio, n, bytes]
  )
}

/**
 * Guarda o primeiro problema da gravacao (ex.: o disco encheu). Os seguintes
 * nao sobrescrevem: o que interessa na transcricao e quando comecou.
 */
async function anotarErro(idAudio, texto) {
  await query(`UPDATE reuniao_audio SET erro = $2 WHERE id_audio = $1 AND erro IS NULL`, [idAudio, texto])
}

/**
 * O navegador terminou de mandar. Idempotente: so mexe em GRAVANDO.
 * @returns {Promise<boolean>} true se fechou agora.
 */
async function fecharAudio(idAudio) {
  const { rowCount } = await query(
    `UPDATE reuniao_audio
        SET status = CASE WHEN partes > 0 THEN 'DISPONIVEL'::reuniaoAudioStatus ELSE 'EXCLUIDO'::reuniaoAudioStatus END,
            fim_ts = GREATEST(inicio_ts, COALESCE(ultima_parte_ts, NOW())),
            excluido_ts = CASE WHEN partes > 0 THEN NULL ELSE NOW() END
      WHERE id_audio = $1 AND status = 'GRAVANDO'`,
    [idAudio]
  )
  return rowCount > 0
}

/** As gravacoes de uma reuniao, na ordem em que foram abertas. */
async function listarAudios(idReuniao, { status } = {}) {
  const params = [idReuniao]
  let filtro = ""
  if (status?.length) {
    params.push(status)
    filtro = ` AND a.status = ANY($2::reuniaoAudioStatus[])`
  }
  const { rows } = await query(`${SELECT_AUDIO} WHERE a.id_reuniao = $1${filtro} ORDER BY a.inicio_ts, a.id_audio`, params)
  return rows
}

/** Ha alguma gravacao com audio nesta reuniao? */
async function temGravacao(idReuniao, client) {
  const { rows } = await executor(client).query(
    `SELECT EXISTS (SELECT 1 FROM reuniao_audio WHERE id_reuniao = $1 AND (partes > 0 OR status = 'GRAVANDO')) AS tem`,
    [idReuniao]
  )
  return rows[0].tem
}

/**
 * O lote fecha o que o navegador deixou aberto (a aba fechou de repente), pelo
 * ultimo pedaco recebido. Sem pedaco nenhum, a fala dessa pessoa nao chegou —
 * e isso entra na observacao da transcricao.
 */
async function fecharAbandonadas(idReuniao, client) {
  await executor(client).query(
    `UPDATE reuniao_audio
        SET status = CASE WHEN partes > 0 THEN 'DISPONIVEL'::reuniaoAudioStatus ELSE 'FALHOU'::reuniaoAudioStatus END,
            fim_ts = COALESCE(ultima_parte_ts, inicio_ts),
            erro = CASE WHEN partes > 0 THEN erro ELSE COALESCE(erro, 'nenhum pedaço da gravação chegou ao servidor') END
      WHERE id_reuniao = $1 AND status = 'GRAVANDO'`,
    [idReuniao]
  )
}

/** Muda o status de uma gravacao (lote e faxina). */
async function marcarAudio(idAudio, status, { erro } = {}) {
  await query(
    `UPDATE reuniao_audio
        SET status = $2::reuniaoAudioStatus,
            erro = COALESCE($3, erro),
            transcrito_ts = CASE WHEN $2 = 'TRANSCRITO' THEN NOW() ELSE transcrito_ts END,
            excluido_ts = CASE WHEN $2 = 'EXCLUIDO' THEN NOW() ELSE excluido_ts END
      WHERE id_audio = $1`,
    [idAudio, status, erro ?? null]
  )
}

/**
 * Para reprocessar: o que ainda tem audio no disco volta a DISPONIVEL. O que
 * ja foi apagado nao volta (nao ha mais o que transcrever).
 * @returns {Promise<number>} quantas gravacoes voltaram.
 */
async function reabrirParaTranscrever(idReuniao, client) {
  const { rowCount } = await executor(client).query(
    `UPDATE reuniao_audio
        SET status = 'DISPONIVEL', erro = NULL, transcrito_ts = NULL
      WHERE id_reuniao = $1 AND status IN ('DISPONIVEL', 'TRANSCRITO', 'FALHOU') AND partes > 0`,
    [idReuniao]
  )
  return rowCount
}

// ---------------------------------------------------------------------------
// TRECHOS
// ---------------------------------------------------------------------------

/**
 * Troca os trechos de uma gravacao pelos novos e a marca TRANSCRITO, numa
 * transacao: reprocessar substitui, nao duplica.
 *
 * @param {object} audio - a linha de reuniao_audio.
 * @param {Array<{texto: string, inicioMs: number, fimMs: number, confianca: number|null}>} trechos
 * @param {string} origem - ex. 'OPENAI:whisper-1'.
 */
async function gravarTranscricaoDoAudio(audio, trechos, origem, client) {
  await client.query(`DELETE FROM reuniao_trecho WHERE id_audio = $1`, [audio.id_audio])
  if (trechos.length) {
    await client.query(
      `INSERT INTO reuniao_trecho
         (id_tenant, id_reuniao, id_audio, id_usuario, ordem, texto, inicio_ts, fim_ts, origem, confianca)
       SELECT a.id_tenant, a.id_reuniao, a.id_audio, a.id_usuario, t.ordem, t.texto,
              a.inicio_ts + make_interval(secs => t.inicio_ms / 1000.0),
              a.inicio_ts + make_interval(secs => GREATEST(t.fim_ms, t.inicio_ms) / 1000.0),
              $2, t.confianca
         FROM reuniao_audio a,
              unnest($3::int[], $4::text[], $5::bigint[], $6::bigint[], $7::real[])
                AS t(ordem, texto, inicio_ms, fim_ms, confianca)
        WHERE a.id_audio = $1`,
      [
        audio.id_audio,
        origem,
        trechos.map((_, i) => i),
        trechos.map((t) => t.texto),
        trechos.map((t) => Math.max(0, Math.round(t.inicioMs))),
        trechos.map((t) => Math.max(0, Math.round(t.fimMs))),
        trechos.map((t) => (Number.isFinite(t.confianca) ? t.confianca : null)),
      ]
    )
  }
  await client.query(
    `UPDATE reuniao_audio SET status = 'TRANSCRITO', transcrito_ts = NOW() WHERE id_audio = $1`,
    [audio.id_audio]
  )
}

/** A transcricao inteira de uma reuniao, na ordem do tempo. */
async function listarTrechos(idReuniao) {
  const { rows } = await query(
    `SELECT t.id_trecho, t.id_usuario, u.nome, u.foto_url, t.texto,
            ${instante("t.inicio_ts", "inicio_ts")},
            ${instante("t.fim_ts", "fim_ts")},
            t.origem
       FROM reuniao_trecho t
       JOIN usuarios u ON u.id_usuario = t.id_usuario
      WHERE t.id_reuniao = $1
      ORDER BY t.inicio_ts, t.id_trecho`,
    [idReuniao]
  )
  return rows
}

/** Os trechos crus, para a deduplicacao do eco. */
async function trechosParaEco(idReuniao, client) {
  const { rows } = await executor(client).query(
    `SELECT id_trecho, id_usuario, texto, confianca,
            EXTRACT(EPOCH FROM inicio_ts) * 1000 AS inicio_ms,
            EXTRACT(EPOCH FROM fim_ts) * 1000 AS fim_ms
       FROM reuniao_trecho WHERE id_reuniao = $1
      ORDER BY inicio_ts, id_trecho`,
    [idReuniao]
  )
  return rows.map((r) => ({ ...r, inicio_ms: Number(r.inicio_ms), fim_ms: Number(r.fim_ms) }))
}

async function apagarTrechos(ids, client) {
  if (!ids.length) return 0
  const { rowCount } = await executor(client).query(`DELETE FROM reuniao_trecho WHERE id_trecho = ANY($1::bigint[])`, [ids])
  return rowCount
}

// ---------------------------------------------------------------------------
// ESTADO DA TRANSCRICAO NA REUNIAO
// ---------------------------------------------------------------------------

async function definirTranscricao(idReuniao, status, obs, client) {
  await executor(client).query(
    `UPDATE reuniao SET transcricao = $2::reuniaoTranscricao, transcricao_obs = $3, atualizado_ts = NOW()
      WHERE id_reuniao = $1`,
    [idReuniao, status, obs ?? null]
  )
}

// ---------------------------------------------------------------------------
// FAXINA
// ---------------------------------------------------------------------------

/**
 * Gravacoes transcritas cujo audio ja pode sair do disco, pela retencao de
 * cada incubadora (0 dias = logo depois de transcrever).
 */
async function audiosParaApagar() {
  const { rows } = await query(
    `SELECT a.id_audio, a.id_tenant, a.id_reuniao, a.id_usuario
       FROM reuniao_audio a
       JOIN tenant t ON t.id_tenant = a.id_tenant
      WHERE a.status = 'TRANSCRITO'
        AND a.transcrito_ts <= NOW() - make_interval(days => t.reuniao_retencao_audio_dias)`
  )
  return rows
}

/**
 * As reunioes cuja transcricao venceu a retencao da incubadora (contada do
 * encerramento), e que ainda tem trecho guardado.
 */
async function reunioesComTranscricaoVencida() {
  const { rows } = await query(
    `SELECT r.id_reuniao, r.id_tenant, t.reuniao_retencao_transcricao_dias AS dias,
            (SELECT COUNT(*)::int FROM reuniao_trecho x WHERE x.id_reuniao = r.id_reuniao) AS trechos
       FROM reuniao r
       JOIN tenant t ON t.id_tenant = r.id_tenant
      WHERE r.encerrada_ts IS NOT NULL
        AND r.encerrada_ts <= NOW() - make_interval(days => t.reuniao_retencao_transcricao_dias)
        AND EXISTS (SELECT 1 FROM reuniao_trecho x WHERE x.id_reuniao = r.id_reuniao)`
  )
  return rows
}

/**
 * Reunioes que ficaram ABERTAS sem ninguem (todos fecharam a aba e o
 * `room_finished` se perdeu): tem gravacao, e nenhum pedaco chega ha mais de
 * `horas`. O lote as encerra para a transcricao poder acontecer.
 */
async function reunioesEsquecidas(horas = 1) {
  const { rows } = await query(
    `SELECT r.id_reuniao
       FROM reuniao r
      WHERE r.status IN ('AGENDADA', 'EM_ANDAMENTO')
        AND EXISTS (SELECT 1 FROM reuniao_audio a WHERE a.id_reuniao = r.id_reuniao)
        AND (SELECT MAX(COALESCE(a.ultima_parte_ts, a.inicio_ts)) FROM reuniao_audio a WHERE a.id_reuniao = r.id_reuniao)
            < NOW() - make_interval(hours => $1)
        AND NOT EXISTS (SELECT 1 FROM reuniao_sessao s WHERE s.id_reuniao = r.id_reuniao AND s.saiu_ts IS NULL
                          AND s.entrou_ts > NOW() - make_interval(hours => $1))`,
    [horas]
  )
  return rows.map((r) => r.id_reuniao)
}

async function apagarTrechosDaReuniao(idReuniao, client) {
  const { rowCount } = await executor(client).query(`DELETE FROM reuniao_trecho WHERE id_reuniao = $1`, [idReuniao])
  return rowCount
}

module.exports = {
  definirConsentimento,
  fecharAbertasDoUsuario,
  criarAudio,
  contarDoUsuario,
  buscarAudio,
  registrarParte,
  anotarErro,
  fecharAudio,
  listarAudios,
  temGravacao,
  fecharAbandonadas,
  marcarAudio,
  reabrirParaTranscrever,
  gravarTranscricaoDoAudio,
  listarTrechos,
  trechosParaEco,
  apagarTrechos,
  definirTranscricao,
  audiosParaApagar,
  reunioesComTranscricaoVencida,
  reunioesEsquecidas,
  apagarTrechosDaReuniao,
}
