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

/** GET /mensagens/conversas?id_tenant= — a lista de conversas (estilo chat). */
async function listarConversas(req, res, next) {
  try {
    const conversas = await mensagemService.conversas(req.query.id_tenant, req.usuario)
    res.json({ conversas })
  } catch (err) {
    next(err)
  }
}

/** GET /mensagens/conversas/:id?id_tenant=&limite= — a thread com uma pessoa. */
async function abrirConversa(req, res, next) {
  try {
    const dados = await mensagemService.conversa(req.query.id_tenant, req.usuario, req.params.id, {
      limite: req.query.limite,
      // "?marcar=nao" abre sem dar por lido (usado pela atualizacao em segundo
      // plano, que nao deve marcar o que ninguem olhou).
      marcarLidas: req.query.marcar !== "nao",
    })
    res.json(dados)
  } catch (err) {
    next(err)
  }
}

/** POST /mensagens/conversas/:id — responde na conversa (body: id_tenant, corpo). */
async function responder(req, res, next) {
  try {
    const mensagem = await mensagemService.responder(req.body.id_tenant, req.usuario, req.params.id, {
      corpo: req.body.corpo,
      idMensagemPai: req.body.id_mensagem_pai,
    })
    res.status(201).json({ mensagem })
  } catch (err) {
    next(err)
  }
}

/** POST /mensagens/conversas/:id/lidas — zera o nao lido daquela conversa. */
async function marcarConversaLida(req, res, next) {
  try {
    res.json(await mensagemService.marcarConversaLida(req.body.id_tenant, req.usuario, req.params.id))
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
  listarConversas,
  abrirConversa,
  responder,
  marcarConversaLida,
  opcoes,
  listarEnviadas,
  listarDestinatarios,
  enviar,
  marcarLida,
  marcarTodasLidas,
  excluir,
}
