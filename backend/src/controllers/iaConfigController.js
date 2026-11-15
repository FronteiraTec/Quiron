/**
 * Controller das integracoes de IA da incubadora (HTTP). Delega ao
 * iaConfigService. A chave de API entra por aqui e nunca sai.
 */
const iaConfigService = require("../services/iaConfigService")

const tratar = (fn) => async (req, res, next) => {
  try {
    await fn(req, res)
  } catch (err) {
    next(err)
  }
}

module.exports = {
  listar: tratar(async (req, res) => {
    res.json(await iaConfigService.listar(req.query.id_tenant, req.usuario))
  }),

  salvar: tratar(async (req, res) => {
    const configuracao = await iaConfigService.salvar(req.body.id_tenant, req.params.finalidade, req.body, req.usuario)
    res.json({ configuracao })
  }),

  testar: tratar(async (req, res) => {
    res.json(await iaConfigService.testar(req.body.id_tenant, req.params.finalidade, req.usuario))
  }),

  salvarRetencao: tratar(async (req, res) => {
    res.json({ retencao: await iaConfigService.salvarRetencao(req.body.id_tenant, req.body, req.usuario) })
  }),
}
