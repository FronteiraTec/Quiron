/**
 * Repositorio dos clientes do CRM (migracao 026). Tabela: crm_cliente.
 *
 * Toda consulta filtra por id_startup E pelo id do cliente: o id sozinho, vindo
 * da URL, nunca alcanca o cliente de outra startup. Excluido (excluido_ts) nao
 * aparece em leitura nenhuma daqui.
 */
const { query } = require("../config/db")
const { instante } = require("../crm/sql")

/** O que se grava, na ordem dos parametros (INSERT e UPDATE usam a mesma lista). */
const COLUNAS_CADASTRO = [
  "tipo_pessoa",
  "nome",
  "documento",
  "email",
  "telefone",
  "whatsapp",
  "empresa",
  "cargo",
  "origem",
  "status",
  "observacoes",
]

const CAMPOS = `
  c.id_cliente, c.id_startup, ${COLUNAS_CADASTRO.map((col) => `c.${col}`).join(", ")},
  c.criado_por, ucr.nome AS criado_por_nome,
  ${instante("c.criado_ts", "criado_ts")},
  ${instante("c.atualizado_ts", "atualizado_ts")}
`

// Contagem das oportunidades (nao excluidas) de cada cliente, para a lista e o
// detalhe responderem "este cliente tem negocio em aberto?" sem outra ida.
const JOIN_OPORTUNIDADES = `
  LEFT JOIN usuarios ucr ON ucr.id_usuario = c.criado_por
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS total,
           COUNT(*) FILTER (WHERE o.situacao = 'ABERTA') AS abertas,
           COUNT(*) FILTER (WHERE o.situacao = 'GANHA') AS ganhas,
           SUM(o.valor_estimado) FILTER (WHERE o.situacao = 'ABERTA') AS valor_aberto,
           SUM(o.valor_vendido) FILTER (WHERE o.situacao = 'GANHA') AS valor_ganho
      FROM crm_oportunidade o
     WHERE o.id_startup = c.id_startup AND o.id_cliente = c.id_cliente AND o.excluido_ts IS NULL
  ) op ON TRUE
`

const CAMPOS_OPORTUNIDADES = `
  COALESCE(op.total, 0)::int AS total_oportunidades,
  COALESCE(op.abertas, 0)::int AS oportunidades_abertas,
  COALESCE(op.ganhas, 0)::int AS oportunidades_ganhas,
  COALESCE(op.valor_aberto, 0)::float8 AS valor_em_aberto,
  COALESCE(op.valor_ganho, 0)::float8 AS valor_ganho
`

async function listar(idStartup) {
  const { rows } = await query(
    `SELECT ${CAMPOS}, ${CAMPOS_OPORTUNIDADES}
       FROM crm_cliente c
       ${JOIN_OPORTUNIDADES}
      WHERE c.id_startup = $1 AND c.excluido_ts IS NULL
      ORDER BY lower(c.nome)`,
    [idStartup]
  )
  return rows
}

async function buscar(idStartup, idCliente, client) {
  const executor = client || { query }
  const { rows } = await executor.query(
    `SELECT ${CAMPOS}, ${CAMPOS_OPORTUNIDADES}
       FROM crm_cliente c
       ${JOIN_OPORTUNIDADES}
      WHERE c.id_startup = $1 AND c.id_cliente = $2 AND c.excluido_ts IS NULL`,
    [idStartup, idCliente]
  )
  return rows[0] || null
}

/** A linha crua, travada ate o fim da transacao: o "antes" de uma edicao. */
async function travar(client, idStartup, idCliente) {
  const { rows } = await client.query(
    `SELECT id_cliente, id_startup, ${COLUNAS_CADASTRO.join(", ")}
       FROM crm_cliente
      WHERE id_startup = $1 AND id_cliente = $2 AND excluido_ts IS NULL
      FOR UPDATE`,
    [idStartup, idCliente]
  )
  return rows[0] || null
}

/** @returns {Promise<number>} o id do cliente criado. */
async function criar(client, idStartup, dados, idUsuario) {
  const valores = COLUNAS_CADASTRO.map((col) => dados[col] ?? null)
  const marcadores = COLUNAS_CADASTRO.map((_, i) => `$${i + 3}`)
  const { rows } = await client.query(
    `INSERT INTO crm_cliente (id_startup, criado_por, ${COLUNAS_CADASTRO.join(", ")})
     VALUES ($1, $2, ${marcadores.join(", ")})
     RETURNING id_cliente`,
    [idStartup, idUsuario, ...valores]
  )
  return rows[0].id_cliente
}

async function atualizar(client, idStartup, idCliente, dados) {
  const sets = COLUNAS_CADASTRO.map((col, i) => `${col} = $${i + 3}`)
  await client.query(
    `UPDATE crm_cliente
        SET ${sets.join(", ")}, atualizado_ts = NOW()
      WHERE id_startup = $1 AND id_cliente = $2`,
    [idStartup, idCliente, ...COLUNAS_CADASTRO.map((col) => dados[col] ?? null)]
  )
}

/** Exclusao logica: some das telas, fica no banco com o historico. */
async function excluir(client, idStartup, idCliente, idUsuario) {
  await client.query(
    `UPDATE crm_cliente
        SET excluido_ts = NOW(), excluido_por = $3, atualizado_ts = NOW()
      WHERE id_startup = $1 AND id_cliente = $2 AND excluido_ts IS NULL`,
    [idStartup, idCliente, idUsuario]
  )
}

/** Quantas oportunidades (nao excluidas) o cliente tem. */
async function contarOportunidades(client, idStartup, idCliente) {
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS total
       FROM crm_oportunidade
      WHERE id_startup = $1 AND id_cliente = $2 AND excluido_ts IS NULL`,
    [idStartup, idCliente]
  )
  return rows[0].total
}

/** As origens que a startup ja usou, em clientes e oportunidades — sugestao do cadastro. */
async function origensEmUso(idStartup) {
  const { rows } = await query(
    `SELECT origem FROM (
        SELECT origem FROM crm_cliente WHERE id_startup = $1 AND excluido_ts IS NULL
        UNION
        SELECT origem FROM crm_oportunidade WHERE id_startup = $1 AND excluido_ts IS NULL
     ) x
     WHERE origem IS NOT NULL
     ORDER BY lower(origem)`,
    [idStartup]
  )
  return rows.map((r) => r.origem)
}

module.exports = {
  COLUNAS_CADASTRO,
  listar,
  buscar,
  travar,
  criar,
  atualizar,
  excluir,
  contarOportunidades,
  origensEmUso,
}
