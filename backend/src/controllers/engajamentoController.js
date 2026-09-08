/**
 * Controller do engajamento (HTTP). Delega ao engajamentoService.
 *
 * O id_tenant vem da query nas leituras e do corpo nas escritas, como nos
 * demais modulos. Quem autoriza e o service — e ha leituras que de proposito
 * NAO passam por RBAC (o painel e o extrato da propria pessoa).
 */
const engajamentoService = require("../services/engajamentoService")

async function ranking(req, res, next) {
  try {
    res.json(
      await engajamentoService.ranking(
        req.query.id_tenant,
        { idTemporada: req.query.id_temporada || null },
        req.usuario
      )
    )
  } catch (err) {
    next(err)
  }
}

/** O painel da propria pessoa: nivel, posicao, extrato e as regras do jogo. */
async function meuPainel(req, res, next) {
  try {
    res.json(
      await engajamentoService.meuPainel(
        req.query.id_tenant,
        { idTemporada: req.query.id_temporada || null },
        req.usuario
      )
    )
  } catch (err) {
    next(err)
  }
}

async function extrato(req, res, next) {
  try {
    res.json(
      await engajamentoService.extrato(
        req.query.id_tenant,
        req.query.id_usuario,
        { idTemporada: req.query.id_temporada || null },
        req.usuario
      )
    )
  } catch (err) {
    next(err)
  }
}

async function lancar(req, res, next) {
  try {
    const { id_tenant, ids_usuarios, chave_acao, ocorrido_dt, observacao } = req.body
    const resultado = await engajamentoService.lancar(
      id_tenant,
      { ids_usuarios, chave_acao, ocorrido_dt, observacao },
      req.usuario
    )
    res.status(201).json(resultado)
  } catch (err) {
    next(err)
  }
}

async function estornar(req, res, next) {
  try {
    res.json(await engajamentoService.estornar(req.params.id, req.usuario))
  } catch (err) {
    next(err)
  }
}

async function participantes(req, res, next) {
  try {
    res.json(await engajamentoService.participantes(req.query.id_tenant, req.usuario))
  } catch (err) {
    next(err)
  }
}

module.exports = { ranking, meuPainel, extrato, participantes, lancar, estornar }
