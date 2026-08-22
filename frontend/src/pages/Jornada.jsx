/**
 * Jornada do incubado — o ambiente de estudo/execucao da startup.
 *
 * Tres telas, espelhando Fase -> Modulo -> Atividade:
 *   1) "fases"    -> visao geral em cartoes, uma por fase da trilha. Fases
 *      ainda nao alcancadas aparecem BLOQUEADAS (o incubado precisa avancar
 *      nas anteriores para desbloquear). E sempre a tela inicial.
 *   2) "modulos"  -> ao escolher uma fase desbloqueada, mostra os MODULOS
 *      dela em cartoes (quantas atividades cada um tem, progresso). O
 *      incubado precisa ver os modulos antes de abrir uma atividade.
 *   3) "atividade" -> ao escolher um modulo, abre um shell de 3 colunas
 *      (estilo Coursera/Docs) com as ATIVIDADES daquele modulo a esquerda,
 *      o conteudo da atividade selecionada no centro (objetivo, conteudo e
 *      entrega) e o impacto na empresa a direita.
 *
 * A jornada e da STARTUP, nao do usuario: todos os membros da equipe veem e
 * editam o mesmo estado (o topo mostra os membros para deixar isso claro).
 *
 * Os dados vem da API (/jornada) via useJornada.
 */
import { useState } from "react"
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  LinearProgress,
  Drawer,
  IconButton,
  Snackbar,
  Alert,
  Tooltip,
  Avatar,
  AvatarGroup,
  CircularProgress,
  useTheme,
  useMediaQuery,
} from "@mui/material"
import {
  Menu as MenuIcon,
  Rocket,
  ArrowBack,
  ViewSidebarOutlined,
  Groups,
  PlayCircle,
} from "@mui/icons-material"
import { AnimatePresence, motion } from "framer-motion"
import AppLayout from "../components/AppLayout"
import { useJornada } from "../hooks/useJornada"
import TrilhasGrid from "../components/jornada/TrilhasGrid"
import FasesGrid from "../components/jornada/FasesGrid"
import ModulosGrid from "../components/jornada/ModulosGrid"
import AtividadesSidebar from "../components/jornada/AtividadesSidebar"
import PassoConteudo from "../components/jornada/PassoConteudo"
import PassoImpacto from "../components/jornada/PassoImpacto"
import EmptyState from "../components/programa/EmptyState"

const LARGURA_NAV = 300
const LARGURA_IMPACTO = 320
const ZOOM = 0.8 // exibe a tela a 80%

export default function Jornada() {
  const j = useJornada()
  const theme = useTheme()
  const lgUp = useMediaQuery(theme.breakpoints.up("lg"))
  const mdUp = useMediaQuery(theme.breakpoints.up("md"))

  const [navMobile, setNavMobile] = useState(false)
  const [navAberta, setNavAberta] = useState(true) // recolher barra esquerda
  const [impactoAberto, setImpactoAberto] = useState(true) // recolher barra direita
  const [toast, setToast] = useState(null)

  const selecionar = (id) => {
    j.setSelecionadoId(id)
    if (!mdUp) setNavMobile(false)
  }

  const salvarRascunho = async (resposta, anexos) => {
    const r = await j.salvarRascunho(j.selecionadoId, resposta, anexos)
    setToast(
      r.ok
        ? { texto: "Rascunho salvo.", severidade: "success" }
        : { texto: r.erro, severidade: "error" }
    )
  }

  const enviar = async (resposta, anexos) => {
    const r = await j.enviarAvaliacao(j.selecionadoId, resposta, anexos)
    setToast(
      r.ok
        ? { texto: "Enviado! O mentor foi notificado.", severidade: "success" }
        : { texto: r.erro, severidade: "error" }
    )
  }

  // Carregando a jornada do servidor.
  if (j.carregando) {
    return (
      <AppLayout>
        <Box sx={{ display: "grid", placeItems: "center", height: "60vh" }}>
          <CircularProgress />
        </Box>
      </AppLayout>
    )
  }

  // ------------------------------------------------------------ tela 0: trilhas
  // Vem antes do tratamento de erro: a startup pode ter uma trilha vazia entre
  // as suas, e nesse caso a lista continua sendo a tela certa — nao um erro.
  if (j.tela === "trilhas" && !j.erro) {
    return (
      <AppLayout>
        <Box data-tour="jornada-trilhas">
          <TrilhasGrid
            trilhas={j.trilhas}
            trilhaAtivaId={j.trilhaAtivaId}
            onAbrir={j.selecionarTrilha}
          />
        </Box>
      </AppLayout>
    )
  }

  // Sem startup, sem trilha montada, ou falha de rede.
  if (j.erro || !j.jornada.programa) {
    return (
      <AppLayout>
        <Box sx={{ display: "grid", placeItems: "center", height: "60vh", px: 3 }}>
          <Box sx={{ textAlign: "center", maxWidth: 460 }}>
            <Rocket sx={{ fontSize: 48, color: "primary.main", opacity: 0.7, mb: 1 }} />
            <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
              {j.erro ? "Não foi possível abrir sua jornada" : "Sua trilha ainda não começou"}
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              {j.erro ||
                "A incubadora ainda não publicou o programa. Assim que a trilha estiver pronta, ela aparece aqui."}
            </Typography>
            {j.trilhas.length > 1 && (
              <Button
                startIcon={<ArrowBack />}
                onClick={j.voltarParaTrilhas}
                sx={{ textTransform: "none" }}
              >
                Ver minhas trilhas
              </Button>
            )}
          </Box>
        </Box>
      </AppLayout>
    )
  }

  // -------------------------------------------------------------- tela 1: fases
  if (j.tela === "fases") {
    const faseSugerida = j.jornada.estagios.find((e) => e.id === j.faseSugeridaId)
    return (
      <AppLayout>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
          {j.trilhas.length > 1 && (
            <Tooltip title="Minhas trilhas" arrow>
              <IconButton size="small" onClick={j.voltarParaTrilhas}>
                <ArrowBack fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Rocket sx={{ color: "primary.main" }} />
          <Typography variant="h4" fontWeight={800}>
            {j.trilhas.length > 1 ? j.jornada.programa.nome : "Minha Jornada"}
          </Typography>
          {j.trilhaAtiva?.status === "CONCLUIDA" && (
            <Chip label="concluída" size="small" color="success" sx={{ fontWeight: 700 }} />
          )}
        </Box>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          A construção da {j.jornada.startup} — escolha uma fase para ver os módulos dela.
          Fases ainda não alcançadas aparecem bloqueadas.
        </Typography>

        <Paper
          elevation={0}
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 3,
            p: 2.5,
            mb: 3,
            display: "flex",
            alignItems: "center",
            gap: 2.5,
            flexWrap: "wrap",
          }}
        >
          <Box data-tour="jornada-progresso" sx={{ flex: 1, minWidth: 220 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <LinearProgress
                variant="determinate"
                value={j.progressoGeral.pct}
                sx={{ flex: 1, height: 8, borderRadius: 4, bgcolor: "action.hover" }}
              />
              <Typography variant="caption" sx={{ fontWeight: 800 }}>
                {j.progressoGeral.pct}%
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary">
              {j.progressoGeral.feitos} de {j.progressoGeral.total} atividades concluídas
            </Typography>
          </Box>

          <Tooltip
            arrow
            title={`Jornada da equipe - todos os membros da ${j.jornada.startup} veem e editam o mesmo progresso`}
          >
            <Box data-tour="jornada-equipe" sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Groups sx={{ fontSize: 18, color: "text.disabled" }} />
              <AvatarGroup
                max={4}
                sx={{ "& .MuiAvatar-root": { width: 28, height: 28, fontSize: 12 } }}
              >
                {j.jornada.equipe.map((m) => (
                  <Avatar key={m.nome} sx={{ bgcolor: "primary.main" }}>
                    {m.inicial}
                  </Avatar>
                ))}
              </AvatarGroup>
            </Box>
          </Tooltip>

          {faseSugerida && (
            <Button
              data-tour="jornada-continuar"
              variant="contained"
              startIcon={<PlayCircle />}
              onClick={j.continuarJornada}
              sx={{ textTransform: "none", fontWeight: 700 }}
            >
              Continuar em {faseSugerida.nome}
            </Button>
          )}
        </Paper>

        <Box data-tour="jornada-fases">
          <FasesGrid
            estagios={j.jornada.estagios}
            progressoEstagio={j.progressoEstagio}
            faseSugeridaId={j.faseSugeridaId}
            onSelecionar={j.selecionarFase}
          />
        </Box>
      </AppLayout>
    )
  }

  // -------------------------------------------------------------- tela 2: modulos da fase
  if (j.tela === "modulos") {
    const estagio = j.estagioSelecionado
    const progFase = estagio ? j.progressoEstagio(estagio) : { feitos: 0, total: 0, pct: 0 }
    return (
      <AppLayout>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
          <Tooltip title="Voltar às fases" arrow>
            <IconButton size="small" onClick={j.voltarParaFases}>
              <ArrowBack fontSize="small" />
            </IconButton>
          </Tooltip>
          <Typography variant="h4" fontWeight={800}>
            {estagio?.nome}
          </Typography>
        </Box>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {estagio?.resumo} Escolha um módulo para ver as atividades dele.
        </Typography>

        <Paper
          elevation={0}
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 3,
            p: 2.5,
            mb: 3,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <LinearProgress
              variant="determinate"
              value={progFase.pct}
              sx={{ flex: 1, height: 8, borderRadius: 4, bgcolor: "action.hover" }}
            />
            <Typography variant="caption" sx={{ fontWeight: 800 }}>
              {progFase.pct}%
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            {progFase.feitos} de {progFase.total} atividades concluídas nesta fase
          </Typography>
        </Paper>

        <Box data-tour="jornada-modulos">
          <ModulosGrid modulos={j.modulosDaFase} onSelecionar={j.selecionarModulo} />
        </Box>
      </AppLayout>
    )
  }

  // -------------------------------------------------------------- tela 3: atividades do modulo
  const estagio = j.estagioSelecionado
  const progModulo = j.progressoModulo

  const nav = (
    <AtividadesSidebar
      passos={j.passosDoModulo}
      selecionadoId={j.selecionadoId}
      onSelecionar={selecionar}
    />
  )

  return (
    <AppLayout>
      <Box sx={{ mx: -3, mt: -3 }}>
        <Paper
          elevation={0}
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            // Zoom de 80%: compensa largura e altura para preencher a area.
            zoom: ZOOM,
            width: `${100 / ZOOM}%`,
            height: `calc((100vh - 112px) / ${ZOOM})`,
          }}
        >
          {/* Topo: modulo + progresso + toggles das barras */}
          <Box
            sx={{
              px: 2.5,
              py: 1.5,
              borderBottom: "1px solid",
              borderColor: "divider",
              display: "flex",
              alignItems: "center",
              gap: 2,
            }}
          >
            <Tooltip title="Voltar aos módulos" arrow>
              <IconButton size="small" onClick={j.voltarParaModulos}>
                <ArrowBack fontSize="small" />
              </IconButton>
            </Tooltip>

            {!mdUp && (
              <IconButton size="small" onClick={() => setNavMobile(true)}>
                <MenuIcon />
              </IconButton>
            )}
            {/* Recolher/expandir barra esquerda (desktop) */}
            {mdUp && (
              <Tooltip title={navAberta ? "Recolher atividades" : "Expandir atividades"} arrow>
                <IconButton
                  size="small"
                  onClick={() => setNavAberta((v) => !v)}
                  sx={{ color: navAberta ? "primary.main" : "text.secondary" }}
                >
                  <ViewSidebarOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
            )}

            <Box sx={{ minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>
                {estagio?.nome}
              </Typography>
              <Typography sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                {j.moduloSelecionado}
              </Typography>
            </Box>

            <Box sx={{ flex: 1, minWidth: 60, maxWidth: 240, ml: "auto" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={progModulo.pct}
                  sx={{ flex: 1, height: 8, borderRadius: 4, bgcolor: "action.hover" }}
                />
                <Typography variant="caption" sx={{ fontWeight: 800 }}>
                  {progModulo.pct}%
                </Typography>
              </Box>
            </Box>

            {/* Recolher/expandir barra direita (so em lg) */}
            {lgUp && j.passo && (
              <Tooltip title={impactoAberto ? "Recolher painel" : "Expandir painel"} arrow>
                <IconButton
                  size="small"
                  onClick={() => setImpactoAberto((v) => !v)}
                  sx={{ color: impactoAberto ? "primary.main" : "text.secondary" }}
                >
                  <ViewSidebarOutlined fontSize="small" sx={{ transform: "scaleX(-1)" }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>

          {/* Corpo: 3 colunas */}
          <Box sx={{ flex: 1, display: "flex", minHeight: 0 }}>
            {/* Esquerda: atividades do modulo (recolhivel em md+) */}
            <AnimatePresence initial={false}>
              {mdUp && navAberta && (
                <Box
                  component={motion.div}
                  key="nav"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: LARGURA_NAV, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  sx={{
                    flexShrink: 0,
                    borderRight: "1px solid",
                    borderColor: "divider",
                    minHeight: 0,
                    overflow: "hidden",
                  }}
                >
                  <Box data-tour="jornada-atividades" sx={{ width: LARGURA_NAV, height: "100%" }}>
                    {nav}
                  </Box>
                </Box>
              )}
            </AnimatePresence>

            {/* Centro: a aula */}
            <Box data-tour="jornada-conteudo" sx={{ flex: 1, minWidth: 0, minHeight: 0, overflowY: "auto" }}>
              {j.passo ? (
                <PassoConteudo
                  passo={j.passo}
                  conteudos={j.conteudosDoPasso}
                  posicao={j.posicaoNoEstagio}
                  onSalvarRascunho={salvarRascunho}
                  onEnviar={enviar}
                  onAnterior={() => j.passoAnterior && selecionar(j.passoAnterior.id)}
                  onProximo={() => j.passoProximo && selecionar(j.passoProximo.id)}
                  temAnterior={Boolean(j.passoAnterior)}
                  temProximo={Boolean(j.passoProximo)}
                />
              ) : (
                <Box sx={{ display: "grid", placeItems: "center", height: "100%" }}>
                  <EmptyState
                    variante="selecao"
                    titulo="Escolha uma atividade"
                    descricao="Selecione uma atividade à esquerda para começar."
                  />
                </Box>
              )}
            </Box>

            {/* Direita: impacto (recolhivel, so em lg+) */}
            <AnimatePresence initial={false}>
              {lgUp && j.passo && impactoAberto && (
                <Box
                  component={motion.div}
                  key="impacto"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: LARGURA_IMPACTO, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  sx={{
                    flexShrink: 0,
                    borderLeft: "1px solid",
                    borderColor: "divider",
                    minHeight: 0,
                    overflow: "hidden",
                  }}
                >
                  <Box data-tour="jornada-impacto" sx={{ width: LARGURA_IMPACTO, height: "100%" }}>
                    <PassoImpacto
                      passo={j.passo}
                      mentor={j.jornada.mentor}
                      progresso={progModulo}
                    />
                  </Box>
                </Box>
              )}
            </AnimatePresence>
          </Box>
        </Paper>
      </Box>

      {/* Navegador como Drawer no mobile */}
      <Drawer
        open={!mdUp && navMobile}
        onClose={() => setNavMobile(false)}
        PaperProps={{ sx: { width: "86%", maxWidth: LARGURA_NAV } }}
      >
        {nav}
      </Drawer>

      {/* Toast */}
      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={3000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {toast ? (
          <Alert
            severity={toast.severidade}
            variant="filled"
            onClose={() => setToast(null)}
            sx={{ borderRadius: "6px" }}
          >
            {toast.texto}
          </Alert>
        ) : (
          <span />
        )}
      </Snackbar>
    </AppLayout>
  )
}
