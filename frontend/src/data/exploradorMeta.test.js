import { describe, expect, test } from "vitest"
import {
  ARQUIVADOS,
  caminhoDaPasta,
  chaveDe,
  contarConteudo,
  descendentes,
  editavelNoNavegador,
  itensDaVisao,
  lerCsv,
  letraDaColuna,
  nomeLivre,
  ordenarItens,
  podeSoltar,
  rotuloDoLocal,
  separarChaves,
  tipoDePrevia,
} from "./exploradorMeta"

// Raiz
// ├── 1 Pitch
// │   └── 2 Modelos
// │       └── 3 Antigos
// └── 4 Financeiro
const PASTAS = [
  { id_pasta: 1, id_pasta_pai: null, nome: "Pitch" },
  { id_pasta: 2, id_pasta_pai: 1, nome: "Modelos" },
  { id_pasta: 3, id_pasta_pai: 2, nome: "Antigos" },
  { id_pasta: 4, id_pasta_pai: null, nome: "Financeiro" },
]

const MATERIAIS = [
  { id_material: 10, id_pasta: null, titulo: "Planilha de caixa", tipo: "ARQUIVO", arquivo_mime: "text/csv", arquivado: false, total_compartilhamentos: 0, categoria: "Planilha" },
  { id_material: 11, id_pasta: 2, titulo: "Roteiro do pitch", tipo: "LINK", arquivado: false, total_compartilhamentos: 2, categoria: "Roteiro" },
  { id_material: 12, id_pasta: 3, titulo: "Pitch 2024", tipo: "ARQUIVO", arquivo_mime: "application/pdf", arquivado: false, total_compartilhamentos: 0 },
  { id_material: 13, id_pasta: 2, titulo: "Pitch velho", tipo: "LINK", arquivado: true, total_compartilhamentos: 0 },
]

describe("chaves e caminho", () => {
  test("pasta e material tem chaves distintas, mesmo com o mesmo id", () => {
    expect(chaveDe(PASTAS[0])).toBe("p:1")
    expect(chaveDe({ id_material: 1, id_pasta: 1 })).toBe("m:1")
    expect(separarChaves(["p:1", "m:10", "m:11"])).toEqual({ pastas: [1], materiais: [10, 11] })
  })

  test("o caminho vai da raiz ate a pasta", () => {
    expect(caminhoDaPasta(PASTAS, 3).map((p) => p.nome)).toEqual(["Pitch", "Modelos", "Antigos"])
    expect(caminhoDaPasta(PASTAS, null)).toEqual([])
    expect(caminhoDaPasta(PASTAS, 99)).toEqual([])
    expect(rotuloDoLocal(PASTAS, 2)).toBe("Minha biblioteca › Pitch › Modelos")
  })

  test("descendentes incluem a propria pasta e todos os niveis", () => {
    expect([...descendentes(PASTAS, 1)].sort()).toEqual([1, 2, 3])
    expect(descendentes(PASTAS, null).size).toBe(5) // a raiz e as quatro
  })
})

describe("soltar", () => {
  test("pasta nao entra nela mesma nem numa descendente", () => {
    expect(podeSoltar(PASTAS, [PASTAS[0]], 3)).toBe(false)
    expect(podeSoltar(PASTAS, [PASTAS[0]], 1)).toBe(false)
    expect(podeSoltar(PASTAS, [PASTAS[2]], 4)).toBe(true)
  })

  test("soltar onde ja esta nao e movimento", () => {
    expect(podeSoltar(PASTAS, [MATERIAIS[1]], 2)).toBe(false)
    expect(podeSoltar(PASTAS, [MATERIAIS[1]], null)).toBe(true)
    expect(podeSoltar(PASTAS, [], 1)).toBe(false)
  })

  test("conta o que esta diretamente na pasta", () => {
    expect(contarConteudo(PASTAS, MATERIAIS, 2)).toEqual({ pastas: 1, materiais: 2 })
  })
})

describe("nome livre", () => {
  test("sufixo como o do servidor", () => {
    expect(nomeLivre("Nova pasta", ["Pitch"])).toBe("Nova pasta")
    expect(nomeLivre("Nova pasta", ["nova pasta", "Nova pasta (2)"])).toBe("Nova pasta (3)")
  })
})

describe("o que a visao mostra", () => {
  test("a pasta: subpastas e materiais ativos dela, e so dela", () => {
    const { itens, plana } = itensDaVisao({ pastas: PASTAS, materiais: MATERIAIS, pasta: 2 })
    expect(plana).toBe(false)
    expect(itens.map(chaveDe)).toEqual(["p:3", "m:11"])
  })

  test("a raiz", () => {
    const { itens } = itensDaVisao({ pastas: PASTAS, materiais: MATERIAIS, pasta: null })
    expect(itens.map(chaveDe)).toEqual(["p:4", "p:1", "m:10"])
  })

  test("a busca olha a pasta e tudo dentro dela, sem acento nem maiuscula", () => {
    const { itens, plana } = itensDaVisao({ pastas: PASTAS, materiais: MATERIAIS, pasta: 1, busca: "PITCH" })
    expect(plana).toBe(true)
    expect(itens.map(chaveDe).sort()).toEqual(["m:11", "m:12"])
    const raiz = itensDaVisao({ pastas: PASTAS, materiais: MATERIAIS, pasta: null, busca: "modelos" })
    expect(raiz.itens.map(chaveDe)).toEqual(["p:2"])
  })

  test("filtro e de material: com ele, pasta nao entra", () => {
    const { itens } = itensDaVisao({
      pastas: PASTAS,
      materiais: MATERIAIS,
      pasta: null,
      filtros: { compartilhado: "SIM" },
    })
    expect(itens.map(chaveDe)).toEqual(["m:11"])
  })

  test("os arquivados de toda a biblioteca", () => {
    const { itens } = itensDaVisao({ pastas: PASTAS, materiais: MATERIAIS, pasta: ARQUIVADOS })
    expect(itens.map(chaveDe)).toEqual(["m:13"])
  })

  test("pastas primeiro, qualquer que seja a ordem", () => {
    const itens = [MATERIAIS[0], PASTAS[1], { ...MATERIAIS[2], arquivo_tamanho: 10 }, PASTAS[0]]
    // "Pitch 2024" antes de "Planilha de caixa"; o maior primeiro no tamanho.
    expect(ordenarItens(itens, { campo: "nome" }).map(chaveDe)).toEqual(["p:2", "p:1", "m:12", "m:10"])
    expect(ordenarItens(itens, { campo: "tamanho" }).map(chaveDe)).toEqual(["p:2", "p:1", "m:10", "m:12"])
    expect(ordenarItens(itens, { campo: "tamanho", direcao: "desc" }).map(chaveDe)).toEqual(["p:2", "p:1", "m:12", "m:10"])
  })
})

describe("pre-visualizacao", () => {
  test("o tipo de previa sai do MIME", () => {
    expect(tipoDePrevia({ tipo: "ARQUIVO", arquivo_mime: "application/pdf" })).toBe("PDF")
    expect(tipoDePrevia({ tipo: "ARQUIVO", arquivo_mime: "image/png" })).toBe("IMAGEM")
    expect(
      tipoDePrevia({ tipo: "ARQUIVO", arquivo_mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })
    ).toBe("DOCX")
    expect(tipoDePrevia({ tipo: "ARQUIVO", arquivo_mime: "application/vnd.ms-powerpoint" })).toBe(null)
    expect(tipoDePrevia({ tipo: "LINK", url: "https://x.y" })).toBe("LINK")
  })

  test("so texto se edita no navegador", () => {
    expect(editavelNoNavegador({ tipo: "ARQUIVO", arquivo_mime: "text/plain" })).toBe(true)
    expect(editavelNoNavegador({ tipo: "ARQUIVO", arquivo_mime: "text/csv" })).toBe(true)
    expect(editavelNoNavegador({ tipo: "ARQUIVO", arquivo_mime: "application/pdf" })).toBe(false)
  })

  test("CSV com ponto e virgula, aspas e quebra de linha no campo", () => {
    const linhas = lerCsv('Nome;Obs\r\n"Acme";"disse ""oi""\nduas vezes"\nBeta;ok')
    expect(linhas).toEqual([
      ["Nome", "Obs"],
      ["Acme", 'disse "oi"\nduas vezes'],
      ["Beta", "ok"],
    ])
    expect(lerCsv("a,b\n1,2")).toEqual([["a", "b"], ["1", "2"]])
  })

  test("letras de coluna", () => {
    expect([0, 25, 26, 27, 701].map(letraDaColuna)).toEqual(["A", "Z", "AA", "AB", "ZZ"])
  })
})
