/**
 * Controller da configuracao do engajamento (HTTP): temporadas, acoes e
 * niveis. Delega ao engajamentoConfigService.
 */
const engajamentoConfigService = require("../services/engajamentoConfigService")

/** "true" na query string e string, nao booleano. */
const ehVerdadeiro = (valor) => valor === "true" || valor === true

// --- Temporadas ---

async function listarTemporadas(req, res, next) {
  try {
    const temporadas = await engajamentoConfigService.listarTemporadas(
      req.query.id_tenant,
      req.usuario
    )
    res.json({ temporadas })
  } catch (err) {
    next(err)
  }
}

async function criarTemporada(req, res, next) {
  try {
    const { id_tenant, nome, inicio_dt, fim_dt, premiacao } = req.body
    const temporada = await engajamentoConfigService.criarTemporada(
      id_tenant,
      { nome, inicio_dt, fim_dt, premiacao },
      req.usuario
    )
    res.status(201).json({ temporada })
  } catch (err) {
    next(err)
  }
}

async function atualizarTemporada(req, res, next) {
  try {
    const { id_tenant, nome, inicio_dt, fim_dt, premiacao } = req.body
    const temporada = await engajamentoConfigService.atualizarTemporada(
      id_tenant,
      req.params.id,
      { nome, inicio_dt, fim_dt, premiacao },
      req.usuario
    )
    res.json({ temporada })
  } catch (err) {
    next(err)
  }
}

async function alterarEncerradaTemporada(req, res, next) {
  try {
    const { id_tenant, encerrada } = req.body
    const temporada = await engajamentoConfigService.alterarEncerradaTemporada(
      id_tenant,
      req.params.id,
      encerrada,
      req.usuario
    )
    res.json({ temporada })
  } catch (err) {
    next(err)
  }
}

async function usoDaTemporada(req, res, next) {
  try {
    res.json(
      await engajamentoConfigService.usoDaTemporada(
        req.query.id_tenant,
        req.params.id,
        req.usuario
      )
    )
  } catch (err) {
    next(err)
  }
}

async function excluirTemporada(req, res, next) {
  try {
    res.json(
      await engajamentoConfigService.excluirTemporada(
        req.query.id_tenant,
        req.params.id,
        req.usuario
      )
    )
  } catch (err) {
    next(err)
  }
}

// --- Acoes ---

async function listarAcoes(req, res, next) {
  try {
    const acoes = await engajamentoConfigService.listarAcoes(
      req.query.id_tenant,
      req.usuario,
      ehVerdadeiro(req.query.incluir_inativas)
    )
    res.json({ acoes })
  } catch (err) {
    next(err)
  }
}

async function criarAcao(req, res, next) {
  try {
    const acao = await engajamentoConfigService.criarAcao(req.body.id_tenant, req.body, req.usuario)
    res.status(201).json({ acao })
  } catch (err) {
    next(err)
  }
}

async function atualizarAcao(req, res, next) {
  try {
    const acao = await engajamentoConfigService.atualizarAcao(
      req.body.id_tenant,
      req.params.chave,
      req.body,
      req.usuario
    )
    res.json({ acao })
  } catch (err) {
    next(err)
  }
}

async function alterarAtivoAcao(req, res, next) {
  try {
    const { id_tenant, ativo } = req.body
    const acao = await engajamentoConfigService.alterarAtivoAcao(
      id_tenant,
      req.params.chave,
      ativo,
      req.usuario
    )
    res.json({ acao })
  } catch (err) {
    next(err)
  }
}

async function usoDaAcao(req, res, next) {
  try {
    res.json(
      await engajamentoConfigService.usoDaAcao(req.query.id_tenant, req.params.chave, req.usuario)
    )
  } catch (err) {
    next(err)
  }
}

// --- Niveis ---

async function listarNiveis(req, res, next) {
  try {
    const niveis = await engajamentoConfigService.listarNiveis(
      req.query.id_tenant,
      req.usuario,
      req.query.liga || null
    )
    res.json({ niveis })
  } catch (err) {
    next(err)
  }
}

async function definirNiveis(req, res, next) {
  try {
    const { id_tenant, niveis } = req.body
    const salvos = await engajamentoConfigService.definirNiveis(
      id_tenant,
      req.params.liga,
      niveis,
      req.usuario
    )
    res.json({ niveis: salvos })
  } catch (err) {
    next(err)
  }
}

// --- LinkedIn da incubadora (usado pela credencial de selo) ---

async function definirLinkedin(req, res, next) {
  try {
    const { id_tenant, linkedin_org_id } = req.body
    const tenant = await engajamentoConfigService.definirLinkedin(
      id_tenant,
      linkedin_org_id,
      req.usuario
    )
    res.json({ tenant })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  definirLinkedin,

  listarTemporadas,
  criarTemporada,
  atualizarTemporada,
  alterarEncerradaTemporada,
  usoDaTemporada,
  excluirTemporada,

  listarAcoes,
  criarAcao,
  atualizarAcao,
  alterarAtivoAcao,
  usoDaAcao,

  listarNiveis,
  definirNiveis,
}
