/**
 * Controller de Avaliacoes (HTTP). Delega ao avaliacaoService.
 */
const avaliacaoService = require("../services/avaliacaoService")

/**
 * Duas leituras da mesma colecao, escolhidas pelo filtro:
 *   ?id_entrega=  -> as devolutivas daquela entrega (usado pelo painel)
 *   ?id_tenant=   -> todas as do tenant (tela "Avaliacoes" do admin)
 */
async function listar(req, res, next) {
  try {
    const { id_entrega, id_tenant } = req.query
    const avaliacoes = id_tenant
      ? await avaliacaoService.listarDoTenant(id_tenant, req.usuario)
      : await avaliacaoService.listar(id_entrega, req.usuario)
    res.json({ avaliacoes })
  } catch (err) {
    next(err)
  }
}

async function listarMinhas(req, res, next) {
  try {
    const avaliacoes = await avaliacaoService.listarMinhas(
      req.query.id_tenant,
      req.usuario.id
    )
    res.json({ avaliacoes })
  } catch (err) {
    next(err)
  }
}

async function criar(req, res, next) {
  try {
    const { id_entrega, status, nota, comentario } = req.body
    // O avaliador e o usuario autenticado: o service usa o token tanto para
    // gravar o autor quanto para decidir se ele pode avaliar esta entrega.
    const avaliacao = await avaliacaoService.criar(
      { idEntrega: id_entrega, status, nota, comentario },
      req.usuario
    )
    res.status(201).json({ avaliacao })
  } catch (err) {
    next(err)
  }
}

module.exports = { listar, listarMinhas, criar }
