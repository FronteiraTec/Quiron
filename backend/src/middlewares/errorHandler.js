/**
 * Middleware central de tratamento de erros.
 *
 * Captura os erros repassados via next(err). Erros de negocio carregam a
 * propriedade "status" (definida na camada de service); os demais viram 500.
 */
function errorHandler(err, req, res, next) {
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
