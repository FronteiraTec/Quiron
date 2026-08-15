/**
 * Controller de Feedback (HTTP). Delega ao feedbackService.
 */
const feedbackService = require("../services/feedbackService")

/**
 * POST /feedback
 * Registra o feedback do usuario logado.
 */
async function enviar(req, res, next) {
  try {
    const feedback = await feedbackService.enviar({
      idUsuario: req.usuario.id,
      idTenant: req.body.id_tenant,
      mensagem: req.body.mensagem,
    })
    res.status(201).json({ mensagem: "Feedback enviado. Obrigado!", feedback })
  } catch (err) {
    next(err)
  }
}

module.exports = { enviar }
