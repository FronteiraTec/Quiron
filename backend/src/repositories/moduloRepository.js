/**
 * Repositorio de Modulos (camada de acesso a dados).
 * Tabela relacionada: modulo (schema.sql). Um modulo pertence a uma fase.
 */
const { query } = require("../config/db")

/** Lista os modulos de uma fase, em ordem. */
async function listarPorFase(idFase) {
  const { rows } = await query(
    `SELECT id_modulo, nome, descricao, ordem, ativo
     FROM modulo
     WHERE id_fase = $1
     ORDER BY ordem`,
    [idFase]
  )
  return rows
}

/** Busca um modulo pelo id. */
async function buscarPorId(id) {
  const { rows } = await query(`SELECT * FROM modulo WHERE id_modulo = $1`, [id])
  return rows[0]
}

/** Cria um novo modulo. */
async function criar({ idFase, nome, descricao, ordem }) {
  const { rows } = await query(
    `INSERT INTO modulo (id_fase, nome, descricao, ordem)
     VALUES ($1, $2, $3, $4)
     RETURNING id_modulo, nome, ordem, ativo`,
    [idFase, nome, descricao, ordem]
  )
  return rows[0]
}

module.exports = { listarPorFase, buscarPorId, criar }
