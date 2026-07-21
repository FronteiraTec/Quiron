/**
 * Rotas da configuracao da agenda: categorias e locais de evento.
 * Todas exigem Bearer Token (middleware autenticar).
 *
 * Montado em /agenda-config (ver routes/index.js). Nao entrou em
 * /eventos/categorias porque /eventos/:id capturaria "categorias" como id de
 * evento — o mesmo motivo que levou o resumo de presenca a ter dois segmentos.
 *
 * Desativar usa PATCH /status, e nao DELETE: a operacao e reversivel e nao
 * apaga nada. Ver o comentario em agendaConfigRepository.
 */
const express = require("express")
const router = express.Router()

const ctrl = require("../controllers/agendaConfigController")
const { autenticar } = require("../middlewares/auth")

router.use(autenticar)

// Categorias. A chave e o identificador na URL (nao ha id numerico).
router.get("/categorias", ctrl.listarCategorias) // ?id_tenant=&incluir_inativas=
router.get("/categorias/:chave/uso", ctrl.usoDaCategoria) // ?id_tenant=
router.post("/categorias", ctrl.criarCategoria)
router.put("/categorias/:chave", ctrl.atualizarCategoria)
router.patch("/categorias/:chave/status", ctrl.alterarStatusCategoria)

// Locais.
router.get("/locais", ctrl.listarLocais) // ?id_tenant=&incluir_inativos=
router.get("/locais/:id/uso", ctrl.usoDoLocal) // ?id_tenant=
router.post("/locais", ctrl.criarLocal)
router.put("/locais/:id", ctrl.atualizarLocal)
router.patch("/locais/:id/status", ctrl.alterarStatusLocal)

module.exports = router
