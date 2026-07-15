/**
 * Controller de RBAC (HTTP). Delega ao rbacService.
 */
const rbacService = require("../services/rbacService")

async function catalogo(req, res, next) {
  try {
    res.json({ catalogo: await rbacService.catalogo() })
  } catch (err) {
    next(err)
  }
}

async function listarRoles(req, res, next) {
  try {
    res.json({ roles: await rbacService.listarRoles(req.params.id, req.usuario) })
  } catch (err) {
    next(err)
  }
}

async function buscarRole(req, res, next) {
  try {
    res.json({ role: await rbacService.buscarRole(req.params.id, req.params.idRole, req.usuario) })
  } catch (err) {
    next(err)
  }
}

async function criarRole(req, res, next) {
  try {
    const { nome, descricao } = req.body
    const role = await rbacService.criarRole(req.params.id, req.usuario, { nome, descricao })
    res.status(201).json({ role })
  } catch (err) {
    next(err)
  }
}

async function atualizarRole(req, res, next) {
  try {
    const { nome, descricao } = req.body
    const role = await rbacService.atualizarRole(req.params.id, req.params.idRole, req.usuario, {
      nome,
      descricao,
    })
    res.json({ role })
  } catch (err) {
    next(err)
  }
}

async function excluirRole(req, res, next) {
  try {
    await rbacService.excluirRole(req.params.id, req.params.idRole, req.usuario)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}

async function definirPermissoesDaRole(req, res, next) {
  try {
    const permissoes = await rbacService.definirPermissoesDaRole(
      req.params.id,
      req.params.idRole,
      req.usuario,
      req.body.permissoes
    )
    res.json({ permissoes })
  } catch (err) {
    next(err)
  }
}

async function redefinirSenhaUsuario(req, res, next) {
  try {
    await rbacService.redefinirSenhaUsuario(req.params.id, req.params.idUsuario, req.usuario)
    res.json({ mensagem: "Se o usuario existir, enviaremos um link de redefinicao de senha para o email cadastrado." })
  } catch (err) {
    next(err)
  }
}

async function minhasPermissoes(req, res, next) {
  try {
    const permissoes = await rbacService.minhasPermissoes(req.query.id_tenant, req.usuario)
    res.json({ permissoes })
  } catch (err) {
    next(err)
  }
}

async function listarUsuariosComRoles(req, res, next) {
  try {
    res.json({ usuarios: await rbacService.listarUsuariosComRoles(req.params.id, req.usuario) })
  } catch (err) {
    next(err)
  }
}

async function vincularUsuario(req, res, next) {
  try {
    const usuarios = await rbacService.vincularUsuario(
      req.params.id,
      req.params.idRole,
      req.usuario,
      req.body.id_usuario
    )
    res.status(201).json({ usuarios })
  } catch (err) {
    next(err)
  }
}

async function desvincularUsuario(req, res, next) {
  try {
    const usuarios = await rbacService.desvincularUsuario(
      req.params.id,
      req.params.idRole,
      req.usuario,
      req.params.idUsuario
    )
    res.json({ usuarios })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  catalogo,
  minhasPermissoes,
  redefinirSenhaUsuario,
  listarRoles,
  buscarRole,
  criarRole,
  atualizarRole,
  excluirRole,
  definirPermissoesDaRole,
  listarUsuariosComRoles,
  vincularUsuario,
  desvincularUsuario,
}
