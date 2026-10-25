/**
 * Passo sem entrega (permite_entrega = FALSE) concluido pela propria startup.
 *
 * Ate 24/10/2026 o passo so de conteudo nao tinha como terminar: nao recebe
 * entrega, entao nunca chegava a APROVADO, e a Jornada o mostrava "a construir"
 * para sempre — com a barra de progresso presa abaixo de 100%.
 *
 *   1. Concluir e desfazer mudam o estado do passo na Jornada e o progresso da
 *      lista de trilhas, e concluir duas vezes nao conta em dobro.
 *   2. Passo COM entrega nao se conclui por aqui: quem conclui e o mentor.
 *   3. So membro da startup marca o passo dela.
 *   4. Fase feita so de passos sem entrega fecha quando todos sao concluidos.
 */
const { test, describe, before, after } = require("node:test")
const assert = require("node:assert/strict")

const { prepararBanco, encerrar } = require("../apoio-teste/banco")
const { subirApi, req } = require("../apoio-teste/api")
const trilhaRepository = require("../src/repositories/trilhaRepository")

let api
let c
let leitura // passo sem entrega, no mesmo modulo do passo do cenario

before(async () => {
  await prepararBanco()
  c = await require("../apoio-teste/cenario").montarCenario()
  api = await subirApi()

  leitura = await trilhaRepository.criar({
    idTenant: c.tenantA.id_tenant,
    idPai: c.passo.id_pai,
    tipo: "PASSO",
    nome: "Aula para ler",
    tipoPasso: "TEXTO",
    permiteEntrega: false,
  })
})

after(async () => {
  await api.fechar()
  await encerrar()
})

/** Marca ou desmarca a conclusao; devolve a resposta crua. */
function marcar(idNo, concluir, token = c.colaboradorA.token) {
  return req(api.url, `/jornada/${concluir ? "concluir" : "desfazer-conclusao"}`, {
    metodo: "POST",
    token,
    corpo: { id_no: idNo, id_startup: c.startupUm.id_startup },
  })
}

/** A Jornada da startupUm na trilha do cenario. */
async function jornada() {
  const r = await req(
    api.url,
    `/jornada?id_startup=${c.startupUm.id_startup}&id_trilha=${c.programa.id_no}`,
    { token: c.colaboradorA.token }
  )
  assert.equal(r.status, 200, `jornada respondeu ${JSON.stringify(r.corpo)}`)
  return r.corpo.jornada
}

function passoNa(j, idNo) {
  for (const e of j.estagios) {
    const p = e.passos.find((x) => x.id === idNo)
    if (p) return p
  }
  return undefined
}

async function progressoDaTrilha() {
  const r = await req(api.url, `/jornada/trilhas?id_startup=${c.startupUm.id_startup}`, {
    token: c.colaboradorA.token,
  })
  assert.equal(r.status, 200)
  return r.corpo.trilhas.find((t) => t.id_no === c.programa.id_no)
}

describe("1 · concluir e desfazer", () => {
  test("o passo sem entrega nasce a construir", async () => {
    assert.equal(passoNa(await jornada(), leitura.id_no).entrega.status, "NAO_INICIADA")
  })

  test("concluir vira APROVADO e conta no progresso, uma vez so", async () => {
    const antes = (await progressoDaTrilha()).passos_concluidos

    assert.equal((await marcar(leitura.id_no, true)).status, 204)
    assert.equal((await marcar(leitura.id_no, true)).status, 204, "concluir de novo nao e erro")

    assert.equal(passoNa(await jornada(), leitura.id_no).entrega.status, "APROVADO")
    assert.equal((await progressoDaTrilha()).passos_concluidos, antes + 1)
  })

  test("desfazer volta a construir", async () => {
    assert.equal((await marcar(leitura.id_no, false)).status, 204)
    assert.equal(passoNa(await jornada(), leitura.id_no).entrega.status, "NAO_INICIADA")
  })
})

describe("2 · passo com entrega", () => {
  test("nao se conclui pela startup", async () => {
    const r = await marcar(c.passo.id_no, true)
    assert.equal(r.status, 400)
    assert.notEqual(passoNa(await jornada(), c.passo.id_no).entrega.status, "APROVADO")
  })
})

describe("3 · quem pode marcar", () => {
  test("mentor sem vinculo e conta de fora sao barrados", async () => {
    assert.equal((await marcar(leitura.id_no, true, c.mentorA.token)).status, 403)
    assert.equal((await marcar(leitura.id_no, true, c.forasteiro.token)).status, 403)
    assert.equal(passoNa(await jornada(), leitura.id_no).entrega.status, "NAO_INICIADA")
  })
})

describe("4 · fase so de leitura", () => {
  test("fecha quando todos os passos sao concluidos", async () => {
    const fase = await trilhaRepository.criar({
      idTenant: c.tenantA.id_tenant,
      idPai: c.programa.id_no,
      tipo: "FASE",
      nome: "Fase de leitura",
    })
    const modulo = await trilhaRepository.criar({
      idTenant: c.tenantA.id_tenant,
      idPai: fase.id_no,
      tipo: "MODULO",
      nome: "Leituras",
    })
    const passos = []
    for (const nome of ["Leitura 1", "Leitura 2"]) {
      passos.push(
        await trilhaRepository.criar({
          idTenant: c.tenantA.id_tenant,
          idPai: modulo.id_no,
          tipo: "PASSO",
          nome,
          permiteEntrega: false,
        })
      )
    }

    const statusDaFase = async () =>
      (await jornada()).estagios.find((e) => e.id === fase.id_no).status

    await marcar(passos[0].id_no, true)
    assert.notEqual(await statusDaFase(), "CONCLUIDO", "falta um passo")

    await marcar(passos[1].id_no, true)
    assert.equal(await statusDaFase(), "CONCLUIDO")
  })
})
