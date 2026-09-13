/**
 * O documento da AULA: conversao do formato antigo e validacao da entrada.
 *
 * Nao precisa de banco — e tudo funcao pura. E o teste que responde a pergunta
 * que mais importa na troca de editor: uma aula escrita antes continua inteira
 * depois? Cada tipo de bloco antigo tem aqui o seu par no formato novo, e
 * perder um deles quebra este arquivo antes de quebrar uma aula de verdade.
 */
const { test, describe } = require("node:test")
const assert = require("node:assert/strict")

const {
  converterBlocos,
  documentoDe,
  validarDocumento,
  urlPermitida,
  DOCUMENTO_MAX_BYTES,
} = require("../src/services/documentoAula")

/** O texto de um bloco convertido, sem cerimonia. */
const textoDe = (bloco) => (bloco.content || []).map((t) => t.text).join("")

/** Roda `fn` e devolve o erro que ela lancou (ou falha, se nao lancar). */
function capturar(fn) {
  try {
    fn()
  } catch (erro) {
    return erro
  }
  assert.fail("deveria ter lancado erro")
}

describe("converterBlocos · o formato antigo continua inteiro", () => {
  test("titulo e subtitulo viram heading com o nivel certo", () => {
    const [h1, h2] = converterBlocos([
      { tipo: "h1", texto: "Business Model Canvas" },
      { tipo: "h2", texto: "Os 9 blocos" },
    ])

    assert.equal(h1.type, "heading")
    assert.equal(h1.props.level, 1)
    assert.equal(textoDe(h1), "Business Model Canvas")

    assert.equal(h2.type, "heading")
    assert.equal(h2.props.level, 2)
  })

  test("paragrafo e lista viram paragraph e bulletListItem", () => {
    const [p, item] = converterBlocos([
      { tipo: "paragrafo", texto: "O Canvas e um mapa de uma pagina." },
      { tipo: "lista", texto: "Segmentos de Cliente" },
    ])

    assert.equal(p.type, "paragraph")
    assert.equal(textoDe(p), "O Canvas e um mapa de uma pagina.")
    assert.equal(item.type, "bulletListItem")
    assert.equal(textoDe(item), "Segmentos de Cliente")
  })

  test("callout vira destaque e PRESERVA a variante", () => {
    const [dica, atencao, semVariante] = converterBlocos([
      { tipo: "callout", texto: "Comece pela proposta de valor.", variante: "dica" },
      { tipo: "callout", texto: "Regra dos 10/20/30.", variante: "atencao" },
      { tipo: "callout", texto: "Sem variante gravada." },
    ])

    assert.equal(dica.type, "destaque")
    assert.equal(dica.props.variante, "dica")
    assert.equal(atencao.props.variante, "atencao")
    assert.equal(textoDe(atencao), "Regra dos 10/20/30.")

    // Bloco antigo sem variante existe no banco; vira o padrao, nao undefined.
    assert.equal(semVariante.props.variante, "dica")
  })

  test("video guarda url e nome, que e a legenda no formato novo", () => {
    const [video] = converterBlocos([
      {
        tipo: "video",
        texto: "",
        url: "https://www.youtube.com/watch?v=QoAOzMTLP5s",
        nome: "Alex Osterwalder explica o Canvas",
      },
    ])

    assert.equal(video.type, "videoEmbutido")
    assert.equal(video.props.url, "https://www.youtube.com/watch?v=QoAOzMTLP5s")
    assert.equal(video.props.legenda, "Alex Osterwalder explica o Canvas")
  })

  test("arquivo vira anexo e divisor vira divider", () => {
    const [anexo, divisor] = converterBlocos([
      { tipo: "arquivo", url: "/api/arquivos/abc", nome: "modelo.pdf" },
      { tipo: "divisor", texto: "" },
    ])

    assert.equal(anexo.type, "anexo")
    assert.equal(anexo.props.nome, "modelo.pdf")
    assert.equal(anexo.props.url, "/api/arquivos/abc")
    assert.equal(divisor.type, "divider")
  })

  test("tipo desconhecido vira paragrafo em vez de sumir com o texto", () => {
    const [bloco] = converterBlocos([{ tipo: "tipo-que-nao-existe", texto: "texto que importa" }])

    assert.equal(bloco.type, "paragraph")
    assert.equal(textoDe(bloco), "texto que importa")
  })

  test("lista vazia e entrada invalida devolvem documento vazio", () => {
    assert.deepEqual(converterBlocos([]), [])
    assert.deepEqual(converterBlocos(null), [])
    assert.deepEqual(converterBlocos(undefined), [])
  })

  test("bloco sem texto nao vira conteudo inventado", () => {
    const [bloco] = converterBlocos([{ tipo: "paragrafo", texto: null }])
    assert.deepEqual(bloco.content, [])
  })
})

describe("documentoDe · de onde sai o corpo da aula", () => {
  test("documento gravado vence os blocos antigos", () => {
    const gravado = [{ type: "paragraph", content: [{ type: "text", text: "novo", styles: {} }] }]
    const saida = documentoDe(
      { tipo: "AULA", documento: gravado },
      [{ tipo: "paragrafo", texto: "antigo" }]
    )

    assert.deepEqual(saida, gravado)
  })

  test("sem documento gravado, converte os blocos", () => {
    const saida = documentoDe({ tipo: "AULA", documento: null }, [
      { tipo: "h1", texto: "Aula antiga" },
    ])

    assert.equal(saida.length, 1)
    assert.equal(saida[0].type, "heading")
  })

  test("conteudo que nao e AULA nao tem documento", () => {
    assert.equal(documentoDe({ tipo: "LINK", documento: null }, []), undefined)
    assert.equal(documentoDe({ tipo: "VIDEO" }, []), undefined)
  })
})

describe("validarDocumento · o portao de entrada", () => {
  const paragrafo = (texto) => ({
    type: "paragraph",
    content: [{ type: "text", text: texto, styles: {} }],
  })

  test("documento bem formado passa", () => {
    validarDocumento("AULA", [
      paragrafo("Tudo certo."),
      { type: "heading", props: { level: 2 }, content: [] },
      { type: "destaque", props: { variante: "dica" }, content: [] },
      { type: "divider" },
      { type: "bulletListItem", content: [], children: [paragrafo("aninhado")] },
    ])
  })

  test("so AULA tem documento", () => {
    const erro = capturar(() => validarDocumento("LINK", []))
    assert.equal(erro.status, 400)
    assert.match(erro.message, /AULA/)
  })

  test("documento precisa ser uma lista", () => {
    assert.equal(capturar(() => validarDocumento("AULA", { type: "paragraph" })).status, 400)
    assert.equal(capturar(() => validarDocumento("AULA", "texto")).status, 400)
  })

  test("tipo de bloco desconhecido e recusado", () => {
    const erro = capturar(() => validarDocumento("AULA", [{ type: "scriptMalicioso" }]))
    assert.equal(erro.status, 400)
    assert.match(erro.message, /Bloco 1/)
  })

  test("bloco que nao e objeto e recusado", () => {
    assert.equal(capturar(() => validarDocumento("AULA", ["texto solto"])).status, 400)
    assert.equal(capturar(() => validarDocumento("AULA", [null])).status, 400)
  })

  test("link javascript: NAO entra no documento", () => {
    const erro = capturar(() =>
      validarDocumento("AULA", [
        {
          type: "paragraph",
          content: [
            { type: "link", href: "javascript:alert(document.cookie)", content: [] },
          ],
        },
      ])
    )
    assert.equal(erro.status, 400)
    assert.match(erro.message, /link/)
  })

  test("url de bloco com esquema perigoso NAO entra", () => {
    const erro = capturar(() =>
      validarDocumento("AULA", [{ type: "anexo", props: { url: "javascript:void(0)" } }])
    )
    assert.equal(erro.status, 400)
  })

  test("imagem aceita data:image, que e o que colar produz", () => {
    validarDocumento("AULA", [
      { type: "image", props: { url: "data:image/png;base64,iVBORw0KGgo=" } },
    ])
  })

  test("mas data:text/html continua barrado, inclusive em imagem", () => {
    const erro = capturar(() =>
      validarDocumento("AULA", [
        { type: "image", props: { url: "data:text/html;base64,PHNjcmlwdD4=" } },
      ])
    )
    assert.equal(erro.status, 400)
  })

  test("url relativa da propria API passa", () => {
    validarDocumento("AULA", [
      { type: "anexo", props: { url: "/api/arquivos/7b1c-uuid", nome: "plano.pdf" } },
    ])
  })

  test("bloco sem midia ainda (url vazia) passa", () => {
    validarDocumento("AULA", [{ type: "videoEmbutido", props: { url: "", legenda: "" } }])
  })

  test("documento acima do teto e recusado", () => {
    const enorme = [paragrafo("x".repeat(DOCUMENTO_MAX_BYTES + 1))]
    const erro = capturar(() => validarDocumento("AULA", enorme))
    assert.equal(erro.status, 400)
    assert.match(erro.message, /tamanho/)
  })

  test("aninhamento sem fim e recusado antes de estourar a pilha", () => {
    let bloco = { type: "paragraph", content: [] }
    for (let i = 0; i < 40; i++) {
      bloco = { type: "bulletListItem", content: [], children: [bloco] }
    }

    const erro = capturar(() => validarDocumento("AULA", [bloco]))
    assert.equal(erro.status, 400)
    assert.match(erro.message, /aninhados/)
  })

  test("children precisa ser lista", () => {
    const erro = capturar(() =>
      validarDocumento("AULA", [{ type: "paragraph", content: [], children: "nao e lista" }])
    )
    assert.equal(erro.status, 400)
  })
})

describe("urlPermitida", () => {
  test("aceita o que um autor de aula usa de verdade", () => {
    for (const url of [
      "https://exemplo.test/guia.pdf",
      "http://exemplo.test",
      "mailto:mentor@incubadora.test",
      "tel:+5511999999999",
      "/api/arquivos/uuid",
      "guia.pdf",
      "",
    ]) {
      assert.ok(urlPermitida(url), `deveria aceitar: ${url}`)
    }
  })

  test("recusa o que executaria algo no navegador de quem le", () => {
    for (const url of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
    ]) {
      assert.ok(!urlPermitida(url), `deveria recusar: ${url}`)
    }
  })
})
