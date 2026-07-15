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
 * Toast com Desfazer apos exclusao, ConfirmDialog e responsividade (arvore
 * vira Drawer no mobile/tablet).
 *
 * Tudo local/mockado — nenhuma chamada de API.
 */
import { useMemo, useState } from "react"
import {
  Box,
  Paper,
  Drawer,
  Snackbar,
  Alert,
  Button,
  useTheme,
  useMediaQuery,
} from "@mui/material"
import { AnimatePresence } from "framer-motion"
import AppLayout from "../components/AppLayout"
import { usePrograma } from "../hooks/usePrograma"
import Toolbar from "../components/programa/Toolbar"
import ProgramTree from "../components/programa/ProgramTree"
import InspectorPanel from "../components/programa/InspectorPanel"
import ContextMenu from "../components/programa/ContextMenu"
import ConfirmDialog from "../components/programa/ConfirmDialog"
import PreviewIncubada from "../components/programa/PreviewIncubada"
import { TIPO_META } from "../data/programaMock"

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

  // Fluxo de exclusao: abre confirmacao -> exclui -> toast com Desfazer.
  const pedirExclusao = (no) => setConfirmar({ no })
  const confirmarExclusao = () => {
    const alvo = confirmar.no
    const snapshot = prog.excluir(alvo.id)
    setConfirmar(null)
    setToast({
      texto: `${TIPO_META[alvo.tipo].label} "${alvo.nome}" excluida.`,
      severidade: "info",
      undo: () => {
        prog.restaurar(snapshot)
        setToast(null)
      },
    })
  }

  // Acoes disparadas pelo menu de contexto.
  const acoesMenu = {
    adicionar: prog.adicionar,
    alternarAtivo: prog.alternarAtivo,
    duplicar: (no) => {
      prog.duplicar(no.id)
      setToast({ texto: "Item duplicado.", severidade: "success" })
    },
    excluir: pedirExclusao,
  }

  const arvoreEl = (
    <ProgramTree arvore={arvore} termo={termo} ctx={ctx} matchIds={matchIds} />
  )

  return (
    <AppLayout>
      <Box sx={{ mx: { xs: -3, md: -3 }, mt: -3 }}>
        <Paper
          elevation={0}
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: { xs: 0, md: "8px" },
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
            ? `Tem certeza que deseja excluir "${confirmar.no.nome}"? ${
                TIPO_META[confirmar.no.tipo].childKey
                  ? "Todo o conteudo dentro dela sera removido."
                  : ""
              } Voce podera desfazer logo em seguida.`
            : ""
        }
        onConfirmar={confirmarExclusao}
        onCancelar={() => setConfirmar(null)}
      />

      {/* Toast (feedback ao salvar / excluir com Desfazer) */}
      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={toast?.undo ? 6000 : 3000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {toast ? (
          <Alert
            severity={toast.severidade}
            variant="filled"
            onClose={() => setToast(null)}
            sx={{ borderRadius: "6px", alignItems: "center" }}
            action={
              toast.undo ? (
                <Button color="inherit" size="small" onClick={toast.undo} sx={{ fontWeight: 700 }}>
                  Desfazer
                </Button>
              ) : undefined
            }
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
