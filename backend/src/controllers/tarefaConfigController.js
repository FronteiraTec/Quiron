/**
 * Controller da configuracao da gestao de tarefas (HTTP). Delega ao
 * tarefaConfigService.
 *
 * O id_tenant vem da query nas leituras e do corpo nas escritas, seguindo o
 * padrao das demais rotas de configuracao. Quem autoriza e o service.
 */
const tarefaConfigService = require("../services/tarefaConfigService")

/** "true" na query string e string, nao booleano. */
const ehVerdadeiro = (valor) => valor === "true" || valor === true

// --- Status (as colunas do quadro) ---

async function listarStatus(req, res, next) {
  try {
    const status = await tarefaConfigService.listarStatus(
      req.query.id_tenant,
      req.usuario,
      ehVerdadeiro(req.query.incluir_inativos)
    )
    res.json({ status })
  } catch (err) {
    next(err)
  }
}

async function criarStatus(req, res, next) {
  try {
    const { id_tenant, rotulo, cor, categoria, ordem } = req.body
    const status = await tarefaConfigService.criarStatus(
      id_tenant,
      { rotulo, cor, categoria, ordem },
      req.usuario
    )
    res.status(201).json({ status })
  } catch (err) {
    next(err)
  }
}

async function atualizarStatus(req, res, next) {
  try {
    const { id_tenant, rotulo, cor, categoria, ordem } = req.body
    const status = await tarefaConfigService.atualizarStatus(
      id_tenant,
      req.params.chave,
      { rotulo, cor, categoria, ordem },
      req.usuario
    )
    res.json({ status })
  } catch (err) {
    next(err)
  }
}

async function alterarStatusDoStatus(req, res, next) {
  try {
    const { id_tenant, ativo } = req.body
    const status = await tarefaConfigService.alterarStatusDoStatus(
      id_tenant,
      req.params.chave,
      ativo,
      req.usuario
    )
    res.json({ status })
  } catch (err) {
    next(err)
  }
}

async function usoDoStatus(req, res, next) {
  try {
    res.json(
      await tarefaConfigService.usoDoStatus(req.query.id_tenant, req.params.chave, req.usuario)
    )
  } catch (err) {
    next(err)
  }
}

// --- Campos personalizaveis ---

async function listarCampos(req, res, next) {
  try {
    const campos = await tarefaConfigService.listarCampos(
      req.query.id_tenant,
      req.usuario,
      ehVerdadeiro(req.query.incluir_inativos)
    )
    res.json({ campos })
  } catch (err) {
    next(err)
  }
}

async function criarCampo(req, res, next) {
  try {
    const { id_tenant, rotulo, tipo, descricao, obrigatorio, ordem, config } = req.body
    const campo = await tarefaConfigService.criarCampo(
      id_tenant,
      { rotulo, tipo, descricao, obrigatorio, ordem, config },
      req.usuario
    )
    res.status(201).json({ campo })
  } catch (err) {
    next(err)
  }
}

async function atualizarCampo(req, res, next) {
  try {
    const { id_tenant, rotulo, descricao, obrigatorio, ordem, config } = req.body
    const campo = await tarefaConfigService.atualizarCampo(
      id_tenant,
      req.params.id,
      { rotulo, descricao, obrigatorio, ordem, config },
      req.usuario
    )
    res.json({ campo })
  } catch (err) {
    next(err)
  }
}

async function alterarStatusCampo(req, res, next) {
  try {
    const { id_tenant, ativo } = req.body
    const campo = await tarefaConfigService.alterarStatusCampo(
      id_tenant,
      req.params.id,
      ativo,
      req.usuario
    )
    res.json({ campo })
  } catch (err) {
    next(err)
  }
}

async function usoDoCampo(req, res, next) {
  try {
    res.json(await tarefaConfigService.usoDoCampo(req.query.id_tenant, req.params.id, req.usuario))
  } catch (err) {
    next(err)
  }
}

module.exports = {
  listarStatus,
  criarStatus,
  atualizarStatus,
  alterarStatusDoStatus,
  usoDoStatus,

  listarCampos,
  criarCampo,
  atualizarCampo,
  alterarStatusCampo,
  usoDoCampo,
}
