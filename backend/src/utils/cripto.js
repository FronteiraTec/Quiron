/**
 * Cifragem simetrica de segredos guardados no banco (AES-256-GCM).
 *
 * Existe por causa do refresh token do Google: ele NAO EXPIRA. Quem o tiver
 * escreve na agenda da pessoa ate ela revogar o acesso na conta Google. Um
 * dump de backup, uma replica de leitura ou um log de erro que imprima a linha
 * nao podem entregar isso em texto puro.
 *
 * Por que GCM e nao CBC: o GCM autentica junto com a cifra. Um valor adulterado
 * falha na verificacao (Error) em vez de decifrar em lixo que so vira problema
 * la na frente, na chamada ao Google.
 *
 * FORMATO DO PACOTE: base64 de  [iv (12 bytes)][tag (16 bytes)][texto cifrado].
 * Tudo numa string so porque a coluna e uma so — o iv e a tag nao sao segredo,
 * so precisam chegar junto para a decifragem.
 */
const crypto = require("crypto")

const ALGORITMO = "aes-256-gcm"
const TAMANHO_IV = 12 // Recomendado para GCM.
const TAMANHO_TAG = 16

/**
 * Chave de 32 bytes derivada do ambiente.
 *
 * Cai no JWT_SECRET quando SECRET_KEY nao existe para o desenvolvimento nao
 * precisar de mais uma variavel obrigatoria — mas sao segredos com ciclos de
 * vida diferentes: rodar o JWT_SECRET (que se pode fazer a qualquer momento,
 * o custo e derrubar as sessoes) tornaria ILEGIVEL todo refresh token ja
 * gravado, e todo mundo teria de reconectar a agenda. Em producao, defina
 * SECRET_KEY separado.
 *
 * O SHA-256 esta aqui so para transformar uma frase de tamanho qualquer em 32
 * bytes; nao adiciona forca ao segredo. Use um valor com entropia de verdade
 * (`openssl rand -base64 32`).
 */
function chave() {
  const segredo = process.env.SECRET_KEY || process.env.JWT_SECRET
  if (!segredo) {
    throw new Error("Defina SECRET_KEY (ou JWT_SECRET) para cifrar segredos.")
  }
  return crypto.createHash("sha256").update(segredo).digest()
}

/**
 * Cifra um texto. Devolve null para entrada vazia — a coluna aceita null e
 * cifrar "nada" so produziria um pacote que decifra em string vazia.
 * @param {string|null|undefined} texto
 * @returns {string|null} Pacote em base64.
 */
function cifrar(texto) {
  if (!texto) return null

  const iv = crypto.randomBytes(TAMANHO_IV)
  const cifrador = crypto.createCipheriv(ALGORITMO, chave(), iv)
  const cifrado = Buffer.concat([cifrador.update(String(texto), "utf8"), cifrador.final()])

  return Buffer.concat([iv, cifrador.getAuthTag(), cifrado]).toString("base64")
}

/**
 * Decifra um pacote produzido por cifrar().
 *
 * Devolve null (em vez de lancar) quando o pacote esta corrompido ou foi
 * cifrado com outra chave: quem chama trata isso como "conexao invalida, peca
 * para reconectar", que e a acao possivel — e um erro nao recuperavel no meio
 * de um envio em segundo plano so viraria stack trace no log.
 *
 * @param {string|null|undefined} pacote - base64 de [iv][tag][cifrado].
 * @returns {string|null}
 */
function decifrar(pacote) {
  if (!pacote) return null

  try {
    const bytes = Buffer.from(pacote, "base64")
    const iv = bytes.subarray(0, TAMANHO_IV)
    const tag = bytes.subarray(TAMANHO_IV, TAMANHO_IV + TAMANHO_TAG)
    const cifrado = bytes.subarray(TAMANHO_IV + TAMANHO_TAG)

    const decifrador = crypto.createDecipheriv(ALGORITMO, chave(), iv)
    decifrador.setAuthTag(tag)

    return Buffer.concat([decifrador.update(cifrado), decifrador.final()]).toString("utf8")
  } catch {
    return null
  }
}

module.exports = { cifrar, decifrar }
