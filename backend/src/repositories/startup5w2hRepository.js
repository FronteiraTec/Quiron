/**
 * Repositorio do plano de acao 5W2H de uma startup.
 * Tabela: startup_5w2h.
 */
const { query } = require("../config/db")

/** Lista os itens 5W2H de uma startup. */
async function listar(idStartup) {
  const { rows } = await query(
    `SELECT id_5w2h, o_que, por_que, onde, quando, quem, como, quanto_custa, criado_ts
       FROM startup_5w2h
      WHERE id_startup = $1
      ORDER BY criado_ts`,
    [idStartup]
  )
  return rows
}

/** Cria um item 5W2H. */
async function criar(idStartup, { oQue, porQue, onde, quando, quem, como, quantoCusta }) {
  const { rows } = await query(
    `INSERT INTO startup_5w2h (id_startup, o_que, por_que, onde, quando, quem, como, quanto_custa)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id_5w2h, o_que, por_que, onde, quando, quem, como, quanto_custa, criado_ts`,
    [idStartup, oQue, porQue, onde, quando, quem, como, quantoCusta]
  )
  return rows[0]
}

/** Remove um item 5W2H. */
async function remover(idStartup, id5w2h) {
  const { rows } = await query(
    `DELETE FROM startup_5w2h WHERE id_5w2h = $1 AND id_startup = $2 RETURNING id_5w2h`,
    [id5w2h, idStartup]
  )
  return rows[0]
}

module.exports = { listar, criar, remover }
