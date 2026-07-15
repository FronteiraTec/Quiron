/**
 * Rotas de Tenants. Todas exigem Bearer Token (middleware autenticar).
 */
const express = require("express")
const router = express.Router()

const ctrl = require("../controllers/tenantController")
const { autenticar, somenteRoot } = require("../middlewares/auth")

// Protege TODAS as rotas deste modulo.
router.use(autenticar)

// Gestao global de incubadoras: exclusiva do usuario root.
router.get("/", somenteRoot, ctrl.listar)
router.post("/", somenteRoot, ctrl.criar)
router.put("/:id", somenteRoot, ctrl.atualizar)
router.patch("/:id/status", somenteRoot, ctrl.alterarStatus)

// Gestao de usuarios de uma incubadora (root ou admin daquela incubadora;
// a criacao usa sempre uma senha provisoria).
router.get("/:id/usuarios", ctrl.listarUsuarios)
router.post("/:id/usuarios", ctrl.criarUsuario)
router.put("/:id/usuarios/:idUsuario", ctrl.atualizarUsuario)
router.patch("/:id/usuarios/:idUsuario/status", ctrl.alterarStatusUsuario)

// Operacoes no escopo de um tenant (admin da incubadora).
router.get("/:id", ctrl.buscar)
router.put("/:id/config-email", ctrl.atualizarConfigEmail)

module.exports = router
