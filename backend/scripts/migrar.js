#!/usr/bin/env node
/**
 * Aplicador de migracoes.
 *
 * O PROBLEMA QUE ELE RESOLVE
 * O `schema.sql` so roda uma vez, no `docker-entrypoint-initdb.d`, quando o
 * volume do Postgres nasce vazio. Um banco que JA EXISTE nunca mais o
 * enxerga. Ate aqui as migracoes eram aplicadas a mao, uma a uma, sem registro
 * do que ja tinha rodado — o que funciona numa maquina de desenvolvimento e
 * nao sobrevive a um segundo ambiente.
 *
 * O REGISTRO
 * Uma tabela `schema_migracao` guarda o nome do arquivo e o sha256 do conteudo
 * aplicado. O nome responde "ja rodou?"; o checksum responde "o arquivo que
 * rodou e o mesmo que esta no disco hoje?" — editar uma migracao ja aplicada e
 * um jeito silencioso de fazer dois ambientes divergirem, e o checksum e o que
 * transforma isso em erro em vez de mistério.
 *
 * A PRIMEIRA VEZ
 * Como o `schema.sql` e um BASELINE COMPLETO (contem tudo ate a 017), um banco
 * recem-criado por ele ja esta no estado final: rodar as migracoes por cima
 * quebraria em "coluna ja existe". Mas um banco antigo, criado antes de alguma
 * migracao, precisa aplica-las. Sao situacoes opostas e o script nao tem como
 * adivinhar qual e — entao ele PARA e exige a decisao em MIGRACAO_PRIMEIRA_VEZ:
 *
 *   baseline   carimba tudo como aplicado sem executar nada.
 *              E o caso do banco criado agora pelo schema.sql.
 *   aplicar    executa todas as migracoes na ordem.
 *              E o caso do banco antigo que ficou para tras.
 *
 * A variavel so e lida quando `schema_migracao` nao existe. Da segunda subida
 * em diante ela e ignorada, e o script aplica apenas o que falta.
 *
 * USO
 *   node scripts/migrar.js              aplica o que falta
 *   node scripts/migrar.js --conferir   so mostra o estado, nao escreve nada
 */
const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
const { Client } = require("pg")

// Onde estao os arquivos .sql.
//
// O padrao serve para rodar do repositorio (backend/scripts -> ../../database).
// DENTRO DO CONTAINER esse caminho nao existe: o Dockerfile copia apenas
// `./backend`, entao `database/` nao entra na imagem — e nem deve, porque as
// migracoes sao dado do repositorio, nao codigo da aplicacao. Ali o
// docker-compose monta o diretorio em /migracoes e define esta variavel.
const DIR_MIGRACOES =
  process.env.MIGRACOES_DIR || path.resolve(__dirname, "../../database/migrations")

const SOMENTE_CONFERIR = process.argv.includes("--conferir")

function log(...args) {
  console.log("[migracao]", ...args)
}

/** Os arquivos .sql, em ordem lexicografica — que e a ordem de aplicacao. */
function listarMigracoes() {
  if (!fs.existsSync(DIR_MIGRACOES)) {
    throw new Error(`Diretorio de migracoes nao encontrado: ${DIR_MIGRACOES}`)
  }

  const arquivos = fs
    .readdirSync(DIR_MIGRACOES)
    .filter((f) => f.endsWith(".sql"))
    .sort()

  // Dois arquivos com o mesmo prefixo numerico (hoje ha duas "013_") ainda tem
  // ordem definida — o desempate e o resto do nome —, mas o prefixo deixa de
  // identificar a versao. Vale avisar antes que alguem se apoie no numero.
  const porPrefixo = new Map()
  for (const arquivo of arquivos) {
    const prefixo = arquivo.slice(0, 3)
    porPrefixo.set(prefixo, [...(porPrefixo.get(prefixo) || []), arquivo])
  }
  for (const [prefixo, lista] of porPrefixo) {
    if (lista.length > 1) {
      log(`aviso: prefixo ${prefixo} repetido em ${lista.join(", ")} — ordem por nome completo.`)
    }
  }

  return arquivos.map((arquivo) => {
    const sql = fs.readFileSync(path.join(DIR_MIGRACOES, arquivo), "utf8")
    return {
      arquivo,
      sql,
      checksum: crypto.createHash("sha256").update(sql).digest("hex"),
    }
  })
}

async function tabelaExiste(cliente, nome) {
  const { rows } = await cliente.query("SELECT to_regclass($1) AS reg", [`public.${nome}`])
  return rows[0].reg !== null
}

async function criarTabelaDeControle(cliente) {
  await cliente.query(`
    CREATE TABLE IF NOT EXISTS schema_migracao (
      arquivo     TEXT PRIMARY KEY,
      checksum    TEXT NOT NULL,
      aplicado_ts TIMESTAMP NOT NULL DEFAULT NOW(),
      baseline    BOOLEAN NOT NULL DEFAULT FALSE
    )
  `)
}

/**
 * Decide o que fazer quando `schema_migracao` ainda nao existe.
 * @returns {"baseline"|"aplicar"}
 */
async function resolverPrimeiraVez(cliente) {
  if (!(await tabelaExiste(cliente, "usuarios"))) {
    throw new Error(
      "O banco esta vazio: nem a tabela `usuarios` existe.\n" +
        "As migracoes sao incrementos sobre um banco que ja tem o schema — elas\n" +
        "nao constroem a base do zero. Aplique o database/schema.sql primeiro\n" +
        "(no Docker isso acontece sozinho, no primeiro boot do volume)."
    )
  }

  const modo = process.env.MIGRACAO_PRIMEIRA_VEZ

  if (modo === "baseline" || modo === "aplicar") return modo

  throw new Error(
    "Primeira execucao neste banco e MIGRACAO_PRIMEIRA_VEZ nao foi definida.\n\n" +
      "  O banco ja tem o schema mas nao tem registro de migracao, e as duas\n" +
      "  saidas possiveis sao opostas:\n\n" +
      "  MIGRACAO_PRIMEIRA_VEZ=baseline\n" +
      "    Carimba as migracoes como aplicadas SEM executar nenhuma.\n" +
      "    Use quando o banco acabou de ser criado pelo schema.sql (que ja e o\n" +
      "    baseline completo) ou quando ele ja esta atualizado a mao.\n\n" +
      "  MIGRACAO_PRIMEIRA_VEZ=aplicar\n" +
      "    Executa todas as migracoes na ordem.\n" +
      "    Use quando o banco e antigo e ficou para tras.\n\n" +
      "  Na duvida, rode com --conferir e confira o estado antes."
  )
}

/** Confere que nenhuma migracao ja aplicada mudou no disco. */
function conferirChecksums(migracoes, aplicadas) {
  const divergentes = []
  for (const m of migracoes) {
    const registro = aplicadas.get(m.arquivo)
    if (registro && !registro.baseline && registro.checksum !== m.checksum) {
      divergentes.push(m.arquivo)
    }
  }

  if (divergentes.length > 0) {
    throw new Error(
      `Migracao ja aplicada foi ALTERADA no disco: ${divergentes.join(", ")}.\n` +
        "O que rodou neste banco nao e mais o que esta no repositorio, e os\n" +
        "ambientes vao divergir em silencio. Reverta o arquivo e escreva uma\n" +
        "migracao NOVA com a correcao."
    )
  }
}

async function principal() {
  const cliente = new Client({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || "admin",
    password: process.env.DB_PASSWORD || "admin",
    database: process.env.DB_NAME || "incubadora",
  })

  await cliente.connect()

  try {
    const migracoes = listarMigracoes()
    log(`${migracoes.length} migracao(oes) no repositorio.`)

    const primeiraVez = !(await tabelaExiste(cliente, "schema_migracao"))
    let modo = null

    if (primeiraVez) {
      modo = await resolverPrimeiraVez(cliente)
      log(`primeira execucao neste banco — modo "${modo}".`)
      if (SOMENTE_CONFERIR) {
        log("--conferir: nada foi escrito.")
        return
      }
      await criarTabelaDeControle(cliente)
    }

    const { rows } = await cliente.query(
      "SELECT arquivo, checksum, baseline FROM schema_migracao"
    )
    const aplicadas = new Map(rows.map((r) => [r.arquivo, r]))

    conferirChecksums(migracoes, aplicadas)

    // Baseline: carimba tudo de uma vez, sem executar.
    if (modo === "baseline") {
      for (const m of migracoes) {
        await cliente.query(
          `INSERT INTO schema_migracao (arquivo, checksum, baseline)
           VALUES ($1, $2, TRUE) ON CONFLICT (arquivo) DO NOTHING`,
          [m.arquivo, m.checksum]
        )
      }
      log(`baseline gravado: ${migracoes.length} migracao(oes) marcadas como aplicadas.`)
      return
    }

    const pendentes = migracoes.filter((m) => !aplicadas.has(m.arquivo))

    if (SOMENTE_CONFERIR) {
      log(`aplicadas: ${aplicadas.size} · pendentes: ${pendentes.length}`)
      for (const m of pendentes) log(`  pendente: ${m.arquivo}`)
      return
    }

    if (pendentes.length === 0) {
      log("banco em dia, nada a aplicar.")
      return
    }

    // Uma transacao POR MIGRACAO, e nao uma para todas: se a quinta falhar, as
    // quatro anteriores continuam aplicadas e registradas, e o proximo `migrar`
    // retoma da quinta. Uma transacao unica desfaria tudo e faria uma falha no
    // fim reexecutar o inicio.
    for (const m of pendentes) {
      log(`aplicando ${m.arquivo}...`)
      try {
        await cliente.query("BEGIN")
        await cliente.query(m.sql)
        await cliente.query(
          "INSERT INTO schema_migracao (arquivo, checksum) VALUES ($1, $2)",
          [m.arquivo, m.checksum]
        )
        await cliente.query("COMMIT")
        log(`  ok: ${m.arquivo}`)
      } catch (err) {
        await cliente.query("ROLLBACK")
        throw new Error(`Falhou em ${m.arquivo}: ${err.message}`)
      }
    }

    log(`${pendentes.length} migracao(oes) aplicada(s).`)
  } finally {
    await cliente.end()
  }
}

principal().catch((err) => {
  console.error("\n[migracao] ERRO\n")
  console.error(err.message)
  process.exit(1)
})
