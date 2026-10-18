/**
 * Controller da Trilha (HTTP). Delega ao trilhaService.
 *
 * Substitui faseController + moduloController + tarefaController.
 * A API fala snake_case (id_pai, tipo_passo); o service fala camelCase — a
 * traducao acontece aqui, como nos demais controllers do projeto.
 */
const trilhaService = require("../services/trilhaService")

/** GET /trilha?id_tenant= — arvore completa, ja aninhada. */
async function arvore(req, res, next) {
  try {
    res.json({ trilha: await trilhaService.arvore(req.query.id_tenant, req.usuario) })
  } catch (err) {
    next(err)
  }
}

/** GET /trilha/:id */
async function buscar(req, res, next) {
  try {
    res.json({ no: await trilhaService.buscar(req.params.id, req.usuario) })
  } catch (err) {
    next(err)
  }
}

/** GET /trilha/:id/filhos */
async function listarFilhos(req, res, next) {
  try {
    res.json({ filhos: await trilhaService.listarFilhos(req.params.id, req.usuario) })
  } catch (err) {
    next(err)
  }
}

/** POST /trilha — o tipo do no e deduzido do pai. */
async function criar(req, res, next) {
  try {
    const no = await trilhaService.criar(paraServico(req.body), req.usuario)
    res.status(201).json({ no })
  } catch (err) {
    next(err)
  }
}

/** PATCH /trilha/:id */
async function atualizar(req, res, next) {
  try {
    const no = await trilhaService.atualizar(req.params.id, paraServico(req.body), req.usuario)
    res.json({ no })
  } catch (err) {
    next(err)
  }
}

/** DELETE /trilha/:id — leva a subarvore junto. */
async function excluir(req, res, next) {
  try {
    await trilhaService.excluir(req.params.id, req.usuario)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}

/** PATCH /trilha/:id/filhos/ordem — body: { ids: [...] } */
async function reordenarFilhos(req, res, next) {
  try {
    const filhos = await trilhaService.reordenarFilhos(req.params.id, req.body.ids, req.usuario)
    res.json({ filhos })
  } catch (err) {
    next(err)
  }
}

/** PATCH /trilha/:id/mover — body: { id_pai } */
async function mover(req, res, next) {
  try {
    const no = await trilhaService.mover(req.params.id, req.body.id_pai, req.usuario)
    res.json({ no })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /trilha/:id/duplicar — body opcional: { nome }
 * Copia o no e toda a subarvore dentro dele. Na raiz, e "duplicar trilha".
 */
async function duplicar(req, res, next) {
  try {
    const no = await trilhaService.duplicar(req.params.id, req.usuario, req.body?.nome)
    res.status(201).json({ no })
  } catch (err) {
    next(err)
  }
}

/** GET /trilha/:id/conteudos */
async function listarConteudos(req, res, next) {
  try {
    res.json({ conteudos: await trilhaService.listarConteudos(req.params.id, req.usuario) })
  } catch (err) {
    next(err)
  }
}

/** POST /trilha/:id/conteudos — body: { id_conteudo } */
async function vincularConteudo(req, res, next) {
  try {
    const vinculo = await trilhaService.vincularConteudo(
      req.params.id,
      req.body.id_conteudo,
      req.usuario
    )
    res.status(201).json({ vinculo })
  } catch (err) {
    next(err)
  }
}

/** DELETE /trilha/:id/conteudos/:idConteudo */
async function desvincularConteudo(req, res, next) {
  try {
    await trilhaService.desvincularConteudo(req.params.id, req.params.idConteudo, req.usuario)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}

/**
 * Traduz o corpo da requisicao (snake_case) para o formato do service
 * (camelCase). Chaves ausentes continuam ausentes — o que importa para o
 * PATCH parcial, onde `undefined` significa "nao mexer" e `null` significa
 * "limpar o campo".
 */
function paraServico(body = {}) {
  const mapa = {
    id_tenant: "idTenant",
    id_pai: "idPai",
    nome: "nome",
    descricao: "descricao",
    ativo: "ativo",
    tipo_passo: "tipoPasso",
    permite_entrega: "permiteEntrega",
    obrigatoria: "obrigatoria",
    id_questionario: "idQuestionario",
    anexo: "anexo",
    prazo: "prazo",
    carga_horaria: "cargaHoraria",
    entregavel: "entregavel",
    objetivo: "objetivo",
    porque: "porque",
    competencias: "competencias",
    area: "area",
  }

  const saida = {}
  for (const [origem, destino] of Object.entries(mapa)) {
    if (body[origem] !== undefined) saida[destino] = body[origem]
  }
  return saida
}

/** GET /trilha/programas?id_tenant= — as trilhas do tenant, com contagens. */
async function listarProgramas(req, res, next) {
  try {
    const programas = await trilhaService.listarProgramas(req.query.id_tenant, req.usuario)
    res.json({ programas })
  } catch (err) {
    next(err)
  }
}

/** GET /trilha/programas/:id — uma trilha inteira, ja aninhada. */
async function arvoreDoPrograma(req, res, next) {
  try {
    res.json({ trilha: await trilhaService.arvoreDoPrograma(req.params.id, req.usuario) })
  } catch (err) {
    next(err)
  }
}

/** PATCH /trilha/:id/padrao — marca como a trilha sugerida no cadastro. */
async function definirPadrao(req, res, next) {
  try {
    res.json({ no: await trilhaService.definirPadrao(req.params.id, req.usuario) })
  } catch (err) {
    next(err)
  }
}

/** GET /trilha/:id/startups */
async function listarStartupsDoPrograma(req, res, next) {
  try {
    const startups = await trilhaService.listarStartupsDoPrograma(req.params.id, req.usuario)
    res.json({ startups })
  } catch (err) {
    next(err)
  }
}

/** POST /trilha/:id/startups — body: { id_startup } */
async function matricular(req, res, next) {
  try {
    const matricula = await trilhaService.matricular(
      req.params.id,
      req.body.id_startup,
      req.usuario
    )
    res.status(201).json({ matricula })
  } catch (err) {
    next(err)
  }
}

/** DELETE /trilha/:id/startups/:idStartup */
async function desmatricular(req, res, next) {
  try {
    await trilhaService.desmatricular(req.params.id, req.params.idStartup, req.usuario)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}

/** PATCH /trilha/:id/startups/:idStartup — body: { status } */
async function definirStatusMatricula(req, res, next) {
  try {
    const matricula = await trilhaService.definirStatusMatricula(
      req.params.id,
      req.params.idStartup,
      req.body.status,
      req.usuario
    )
    res.json({ matricula })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  arvore,
  buscar,
  listarFilhos,
  criar,
  atualizar,
  excluir,
  reordenarFilhos,
  mover,
  duplicar,
  listarConteudos,
  vincularConteudo,
  desvincularConteudo,
  listarProgramas,
  arvoreDoPrograma,
  definirPadrao,
  listarStartupsDoPrograma,
  matricular,
  desmatricular,
  definirStatusMatricula,
}
