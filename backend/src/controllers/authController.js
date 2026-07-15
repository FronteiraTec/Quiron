/**
 * Controller de autenticacao (camada de apresentacao / HTTP).
 *
 * Fino de proposito: apenas le a requisicao, chama o service e devolve a
 * resposta. Erros sao repassados ao middleware de erro via next(err).
 */
const authService = require("../services/authService")

/**
 * POST /auth/register
 */
async function register(req, res, next) {
  try {
    const usuario = await authService.registrar(req.body)
    return res.status(201).json({ mensagem: "Usuario criado com sucesso.", usuario })
  } catch (err) {
    return next(err)
  }
}

/**
 * POST /auth/login
 */
async function login(req, res, next) {
  try {
    const dados = await authService.login(req.body)
    return res.json({ mensagem: "Login realizado com sucesso.", ...dados })
  } catch (err) {
    return next(err)
  }
}

/**
 * POST /auth/logout (protegida)
 */
async function logout(req, res, next) {
  try {
    authService.logout(req.token)
    return res.json({ mensagem: "Logout realizado com sucesso." })
  } catch (err) {
    return next(err)
  }
}

/**
 * GET /auth/me (protegida)
 */
async function me(req, res, next) {
  try {
    const usuario = await authService.perfil(req.usuario.id)
    return res.json({ usuario })
  } catch (err) {
    return next(err)
  }
}

/**
 * PUT /auth/me (protegida)
 * Atualiza o perfil (nome/celular) do usuario logado.
 */
async function atualizarPerfil(req, res, next) {
  try {
    const { nome, celular } = req.body
    const usuario = await authService.atualizarPerfil(req.usuario.id, { nome, celular })
    return res.json({ mensagem: "Perfil atualizado com sucesso.", usuario })
  } catch (err) {
    return next(err)
  }
}

/**
 * PUT /auth/me/foto (protegida)
 * Atualiza a foto/avatar do usuario logado.
 */
async function atualizarFoto(req, res, next) {
  try {
    const usuario = await authService.atualizarFoto(req.usuario.id, req.body.foto_url)
    return res.json({ mensagem: "Foto atualizada com sucesso.", usuario })
  } catch (err) {
    return next(err)
  }
}

/**
 * POST /auth/definir-senha (protegida)
 * Define a nova senha no primeiro acesso (troca de senha provisoria).
 */
async function definirPrimeiraSenha(req, res, next) {
  try {
    await authService.definirPrimeiraSenha(req.usuario.id, req.body.senha)
    return res.json({ mensagem: "Senha definida com sucesso." })
  } catch (err) {
    return next(err)
  }
}

/**
 * POST /auth/forgot-password
 * Dispara o email de redefinicao. Resposta sempre generica (nao revela
 * se o email existe).
 */
async function forgotPassword(req, res, next) {
  try {
    await authService.solicitarResetSenha(req.body.email)
    return res.json({
      mensagem: "Se o email estiver cadastrado, enviaremos um link de redefinicao.",
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * POST /auth/reset-password
 * Efetiva a troca de senha usando o token recebido por email.
 */
async function resetPassword(req, res, next) {
  try {
    const { token, senha } = req.body
    await authService.redefinirSenha(token, senha)
    return res.json({ mensagem: "Senha redefinida com sucesso." })
  } catch (err) {
    return next(err)
  }
}

module.exports = {
  register,
  login,
  logout,
  me,
  atualizarPerfil,
  atualizarFoto,
  definirPrimeiraSenha,
  forgotPassword,
  resetPassword,
}
