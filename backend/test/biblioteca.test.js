/**
 * A Biblioteca pela borda HTTP, com foco no corpo da AULA.
 *
 * Tres perguntas, e as tres valem um deploy:
 *
 *   1. O ciclo funciona? Criar, ler, editar, ler de novo — e o documento que
 *      volta e o mesmo que foi enviado.
 *   2. A aula ESCRITA NO EDITOR ANTIGO continua sendo aula? O corpo dela vive
 *      em `conteudo_bloco`; a API tem de entrega-la ja convertida, e a
 *      primeira gravacao no editor novo tem de fechar essa porta sem deixar
 *      duas versoes do mesmo texto no banco.
 *   3. Quem nao e da incubadora continua de fora? A coluna e nova, a
 *      autorizacao e a de sempre — e e justamente onde uma rota nova costuma
 *      esquecer de chamar o RBAC.
 */
const { test, describe, before, after } = require("node:test")
const assert = require("node:assert/strict")

const { prepararBanco, encerrar } = require("../apoio-teste/banco")
const { subirApi, req, enviarArquivo, baixar } = require("../apoio-teste/api")
const { query } = require("../src/config/db")

let api
let c

before(async () => {
  await prepararBanco()
  c = await require("../apoio-teste/cenario").montarCenario()
  api = await subirApi()
})

after(async () => {
  await api.fechar()
  await encerrar()
})

/** Um paragrafo no formato do editor. */
const paragrafo = (texto) => ({
  type: "paragraph",
  content: [{ type: "text", text: texto, styles: {} }],
})

/** Cria uma AULA pela API e devolve o conteudo criado. */
async function criarAula(titulo, extras = {}) {
  const r = await req(api.url, "/conteudos", {
    metodo: "POST",
    token: c.adminA.token,
    corpo: {
      id_tenant: c.tenantA.id_tenant,
      tipo: "AULA",
      titulo,
      ...extras,
    },
  })
  assert.equal(r.status, 201, `criar "${titulo}" respondeu ${JSON.stringify(r.corpo)}`)
  return r.corpo.conteudo
}

/** Grava blocos no formato ANTIGO direto no banco — simula a aula legada. */
async function semearBlocosAntigos(idConteudo, blocos) {
  for (const [i, b] of blocos.entries()) {
    await query(
      `INSERT INTO conteudo_bloco (id_conteudo, tipo, ordem, texto, url, nome, variante)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [idConteudo, b.tipo, i + 1, b.texto ?? null, b.url ?? null, b.nome ?? null, b.variante ?? null]
    )
  }
}

// ---------------------------------------------------------------------------

describe("AULA · o ciclo do documento", () => {
  test("cria com documento e le de volta igual", async () => {
    const documento = [
      { type: "heading", props: { level: 1 }, content: [{ type: "text", text: "Pitch", styles: {} }] },
      paragrafo("Um bom pitch conta uma historia."),
      { type: "destaque", props: { variante: "atencao" }, content: [] },
      { type: "checkListItem", props: { checked: true }, content: [] },
    ]

    const criada = await criarAula("Aula com documento", { documento })
    assert.deepEqual(criada.documento, documento)

    const { status, corpo } = await req(api.url, `/conteudos/${criada.id_conteudo}`, {
      token: c.adminA.token,
    })
    assert.equal(status, 200)
    assert.deepEqual(corpo.conteudo.documento, documento)
  })

  test("aula nova sem corpo nasce com documento vazio, e nao quebrada", async () => {
    const criada = await criarAula("Aula em branco")
    assert.deepEqual(criada.documento, [])
  })

  test("editar troca o documento inteiro", async () => {
    const criada = await criarAula("Aula a editar", { documento: [paragrafo("primeira versao")] })

    const r = await req(api.url, `/conteudos/${criada.id_conteudo}`, {
      metodo: "PATCH",
      token: c.adminA.token,
      corpo: { documento: [paragrafo("segunda versao"), { type: "divider" }] },
    })

    assert.equal(r.status, 200)
    assert.equal(r.corpo.conteudo.documento.length, 2)
    assert.equal(r.corpo.conteudo.documento[0].content[0].text, "segunda versao")
  })

  test("editar so o titulo nao apaga o documento", async () => {
    const criada = await criarAula("Titulo velho", { documento: [paragrafo("corpo que fica")] })

    await req(api.url, `/conteudos/${criada.id_conteudo}`, {
      metodo: "PATCH",
      token: c.adminA.token,
      corpo: { titulo: "Titulo novo" },
    })

    const { corpo } = await req(api.url, `/conteudos/${criada.id_conteudo}`, {
      token: c.adminA.token,
    })
    assert.equal(corpo.conteudo.titulo, "Titulo novo")
    assert.equal(corpo.conteudo.documento[0].content[0].text, "corpo que fica")
  })

  test("duplicar leva o documento junto", async () => {
    const criada = await criarAula("Aula a duplicar", { documento: [paragrafo("conteudo copiado")] })

    const r = await req(api.url, `/conteudos/${criada.id_conteudo}/duplicar`, {
      metodo: "POST",
      token: c.adminA.token,
    })

    assert.equal(r.status, 201)
    assert.notEqual(r.corpo.conteudo.id_conteudo, criada.id_conteudo)
    assert.equal(r.corpo.conteudo.documento[0].content[0].text, "conteudo copiado")
  })

  test("a listagem NAO carrega o documento de cada aula", async () => {
    const { status, corpo } = await req(
      api.url,
      `/conteudos?id_tenant=${c.tenantA.id_tenant}&tipo=AULA`,
      { token: c.adminA.token }
    )

    assert.equal(status, 200)
    assert.ok(corpo.conteudos.length > 0, "o cenario deveria ter aulas")
    for (const item of corpo.conteudos) {
      assert.equal(item.documento, undefined, `"${item.titulo}" trouxe o documento na listagem`)
    }
  })
})

describe("AULA · a aula escrita no editor antigo", () => {
  test("a API converte os blocos antigos e entrega documento", async () => {
    const aula = await criarAula("Aula legada")
    await semearBlocosAntigos(aula.id_conteudo, [
      { tipo: "h1", texto: "Business Model Canvas" },
      { tipo: "paragrafo", texto: "O Canvas e um mapa de uma pagina." },
      { tipo: "callout", texto: "Comece pela proposta de valor.", variante: "dica" },
      { tipo: "lista", texto: "Segmentos de Cliente" },
      { tipo: "video", url: "https://youtu.be/QoAOzMTLP5s", nome: "Osterwalder explica" },
      { tipo: "divisor" },
    ])

    const { status, corpo } = await req(api.url, `/conteudos/${aula.id_conteudo}`, {
      token: c.adminA.token,
    })

    assert.equal(status, 200)
    const doc = corpo.conteudo.documento
    assert.equal(doc.length, 6, "todo bloco antigo tem de ter virado um bloco novo")
    assert.deepEqual(
      doc.map((b) => b.type),
      ["heading", "paragraph", "destaque", "bulletListItem", "videoEmbutido", "divider"]
    )
    assert.equal(doc[2].props.variante, "dica")
    assert.equal(doc[4].props.url, "https://youtu.be/QoAOzMTLP5s")

    // O texto nao pode ter ficado pelo caminho.
    assert.ok(JSON.stringify(doc).includes("Business Model Canvas"))
    assert.ok(JSON.stringify(doc).includes("Comece pela proposta de valor."))

    // E os blocos antigos continuam onde estavam: converter na leitura nao
    // reescreve nada.
    assert.equal(corpo.conteudo.blocos.length, 6)
  })

  test("gravar o documento apaga os blocos antigos — uma versao so do corpo", async () => {
    const aula = await criarAula("Aula legada que sera salva")
    await semearBlocosAntigos(aula.id_conteudo, [
      { tipo: "h1", texto: "Titulo antigo" },
      { tipo: "paragrafo", texto: "Texto antigo" },
    ])

    await req(api.url, `/conteudos/${aula.id_conteudo}`, {
      metodo: "PATCH",
      token: c.adminA.token,
      corpo: { documento: [paragrafo("Texto reescrito no editor novo")] },
    })

    const { corpo } = await req(api.url, `/conteudos/${aula.id_conteudo}`, {
      token: c.adminA.token,
    })

    assert.equal(corpo.conteudo.documento.length, 1)
    assert.equal(corpo.conteudo.documento[0].content[0].text, "Texto reescrito no editor novo")
    assert.deepEqual(corpo.conteudo.blocos, [], "os blocos antigos deveriam ter saido do banco")

    const { rows } = await query(
      "SELECT COUNT(*)::INTEGER AS total FROM conteudo_bloco WHERE id_conteudo = $1",
      [aula.id_conteudo]
    )
    assert.equal(rows[0].total, 0)
  })

  test("o formato antigo continua aceito na gravacao", async () => {
    // Cliente que ainda nao foi atualizado nao pode receber 400 na cara.
    const aula = await criarAula("Aula gravada no formato antigo")

    const r = await req(api.url, `/conteudos/${aula.id_conteudo}`, {
      metodo: "PATCH",
      token: c.adminA.token,
      corpo: { blocos: [{ tipo: "h2", texto: "Ainda pelo formato antigo" }] },
    })

    assert.equal(r.status, 200)
    assert.equal(r.corpo.conteudo.documento[0].type, "heading")
    assert.equal(r.corpo.conteudo.documento[0].props.level, 2)
  })
})

describe("AULA · documento invalido e recusado", () => {
  test("tipo de bloco desconhecido devolve 400", async () => {
    const aula = await criarAula("Aula para recusar")

    const r = await req(api.url, `/conteudos/${aula.id_conteudo}`, {
      metodo: "PATCH",
      token: c.adminA.token,
      corpo: { documento: [{ type: "blocoInexistente" }] },
    })

    assert.equal(r.status, 400)
    assert.match(r.corpo.erro, /Bloco 1/)
  })

  test("link javascript: devolve 400 e nao fica gravado", async () => {
    const aula = await criarAula("Aula com link perigoso", {
      documento: [paragrafo("corpo original")],
    })

    const r = await req(api.url, `/conteudos/${aula.id_conteudo}`, {
      metodo: "PATCH",
      token: c.adminA.token,
      corpo: {
        documento: [
          {
            type: "paragraph",
            content: [{ type: "link", href: "javascript:alert(1)", content: [] }],
          },
        ],
      },
    })

    assert.equal(r.status, 400)

    const { corpo } = await req(api.url, `/conteudos/${aula.id_conteudo}`, {
      token: c.adminA.token,
    })
    assert.equal(corpo.conteudo.documento[0].content[0].text, "corpo original")
  })

  test("documento que nao e lista devolve 400", async () => {
    const aula = await criarAula("Aula com documento torto")

    const r = await req(api.url, `/conteudos/${aula.id_conteudo}`, {
      metodo: "PATCH",
      token: c.adminA.token,
      corpo: { documento: { type: "paragraph" } },
    })

    assert.equal(r.status, 400)
  })

  test("conteudo que nao e AULA nao aceita documento", async () => {
    const r = await req(api.url, "/conteudos", {
      metodo: "POST",
      token: c.adminA.token,
      corpo: {
        id_tenant: c.tenantA.id_tenant,
        tipo: "LINK",
        titulo: "Link com documento",
        url: "https://exemplo.test",
        documento: [paragrafo("nao deveria entrar")],
      },
    })

    assert.equal(r.status, 400)
  })

  test("conteudo inexistente devolve 404", async () => {
    const r = await req(api.url, "/conteudos/999999", {
      metodo: "PATCH",
      token: c.adminA.token,
      corpo: { documento: [paragrafo("para lugar nenhum")] },
    })

    assert.equal(r.status, 404)
  })
})

describe("O logo do conteudo", () => {
  /**
   * O upload devolve um caminho RELATIVO (/api/arquivos/<uuid>). Entre
   * 20/07/2026 e 13/09/2026 a validacao so aceitava data URL ou http(s), e
   * recusava com 400 exatamente o que o proprio sistema tinha acabado de
   * gravar — mas ninguem viu, porque o volume de uploads estava sem permissao
   * de escrita e o upload falhava antes. Com o editor salvando sozinho, esse
   * 400 travava a gravacao do conteudo inteiro, e nao so do logo.
   */
  test("aceita o caminho de um arquivo enviado para a propria plataforma", async () => {
    const aula = await criarAula("Aula com logo enviado")

    const r = await req(api.url, `/conteudos/${aula.id_conteudo}`, {
      metodo: "PATCH",
      token: c.adminA.token,
      corpo: { logo_url: "/api/arquivos/ddd96210-b3f2-4b2c-b0ae-bbc2b0b32d6b" },
    })

    assert.equal(r.status, 200, JSON.stringify(r.corpo))
    assert.equal(r.corpo.conteudo.logo_url, "/api/arquivos/ddd96210-b3f2-4b2c-b0ae-bbc2b0b32d6b")
  })

  test("continua aceitando data URL e link http(s)", async () => {
    const aula = await criarAula("Aula com logo externo")

    for (const logo of [
      "data:image/png;base64,iVBORw0KGgo=",
      "https://exemplo.test/marca.png",
    ]) {
      const r = await req(api.url, `/conteudos/${aula.id_conteudo}`, {
        metodo: "PATCH",
        token: c.adminA.token,
        corpo: { logo_url: logo },
      })
      assert.equal(r.status, 200, `recusou ${logo}: ${JSON.stringify(r.corpo)}`)
    }
  })

  test("limpar o logo (null) continua valendo", async () => {
    const aula = await criarAula("Aula sem logo", { logo_url: "https://exemplo.test/x.png" })

    const r = await req(api.url, `/conteudos/${aula.id_conteudo}`, {
      metodo: "PATCH",
      token: c.adminA.token,
      corpo: { logo_url: null },
    })
    assert.equal(r.status, 200)
    assert.equal(r.corpo.conteudo.logo_url, null)
  })

  test("NAO aceita endereco de outra origem disfarcado de caminho", async () => {
    const aula = await criarAula("Aula com logo forasteiro")

    // "//host/x" comeca com barra, mas num <img src> carrega de outra origem.
    const r = await req(api.url, `/conteudos/${aula.id_conteudo}`, {
      metodo: "PATCH",
      token: c.adminA.token,
      corpo: { logo_url: "//exemplo-malicioso.test/pixel.png" },
    })
    assert.equal(r.status, 400)
  })

  test("NAO aceita texto arbitrario nem javascript:", async () => {
    const aula = await criarAula("Aula com logo invalido")

    for (const logo of ["javascript:alert(1)", "qualquer coisa", "data:text/html;base64,PHM+"]) {
      const r = await req(api.url, `/conteudos/${aula.id_conteudo}`, {
        metodo: "PATCH",
        token: c.adminA.token,
        corpo: { logo_url: logo },
      })
      assert.equal(r.status, 400, `deveria recusar ${logo}`)
    }
  })
})

describe("AULA · quem pode mexer", () => {
  test("sem token nao le nem escreve", async () => {
    const aula = await criarAula("Aula protegida", { documento: [paragrafo("segredo da A")] })

    const leitura = await req(api.url, `/conteudos/${aula.id_conteudo}`)
    assert.equal(leitura.status, 401)

    const escrita = await req(api.url, `/conteudos/${aula.id_conteudo}`, {
      metodo: "PATCH",
      corpo: { documento: [paragrafo("invasao")] },
    })
    assert.equal(escrita.status, 401)
  })

  test("forasteiro NAO le a aula de uma incubadora alheia", async () => {
    const aula = await criarAula("Aula so da A", {
      documento: [paragrafo("CONTEUDO-EXCLUSIVO-DA-A")],
    })

    const r = await req(api.url, `/conteudos/${aula.id_conteudo}`, {
      token: c.forasteiro.token,
    })

    assert.ok([401, 403, 404].includes(r.status), `respondeu ${r.status}`)
    assert.ok(
      !JSON.stringify(r.corpo).includes("CONTEUDO-EXCLUSIVO-DA-A"),
      "o corpo da aula vazou na resposta"
    )
  })

  test("admin de OUTRA incubadora NAO edita a aula da primeira", async () => {
    const aula = await criarAula("Aula da A que a B nao edita", {
      documento: [paragrafo("texto da A")],
    })

    const r = await req(api.url, `/conteudos/${aula.id_conteudo}`, {
      metodo: "PATCH",
      token: c.adminB.token,
      corpo: { documento: [paragrafo("texto da B")] },
    })

    assert.ok([401, 403, 404].includes(r.status), `respondeu ${r.status}`)

    const { corpo } = await req(api.url, `/conteudos/${aula.id_conteudo}`, {
      token: c.adminA.token,
    })
    assert.equal(corpo.conteudo.documento[0].content[0].text, "texto da A")
  })
})

describe("A jornada entrega a aula pronta para ler", () => {
  test("o passo da trilha traz o documento da aula que ensina", async () => {
    const aula = await criarAula("Aula da trilha", {
      documento: [paragrafo("O que a startup precisa aprender aqui.")],
    })
    const legada = await criarAula("Aula legada da trilha")
    await semearBlocosAntigos(legada.id_conteudo, [
      { tipo: "h2", texto: "Titulo da aula legada" },
    ])

    // Vincula as duas ao passo do cenario.
    await query(
      `INSERT INTO trilha_conteudo (id_no, id_conteudo, ordem) VALUES ($1, $2, 1), ($1, $3, 2)`,
      [c.passo.id_no, aula.id_conteudo, legada.id_conteudo]
    )

    const { status, corpo } = await req(
      api.url,
      `/jornada?id_startup=${c.startupUm.id_startup}`,
      { token: c.adminA.token }
    )
    assert.equal(status, 200)

    // Acha o passo na arvore devolvida, seja qual for o formato dela.
    const texto = JSON.stringify(corpo)
    assert.ok(
      texto.includes("O que a startup precisa aprender aqui."),
      "a aula nova nao chegou ao incubado"
    )
    assert.ok(
      texto.includes("Titulo da aula legada"),
      "a aula antiga nao chegou ao incubado"
    )
    assert.ok(
      texto.includes('"videoEmbutido"') || texto.includes('"heading"'),
      "o corpo deveria chegar no formato de blocos do editor"
    )
  })
})

describe("MATERIAL · o arquivo enviado", () => {
  /** Sobe um PDF e devolve o registro (com a url ja montada). */
  async function subir(token, idTenant, bytes) {
    const r = await enviarArquivo(api.url, token, idTenant, bytes, { nome: "canvas.pdf" })
    assert.equal(r.status, 201, `upload respondeu ${r.status}: ${JSON.stringify(r.corpo)}`)
    return r.corpo.arquivo
  }

  async function criarMaterial(token, extras) {
    return req(api.url, "/conteudos", {
      metodo: "POST",
      token,
      corpo: { id_tenant: c.tenantA.id_tenant, tipo: "ARQUIVO", titulo: "Canvas", ...extras },
    })
  }

  /**
   * O incubado le a trilha com `programa.biblioteca.visualizar`, e nao com a
   * chave de entregas. Sem a regra da Biblioteca no download, o material que a
   * incubadora anexou chegava a Jornada como um link que respondia 403.
   */
  test("o incubado abre o arquivo do material; antes de virar material, nao", async () => {
    const arquivo = await subir(c.adminA.token, c.tenantA.id_tenant, "PDF-DO-CANVAS")

    const antes = await baixar(api.url, arquivo.url.replace(/^\/api/, ""), c.colaboradorA.token)
    assert.equal(antes.status, 403)

    const r = await criarMaterial(c.adminA.token, { url: arquivo.url, nome_arquivo: "canvas.pdf" })
    assert.equal(r.status, 201, JSON.stringify(r.corpo))

    const depois = await baixar(api.url, arquivo.url.replace(/^\/api/, ""), c.colaboradorA.token)
    assert.equal(depois.status, 200)
    assert.equal(depois.texto, "PDF-DO-CANVAS")
  })

  test("quem e de outra incubadora continua de fora", async () => {
    const arquivo = await subir(c.adminA.token, c.tenantA.id_tenant, "SO-DA-A")
    const r = await criarMaterial(c.adminA.token, { url: arquivo.url })
    assert.equal(r.status, 201)

    const caminho = arquivo.url.replace(/^\/api/, "")
    assert.equal((await baixar(api.url, caminho, c.adminB.token)).status, 403)
    assert.equal((await baixar(api.url, caminho, c.forasteiro.token)).status, 403)
    assert.equal((await baixar(api.url, caminho)).status, 401)
  })

  /**
   * O caminho perigoso: o arquivo do material abre para todo incubado, entao
   * colar ali o anexo da entrega de uma startup o publicaria para as outras.
   */
  test("NAO aceita como material o arquivo que outra pessoa enviou", async () => {
    const anexoDaStartup = await subir(c.colaboradorA.token, c.tenantA.id_tenant, "PLANO-SECRETO")

    const r = await criarMaterial(c.adminA.token, { url: anexoDaStartup.url })
    assert.equal(r.status, 403)

    const material = await criarMaterial(c.adminA.token, {})
    const patch = await req(api.url, `/conteudos/${material.corpo.conteudo.id_conteudo}`, {
      metodo: "PATCH",
      token: c.adminA.token,
      corpo: { url: anexoDaStartup.url },
    })
    assert.equal(patch.status, 403)
  })

  test("NAO aceita arquivo de outra incubadora nem caminho inventado", async () => {
    const daB = await subir(c.adminB.token, c.tenantB.id_tenant, "DA-B")
    assert.equal((await criarMaterial(c.adminA.token, { url: daB.url })).status, 400)
    assert.equal((await criarMaterial(c.adminA.token, { url: "/api/arquivos/nada" })).status, 400)
  })

  test("outro editor ajusta o titulo sem esbarrar no dono do arquivo", async () => {
    const arquivo = await subir(c.adminA.token, c.tenantA.id_tenant, "DO-ADMIN")
    const r = await criarMaterial(c.adminA.token, { url: arquivo.url })

    // O editor manda a url em todo salvamento, mesmo sem ela ter mudado.
    const patch = await req(api.url, `/conteudos/${r.corpo.conteudo.id_conteudo}`, {
      metodo: "PATCH",
      token: c.mentorA.token,
      corpo: { titulo: "Canvas revisado", url: arquivo.url },
    })
    assert.equal(patch.status, 200, JSON.stringify(patch.corpo))
  })
})
