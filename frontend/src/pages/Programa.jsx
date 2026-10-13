/**
 * Construtor de Programa — experiencia da incubadora (admin) para montar as
 * trilhas de incubacao numa unica tela, estilo Notion/ClickUp.
 *
 * Duas areas:
 *   - Painel esquerdo (ProgramTree): a trilha e suas fases, com criacao
 *     rapida, drag and drop, busca e menu de contexto.
 *   - Painel direito (InspectorPanel): edicao da fase selecionada e dos
 *     materiais dela, sem modal e sem trocar de pagina.
 *
 * Modulos e passos nao aparecem mais aqui: a fase guarda o material num
 * modulo/passo "Materiais" que o servidor cria por baixo (ver trilhaMeta).
 *
 * A incubadora pode ter VARIAS trilhas. A troca acontece no seletor da
 * Toolbar, e a tela mostra uma por vez — editar duas arvores lado a lado nao
 * ajuda ninguem, e o material da Biblioteca ja e compartilhado entre elas sem
 * precisar disso.
 *
 * Extras: ConfirmDialog, dialogo de matricula (StartupsDaTrilha) e
 * responsividade (arvore vira Drawer no mobile/tablet).
 *
 * A arvore vem da API (/trilha) via usePrograma.
 */
import { useMemo, useRef, useState } from "react"
import {
  Box,
  Paper,
  Drawer,
  Snackbar,
  Alert,
  Button,
  Typography,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
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
import StartupsDaTrilha from "../components/programa/StartupsDaTrilha"
import { TIPO_META } from "../data/trilhaMeta"

const LARGURA_ARVORE = 380

export default function Programa() {
  const prog = usePrograma()
  const theme = useTheme()
  const mdUp = useMediaQuery(theme.breakpoints.up("md"))

  const [termo, setTermo] = useState("")
  const [arvoreMobile, setArvoreMobile] = useState(false)
  const [preview, setPreview] = useState(false)

  // Dialogo de matricula (quais startups fazem a trilha aberta).
  const [startupsAberto, setStartupsAberto] = useState(false)
  // Dialogo "Nova trilha": { nome } enquanto aberto, null quando fechado.
  const [novaTrilha, setNovaTrilha] = useState(null)
  const [salvandoTrilha, setSalvandoTrilha] = useState(false)

  // Menu de contexto: { ancora, no }.
  const [menu, setMenu] = useState({ ancora: null, no: null })
  // Confirmacao de exclusao: { no } | null.
  const [confirmar, setConfirmar] = useState(null)
  // Toast: { texto, severidade, undo? }.
  const [toast, setToast] = useState(null)

  // O que o Inspector tem por salvar agora. Ele publica nesta ref a cada
  // renderizacao; aqui so lemos, no momento do clique.
  const inspetor = useRef(null)
  // Acao barrada por um rascunho nao salvo: { acao, nome, podeSalvar }.
  const [pendente, setPendente] = useState(null)

  /**
   * Executa `acao` — mas se houver rascunho por salvar no Inspector, pergunta
   * antes em vez de descartar o que foi digitado.
   *
   * Trocar de no reseta o formulario do Inspector a partir da prop; sem esta
   * guarda, clicar no proximo passo para conferir uma coisa apagava em
   * silencio a descricao que estava sendo escrita.
   */
  const comGuarda = (acao) => {
    const reg = inspetor.current
    if (reg?.alterado) {
      setPendente({ acao, nome: reg.nome, podeSalvar: reg.podeSalvar })
      return
    }
    acao()
  }

  /** Segue com a acao barrada, salvando antes se foi o que pediram. */
  const resolverPendente = async (salvarAntes) => {
    const { acao } = pendente
    setPendente(null)

    if (salvarAntes) await inspetor.current?.salvar()
    else inspetor.current?.descartar()

    acao()
  }

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
    setSelecionadoId: (id) =>
      comGuarda(() => {
        prog.setSelecionadoId(id)
        if (!mdUp) setArvoreMobile(false)
      }),
    alternarExpandido: prog.alternarExpandido,
    // Criar tambem troca a selecao para o item novo, entao passa pela guarda.
    adicionar: (...args) => comGuarda(() => prog.adicionar(...args)),
    reordenar: prog.reordenar,
    abrirMenu: (ancora, no) => setMenu({ ancora, no }),
  }

  const feedbackSalvo = () =>
    setToast({ texto: "Alterações salvas.", severidade: "success" })

  const trilhaAtiva = prog.programas.find(
    (p) => Number(p.id_no) === Number(prog.programaAtivoId)
  )

  /** Cria a trilha e ja a abre no Construtor. */
  const criarTrilha = async () => {
    const nome = (novaTrilha?.nome || "").trim()
    if (!nome) return
    setSalvandoTrilha(true)
    try {
      await prog.criarPrograma(nome)
      setNovaTrilha(null)
      setToast({ texto: `Trilha "${nome}" criada.`, severidade: "success" })
    } catch (err) {
      setToast({
        texto: err.response?.data?.erro || "Erro ao criar a trilha.",
        severidade: "error",
      })
    } finally {
      setSalvandoTrilha(false)
    }
  }

  /**
   * Duplica a trilha aberta com tudo dentro dela e ja abre a copia — o
   * caminho para montar a turma seguinte a partir da anterior em vez de
   * remontar fase por fase.
   */
  const duplicarTrilha = async (id) => {
    setToast({ texto: "Duplicando a trilha…", severidade: "info" })
    const r = await prog.duplicar(id)
    setToast(
      r.ok
        ? { texto: `Trilha duplicada como "${r.no.nome}".`, severidade: "success" }
        : { texto: r.erro, severidade: "error" }
    )
  }

  const definirPadrao = async (id) => {
    const r = await prog.definirPadrao(id)
    setToast(
      r.ok
        ? { texto: "Trilha padrão atualizada.", severidade: "success" }
        : { texto: r.erro, severidade: "error" }
    )
  }

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
            texto: `${TIPO_META[alvo.tipo].label} "${alvo.nome}" excluído.`,
            severidade: "info",
          }
        : { texto: r.erro, severidade: "error" }
    )
  }

  // Acoes disparadas pelo menu de contexto.
  const acoesMenu = {
    adicionar: ctx.adicionar,
    alternarAtivo: prog.alternarAtivo,
    duplicar: async (no) => {
      const r = await prog.duplicar(no.id_no)
      setToast(
        r.ok
          ? {
              texto: `${TIPO_META[no.tipo].label} "${no.nome}" duplicado com todo o conteúdo dentro dele.`,
              severidade: "success",
            }
          : { texto: r.erro, severidade: "error" }
      )
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

  // Tenant ainda sem trilha nenhuma: a arvore precisa de uma raiz antes de
  // aceitar fases, entao o primeiro passo e criar a trilha.
  if (!arvore) {
    return (
      <AppLayout>
        <Box sx={{ display: "grid", placeItems: "center", height: "60vh", px: 3 }}>
          <Box sx={{ textAlign: "center", maxWidth: 460 }}>
            <AutoStories sx={{ fontSize: 48, color: "primary.main", opacity: 0.7, mb: 1 }} />
            <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
              Comece sua primeira trilha
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              Sua incubadora ainda não tem nenhuma trilha. Crie uma para
              começar a montar as fases e seus materiais — depois é possível ter
              quantas quiser, reaproveitando o mesmo material da Biblioteca.
            </Typography>
            {prog.erro && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: "6px" }}>
                {prog.erro}
              </Alert>
            )}
            <Button
              data-tour="programa-criar-trilha"
              variant="contained"
              startIcon={<Add />}
              onClick={() => setNovaTrilha({ nome: "Trilha de Incubação" })}
              sx={{ textTransform: "none" }}
            >
              Criar trilha
            </Button>
          </Box>
        </Box>

        <DialogNovaTrilha
          estado={novaTrilha}
          salvando={salvandoTrilha}
          onChange={(nome) => setNovaTrilha({ nome })}
          onCriar={criarTrilha}
          onFechar={() => setNovaTrilha(null)}
        />

        <Snackbar
          open={Boolean(toast)}
          autoHideDuration={toast?.severidade === "error" ? 6000 : 3000}
          onClose={() => setToast(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          {toast ? (
            <Alert severity={toast.severidade} variant="filled" onClose={() => setToast(null)}>
              {toast.texto}
            </Alert>
          ) : (
            <span />
          )}
        </Snackbar>
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
            programas={prog.programas}
            programaAtivoId={prog.programaAtivoId}
            onSelecionarPrograma={prog.selecionarPrograma}
            onNovaTrilha={() => setNovaTrilha({ nome: "" })}
            onDuplicarTrilha={duplicarTrilha}
            onDefinirPadrao={definirPadrao}
            onGerenciarStartups={() => setStartupsAberto(true)}
            onPreview={() => setPreview(true)}
            onToggleArvore={() => setArvoreMobile(true)}
            mostrarToggleArvore={!mdUp}
          />

          <Box sx={{ flex: 1, display: "flex", minHeight: 0 }}>
            {/* Painel esquerdo (arvore) — fixo no desktop */}
            {mdUp && (
              <Box
                data-tour="programa-arvore"
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
            <Box data-tour="programa-inspector" sx={{ flex: 1, minWidth: 0, minHeight: 0 }}>
              <InspectorPanel
                programa={prog.programa}
                no={prog.selecionado}
                trilha={prog.trilha}
                // O breadcrumb e a lista de filhos daqui tambem trocam de no:
                // entram pela mesma guarda de rascunho que a arvore.
                acoes={{
                  ...prog,
                  setSelecionadoId: ctx.setSelecionadoId,
                  adicionar: ctx.adicionar,
                }}
                registro={inspetor}
                onSalvar={feedbackSalvo}
                onExcluir={pedirExclusao}
                onErro={(texto) => setToast({ texto, severidade: "error" })}
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
                  ? " Tudo o que está dentro dele será removido (os materiais continuam na Biblioteca)."
                  : ""
              } Esta ação não pode ser desfeita.`
            : ""
        }
        onConfirmar={confirmarExclusao}
        onCancelar={() => setConfirmar(null)}
      />

      {/* Rascunho por salvar barrando a troca de item */}
      <DialogRascunho
        pendente={pendente}
        onSalvar={() => resolverPendente(true)}
        onDescartar={() => resolverPendente(false)}
        onCancelar={() => setPendente(null)}
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

      {/* Quais startups fazem esta trilha */}
      <StartupsDaTrilha
        aberto={startupsAberto}
        trilha={trilhaAtiva}
        onFechar={() => setStartupsAberto(false)}
        // A contagem de startups fica no rotulo da Toolbar, entao a lista de
        // trilhas precisa ser refeita quando a turma muda.
        onMudou={prog.recarregarProgramas}
      />

      {/* Nova trilha */}
      <DialogNovaTrilha
        estado={novaTrilha}
        salvando={salvandoTrilha}
        onChange={(nome) => setNovaTrilha({ nome })}
        onCriar={criarTrilha}
        onFechar={() => setNovaTrilha(null)}
      />

      {/* Modo "Visualizar como incubada" */}
      <AnimatePresence>
        {preview && (
          <PreviewIncubada programa={prog.programa} onFechar={() => setPreview(false)} />
        )}
      </AnimatePresence>
    </AppLayout>
  )
}

/**
 * Rascunho por salvar barrando a troca de item.
 *
 * Tres saidas de proposito. Um confirma-ou-cancela obrigaria a fechar o
 * dialogo, clicar em Salvar e clicar de novo no item de destino — tres passos
 * para o caso mais comum, que e "sim, salva isso e me leva pro proximo".
 */
function DialogRascunho({ pendente, onSalvar, onDescartar, onCancelar }) {
  return (
    <Dialog open={Boolean(pendente)} onClose={onCancelar} maxWidth="xs" fullWidth>
      <DialogTitle>Alterações não salvas</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary">
          Você mexeu em <strong>{pendente?.nome}</strong> e ainda não salvou.
        </Typography>
        {pendente && !pendente.podeSalvar && (
          <Alert severity="warning" sx={{ mt: 2, borderRadius: "6px" }}>
            Do jeito que está, não dá para salvar — falta preencher um campo
            obrigatório. Volte para completar, ou descarte o que mudou.
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onCancelar} sx={{ textTransform: "none" }}>
          Voltar
        </Button>
        <Button onClick={onDescartar} color="error" sx={{ textTransform: "none" }}>
          Descartar
        </Button>
        <Button
          onClick={onSalvar}
          variant="contained"
          disabled={!pendente?.podeSalvar}
          sx={{ textTransform: "none" }}
        >
          Salvar e continuar
        </Button>
      </DialogActions>
    </Dialog>
  )
}

/**
 * Dialogo de criacao de trilha. Fica aqui (e nao em components/) porque so
 * esta tela cria trilha, e o formulario e um campo so.
 */
function DialogNovaTrilha({ estado, salvando, onChange, onCriar, onFechar }) {
  const nome = estado?.nome ?? ""
  const vazio = !nome.trim()

  return (
    <Dialog open={Boolean(estado)} onClose={onFechar} maxWidth="xs" fullWidth>
      <DialogTitle>Nova trilha</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Uma trilha nova nasce vazia. O material da Biblioteca continua o
          mesmo — as fases desta trilha podem usar os materiais que você
          já tem.
        </Typography>
        <TextField
          autoFocus
          fullWidth
          label="Nome da trilha"
          placeholder="ex.: Pré-incubação 2026"
          value={nome}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !vazio && !salvando) onCriar()
          }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onFechar} sx={{ textTransform: "none" }}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={onCriar}
          disabled={vazio || salvando}
          startIcon={salvando ? <CircularProgress size={16} /> : <Add />}
          sx={{ textTransform: "none" }}
        >
          Criar trilha
        </Button>
      </DialogActions>
    </Dialog>
  )
}
