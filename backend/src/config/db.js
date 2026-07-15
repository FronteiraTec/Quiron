/**
 * Configuracao da conexao com o PostgreSQL.
 *
 * Usa um "pool" de conexoes (reaproveita conexoes abertas em vez de
 * abrir/fechar a cada query, o que e mais eficiente).
 *
 * Os dados de conexao vem das variaveis de ambiente definidas no
 * docker-compose.yml (DB_HOST=postgres, etc.), permitindo que o backend
 * se conecte ao banco internamente pela rede do Docker.
 */
const { Pool } = require("pg")

// Cria o pool de conexoes com base nas variaveis de ambiente.
const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "admin",
  password: process.env.DB_PASSWORD || "admin",
  database: process.env.DB_NAME || "incubadora",
  port: Number(process.env.DB_PORT) || 5432,
})

// Loga eventuais erros de conexao inesperados do pool.
pool.on("error", (err) => {
  console.error("Erro inesperado no pool do PostgreSQL:", err)
})

/**
 * Executa uma query no banco reutilizando o pool.
 * @param {string} text - SQL com placeholders ($1, $2, ...).
 * @param {Array} params - Valores para os placeholders.
 * @returns {Promise} Resultado da query.
 */
function query(text, params) {
  return pool.query(text, params)
}

/**
 * Executa uma funcao dentro de uma transacao (BEGIN/COMMIT/ROLLBACK).
 *
 * O client dedicado e passado para o callback; use-o para todas as queries
 * da transacao (client.query(...)). Em caso de erro, faz ROLLBACK e relanca.
 *
 * @param {(client: import('pg').PoolClient) => Promise<any>} callback
 * @returns {Promise<any>} O que o callback retornar.
 */
async function withTransaction(callback) {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const resultado = await callback(client)
    await client.query("COMMIT")
    return resultado
  } catch (err) {
    await client.query("ROLLBACK")
    throw err
  } finally {
    client.release()
  }
}

module.exports = { pool, query, withTransaction }
