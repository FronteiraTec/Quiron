/**
 * Repositorio das etapas do funil do CRM (migracao 026). Tabela: crm_etapa.
 *
 * Toda consulta leva o id_startup junto com o id da etapa: uma etapa so existe
 * dentro da startup dona dela.
 */
const { query } = require("../config/db")

const COLUNAS = `id_etapa, nome, cor, ordem, ativo`

/** As etapas da startup, na ordem do funil (as desativadas inclusive). */
async function listar(idStartup, client) {
  const executor = client || { query }
  const { rows } = await executor.query(
    `SELECT ${COLUNAS} FROM crm_etapa WHERE id_startup = $1 ORDER BY ordem, id_etapa`,
    [idStartup]
  )
  return rows
}

async function buscar(idStartup, idEtapa, client) {
  const executor = client || { query }
  const { rows } = await executor.query(
    `SELECT ${COLUNAS} FROM crm_etapa WHERE id_startup = $1 AND id_etapa = $2`,
    [idStartup, idEtapa]
  )
  return rows[0] || null
}

/** A primeira etapa ativa: onde nasce a oportunidade que nao disse onde. */
async function primeiraAtiva(idStartup, client) {
  const executor = client || { query }
  const { rows } = await executor.query(
    `SELECT ${COLUNAS} FROM crm_etapa
      WHERE id_startup = $1 AND ativo = TRUE
      ORDER BY ordem, id_etapa
      LIMIT 1`,
    [idStartup]
  )
  return rows[0] || null
}

/**
 * Cria as etapas padrao se a startup ainda nao tem nenhuma. Roda na concessao
 * do CRM: na RE-concessao a startup ja tem o funil dela e nada muda.
 *
 * @returns {Promise<boolean>} se semeou.
 */
async function semearSeVazia(client, idStartup, etapas) {
  const { rows } = await client.query(`SELECT 1 FROM crm_etapa WHERE id_startup = $1 LIMIT 1`, [idStartup])
  if (rows.length > 0) return false
  for (const [i, etapa] of etapas.entries()) {
    await client.query(
      `INSERT INTO crm_etapa (id_startup, nome, cor, ordem) VALUES ($1, $2, $3, $4)`,
      [idStartup, etapa.nome, etapa.cor, i + 1]
    )
  }
  return true
}

module.exports = { listar, buscar, primeiraAtiva, semearSeVazia }
