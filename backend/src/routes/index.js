/**
 * Agregador de rotas.
 *
 * Centraliza o registro de todos os modulos de rota da API.
 * Auth e publico (login/register); os demais modulos exigem Bearer Token
 * (o middleware "autenticar" e aplicado dentro de cada arquivo de rota).
 */
const express = require("express")
const router = express.Router()

// Autenticacao (rotas publicas + protegidas).
router.use("/auth", require("./authRoutes"))

// Preferencias visuais do usuario logado (protegido).
router.use("/preferencias", require("./preferenciaRoutes"))

// Modulos de dominio (todos protegidos por Bearer Token).
router.use("/tenants", require("./tenantRoutes"))
router.use("/startups", require("./startupRoutes"))
router.use("/fases", require("./faseRoutes"))
router.use("/modulos", require("./moduloRoutes"))
router.use("/tarefas", require("./tarefaRoutes"))
router.use("/questionarios", require("./questionarioRoutes"))
router.use("/entregas", require("./entregaRoutes"))
router.use("/avaliacoes", require("./avaliacaoRoutes"))
router.use("/eventos", require("./eventoRoutes"))
router.use("/auditlogs", require("./auditLogRoutes"))

// RBAC: define seus proprios caminhos completos (/permissoes/catalogo,
// /tenants/:id/roles/...), por isso e montado na raiz.
router.use("/", require("./rbacRoutes"))

module.exports = router
