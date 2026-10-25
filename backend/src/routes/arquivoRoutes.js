/**
 * Rotas de Arquivos.
 *
 * Ao contrario dos demais modulos, este NAO aplica `autenticar` no arquivo
 * inteiro: o download precisa atender tambem o anonimo (imagem publica numa
 * tag <img>, que nao manda cabecalho). Cada rota declara o que exige.
 */
const express = require("express")
const multer = require("multer")
const router = express.Router()

const ctrl = require("../controllers/arquivoController")
const arquivoService = require("../services/arquivoService")
const { autenticar, autenticarOpcional } = require("../middlewares/auth")

/**
 * Multer em memoria: o service e quem escolhe o nome e grava, depois de
 * validar tipo e tamanho. Deixar o multer gravar direto no disco criaria o
 * arquivo ANTES da validacao — e um upload recusado ja teria sujado o volume.
 *
 * O limite aqui e o do regime mais permissivo (PRIVADO). O teto por
 * visibilidade e conferido no service, que sabe qual regime foi pedido; este e
 * o corte grosso, que impede o corpo gigante de ser lido inteiro antes disso.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: arquivoService.MAX_PRIVADO, files: 1 },
})

// Envio: exige token.
router.post("/", autenticar, upload.single("arquivo"), ctrl.enviar)

// Download: token opcional — a visibilidade do arquivo decide (ver o service).
router.get("/:id", autenticarOpcional, ctrl.baixar)

// O mesmo arquivo como PDF (apresentacao e .doc convertidos), para a Jornada
// desenhar na pagina. Mesma regra do download.
router.get("/:id/pdf", autenticarOpcional, ctrl.baixarPdf)

module.exports = router
