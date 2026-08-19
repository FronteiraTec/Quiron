/**
 * Controller da configuracao do cadastro de startup (HTTP). Delega ao
 * startupConfigService.
 *
 * O id_tenant vem da query nas leituras e do corpo nas escritas, seguindo o
 * padrao das demais rotas de configuracao. Quem autoriza e o service.
 */
const startupConfigService = require("../services/startupConfigService")

/** "true" na query string e string, nao booleano. */
const ehVerdadeiro = (valor) => valor === "true" || valor === true

// --- Tipos ---

async function listarTipos(req, res, next) {
  try {
    const tipos = await startupConfigService.listarTipos(
      req.query.id_tenant,
      req.usuario,
      ehVerdadeiro(req.query.incluir_inativos)
    )
    res.json({ tipos })
  } catch (err) {
    next(err)
  }
}

async function criarTipo(req, res, next) {
  try {
    const { id_tenant, rotulo, cor, ordem } = req.body
    const tipo = await startupConfigService.criarTipo(id_tenant, { rotulo, cor, ordem }, req.usuario)
    res.status(201).json({ tipo })
  } catch (err) {
    next(err)
  }
}

async function atualizarTipo(req, res, next) {
  try {
    const { id_tenant, rotulo, cor, ordem } = req.body
    const tipo = await startupConfigService.atualizarTipo(
      id_tenant,
      req.params.chave,
      { rotulo, cor, ordem },
      req.usuario
    )
    res.json({ tipo })
  } catch (err) {
    next(err)
  }
}

async function alterarStatusTipo(req, res, next) {
  try {
    const { id_tenant, ativo } = req.body
    const tipo = await startupConfigService.alterarStatusTipo(
      id_tenant,
      req.params.chave,
      ativo,
      req.usuario
    )
    res.json({ tipo })
  } catch (err) {
    next(err)
  }
}

async function usoDoTipo(req, res, next) {
  try {
    res.json(await startupConfigService.usoDoTipo(req.query.id_tenant, req.params.chave, req.usuario))
  } catch (err) {
    next(err)
  }
}

// --- Situacoes ---

async function listarSituacoes(req, res, next) {
  try {
    const situacoes = await startupConfigService.listarSituacoes(
      req.query.id_tenant,
      req.usuario,
      ehVerdadeiro(req.query.incluir_inativas)
    )
    res.json({ situacoes })
  } catch (err) {
    next(err)
  }
}

async function criarSituacao(req, res, next) {
  try {
    const { id_tenant, rotulo, cor, ciclo, ordem } = req.body
    const situacao = await startupConfigService.criarSituacao(
      id_tenant,
      { rotulo, cor, ciclo, ordem },
      req.usuario
    )
    res.status(201).json({ situacao })
  } catch (err) {
    next(err)
  }
}

async function atualizarSituacao(req, res, next) {
  try {
    const { id_tenant, rotulo, cor, ciclo, ordem } = req.body
    const situacao = await startupConfigService.atualizarSituacao(
      id_tenant,
      req.params.chave,
      { rotulo, cor, ciclo, ordem },
      req.usuario
    )
    res.json({ situacao })
  } catch (err) {
    next(err)
  }
}

async function alterarStatusSituacao(req, res, next) {
  try {
    const { id_tenant, ativo } = req.body
    const situacao = await startupConfigService.alterarStatusSituacao(
      id_tenant,
      req.params.chave,
      ativo,
      req.usuario
    )
    res.json({ situacao })
  } catch (err) {
    next(err)
  }
}

async function usoDaSituacao(req, res, next) {
  try {
    res.json(
      await startupConfigService.usoDaSituacao(req.query.id_tenant, req.params.chave, req.usuario)
    )
  } catch (err) {
    next(err)
  }
}

// --- Campos personalizaveis ---

async function listarCampos(req, res, next) {
  try {
    const campos = await startupConfigService.listarCampos(
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
    const campo = await startupConfigService.criarCampo(
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
    const campo = await startupConfigService.atualizarCampo(
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
    const campo = await startupConfigService.alterarStatusCampo(
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
    res.json(await startupConfigService.usoDoCampo(req.query.id_tenant, req.params.id, req.usuario))
  } catch (err) {
    next(err)
  }
}

module.exports = {
  listarTipos,
  criarTipo,
  atualizarTipo,
  alterarStatusTipo,
  usoDoTipo,

  listarSituacoes,
  criarSituacao,
  atualizarSituacao,
  alterarStatusSituacao,
  usoDaSituacao,

  listarCampos,
  criarCampo,
  atualizarCampo,
  alterarStatusCampo,
  usoDoCampo,
}
