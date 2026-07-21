/**
 * Controller de Arquivos (HTTP). Delega ao arquivoService.
 */
const fs = require("fs")
const arquivoService = require("../services/arquivoService")

/**
 * POST /arquivos — multipart/form-data, campo `arquivo`.
 * Body: id_tenant, visibilidade (PUBLICO|PRIVADO).
 *
 * Devolve tambem a `url` ja montada: quem chama nao precisa saber como se monta
 * o caminho de download, e mudar esse formato depois nao quebra o front.
 */
async function enviar(req, res, next) {
  try {
    const { id_tenant, visibilidade } = req.body
    const arquivo = await arquivoService.salvar(
      req.file,
      { idTenant: id_tenant, visibilidade: visibilidade || "PRIVADO" },
      req.usuario
    )
    res.status(201).json({
      arquivo: { ...arquivo, url: `/api/arquivos/${arquivo.id_arquivo}` },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /arquivos/:id — serve o conteudo.
 *
 * Rota SEM `autenticar` obrigatorio: arquivo PUBLICO precisa sair para uma tag
 * <img>, que nao manda cabecalho Authorization. Quem decide se o token era
 * necessario e o service, olhando a visibilidade — `req.usuario` chega
 * preenchido quando o token veio, e nulo quando nao.
 */
async function baixar(req, res, next) {
  try {
    const { caminho, nomeOriginal, mime, tamanho, inline } = await arquivoService.abrir(
      req.params.id,
      req.usuario || null
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
    // Stream em vez de readFile: um PDF de 15MB nao precisa passar inteiro pela
    // memoria do processo antes do primeiro byte chegar ao cliente.
    stream.on("error", next)
    stream.pipe(res)
  } catch (err) {
    next(err)
  }
}

module.exports = { enviar, baixar }
