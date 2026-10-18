/**
 * Repositorio da analise SWOT de uma startup.
 * Tabela: startup_swot (1 linha por quadrante, upsert).
 */
const { query } = require("../config/db")

const QUADRANTES = ["forcas", "fraquezas", "oportunidades", "ameacas"]

/** Lista os 4 quadrantes da SWOT de uma startup, com conteudo vazio para os ainda nao preenchidos. */
async function listar(idStartup) {
  const { rows } = await query(
    `SELECT quadrante, conteudo, atualizado_ts FROM startup_swot WHERE id_startup = $1`,
    [idStartup]
  )
  const porQuadrante = new Map(rows.map((r) => [r.quadrante, r]))
  return QUADRANTES.map((quadrante) => porQuadrante.get(quadrante) || { quadrante, conteudo: "", atualizado_ts: null })
}

/** Cria ou atualiza o conteudo de um quadrante da SWOT. */
async function salvarQuadrante(idStartup, quadrante, conteudo) {
  const { rows } = await query(
    `INSERT INTO startup_swot (id_startup, quadrante, conteudo, atualizado_ts)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (id_startup, quadrante)
     DO UPDATE SET conteudo = EXCLUDED.conteudo, atualizado_ts = NOW()
     RETURNING quadrante, conteudo, atualizado_ts`,
    [idStartup, quadrante, conteudo]
  )
  return rows[0]
}

module.exports = { QUADRANTES, listar, salvarQuadrante }
