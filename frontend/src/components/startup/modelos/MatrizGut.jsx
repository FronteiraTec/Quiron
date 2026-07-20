/**
 * Matriz GUT guiada.
 *
 * Cada problema vira um card com notas em estrelas (Gravidade, Urgencia,
 * Tendencia), prioridade calculada (G x U x T, 1 a 125) com faixa de cor,
 * ranking com medalhas e um grafico de barras com a distribuicao das
 * prioridades. A criacao usa estrelas com legendas e mostra a prioridade
 * em tempo real.
 *
 * API (inalterada): GET/POST /startups/:id/gut e DELETE /startups/:id/gut/:idGut.
 */
import { useEffect, useMemo, useState } from "react"
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Popover,
  Rating,
  Skeleton,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material"
import { alpha } from "@mui/material/styles"
import AddIcon from "@mui/icons-material/Add"
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline"
import HelpOutlineIcon from "@mui/icons-material/HelpOutline"
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined"
import { motion, AnimatePresence } from "framer-motion"
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts"
import api from "../../../services/api"
import { DialogConfirmar, EmptyState, ToastFeedback, faixaPrioridade, legendaFaixas } from "./comum"

const CRITERIOS = [
  {
    chave: "gravidade",
    rotulo: "Gravidade",
    pergunta: "Qual o impacto se nada for feito?",
    niveis: ["Muito leve", "Leve", "Moderada", "Grave", "Gravíssima"],
  },
  {
    chave: "urgencia",
    rotulo: "Urgência",
    pergunta: "Quanto tempo você tem para agir?",
    niveis: ["Pode esperar", "Pouco urgente", "Média", "Urgente", "Ação imediata"],
  },
  {
    chave: "tendencia",
    rotulo: "Tendência",
    pergunta: "O problema piora com o tempo?",
    niveis: ["Estável", "Piora devagar", "Vai piorar", "Piora rápido", "Piora muito rápido"],
  },
]

export default function MatrizGut({ idStartup }) {
  const [itens, setItens] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [aviso, setAviso] = useState(null)
  const [dialogAberto, setDialogAberto] = useState(false)
  const [excluindo, setExcluindo] = useState(null) // item aguardando confirmacao
  const [ajudaAncora, setAjudaAncora] = useState(null)
  const [toast, setToast] = useState(null)
  const tema = useTheme()

  const carregar = async () => {
    setCarregando(true)
    try {
      const { data } = await api.get(`/startups/${idStartup}/gut`)
      setItens(data.itens)
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao carregar a matriz GUT." })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idStartup])

  const confirmarExclusao = async () => {
    const item = excluindo
    setExcluindo(null)
    try {
      await api.delete(`/startups/${idStartup}/gut/${item.id_gut}`)
      setItens((lista) => lista.filter((i) => i.id_gut !== item.id_gut))
      setToast({ tipo: "success", texto: "Problema removido." })
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao excluir o item." })
    }
  }

  // O backend ja ordena por prioridade, mas reordenamos por garantia.
  const ordenados = useMemo(() => [...itens].sort((a, b) => b.prioridade - a.prioridade), [itens])
  const faixas = legendaFaixas(tema.palette.mode)

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
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Typography variant="subtitle1" fontWeight={700}>
              Priorize os problemas da sua startup
            </Typography>
            <Tooltip title="Como funciona a matriz GUT?">
              <IconButton size="small" onClick={(e) => setAjudaAncora(e.currentTarget)} sx={{ color: "text.disabled" }}>
                <HelpOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Dê notas de 1 a 5 para Gravidade, Urgência e Tendência — a prioridade (G × U × T) mostra o que atacar primeiro.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogAberto(true)} sx={{ textTransform: "none" }}>
          Novo problema
        </Button>
      </Box>

      {/* Legenda das faixas de prioridade */}
      {ordenados.length > 0 && (
        <Box sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap" }}>
          {faixas.map((f) => (
            <Chip
              key={f.rotulo}
              size="small"
              variant="outlined"
              label={`${f.intervalo} · ${f.rotulo}`}
              sx={{
                borderColor: alpha(f.cor, 0.5),
                color: "text.secondary",
                "& .MuiChip-label": { display: "flex", alignItems: "center", gap: 0.5 },
              }}
              icon={<Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: f.cor, ml: 1 }} />}
            />
          ))}
        </Box>
      )}

      {carregando ? (
        <GutSkeleton />
      ) : ordenados.length === 0 ? (
        <EmptyState
          icone={ReportProblemOutlinedIcon}
          titulo="Nenhum problema priorizado ainda"
          descricao="Liste os problemas que tiram o sono da sua startup e descubra, com a matriz GUT, qual deles resolver primeiro."
          rotuloAcao="Adicionar primeiro problema"
          onAcao={() => setDialogAberto(true)}
        />
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          <AnimatePresence>
            {ordenados.map((item, i) => (
              <CardProblema
                key={item.id_gut}
                item={item}
                posicao={i}
                modo={tema.palette.mode}
                onExcluir={() => setExcluindo(item)}
              />
            ))}
          </AnimatePresence>

          {ordenados.length >= 2 && <GraficoPrioridades itens={ordenados} modo={tema.palette.mode} />}
        </Box>
      )}

      {/* Popover "como funciona" */}
      <Popover
        open={Boolean(ajudaAncora)}
        anchorEl={ajudaAncora}
        onClose={() => setAjudaAncora(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        slotProps={{ paper: { sx: { maxWidth: 380, p: 2.5, borderRadius: 3 } } }}
      >
        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
          Como funciona a matriz GUT
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          A GUT ajuda a decidir o que resolver primeiro quando tudo parece urgente. Para cada problema, você dá três notas de 1 a 5:
        </Typography>
        {CRITERIOS.map((c) => (
          <Typography key={c.chave} variant="caption" component="p" sx={{ mb: 0.75, lineHeight: 1.6 }}>
            <strong>{c.rotulo}:</strong> {c.pergunta} (1 = {c.niveis[0].toLowerCase()}, 5 = {c.niveis[4].toLowerCase()})
          </Typography>
        ))}
        <Typography variant="caption" component="p" color="text.secondary" sx={{ mt: 1 }}>
          A prioridade é a multiplicação das três notas (máximo 125). Comece sempre pelos problemas no topo da lista.
        </Typography>
      </Popover>

      <DialogNovoProblema
        aberto={dialogAberto}
        idStartup={idStartup}
        modo={tema.palette.mode}
        onFechar={() => setDialogAberto(false)}
        onCriado={(novo) => {
          setDialogAberto(false)
          setItens((lista) => [...lista, novo])
          setToast({ tipo: "success", texto: "Problema adicionado à matriz." })
        }}
      />

      <DialogConfirmar
        aberto={Boolean(excluindo)}
        titulo="Excluir problema?"
        descricao={excluindo ? `"${excluindo.problema}" será removido da matriz GUT.` : ""}
        onConfirmar={confirmarExclusao}
        onCancelar={() => setExcluindo(null)}
      />

      <ToastFeedback toast={toast} onFechar={() => setToast(null)} />
    </Box>
  )
}

function CardProblema({ item, posicao, modo, onExcluir }) {
  const faixa = faixaPrioridade(item.prioridade, modo)
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
        display: "flex",
        alignItems: "center",
        gap: 2,
        p: 2,
        borderRadius: 0,
        borderLeft: `4px solid ${faixa.cor}`,
        flexWrap: { xs: "wrap", sm: "nowrap" },
        transition: "box-shadow .2s ease",
        "&:hover": { boxShadow: (t) => t.shadows[2] },
      }}
    >
      {/* Ranking */}
      <Box sx={{ width: 36, textAlign: "center", flexShrink: 0 }}>
        <Typography
          variant="subtitle2"
          fontWeight={700}
          color={posicao < 3 ? "primary.main" : "text.disabled"}
        >
          {posicao + 1}º
        </Typography>
      </Box>

      {/* Problema + notas */}
      <Box sx={{ flex: 1, minWidth: 200 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.75, lineHeight: 1.3 }}>
          {item.problema}
        </Typography>
        <Box sx={{ display: "flex", gap: 2.5, flexWrap: "wrap" }}>
          {CRITERIOS.map((c) => (
            <Tooltip key={c.chave} title={`${c.rotulo}: ${c.niveis[item[c.chave] - 1] || item[c.chave]}`}>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.2 }}>
                  {c.rotulo}
                </Typography>
                <Rating value={item[c.chave]} readOnly size="small" />
              </Box>
            </Tooltip>
          ))}
        </Box>
      </Box>

      {/* Prioridade */}
      <Box sx={{ textAlign: "center", minWidth: 92, flexShrink: 0 }}>
        <Typography variant="h4" fontWeight={800} sx={{ color: faixa.cor, lineHeight: 1 }}>
          {item.prioridade}
        </Typography>
        <Chip
          size="small"
          label={`Prioridade ${faixa.rotulo.toLowerCase()}`}
          sx={{ mt: 0.5, bgcolor: alpha(faixa.cor, 0.12), color: faixa.cor, fontWeight: 600 }}
        />
      </Box>

      <Tooltip title="Excluir problema">
        <IconButton size="small" onClick={onExcluir} sx={{ color: "text.disabled", "&:hover": { color: "error.main" } }}>
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Paper>
  )
}

/**
 * Grafico de barras horizontais "Problemas por prioridade".
 * Barras finas com ponta arredondada, rotulo de valor direto em cada barra
 * (a cor da faixa nunca e o unico canal) e tooltip com as tres notas.
 */
function GraficoPrioridades({ itens, modo }) {
  const tema = useTheme()
  const dados = itens.map((i) => ({
    ...i,
    nome: i.problema.length > 24 ? `${i.problema.slice(0, 24)}…` : i.problema,
    cor: faixaPrioridade(i.prioridade, modo).cor,
  }))
  const altura = 32 + dados.length * 34

  return (
    <Paper variant="outlined" sx={{ borderRadius: 0, p: 2, mt: 0.5 }}>
      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.25 }}>
        Problemas por prioridade
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
        Compare de uma vez só o tamanho de cada prioridade (G × U × T, máx. 125).
      </Typography>
      <ResponsiveContainer width="100%" height={altura}>
        <BarChart data={dados} layout="vertical" margin={{ top: 0, right: 42, left: 0, bottom: 0 }}>
          <XAxis type="number" domain={[0, 125]} hide />
          <YAxis
            type="category"
            dataKey="nome"
            width={170}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: tema.palette.text.secondary }}
          />
          <RechartsTooltip
            cursor={{ fill: alpha(tema.palette.primary.main, 0.06) }}
            content={<TooltipGut modo={modo} />}
          />
          <Bar dataKey="prioridade" barSize={14} radius={[0, 4, 4, 0]}>
            {dados.map((d) => (
              <Cell key={d.id_gut} fill={d.cor} />
            ))}
            <LabelList
              dataKey="prioridade"
              position="right"
              style={{ fill: tema.palette.text.primary, fontSize: 12, fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Paper>
  )
}

function TooltipGut({ active, payload, modo }) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload
  const faixa = faixaPrioridade(item.prioridade, modo)
  return (
    <Paper elevation={4} sx={{ p: 1.5, borderRadius: 2, maxWidth: 260 }}>
      <Typography variant="caption" fontWeight={700} component="p" sx={{ mb: 0.5 }}>
        {item.problema}
      </Typography>
      <Typography variant="caption" color="text.secondary" component="p">
        Gravidade {item.gravidade} · Urgência {item.urgencia} · Tendência {item.tendencia}
      </Typography>
      <Typography variant="caption" component="p" sx={{ color: faixa.cor, fontWeight: 700 }}>
        Prioridade {item.prioridade} — {faixa.rotulo}
      </Typography>
    </Paper>
  )
}

function DialogNovoProblema({ aberto, idStartup, modo, onFechar, onCriado }) {
  const FORM_VAZIO = { problema: "", gravidade: 3, urgencia: 3, tendencia: 3 }
  const [form, setForm] = useState(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState(null)

  const prioridade = form.gravidade * form.urgencia * form.tendencia
  const faixa = faixaPrioridade(prioridade, modo)

  const salvar = async (e) => {
    e.preventDefault()
    setSalvando(true)
    setAviso(null)
    try {
      const { data } = await api.post(`/startups/${idStartup}/gut`, form)
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
        <DialogTitle sx={{ fontWeight: 700 }}>Qual problema está travando sua startup?</DialogTitle>
        <DialogContent dividers>
          {aviso && (
            <Alert severity={aviso.tipo} sx={{ mb: 2 }} onClose={() => setAviso(null)}>
              {aviso.texto}
            </Alert>
          )}
          <TextField
            label="Problema"
            placeholder="Ex.: Baixa retenção de clientes"
            fullWidth
            required
            autoFocus
            value={form.problema}
            onChange={(e) => setForm((f) => ({ ...f, problema: e.target.value }))}
            sx={{ mb: 3 }}
          />

          {CRITERIOS.map((c) => (
            <Box key={c.chave} sx={{ mb: 2.5 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap" }}>
                <Typography variant="subtitle2" fontWeight={700}>
                  {c.rotulo}
                </Typography>
                <Typography variant="caption" color="primary.main" fontWeight={600}>
                  {c.niveis[form[c.chave] - 1]}
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                {c.pergunta}
              </Typography>
              <Rating
                value={form[c.chave]}
                size="large"
                onChange={(_, valor) => valor && setForm((f) => ({ ...f, [c.chave]: valor }))}
              />
            </Box>
          ))}

          {/* Previa da prioridade em tempo real */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              p: 1.5,
              borderRadius: 2,
              bgcolor: alpha(faixa.cor, 0.08),
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Prioridade (G × U × T)
            </Typography>
            <Typography variant="h5" fontWeight={800} sx={{ color: faixa.cor }}>
              {prioridade} <Typography component="span" variant="body2" fontWeight={700} sx={{ color: faixa.cor }}>· {faixa.rotulo}</Typography>
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onFechar} sx={{ textTransform: "none" }}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={salvando} sx={{ textTransform: "none", px: 3 }}>
            {salvando ? <CircularProgress size={22} color="inherit" /> : "Adicionar problema"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}

function GutSkeleton() {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} variant="rounded" height={96} />
      ))}
    </Box>
  )
}
