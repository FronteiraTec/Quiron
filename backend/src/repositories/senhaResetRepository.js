/**
 * Repositorio de tokens de redefinicao de senha (camada de acesso a dados).
 * Tabela relacionada: senha_reset (schema.sql).
 * Guarda apenas o HASH do token, nunca o token puro.
 */
const { query } = require("../config/db")

/** Invalida (marca como usados) os tokens pendentes de um usuario. */
async function invalidarAnteriores(idUsuario) {
  await query(
    `UPDATE senha_reset SET usado = TRUE
     WHERE id_usuario = $1 AND usado = FALSE`,
    [idUsuario]
  )
}

/** Cria um novo token de reset. */
async function criar(idUsuario, tokenHash, expiraTs) {
  const { rows } = await query(
    `INSERT INTO senha_reset (id_usuario, token_hash, expira_ts)
     VALUES ($1, $2, $3)
     RETURNING id_reset`,
    [idUsuario, tokenHash, expiraTs]
  )
  return rows[0]
}

/** Busca um token valido (nao usado e nao expirado) pelo hash. */
async function buscarValidoPorHash(tokenHash) {
  const { rows } = await query(
    `SELECT id_reset, id_usuario
     FROM senha_reset
     WHERE token_hash = $1
       AND usado = FALSE
       AND expira_ts > NOW()`,
    [tokenHash]
  )
  return rows[0]
}

/** Marca um token como usado (apos a troca de senha). */
async function marcarUsado(idReset) {
  await query(`UPDATE senha_reset SET usado = TRUE WHERE id_reset = $1`, [idReset])
}

module.exports = { invalidarAnteriores, criar, buscarValidoPorHash, marcarUsado }
