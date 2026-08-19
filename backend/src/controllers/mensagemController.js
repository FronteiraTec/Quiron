/**
 * Controller de Mensagens internas (HTTP). Delega ao mensagemService.
 *
 * O id_tenant vem da query (GET) ou do corpo (POST), como nos demais modulos:
 * o token guarda a pessoa, nao a incubadora em que ela esta operando.
 */
const mensagemService = require("../services/mensagemService")

/** GET /mensagens?id_tenant=&limite=&nao_lidas= — a caixa de entrada de quem chamou. */
async function caixaDeEntrada(req, res, next) {
  try {
    const mensagens = await mensagemService.caixaDeEntrada(req.query.id_tenant, req.usuario, {
      limite: req.query.limite,
      apenasNaoLidas: req.query.nao_lidas,
    })
    res.json({ mensagens })
  } catch (err) {
    next(err)
  }
}

/** GET /mensagens/nao-lidas?id_tenant= — so o numero do sino. */
async function contarNaoLidas(req, res, next) {
  try {
    const total = await mensagemService.contarNaoLidas(req.query.id_tenant, req.usuario)
    res.json({ total })
  } catch (err) {
    next(err)
  }
}

/** GET /mensagens/opcoes?id_tenant= — os publicos que esta pessoa pode escolher. */
async function opcoes(req, res, next) {
  try {
    res.json(await mensagemService.opcoesDeDestino(req.query.id_tenant, req.usuario))
  } catch (err) {
    next(err)
  }
}

/** GET /mensagens/enviadas?id_tenant=&limite= — o historico de envios. */
async function listarEnviadas(req, res, next) {
  try {
    const mensagens = await mensagemService.listarEnviadas(req.query.id_tenant, req.usuario, {
      limite: req.query.limite,
    })
    res.json({ mensagens })
  } catch (err) {
    next(err)
  }
}

/** GET /mensagens/:id/destinatarios — quem recebeu e quem ja leu. */
async function listarDestinatarios(req, res, next) {
  try {
    const destinatarios = await mensagemService.listarDestinatarios(req.params.id, req.usuario)
    res.json({ destinatarios })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /mensagens
 * body: { id_tenant, assunto, corpo, destinos: [{tipo, id_referencia}],
 *         importante?, rota?, enviar_email? }
 */
async function enviar(req, res, next) {
  try {
    const mensagem = await mensagemService.enviar(req.body.id_tenant, req.usuario, {
      assunto: req.body.assunto,
      corpo: req.body.corpo,
      destinos: req.body.destinos,
      importante: req.body.importante,
      rota: req.body.rota,
      enviarEmail: req.body.enviar_email,
    })
    res.status(201).json({ mensagem })
  } catch (err) {
    next(err)
  }
}

/** POST /mensagens/:id/lida — marca uma mensagem da propria caixa como lida. */
async function marcarLida(req, res, next) {
  try {
    res.json(await mensagemService.marcarLida(req.params.id, req.usuario))
  } catch (err) {
    next(err)
  }
}

/** POST /mensagens/lidas — zera o sino (body: { id_tenant }). */
async function marcarTodasLidas(req, res, next) {
  try {
    res.json(await mensagemService.marcarTodasLidas(req.body.id_tenant, req.usuario))
  } catch (err) {
    next(err)
  }
}

/** DELETE /mensagens/:id */
async function excluir(req, res, next) {
  try {
    await mensagemService.excluir(req.params.id, req.usuario)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}

module.exports = {
  caixaDeEntrada,
  contarNaoLidas,
  opcoes,
  listarEnviadas,
  listarDestinatarios,
  enviar,
  marcarLida,
  marcarTodasLidas,
  excluir,
}
