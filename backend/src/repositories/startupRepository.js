/**
 * Repositorio de Startups (camada de acesso a dados).
 * Tabelas relacionadas: startup, startup_membros, mentor_startup, startup_fase.
 */
const { query } = require("../config/db")

/**
 * Junta a fase atual (primeira fase ativa da trilha ainda nao aprovada) e a
 * contagem de fases totais/aprovadas a uma consulta na tabela startup.
 * Usado por listarPorTenant e buscarPorId para calcular o progresso na
 * trilha de incubacao sem precisar de uma coluna dedicada.
 */
const JOIN_PROGRESSO = `
  LEFT JOIN (
    SELECT id_tenant, COUNT(*) AS total_fases
      FROM fase
     WHERE ativa = TRUE
     GROUP BY id_tenant
  ) tf ON tf.id_tenant = s.id_tenant
  LEFT JOIN (
    SELECT id_startup, COUNT(*) AS fases_aprovadas
      FROM startup_fase
     WHERE status = 'APROVADA'
     GROUP BY id_startup
  ) sfok ON sfok.id_startup = s.id_startup
  LEFT JOIN LATERAL (
    SELECT f.nome
      FROM fase f
     WHERE f.id_tenant = s.id_tenant AND f.ativa = TRUE
       AND NOT EXISTS (
         SELECT 1 FROM startup_fase x
          WHERE x.id_startup = s.id_startup AND x.id_fase = f.id_fase AND x.status = 'APROVADA'
       )
     ORDER BY f.ordem
     LIMIT 1
  ) prox ON TRUE
`

/** Calcula o percentual de progresso (0-100) a partir das contagens de fases. */
function comProgresso(row) {
  const total = Number(row.total_fases) || 0
  const aprovadas = Number(row.fases_aprovadas) || 0
  return {
    ...row,
    total_fases: total,
    fases_aprovadas: aprovadas,
    fase_atual: row.fase_atual_nome || null,
    progresso_pct: total > 0 ? Math.round((aprovadas / total) * 100) : 0,
  }
}

/** Lista as startups de um tenant, com fase atual e progresso na trilha. */
async function listarPorTenant(idTenant) {
  const { rows } = await query(
    `SELECT s.id_startup, s.nome, s.cnpj, s.status, s.criado_ts,
            COALESCE(tf.total_fases, 0) AS total_fases,
            COALESCE(sfok.fases_aprovadas, 0) AS fases_aprovadas,
            prox.nome AS fase_atual_nome
       FROM startup s
       ${JOIN_PROGRESSO}
      WHERE s.id_tenant = $1
      ORDER BY s.nome`,
    [idTenant]
  )
  return rows.map(comProgresso)
}

/** Busca uma startup pelo id, com fase atual e progresso na trilha. */
async function buscarPorId(id) {
  const { rows } = await query(
    `SELECT s.*,
            COALESCE(tf.total_fases, 0) AS total_fases,
            COALESCE(sfok.fases_aprovadas, 0) AS fases_aprovadas,
            prox.nome AS fase_atual_nome
       FROM startup s
       ${JOIN_PROGRESSO}
      WHERE s.id_startup = $1`,
    [id]
  )
  return rows[0] && comProgresso(rows[0])
}

/** Atualiza os dados cadastrais (nome/cnpj) de uma startup. */
async function atualizar(id, { nome, cnpj }) {
  const { rows } = await query(
    `UPDATE startup SET nome = $2, cnpj = $3 WHERE id_startup = $1 RETURNING *`,
    [id, nome, cnpj]
  )
  return rows[0]
}

/** Altera o status (ATIVA/PAUSADA/ENCERRADA) de uma startup. */
async function atualizarStatus(id, status) {
  const { rows } = await query(
    `UPDATE startup SET status = $2 WHERE id_startup = $1 RETURNING *`,
    [id, status]
  )
  return rows[0]
}

/** Cria uma nova startup dentro de um tenant. */
async function criar({ idTenant, nome, cnpj }) {
  const { rows } = await query(
    `INSERT INTO startup (id_tenant, nome, cnpj)
     VALUES ($1, $2, $3)
     RETURNING id_startup, nome, cnpj, status, criado_ts`,
    [idTenant, nome, cnpj]
  )
  return rows[0]
}

/** Adiciona um membro (usuario) a uma startup. */
async function adicionarMembro(idStartup, idUsuario, lider = false) {
  const { rows } = await query(
    `INSERT INTO startup_membros (id_startup, id_usuario, lider)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [idStartup, idUsuario, lider]
  )
  return rows[0]
}

/** Lista os membros ativos de uma startup, com nome/email do usuario. */
async function listarMembros(idStartup) {
  const { rows } = await query(
    `SELECT u.id_usuario, u.nome, u.email, sm.lider, sm.ativo, sm.entrada_dt
       FROM startup_membros sm
       JOIN usuarios u ON u.id_usuario = sm.id_usuario
      WHERE sm.id_startup = $1 AND sm.ativo = TRUE
      ORDER BY sm.lider DESC, u.nome`,
    [idStartup]
  )
  return rows
}

/**
 * Lista os ids das startups (dentro de um tenant) as quais o usuario esta
 * ligado, seja como membro (startup_membros) ou como mentor (mentor_startup).
 * Usado para restringir a visibilidade de eventos direcionados.
 * @param {number} idTenant
 * @param {number} idUsuario
 * @returns {Promise<number[]>}
 */
async function listarIdsPorUsuario(idTenant, idUsuario) {
  const { rows } = await query(
    `SELECT DISTINCT s.id_startup
       FROM startup s
       LEFT JOIN startup_membros sm ON sm.id_startup = s.id_startup AND sm.id_usuario = $2 AND sm.ativo = TRUE
       LEFT JOIN mentor_startup ms ON ms.id_startup = s.id_startup AND ms.id_usuario_mentor = $2
      WHERE s.id_tenant = $1
        AND (sm.id_usuario IS NOT NULL OR ms.id_usuario_mentor IS NOT NULL)`,
    [idTenant, idUsuario]
  )
  return rows.map((r) => r.id_startup)
}

/**
 * Busca a startup (ativa) a qual o usuario logado pertence como membro,
 * dentro do tenant informado. Usada pela tela "Minha Startup".
 */
async function buscarStartupDoUsuario(idTenant, idUsuario) {
  const { rows } = await query(
    `SELECT s.id_startup, s.nome, s.cnpj, s.status, s.criado_ts, sm.lider
       FROM startup s
       JOIN startup_membros sm ON sm.id_startup = s.id_startup
      WHERE s.id_tenant = $1 AND sm.id_usuario = $2 AND sm.ativo = TRUE
      LIMIT 1`,
    [idTenant, idUsuario]
  )
  return rows[0]
}

/** Remove (desativa) um membro de uma startup. */
async function removerMembro(idStartup, idUsuario) {
  const { rows } = await query(
    `UPDATE startup_membros
        SET ativo = FALSE, saida_dt = NOW()
      WHERE id_startup = $1 AND id_usuario = $2 AND ativo = TRUE
      RETURNING *`,
    [idStartup, idUsuario]
  )
  return rows[0]
}

/** Lista as fases ja concluidas (aprovadas) de uma startup, em ordem da trilha. */
async function listarFasesConcluidas(idStartup) {
  const { rows } = await query(
    `SELECT sf.id_startup_fase, f.nome, f.descricao, f.ordem, sf.fim_ts, u.nome AS aprovado_por_nome
       FROM startup_fase sf
       JOIN fase f ON f.id_fase = sf.id_fase
       LEFT JOIN usuarios u ON u.id_usuario = sf.aprovado_por
      WHERE sf.id_startup = $1 AND sf.status = 'APROVADA'
      ORDER BY f.ordem`,
    [idStartup]
  )
  return rows
}

module.exports = {
  listarPorTenant,
  buscarPorId,
  criar,
  atualizar,
  atualizarStatus,
  adicionarMembro,
  listarMembros,
  listarIdsPorUsuario,
  buscarStartupDoUsuario,
  removerMembro,
  listarFasesConcluidas,
}
