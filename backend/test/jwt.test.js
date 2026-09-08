/**
 * Testes do utilitario de token.
 *
 * O caso que interessa mais aqui e o ultimo: um token assinado com OUTRO
 * segredo tem de ser recusado. Foi exatamente isso que falhou na auditoria de
 * 30/08/2026 — o segredo era um literal versionado no docker-compose, entao
 * "outro segredo" era um segredo que qualquer um tinha.
 */
const { test, describe, before } = require("node:test")
const assert = require("node:assert/strict")
const jwt = require("jsonwebtoken")

// Precisa estar no ambiente ANTES do require do utilitario: ele le a variavel
// no carregamento do modulo.
process.env.JWT_SECRET = process.env.JWT_SECRET || "segredo-so-do-teste-abc123"

let gerarToken, verificarToken, revogarToken

before(() => {
  ;({ gerarToken, verificarToken, revogarToken } = require("../src/utils/jwt"))
})

describe("gerarToken / verificarToken", () => {
  test("ida e volta preserva o conteudo", () => {
    const token = gerarToken({ id: 42, email: "a@b.test", root: false })
    const payload = verificarToken(token)
    assert.equal(payload.id, 42)
    assert.equal(payload.email, "a@b.test")
    assert.equal(payload.root, false)
  })

  test("token expirado e recusado", () => {
    const expirado = jwt.sign({ id: 1 }, process.env.JWT_SECRET, { expiresIn: "-1s" })
    assert.throws(() => verificarToken(expirado))
  })

  test("token adulterado e recusado", () => {
    const token = gerarToken({ id: 1, root: false })
    const [cabecalho, , assinatura] = token.split(".")
    const cargaFalsa = Buffer.from(JSON.stringify({ id: 1, root: true })).toString("base64url")
    assert.throws(() => verificarToken(`${cabecalho}.${cargaFalsa}.${assinatura}`))
  })

  test("token assinado com outro segredo e recusado", () => {
    const forjado = jwt.sign({ id: 999999, root: true }, "troque-este-segredo-em-producao")
    assert.throws(
      () => verificarToken(forjado),
      "QRN-01: um token assinado com o segredo antigo, que estava no " +
        "docker-compose versionado, NAO pode ser aceito."
    )
  })

  test("logout revoga o token", () => {
    const token = gerarToken({ id: 7 })
    assert.doesNotThrow(() => verificarToken(token))
    revogarToken(token)
    assert.throws(() => verificarToken(token))
  })
})
