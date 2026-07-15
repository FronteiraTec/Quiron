/**
 * Rotas de autenticacao.
 *
 * Rotas publicas:  /register, /login, /forgot-password, /reset-password
 * Rotas protegidas (exigem Bearer Token):  /logout e /me
 */
const express = require("express")
const router = express.Router()

const {
  register,
  login,
  logout,
  me,
  atualizarPerfil,
  atualizarFoto,
  definirPrimeiraSenha,
  forgotPassword,
  resetPassword,
} = require("../controllers/authController")
const { autenticar } = require("../middlewares/auth")

// --- Rotas publicas ---
router.post("/register", register)
router.post("/login", login)
router.post("/forgot-password", forgotPassword)
router.post("/reset-password", resetPassword)

// --- Rotas protegidas (o middleware "autenticar" valida o Bearer Token) ---
router.post("/logout", autenticar, logout)
router.get("/me", autenticar, me)
router.put("/me", autenticar, atualizarPerfil)
router.put("/me/foto", autenticar, atualizarFoto)
router.post("/definir-senha", autenticar, definirPrimeiraSenha)

module.exports = router
