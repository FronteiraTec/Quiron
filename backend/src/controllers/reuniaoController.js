/**
 * Controller das reunioes por video (HTTP). Delega ao reuniaoService.
 *
 * O id_tenant so vem do pedido na LISTAGEM e na CRIACAO. Nas rotas com :id o
 * tenant e lido da propria reuniao — ver reuniaoService.carregarVisivel.
 */
const reuniaoService = require("../services/reuniaoService")
const reuniaoWebhookService = require("../services/reuniaoWebhookService")
const gravacaoService = require("../services/reuniaoGravacaoService")

/** Os campos de uma reuniao no corpo (criar e editar). */
function lerCampos(body) {
  return {
    titulo: body.titulo,
    descricao: body.descricao,
    categoria: body.categoria,
    inicioTs: body.inicio_ts,
    fimTs: body.fim_ts,
    idStartup: body.id_startup || null,
    gravarAudio: body.gravar_audio,
    // `undefined` (chave ausente) = "nao mexi nos convidados"; lista vazia =
    // "tirei todos". O service depende dessa diferenca.
    participantes: body.participantes,
  }
}

const tratar = (fn) => async (req, res, next) => {
  try {
    await fn(req, res)
  } catch (err) {
    next(err)
  }
}

module.exports = {
  disponibilidade: tratar(async (req, res) => {
    res.json(reuniaoService.disponibilidade())
  }),

  listar: tratar(async (req, res) => {
    const { id_tenant, de, ate, status } = req.query
    res.json(await reuniaoService.listar(id_tenant, { de, ate, status }, req.usuario))
  }),

  convidaveis: tratar(async (req, res) => {
    res.json({ pessoas: await reuniaoService.listarConvidaveis(req.query.id_tenant, req.usuario) })
  }),

  buscar: tratar(async (req, res) => {
    res.json({ reuniao: await reuniaoService.buscar(req.params.id, req.usuario) })
  }),

  criar: tratar(async (req, res) => {
    const reuniao = await reuniaoService.criar(req.body.id_tenant, lerCampos(req.body), req.usuario)
    res.status(201).json({ reuniao })
  }),

  atualizar: tratar(async (req, res) => {
    res.json({ reuniao: await reuniaoService.atualizar(req.params.id, lerCampos(req.body), req.usuario) })
  }),

  definirParticipantes: tratar(async (req, res) => {
    const reuniao = await reuniaoService.definirParticipantes(
      req.params.id,
      req.body.participantes,
      req.usuario
    )
    res.json({ reuniao })
  }),

  cancelar: tratar(async (req, res) => {
    res.json({ reuniao: await reuniaoService.cancelar(req.params.id, req.usuario) })
  }),

  excluir: tratar(async (req, res) => {
    res.json(await reuniaoService.excluir(req.params.id, req.usuario))
  }),

  token: tratar(async (req, res) => {
    res.json(await reuniaoService.emitirToken(req.params.id, req.usuario))
  }),

  encerrar: tratar(async (req, res) => {
    // 202: a sala fecha no LiveKit em segundo plano.
    res.status(202).json(await reuniaoService.encerrar(req.params.id, req.usuario))
  }),

  // --- Gravacao e transcricao (Etapa 4) ----------------------------------

  consentimento: tratar(async (req, res) => {
    res.json({ consentimento: await gravacaoService.consentir(req.params.id, req.body.aceito, req.usuario) })
  }),

  abrirGravacao: tratar(async (req, res) => {
    res.status(201).json(await gravacaoService.abrirGravacao(req.params.id, { mime: req.body.mime }, req.usuario))
  }),

  /** O corpo e o audio CRU (express.raw so nesta rota, ate 512 KB). */
  receberParte: tratar(async (req, res) => {
    const dados = Buffer.isBuffer(req.body) ? req.body : null
    res.json(
      await gravacaoService.receberParte(
        req.params.id,
        req.params.idAudio,
        req.params.n,
        { dados, tipo: req.get("Content-Type") },
        req.usuario
      )
    )
  }),

  fecharGravacao: tratar(async (req, res) => {
    res.json(await gravacaoService.fecharGravacao(req.params.id, req.params.idAudio, req.usuario))
  }),

  transcricao: tratar(async (req, res) => {
    res.json(await gravacaoService.lerTranscricao(req.params.id, req.usuario))
  }),

  processamentos: tratar(async (req, res) => {
    res.json({ processamentos: await gravacaoService.listarProcessamentos(req.params.id, req.usuario) })
  }),

  reprocessar: tratar(async (req, res) => {
    res.status(201).json({ processamento: await gravacaoService.reprocessar(req.params.id, { tipo: req.body.tipo }, req.usuario) })
  }),

  cancelarProcessamento: tratar(async (req, res) => {
    res.json({ processamento: await gravacaoService.cancelarProcessamento(req.params.idProcessamento, req.usuario) })
  }),

  /**
   * POST /livekit/webhook. O corpo chega CRU (Buffer) — o app.js monta o
   * express.raw antes do express.json para esta rota —, porque a assinatura
   * confere os bytes exatos.
   */
  webhook: tratar(async (req, res) => {
    const corpo = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : ""
    res.json(await reuniaoWebhookService.receber(corpo, req.get("Authorization")))
  }),
}
