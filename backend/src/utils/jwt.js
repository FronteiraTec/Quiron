/**
 * Utilitario de Bearer Token (JWT).
 *
 * O token e gerado no login e deve ser enviado em cada requisicao protegida
 * no cabecalho:  Authorization: Bearer <token>
 *
 * Como o JWT e "stateless" (o servidor nao guarda sessao), implementamos uma
 * blacklist em memoria para invalidar tokens no logout. Em producao com
 * multiplas instancias, essa blacklist deveria ficar em um Redis compartilhado.
 */
const jwt = require("jsonwebtoken")

// Segredo usado para assinar/verificar os tokens (vem do ambiente).
//
// SEM FALLBACK, de proposito. Ate 30/08/2026 havia um literal aqui
// ("troque-este-segredo-em-producao") que tambem estava escrito no
// docker-compose.yml versionado: quem lesse o repositorio assinava um token
// com `root: true` e um id de usuario inexistente, e o middleware aceitava —
// ele so confere a assinatura, nunca consulta a tabela de usuarios.
// O server.js recusa subir sem esta variavel.
const JWT_SECRET = process.env.JWT_SECRET
// Tempo de expiracao do token.
const JWT_EXPIRES = process.env.JWT_EXPIRES || "8h"

// Conjunto de tokens invalidados (logout). Chave = token bruto.
const blacklist = new Set()

/**
 * Gera um Bearer Token assinado para um usuario.
 * @param {object} payload - Dados a embutir no token (ex.: { id, email }).
 * @returns {string} Token JWT assinado.
 */
function gerarToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES })
}

/**
 * Verifica e decodifica um token. Lanca erro se invalido/expirado/revogado.
 * @param {string} token - Token JWT.
 * @returns {object} Payload decodificado.
 */
function verificarToken(token) {
  if (blacklist.has(token)) {
    throw new Error("Token revogado (logout).")
  }
  return jwt.verify(token, JWT_SECRET)
}

/**
 * Invalida um token (logout), adicionando-o a blacklist.
 * @param {string} token - Token a revogar.
 */
function revogarToken(token) {
  blacklist.add(token)
}

module.exports = { gerarToken, verificarToken, revogarToken }
