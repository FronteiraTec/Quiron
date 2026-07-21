/**
 * Middleware central de tratamento de erros.
 *
 * Captura os erros repassados via next(err). Erros de negocio carregam a
 * propriedade "status" (definida na camada de service); os demais viram 500.
 */
// O multer sinaliza seus limites por `code`, sem `status`. Sem esta traducao,
// mandar um arquivo grande demais devolveria 500 "Erro interno" — culpando o
// servidor por um erro que e do pedido, e sem dizer ao usuario o que houve.
const ERROS_MULTER = {
  LIMIT_FILE_SIZE: { status: 413, mensagem: "Arquivo maior que o limite permitido." },
  LIMIT_FILE_COUNT: { status: 400, mensagem: "Envie um arquivo por vez." },
  LIMIT_UNEXPECTED_FILE: { status: 400, mensagem: "Campo de arquivo inesperado. Use `arquivo`." },
}

function errorHandler(err, req, res, next) {
  const doMulter = ERROS_MULTER[err.code]
  if (doMulter) {
    return res.status(doMulter.status).json({ erro: doMulter.mensagem })
  }

  const status = err.status || 500

  // Loga apenas erros inesperados (500) para nao poluir o log.
  if (status === 500) {
    console.error("Erro inesperado:", err)
  }

  res.status(status).json({
    erro: status === 500 ? "Erro interno do servidor." : err.message,
  })
}

module.exports = { errorHandler }
