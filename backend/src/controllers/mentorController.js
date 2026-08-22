/**
 * Controller de Mentores (HTTP). Delega ao mentorService.
 */
const mentorService = require("../services/mentorService")

async function listar(req, res, next) {
  try {
    // `dias` e a janela de "mentorias no periodo", escolhida na propria tela.
    // Sai na resposta junto com a lista — ver mentorService.listar.
    const { mentores, dias } = await mentorService.listar(
      req.query.id_tenant,
      req.usuario,
      req.query.dias
    )
    res.json({ mentores, dias })
  } catch (err) {
    next(err)
  }
}

async function criar(req, res, next) {
  try {
    const mentor = await mentorService.criar(req.body.id_tenant, req.body, req.usuario)
    res.status(201).json({ mentor })
  } catch (err) {
    next(err)
  }
}

async function salvarPerfil(req, res, next) {
  try {
    const perfil = await mentorService.salvarPerfil(
      req.body.id_tenant,
      req.params.idUsuario,
      req.body,
      req.usuario
    )
    res.json({ perfil })
  } catch (err) {
    next(err)
  }
}

async function alterarSituacao(req, res, next) {
  try {
    const perfil = await mentorService.alterarSituacao(
      req.body.id_tenant,
      req.params.idUsuario,
      req.body.situacao,
      req.usuario
    )
    res.json({ perfil })
  } catch (err) {
    next(err)
  }
}

async function detalhar(req, res, next) {
  try {
    const dados = await mentorService.detalhar(
      req.query.id_tenant,
      req.params.idUsuario,
      req.usuario
    )
    res.json(dados)
  } catch (err) {
    next(err)
  }
}

async function vincular(req, res, next) {
  try {
    const { id_tenant, id_startup } = req.body
    const vinculo = await mentorService.vincular(
      id_tenant,
      req.params.idUsuario,
      id_startup,
      req.usuario
    )
    res.status(201).json({ vinculo })
  } catch (err) {
    next(err)
  }
}

async function desvincular(req, res, next) {
  try {
    // DELETE nao tem corpo: o tenant vem da query, como nas demais listagens.
    await mentorService.desvincular(
      req.query.id_tenant,
      req.params.idUsuario,
      req.params.idStartup,
      req.usuario
    )
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}

async function listarPorStartup(req, res, next) {
  try {
    res.json({ mentores: await mentorService.listarPorStartup(req.params.id) })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  listar,
  criar,
  salvarPerfil,
  alterarSituacao,
  detalhar,
  vincular,
  desvincular,
  listarPorStartup,
}
