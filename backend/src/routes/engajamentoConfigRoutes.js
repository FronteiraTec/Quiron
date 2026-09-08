/**
 * Rotas da configuracao do engajamento: temporadas, acoes que pontuam e
 * niveis de cada liga. Todas exigem Bearer Token.
 *
 * Montado em /engajamento-config (ver routes/index.js), e nao em
 * /engajamento/config, pelo mesmo motivo de /tarefas-config e
 * /startups-config: uma rota /engajamento/:algo capturaria "config".
 *
 * A acao usa a CHAVE na URL (nao ha id numerico), como tarefa_status; a
 * temporada usa id, porque nasce e morre por linha e o nome muda.
 *
 * Os niveis nao tem CRUD linha a linha: PUT /niveis/:liga substitui a escada
 * inteira. A edicao real e "mexi nos degraus", e um CRUD por linha deixaria a
 * escada num estado invalido (dois degraus no mesmo corte) entre uma
 * requisicao e outra.
 */
const express = require("express")
const router = express.Router()

const ctrl = require("../controllers/engajamentoConfigController")
const { autenticar } = require("../middlewares/auth")

router.use(autenticar)

// Temporadas
router.get("/temporadas", ctrl.listarTemporadas) // ?id_tenant=
router.get("/temporadas/:id/uso", ctrl.usoDaTemporada) // ?id_tenant=
router.post("/temporadas", ctrl.criarTemporada)
router.put("/temporadas/:id", ctrl.atualizarTemporada)
router.patch("/temporadas/:id/encerrada", ctrl.alterarEncerradaTemporada)
router.delete("/temporadas/:id", ctrl.excluirTemporada) // ?id_tenant=

// Acoes
router.get("/acoes", ctrl.listarAcoes) // ?id_tenant=&incluir_inativas=
router.get("/acoes/:chave/uso", ctrl.usoDaAcao) // ?id_tenant=
router.post("/acoes", ctrl.criarAcao)
router.put("/acoes/:chave", ctrl.atualizarAcao)
router.patch("/acoes/:chave/ativo", ctrl.alterarAtivoAcao)

// Niveis
router.get("/niveis", ctrl.listarNiveis) // ?id_tenant=&liga=
router.put("/niveis/:liga", ctrl.definirNiveis)

// A pagina da incubadora no LinkedIn. Fica aqui, e nao em Dados Cadastrais,
// porque a unica coisa que ela faz e preencher o "Adicionar ao perfil" da
// credencial de selo — quem for procurar por ela estara olhando os selos.
router.put("/linkedin", ctrl.definirLinkedin)

module.exports = router
