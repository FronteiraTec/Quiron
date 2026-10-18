/**
 * Rotas do Espaco do Mentor. Todas exigem Bearer Token (middleware autenticar).
 *
 * A biblioteca PESSOAL do mentor, as startups que ele acompanha e o que ele
 * compartilhou com elas (migracao 020), e o que a incubadora publica para os
 * mentores (migracao 021). A autorizacao real — a chave, o dono do material, o
 * vinculo com a startup — fica nos services.
 *
 * O que a STARTUP recebeu nao mora aqui: e lido na Jornada (GET
 * /jornada/materiais), pelo mesmo vinculo com que ela le a propria trilha.
 */
const express = require("express")
const router = express.Router()

const ctrl = require("../controllers/espacoMentorController")
const { autenticar } = require("../middlewares/auth")

router.use(autenticar)

// Minha biblioteca. O arquivo sobe antes, por POST /arquivos (PRIVADO), e o
// material chega aqui com o id dele.
router.get("/materiais", ctrl.listarMateriais) // ?id_tenant=
router.post("/materiais", ctrl.criarMaterial)
router.get("/materiais/:id/arquivo", ctrl.baixarMaterial)
router.get("/materiais/:id", ctrl.buscarMaterial)
router.patch("/materiais/:id", ctrl.atualizarMaterial)
router.delete("/materiais/:id", ctrl.excluirMaterial)

// Pastas da minha biblioteca (migracao 025). A lista vem junto com os
// materiais, em GET /materiais. Mover — material ou pasta, um ou varios — e
// um gesto so, numa transacao.
router.post("/pastas", ctrl.criarPasta)
router.patch("/pastas/:id", ctrl.renomearPasta)
router.delete("/pastas/:id", ctrl.excluirPasta)
router.post("/mover", ctrl.moverItens)

// Materiais da incubadora para os mentores (migracao 021): a coordenacao
// publica, os mentores consultam. O arquivo sobe por POST /arquivos, como na
// biblioteca pessoal.
router.get("/incubadora", ctrl.listarMateriaisIncubadora) // ?id_tenant=
router.post("/incubadora", ctrl.criarMaterialIncubadora)
router.get("/incubadora/:id/arquivo", ctrl.baixarMaterialIncubadora)
router.get("/incubadora/:id", ctrl.buscarMaterialIncubadora)
router.patch("/incubadora/:id", ctrl.atualizarMaterialIncubadora)
router.delete("/incubadora/:id", ctrl.excluirMaterialIncubadora)

// Meus incubados: as startups que acompanho e a trilha de cada uma.
router.get("/incubados", ctrl.listarIncubados) // ?id_tenant=
router.get("/incubados/:idStartup/trilhas/:idPrograma", ctrl.carregarTrilhaDoIncubado)

// Compartilhamentos: o vinculo material -> startup (trilha e etapa).
router.get("/compartilhamentos", ctrl.listarCompartilhamentos) // ?id_tenant=&id_startup=
router.post("/compartilhamentos", ctrl.compartilhar)
router.patch("/compartilhamentos/:id", ctrl.atualizarCompartilhamento)
router.delete("/compartilhamentos/:id", ctrl.removerCompartilhamento)

module.exports = router
