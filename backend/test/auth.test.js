/**
 * Autenticacao pela borda HTTP: login, /me e a exigencia de token.
 *
 * Testes que devem passar hoje. Se algum quebrar, alguma coisa regrediu no
 * caminho mais critico da aplicacao.
 */
const { test, describe, before, after } = require("node:test")
const assert = require("node:assert/strict")

const { prepararBanco, encerrar } = require("../apoio-teste/banco")
const { subirApi, req } = require("../apoio-teste/api")

let api
let cenario

before(async () => {
  await prepararBanco()
  cenario = await require("../apoio-teste/cenario").montarCenario()
  api = await subirApi()
})

after(async () => {
  await api.fechar()
  await encerrar()
})

describe("POST /auth/login", () => {
  test("credenciais corretas devolvem token e vinculo", async () => {
    const { status, corpo } = await req(api.url, "/auth/login", {
      metodo: "POST",
      corpo: { email: cenario.adminA.email, senha: cenario.SENHA },
    })

    assert.equal(status, 200)
    assert.ok(corpo.token, "deveria vir um token")
    assert.equal(corpo.usuario.email, cenario.adminA.email)
    assert.equal(Number(corpo.usuario.id_tenant), Number(cenario.tenantA.id_tenant))
  })

  test("senha errada devolve 401", async () => {
    const { status } = await req(api.url, "/auth/login", {
      metodo: "POST",
      corpo: { email: cenario.adminA.email, senha: "nao-e-essa" },
    })
    assert.equal(status, 401)
  })

  test("email inexistente devolve a MESMA mensagem que senha errada", async () => {
    // Mensagens diferentes viram um oraculo de "este email esta cadastrado".
    const inexistente = await req(api.url, "/auth/login", {
      metodo: "POST",
      corpo: { email: "ninguem@teste.invalid", senha: "qualquer" },
    })
    const senhaErrada = await req(api.url, "/auth/login", {
      metodo: "POST",
      corpo: { email: cenario.adminA.email, senha: "nao-e-essa" },
    })

    assert.equal(inexistente.status, senhaErrada.status)
    assert.equal(inexistente.corpo.erro, senhaErrada.corpo.erro)
  })

  test("a resposta nunca carrega o hash da senha", async () => {
    const { corpo } = await req(api.url, "/auth/login", {
      metodo: "POST",
      corpo: { email: cenario.adminA.email, senha: cenario.SENHA },
    })
    assert.equal(corpo.usuario.senha_hash, undefined)
    assert.ok(!JSON.stringify(corpo).includes(cenario.SENHA))
  })
})

describe("rota protegida", () => {
  test("sem token: 401", async () => {
    const { status } = await req(api.url, "/auth/me")
    assert.equal(status, 401)
  })

  test("token no formato errado: 401", async () => {
    const { status } = await req(api.url, "/auth/me", {
      cabecalhos: { Authorization: cenario.adminA.token }, // falta o "Bearer "
    })
    assert.equal(status, 401)
  })

  test("token valido: 200 com o usuario do token", async () => {
    const { status, corpo } = await req(api.url, "/auth/me", {
      token: cenario.adminA.token,
    })
    assert.equal(status, 200)
    assert.equal(corpo.usuario.email, cenario.adminA.email)
  })
})

describe("POST /auth/forgot-password", () => {
  test("email existente e inexistente respondem igual", async () => {
    // Idem ao login: a resposta nao pode revelar quem esta cadastrado.
    const existente = await req(api.url, "/auth/forgot-password", {
      metodo: "POST",
      corpo: { email: cenario.adminA.email },
    })
    const inexistente = await req(api.url, "/auth/forgot-password", {
      metodo: "POST",
      corpo: { email: "ninguem@teste.invalid" },
    })

    assert.equal(existente.status, 200)
    assert.deepEqual(existente.corpo, inexistente.corpo)
  })
})

describe("health", () => {
  test("/health responde sem token — e o que o Docker e o deploy consultam", async () => {
    const { status, corpo } = await req(api.url, "/health")
    assert.equal(status, 200)
    assert.equal(corpo.status, "ok")
  })
})
