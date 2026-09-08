/**
 * Banco de teste: cria do zero, aplica o schema, limpa entre arquivos.
 *
 * O ALVO NUNCA E O BANCO DE DESENVOLVIMENTO. Este modulo derruba o schema
 * `public` inteiro, entao a primeira coisa que ele faz e recusar rodar contra
 * um banco cujo nome nao termine em `_teste`. Um `npm test` disparado com as
 * variaveis do ambiente errado apagaria a base de trabalho — a guarda abaixo e
 * o que impede isso de ser possivel.
 *
 * O schema vem do `database/schema.sql`, e nao das migracoes: o schema e o
 * baseline completo (contem tudo ate a 017), enquanto as migracoes sao
 * incrementos sobre um banco que ja existe. Ver `scripts/migrar.js`.
 */
const fs = require("fs")
const path = require("path")
const { Client } = require("pg")

// apoio-teste/ -> backend/ -> raiz do repositorio.
const RAIZ = path.resolve(__dirname, "../..")
const SCHEMA_SQL = path.join(RAIZ, "database", "schema.sql")

function config() {
  return {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || "admin",
    password: process.env.DB_PASSWORD || "admin",
    database: process.env.DB_NAME,
  }
}

/**
 * A guarda. Chamada por prepararBanco antes de qualquer DROP.
 */
function exigirBancoDeTeste() {
  const nome = process.env.DB_NAME
  if (!nome) {
    throw new Error(
      "DB_NAME nao definido. Rode os testes com `npm test`, que aponta para o " +
        "banco `quiron_teste`."
    )
  }
  if (!nome.endsWith("_teste")) {
    throw new Error(
      `Recusando rodar: DB_NAME="${nome}" nao termina em "_teste". ` +
        "Este modulo apaga o schema public inteiro."
    )
  }
}

/**
 * Zera o banco e reaplica o schema. Chamado uma vez por arquivo de teste
 * (`before`), para que a ordem de execucao entre arquivos nao importe.
 */
async function prepararBanco() {
  exigirBancoDeTeste()

  const cliente = new Client(config())
  await cliente.connect()
  try {
    await cliente.query("DROP SCHEMA IF EXISTS public CASCADE")
    await cliente.query("CREATE SCHEMA public")
    await cliente.query(fs.readFileSync(SCHEMA_SQL, "utf8"))
  } finally {
    await cliente.end()
  }

  // So agora: o `config/db.js` monta o pool no carregamento do modulo, entao
  // exigir daqui para baixo garante que ele nasca depois do schema existir.
  const { sincronizarCatalogo } = require("../src/rbac/sincronizarCatalogo")
  await sincronizarCatalogo()
}

/** Fecha o pool do app, senao o processo de teste nao termina. */
async function encerrar() {
  const { pool } = require("../src/config/db")
  await pool.end()
}

module.exports = { prepararBanco, encerrar, config }
