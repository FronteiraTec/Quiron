/**
 * Rotas de RBAC (Roles e Permissoes). Todas exigem Bearer Token (middleware
 * autenticar); a autorizacao fina (root ou admin do tenant) e feita no
 * rbacService via tenantService.garantirAcessoTenant.
 */
const express = require("express")
const router = express.Router()

const ctrl = require("../controllers/rbacController")
const { autenticar } = require("../middlewares/auth")

router.use(autenticar)

// Catalogo de permissoes (leitura de metadados; qualquer autenticado pode ler).
router.get("/permissoes/catalogo", ctrl.catalogo)

// Permissoes do proprio usuario logado num tenant (qualquer autenticado pode ler as suas).
router.get("/permissoes/minhas", ctrl.minhasPermissoes)

// Roles de uma incubadora (escopo: root ou admin do tenant).
router.get("/tenants/:id/roles", ctrl.listarRoles)
router.post("/tenants/:id/roles", ctrl.criarRole)
router.get("/tenants/:id/roles/:idRole", ctrl.buscarRole)
router.put("/tenants/:id/roles/:idRole", ctrl.atualizarRole)
router.delete("/tenants/:id/roles/:idRole", ctrl.excluirRole)
router.put("/tenants/:id/roles/:idRole/permissoes", ctrl.definirPermissoesDaRole)

// Usuarios da incubadora + roles vinculadas (tela de atribuicao de grupos).
router.get("/tenants/:id/usuarios-roles", ctrl.listarUsuariosComRoles)

router.post("/tenants/:id/roles/:idRole/usuarios", ctrl.vincularUsuario)
router.delete("/tenants/:id/roles/:idRole/usuarios/:idUsuario", ctrl.desvincularUsuario)

// Redefinicao de senha de um usuario da incubadora (permissao RBAC
// "usuarios.usuarios.redefinir_senha", verificada no rbacService).
router.post("/tenants/:id/usuarios/:idUsuario/redefinir-senha", ctrl.redefinirSenhaUsuario)

module.exports = router
