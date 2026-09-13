/**
 * As funcoes sobre o documento da aula.
 *
 * `documentoVazio` decide se o incubado ve a aula nova ou o caminho antigo, e
 * se uma aula recem-criada ja nasce "alterada" (o que dispararia uma gravacao
 * antes de alguem escrever nada). Errar aqui e sutil e visivel.
 */
import { describe, test, expect } from "vitest"
import { documentoVazio, conteudoInicial, documentoParaTexto } from "./documento"

const paragrafo = (texto) => ({
  type: "paragraph",
  content: texto ? [{ type: "text", text: texto, styles: {} }] : [],
})

describe("documentoVazio", () => {
  test("nada, lista vazia e paragrafo em branco contam como vazio", () => {
    expect(documentoVazio(undefined)).toBe(true)
    expect(documentoVazio(null)).toBe(true)
    expect(documentoVazio([])).toBe(true)
    // E o bloco que o editor cria sozinho ao abrir uma aula nova.
    expect(documentoVazio([paragrafo("")])).toBe(true)
    expect(documentoVazio([paragrafo("   ")])).toBe(true)
  })

  test("uma letra ja e conteudo", () => {
    expect(documentoVazio([paragrafo("a")])).toBe(false)
  })

  test("bloco sem texto ainda conta como conteudo", () => {
    // Imagem, divisor e tabela nao tem texto e mesmo assim sao a aula.
    expect(documentoVazio([{ type: "image", props: { url: "/api/arquivos/x" } }])).toBe(false)
    expect(documentoVazio([{ type: "divider" }])).toBe(false)
    expect(documentoVazio([{ type: "videoEmbutido", props: { url: "" } }])).toBe(false)
  })

  test("texto escondido num bloco aninhado conta", () => {
    const doc = [
      { type: "bulletListItem", content: [], children: [paragrafo("escrito aqui dentro")] },
    ]
    expect(documentoVazio(doc)).toBe(false)
  })

  test("codigo guarda o texto numa string, e nao numa lista", () => {
    expect(documentoVazio([{ type: "codeBlock", content: "npm test" }])).toBe(false)
    expect(documentoVazio([{ type: "codeBlock", content: "" }])).toBe(true)
  })
})

describe("conteudoInicial", () => {
  test("vazio vira undefined — o editor recusa lista vazia", () => {
    expect(conteudoInicial([])).toBeUndefined()
    expect(conteudoInicial(null)).toBeUndefined()
    expect(conteudoInicial(undefined)).toBeUndefined()
  })

  test("documento com blocos passa inteiro", () => {
    const doc = [paragrafo("aula")]
    expect(conteudoInicial(doc)).toBe(doc)
  })

  test("paragrafo em branco NAO e descartado", () => {
    // Vazio de conteudo, mas e um bloco de verdade: virar undefined aqui
    // faria o editor recriar o bloco e perder a referencia do cursor.
    expect(conteudoInicial([paragrafo("")])).toHaveLength(1)
  })
})

describe("documentoParaTexto", () => {
  test("junta o texto dos blocos, inclusive os aninhados", () => {
    const doc = [
      { type: "heading", props: { level: 1 }, content: [{ type: "text", text: "Pitch", styles: {} }] },
      paragrafo("Conte uma historia."),
      { type: "bulletListItem", content: [], children: [paragrafo("Problema")] },
    ]

    expect(documentoParaTexto(doc)).toBe("Pitch Conte uma historia. Problema")
  })

  test("corta no limite e marca a continuacao", () => {
    const texto = documentoParaTexto([paragrafo("palavra ".repeat(20))], 12)
    expect(texto).toHaveLength(13) // 12 + a reticencia
    expect(texto.endsWith("…")).toBe(true)
  })

  test("entrada invalida devolve string vazia", () => {
    expect(documentoParaTexto(null)).toBe("")
    expect(documentoParaTexto("nao e documento")).toBe("")
  })
})
