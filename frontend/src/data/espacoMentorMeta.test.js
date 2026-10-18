/**
 * Os filtros e rotulos do Espaco do Mentor (espacoMentorMeta.js).
 *
 * As listagens filtram em memoria o que o backend devolve inteiro; um filtro
 * errado aqui esconde material que existe — ou mostra o arquivado como se
 * fosse de trabalho. O formato tem uma armadilha propria: "ARQUIVO" quer dizer
 * coisas diferentes na biblioteca pessoal e na da incubadora.
 */
import { describe, expect, test } from "vitest"
import {
  formatoDoMime,
  formatoDoMaterial,
  rotuloEtapa,
  filtrarMateriais,
  filtrarCompartilhamentos,
  agruparRecebidos,
  sugestoesDeCategoria,
  normalizarBusca,
  publicadoHaPouco,
} from "./espacoMentorMeta"

describe("formato", () => {
  test("pelo MIME do arquivo enviado", () => {
    expect(formatoDoMime("application/pdf")).toBe("PDF")
    expect(formatoDoMime("image/png")).toBe("IMAGEM")
    expect(formatoDoMime("text/csv")).toBe("PLANILHA")
    expect(
      formatoDoMime("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    ).toBe("PLANILHA")
    expect(
      formatoDoMime("application/vnd.openxmlformats-officedocument.presentationml.presentation")
    ).toBe("APRESENTACAO")
    expect(formatoDoMime("application/msword")).toBe("DOCUMENTO")
    expect(formatoDoMime("application/zip")).toBe("ARQUIVO")
    expect(formatoDoMime(null)).toBe("ARQUIVO")
  })

  test("material pessoal: link e link, arquivo e o MIME", () => {
    expect(formatoDoMaterial({ tipo: "LINK" })).toBe("LINK")
    expect(formatoDoMaterial({ tipo: "ARQUIVO", arquivo_mime: "application/pdf" })).toBe("PDF")
  })

  test("conteudo da incubadora: o tipo da Biblioteca, e ARQUIVO nao vira PDF", () => {
    expect(formatoDoMaterial({ origem: "INSTITUCIONAL", tipo: "AULA" })).toBe("AULA")
    expect(formatoDoMaterial({ origem: "INSTITUCIONAL", tipo: "VIDEO" })).toBe("VIDEO")
    expect(formatoDoMaterial({ origem: "INSTITUCIONAL", tipo: "ARQUIVO" })).toBe("ARQUIVO")
  })
})

describe("rotuloEtapa", () => {
  test("trilha inteira, fase e passo", () => {
    expect(rotuloEtapa({ id_no: null })).toBe("Trilha inteira")
    expect(rotuloEtapa({ id_no: 3, etapa_tipo: "FASE", fase_nome: "Validação" })).toBe("Validação")
    expect(
      rotuloEtapa({ id_no: 9, etapa_tipo: "PASSO", fase_nome: "Validação", etapa_nome: "Entrevistas" })
    ).toBe("Validação › Entrevistas")
  })
})

describe("filtrarMateriais", () => {
  const materiais = [
    { titulo: "Modelo de hipóteses", descricao: "Mercado", categoria: "Modelo", tipo: "ARQUIVO", arquivo_mime: "application/pdf", arquivado: false, total_compartilhamentos: 2 },
    { titulo: "Roteiro", descricao: "Entrevista de problema", categoria: "Roteiro", tipo: "LINK", arquivado: false, total_compartilhamentos: 0 },
    { titulo: "Planilha antiga", descricao: null, categoria: "Modelo", tipo: "ARQUIVO", arquivo_mime: "text/csv", arquivado: true, total_compartilhamentos: 0 },
  ]

  test("por padrao, so os ativos: o arquivado sai da biblioteca de trabalho", () => {
    expect(filtrarMateriais(materiais).map((m) => m.titulo)).toEqual(["Modelo de hipóteses", "Roteiro"])
    expect(filtrarMateriais(materiais, { situacao: "ARQUIVADOS" }).map((m) => m.titulo)).toEqual([
      "Planilha antiga",
    ])
    expect(filtrarMateriais(materiais, { situacao: "TODOS" })).toHaveLength(3)
  })

  test("busca no titulo e na descricao, sem acento e sem maiuscula", () => {
    expect(filtrarMateriais(materiais, { busca: "HIPOTESES" })).toHaveLength(1)
    expect(filtrarMateriais(materiais, { busca: "entrevista" }).map((m) => m.titulo)).toEqual(["Roteiro"])
  })

  test("categoria, formato e compartilhado", () => {
    expect(filtrarMateriais(materiais, { categorias: ["Modelo"] })).toHaveLength(1)
    expect(filtrarMateriais(materiais, { formatos: ["LINK"] }).map((m) => m.titulo)).toEqual(["Roteiro"])
    expect(filtrarMateriais(materiais, { compartilhado: "SIM" }).map((m) => m.titulo)).toEqual([
      "Modelo de hipóteses",
    ])
    expect(filtrarMateriais(materiais, { compartilhado: "NAO" }).map((m) => m.titulo)).toEqual(["Roteiro"])
  })
})

describe("filtrarCompartilhamentos", () => {
  const lista = [
    { id_startup: 1, startup_nome: "Acme", id_programa: 10, programa_nome: "Pré-incubação", finalidade: "REFERENCIA", origem: "PESSOAL", situacao: "DISPONIVEL", meu: true, titulo: "Canvas", orientacao: "Traga preenchido", id_no: null },
    { id_startup: 2, startup_nome: "Beta", id_programa: 10, programa_nome: "Pré-incubação", finalidade: "ATIVIDADE", origem: "INSTITUCIONAL", situacao: "FORA_DA_TRILHA", meu: false, titulo: "Pitch", orientacao: null, id_no: 5, etapa_tipo: "PASSO", fase_nome: "Tração", etapa_nome: "Pitch deck" },
  ]

  test("por startup, finalidade, origem e situacao", () => {
    expect(filtrarCompartilhamentos(lista, { startups: [2] })).toHaveLength(1)
    expect(filtrarCompartilhamentos(lista, { finalidades: ["ATIVIDADE"] })[0].titulo).toBe("Pitch")
    expect(filtrarCompartilhamentos(lista, { origens: ["PESSOAL"] })[0].titulo).toBe("Canvas")
    expect(filtrarCompartilhamentos(lista, { situacoes: ["DISPONIVEL"] })).toHaveLength(1)
  })

  test("autoria: os meus ou os dos outros mentores", () => {
    expect(filtrarCompartilhamentos(lista, { autoria: "MEUS" })[0].titulo).toBe("Canvas")
    expect(filtrarCompartilhamentos(lista, { autoria: "OUTROS" })[0].titulo).toBe("Pitch")
  })

  test("a busca alcanca startup, orientacao e etapa", () => {
    expect(filtrarCompartilhamentos(lista, { busca: "acme" })).toHaveLength(1)
    expect(filtrarCompartilhamentos(lista, { busca: "preenchido" })).toHaveLength(1)
    expect(filtrarCompartilhamentos(lista, { busca: "tracao" })[0].titulo).toBe("Pitch")
  })
})

describe("agruparRecebidos", () => {
  const recebidos = [
    { id_compartilhamento: 1, id_no: null },
    { id_compartilhamento: 2, id_no: 3, etapa_tipo: "FASE", id_fase: 3 },
    { id_compartilhamento: 3, id_no: 9, etapa_tipo: "PASSO", id_fase: 3 },
    { id_compartilhamento: 4, id_no: 12, etapa_tipo: "PASSO", id_fase: 11 },
  ]

  test("trilha, fase (com os passos dela) e passo", () => {
    const g = agruparRecebidos(recebidos)
    expect(g.daTrilha.map((m) => m.id_compartilhamento)).toEqual([1])
    expect(g.porFase(3).map((m) => m.id_compartilhamento)).toEqual([2, 3])
    expect(g.doPasso(9).map((m) => m.id_compartilhamento)).toEqual([3])
    expect(g.doPasso(3)).toEqual([])
  })
})

describe("publicadoHaPouco", () => {
  const agora = new Date("2026-10-17T12:00:00Z").getTime()
  test("o selo Novo vale por duas semanas", () => {
    expect(publicadoHaPouco("2026-10-10T12:00:00Z", agora)).toBe(true)
    expect(publicadoHaPouco("2026-09-30T12:00:00Z", agora)).toBe(false)
    expect(publicadoHaPouco(null, agora)).toBe(false)
  })
})

describe("categorias", () => {
  test("as em uso primeiro, sem repetir as sugestoes", () => {
    const s = sugestoesDeCategoria(["Financeiro", "modelo"])
    expect(s[0]).toBe("Financeiro")
    expect(s[1]).toBe("modelo")
    expect(s.filter((c) => normalizarBusca(c) === "modelo")).toHaveLength(1)
  })
})
