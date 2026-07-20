/**
 * Rotas de Eventos. Todas exigem Bearer Token (middleware autenticar).
 */
const express = require("express")
const router = express.Router()

const ctrl = require("../controllers/eventoController")
const { autenticar } = require("../middlewares/auth")

router.use(autenticar)

router.get("/", ctrl.listar) // ?id_tenant=&inicio=&fim=

// Presenca (check-in marcado pelo admin), distinto de /confirmar (RSVP do
// participante). O resumo tem dois segmentos de proposito: "/presenca" sozinho
// seria capturado por "/:id" como um evento de id "presenca".
router.get("/presenca/resumo", ctrl.resumoPresenca) // ?id_tenant=&dias=
router.get("/:id/presenca", ctrl.listarPresenca)
router.post("/:id/presenca", ctrl.marcarPresenca) // body: id_usuarios, presente

router.get("/:id", ctrl.buscar)
router.get("/:id/participantes", ctrl.listarParticipantes)
router.post("/", ctrl.criar)
router.put("/:id", ctrl.atualizar)
router.delete("/:id", ctrl.excluir)
router.post("/:id/confirmar", ctrl.confirmarPresenca)

module.exports = router
