/**
 * Construtor de Programa — experiencia da incubadora (admin) para montar toda a
 * trilha de incubacao numa unica tela, estilo Notion/ClickUp.
 *
 * Duas areas:
 *   - Painel esquerdo (ProgramTree): a arvore Programa -> Fases -> Modulos ->
 *     Tarefas, com criacao rapida, drag and drop, busca e menu de contexto.
 *   - Painel direito (InspectorPanel): edicao das propriedades do no
 *     selecionado, sem modal e sem trocar de pagina.
 *
 * Extras: Toolbar (expandir/recolher todos, "Visualizar como incubada"),
 * ConfirmDialog e responsividade (arvore vira Drawer no mobile/tablet).
 *
 * A arvore vem da API (/trilha) via usePrograma.
 */
import { useMemo, useState } from "react"
import {
  Box,
  Paper,
  Drawer,
  Snackbar,
  Alert,
  Button,
  Typography,
  CircularProgress,
  useTheme,
  useMediaQuery,
} from "@mui/material"
import { AutoStories, Add } from "@mui/icons-material"
import { AnimatePresence } from "framer-motion"
import AppLayout from "../components/AppLayout"
import { usePrograma } from "../hooks/usePrograma"
import Toolbar from "../components/programa/Toolbar"
import ProgramTree from "../components/programa/ProgramTree"
import InspectorPanel from "../components/programa/InspectorPanel"
import ContextMenu from "../components/programa/ContextMenu"
import ConfirmDialog from "../components/programa/ConfirmDialog"
import PreviewIncubada from "../components/programa/PreviewIncubada"
import { TIPO_META } from "../data/trilhaMeta"

const LARGURA_ARVORE = 380

export default function Programa() {
  const prog = usePrograma()
  const theme = useTheme()
  const mdUp = useMediaQuery(theme.breakpoints.up("md"))

  const [termo, setTermo] = useState("")
  const [arvoreMobile, setArvoreMobile] = useState(false)
  const [preview, setPreview] = useState(false)

  // Menu de contexto: { ancora, no }.
  const [menu, setMenu] = useState({ ancora: null, no: null })
  // Confirmacao de exclusao: { no } | null.
  const [confirmar, setConfirmar] = useState(null)
  // Toast: { texto, severidade, undo? }.
  const [toast, setToast] = useState(null)

  // Arvore filtrada pela busca (memoizada).
  const { programa: arvore, matchIds } = useMemo(
    () => prog.filtrar(termo),
    [prog, termo]
  )

  // Contexto compartilhado com a arvore/nos (estado + acoes).
  const ctx = {
    selecionadoId: prog.selecionadoId,
    expandidos: prog.expandidos,
    termo,
    setTermo,
    setSelecionadoId: (id) => {
      prog.setSelecionadoId(id)
      if (!mdUp) setArvoreMobile(false)
    },
    alternarExpandido: prog.alternarExpandido,
    adicionar: prog.adicionar,
    reordenar: prog.reordenar,
    abrirMenu: (ancora, no) => setMenu({ ancora, no }),
  }

  const feedbackSalvo = () =>
    setToast({ texto: "Alteracoes salvas.", severidade: "success" })

  /**
   * Fluxo de exclusao: confirmacao -> exclui no servidor.
   * Nao ha "Desfazer": recriar a subarvore geraria ids novos, e as entregas
   * das startups apontariam para nos inexistentes. Por isso a confirmacao
   * avisa que a acao e definitiva.
   */
  const pedirExclusao = (no) => setConfirmar({ no })
  const confirmarExclusao = async () => {
    const alvo = confirmar.no
    setConfirmar(null)

    const r = await prog.excluir(alvo.id_no)

    setToast(
      r.ok
        ? {
            texto: `${TIPO_META[alvo.tipo].label} "${alvo.nome}" excluido.`,
            severidade: "info",
          }
        : { texto: r.erro, severidade: "error" }
    )
  }

  // Acoes disparadas pelo menu de contexto.
  const acoesMenu = {
    adicionar: prog.adicionar,
    alternarAtivo: prog.alternarAtivo,
    duplicar: async (no) => {
      await prog.duplicar(no.id_no)
      setToast({ texto: "Item duplicado.", severidade: "success" })
    },
    excluir: pedirExclusao,
  }

  const arvoreEl = arvore ? (
    <ProgramTree arvore={arvore} termo={termo} ctx={ctx} matchIds={matchIds} />
  ) : null

  // Carregando a trilha do servidor.
  if (prog.carregando) {
    return (
      <AppLayout>
        <Box sx={{ display: "grid", placeItems: "center", height: "60vh" }}>
          <CircularProgress />
        </Box>
      </AppLayout>
    )
  }

  // Tenant ainda sem trilha: a arvore precisa de uma raiz antes de aceitar
  // fases, entao o primeiro passo e criar o programa.
  if (!arvore) {
    return (
      <AppLayout>
        <Box sx={{ display: "grid", placeItems: "center", height: "60vh", px: 3 }}>
          <Box sx={{ textAlign: "center", maxWidth: 460 }}>
            <AutoStories sx={{ fontSize: 48, color: "primary.main", opacity: 0.7, mb: 1 }} />
            <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
              Comece sua trilha
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              Sua incubadora ainda nao tem um programa. Crie a trilha para
              comecar a montar fases, modulos e passos.
            </Typography>
            {prog.erro && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: "6px" }}>
                {prog.erro}
              </Alert>
            )}
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => prog.criarPrograma()}
              sx={{ textTransform: "none" }}
            >
              Criar trilha de incubacao
            </Button>
          </Box>
        </Box>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <Box sx={{ mx: { xs: -3, md: -3 }, mt: -3 }}>
        <Paper
          elevation={0}
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 0,
            overflow: "hidden",
            height: "calc(100vh - 112px)",
            display: "flex",
            flexDirection: "column",
            mx: { md: 0 },
          }}
        >
          <Toolbar
            onExpandirTodos={prog.expandirTodos}
            onRecolherTodos={prog.recolherTodos}
            onPreview={() => setPreview(true)}
            onToggleArvore={() => setArvoreMobile(true)}
            mostrarToggleArvore={!mdUp}
          />

          <Box sx={{ flex: 1, display: "flex", minHeight: 0 }}>
            {/* Painel esquerdo (arvore) — fixo no desktop */}
            {mdUp && (
              <Box
                sx={{
                  width: LARGURA_ARVORE,
                  flexShrink: 0,
                  borderRight: "1px solid",
                  borderColor: "divider",
                  minHeight: 0,
                }}
              >
                {arvoreEl}
              </Box>
            )}

            {/* Painel direito (inspector) */}
            <Box sx={{ flex: 1, minWidth: 0, minHeight: 0 }}>
              <InspectorPanel
                programa={prog.programa}
                no={prog.selecionado}
                trilha={prog.trilha}
                acoes={prog}
                onSalvar={feedbackSalvo}
                onExcluir={pedirExclusao}
              />
            </Box>
          </Box>
        </Paper>
      </Box>

      {/* Arvore como Drawer no mobile/tablet */}
      <Drawer
        open={!mdUp && arvoreMobile}
        onClose={() => setArvoreMobile(false)}
        PaperProps={{ sx: { width: "88%", maxWidth: LARGURA_ARVORE } }}
      >
        <Box sx={{ height: "100%" }}>{arvoreEl}</Box>
      </Drawer>

      {/* Menu de contexto */}
      <ContextMenu
        ancora={menu.ancora}
        no={menu.no}
        onFechar={() => setMenu({ ancora: null, no: null })}
        acoes={acoesMenu}
      />

      {/* Confirmacao de exclusao */}
      <ConfirmDialog
        aberto={Boolean(confirmar)}
        mensagem={
          confirmar
            ? `Tem certeza que deseja excluir "${confirmar.no.nome}"?${
                TIPO_META[confirmar.no.tipo].childTipo
                  ? " Todo o conteudo dentro dele sera removido."
                  : ""
              } Esta acao nao pode ser desfeita.`
            : ""
        }
        onConfirmar={confirmarExclusao}
        onCancelar={() => setConfirmar(null)}
      />

      {/* Toast (feedback das acoes) */}
      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={toast?.severidade === "error" ? 6000 : 3000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {toast ? (
          <Alert
            severity={toast.severidade}
            variant="filled"
            onClose={() => setToast(null)}
            sx={{ borderRadius: "6px", alignItems: "center" }}
          >
            {toast.texto}
          </Alert>
        ) : (
          <span />
        )}
      </Snackbar>

      {/* Modo "Visualizar como incubada" */}
      <AnimatePresence>
        {preview && (
          <PreviewIncubada programa={prog.programa} onFechar={() => setPreview(false)} />
        )}
      </AnimatePresence>
    </AppLayout>
  )
}
