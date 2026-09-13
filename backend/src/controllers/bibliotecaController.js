/**
 * Controller da Biblioteca (HTTP). Delega ao bibliotecaService.
 */
const bibliotecaService = require("../services/bibliotecaService")

/** GET /conteudos?id_tenant=&tipo=&tag=&termo= */
async function listar(req, res, next) {
  try {
    const { id_tenant, tipo, tag, termo } = req.query
    const { conteudos, contagem } = await bibliotecaService.listar(
      id_tenant,
      { tipo, tag, termo },
      req.usuario
    )
    res.json({ conteudos, contagem })
  } catch (err) {
    next(err)
  }
}

/** GET /conteudos/:id — inclui blocos (quando AULA) e os passos que o usam. */
async function buscar(req, res, next) {
  try {
    res.json({ conteudo: await bibliotecaService.buscar(req.params.id, req.usuario) })
  } catch (err) {
    next(err)
  }
}

/** POST /conteudos */
async function criar(req, res, next) {
  try {
    const dados = paraServico(req.body)
    // O autor sai do token, nao do corpo — senao daria para forjar a autoria.
    dados.criadoPor = req.usuario?.id ?? null
    res.status(201).json({ conteudo: await bibliotecaService.criar(dados, req.usuario) })
  } catch (err) {
    next(err)
  }
}

/** PATCH /conteudos/:id */
async function atualizar(req, res, next) {
  try {
    const conteudo = await bibliotecaService.atualizar(
      req.params.id,
      paraServico(req.body),
      req.usuario
    )
    res.json({ conteudo })
  } catch (err) {
    next(err)
  }
}

/** POST /conteudos/:id/duplicar */
async function duplicar(req, res, next) {
  try {
    res.status(201).json({ conteudo: await bibliotecaService.duplicar(req.params.id, req.usuario) })
  } catch (err) {
    next(err)
  }
}

/** DELETE /conteudos/:id — 409 se estiver em uso na trilha. */
async function excluir(req, res, next) {
  try {
    await bibliotecaService.excluir(req.params.id, req.usuario)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}

/** Traduz o corpo (snake_case) para o formato do service (camelCase). */
function paraServico(body = {}) {
  const mapa = {
    id_tenant: "idTenant",
    tipo: "tipo",
    titulo: "titulo",
    resumo: "resumo",
    tags: "tags",
    url: "url",
    nome_arquivo: "nomeArquivo",
    duracao: "duracao",
    logo_url: "logoUrl",
    blocos: "blocos",
    documento: "documento",
  }

  const saida = {}
  for (const [origem, destino] of Object.entries(mapa)) {
    if (body[origem] !== undefined) saida[destino] = body[origem]
  }
  return saida
}

module.exports = { listar, buscar, criar, atualizar, duplicar, excluir }
