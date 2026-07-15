/**
 * Repositorio de Audit Log (camada de acesso a dados).
 * Tabela relacionada: audit_log (schema.sql).
 * Registra acoes relevantes dos usuarios para auditoria.
 */
const { query } = require("../config/db")

/** Registra uma acao no log de auditoria. */
async function registrar(dados) {
  const {
    idTenant,
    idUsuario,
    acao,
    entidade,
    entidadeId,
    descricao,
    dadosAntes,
    dadosDepois,
  } = dados

  const { rows } = await query(
    `INSERT INTO audit_log
       (id_tenant, id_usuario, acao, entidade, entidade_id, descricao, dados_antes, dados_depois)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id_log, criado_ts`,
    [
      idTenant,
      idUsuario,
      acao,
      entidade,
      entidadeId,
      descricao,
      dadosAntes ? JSON.stringify(dadosAntes) : null,
      dadosDepois ? JSON.stringify(dadosDepois) : null,
    ]
  )
  return rows[0]
}

/** Lista os registros de auditoria de um tenant (mais recentes primeiro). */
async function listarPorTenant(idTenant, limite = 100) {
  const { rows } = await query(
    `SELECT id_log, id_usuario, acao, entidade, entidade_id, descricao, criado_ts
     FROM audit_log
     WHERE id_tenant = $1
     ORDER BY criado_ts DESC
     LIMIT $2`,
    [idTenant, limite]
  )
  return rows
}

module.exports = { registrar, listarPorTenant }
