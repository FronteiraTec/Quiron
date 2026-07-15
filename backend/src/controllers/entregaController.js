/**
 * Controller de Entregas (HTTP). Delega ao entregaService.
 */
const entregaService = require("../services/entregaService")

async function listar(req, res, next) {
  try {
    res.json({ entregas: await entregaService.listar(req.query.id_startup) })
  } catch (err) {
    next(err)
  }
}

async function buscar(req, res, next) {
  try {
    res.json({ entrega: await entregaService.buscar(req.params.id) })
  } catch (err) {
    next(err)
  }
}

async function criar(req, res, next) {
  try {
    const { id_tarefa, id_startup, texto_resposta, arquivo_url } = req.body
    // O autor da entrega e o usuario autenticado (vem do token).
    const entrega = await entregaService.criar({
      idTarefa: id_tarefa,
      idStartup: id_startup,
      idUsuario: req.usuario.id,
      textoResposta: texto_resposta,
      arquivoUrl: arquivo_url,
    })
    res.status(201).json({ entrega })
  } catch (err) {
    next(err)
  }
}

async function responder(req, res, next) {
  try {
    const { id_tarefa, id_startup, respostas } = req.body
    const entrega = await entregaService.responderQuestionario({
      idTarefa: id_tarefa,
      idStartup: id_startup,
      idUsuario: req.usuario.id,
      respostas,
    })
    res.status(201).json({ entrega })
  } catch (err) {
    next(err)
  }
}

module.exports = { listar, buscar, criar, responder }
