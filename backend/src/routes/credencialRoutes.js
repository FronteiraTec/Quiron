/**
 * Rota PUBLICA da credencial de selo.
 *
 * NAO aplica `autenticar`, no mesmo precedente de arquivoRoutes (o download de
 * imagem publica) e do callback do Google Agenda: quem abre este link veio do
 * LinkedIn e nao tem sessao nenhuma. A autorizacao e o codigo aleatorio mais o
 * `publico` que o dono da conquista ligou.
 *
 * Montada na RAIZ (/credencial/:codigo, ver routes/index.js) e nao sob /api,
 * porque esta URL e colada em perfil publico e mandada por mensagem — ela
 * precisa ser curta e nao parecer endpoint. O nginx tem um `location
 * /credencial/` apontando para ca; sem ele, o caminho cairia no frontend e o
 * SPA responderia com o index.html.
 */
const express = require("express")
const router = express.Router()

const ctrl = require("../controllers/credencialController")

router.get("/credencial/:codigo", ctrl.pagina)

module.exports = router
