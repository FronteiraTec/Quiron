/**
 * Controller de Entregas (HTTP). Delega ao entregaService.
 */
const entregaService = require("../services/entregaService")

async function listar(req, res, next) {
  try {
    res.json({ entregas: await entregaService.listar(req.query.id_startup, req.usuario) })
  } catch (err) {
    next(err)
  }
}

async function fila(req, res, next) {
  try {
    const entregas = await entregaService.listarFila(req.query.id_tenant, req.usuario)
    res.json({ entregas })
  } catch (err) {
    next(err)
  }
}

async function buscar(req, res, next) {
  try {
    res.json({ entrega: await entregaService.buscar(req.params.id, req.usuario) })
  } catch (err) {
    next(err)
  }
}

async function detalhe(req, res, next) {
  try {
    res.json({ entrega: await entregaService.buscarDetalhe(req.params.id, req.usuario) })
  } catch (err) {
    next(err)
  }
}

async function criar(req, res, next) {
  try {
    const { id_no, id_startup, texto_resposta, arquivo_url } = req.body
    // O autor da entrega e o usuario autenticado (vem do token).
    const entrega = await entregaService.criar({
      idNo: id_no,
      idStartup: id_startup,
      idUsuario: req.usuario.id,
      textoResposta: texto_resposta,
      arquivoUrl: arquivo_url,
    }, req.usuario)
    res.status(201).json({ entrega })
  } catch (err) {
    next(err)
  }
}

async function responder(req, res, next) {
  try {
    const { id_no, id_startup, respostas } = req.body
    const { entrega, resultado } = await entregaService.responderQuestionario({
      idNo: id_no,
      idStartup: id_startup,
      idUsuario: req.usuario.id,
      respostas,
    }, req.usuario)
    res.status(201).json({ entrega, resultado })
  } catch (err) {
    next(err)
  }
}

module.exports = { listar, fila, buscar, detalhe, criar, responder }
