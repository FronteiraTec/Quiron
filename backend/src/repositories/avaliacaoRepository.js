/**
 * Repositorio de Avaliacoes (camada de acesso a dados).
 * Tabela relacionada: avaliacao (schema.sql).
 * O mentor/avaliador avalia uma entrega (APROVADO / REPROVADO / AJUSTE).
 */
const { query } = require("../config/db")

/** Lista as avaliacoes de uma entrega. */
async function listarPorEntrega(idEntrega) {
  const { rows } = await query(
    `SELECT id_avaliacao, id_avaliador, status, nota, comentario, criado_ts
     FROM avaliacao
     WHERE id_entrega = $1
     ORDER BY criado_ts DESC`,
    [idEntrega]
  )
  return rows
}

/** Cria uma nova avaliacao. */
async function criar(dados) {
  const { idEntrega, idAvaliador, status, nota, comentario } = dados
  const { rows } = await query(
    `INSERT INTO avaliacao (id_entrega, id_avaliador, status, nota, comentario)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id_avaliacao, status, nota, criado_ts`,
    [idEntrega, idAvaliador, status, nota, comentario]
  )
  return rows[0]
}

module.exports = { listarPorEntrega, criar }
