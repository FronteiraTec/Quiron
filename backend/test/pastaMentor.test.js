/**
 * As regras da arvore de pastas da biblioteca do mentor (mentores/pastas.js),
 * sem banco.
 *
 * O que vale testar aqui e o que a transacao decide sobre o retrato travado:
 * uma pasta nao vai para dentro dela mesma (nem de uma neta), irmas nao
 * repetem nome, e "Nova pasta" ganha o sufixo certo.
 */
const { test, describe } = require("node:test")
const assert = require("node:assert/strict")

const {
  MAX_NOME,
  nomePasta,
  idPastaOuRaiz,
  normalizarMovimento,
  nomeLivre,
  conferirMovimento,
} = require("../src/mentores/pastas")

function recusa(fn, status, trecho) {
  assert.throws(fn, (err) => {
    assert.equal(err.status, status, `status ${err.status}: ${err.message}`)
    if (trecho) assert.match(err.message, trecho)
    return true
  })
}

// Raiz
// ├── 1 Pitch
// │   └── 2 Modelos
// │       └── 3 Antigos
// └── 4 Financeiro
//     └── 5 Modelos
const ARVORE = [
  { id_pasta: 1, id_pasta_pai: null, nome: "Pitch" },
  { id_pasta: 2, id_pasta_pai: 1, nome: "Modelos" },
  { id_pasta: 3, id_pasta_pai: 2, nome: "Antigos" },
  { id_pasta: 4, id_pasta_pai: null, nome: "Financeiro" },
  { id_pasta: 5, id_pasta_pai: 4, nome: "Modelos" },
]

describe("nome e ids", () => {
  test("o nome e aparado, perde espacos repetidos e tem teto", () => {
    assert.equal(nomePasta("  Modelos   de  pitch "), "Modelos de pitch")
    recusa(() => nomePasta("   "), 400, /nome/)
    recusa(() => nomePasta("x".repeat(MAX_NOME + 1)), 400, /maximo/)
  })

  test("pasta vazia e a raiz; id invalido e recusado", () => {
    assert.equal(idPastaOuRaiz(null), null)
    assert.equal(idPastaOuRaiz(""), null)
    assert.equal(idPastaOuRaiz(undefined), null)
    assert.equal(idPastaOuRaiz("7"), 7)
    recusa(() => idPastaOuRaiz("abc"), 400)
    recusa(() => idPastaOuRaiz(-1), 400)
  })

  test("o movimento exige algo para mover e tira repetidos", () => {
    recusa(() => normalizarMovimento({ destino: 1 }), 400, /mover/)
    recusa(() => normalizarMovimento({ materiais: "1,2" }), 400, /lista/)
    const m = normalizarMovimento({ destino: "", materiais: [3, "3", 4] })
    assert.deepEqual(m, { destino: null, pastas: [], materiais: [3, 4] })
  })
})

describe("nome livre", () => {
  test("o primeiro sufixo que nao esta em uso, sem diferenca de maiuscula", () => {
    assert.equal(nomeLivre("Nova pasta", []), "Nova pasta")
    assert.equal(nomeLivre("Nova pasta", ["nova PASTA"]), "Nova pasta (2)")
    assert.equal(nomeLivre("Nova pasta", ["Nova pasta", "Nova pasta (2)"]), "Nova pasta (3)")
  })

  test("o sufixo cabe no teto: o nome encurta, o numero fica", () => {
    const longo = "x".repeat(MAX_NOME)
    const livre = nomeLivre(longo, [longo])
    assert.equal(livre.length, MAX_NOME)
    assert.ok(livre.endsWith(" (2)"))
  })
})

describe("conferir um movimento", () => {
  test("mover para a raiz ou para outra pasta passa", () => {
    conferirMovimento(ARVORE, { destino: null, pastas: [3] })
    conferirMovimento(ARVORE, { destino: 4, pastas: [3] })
  })

  test("uma pasta nao vai para dentro dela mesma, nem de uma descendente", () => {
    recusa(() => conferirMovimento(ARVORE, { destino: 1, pastas: [1] }), 409, /dentro dela mesma/)
    recusa(() => conferirMovimento(ARVORE, { destino: 3, pastas: [1] }), 409, /dentro dela mesma/)
    recusa(() => conferirMovimento(ARVORE, { destino: 2, pastas: [4, 1] }), 409, /dentro dela mesma/)
  })

  test("pasta ou destino de fora do retrato do dono e 404", () => {
    recusa(() => conferirMovimento(ARVORE, { destino: 99, pastas: [] }), 404, /destino/)
    recusa(() => conferirMovimento(ARVORE, { destino: null, pastas: [99] }), 404)
  })

  test("nao chega onde ja ha uma irma com o mesmo nome", () => {
    recusa(() => conferirMovimento(ARVORE, { destino: 1, pastas: [5] }), 409, /"Modelos" em "Pitch"/)
  })

  test("duas pastas com o mesmo nome nao chegam juntas ao mesmo lugar", () => {
    recusa(() => conferirMovimento(ARVORE, { destino: null, pastas: [2, 5] }), 409, /raiz/)
  })

  test("a que ja esta no destino nao conflita consigo mesma, mas segura o nome", () => {
    conferirMovimento(ARVORE, { destino: 1, pastas: [2] })
    recusa(() => conferirMovimento(ARVORE, { destino: 1, pastas: [2, 5] }), 409, /Modelos/)
  })
})
