/**
 * Controller da gestao de tarefas (HTTP). Delega ao tarefaService.
 *
 * O id_tenant vem da query nas leituras e do corpo nas escritas, seguindo o
 * padrao das demais rotas. Quem autoriza e o service.
 */
const fs = require("fs")
const tarefaService = require("../services/tarefaService")

/** "true" na query string e string, nao booleano. */
const ehVerdadeiro = (valor) => valor === "true" || valor === true

/** Le os campos de uma tarefa do corpo (usado em criar/atualizar). */
function lerCampos(body) {
  return {
    titulo: body.titulo,
    descricao: body.descricao,
    status: body.status,
    prioridade: body.prioridade,
    // "" vira null para nao gravar string vazia como id.
    idResponsavel: body.id_responsavel || null,
    idStartup: body.id_startup || null,
    prazo: body.prazo || null,
    camposExtras: body.campos_extras,
    // `undefined` (chave ausente) significa "nao mexi nos anexos"; uma lista
    // vazia significa "removi todos". O service depende dessa distincao, entao
    // ela nao pode virar `|| []` aqui.
    anexos: body.anexos,
  }
}

async function listar(req, res, next) {
  try {
    const tarefas = await tarefaService.listar(
      req.query.id_tenant,
      {
        idResponsavel: req.query.id_responsavel,
        idStartup: req.query.id_startup,
        apenasAbertas: ehVerdadeiro(req.query.abertas),
      },
      req.usuario
    )
    res.json({ tarefas })
  } catch (err) {
    next(err)
  }
}

async function resumo(req, res, next) {
  try {
    res.json(await tarefaService.resumo(req.query.id_tenant, req.usuario))
  } catch (err) {
    next(err)
  }
}

async function equipe(req, res, next) {
  try {
    res.json({ pessoas: await tarefaService.listarEquipe(req.query.id_tenant, req.usuario) })
  } catch (err) {
    next(err)
  }
}

async function buscar(req, res, next) {
  try {
    const tarefa = await tarefaService.buscar(req.params.id, req.query.id_tenant, req.usuario)
    res.json({ tarefa })
  } catch (err) {
    next(err)
  }
}

async function criar(req, res, next) {
  try {
    const tarefa = await tarefaService.criar(req.body.id_tenant, lerCampos(req.body), req.usuario)
    res.status(201).json({ tarefa })
  } catch (err) {
    next(err)
  }
}

async function atualizar(req, res, next) {
  try {
    const tarefa = await tarefaService.atualizar(
      req.params.id,
      req.body.id_tenant,
      lerCampos(req.body),
      req.usuario
    )
    res.json({ tarefa })
  } catch (err) {
    next(err)
  }
}

async function mover(req, res, next) {
  try {
    const tarefa = await tarefaService.mover(
      req.params.id,
      req.body.id_tenant,
      { status: req.body.status, ordem: req.body.ordem },
      req.usuario
    )
    res.json({ tarefa })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /tarefas/:id/anexos/:idArquivo — serve um anexo.
 *
 * Rota do MODULO e nao de /arquivos: quem autoriza e a visibilidade da tarefa.
 * Ver tarefaService.abrirAnexo. O streaming e identico ao do arquivoController,
 * pelo mesmo motivo (um PDF de 15MB nao precisa passar inteiro pela memoria do
 * processo antes do primeiro byte chegar).
 */
async function baixarAnexo(req, res, next) {
  try {
    const { caminho, nomeOriginal, mime, tamanho, inline } = await tarefaService.abrirAnexo(
      req.params.id,
      req.params.idArquivo,
      req.query.id_tenant,
      req.usuario
    )

    res.setHeader("Content-Type", mime)
    res.setHeader("Content-Length", tamanho)
    // O navegador nao adivinha o tipo: sem isto, um arquivo de texto com HTML
    // dentro poderia ser interpretado como pagina.
    res.setHeader("X-Content-Type-Options", "nosniff")
    res.setHeader(
      "Content-Disposition",
      `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(nomeOriginal)}"`
    )

    const stream = fs.createReadStream(caminho)
    stream.on("error", next)
    stream.pipe(res)
  } catch (err) {
    next(err)
  }
}

async function excluir(req, res, next) {
  try {
    // DELETE nao tem corpo garantido em todo cliente: o tenant vem da query.
    res.json(await tarefaService.excluir(req.params.id, req.query.id_tenant, req.usuario))
  } catch (err) {
    next(err)
  }
}

module.exports = { listar, resumo, equipe, buscar, baixarAnexo, criar, atualizar, mover, excluir }
