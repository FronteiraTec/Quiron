/**
 * A startup na URL pelo UUID (migracao 022).
 *
 * A tela de detalhe abre por /startups/<uuid>, e a rota traduz o UUID para o
 * id_startup antes do handler. O que este arquivo prende: o UUID chega a quem
 * monta o link, abre a mesma startup que o id e NAO e atalho de acesso — quem
 * nao alcanca a startup pelo id tambem nao a alcanca pelo UUID.
 */
const { test, describe, before, after } = require("node:test")
const assert = require("node:assert/strict")

const { prepararBanco, encerrar } = require("../apoio-teste/banco")
const { subirApi, req } = require("../apoio-teste/api")

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

// gen_random_uuid() gera a versao 4.
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe("UUID da startup na URL", () => {
  test("toda startup nasce com um UUID proprio", () => {
    assert.match(c.startupUm.uuid, UUID_V4)
    assert.match(c.startupDois.uuid, UUID_V4)
    assert.notEqual(c.startupUm.uuid, c.startupDois.uuid)
  })

  test("o UUID abre a mesma startup que o id", async () => {
    const r = await req(api.url, `/startups/${c.startupUm.uuid}`, { token: c.adminA.token })
    assert.equal(r.status, 200)
    assert.equal(r.corpo.startup.id_startup, c.startupUm.id_startup)
    assert.equal(r.corpo.startup.uuid, c.startupUm.uuid)
  })

  test("o UUID vale tambem nas rotas filhas", async () => {
    const r = await req(api.url, `/startups/${c.startupUm.uuid}/membros`, { token: c.adminA.token })
    assert.equal(r.status, 200)
    assert.ok(r.corpo.membros.some((m) => m.id_usuario === c.colaboradorA.id))
  })

  test("UUID que nao existe responde 404", async () => {
    const r = await req(api.url, "/startups/00000000-0000-4000-8000-000000000000", {
      token: c.adminA.token,
    })
    assert.equal(r.status, 404)
  })

  test("sem token, nem chega a procurar o UUID", async () => {
    const r = await req(api.url, `/startups/${c.startupUm.uuid}`)
    assert.equal(r.status, 401)
  })

  test("o UUID nao e atalho: sem vinculo, barra igual ao id", async () => {
    // O colaborador e membro da Um, nao da Dois; o forasteiro nao e de lugar
    // nenhum. Pelo UUID, a resposta tem de ser a mesma que pelo id.
    for (const [quem, startup] of [
      [c.colaboradorA, c.startupDois],
      [c.forasteiro, c.startupUm],
    ]) {
      const porId = await req(api.url, `/startups/${startup.id_startup}`, { token: quem.token })
      const porUuid = await req(api.url, `/startups/${startup.uuid}`, { token: quem.token })
      assert.equal(porUuid.status, 403, `${quem.email} abriu ${startup.nome} pelo UUID`)
      assert.equal(porUuid.status, porId.status)
    }
  })

  test("as listas que viram link levam o UUID", async () => {
    const tenant = c.tenantA.id_tenant
    const comToken = { token: c.adminA.token }

    const lista = await req(api.url, `/startups?id_tenant=${tenant}`, comToken)
    assert.equal(lista.status, 200)
    const naLista = lista.corpo.startups.find((s) => s.id_startup === c.startupUm.id_startup)
    assert.equal(naLista.uuid, c.startupUm.uuid)

    const membros = await req(api.url, `/startups/membros?id_tenant=${tenant}`, comToken)
    assert.equal(membros.status, 200)
    const vinculo = membros.corpo.membros.find((m) => m.id_usuario === c.colaboradorA.id)
    assert.equal(vinculo.startup_uuid, c.startupUm.uuid)

    const progresso = await req(api.url, `/relatorios/progresso?id_tenant=${tenant}`, comToken)
    assert.equal(progresso.status, 200)
    const noRelatorio = progresso.corpo.startups.find((s) => s.id_startup === c.startupUm.id_startup)
    assert.equal(noRelatorio.startup_uuid, c.startupUm.uuid)
  })
})
