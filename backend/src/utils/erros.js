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
 * @param {string} [codigo] - identificador estavel para o front reagir sem ler
 *   a frase (ex.: "BENEFICIO_INATIVO" muda a tela inteira, nao so o aviso).
 * @returns {Error}
 */
function erroNegocio(status, mensagem, codigo) {
  const erro = new Error(mensagem)
  erro.status = status
  if (codigo) erro.codigo = codigo
  return erro
}

module.exports = { erroNegocio }
