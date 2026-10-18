/**
 * Plano de acao 5W2H como gerador de iniciativas.
 *
 * Ha tres visualizacoes:
 *   - matriz (padrao): as sete perguntas em colunas coloridas, uma acao por
 *     linha, mais uma coluna de andamento;
 *   - cards: cada acao com responsavel, prazo, status e progresso; ao
 *     expandir aparecem os detalhes (por que, como, onde, quanto custa);
 *   - linha do tempo, ordenada pelo campo "Quando".
 *
 * API (inalterada): GET/POST /startups/:id/5w2h e DELETE /startups/:id/5w2h/:id.
 * Status e progresso nao existem no backend — sao um apoio visual persistido
 * apenas neste navegador (localStorage), por startup.
 */
import { useEffect, useMemo, useState } from "react"
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  LinearProgress,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Skeleton,
  Slider,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material"
import { alpha } from "@mui/material/styles"
import AddIcon from "@mui/icons-material/Add"
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline"
import ExpandMoreIcon from "@mui/icons-material/ExpandMore"
import PersonOutlineIcon from "@mui/icons-material/PersonOutline"
import EventOutlinedIcon from "@mui/icons-material/EventOutlined"
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined"
import ViewModuleOutlinedIcon from "@mui/icons-material/ViewModuleOutlined"
import ViewWeekOutlinedIcon from "@mui/icons-material/ViewWeekOutlined"
import ViewTimelineOutlinedIcon from "@mui/icons-material/ViewTimelineOutlined"
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined"
import AutorenewOutlinedIcon from "@mui/icons-material/AutorenewOutlined"
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline"
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined"
import RocketLaunchOutlinedIcon from "@mui/icons-material/RocketLaunchOutlined"
import { motion, AnimatePresence } from "framer-motion"
import { format, isValid, parse } from "date-fns"
import { ptBR } from "date-fns/locale"
import api from "../../../services/api"
import { FONTES, MARCA, paletaDaCor } from "../../../theme"
import { DialogConfirmar, EmptyState, ToastFeedback } from "./comum"

const STATUS = {
  planejado: { rotulo: "Planejado", cor: "info", Icone: ScheduleOutlinedIcon },
  andamento: { rotulo: "Em andamento", cor: "primary", Icone: AutorenewOutlinedIcon },
  concluido: { rotulo: "Concluído", cor: "success", Icone: CheckCircleOutlineIcon },
  atrasado: { rotulo: "Atrasado", cor: "error", Icone: WarningAmberOutlinedIcon },
}

const DETALHES = [
  { chave: "por_que", rotulo: "Por quê?" },
  { chave: "como", rotulo: "Como?" },
  { chave: "onde", rotulo: "Onde?" },
  { chave: "quanto_custa", rotulo: "Quanto custa?" },
]

// As sete perguntas da matriz, na ordem classica do 5W2H. As cores seguem o
// arco do roxo ao verde, tiradas das cores do sistema (CORES_PRINCIPAIS do
// tema) e ajustadas a aparencia por paletaDaCor. A coluna se identifica pelo
// rotulo; a cor so ajuda a seguir a coluna com o olho.
const PERGUNTAS = [
  { chave: "o_que", rotulo: "O quê?", ingles: "What", dica: "O que será feito?", cor: "#9333ea" },
  { chave: "por_que", rotulo: "Por quê?", ingles: "Why", dica: "Por que essa ação é necessária?", cor: MARCA.logo.magenta },
  { chave: "onde", rotulo: "Onde?", ingles: "Where", dica: "Onde a ação acontece?", cor: "#dc2626" },
  { chave: "quando", rotulo: "Quando?", ingles: "When", dica: "Qual é o prazo?", cor: "#f97316" },
  { chave: "quem", rotulo: "Quem?", ingles: "Who", dica: "Quem é o responsável?", cor: MARCA.logo.amarelo },
  { chave: "como", rotulo: "Como?", ingles: "How", dica: "Como ela será executada?", cor: MARCA.lima },
  { chave: "quanto_custa", rotulo: "Quanto?", ingles: "How much", dica: "Quanto vai custar?", cor: MARCA.logo.verde },
]

// ---- Status/progresso locais (o backend nao persiste esses campos) ----

const chaveMeta = (idStartup) => `quiron.5w2h.meta.${idStartup}`

function lerMeta(idStartup) {
  try {
    return JSON.parse(localStorage.getItem(chaveMeta(idStartup))) || {}
  } catch {
    return {}
  }
}

function gravarMeta(idStartup, meta) {
  try {
    localStorage.setItem(chaveMeta(idStartup), JSON.stringify(meta))
  } catch {
    /* armazenamento indisponivel: o plano continua funcionando sem status */
  }
}

const metaDoItem = (meta, id) => meta[id] || { status: "planejado", progresso: 0 }

// Tenta interpretar o texto livre de "Quando" como data (para a timeline).
const FORMATOS_DATA = ["dd/MM/yyyy", "dd/MM/yy", "yyyy-MM-dd", "dd/MM"]

function analisarData(texto) {
  if (!texto) return null
  for (const formato of FORMATOS_DATA) {
    const data = parse(texto.trim(), formato, new Date())
    if (isValid(data)) return data
  }
  return null
}

export default function Plano5w2h({ idStartup }) {
  const [itens, setItens] = useState([])
  const [meta, setMeta] = useState(() => lerMeta(idStartup))
  const [visao, setVisao] = useState("matriz")
  const [carregando, setCarregando] = useState(true)
  const [aviso, setAviso] = useState(null)
  const [dialogAberto, setDialogAberto] = useState(false)
  const [excluindo, setExcluindo] = useState(null)
  const [expandidos, setExpandidos] = useState({})
  const [menuStatus, setMenuStatus] = useState(null) // { ancora, id }
  const [toast, setToast] = useState(null)

  useEffect(() => {
    setMeta(lerMeta(idStartup))
    setCarregando(true)
    api
      .get(`/startups/${idStartup}/5w2h`)
      .then(({ data }) => setItens(data.itens))
      .catch((err) => setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao carregar o 5W2H." }))
      .finally(() => setCarregando(false))
  }, [idStartup])

  const atualizarMeta = (id, mudanca) => {
    setMeta((atual) => {
      const novo = { ...atual, [id]: { ...metaDoItem(atual, id), ...mudanca } }
      gravarMeta(idStartup, novo)
      return novo
    })
  }

  const mudarStatus = (id, status) => {
    // Concluir uma acao completa o progresso; reabrir um item concluido o preserva.
    atualizarMeta(id, status === "concluido" ? { status, progresso: 100 } : { status })
    setMenuStatus(null)
    setToast({ tipo: "success", texto: `Status atualizado para "${STATUS[status].rotulo}".` })
  }

  const mudarProgresso = (id, progresso) => {
    const status = metaDoItem(meta, id).status
    const mudanca = { progresso }
    // Progresso cheio conclui; voltar atras reabre como "em andamento".
    if (progresso === 100) mudanca.status = "concluido"
    else if (status === "concluido") mudanca.status = "andamento"
    else if (progresso > 0 && status === "planejado") mudanca.status = "andamento"
    atualizarMeta(id, mudanca)
  }

  const confirmarExclusao = async () => {
    const item = excluindo
    setExcluindo(null)
    try {
      await api.delete(`/startups/${idStartup}/5w2h/${item.id_5w2h}`)
      setItens((lista) => lista.filter((i) => i.id_5w2h !== item.id_5w2h))
      setToast({ tipo: "success", texto: "Ação removida do plano." })
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao excluir o item." })
    }
  }

  const concluidas = itens.filter((i) => metaDoItem(meta, i.id_5w2h).status === "concluido").length

  return (
    <Box>
      {aviso && (
        <Alert severity={aviso.tipo} sx={{ mb: 2 }} onClose={() => setAviso(null)}>
          {aviso.texto}
        </Alert>
      )}

      {/* Cabecalho */}
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, mb: 2, flexWrap: "wrap" }}>
        <Box sx={{ flex: 1, minWidth: 240 }}>
          <Typography variant="subtitle1" fontWeight={700}>
            Plano de ação da sua startup
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Transforme intenções em iniciativas: o quê, quem, quando — e acompanhe o andamento.
            {itens.length > 0 && ` ${concluidas} de ${itens.length} concluídas.`}
          </Typography>
        </Box>
        <ToggleButtonGroup
          value={visao}
          exclusive
          size="small"
          onChange={(_, v) => v && setVisao(v)}
          sx={{ "& .MuiToggleButton-root": { textTransform: "none", px: 1.5 } }}
        >
          <ToggleButton value="matriz" aria-label="Modo matriz">
            <ViewWeekOutlinedIcon sx={{ fontSize: 18, mr: 0.5 }} /> Matriz
          </ToggleButton>
          <ToggleButton value="cards" aria-label="Modo cards">
            <ViewModuleOutlinedIcon sx={{ fontSize: 18, mr: 0.5 }} /> Cards
          </ToggleButton>
          <ToggleButton value="timeline" aria-label="Modo linha do tempo">
            <ViewTimelineOutlinedIcon sx={{ fontSize: 18, mr: 0.5 }} /> Timeline
          </ToggleButton>
        </ToggleButtonGroup>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogAberto(true)} sx={{ textTransform: "none" }}>
          Nova ação
        </Button>
      </Box>

      {carregando ? (
        <PlanoSkeleton />
      ) : itens.length === 0 ? (
        <EmptyState
          icone={RocketLaunchOutlinedIcon}
          titulo="Você ainda não criou nenhuma ação"
          descricao="Comece criando a primeira iniciativa da sua startup: o que precisa ser feito, por quem e até quando."
          rotuloAcao="Criar ação"
          onAcao={() => setDialogAberto(true)}
        />
      ) : visao === "matriz" ? (
        <MatrizAcoes
          itens={itens}
          meta={meta}
          onAbrirStatus={(ancora, id) => setMenuStatus({ ancora, id })}
          onExcluir={setExcluindo}
          onNova={() => setDialogAberto(true)}
        />
      ) : visao === "cards" ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          <AnimatePresence>
            {itens.map((item) => (
              <CardAcao
                key={item.id_5w2h}
                item={item}
                meta={metaDoItem(meta, item.id_5w2h)}
                expandido={Boolean(expandidos[item.id_5w2h])}
                onExpandir={() => setExpandidos((e) => ({ ...e, [item.id_5w2h]: !e[item.id_5w2h] }))}
                onAbrirStatus={(ancora) => setMenuStatus({ ancora, id: item.id_5w2h })}
                onProgresso={(v) => mudarProgresso(item.id_5w2h, v)}
                onExcluir={() => setExcluindo(item)}
              />
            ))}
          </AnimatePresence>
        </Box>
      ) : (
        <TimelineAcoes itens={itens} meta={meta} />
      )}

      {/* Menu de troca de status */}
      <Menu anchorEl={menuStatus?.ancora} open={Boolean(menuStatus)} onClose={() => setMenuStatus(null)}>
        {Object.entries(STATUS).map(([valor, s]) => (
          <MenuItem key={valor} dense onClick={() => mudarStatus(menuStatus.id, valor)}>
            <ListItemIcon>
              <s.Icone fontSize="small" sx={{ color: `${s.cor}.main` }} />
            </ListItemIcon>
            <ListItemText>{s.rotulo}</ListItemText>
          </MenuItem>
        ))}
      </Menu>

      <DialogNovaAcao
        aberto={dialogAberto}
        idStartup={idStartup}
        onFechar={() => setDialogAberto(false)}
        onCriado={(novo) => {
          setDialogAberto(false)
          setItens((lista) => [...lista, novo])
          setToast({ tipo: "success", texto: "Ação adicionada ao plano." })
        }}
      />

      <DialogConfirmar
        aberto={Boolean(excluindo)}
        titulo="Excluir ação?"
        descricao={excluindo ? `"${excluindo.o_que}" será removida do plano de ação.` : ""}
        onConfirmar={confirmarExclusao}
        onCancelar={() => setExcluindo(null)}
      />

      <ToastFeedback toast={toast} onFechar={() => setToast(null)} />
    </Box>
  )
}

function ChipStatus({ meta, onAbrir, tamanho = "small" }) {
  const s = STATUS[meta.status] || STATUS.planejado
  return (
    <Tooltip title="Clique para mudar o status">
      <Chip
        size={tamanho}
        icon={<s.Icone sx={{ fontSize: 15 }} />}
        label={s.rotulo}
        color={s.cor}
        variant="outlined"
        onClick={onAbrir}
        sx={{ fontWeight: 600 }}
      />
    </Tooltip>
  )
}

function CardAcao({ item, meta, expandido, onExpandir, onAbrirStatus, onProgresso, onExcluir }) {
  return (
    <Paper
      component={motion.div}
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      variant="outlined"
      sx={{
        borderRadius: 0,
        overflow: "hidden",
        transition: "box-shadow .2s ease",
        "&:hover": { boxShadow: (t) => t.shadows[2] },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, p: 2, pb: 1.5, flexWrap: "wrap" }}>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ lineHeight: 1.3 }}>
            {item.o_que}
          </Typography>
          <Box sx={{ display: "flex", gap: 2, mt: 0.5, flexWrap: "wrap" }}>
            {item.quem && (
              <Typography variant="caption" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <PersonOutlineIcon sx={{ fontSize: 15 }} /> {item.quem}
              </Typography>
            )}
            {item.quando && (
              <Typography variant="caption" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <EventOutlinedIcon sx={{ fontSize: 15 }} /> {item.quando}
              </Typography>
            )}
            {item.quanto_custa && (
              <Typography variant="caption" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <PaidOutlinedIcon sx={{ fontSize: 15 }} /> {item.quanto_custa}
              </Typography>
            )}
          </Box>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <ChipStatus meta={meta} onAbrir={(e) => onAbrirStatus(e.currentTarget)} />
          <Tooltip title="Excluir ação">
            <IconButton size="small" onClick={onExcluir} sx={{ color: "text.disabled", "&:hover": { color: "error.main" } }}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={expandido ? "Recolher detalhes" : "Ver detalhes"}>
            <IconButton
              size="small"
              onClick={onExpandir}
              aria-label={expandido ? "Recolher detalhes" : "Ver detalhes"}
              sx={{ transform: expandido ? "rotate(180deg)" : "none", transition: "transform .2s ease" }}
            >
              <ExpandMoreIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Progresso */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 2, pb: expandido ? 1 : 2 }}>
        <LinearProgress
          variant="determinate"
          value={meta.progresso}
          color={meta.status === "concluido" ? "success" : "primary"}
          sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: (t) => alpha(t.palette.primary.main, 0.08) }}
        />
        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ width: 34, textAlign: "right" }}>
          {meta.progresso}%
        </Typography>
      </Box>

      <Collapse in={expandido} timeout={200}>
        <Divider />
        <Grid container spacing={2} sx={{ p: 2 }}>
          {DETALHES.map((d) => (
            <Grid item xs={12} sm={6} key={d.chave}>
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.4 }}>
                {d.rotulo}
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.25, whiteSpace: "pre-wrap" }} color={item[d.chave] ? "text.primary" : "text.disabled"}>
                {item[d.chave] || "Não definido"}
              </Typography>
            </Grid>
          ))}
          <Grid item xs={12}>
            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.4 }}>
              Atualizar progresso
            </Typography>
            <Slider
              size="small"
              value={meta.progresso}
              step={5}
              valueLabelDisplay="auto"
              valueLabelFormat={(v) => `${v}%`}
              onChange={(_, v) => onProgresso(v)}
              sx={{ mt: 0.5, maxWidth: 320, display: "block" }}
            />
          </Grid>
        </Grid>
      </Collapse>
    </Paper>
  )
}

// Molde das colunas: as sete perguntas dividem a largura e o andamento tem
// largura fixa. Cada linha e uma grade propria com este mesmo molde — como
// nenhuma coluna mede pelo conteudo, as linhas ficam alinhadas entre si e
// cada uma pode entrar e sair animada. Abaixo da largura minima, a matriz
// rola na horizontal em vez de espremer o texto.
const COLUNA_MIN = 132
const COLUNA_ANDAMENTO = 196
const MOLDE_MATRIZ = `repeat(${PERGUNTAS.length}, minmax(${COLUNA_MIN}px, 1fr)) ${COLUNA_ANDAMENTO}px`
const LARGURA_MIN_MATRIZ = PERGUNTAS.length * COLUNA_MIN + COLUNA_ANDAMENTO + PERGUNTAS.length
const LINHA_SX = { display: "grid", gridTemplateColumns: MOLDE_MATRIZ, gap: "1px" }

/**
 * Estilo do cabecalho de uma pergunta. No claro, a coluna e preenchida com a
 * cor viva e o texto de maior contraste (o lima leva preto, o roxo leva
 * branco), como o botao principal do tema. No escuro, a cor viva numa faixa
 * larga ofuscaria: o cabecalho vira um tom escuro da cor com a faixa de cima
 * acesa, como a barra do topo.
 */
function estiloCabecalho(paleta, escuro) {
  if (escuro) {
    const veu = alpha(paleta.main, 0.3)
    return {
      fundo: { bgcolor: "background.paper", backgroundImage: `linear-gradient(${veu}, ${veu})`, boxShadow: `inset 0 3px 0 ${paleta.main}` },
      texto: "text.primary",
      ingles: paleta.main,
      marca: alpha(paleta.main, 0.2),
    }
  }
  return {
    fundo: { bgcolor: paleta.vivo },
    texto: paleta.vivoContraste,
    ingles: alpha(paleta.vivoContraste, 0.8),
    marca: alpha(paleta.vivoContraste, 0.16),
  }
}

function MatrizAcoes({ itens, meta, onAbrirStatus, onExcluir, onNova }) {
  const tema = useTheme()
  const escuro = tema.palette.mode === "dark"
  const colunas = useMemo(
    () =>
      PERGUNTAS.map((p) => {
        const paleta = paletaDaCor(p.cor, escuro)
        // O veu das celulas sai da cor crua no claro (pastel, como post-its) e
        // do `main` clareado no escuro, onde a cor crua some sobre o preto.
        const tinta = escuro ? paleta.main : p.cor
        return {
          ...p,
          cabecalho: estiloCabecalho(paleta, escuro),
          veu: alpha(tinta, escuro ? 0.1 : 0.13),
          veuForte: alpha(tinta, escuro ? 0.17 : 0.22),
        }
      }),
    [escuro]
  )
  const realceNeutro = alpha(tema.palette.text.primary, 0.04)

  return (
    <Box sx={{ overflowX: "auto", border: 1, borderColor: "divider" }}>
      <Box sx={{ minWidth: LARGURA_MIN_MATRIZ, display: "flex", flexDirection: "column", gap: "1px", bgcolor: "divider" }}>
        <Box role="table" aria-label="Matriz 5W2H" sx={{ display: "flex", flexDirection: "column", gap: "1px" }}>
          <Box role="row" sx={LINHA_SX}>
            {colunas.map((c) => (
              <CabecalhoMatriz key={c.chave} rotulo={c.rotulo} ingles={c.ingles} dica={c.dica} estilo={c.cabecalho} />
            ))}
            <CabecalhoMatriz
              rotulo="Andamento"
              ingles="Status"
              estilo={{ fundo: { bgcolor: "background.paper" }, texto: "text.primary", ingles: "text.secondary" }}
            />
          </Box>

          <AnimatePresence initial={false}>
            {itens.map((item) => (
              <Box
                key={item.id_5w2h}
                role="row"
                className="linha-5w2h"
                component={motion.div}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                sx={LINHA_SX}
              >
                {colunas.map((c) => (
                  <CelulaMatriz key={c.chave} valor={item[c.chave]} veu={c.veu} veuForte={c.veuForte} destaque={c.chave === "o_que"} />
                ))}
                <CelulaAndamento
                  meta={metaDoItem(meta, item.id_5w2h)}
                  realce={realceNeutro}
                  onAbrirStatus={(e) => onAbrirStatus(e.currentTarget, item.id_5w2h)}
                  onExcluir={() => onExcluir(item)}
                />
              </Box>
            ))}
          </AnimatePresence>
        </Box>

        <Button
          startIcon={<AddIcon />}
          onClick={onNova}
          sx={{
            justifyContent: "flex-start",
            textTransform: "none",
            borderRadius: 0,
            px: 1.5,
            py: 1.25,
            color: "text.secondary",
            bgcolor: "background.paper",
            "&:hover": { bgcolor: "background.paper", color: "primary.main" },
          }}
        >
          Nova ação
        </Button>
      </Box>
    </Box>
  )
}

function CabecalhoMatriz({ rotulo, ingles, dica, estilo }) {
  const cabecalho = (
    <Box
      role="columnheader"
      sx={{ position: "relative", overflow: "hidden", px: 1.5, pt: 1.5, pb: 1.75, color: estilo.texto, ...estilo.fundo }}
    >
      {/* O "?" gigante ao fundo, como no quadro classico do 5W2H. */}
      {estilo.marca && (
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            right: 6,
            top: -14,
            fontFamily: FONTES.titulo,
            fontSize: 92,
            lineHeight: 1,
            color: estilo.marca,
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          ?
        </Box>
      )}
      <Typography variant="overline" sx={{ position: "relative", display: "block", fontSize: 10, lineHeight: 1.6, color: estilo.ingles }}>
        {ingles}
      </Typography>
      <Typography variant="h5" component="span" sx={{ position: "relative", display: "block", fontSize: 22 }}>
        {rotulo}
      </Typography>
    </Box>
  )
  // describeChild: a dica descreve o cabecalho sem tomar o lugar do nome dele.
  return dica ? (
    <Tooltip title={dica} placement="top" describeChild>
      {cabecalho}
    </Tooltip>
  ) : (
    cabecalho
  )
}

// O veu vai como gradiente sobre o papel, e nao como cor translucida: atras
// das celulas esta o cinza das linhas da grade, que tingiria tudo.
function CelulaMatriz({ valor, veu, veuForte, destaque }) {
  return (
    <Box
      role="cell"
      sx={{
        p: 1.5,
        minWidth: 0,
        bgcolor: "background.paper",
        backgroundImage: `linear-gradient(${veu}, ${veu})`,
        ".linha-5w2h:hover &": { backgroundImage: `linear-gradient(${veuForte}, ${veuForte})` },
      }}
    >
      <Typography
        variant="body2"
        fontWeight={destaque ? 700 : 400}
        color={valor ? "text.primary" : "text.disabled"}
        sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.55 }}
      >
        {valor || "—"}
      </Typography>
    </Box>
  )
}

function CelulaAndamento({ meta, realce, onAbrirStatus, onExcluir }) {
  return (
    <Box
      role="cell"
      sx={{
        p: 1.5,
        display: "flex",
        flexDirection: "column",
        gap: 1.25,
        bgcolor: "background.paper",
        ".linha-5w2h:hover &": { backgroundImage: `linear-gradient(${realce}, ${realce})` },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <ChipStatus meta={meta} onAbrir={onAbrirStatus} />
        <Tooltip title="Excluir ação">
          <IconButton
            size="small"
            onClick={onExcluir}
            aria-label="Excluir ação"
            sx={{ ml: "auto", color: "text.disabled", "&:hover": { color: "error.main" } }}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <LinearProgress
          variant="determinate"
          value={meta.progresso}
          color={meta.status === "concluido" ? "success" : "primary"}
          aria-label="Progresso da ação"
          sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: (t) => alpha(t.palette.primary.main, 0.08) }}
        />
        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ width: 32, textAlign: "right" }}>
          {meta.progresso}%
        </Typography>
      </Box>
    </Box>
  )
}

function TimelineAcoes({ itens, meta }) {
  // Ordena por data interpretada do campo "Quando"; itens sem data vao ao fim.
  const ordenados = useMemo(() => {
    return itens
      .map((item) => ({ item, data: analisarData(item.quando) }))
      .sort((a, b) => {
        if (a.data && b.data) return a.data - b.data
        if (a.data) return -1
        if (b.data) return 1
        return 0
      })
  }, [itens])

  return (
    <Box sx={{ pl: 1 }}>
      {ordenados.map(({ item, data }, i) => {
        const s = STATUS[metaDoItem(meta, item.id_5w2h).status] || STATUS.planejado
        const ultimo = i === ordenados.length - 1
        return (
          <Box key={item.id_5w2h} sx={{ display: "flex", gap: 2 }}>
            {/* Trilho: ponto colorido por status + linha vertical */}
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", pt: 0.75 }}>
              <Box
                sx={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  flexShrink: 0,
                  bgcolor: `${s.cor}.main`,
                  boxShadow: (t) => `0 0 0 3px ${alpha(t.palette[s.cor].main, 0.2)}`,
                }}
              />
              {!ultimo && <Box sx={{ width: 2, flex: 1, bgcolor: "divider", my: 0.5 }} />}
            </Box>

            <Box sx={{ pb: ultimo ? 0 : 3, flex: 1, minWidth: 0 }}>
              <Typography variant="caption" fontWeight={700} color="text.secondary">
                {data ? format(data, "dd 'de' MMMM", { locale: ptBR }) : item.quando || "Sem data definida"}
              </Typography>
              <Paper variant="outlined" sx={{ borderRadius: 0, p: 1.5, mt: 0.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                  <Typography variant="body2" fontWeight={700} sx={{ flex: 1, minWidth: 140 }}>
                    {item.o_que}
                  </Typography>
                  <Chip size="small" icon={<s.Icone sx={{ fontSize: 14 }} />} label={s.rotulo} color={s.cor} variant="outlined" />
                </Box>
                {item.quem && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5 }}>
                    <PersonOutlineIcon sx={{ fontSize: 14 }} /> {item.quem}
                  </Typography>
                )}
              </Paper>
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}

function DialogNovaAcao({ aberto, idStartup, onFechar, onCriado }) {
  const FORM_VAZIO = { o_que: "", por_que: "", onde: "", quando: "", quem: "", como: "", quanto_custa: "" }
  const [form, setForm] = useState(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState(null)

  const alterar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }))

  const salvar = async (e) => {
    e.preventDefault()
    setSalvando(true)
    setAviso(null)
    try {
      const { data } = await api.post(`/startups/${idStartup}/5w2h`, form)
      setForm(FORM_VAZIO)
      onCriado(data.item)
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao criar o item." })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={aberto} onClose={onFechar} maxWidth="sm" fullWidth>
      <Box component="form" onSubmit={salvar}>
        <DialogTitle sx={{ fontWeight: 700 }}>Qual a próxima ação da sua startup?</DialogTitle>
        <DialogContent dividers>
          {aviso && (
            <Alert severity={aviso.tipo} sx={{ mb: 2 }} onClose={() => setAviso(null)}>
              {aviso.texto}
            </Alert>
          )}

          <Typography variant="caption" fontWeight={700} color="primary.main" sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
            O essencial
          </Typography>
          <Grid container spacing={2} sx={{ mt: 0, mb: 2.5 }}>
            <Grid item xs={12}>
              <TextField
                label="O que será feito?"
                placeholder="Ex.: Criar landing page de captação"
                fullWidth
                required
                autoFocus
                value={form.o_que}
                onChange={alterar("o_que")}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Quem é o responsável?" placeholder="Ex.: João" fullWidth value={form.quem} onChange={alterar("quem")} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Quando? (prazo)"
                placeholder="Ex.: 15/08/2026"
                fullWidth
                value={form.quando}
                onChange={alterar("quando")}
                helperText="Use dd/mm/aaaa para aparecer na timeline"
              />
            </Grid>
          </Grid>

          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
            Detalhes do plano (opcional)
          </Typography>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12}>
              <TextField
                label="Por quê?"
                placeholder="Ex.: Validar o interesse antes de investir no app"
                fullWidth
                multiline
                minRows={2}
                value={form.por_que}
                onChange={alterar("por_que")}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Como?"
                placeholder="Ex.: Construtor de páginas + formulário de cadastro"
                fullWidth
                multiline
                minRows={2}
                value={form.como}
                onChange={alterar("como")}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Onde?" placeholder="Ex.: Online — site da startup" fullWidth value={form.onde} onChange={alterar("onde")} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Quanto custa?"
                placeholder="Ex.: R$ 300"
                fullWidth
                value={form.quanto_custa}
                onChange={alterar("quanto_custa")}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onFechar} sx={{ textTransform: "none" }}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={salvando} sx={{ textTransform: "none", px: 3 }}>
            {salvando ? <CircularProgress size={22} color="inherit" /> : "Criar ação"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}

function PlanoSkeleton() {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} variant="rounded" height={104} />
      ))}
    </Box>
  )
}
