/**
 * Controller do Espaco do Mentor (HTTP). Delega ao mentorMaterialService (a
 * biblioteca pessoal) e ao mentorCompartilhamentoService (incubados,
 * compartilhamentos e o que a startup recebeu).
 *
 * Os handlers de "materiais recebidos" moram aqui, e nao no jornadaController,
 * porque o dado e deste modulo; a ROTA e que fica em /jornada, onde a startup
 * le a propria trilha (ver jornadaRoutes).
 */
const fs = require("fs")
const mentorMaterialService = require("../services/mentorMaterialService")
const mentorPastaService = require("../services/mentorPastaService")
const mentorCompartilhamentoService = require("../services/mentorCompartilhamentoService")
const materialIncubadoraService = require("../services/materialIncubadoraService")

/**
 * Serve os bytes de um arquivo ja autorizado pelo service. O streaming e o
 * mesmo do arquivoController e do anexo de tarefa, pelo mesmo motivo: um PDF de
 * 15MB nao precisa passar inteiro pela memoria antes do primeiro byte sair.
 */
function servir(res, next, { caminho, nomeOriginal, mime, tamanho, inline }) {
  res.setHeader("Content-Type", mime)
  res.setHeader("Content-Length", tamanho)
  // O navegador nao adivinha o tipo: um texto com HTML dentro nao vira pagina.
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.setHeader(
    "Content-Disposition",
    `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(nomeOriginal)}"`
  )
  const stream = fs.createReadStream(caminho)
  stream.on("error", next)
  stream.pipe(res)
}

// ---------------------------------------------------------------------------
// MINHA BIBLIOTECA
// ---------------------------------------------------------------------------

/** GET /espaco-mentor/materiais?id_tenant= */
async function listarMateriais(req, res, next) {
  try {
    res.json(await mentorMaterialService.listar(req.query.id_tenant, req.usuario))
  } catch (err) {
    next(err)
  }
}

/** POST /espaco-mentor/materiais — body: id_tenant, titulo, descricao, categoria, tipo, id_arquivo | url */
async function criarMaterial(req, res, next) {
  try {
    const material = await mentorMaterialService.criar(req.body.id_tenant, req.body, req.usuario)
    res.status(201).json({ material })
  } catch (err) {
    next(err)
  }
}

/** GET /espaco-mentor/materiais/:id — o material e os lugares para onde ele foi. */
async function buscarMaterial(req, res, next) {
  try {
    res.json({ material: await mentorMaterialService.buscar(req.params.id, req.usuario) })
  } catch (err) {
    next(err)
  }
}

/** PATCH /espaco-mentor/materiais/:id — inclui `arquivado: true|false`. */
async function atualizarMaterial(req, res, next) {
  try {
    const material = await mentorMaterialService.atualizar(req.params.id, req.body, req.usuario)
    res.json({ material })
  } catch (err) {
    next(err)
  }
}

/** DELETE /espaco-mentor/materiais/:id — 409 se estiver compartilhado. */
async function excluirMaterial(req, res, next) {
  try {
    res.json(await mentorMaterialService.excluir(req.params.id, req.usuario))
  } catch (err) {
    next(err)
  }
}

/** GET /espaco-mentor/materiais/:id/arquivo — so o dono. */
async function baixarMaterial(req, res, next) {
  try {
    servir(res, next, await mentorMaterialService.abrirArquivo(req.params.id, req.usuario))
  } catch (err) {
    next(err)
  }
}

// ---------------------------------------------------------------------------
// PASTAS DA MINHA BIBLIOTECA (migracao 025)
// ---------------------------------------------------------------------------

/** POST /espaco-mentor/pastas — body: id_tenant, nome, id_pasta_pai */
async function criarPasta(req, res, next) {
  try {
    const pasta = await mentorPastaService.criar(req.body.id_tenant, req.body, req.usuario)
    res.status(201).json({ pasta })
  } catch (err) {
    next(err)
  }
}

/** PATCH /espaco-mentor/pastas/:id — body: nome */
async function renomearPasta(req, res, next) {
  try {
    res.json({ pasta: await mentorPastaService.renomear(req.params.id, req.body, req.usuario) })
  } catch (err) {
    next(err)
  }
}

/** DELETE /espaco-mentor/pastas/:id — o conteudo vai para a pasta de cima. */
async function excluirPasta(req, res, next) {
  try {
    res.json(await mentorPastaService.excluir(req.params.id, req.usuario))
  } catch (err) {
    next(err)
  }
}

/** POST /espaco-mentor/mover — body: id_tenant, destino, pastas[], materiais[] */
async function moverItens(req, res, next) {
  try {
    res.json(await mentorPastaService.mover(req.body.id_tenant, req.body, req.usuario))
  } catch (err) {
    next(err)
  }
}

// ---------------------------------------------------------------------------
// MATERIAIS DA INCUBADORA PARA OS MENTORES (migracao 021)
// ---------------------------------------------------------------------------

/** GET /espaco-mentor/incubadora?id_tenant= */
async function listarMateriaisIncubadora(req, res, next) {
  try {
    res.json(await materialIncubadoraService.listar(req.query.id_tenant, req.usuario))
  } catch (err) {
    next(err)
  }
}

/** POST /espaco-mentor/incubadora — body: id_tenant, titulo, descricao, categoria, tipo, id_arquivo | url */
async function criarMaterialIncubadora(req, res, next) {
  try {
    const material = await materialIncubadoraService.criar(req.body.id_tenant, req.body, req.usuario)
    res.status(201).json({ material })
  } catch (err) {
    next(err)
  }
}

/** GET /espaco-mentor/incubadora/:id */
async function buscarMaterialIncubadora(req, res, next) {
  try {
    res.json({ material: await materialIncubadoraService.buscar(req.params.id, req.usuario) })
  } catch (err) {
    next(err)
  }
}

/** PATCH /espaco-mentor/incubadora/:id — inclui `arquivado: true|false`. */
async function atualizarMaterialIncubadora(req, res, next) {
  try {
    const material = await materialIncubadoraService.atualizar(req.params.id, req.body, req.usuario)
    res.json({ material })
  } catch (err) {
    next(err)
  }
}

/** DELETE /espaco-mentor/incubadora/:id */
async function excluirMaterialIncubadora(req, res, next) {
  try {
    res.json(await materialIncubadoraService.excluir(req.params.id, req.usuario))
  } catch (err) {
    next(err)
  }
}

/** GET /espaco-mentor/incubadora/:id/arquivo — quem tem a chave de ver. */
async function baixarMaterialIncubadora(req, res, next) {
  try {
    servir(res, next, await materialIncubadoraService.abrirArquivo(req.params.id, req.usuario))
  } catch (err) {
    next(err)
  }
}

// ---------------------------------------------------------------------------
// MEUS INCUBADOS
// ---------------------------------------------------------------------------

/** GET /espaco-mentor/incubados?id_tenant= */
async function listarIncubados(req, res, next) {
  try {
    const startups = await mentorCompartilhamentoService.listarIncubados(
      req.query.id_tenant,
      req.usuario
    )
    res.json({ startups })
  } catch (err) {
    next(err)
  }
}

/** GET /espaco-mentor/incubados/:idStartup/trilhas/:idPrograma */
async function carregarTrilhaDoIncubado(req, res, next) {
  try {
    res.json(
      await mentorCompartilhamentoService.carregarTrilhaDoIncubado(
        req.params.idStartup,
        req.params.idPrograma,
        req.usuario
      )
    )
  } catch (err) {
    next(err)
  }
}

// ---------------------------------------------------------------------------
// COMPARTILHAMENTOS
// ---------------------------------------------------------------------------

/** GET /espaco-mentor/compartilhamentos?id_tenant=&id_startup= */
async function listarCompartilhamentos(req, res, next) {
  try {
    const compartilhamentos = await mentorCompartilhamentoService.listar(
      req.query.id_tenant,
      { idStartup: req.query.id_startup },
      req.usuario
    )
    res.json({ compartilhamentos })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /espaco-mentor/compartilhamentos
 * body: id_startup, id_programa, id_no?, id_material | id_conteudo, finalidade?, orientacao?
 *
 * O autor sai do token, nunca do corpo — senao daria para compartilhar em nome
 * de outro mentor.
 */
async function compartilhar(req, res, next) {
  try {
    const compartilhamento = await mentorCompartilhamentoService.compartilhar(req.body, req.usuario)
    res.status(201).json({ compartilhamento })
  } catch (err) {
    next(err)
  }
}

/** PATCH /espaco-mentor/compartilhamentos/:id — body: orientacao?, finalidade? */
async function atualizarCompartilhamento(req, res, next) {
  try {
    const compartilhamento = await mentorCompartilhamentoService.atualizar(
      req.params.id,
      req.body,
      req.usuario
    )
    res.json({ compartilhamento })
  } catch (err) {
    next(err)
  }
}

/** DELETE /espaco-mentor/compartilhamentos/:id */
async function removerCompartilhamento(req, res, next) {
  try {
    res.json(await mentorCompartilhamentoService.remover(req.params.id, req.usuario))
  } catch (err) {
    next(err)
  }
}

// ---------------------------------------------------------------------------
// MATERIAIS RECEBIDOS (rotas em /jornada)
// ---------------------------------------------------------------------------

/** GET /jornada/materiais?id_startup=&id_trilha= */
async function listarRecebidos(req, res, next) {
  try {
    const materiais = await mentorCompartilhamentoService.listarRecebidos(
      req.query.id_startup,
      req.query.id_trilha,
      req.usuario
    )
    res.json({ materiais })
  } catch (err) {
    next(err)
  }
}

/** GET /jornada/materiais/:id — com o corpo, quando e uma AULA da Biblioteca. */
async function buscarRecebido(req, res, next) {
  try {
    res.json({ material: await mentorCompartilhamentoService.buscarRecebido(req.params.id, req.usuario) })
  } catch (err) {
    next(err)
  }
}

/** GET /jornada/materiais/:id/arquivo — autorizado pelo vinculo com a startup. */
async function baixarRecebido(req, res, next) {
  try {
    servir(res, next, await mentorCompartilhamentoService.abrirArquivoRecebido(req.params.id, req.usuario))
  } catch (err) {
    next(err)
  }
}

module.exports = {
  listarMateriais,
  criarMaterial,
  buscarMaterial,
  atualizarMaterial,
  excluirMaterial,
  baixarMaterial,
  criarPasta,
  renomearPasta,
  excluirPasta,
  moverItens,
  listarMateriaisIncubadora,
  criarMaterialIncubadora,
  buscarMaterialIncubadora,
  atualizarMaterialIncubadora,
  excluirMaterialIncubadora,
  baixarMaterialIncubadora,
  listarIncubados,
  carregarTrilhaDoIncubado,
  listarCompartilhamentos,
  compartilhar,
  atualizarCompartilhamento,
  removerCompartilhamento,
  listarRecebidos,
  buscarRecebido,
  baixarRecebido,
}
