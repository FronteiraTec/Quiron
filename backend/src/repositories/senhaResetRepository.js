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

/**
 * Cria um novo token de reset com validade de `expiraMin` minutos.
 *
 * O prazo e calculado pelo BANCO, nao pelo Node. expira_ts e um `timestamp
 * without time zone` e buscarValidoPorHash compara com NOW(): um Date vindo do
 * Node era gravado com a hora LOCAL do servidor (UTC-3) e comparado com a hora
 * do banco (UTC), entao o token ja nascia vencido e todo link de redefinicao
 * chegava invalido. Com NOW() dos dois lados, o relogio e o mesmo.
 */
async function criar(idUsuario, tokenHash, expiraMin) {
  const { rows } = await query(
    `INSERT INTO senha_reset (id_usuario, token_hash, expira_ts)
     VALUES ($1, $2, NOW() + make_interval(mins => $3))
     RETURNING id_reset`,
    [idUsuario, tokenHash, expiraMin]
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
