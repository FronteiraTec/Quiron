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

/**
 * Traduz o corpo (snake_case, como o resto da API) para o objeto que o service
 * espera. Uma funcao so para criar e atualizar: os dois recebem exatamente o
 * mesmo cadastro, e duas copias garantiriam que um campo novo entrasse em um e
 * faltasse no outro.
 */
function cadastroDoCorpo(corpo) {
  return {
    nome: corpo.nome,
    cnpj: corpo.cnpj,
    inscricaoEstadual: corpo.inscricao_estadual,
    email: corpo.email,
    tipo: corpo.tipo,
    situacao: corpo.situacao,
    observacoes: corpo.observacoes,
    cep: corpo.cep,
    uf: corpo.uf,
    cidade: corpo.cidade,
    bairro: corpo.bairro,
    rua: corpo.rua,
    numero: corpo.numero,
    complemento: corpo.complemento,
    camposExtras: corpo.campos_extras,
    contatos: corpo.contatos,
  }
}

async function criar(req, res, next) {
  try {
    const startup = await startupService.criar(
      { ...cadastroDoCorpo(req.body), idTenant: req.body.id_tenant, idTrilha: req.body.id_trilha },
      req.usuario
    )
    res.status(201).json({ startup })
  } catch (err) {
    next(err)
  }
}

async function atualizar(req, res, next) {
  try {
    const startup = await startupService.atualizar(req.params.id, cadastroDoCorpo(req.body), req.usuario)
    res.json({ startup })
  } catch (err) {
    next(err)
  }
}

/**
 * Troca a situacao (o "status" configuravel da incubadora). O estado de ciclo
 * — o que diz se a startup ainda esta no programa — e derivado dela no
 * repositorio, nunca recebido aqui.
 */
async function atualizarSituacao(req, res, next) {
  try {
    const startup = await startupService.atualizarSituacao(
      req.params.id,
      req.body.situacao,
      req.usuario
    )
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
  atualizarSituacao,
  adicionarMembro,
  listarMembros,
  listarMembrosDoTenant,
  removerMembro,
  buscarMinha,
  listarFasesConcluidas,
}
