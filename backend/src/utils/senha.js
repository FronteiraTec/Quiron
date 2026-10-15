/**
 * Utilitario de criptografia de senha usando SHA-256.
 *
 * SHA-256 puro e deterministico (mesma entrada -> mesma saida), o que o
 * torna vulneravel a rainbow tables. Por isso geramos um "salt" aleatorio
 * por usuario e concatenamos com a senha antes de aplicar o hash.
 *
 * Formato armazenado na coluna senha_hash: "<salt>:<hash>".
 */
const crypto = require("crypto")

/**
 * Aplica SHA-256 sobre (salt + senha).
 * @param {string} senha - Senha em texto puro.
 * @param {string} salt - Salt aleatorio em hexadecimal.
 * @returns {string} Hash em hexadecimal.
 */
function sha256(senha, salt) {
  return crypto
    .createHash("sha256")
    .update(salt + senha)
    .digest("hex")
}

/**
 * Gera o hash de uma senha nova, com salt aleatorio.
 * @param {string} senha - Senha em texto puro.
 * @returns {string} String no formato "<salt>:<hash>" para salvar no banco.
 */
function gerarHash(senha) {
  // 16 bytes aleatorios -> 32 caracteres hexadecimais.
  const salt = crypto.randomBytes(16).toString("hex")
  const hash = sha256(senha, salt)
  return `${salt}:${hash}`
}

/**
 * Verifica se uma senha em texto puro corresponde ao hash armazenado.
 * @param {string} senha - Senha informada no login.
 * @param {string} armazenado - Valor da coluna senha_hash ("<salt>:<hash>").
 * @returns {boolean} true se a senha confere.
 */
function verificarSenha(senha, armazenado) {
  if (!armazenado || !armazenado.includes(":")) {
    return false
  }

  const [salt, hashSalvo] = armazenado.split(":")
  const hashCalculado = sha256(senha, salt)

  // Comparacao em tempo constante para evitar timing attacks.
  const bufA = Buffer.from(hashCalculado, "hex")
  const bufB = Buffer.from(hashSalvo, "hex")

  if (bufA.length !== bufB.length) {
    return false
  }

  return crypto.timingSafeEqual(bufA, bufB)
}

/**
 * Gera um token aleatorio (enviado por email) e o seu hash SHA-256
 * (guardado no banco). Nunca armazenamos o token puro - so o hash.
 * @returns {{token:string, tokenHash:string}}
 */
function gerarTokenReset() {
  const token = crypto.randomBytes(32).toString("hex")
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex")
  return { token, tokenHash }
}

/**
 * Calcula o hash SHA-256 de um token de reset (para comparar com o banco).
 * @param {string} token
 * @returns {string} Hash em hexadecimal.
 */
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex")
}

/**
 * Tamanho minimo de toda senha escolhida no sistema.
 *
 * Um lugar so (QRN-05): a regra existia no primeiro acesso e na senha
 * provisoria, mas o cadastro publico e a redefinicao por e-mail nao a
 * aplicavam, e aceitavam senha de um caractere. As telas do frontend repetem
 * o mesmo numero; mudou aqui, mude la.
 */
const SENHA_MINIMO = 6

/**
 * Lanca 400 se a senha nao atende a politica.
 * @param {string} senha
 * @param {string} [rotulo] - como a mensagem chama a senha ("A senha provisoria").
 */
function validarSenha(senha, rotulo = "A senha") {
  if (typeof senha !== "string" || senha.length < SENHA_MINIMO) {
    const { erroNegocio } = require("./erros")
    throw erroNegocio(400, `${rotulo} deve ter ao menos ${SENHA_MINIMO} caracteres.`)
  }
}

module.exports = { gerarHash, verificarSenha, gerarTokenReset, hashToken, SENHA_MINIMO, validarSenha }
