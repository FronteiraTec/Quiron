/**
 * Controller da integracao com o Google Agenda (HTTP).
 * Delega ao googleAgendaService.
 *
 * A conexao e sempre do usuario autenticado (req.usuario.id) — nao ha id na
 * URL, pelo mesmo motivo do preferenciaController: ninguem conecta a agenda de
 * outra pessoa.
 *
 * O `callback` foge do padrao dos demais e esta documentado nele.
 */
const googleAgendaService = require("../services/googleAgendaService")

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost"

/** GET /google-agenda/status */
async function status(req, res, next) {
  try {
    res.json({ google: await googleAgendaService.status(req.usuario.id) })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /google-agenda/autorizar
 *
 * Devolve a URL em JSON em vez de responder 302 para o Google. O frontend fala
 * por XHR autenticado: um redirect aqui seria seguido pelo axios, que tentaria
 * buscar a tela de consentimento do Google por baixo dos panos e falharia no
 * CORS. Quem precisa navegar e a JANELA, e so ela pode fazer isso.
 */
async function autorizar(req, res, next) {
  try {
    res.json({ url: googleAgendaService.urlAutorizacao(req.usuario.id) })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /google-agenda/callback  — PUBLICA (sem Bearer Token).
 *
 * Quem chega aqui e o NAVEGADOR, redirecionado pelo Google depois da tela de
 * consentimento: nao ha como enviar o cabecalho Authorization nesse salto.
 * Quem identifica a pessoa e o `state` assinado (ver googleAgendaService).
 *
 * Responde com REDIRECT e nao com JSON — do outro lado nao ha codigo esperando
 * uma resposta, ha uma pessoa olhando uma aba em branco. O resultado vai na
 * query para a tela de perfil exibir o aviso, e por isso tambem nao usa o
 * next(err) dos outros handlers: um erro aqui viraria o JSON do errorHandler na
 * cara do usuario.
 */
async function callback(req, res) {
  const destino = (parametros) => `${FRONTEND_URL}/perfil?${new URLSearchParams(parametros)}`

  // A pessoa clicou em "cancelar" na tela do Google. Nao e erro: e desistencia.
  if (req.query.error) {
    return res.redirect(destino({ google: "cancelado" }))
  }

  try {
    await googleAgendaService.concluirAutorizacao(req.query.code, req.query.state)
    return res.redirect(destino({ google: "ok" }))
  } catch (err) {
    console.error("[google-agenda] Callback falhou:", err.message)
    return res.redirect(destino({ google: "erro", motivo: err.message }))
  }
}

/** POST /google-agenda/sincronizar */
async function sincronizar(req, res, next) {
  try {
    const resultado = await googleAgendaService.sincronizar(req.usuario.id)
    res.json({ mensagem: `${resultado.enviados} evento(s) enviados ao Google.`, ...resultado })
  } catch (err) {
    next(err)
  }
}

/** PATCH /google-agenda/sincronizacao  — body: { ativo: boolean } */
async function alterarSincronizacao(req, res, next) {
  try {
    const conexao = await googleAgendaService.definirSincronizar(req.usuario.id, req.body?.ativo)
    res.json({
      mensagem: conexao.sincronizar ? "Sincronizacao retomada." : "Sincronizacao pausada.",
      conexao,
    })
  } catch (err) {
    next(err)
  }
}

/** DELETE /google-agenda/conexao */
async function desconectar(req, res, next) {
  try {
    await googleAgendaService.desconectar(req.usuario.id)
    res.json({ mensagem: "Conta do Google desconectada." })
  } catch (err) {
    next(err)
  }
}

module.exports = { status, autorizar, callback, sincronizar, alterarSincronizacao, desconectar }
