/**
 * Controller dos selos (HTTP). Delega ao seloService.
 *
 * `meus` e `publico` NAO passam por RBAC no service: sao as conquistas da
 * propria pessoa e a decisao dela de expor (ou nao) o proprio nome numa
 * pagina aberta.
 */
const seloService = require("../services/seloService")

const ehVerdadeiro = (valor) => valor === "true" || valor === true

async function listar(req, res, next) {
  try {
    res.json(
      await seloService.listar(
        req.query.id_tenant,
        req.usuario,
        ehVerdadeiro(req.query.incluir_inativos)
      )
    )
  } catch (err) {
    next(err)
  }
}

async function criar(req, res, next) {
  try {
    const selo = await seloService.criar(req.body.id_tenant, req.body, req.usuario)
    res.status(201).json({ selo })
  } catch (err) {
    next(err)
  }
}

async function atualizar(req, res, next) {
  try {
    const selo = await seloService.atualizar(
      req.body.id_tenant,
      req.params.id,
      req.body,
      req.usuario
    )
    res.json({ selo })
  } catch (err) {
    next(err)
  }
}

async function alterarAtivo(req, res, next) {
  try {
    const { id_tenant, ativo } = req.body
    const selo = await seloService.alterarAtivo(id_tenant, req.params.id, ativo, req.usuario)
    res.json({ selo })
  } catch (err) {
    next(err)
  }
}

async function excluir(req, res, next) {
  try {
    res.json(await seloService.excluir(req.query.id_tenant, req.params.id, req.usuario))
  } catch (err) {
    next(err)
  }
}

async function conceder(req, res, next) {
  try {
    const { id_tenant, ids_usuarios, justificativa, evidencia_url, id_startup } = req.body
    const resultado = await seloService.conceder(
      id_tenant,
      req.params.id,
      { ids_usuarios, justificativa, evidencia_url, id_startup },
      req.usuario
    )
    res.status(201).json(resultado)
  } catch (err) {
    next(err)
  }
}

async function revogar(req, res, next) {
  try {
    const { id_tenant, motivo } = req.body
    const concessao = await seloService.revogar(id_tenant, req.params.id, motivo, req.usuario)
    res.json({ concessao })
  } catch (err) {
    next(err)
  }
}

async function listarConcessoes(req, res, next) {
  try {
    const concessoes = await seloService.listarConcessoes(
      req.query.id_tenant,
      { id_selo: req.query.id_selo, id_usuario: req.query.id_usuario },
      req.usuario
    )
    res.json({ concessoes })
  } catch (err) {
    next(err)
  }
}

async function meus(req, res, next) {
  try {
    const selos = await seloService.meusSelos(req.query.id_tenant, req.usuario)
    res.json({ selos })
  } catch (err) {
    next(err)
  }
}

async function alterarPublico(req, res, next) {
  try {
    const { id_tenant, publico } = req.body
    const concessao = await seloService.alterarPublico(
      id_tenant,
      req.params.id,
      publico,
      req.usuario
    )
    res.json({ concessao })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  listar,
  criar,
  atualizar,
  alterarAtivo,
  excluir,
  conceder,
  revogar,
  listarConcessoes,
  meus,
  alterarPublico,
}
