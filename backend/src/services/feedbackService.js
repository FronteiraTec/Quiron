/**
 * Service de Feedback (regra de negocio).
 *
 * Valida e registra o que o usuario escreve no "Enviar Feedback" do
 * UserPanel. E so um canal de escuta - nao ha fluxo de resposta.
 */
const feedbackRepository = require("../repositories/feedbackRepository")
const notificacaoService = require("./notificacaoService")
const { erroNegocio } = require("../utils/erros")

const MENSAGEM_MAX = 2000

/**
 * Registra o feedback do usuario logado.
 * @param {{idUsuario:number, idTenant?:number, mensagem:string}} dados
 * @returns {Promise<object>} Registro criado.
 */
async function enviar({ idUsuario, idTenant, mensagem }) {
  const texto = (mensagem || "").trim()
  if (!texto) {
    throw erroNegocio(400, "Escreva uma mensagem antes de enviar.")
  }
  if (texto.length > MENSAGEM_MAX) {
    throw erroNegocio(400, `A mensagem deve ter no maximo ${MENSAGEM_MAX} caracteres.`)
  }

  const feedback = await feedbackRepository.criar({ idUsuario, idTenant, mensagem: texto })
  // Disparo em segundo plano (ver notificacaoService): SMTP fora do ar nao
  // pode impedir o usuario de saber que o feedback foi registrado.
  notificacaoService.feedbackEnviado(feedback)
  return feedback
}

module.exports = { enviar }
