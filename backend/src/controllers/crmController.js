/**
 * Controllers do Mini CRM (HTTP): contexto, painel, clientes, oportunidades e
 * tarefas. Finos de proposito — leem a requisicao, chamam o service e devolvem
 * a resposta. Quem autoriza (membro + beneficio) e cada service, pelo
 * crmAcessoService.
 *
 * Um arquivo para o modulo inteiro: os handlers sao todos do mesmo formato, e
 * espalha-los em quatro arquivos so repetiria o boilerplate.
 */
const crmAcessoService = require("../services/crmAcessoService")
const crmPainelService = require("../services/crmPainelService")
const crmClienteService = require("../services/crmClienteService")
const crmOportunidadeService = require("../services/crmOportunidadeService")
const crmTarefaService = require("../services/crmTarefaService")

/** Embrulha o handler no try/catch que repassa o erro ao errorHandler. */
const handler = (fn) => async (req, res, next) => {
  try {
    await fn(req, res)
  } catch (err) {
    next(err)
  }
}

const s = (req) => req.params.idStartup

module.exports = {
  contexto: handler(async (req, res) => {
    res.json(await crmAcessoService.contexto(s(req), req.usuario))
  }),
  painel: handler(async (req, res) => {
    res.json(await crmPainelService.painel(s(req), req.query, req.usuario))
  }),

  // ----------------------------------------------------------------- clientes
  listarClientes: handler(async (req, res) => {
    res.json({ clientes: await crmClienteService.listar(s(req), req.usuario) })
  }),
  buscarCliente: handler(async (req, res) => {
    res.json(await crmClienteService.buscar(s(req), req.params.idCliente, req.usuario))
  }),
  criarCliente: handler(async (req, res) => {
    res.status(201).json({ cliente: await crmClienteService.criar(s(req), req.body, req.usuario) })
  }),
  atualizarCliente: handler(async (req, res) => {
    res.json({ cliente: await crmClienteService.atualizar(s(req), req.params.idCliente, req.body, req.usuario) })
  }),
  excluirCliente: handler(async (req, res) => {
    await crmClienteService.excluir(s(req), req.params.idCliente, req.usuario)
    res.status(204).end()
  }),
  historicoCliente: handler(async (req, res) => {
    res.json(await crmClienteService.historico(s(req), req.params.idCliente, req.query, req.usuario))
  }),
  atividadeCliente: handler(async (req, res) => {
    res.status(201).json(await crmClienteService.registrarAtividade(s(req), req.params.idCliente, req.body, req.usuario))
  }),

  // ------------------------------------------------------------ oportunidades
  listarOportunidades: handler(async (req, res) => {
    res.json({ oportunidades: await crmOportunidadeService.listar(s(req), req.query, req.usuario) })
  }),
  buscarOportunidade: handler(async (req, res) => {
    res.json(await crmOportunidadeService.buscar(s(req), req.params.idOportunidade, req.usuario))
  }),
  criarOportunidade: handler(async (req, res) => {
    res.status(201).json({ oportunidade: await crmOportunidadeService.criar(s(req), req.body, req.usuario) })
  }),
  atualizarOportunidade: handler(async (req, res) => {
    res.json({
      oportunidade: await crmOportunidadeService.atualizar(s(req), req.params.idOportunidade, req.body, req.usuario),
    })
  }),
  moverOportunidade: handler(async (req, res) => {
    res.json({
      oportunidade: await crmOportunidadeService.moverEtapa(s(req), req.params.idOportunidade, req.body, req.usuario),
    })
  }),
  ganharOportunidade: handler(async (req, res) => {
    res.json({
      oportunidade: await crmOportunidadeService.ganhar(s(req), req.params.idOportunidade, req.body, req.usuario),
    })
  }),
  perderOportunidade: handler(async (req, res) => {
    res.json({
      oportunidade: await crmOportunidadeService.perder(s(req), req.params.idOportunidade, req.body, req.usuario),
    })
  }),
  reabrirOportunidade: handler(async (req, res) => {
    res.json({
      oportunidade: await crmOportunidadeService.reabrir(s(req), req.params.idOportunidade, req.body, req.usuario),
    })
  }),
  excluirOportunidade: handler(async (req, res) => {
    await crmOportunidadeService.excluir(s(req), req.params.idOportunidade, req.usuario)
    res.status(204).end()
  }),
  historicoOportunidade: handler(async (req, res) => {
    res.json(await crmOportunidadeService.historico(s(req), req.params.idOportunidade, req.query, req.usuario))
  }),
  atividadeOportunidade: handler(async (req, res) => {
    res
      .status(201)
      .json(await crmOportunidadeService.registrarAtividade(s(req), req.params.idOportunidade, req.body, req.usuario))
  }),

  // ------------------------------------------------------------------ tarefas
  listarTarefas: handler(async (req, res) => {
    res.json({ tarefas: await crmTarefaService.listar(s(req), req.query, req.usuario) })
  }),
  buscarTarefa: handler(async (req, res) => {
    res.json({ tarefa: await crmTarefaService.buscar(s(req), req.params.idTarefa, req.usuario) })
  }),
  criarTarefa: handler(async (req, res) => {
    res.status(201).json({ tarefa: await crmTarefaService.criar(s(req), req.body, req.usuario) })
  }),
  atualizarTarefa: handler(async (req, res) => {
    res.json({ tarefa: await crmTarefaService.atualizar(s(req), req.params.idTarefa, req.body, req.usuario) })
  }),
  mudarStatusTarefa: handler(async (req, res) => {
    res.json({ tarefa: await crmTarefaService.mudarStatus(s(req), req.params.idTarefa, req.body, req.usuario) })
  }),
}
