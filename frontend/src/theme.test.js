/**
 * Garantias de contraste da paleta derivada (theme.js).
 *
 * A cor principal e escolha do usuario, entao a regra nao pode valer so para
 * o lima: vale para todas as cores oferecidas no painel de conta — as da
 * identidade e a paleta que ja existia antes dela.
 */
import { describe, expect, it } from "vitest"
import { getContrastRatio } from "@mui/material/styles"
import { CORES_PRINCIPAIS, MARCA, SUPERFICIES, construirTema, paletaDaCor } from "./theme"

const CORES = CORES_PRINCIPAIS.map((c) => c.cor)
const MODOS = [
  ["claro", false, 4.5],
  ["escuro", true, 6],
]

describe.each(MODOS)("paletaDaCor no tema %s", (nome, escuro, alvo) => {
  const { fundo, papel } = escuro ? SUPERFICIES.escuro : SUPERFICIES.claro

  it.each(CORES)("%s: main legivel como texto sobre fundo e papel", (cor) => {
    const { main } = paletaDaCor(cor, escuro)
    expect(main).toMatch(/^#[0-9a-f]{6}$/i)
    expect(getContrastRatio(main, fundo)).toBeGreaterThanOrEqual(alvo)
    expect(getContrastRatio(main, papel)).toBeGreaterThanOrEqual(alvo)
  })

  it.each(CORES)("%s: texto legivel sobre o main e sobre o vivo", (cor) => {
    const p = paletaDaCor(cor, escuro)
    expect(getContrastRatio(p.contrastText, p.main)).toBeGreaterThanOrEqual(4.5)
    expect(getContrastRatio(p.vivoContraste, p.vivo)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(CORES)("%s: barra do topo legivel (texto, avatar e logo)", (cor) => {
    const { barra } = construirTema({ tema: nome, cor_primaria: cor, borda_arredondada: 12 }).palette
    expect(getContrastRatio(barra.texto, barra.fundo)).toBeGreaterThanOrEqual(4.5)
    expect(getContrastRatio(barra.destaqueTexto, barra.destaque)).toBeGreaterThanOrEqual(4.5)
    // O centauro e o avatar sao grafismo sobre a barra: 3:1 (WCAG 1.4.11).
    expect(getContrastRatio(barra.destaque, barra.fundo)).toBeGreaterThanOrEqual(3)
  })

  it("a barra muda com a cor escolhida", () => {
    const fundo = (cor) => construirTema({ tema: nome, cor_primaria: cor, borda_arredondada: 12 }).palette.barra.fundo
    expect(new Set(CORES.map(fundo)).size).toBe(CORES.length)
  })
})

describe("identidade", () => {
  it("lima entra puro no escuro e como preenchimento com texto preto no claro", () => {
    const escuro = paletaDaCor(MARCA.lima, true)
    expect(escuro.main).toBe(MARCA.lima)
    expect(escuro.contrastText).toBe("#0a0a0a")

    const claro = paletaDaCor(MARCA.lima, false)
    expect(claro.vivo).toBe(MARCA.lima)
    expect(claro.vivoContraste).toBe("#0a0a0a")
    expect(claro.main).not.toBe(MARCA.lima)
  })

  it("cor salva invalida cai no lima em vez de quebrar o tema", () => {
    const tema = construirTema({ tema: "escuro", cor_primaria: "azul", borda_arredondada: 12 })
    expect(tema.palette.primary.main).toBe(MARCA.lima)
    expect(tema.palette.background.default).toBe(SUPERFICIES.escuro.fundo)
  })
})
