/**
 * Controller de Tenants (HTTP). Delega ao tenantService.
 */
const tenantService = require("../services/tenantService")

async function listar(req, res, next) {
  try {
    res.json({ tenants: await tenantService.listar() })
  } catch (err) {
    next(err)
  }
}

async function buscar(req, res, next) {
  try {
    res.json({ tenant: await tenantService.buscarComPermissao(req.params.id, req.usuario) })
  } catch (err) {
    next(err)
  }
}

async function criar(req, res, next) {
  try {
    res.status(201).json({ tenant: await tenantService.criar(req.body) })
  } catch (err) {
    next(err)
  }
}

async function atualizar(req, res, next) {
  try {
    res.json({ tenant: await tenantService.atualizar(req.params.id, req.body) })
  } catch (err) {
    next(err)
  }
}

async function alterarStatus(req, res, next) {
  try {
    const tenant = await tenantService.alterarStatus(req.params.id, req.body.ativo)
    res.json({ tenant })
  } catch (err) {
    next(err)
  }
}

async function listarUsuarios(req, res, next) {
  try {
    res.json({ usuarios: await tenantService.listarUsuarios(req.params.id, req.usuario) })
  } catch (err) {
    next(err)
  }
}

async function criarUsuario(req, res, next) {
  try {
    const { nome, email, celular, senha, papel } = req.body
    const usuario = await tenantService.criarUsuario(
      req.params.id,
      { nome, email, celular, senha, papel },
      req.usuario
    )
    res.status(201).json({ usuario })
  } catch (err) {
    next(err)
  }
}

async function atualizarUsuario(req, res, next) {
  try {
    const { nome, celular, papel } = req.body
    const vinculo = await tenantService.atualizarUsuario(
      req.params.id,
      req.params.idUsuario,
      { nome, celular, papel },
      req.usuario
    )
    res.json({ vinculo })
  } catch (err) {
    next(err)
  }
}

async function alterarStatusUsuario(req, res, next) {
  try {
    const vinculo = await tenantService.alterarStatusUsuario(
      req.params.id,
      req.params.idUsuario,
      req.body.ativo,
      req.usuario
    )
    res.json({ vinculo })
  } catch (err) {
    next(err)
  }
}

async function vincularUsuario(req, res, next) {
  try {
    const { id_usuario, papel } = req.body
    const vinculo = await tenantService.vincularUsuario(req.params.id, id_usuario, papel)
    res.status(201).json({ vinculo })
  } catch (err) {
    next(err)
  }
}

async function atualizarConfigEmail(req, res, next) {
  try {
    const { email_remetente_nome, email_remetente, email_reply_to } = req.body
    const config = await tenantService.atualizarConfigEmail(
      req.params.id,
      { nome: email_remetente_nome, remetente: email_remetente, replyTo: email_reply_to },
      req.usuario
    )
    res.json({ mensagem: "Configuracao de e-mail atualizada.", config })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  listar,
  buscar,
  criar,
  atualizar,
  alterarStatus,
  listarUsuarios,
  criarUsuario,
  atualizarUsuario,
  alterarStatusUsuario,
  vincularUsuario,
  atualizarConfigEmail,
}
