/**
 * Middleware de autenticacao.
 *
 * Protege rotas exigindo um Bearer Token valido no cabecalho:
 *   Authorization: Bearer <token>
 *
 * Se o token for valido, os dados do usuario ficam disponiveis em req.usuario
 * para os proximos handlers da rota.
 */
const { verificarToken } = require("../utils/jwt")

/**
 * Valida o Bearer Token da requisicao.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function autenticar(req, res, next) {
  const header = req.headers.authorization || ""

  // Espera o formato "Bearer <token>".
  const [tipo, token] = header.split(" ")

  if (tipo !== "Bearer" || !token) {
    return res.status(401).json({ erro: "Token nao fornecido." })
  }

  try {
    // Decodifica e valida (assinatura, expiracao e blacklist).
    const payload = verificarToken(token)

    // Disponibiliza os dados do usuario e o token bruto para os handlers.
    req.usuario = payload
    req.token = token

    return next()
  } catch (err) {
    return res.status(401).json({ erro: "Token invalido ou expirado." })
  }
}

/**
 * Restringe a rota ao usuario ROOT (super-admin da plataforma).
 *
 * Deve ser usado SEMPRE apos "autenticar", pois depende de req.usuario (o
 * payload do token carrega a flag `root`).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function somenteRoot(req, res, next) {
  if (!req.usuario?.root) {
    return res.status(403).json({ erro: "Acesso restrito ao usuario root." })
  }
  return next()
}

module.exports = { autenticar, somenteRoot }
