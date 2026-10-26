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
 *   3) "atividade" -> ao escolher um modulo, abre um shell (estilo
 *      Coursera/Docs) com as ATIVIDADES daquele modulo a esquerda e o
 *      conteudo da atividade selecionada no centro (objetivo, conteudo e
 *      entrega). Havia um painel de "impacto" a direita; saiu porque so
 *      repetia informacao basica e roubava largura da aula.
 *
 * A jornada e da STARTUP, nao do usuario: todos os membros da equipe veem e
 * editam o mesmo estado (o topo mostra os membros para deixar isso claro).
 *
 * Os dados vem da API (/jornada) via useJornada.
 */
import { useMemo, useState } from "react"
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
import MateriaisDoMentor from "../components/jornada/MateriaisDoMentor"
import DialogMaterial from "../components/espacoMentor/DialogMaterial"
import EmptyState from "../components/programa/EmptyState"
import { useMateriaisRecebidos } from "../hooks/useEspacoMentor"
import { agruparRecebidos } from "../data/espacoMentorMeta"

const LARGURA_NAV = 300
const ZOOM = 0.8 // exibe a tela a 80%

export default function Jornada() {
  const j = useJornada()
  const theme = useTheme()
  const mdUp = useMediaQuery(theme.breakpoints.up("md"))

  const [navMobile, setNavMobile] = useState(false)
  const [navAberta, setNavAberta] = useState(true) // recolher barra esquerda
  const [toast, setToast] = useState(null)

  // Os materiais que os mentores entregaram a startup NESTA trilha (Espaco do
  // Mentor). Carregam a parte da jornada: uma falha aqui nao pode travar a
  // entrega do passo, entao o erro so faz a secao nao aparecer.
  const recebidos = useMateriaisRecebidos({
    idStartup: j.idStartup,
    idTrilha: j.jornada.programa?.id ?? null,
  })
  const grupos = useMemo(() => agruparRecebidos(recebidos.materiais), [recebidos.materiais])
  const [materialAberto, setMaterialAberto] = useState(null)

  const dialogMaterial = (
    <DialogMaterial
      aberto={Boolean(materialAberto)}
      item={materialAberto}
      onFechar={() => setMaterialAberto(null)}
    />
  )

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

  const marcarConcluido = async (concluido) => {
    const r = await j.marcarConcluido(j.selecionadoId, concluido)
    setToast(
      r.ok
        ? { texto: concluido ? "Passo concluído." : "Conclusão desfeita.", severidade: "success" }
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
          A construção da {j.jornada.startup}, escolha uma fase para ver os módulos dela.
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

        <MateriaisDoMentor
          titulo="Materiais do seu mentor"
          descricao="O que os mentores separaram para a sua startup nesta trilha. Abra para ler a orientação de cada um."
          materiais={recebidos.materiais}
          onAbrir={setMaterialAberto}
        />

        <Box data-tour="jornada-fases">
          <FasesGrid
            estagios={j.jornada.estagios}
            progressoEstagio={j.progressoEstagio}
            faseSugeridaId={j.faseSugeridaId}
            onSelecionar={j.selecionarFase}
          />
        </Box>
        {dialogMaterial}
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

        <MateriaisDoMentor
          titulo="Materiais do mentor para esta fase"
          materiais={estagio ? grupos.porFase(estagio.id) : []}
          onAbrir={setMaterialAberto}
        />

        <Box data-tour="jornada-modulos">
          <ModulosGrid modulos={j.modulosDaFase} onSelecionar={j.selecionarModulo} />
        </Box>
        {dialogMaterial}
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
    <AppLayout fullBleed>
      <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <Paper
          elevation={0}
          sx={{
            borderTop: "1px solid",
            borderColor: "divider",
            borderRadius: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            // Zoom de 80%. Largura e altura vem do layout (fullBleed + flex),
            // e nao de conta: era `width: 125%` e `height: calc((100vh -
            // 112px) / 0.8)`. A largura so dava certo no zoom antigo do
            // Chrome — desde o padronizado (Chrome 128) o zoom nao encolhe
            // porcentagem e o painel saia 25% mais largo, com rolagem
            // horizontal — e os 112px deixavam uma faixa de fundo no rodape.
            zoom: ZOOM,
            flex: 1,
            minHeight: 0,
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

          </Box>

          {/* Corpo: atividades a esquerda, a aula no centro */}
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
                  materiaisMentor={grupos.doPasso(j.passo.id)}
                  onAbrirMaterial={setMaterialAberto}
                  posicao={j.posicaoNoEstagio}
                  onSalvarRascunho={salvarRascunho}
                  onEnviar={enviar}
                  onMarcarConcluido={marcarConcluido}
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

      {dialogMaterial}

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
