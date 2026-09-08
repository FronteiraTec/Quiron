/**
 * Testes do utilitario de senha. Sem banco: e funcao pura.
 */
const { test, describe } = require("node:test")
const assert = require("node:assert/strict")

const { gerarHash, verificarSenha, gerarTokenReset, hashToken } = require("../src/utils/senha")

describe("gerarHash / verificarSenha", () => {
  test("a senha correta confere", () => {
    const armazenado = gerarHash("SenhaCorreta#1")
    assert.equal(verificarSenha("SenhaCorreta#1", armazenado), true)
  })

  test("a senha errada nao confere", () => {
    const armazenado = gerarHash("SenhaCorreta#1")
    assert.equal(verificarSenha("SenhaErrada#1", armazenado), false)
  })

  test("o salt e por usuario: a mesma senha gera hashes diferentes", () => {
    // E o que impede uma rainbow table de resolver a base inteira de uma vez.
    assert.notEqual(gerarHash("mesmaSenha"), gerarHash("mesmaSenha"))
  })

  test("valor armazenado malformado nao derruba, so recusa", () => {
    // Vindo de um banco antigo ou de uma linha corrompida, isto nao pode virar
    // excecao no meio do login.
    assert.equal(verificarSenha("qualquer", ""), false)
    assert.equal(verificarSenha("qualquer", null), false)
    assert.equal(verificarSenha("qualquer", "sem-dois-pontos"), false)
  })

  test("hash de tamanho diferente recusa em vez de estourar", () => {
    // timingSafeEqual lanca se os buffers tem tamanhos diferentes; a funcao
    // precisa comparar o tamanho antes de chamar.
    assert.equal(verificarSenha("qualquer", "abcd:00ff"), false)
  })
})

describe("token de reset", () => {
  test("o token puro nunca e igual ao que se guarda", () => {
    const { token, tokenHash } = gerarTokenReset()
    assert.notEqual(token, tokenHash)
    assert.equal(hashToken(token), tokenHash)
  })

  test("cada pedido gera um token diferente", () => {
    assert.notEqual(gerarTokenReset().token, gerarTokenReset().token)
  })

  test("o token tem entropia suficiente para nao ser adivinhado", () => {
    // 32 bytes -> 64 hexadecimais. O link de reset e a unica coisa entre um
    // desconhecido e a conta de alguem.
    assert.equal(gerarTokenReset().token.length, 64)
  })
})
