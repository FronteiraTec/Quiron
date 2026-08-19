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

// Feedback livre do usuario logado sobre a plataforma (item "Enviar
// Feedback" do UserPanel).
router.use("/feedback", require("./feedbackRoutes"))

// Arquivos: upload e download. Cada rota declara sua propria autenticacao — o
// download atende tambem o anonimo, para imagem publica em <img>.
router.use("/arquivos", require("./arquivoRoutes"))

// Modulos de dominio (todos protegidos por Bearer Token).
router.use("/tenants", require("./tenantRoutes"))
router.use("/startups", require("./startupRoutes"))
// Vocabulario configuravel do cadastro de startup (tipos, situacoes e campos
// personalizaveis de cada incubadora). Fora de /startups porque /startups/:id
// capturaria "config" como id.
router.use("/startups-config", require("./startupConfigRoutes"))
// Mentores: o papel 'mentor' do tenant e o vinculo mentor <-> startup, que
// recorta a fila de avaliacao de cada um.
router.use("/mentores", require("./mentorRoutes"))

// Trilha: a arvore Programa > Fase > Modulo > Passo num recurso so. Substitui
// /fases, /modulos e /tarefas, que eram tres CRUDs do mesmo dominio.
router.use("/trilha", require("./trilhaRoutes"))
// Biblioteca: o acervo reutilizavel do que a incubadora ensina.
router.use("/conteudos", require("./bibliotecaRoutes"))
// Jornada: a mesma trilha, vista pela startup, com o estado das entregas.
router.use("/jornada", require("./jornadaRoutes"))

router.use("/questionarios", require("./questionarioRoutes"))
router.use("/entregas", require("./entregaRoutes"))
router.use("/avaliacoes", require("./avaliacaoRoutes"))
router.use("/eventos", require("./eventoRoutes"))
// Vocabulario configuravel da agenda (categorias e locais de cada incubadora).
// Fora de /eventos porque /eventos/:id capturaria "categorias" como id.
router.use("/agenda-config", require("./agendaConfigRoutes"))
// Google Agenda: cada pessoa conecta a propria conta e recebe la os eventos
// que ja enxerga aqui. Fora de /eventos porque o modulo tem uma rota PUBLICA
// (o callback do OAuth), e /eventos protege tudo em bloco.
router.use("/google-agenda", require("./googleAgendaRoutes"))
router.use("/auditlogs", require("./auditLogRoutes"))

// Mensagens internas: o canal da propria incubadora (startup inteira,
// mentores, uma role ou pessoas especificas) que alimenta o sino da Navbar.
router.use("/mensagens", require("./mensagemRoutes"))

// Relatorios: leituras agregadas do que os outros modulos ja registram
// (progresso na trilha, fila de avaliacao, gargalos, presenca em eventos).
router.use("/relatorios", require("./relatorioRoutes"))

// RBAC: define seus proprios caminhos completos (/permissoes/catalogo,
// /tenants/:id/roles/...), por isso e montado na raiz.
router.use("/", require("./rbacRoutes"))

module.exports = router
