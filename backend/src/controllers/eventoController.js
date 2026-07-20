/**
 * Controller de Eventos (HTTP). Delega ao eventoService.
 */
const eventoService = require("../services/eventoService")

// Le os campos de evento do corpo da requisicao (usado em criar/atualizar).
function lerCampos(body) {
  const {
    titulo, descricao, categoria, local, inicio_ts, fim_ts,
    id_startups, mentor_nome, anexos, vagas, obrigatorio,
  } = body
  return {
    titulo,
    descricao,
    categoria,
    local,
    inicioTs: inicio_ts,
    fimTs: fim_ts,
    idsStartups: Array.isArray(id_startups) ? id_startups : [],
    mentorNome: mentor_nome,
    anexos,
    vagas,
    obrigatorio,
  }
}

async function listar(req, res, next) {
  try {
    const { id_tenant, inicio, fim } = req.query
    res.json({ eventos: await eventoService.listar(id_tenant, { inicio, fim }, req.usuario.id, req.usuario) })
  } catch (err) {
    next(err)
  }
}

async function buscar(req, res, next) {
  try {
    res.json({ evento: await eventoService.buscar(req.params.id, req.usuario) })
  } catch (err) {
    next(err)
  }
}

async function criar(req, res, next) {
  try {
    const evento = await eventoService.criar(
      {
        idTenant: req.body.id_tenant,
        ...lerCampos(req.body),
        criadoPor: req.usuario.id,
      },
      req.usuario
    )
    res.status(201).json({ evento })
  } catch (err) {
    next(err)
  }
}

async function atualizar(req, res, next) {
  try {
    const evento = await eventoService.atualizar(req.params.id, lerCampos(req.body), req.usuario)
    res.json({ evento })
  } catch (err) {
    next(err)
  }
}

async function excluir(req, res, next) {
  try {
    await eventoService.excluir(req.params.id, req.usuario)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}

async function confirmarPresenca(req, res, next) {
  try {
    const { status } = req.body
    // Confirma a presenca do usuario autenticado.
    const confirmacao = await eventoService.confirmarPresenca(
      req.params.id,
      req.usuario.id,
      status
    )
    res.status(201).json({ confirmacao })
  } catch (err) {
    next(err)
  }
}

async function listarParticipantes(req, res, next) {
  try {
    res.json({ participantes: await eventoService.listarParticipantes(req.params.id) })
  } catch (err) {
    next(err)
  }
}

// --- Presenca (check-in marcado pelo admin) ---

async function resumoPresenca(req, res, next) {
  try {
    const eventos = await eventoService.resumoPresenca(
      req.query.id_tenant,
      req.query.dias,
      req.usuario
    )
    res.json({ eventos })
  } catch (err) {
    next(err)
  }
}

async function listarPresenca(req, res, next) {
  try {
    res.json(await eventoService.listarPresenca(req.params.id, req.usuario))
  } catch (err) {
    next(err)
  }
}

async function marcarPresenca(req, res, next) {
  try {
    // Aceita uma pessoa (id_usuarios: 8) ou o lote da tela (id_usuarios: [8,9]).
    const { id_usuarios, presente } = req.body
    const marcados = await eventoService.marcarPresenca(
      req.params.id,
      id_usuarios,
      presente,
      req.usuario
    )
    res.json({ marcados })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  listar,
  buscar,
  criar,
  atualizar,
  excluir,
  confirmarPresenca,
  listarParticipantes,
  resumoPresenca,
  listarPresenca,
  marcarPresenca,
}
