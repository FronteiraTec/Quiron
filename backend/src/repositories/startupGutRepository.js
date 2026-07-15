/**
 * Repositorio da Matriz GUT (Gravidade, Urgencia, Tendencia) de uma startup.
 * Tabela: startup_gut.
 */
const { query } = require("../config/db")

/** Lista os itens GUT de uma startup, ordenados pela prioridade (G*U*T) decrescente. */
async function listar(idStartup) {
  const { rows } = await query(
    `SELECT id_gut, problema, gravidade, urgencia, tendencia,
            (gravidade * urgencia * tendencia) AS prioridade, criado_ts
       FROM startup_gut
      WHERE id_startup = $1
      ORDER BY prioridade DESC, criado_ts`,
    [idStartup]
  )
  return rows
}

/** Cria um item da matriz GUT. */
async function criar(idStartup, { problema, gravidade, urgencia, tendencia }) {
  const { rows } = await query(
    `INSERT INTO startup_gut (id_startup, problema, gravidade, urgencia, tendencia)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id_gut, problema, gravidade, urgencia, tendencia,
               (gravidade * urgencia * tendencia) AS prioridade, criado_ts`,
    [idStartup, problema, gravidade, urgencia, tendencia]
  )
  return rows[0]
}

/** Remove um item da matriz GUT. */
async function remover(idStartup, idGut) {
  const { rows } = await query(
    `DELETE FROM startup_gut WHERE id_gut = $1 AND id_startup = $2 RETURNING id_gut`,
    [idGut, idStartup]
  )
  return rows[0]
}

module.exports = { listar, criar, remover }
