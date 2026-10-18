/**
 * Matriz GUT guiada, no formato do canvas de workshop.
 *
 * A matriz e uma folha pintada na cor da barra do topo (que segue a cor
 * escolhida e a aparencia): em cima, o titulo e o grupo (a startup); embaixo,
 * a tabela Problema | Gravidade | Urgencia | Tendencia | G x U x T |
 * Classificacao. As celulas sao papel e o vao entre elas deixa a cor da folha
 * aparecer, como as linhas do quadro impresso.
 *
 * Os problemas ficam ordenados pela prioridade (G x U x T, 1 a 125), com a
 * faixa de cor e a posicao no ranking. Linhas em branco completam a folha e
 * abrem o cadastro de um problema novo. Abaixo da folha, um grafico de barras
 * compara as prioridades.
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
import { FONTES } from "../../../theme"
import { DialogConfirmar, ToastFeedback, faixaPrioridade, legendaFaixas } from "./comum"

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

// As colunas da folha, na ordem do quadro impresso. A dica vira o tooltip do
// cabecalho; a sigla e o rotulo pequeno em cima do nome.
const COLUNAS = [
  { chave: "problema", rotulo: "Problema", sigla: "O que trava", dica: "O problema que a startup precisa resolver." },
  ...CRITERIOS.map((c) => ({ chave: c.chave, rotulo: c.rotulo, sigla: `${c.rotulo[0]} · 1 a 5`, dica: c.pergunta, centro: true })),
  { chave: "prioridade", rotulo: "G × U × T", sigla: "Prioridade", dica: "A multiplicação das três notas, de 1 a 125.", centro: true },
  { chave: "classificacao", rotulo: "Classificação", sigla: "Ranking", dica: "A posição na fila de ataque e a faixa da prioridade.", centro: true },
]

// A folha impressa tem seis linhas: com menos problemas, linhas em branco
// completam o quadro; com a folha cheia, sobra sempre uma para o proximo.
const LINHAS_DA_FOLHA = 6
const ALTURA_LINHA = 76

// Molde das colunas, igual em todas as linhas: como nenhuma coluna mede pelo
// conteudo, as linhas ficam alinhadas entre si e cada uma pode entrar e sair
// animada. Abaixo da largura minima, a tabela rola na horizontal dentro da
// folha em vez de espremer o texto.
const VAO = 4
const MOLDE_GUT = "minmax(220px, 2.6fr) repeat(3, minmax(104px, 1fr)) minmax(112px, 1fr) minmax(150px, 1.3fr)"
const LARGURA_MIN_GUT = 220 + 3 * 104 + 112 + 150 + (COLUNAS.length - 1) * VAO
const LINHA_SX = { display: "grid", gridTemplateColumns: MOLDE_GUT, gap: `${VAO}px` }

export default function MatrizGut({ idStartup, nomeStartup }) {
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

      {carregando ? (
        <GutSkeleton />
      ) : (
        <>
          <FolhaGut
            itens={ordenados}
            nomeStartup={nomeStartup}
            modo={tema.palette.mode}
            onNovo={() => setDialogAberto(true)}
            onExcluir={setExcluindo}
          />
          {ordenados.length >= 2 && <GraficoPrioridades itens={ordenados} modo={tema.palette.mode} />}
        </>
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

/**
 * A folha do canvas. Pinta com as cores da barra do topo (palette.barra): no
 * claro, a cor viva com texto preto ou branco (lima + preto); no escuro, um
 * tom escuro da cor, com o rotulo "Canvas" aceso na cor clareada.
 */
function FolhaGut({ itens, nomeStartup, modo, onNovo, onExcluir }) {
  const tema = useTheme()
  const { barra } = tema.palette
  const escuro = modo === "dark"
  const realce = alpha(tema.palette.primary.vivo, escuro ? 0.1 : 0.12)
  const vazias = Math.max(1, LINHAS_DA_FOLHA - itens.length)
  const faixas = legendaFaixas(modo)

  return (
    <Box sx={{ bgcolor: barra.fundo, color: barra.texto, p: { xs: 1.5, sm: 2 } }}>
      {/* Titulo e grupo */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2, flexWrap: "wrap" }}>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography
            variant="overline"
            sx={{ display: "block", lineHeight: 1.6, color: escuro ? barra.destaque : alpha(barra.texto, 0.72) }}
          >
            Canvas
          </Typography>
          <Typography variant="h4" component="h2" sx={{ fontSize: { xs: 28, sm: 34 } }}>
            Matriz GUT
          </Typography>
        </Box>
        <Box
          sx={{
            bgcolor: "background.paper",
            color: "text.primary",
            px: 2,
            py: 1,
            width: { xs: "100%", sm: 320 },
            maxWidth: "100%",
          }}
        >
          <Typography variant="overline" color="text.secondary" sx={{ display: "block", fontSize: 10, lineHeight: 1.6 }}>
            Grupo
          </Typography>
          <Typography variant="body1" fontWeight={700} noWrap>
            {nomeStartup || "—"}
          </Typography>
        </Box>
      </Box>

      {/* Tabela */}
      <Box sx={{ overflowX: "auto" }}>
        <Box
          role="table"
          aria-label="Matriz GUT"
          sx={{ minWidth: LARGURA_MIN_GUT, display: "flex", flexDirection: "column", gap: `${VAO}px` }}
        >
          <Box role="row" sx={LINHA_SX}>
            {COLUNAS.map((c) => (
              <CabecalhoGut key={c.chave} {...c} />
            ))}
          </Box>

          <AnimatePresence initial={false}>
            {itens.map((item, i) => (
              <LinhaGut key={item.id_gut} item={item} posicao={i} modo={modo} realce={realce} onExcluir={() => onExcluir(item)} />
            ))}
          </AnimatePresence>

          {Array.from({ length: vazias }, (_, i) => (
            <LinhaVazia key={`vazia-${i}`} primeira={i === 0} folhaVazia={itens.length === 0} realce={realce} onNovo={onNovo} />
          ))}
        </Box>
      </Box>

      {/* Rodape: a formula e a legenda das faixas */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 2, flexWrap: "wrap" }}>
        <Typography variant="caption" fontWeight={600} sx={{ flex: 1, minWidth: 220 }}>
          Prioridade = G × U × T (máx. 125) · ataque primeiro o topo da lista
        </Typography>
        {faixas.map((f) => (
          <Box
            key={f.rotulo}
            sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, px: 1, py: 0.25, bgcolor: "background.paper", color: "text.secondary" }}
          >
            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: f.cor }} />
            <Typography variant="caption" fontWeight={600}>
              {f.intervalo} · {f.rotulo}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

function CabecalhoGut({ rotulo, sigla, dica, centro }) {
  // describeChild: a dica descreve o cabecalho sem tomar o lugar do nome dele.
  return (
    <Tooltip title={dica} placement="top" describeChild>
      <Box
        role="columnheader"
        sx={{ bgcolor: "background.paper", color: "text.primary", px: 1.5, py: 1, textAlign: centro ? "center" : "left" }}
      >
        <Typography variant="overline" color="text.secondary" sx={{ display: "block", fontSize: 10, lineHeight: 1.6 }}>
          {sigla}
        </Typography>
        <Typography variant="h5" component="span" sx={{ display: "block", fontSize: 20 }}>
          {rotulo}
        </Typography>
      </Box>
    </Tooltip>
  )
}

// A tinta e o realce vao como gradiente sobre o papel, e nao como cor
// translucida: atras das celulas esta a cor da folha, que tingiria tudo.
function CelulaGut({ children, realce, tinta, centro, sx }) {
  const camadas = (...cores) =>
    cores.filter(Boolean).map((c) => `linear-gradient(${c}, ${c})`).join(", ") || "none"
  return (
    <Box
      role="cell"
      sx={{
        p: 1.5,
        minWidth: 0,
        minHeight: ALTURA_LINHA,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: centro ? "center" : "stretch",
        textAlign: centro ? "center" : "left",
        bgcolor: "background.paper",
        color: "text.primary",
        backgroundImage: camadas(tinta),
        ".linha-gut:hover &": { backgroundImage: camadas(realce, tinta) },
        ...sx,
      }}
    >
      {children}
    </Box>
  )
}

function LinhaGut({ item, posicao, modo, realce, onExcluir }) {
  const faixa = faixaPrioridade(item.prioridade, modo)
  return (
    <Box
      role="row"
      className="linha-gut"
      component={motion.div}
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      sx={LINHA_SX}
    >
      <CelulaGut realce={realce}>
        <Typography variant="body2" fontWeight={700} sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.5 }}>
          {item.problema}
        </Typography>
      </CelulaGut>

      {CRITERIOS.map((c) => (
        <CelulaGut key={c.chave} realce={realce} centro>
          <Typography variant="h5" component="span" sx={{ display: "block", fontSize: 28, lineHeight: 1 }}>
            {item[c.chave]}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5, lineHeight: 1.3 }}>
            {c.niveis[item[c.chave] - 1]}
          </Typography>
        </CelulaGut>
      ))}

      <CelulaGut realce={realce} tinta={alpha(faixa.cor, modo === "dark" ? 0.16 : 0.1)} centro>
        <Typography variant="h4" component="span" sx={{ display: "block", fontSize: 32, lineHeight: 1, color: faixa.cor }}>
          {item.prioridade}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
          de 125
        </Typography>
      </CelulaGut>

      <CelulaGut realce={realce} centro sx={{ position: "relative" }}>
        {/* O "º" da Anton parece um zero sobrescrito ("1⁰"): vai na fonte do corpo. */}
        <Typography variant="h5" component="span" sx={{ display: "block", fontSize: 26, lineHeight: 1 }}>
          {posicao + 1}
          <Box component="span" sx={{ fontFamily: FONTES.corpo, fontWeight: 800, fontSize: "0.6em", verticalAlign: "top" }}>
            º
          </Box>
        </Typography>
        <Chip
          size="small"
          label={faixa.rotulo}
          sx={{ mt: 0.75, height: 22, bgcolor: alpha(faixa.cor, 0.12), color: faixa.cor, fontWeight: 700 }}
        />
        <Tooltip title="Excluir problema">
          <IconButton
            size="small"
            onClick={onExcluir}
            aria-label="Excluir problema"
            sx={{ position: "absolute", top: 4, right: 4, color: "text.disabled", "&:hover": { color: "error.main" } }}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </CelulaGut>
    </Box>
  )
}

// Linha em branco da folha: clicar em qualquer ponto abre o cadastro. So a
// primeira tem o botao (e e a unica que o leitor de tela anuncia).
function LinhaVazia({ primeira, folhaVazia, realce, onNovo }) {
  return (
    <Box role="row" className="linha-gut" aria-hidden={primeira ? undefined : true} onClick={onNovo} sx={{ ...LINHA_SX, cursor: "pointer" }}>
      <CelulaGut realce={realce}>
        {primeira && (
          <Button
            startIcon={<AddIcon />}
            onClick={(e) => {
              e.stopPropagation()
              onNovo()
            }}
            sx={{
              alignSelf: "flex-start",
              textTransform: "none",
              color: "text.secondary",
              ".linha-gut:hover &": { color: "primary.main" },
            }}
          >
            {folhaVazia ? "Adicionar o primeiro problema" : "Novo problema"}
          </Button>
        )}
      </CelulaGut>
      {COLUNAS.slice(1).map((c) => (
        <CelulaGut key={c.chave} realce={realce} />
      ))}
    </Box>
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
    <Paper variant="outlined" sx={{ borderRadius: 0, p: 2, mt: 2 }}>
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
  return <Skeleton variant="rectangular" height={ALTURA_LINHA * (LINHAS_DA_FOLHA + 1) + 180} />
}
