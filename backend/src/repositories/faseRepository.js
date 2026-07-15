/**
 * Repositorio de Fases (camada de acesso a dados).
 * Tabelas relacionadas: fase, startup_fase (schema.sql).
 * A fase pertence a um tenant e organiza a trilha da incubadora.
 */
const { query } = require("../config/db")

/** Lista as fases de um tenant, em ordem. */
async function listarPorTenant(idTenant) {
  const { rows } = await query(
    `SELECT id_fase, nome, descricao, ordem, ativa
     FROM fase
     WHERE id_tenant = $1
     ORDER BY ordem`,
    [idTenant]
  )
  return rows
}

/** Busca uma fase pelo id. */
async function buscarPorId(id) {
  const { rows } = await query(`SELECT * FROM fase WHERE id_fase = $1`, [id])
  return rows[0]
}

/** Cria uma nova fase. */
async function criar({ idTenant, nome, descricao, ordem }) {
  const { rows } = await query(
    `INSERT INTO fase (id_tenant, nome, descricao, ordem)
     VALUES ($1, $2, $3, $4)
     RETURNING id_fase, nome, ordem, ativa`,
    [idTenant, nome, descricao, ordem]
  )
  return rows[0]
}

module.exports = { listarPorTenant, buscarPorId, criar }
