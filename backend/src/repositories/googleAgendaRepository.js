/**
 * Repositorio da integracao com o Google Agenda.
 * Tabelas: google_conta, google_evento (migracao 013).
 *
 * CIFRAGEM MORA AQUI. As colunas de token guardam pacotes AES-256-GCM
 * (utils/cripto.js), e e este arquivo que cifra ao gravar e decifra ao ler —
 * o service so ve tokens em texto. A alternativa (cifrar no service) espalharia
 * a decisao por todos os pontos que tocam a tabela, e bastaria um esquecer para
 * gravar um refresh token em texto puro sem ninguem notar.
 */
const { query } = require("../config/db")
const { cifrar, decifrar } = require("../utils/cripto")
const { sqlUsuarioVeEvento } = require("./eventoRepository")

// Colunas da conexao, sem os tokens: e o que a TELA precisa. Manter separado
// evita que um endpoint de status devolva por descuido o que nunca deve sair
// do servidor.
const COLUNAS_PUBLICAS = `
  id_usuario, google_email, id_calendario, escopos, sincronizar,
  conectado_ts, ultimo_sync_ts, ultimo_erro
`

/** Traduz a linha do banco, decifrando os tokens. */
function daLinha(linha) {
  if (!linha) return undefined
  return {
    ...linha,
    refresh_token: decifrar(linha.refresh_token),
    access_token: decifrar(linha.access_token),
  }
}

// ---------------------------------------------------------------------------
// CONEXAO
// ---------------------------------------------------------------------------

/**
 * Grava a conexao recem-autorizada.
 *
 * UPSERT porque reconectar e comum (a pessoa troca de conta Google, ou a
 * autorizacao morreu e ela refaz). O id_calendario NAO e tocado aqui: quem o
 * define e definirCalendario, depois de decidir se aproveita o calendario
 * antigo ou cria outro — o que depende de a conta ser a mesma.
 */
async function salvarConta(dados) {
  const { idUsuario, googleSub, googleEmail, refreshToken, accessToken, expiraTs, escopos } = dados
  const { rows } = await query(
    `INSERT INTO google_conta
       (id_usuario, google_sub, google_email, refresh_token, access_token,
        access_token_expira_ts, escopos, sincronizar, conectado_ts, ultimo_erro)
     VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, NOW(), NULL)
     ON CONFLICT (id_usuario) DO UPDATE
        SET google_sub = EXCLUDED.google_sub,
            google_email = EXCLUDED.google_email,
            refresh_token = EXCLUDED.refresh_token,
            access_token = EXCLUDED.access_token,
            access_token_expira_ts = EXCLUDED.access_token_expira_ts,
            escopos = EXCLUDED.escopos,
            sincronizar = TRUE,
            conectado_ts = NOW(),
            ultimo_erro = NULL
     RETURNING *`,
    [
      idUsuario,
      googleSub,
      googleEmail ?? null,
      cifrar(refreshToken),
      cifrar(accessToken),
      expiraTs ?? null,
      escopos ?? null,
    ]
  )
  return daLinha(rows[0])
}

/** Conexao completa (com tokens em texto) — uso interno do service. */
async function buscarConta(idUsuario) {
  const { rows } = await query(`SELECT * FROM google_conta WHERE id_usuario = $1`, [idUsuario])
  return daLinha(rows[0])
}

/** O que a tela pode ver: sem token nenhum. */
async function buscarStatus(idUsuario) {
  const { rows } = await query(
    `SELECT ${COLUNAS_PUBLICAS} FROM google_conta WHERE id_usuario = $1`,
    [idUsuario]
  )
  return rows[0]
}

/** Guarda o access token renovado (o refresh token nao muda no refresh). */
async function atualizarAccessToken(idUsuario, accessToken, expiraTs) {
  await query(
    `UPDATE google_conta
        SET access_token = $2, access_token_expira_ts = $3
      WHERE id_usuario = $1`,
    [idUsuario, cifrar(accessToken), expiraTs]
  )
}

/** Aponta a conexao para a agenda secundaria criada na conta da pessoa. */
async function definirCalendario(idUsuario, idCalendario) {
  await query(`UPDATE google_conta SET id_calendario = $2 WHERE id_usuario = $1`, [
    idUsuario,
    idCalendario,
  ])
}

/** Liga/desliga o envio sem revogar a autorizacao. */
async function definirSincronizar(idUsuario, ativo) {
  const { rows } = await query(
    `UPDATE google_conta SET sincronizar = $2 WHERE id_usuario = $1
     RETURNING ${COLUNAS_PUBLICAS}`,
    [idUsuario, ativo]
  )
  return rows[0]
}

/**
 * Marca o resultado da ultima tentativa de envio.
 *
 * `ultimo_sync_ts` so avanca quando deu certo: ele responde "ate quando a
 * agenda esta em dia?", e mover a data numa falha faria a tela dizer que
 * sincronizou agora mesmo enquanto exibe o erro ao lado.
 */
async function registrarSync(idUsuario, erro = null) {
  await query(
    `UPDATE google_conta
        SET ultimo_sync_ts = CASE WHEN $2::text IS NULL THEN NOW() ELSE ultimo_sync_ts END,
            ultimo_erro = $2
      WHERE id_usuario = $1`,
    [idUsuario, erro]
  )
}

/**
 * Apaga a conexao. As linhas de google_evento vao junto (ON DELETE CASCADE):
 * sem token, o espelho nao serve para mais nada.
 */
async function removerConta(idUsuario) {
  await query(`DELETE FROM google_conta WHERE id_usuario = $1`, [idUsuario])
}

/**
 * Quem deve receber ESTE evento na agenda do Google.
 *
 * A pergunta inversa da agenda: la o usuario e fixo e os eventos variam, aqui
 * o evento e fixo e as pessoas variam. A regra de visibilidade e literalmente
 * a mesma — vem de sqlUsuarioVeEvento, no eventoRepository.
 *
 * Filtra por `sincronizar` e por `id_calendario IS NOT NULL`: conexao pausada
 * nao recebe, e conexao sem calendario e uma autorizacao que nao chegou ao fim
 * (a criacao da agenda falhou), entao nao ha onde escrever.
 */
async function listarContasDoPublico(idEvento) {
  const { rows } = await query(
    `SELECT gc.*
       FROM google_conta gc
       JOIN evento ev ON ev.id_evento = $1
      WHERE gc.sincronizar = TRUE
        AND gc.id_calendario IS NOT NULL
        AND ${sqlUsuarioVeEvento("ev", "gc.id_usuario")}`,
    [idEvento]
  )
  return rows.map(daLinha)
}

// ---------------------------------------------------------------------------
// ESPELHO evento do Quiron <-> evento no Google
// ---------------------------------------------------------------------------

/** O que ja foi enviado deste evento para esta pessoa (se e que foi). */
async function buscarEspelho(idEvento, idUsuario) {
  const { rows } = await query(
    `SELECT * FROM google_evento WHERE id_evento = $1 AND id_usuario = $2`,
    [idEvento, idUsuario]
  )
  return rows[0]
}

/** Todos os espelhos de um evento — a lista a apagar quando ele e excluido. */
async function listarEspelhosDoEvento(idEvento) {
  const { rows } = await query(
    `SELECT ge.*, gc.id_usuario
       FROM google_evento ge
       JOIN google_conta gc ON gc.id_usuario = ge.id_usuario
      WHERE ge.id_evento = $1`,
    [idEvento]
  )
  return rows
}

/**
 * Espelhos de gente que NAO enxerga mais o evento.
 *
 * Editar um evento pode tirar startups do direcionamento: quem estava no
 * publico e saiu ficaria com o compromisso na agenda para sempre, porque a
 * atualizacao so alcanca quem continua dentro. Esta consulta e a lista do que
 * precisa ser apagado no Google.
 *
 * Repare que ela ignora `sincronizar`: pausar o envio nao pode virar faxina na
 * agenda de ninguem. Quem pausou apenas nao recebe novidades — o que ja esta la
 * so sai quando a pessoa deixa mesmo de ser publico (ou desconecta, e ai o
 * calendario inteiro vai embora).
 */
async function listarEspelhosForaDoPublico(idEvento) {
  const { rows } = await query(
    `SELECT ge.*
       FROM google_evento ge
       JOIN google_conta gc ON gc.id_usuario = ge.id_usuario
       JOIN evento ev ON ev.id_evento = ge.id_evento
      WHERE ge.id_evento = $1
        AND NOT ${sqlUsuarioVeEvento("ev", "gc.id_usuario")}`,
    [idEvento]
  )
  return rows
}

/** Registra (ou reaponta) o evento criado no Google. */
async function salvarEspelho(idEvento, idUsuario, googleEventId, idCalendario) {
  await query(
    `INSERT INTO google_evento (id_evento, id_usuario, google_event_id, id_calendario)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id_evento, id_usuario) DO UPDATE
        SET google_event_id = EXCLUDED.google_event_id,
            id_calendario = EXCLUDED.id_calendario,
            enviado_ts = NOW()`,
    [idEvento, idUsuario, googleEventId, idCalendario]
  )
}

/**
 * Esquece um espelho.
 *
 * Chamado tanto depois de apagar o evento la quanto quando o Google responde
 * 404/410 — se o evento nao existe mais (a pessoa apagou na mao), a linha aqui
 * so faria o proximo sync tentar atualizar um fantasma para sempre.
 */
async function removerEspelho(idEvento, idUsuario) {
  await query(`DELETE FROM google_evento WHERE id_evento = $1 AND id_usuario = $2`, [
    idEvento,
    idUsuario,
  ])
}

module.exports = {
  salvarConta,
  buscarConta,
  buscarStatus,
  atualizarAccessToken,
  definirCalendario,
  definirSincronizar,
  registrarSync,
  removerConta,
  listarContasDoPublico,
  buscarEspelho,
  listarEspelhosDoEvento,
  listarEspelhosForaDoPublico,
  salvarEspelho,
  removerEspelho,
}
