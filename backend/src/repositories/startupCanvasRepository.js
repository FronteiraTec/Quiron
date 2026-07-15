/**
 * Repositorio do Business Model Canvas de uma startup.
 * Tabela: startup_canvas (1 linha por bloco, upsert).
 */
const { query } = require("../config/db")

const BLOCOS = [
  "parcerias_chave",
  "atividades_chave",
  "recursos_chave",
  "proposta_valor",
  "relacionamento_clientes",
  "canais",
  "segmentos_clientes",
  "estrutura_custos",
  "fontes_receita",
]

/** Lista os 9 blocos do canvas de uma startup, com conteudo vazio para os ainda nao preenchidos. */
async function listar(idStartup) {
  const { rows } = await query(
    `SELECT bloco, conteudo, atualizado_ts FROM startup_canvas WHERE id_startup = $1`,
    [idStartup]
  )
  const porBloco = new Map(rows.map((r) => [r.bloco, r]))
  return BLOCOS.map((bloco) => porBloco.get(bloco) || { bloco, conteudo: "", atualizado_ts: null })
}

/** Cria ou atualiza o conteudo de um bloco do canvas. */
async function salvarBloco(idStartup, bloco, conteudo) {
  const { rows } = await query(
    `INSERT INTO startup_canvas (id_startup, bloco, conteudo, atualizado_ts)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (id_startup, bloco)
     DO UPDATE SET conteudo = EXCLUDED.conteudo, atualizado_ts = NOW()
     RETURNING bloco, conteudo, atualizado_ts`,
    [idStartup, bloco, conteudo]
  )
  return rows[0]
}

module.exports = { BLOCOS, listar, salvarBloco }
