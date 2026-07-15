/**
 * Controller de Avaliacoes (HTTP). Delega ao avaliacaoService.
 */
const avaliacaoService = require("../services/avaliacaoService")

async function listar(req, res, next) {
  try {
    res.json({ avaliacoes: await avaliacaoService.listar(req.query.id_entrega) })
  } catch (err) {
    next(err)
  }
}

async function criar(req, res, next) {
  try {
    const { id_entrega, status, nota, comentario } = req.body
    // O avaliador e o usuario autenticado (vem do token).
    const avaliacao = await avaliacaoService.criar({
      idEntrega: id_entrega,
      idAvaliador: req.usuario.id,
      status,
      nota,
      comentario,
    })
    res.status(201).json({ avaliacao })
  } catch (err) {
    next(err)
  }
}

module.exports = { listar, criar }
