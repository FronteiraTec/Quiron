/**
 * Helper para erros de negocio com codigo HTTP associado.
 *
 * Os services lancam esses erros; o middleware errorHandler os traduz na
 * resposta HTTP correta (usando a propriedade "status").
 */

/**
 * Cria um Error com status HTTP.
 * @param {number} status - Codigo HTTP (400, 401, 404, 409...).
 * @param {string} mensagem
 * @returns {Error}
 */
function erroNegocio(status, mensagem) {
  const erro = new Error(mensagem)
  erro.status = status
  return erro
}

module.exports = { erroNegocio }
