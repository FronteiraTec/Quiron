#!/usr/bin/env node
/**
 * Conferencias do banco que a CI roda em todo PR, antes de qualquer deploy.
 *
 * O que elas pegam e o que, sem elas, so aparecia no servidor:
 *
 *   nomes     As regras dos arquivos de migracao.
 *               - nome no formato NNN_descricao.sql;
 *               - numero NOVO, maior que todos os da base — dois PRs abertos
 *                 ao mesmo tempo com "019_" quebram aqui, no segundo a chegar,
 *                 e nao em producao;
 *               - migracao que ja existia na base NAO pode ser editada nem
 *                 apagada: ela ja rodou em algum banco, e o runner recusaria
 *                 o checksum no deploy.
 *
 *   comparar  Dois bancos tem o mesmo schema?
 *             A CI monta um banco pelo caminho do DEPLOY (schema.sql da base +
 *             migracoes novas) e outro pelo caminho do AMBIENTE NOVO (schema.sql
 *             do PR). Se diferirem, alguem escreveu a migracao e esqueceu o
 *             schema.sql (ou o contrario) — e o proximo ambiente criado do zero
 *             nasceria diferente de producao, sem nenhum erro.
 *
 * USO
 *   node scripts/conferirBanco.js nomes <ref-base>
 *   node scripts/conferirBanco.js comparar <banco-a> <banco-b>
 *
 * A conexao vem de DB_HOST/DB_PORT/DB_USER/DB_PASSWORD, como no migrar.js.
 */
const { execFileSync } = require("child_process")
const path = require("path")
const { Client } = require("pg")

const RAIZ = path.resolve(__dirname, "../..")
const DIR = "database/migrations"
const FORMATO = /^(\d{3})_[a-z0-9_]+\.sql$/

function git(...args) {
  return execFileSync("git", args, { cwd: RAIZ, encoding: "utf8" }).trim()
}

function falhar(titulo, linhas) {
  console.error(`\n[banco] ERRO: ${titulo}\n`)
  for (const l of linhas) console.error(`  ${l}`)
  console.error("")
  process.exit(1)
}

// ---------------------------------------------------------------------------
// nomes
// ---------------------------------------------------------------------------

function conferirNomes(base) {
  const naBase = git("ls-tree", "--name-only", `${base}:${DIR}`)
    .split("\n")
    .filter((f) => f.endsWith(".sql"))
  const agora = git("ls-tree", "--name-only", `HEAD:${DIR}`)
    .split("\n")
    .filter((f) => f.endsWith(".sql"))

  const erros = []

  // Editada ou apagada: compara o blob de cada arquivo que ja existia.
  for (const f of naBase) {
    if (!agora.includes(f)) {
      erros.push(`${f} foi APAGADA. Migracao aplicada nao sai do repositorio.`)
      continue
    }
    const antes = git("rev-parse", `${base}:${DIR}/${f}`)
    const depois = git("rev-parse", `HEAD:${DIR}/${f}`)
    if (antes !== depois) {
      erros.push(
        `${f} foi EDITADA. Ela ja rodou em algum banco; escreva uma migracao nova com a correcao.`
      )
    }
  }

  const novas = agora.filter((f) => !naBase.includes(f))
  const maiorDaBase = Math.max(0, ...naBase.map((f) => Number(f.slice(0, 3)) || 0))
  const prefixosUsados = new Set(naBase.map((f) => f.slice(0, 3)))

  for (const f of novas) {
    const m = FORMATO.exec(f)
    if (!m) {
      erros.push(`${f}: o nome precisa ser NNN_descricao.sql (minusculas, digitos e _).`)
      continue
    }
    if (prefixosUsados.has(m[1])) {
      erros.push(`${f}: o numero ${m[1]} ja esta em uso. Renomeie para o proximo livre.`)
    }
    if (Number(m[1]) <= maiorDaBase) {
      erros.push(
        `${f}: o numero precisa ser maior que ${String(maiorDaBase).padStart(3, "0")}, ` +
          "a ultima migracao da base. Provavelmente outro PR usou este numero antes — " +
          "atualize sua branch e renomeie."
      )
    }
    prefixosUsados.add(m[1])
  }

  if (erros.length) falhar("regras das migracoes", erros)

  console.log(
    novas.length
      ? `[banco] ${novas.length} migracao(oes) nova(s): ${novas.join(", ")}`
      : "[banco] nenhuma migracao nova neste PR."
  )
}

// ---------------------------------------------------------------------------
// comparar
// ---------------------------------------------------------------------------

// Cada consulta devolve linhas de texto ja normalizadas. A ORDEM das colunas
// fica de fora de proposito: ALTER TABLE ADD COLUMN poe a coluna no fim, e o
// schema.sql costuma poe-la onde faz sentido ler — isso nao e divergencia.
const CONSULTAS = {
  colunas: `
    SELECT format('%s.%s %s%s %s default=%s',
             c.table_name, c.column_name,
             CASE WHEN c.data_type = 'USER-DEFINED' THEN c.udt_name ELSE c.data_type END,
             COALESCE('(' || c.character_maximum_length || ')', ''),
             CASE WHEN c.is_nullable = 'YES' THEN 'null' ELSE 'not null' END,
             COALESCE(c.column_default, CASE WHEN c.is_identity = 'YES' THEN 'identity' END, '-'))
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_schema = c.table_schema AND t.table_name = c.table_name
     WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
       AND c.table_name <> 'schema_migracao'`,

  restricoes: `
    SELECT format('%s %s', conrelid::regclass, pg_get_constraintdef(oid))
      FROM pg_constraint
     WHERE connamespace = 'public'::regnamespace
       AND conrelid <> 0
       AND conrelid::regclass::text <> 'schema_migracao'`,

  indices: `
    SELECT regexp_replace(indexdef, '^CREATE (UNIQUE )?INDEX \\S+ ', 'CREATE \\1INDEX ')
      FROM pg_indexes
     WHERE schemaname = 'public' AND tablename <> 'schema_migracao'`,

  enums: `
    SELECT format('%s: %s', t.typname, string_agg(e.enumlabel, ', ' ORDER BY e.enumlabel))
      FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
     WHERE t.typnamespace = 'public'::regnamespace
     GROUP BY t.typname`,

  funcoes: `
    SELECT format('%s(%s) md5=%s', p.proname, pg_get_function_identity_arguments(p.oid), md5(p.prosrc))
      FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace`,

  gatilhos: `
    SELECT pg_get_triggerdef(oid)
      FROM pg_trigger
     WHERE NOT tgisinternal
       AND tgrelid IN (SELECT oid FROM pg_class WHERE relnamespace = 'public'::regnamespace)`,

  visoes: `
    SELECT format('%s md5=%s', viewname, md5(definition))
      FROM pg_views
     WHERE schemaname = 'public'`,
}

async function retrato(banco) {
  const cliente = new Client({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: banco,
  })
  await cliente.connect()
  try {
    const r = {}
    for (const [nome, sql] of Object.entries(CONSULTAS)) {
      const { rows } = await cliente.query(sql)
      r[nome] = rows.map((row) => Object.values(row)[0]).sort()
    }
    return r
  } finally {
    await cliente.end()
  }
}

async function comparar(bancoA, bancoB) {
  const [a, b] = await Promise.all([retrato(bancoA), retrato(bancoB)])
  const linhas = []

  for (const nome of Object.keys(CONSULTAS)) {
    const emA = new Set(a[nome])
    const emB = new Set(b[nome])
    const soA = a[nome].filter((x) => !emB.has(x))
    const soB = b[nome].filter((x) => !emA.has(x))
    if (soA.length || soB.length) {
      linhas.push(`--- ${nome}`)
      for (const x of soA) linhas.push(`  so em ${bancoA}: ${x}`)
      for (const x of soB) linhas.push(`  so em ${bancoB}: ${x}`)
    }
  }

  if (linhas.length) {
    falhar("o schema.sql nao bate com as migracoes", [
      `${bancoA} = schema.sql da base + migracoes novas (o que o deploy produz)`,
      `${bancoB} = schema.sql deste PR (o que um ambiente novo produz)`,
      "",
      ...linhas,
      "",
      "Quem escreve a migracao atualiza o database/schema.sql com a mesma mudanca.",
    ])
  }

  console.log(`[banco] ${bancoA} e ${bancoB} tem o mesmo schema.`)
}

// ---------------------------------------------------------------------------

const [comando, ...args] = process.argv.slice(2)

if (comando === "nomes" && args[0]) {
  conferirNomes(args[0])
} else if (comando === "comparar" && args.length === 2) {
  comparar(args[0], args[1]).catch((err) => falhar("comparar", [err.message]))
} else {
  console.error("uso: conferirBanco.js nomes <ref-base> | comparar <banco-a> <banco-b>")
  process.exit(2)
}
