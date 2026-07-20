/**
 * Plano de acao 5W2H como gerador de iniciativas.
 *
 * Cada acao vira um card com responsavel, prazo, status e progresso; ao
 * expandir aparecem os detalhes (por que, como, onde, quanto custa). Ha tres
 * visualizacoes: cards, tabela e linha do tempo.
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material"
import { alpha } from "@mui/material/styles"
import AddIcon from "@mui/icons-material/Add"
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline"
import ExpandMoreIcon from "@mui/icons-material/ExpandMore"
import PersonOutlineIcon from "@mui/icons-material/PersonOutline"
import EventOutlinedIcon from "@mui/icons-material/EventOutlined"
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined"
import ViewModuleOutlinedIcon from "@mui/icons-material/ViewModuleOutlined"
import TableRowsOutlinedIcon from "@mui/icons-material/TableRowsOutlined"
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
  const [visao, setVisao] = useState("cards")
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
          <ToggleButton value="cards" aria-label="Modo cards">
            <ViewModuleOutlinedIcon sx={{ fontSize: 18, mr: 0.5 }} /> Cards
          </ToggleButton>
          <ToggleButton value="tabela" aria-label="Modo tabela">
            <TableRowsOutlinedIcon sx={{ fontSize: 18, mr: 0.5 }} /> Tabela
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
      ) : visao === "tabela" ? (
        <TabelaAcoes itens={itens} meta={meta} onAbrirStatus={(ancora, id) => setMenuStatus({ ancora, id })} onExcluir={setExcluindo} />
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

function TabelaAcoes({ itens, meta, onAbrirStatus, onExcluir }) {
  const colunas = [
    { chave: "o_que", rotulo: "O que" },
    { chave: "quem", rotulo: "Quem" },
    { chave: "quando", rotulo: "Quando" },
    { chave: "por_que", rotulo: "Por quê" },
    { chave: "como", rotulo: "Como" },
    { chave: "onde", rotulo: "Onde" },
    { chave: "quanto_custa", rotulo: "Quanto custa" },
  ]
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 0 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            {colunas.map((c) => (
              <TableCell key={c.chave} sx={{ fontWeight: 700 }}>
                {c.rotulo}
              </TableCell>
            ))}
            <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
            <TableCell align="center" width={64}>
              Ações
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {itens.map((item) => (
            <TableRow key={item.id_5w2h} hover>
              {colunas.map((c) => (
                <TableCell key={c.chave} sx={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item[c.chave] || "—"}
                </TableCell>
              ))}
              <TableCell>
                <ChipStatus meta={metaDoItem(meta, item.id_5w2h)} onAbrir={(e) => onAbrirStatus(e.currentTarget, item.id_5w2h)} />
              </TableCell>
              <TableCell align="center">
                <Tooltip title="Excluir">
                  <IconButton size="small" onClick={() => onExcluir(item)} sx={{ color: "text.disabled", "&:hover": { color: "error.main" } }}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
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
