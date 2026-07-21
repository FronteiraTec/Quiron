/**
 * Controller da configuracao da agenda (HTTP). Delega ao agendaConfigService.
 *
 * O id_tenant vem da query nas leituras e do corpo nas escritas, seguindo o
 * padrao das demais rotas de configuracao. Quem autoriza e o service.
 */
const agendaConfigService = require("../services/agendaConfigService")

/** "true" na query string e string, nao booleano. */
const ehVerdadeiro = (valor) => valor === "true" || valor === true

// --- Categorias ---

async function listarCategorias(req, res, next) {
  try {
    const categorias = await agendaConfigService.listarCategorias(
      req.query.id_tenant,
      req.usuario,
      ehVerdadeiro(req.query.incluir_inativas)
    )
    res.json({ categorias })
  } catch (err) {
    next(err)
  }
}

async function criarCategoria(req, res, next) {
  try {
    const { id_tenant, rotulo, cor, icone, ordem } = req.body
    const categoria = await agendaConfigService.criarCategoria(
      id_tenant,
      { rotulo, cor, icone, ordem },
      req.usuario
    )
    res.status(201).json({ categoria })
  } catch (err) {
    next(err)
  }
}

async function atualizarCategoria(req, res, next) {
  try {
    const { id_tenant, rotulo, cor, icone, ordem } = req.body
    const categoria = await agendaConfigService.atualizarCategoria(
      id_tenant,
      req.params.chave,
      { rotulo, cor, icone, ordem },
      req.usuario
    )
    res.json({ categoria })
  } catch (err) {
    next(err)
  }
}

async function alterarStatusCategoria(req, res, next) {
  try {
    const { id_tenant, ativo } = req.body
    const categoria = await agendaConfigService.alterarStatusCategoria(
      id_tenant,
      req.params.chave,
      ativo,
      req.usuario
    )
    res.json({ categoria })
  } catch (err) {
    next(err)
  }
}

async function usoDaCategoria(req, res, next) {
  try {
    res.json(await agendaConfigService.usoDaCategoria(req.query.id_tenant, req.params.chave, req.usuario))
  } catch (err) {
    next(err)
  }
}

// --- Locais ---

async function listarLocais(req, res, next) {
  try {
    const locais = await agendaConfigService.listarLocais(
      req.query.id_tenant,
      req.usuario,
      ehVerdadeiro(req.query.incluir_inativos)
    )
    res.json({ locais })
  } catch (err) {
    next(err)
  }
}

async function criarLocal(req, res, next) {
  try {
    const { id_tenant, nome, endereco, capacidade } = req.body
    const local = await agendaConfigService.criarLocal(
      id_tenant,
      { nome, endereco, capacidade },
      req.usuario
    )
    res.status(201).json({ local })
  } catch (err) {
    next(err)
  }
}

async function atualizarLocal(req, res, next) {
  try {
    const { id_tenant, nome, endereco, capacidade } = req.body
    const local = await agendaConfigService.atualizarLocal(
      id_tenant,
      req.params.id,
      { nome, endereco, capacidade },
      req.usuario
    )
    res.json({ local })
  } catch (err) {
    next(err)
  }
}

async function alterarStatusLocal(req, res, next) {
  try {
    const { id_tenant, ativo } = req.body
    const local = await agendaConfigService.alterarStatusLocal(
      id_tenant,
      req.params.id,
      ativo,
      req.usuario
    )
    res.json({ local })
  } catch (err) {
    next(err)
  }
}

async function usoDoLocal(req, res, next) {
  try {
    res.json(await agendaConfigService.usoDoLocal(req.query.id_tenant, req.params.id, req.usuario))
  } catch (err) {
    next(err)
  }
}

module.exports = {
  listarCategorias,
  criarCategoria,
  atualizarCategoria,
  alterarStatusCategoria,
  usoDaCategoria,

  listarLocais,
  criarLocal,
  atualizarLocal,
  alterarStatusLocal,
  usoDoLocal,
}
