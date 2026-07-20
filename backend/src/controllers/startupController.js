/**
 * Controller de Startups (HTTP). Delega ao startupService.
 */
const startupService = require("../services/startupService")

async function listar(req, res, next) {
  try {
    res.json({ startups: await startupService.listar(req.query.id_tenant, req.usuario.id, req.usuario) })
  } catch (err) {
    next(err)
  }
}

async function buscar(req, res, next) {
  try {
    res.json({ startup: await startupService.buscar(req.params.id, req.usuario) })
  } catch (err) {
    next(err)
  }
}

async function criar(req, res, next) {
  try {
    const { id_tenant, nome, cnpj } = req.body
    const startup = await startupService.criar({ idTenant: id_tenant, nome, cnpj }, req.usuario)
    res.status(201).json({ startup })
  } catch (err) {
    next(err)
  }
}

async function atualizar(req, res, next) {
  try {
    const { nome, cnpj } = req.body
    const startup = await startupService.atualizar(req.params.id, { nome, cnpj }, req.usuario)
    res.json({ startup })
  } catch (err) {
    next(err)
  }
}

async function atualizarStatus(req, res, next) {
  try {
    const startup = await startupService.atualizarStatus(req.params.id, req.body.status, req.usuario)
    res.json({ startup })
  } catch (err) {
    next(err)
  }
}

async function adicionarMembro(req, res, next) {
  try {
    const { id_usuario, lider } = req.body
    const membro = await startupService.adicionarMembro(req.params.id, id_usuario, lider, req.usuario)
    res.status(201).json({ membro })
  } catch (err) {
    next(err)
  }
}

async function listarMembros(req, res, next) {
  try {
    res.json({ membros: await startupService.listarMembros(req.params.id, req.usuario) })
  } catch (err) {
    next(err)
  }
}

/** Membros de todas as startups do tenant + os incubados sem vinculo. */
async function listarMembrosDoTenant(req, res, next) {
  try {
    res.json(await startupService.listarMembrosDoTenant(req.query.id_tenant, req.usuario))
  } catch (err) {
    next(err)
  }
}

async function removerMembro(req, res, next) {
  try {
    await startupService.removerMembro(req.params.id, req.params.idUsuario, req.usuario)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}

async function buscarMinha(req, res, next) {
  try {
    const startup = await startupService.buscarMinha(req.query.id_tenant, req.usuario.id)
    res.json({ startup })
  } catch (err) {
    next(err)
  }
}

async function listarFasesConcluidas(req, res, next) {
  try {
    res.json({ fases: await startupService.listarFasesConcluidas(req.params.id, req.usuario) })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  listar,
  buscar,
  criar,
  atualizar,
  atualizarStatus,
  adicionarMembro,
  listarMembros,
  listarMembrosDoTenant,
  removerMembro,
  buscarMinha,
  listarFasesConcluidas,
}
