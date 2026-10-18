/**
 * O vocabulario e a normalizacao do Espaco do Mentor (mentores/material.js),
 * sem banco.
 *
 * O que vale testar aqui e o que chega do formulario antes de qualquer
 * consulta: o corpo minimo de cada tipo de material, o link que nao pode virar
 * `javascript:` num <a href>, a origem que tem de ser exatamente uma, e a
 * atividade que nao existe sem a etapa.
 */
const { test, describe } = require("node:test")
const assert = require("node:assert/strict")

const {
  normalizarMaterial,
  normalizarPatchMaterial,
  normalizarCompartilhamento,
  normalizarPatchCompartilhamento,
  MAX_ORIENTACAO,
} = require("../src/mentores/material")

const UUID = "3F2504E0-4F89-11D3-9A0C-0305E82C3301"

/** Afirma que a funcao recusa com 400 (erro de negocio, nao exception crua). */
function recusa(fn, trecho) {
  assert.throws(fn, (err) => {
    assert.equal(err.status, 400, `status ${err.status}: ${err.message}`)
    if (trecho) assert.match(err.message, trecho)
    return true
  })
}

describe("material novo", () => {
  test("LINK guarda o endereco e descarta o arquivo que o formulario tenha guardado", () => {
    const m = normalizarMaterial({
      tipo: "link",
      titulo: "  Guia de entrevistas  ",
      url: "https://exemplo.com/guia",
      id_arquivo: UUID,
      categoria: "  Roteiro   de   entrevista ",
    })
    assert.equal(m.tipo, "LINK")
    assert.equal(m.titulo, "Guia de entrevistas")
    assert.equal(m.url, "https://exemplo.com/guia")
    assert.equal(m.idArquivo, null)
    assert.equal(m.categoria, "Roteiro de entrevista")
  })

  test("ARQUIVO exige o id do arquivo enviado, e o grava em minusculas", () => {
    const m = normalizarMaterial({ tipo: "ARQUIVO", titulo: "Canvas", id_arquivo: UUID })
    assert.equal(m.idArquivo, UUID.toLowerCase())
    assert.equal(m.url, null)
    recusa(() => normalizarMaterial({ tipo: "ARQUIVO", titulo: "Canvas" }), /arquivo/)
    recusa(() => normalizarMaterial({ tipo: "ARQUIVO", titulo: "Canvas", id_arquivo: "1 OR 1=1" }))
  })

  test("titulo e tipo sao obrigatorios", () => {
    recusa(() => normalizarMaterial({ tipo: "LINK", titulo: "   ", url: "https://x.y" }), /titulo/)
    recusa(() => normalizarMaterial({ tipo: "PASTA", titulo: "x", url: "https://x.y" }), /Tipo/)
  })

  test("link so http(s): javascript: e data: nao passam", () => {
    recusa(() => normalizarMaterial({ tipo: "LINK", titulo: "x", url: "javascript:alert(1)" }))
    recusa(() => normalizarMaterial({ tipo: "LINK", titulo: "x", url: "data:text/html,<b>x</b>" }))
    recusa(() => normalizarMaterial({ tipo: "LINK", titulo: "x", url: "" }), /endereco/)
  })

  test("descricao e categoria vazias viram null", () => {
    const m = normalizarMaterial({ tipo: "LINK", titulo: "x", url: "https://x.y", descricao: "  ", categoria: "" })
    assert.equal(m.descricao, null)
    assert.equal(m.categoria, null)
  })
})

describe("patch de material", () => {
  const atual = {
    titulo: "Planilha",
    descricao: "Unit economics",
    categoria: "Financeiro",
    tipo: "ARQUIVO",
    id_arquivo: UUID.toLowerCase(),
    url: null,
  }

  test("campo ausente fica como esta", () => {
    const final = normalizarPatchMaterial(atual, { titulo: "Planilha v2" })
    assert.equal(final.titulo, "Planilha v2")
    assert.equal(final.descricao, "Unit economics")
    assert.equal(final.idArquivo, atual.id_arquivo)
    assert.equal(final.arquivado, undefined)
  })

  test("trocar para LINK exige o endereco e larga o arquivo", () => {
    recusa(() => normalizarPatchMaterial(atual, { tipo: "LINK" }), /endereco/)
    const final = normalizarPatchMaterial(atual, { tipo: "LINK", url: "https://docs.exemplo/x" })
    assert.equal(final.idArquivo, null)
    assert.equal(final.url, "https://docs.exemplo/x")
  })

  test("arquivar e desarquivar chegam como booleano", () => {
    assert.equal(normalizarPatchMaterial(atual, { arquivado: true }).arquivado, true)
    assert.equal(normalizarPatchMaterial(atual, { arquivado: false }).arquivado, false)
  })

  test("o titulo nao pode ser apagado", () => {
    recusa(() => normalizarPatchMaterial(atual, { titulo: "" }), /titulo/)
  })
})

describe("compartilhamento", () => {
  const base = { id_startup: 1, id_programa: 10 }

  test("a origem e exatamente uma: nem as duas, nem nenhuma", () => {
    recusa(() => normalizarCompartilhamento(base), /material/)
    recusa(() => normalizarCompartilhamento({ ...base, id_material: 1, id_conteudo: 2 }), /material/)
    const c = normalizarCompartilhamento({ ...base, id_conteudo: "2" })
    assert.equal(c.idConteudo, 2)
    assert.equal(c.idMaterial, null)
  })

  test("sem finalidade e referencia; sem etapa e a trilha inteira", () => {
    const c = normalizarCompartilhamento({ ...base, id_material: 3 })
    assert.equal(c.finalidade, "REFERENCIA")
    assert.equal(c.idNo, null)
  })

  test("atividade sem a etapa nao existe", () => {
    recusa(
      () => normalizarCompartilhamento({ ...base, id_material: 3, finalidade: "ATIVIDADE" }),
      /passo/
    )
    const c = normalizarCompartilhamento({ ...base, id_material: 3, finalidade: "atividade", id_no: 7 })
    assert.equal(c.finalidade, "ATIVIDADE")
    assert.equal(c.idNo, 7)
  })

  test("startup e trilha sao obrigatorias e inteiras", () => {
    recusa(() => normalizarCompartilhamento({ id_programa: 10, id_material: 3 }), /startup/)
    recusa(() => normalizarCompartilhamento({ id_startup: "abc", id_programa: 10, id_material: 3 }))
    recusa(() => normalizarCompartilhamento({ id_startup: 1, id_material: 3 }), /trilha/)
  })

  test("finalidade fora da lista e orientacao longa demais sao recusadas", () => {
    recusa(() => normalizarCompartilhamento({ ...base, id_material: 3, finalidade: "OBRIGATORIA" }))
    recusa(() =>
      normalizarCompartilhamento({ ...base, id_material: 3, orientacao: "x".repeat(MAX_ORIENTACAO + 1) })
    )
  })

  test("o patch so mexe na orientacao e na finalidade", () => {
    const atual = { orientacao: "Leia antes da mentoria.", finalidade: "REFERENCIA" }
    assert.deepEqual(normalizarPatchCompartilhamento(atual, { orientacao: "  " }), {
      orientacao: null,
      finalidade: "REFERENCIA",
    })
    assert.deepEqual(normalizarPatchCompartilhamento(atual, { finalidade: "ATIVIDADE" }), {
      orientacao: "Leia antes da mentoria.",
      finalidade: "ATIVIDADE",
    })
  })
})
