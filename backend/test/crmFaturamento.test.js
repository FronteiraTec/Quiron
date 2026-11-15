/**
 * O faturamento da startup no cadastro dela, visto pela incubadora
 * (GET /startups/:id/faturamento).
 *
 * O que este arquivo prende:
 *   - conta SO o valor vendido das oportunidades ganhas, pela data de
 *     fechamento: perdida, reaberta e excluida nao entram;
 *   - sai SO em soma — nenhum cliente, nenhuma negociacao na resposta;
 *   - exige a chave `startups.faturamento.visualizar` e o vinculo: o mentor que
 *     acompanha a startup, o incubado e o admin de outra incubadora nao veem;
 *   - startup sem CRM responde "nao usa" (e nao zeros), e com o beneficio
 *     revogado o historico continua visivel.
 */
const { test, describe, before, after } = require("node:test")
const assert = require("node:assert/strict")

const { prepararBanco, encerrar } = require("../apoio-teste/banco")
const { subirApi, req } = require("../apoio-teste/api")

let api
let c
let query
const ids = {}

const como = (quem) => ({
  get: (caminho) => req(api.url, caminho, { token: quem.token }),
  post: (caminho, corpo) => req(api.url, caminho, { metodo: "POST", token: quem.token, corpo: corpo || {} }),
  put: (caminho, corpo) => req(api.url, caminho, { metodo: "PUT", token: quem.token, corpo: corpo || {} }),
  del: (caminho) => req(api.url, caminho, { metodo: "DELETE", token: quem.token }),
})

/** "AAAA-MM-DD" de `meses` atras (no mesmo dia, ou no ultimo dia do mes). */
function mesesAtras(hoje, meses) {
  const [a, m, d] = hoje.split("-").map(Number)
  const alvo = new Date(Date.UTC(a, m - 1 - meses, 1))
  const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate()
  alvo.setUTCDate(Math.min(d, ultimoDia))
  return alvo.toISOString().slice(0, 10)
}

before(async () => {
  await prepararBanco()
  c = await require("../apoio-teste/cenario").montarCenario()
  api = await subirApi()
  query = require("../src/config/db").query
  const { hojeNoFuso } = require("../src/crm/validacao")
  ids.hoje = hojeNoFuso()

  const um = c.startupUm.id_startup
  await como(c.adminA).put(`/startups/${um}/beneficios/CRM`, { ativo: true })

  const crm = (caminho) => `/crm/${um}${caminho}`
  const incubado = como(c.colaboradorA)
  const cliente = await incubado.post(crm("/clientes"), { nome: "Cliente Secreto" })
  ids.cliente = cliente.corpo.cliente.id_cliente

  const vender = async (titulo, valor, fechamento) => {
    const op = await incubado.post(crm("/oportunidades"), { titulo, id_cliente: ids.cliente, valor_estimado: valor })
    const id = op.corpo.oportunidade.id_oportunidade
    const r = await incubado.post(crm(`/oportunidades/${id}/ganhar`), { valor_vendido: valor, fechamento_dt: fechamento })
    assert.equal(r.status, 200, JSON.stringify(r.corpo))
    return id
  }

  ids.datas = { a: ids.hoje, b: mesesAtras(ids.hoje, 2), c: mesesAtras(ids.hoje, 24) }
  await vender("Venda Secreta A", 1000, ids.datas.a)
  await vender("Venda Secreta B", 2500, ids.datas.b)
  await vender("Venda Secreta C", 4000, ids.datas.c)

  // O que NAO pode entrar na soma.
  const perdida = await incubado.post(crm("/oportunidades"), { titulo: "Perdida", id_cliente: ids.cliente, valor_estimado: 9000 })
  await incubado.post(crm(`/oportunidades/${perdida.corpo.oportunidade.id_oportunidade}/perder`), { motivo_perda: "Preço" })
  const reaberta = await vender("Reaberta", 8000, ids.hoje)
  await incubado.post(crm(`/oportunidades/${reaberta}/reabrir`))
  const excluida = await vender("Excluida", 7000, ids.hoje)
  await incubado.del(crm(`/oportunidades/${excluida}`))

  // O mentor passa a acompanhar a startup: tem o vinculo e a chave da
  // startup, mas nao a do faturamento.
  await query(`INSERT INTO mentor_startup (id_usuario_mentor, id_startup) VALUES ($1, $2)`, [c.mentorA.id, um])
})

after(async () => {
  await api.fechar()
  await encerrar()
})

describe("faturamento da startup", () => {
  test("o admin ve as somas das vendas ganhas, e so delas", async () => {
    const r = await como(c.adminA).get(`/startups/${c.startupUm.id_startup}/faturamento`)
    assert.equal(r.status, 200, JSON.stringify(r.corpo))
    const { resumo, meses } = r.corpo
    assert.equal(r.corpo.usa_crm, true)
    assert.equal(r.corpo.crm_ativo, true)
    assert.equal(resumo.vendas, 3)
    assert.equal(resumo.total, 7500)
    assert.equal(resumo.ticket_medio, 2500)
    assert.equal(resumo.ultimos_12_meses, 3500)
    assert.equal(resumo.vendas_12_meses, 2)
    const ano = ids.hoje.slice(0, 4)
    assert.equal(resumo.ano_atual, 1000 + (ids.datas.b.startsWith(ano) ? 2500 : 0))
    assert.equal(resumo.ultima_venda, ids.hoje)
    assert.equal(resumo.primeira_venda, ids.datas.c)

    assert.equal(meses.length, 12)
    assert.equal(meses[11].mes, ids.hoje.slice(0, 7))
    assert.equal(meses[11].valor, 1000)
    assert.equal(meses.find((m) => m.mes === ids.datas.b.slice(0, 7)).valor, 2500)
    assert.equal(meses.reduce((s, m) => s + m.vendas, 0), 2)
  })

  test("nenhum cliente nem negociacao sai na resposta", async () => {
    const r = await como(c.adminA).get(`/startups/${c.startupUm.uuid}/faturamento`)
    const texto = JSON.stringify(r.corpo)
    for (const segredo of ["Cliente Secreto", "Venda Secreta", "Perdida", "Preço", "id_cliente", "id_oportunidade"]) {
      assert.ok(!texto.includes(segredo), `vazou "${segredo}"`)
    }
  })

  test("sem a chave, nao ve: mentor que acompanha, incubado da startup, admin de outra incubadora", async () => {
    for (const quem of [c.mentorA, c.colaboradorA, c.adminB, c.forasteiro]) {
      const r = await como(quem).get(`/startups/${c.startupUm.id_startup}/faturamento`)
      assert.equal(r.status, 403, `${quem.email} viu o faturamento`)
    }
  })

  test("a chave basta quando a incubadora a concede", async () => {
    await query(
      `INSERT INTO role_permissao (id_role, id_permissao)
       SELECT r.id_role, p.id_permissao FROM role r, permissao p
        WHERE r.id_tenant = $1 AND r.nome = 'Mentor' AND p.chave = 'startups.faturamento.visualizar'`,
      [c.tenantA.id_tenant]
    )
    const r = await como(c.mentorA).get(`/startups/${c.startupUm.id_startup}/faturamento`)
    assert.equal(r.status, 200)
    assert.equal(r.corpo.resumo.total, 7500)
  })

  test("startup que nunca teve o CRM responde que nao usa, sem numeros", async () => {
    const r = await como(c.adminA).get(`/startups/${c.startupDois.id_startup}/faturamento`)
    assert.equal(r.status, 200)
    assert.deepEqual(r.corpo, { usa_crm: false, crm_ativo: false })
  })

  test("com o beneficio revogado, o que foi vendido continua visivel", async () => {
    await como(c.adminA).put(`/startups/${c.startupUm.id_startup}/beneficios/CRM`, { ativo: false })
    const r = await como(c.adminA).get(`/startups/${c.startupUm.id_startup}/faturamento`)
    assert.equal(r.status, 200)
    assert.equal(r.corpo.crm_ativo, false)
    assert.equal(r.corpo.resumo.total, 7500)
  })
})
