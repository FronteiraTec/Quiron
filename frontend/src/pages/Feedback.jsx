/**
 * Tela "Feedback" — o historico de devolutivas do mentor.
 *
 * A fila (/entregas) mostra o que falta responder; esta mostra o que ja foi
 * respondido. Serve para o mentor retomar o fio antes de uma sessao: o que ele
 * pediu para cada startup e o que ainda esta em aberto.
 *
 * Um pedido de ajuste some daqui quando a startup reenvia — o reenvio apaga a
 * avaliacao e devolve a entrega para a fila. Entao o que aparece nesta lista
 * como "ajuste pedido" e sempre cobranca ainda nao atendida, e e por isso que
 * ela vem em destaque no topo.
 *
 * Endpoint: GET /avaliacoes/minhas?id_tenant=
 */
import { useEffect, useMemo, useState } from "react"
import {
  Box,
  Paper,
  Typography,
  TextField,
  InputAdornment,
  MenuItem,
  Alert,
  CircularProgress,
  Stack,
} from "@mui/material"
import { Search, Feedback as FeedbackIcon } from "@mui/icons-material"

import AppLayout from "../components/AppLayout"
import SituacaoChip from "../components/entregas/SituacaoChip"
import api from "../services/api"
import { useAuthStore } from "../store/authStore"
import { SITUACAO } from "../data/avaliacaoMeta"

const dataHora = (ts) =>
  ts
    ? new Date(ts).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—"

/** Uma devolutiva na lista. */
function ItemFeedback({ avaliacao }) {
  const meta = SITUACAO[avaliacao.status] || SITUACAO.PENDENTE

  return (
    <Box
      sx={{
        px: 3,
        py: 2.25,
        borderTop: "1px solid",
        borderColor: "divider",
        borderLeft: "3px solid",
        borderLeftColor: meta.cor,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
        <Typography fontWeight={700} noWrap sx={{ minWidth: 0 }}>
          {avaliacao.startup}
        </Typography>
        <SituacaoChip situacao={avaliacao.status} />
        {avaliacao.nota != null && (
          <Typography variant="body2" color="text.secondary">
            Nota {avaliacao.nota}
          </Typography>
        )}
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
          {dataHora(avaliacao.criado_ts)}
        </Typography>
      </Box>

      <Typography variant="body2">{avaliacao.passo}</Typography>
      {avaliacao.fase && (
        <Typography variant="caption" color="text.secondary">
          {avaliacao.fase}
          {avaliacao.modulo ? ` · ${avaliacao.modulo}` : ""}
        </Typography>
      )}

      {avaliacao.comentario && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 1, whiteSpace: "pre-wrap" }}
        >
          {avaliacao.comentario}
        </Typography>
      )}
    </Box>
  )
}

export default function Feedback() {
  const usuario = useAuthStore((s) => s.usuario)
  const idTenant = usuario?.id_tenant ?? null

  const [avaliacoes, setAvaliacoes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const [busca, setBusca] = useState("")
  const [filtroStatus, setFiltroStatus] = useState("todos")

  useEffect(() => {
    let cancelado = false
    if (!idTenant) {
      setCarregando(false)
      return
    }
    setCarregando(true)
    api
      .get("/avaliacoes/minhas", { params: { id_tenant: idTenant } })
      .then(({ data }) => {
        if (!cancelado) {
          setAvaliacoes(data.avaliacoes)
          setErro(null)
        }
      })
      .catch((err) => {
        if (!cancelado) {
          setErro(err.response?.data?.erro || "Não foi possível carregar o histórico.")
          setAvaliacoes([])
        }
      })
      .finally(() => {
        if (!cancelado) setCarregando(false)
      })
    return () => {
      cancelado = true
    }
  }, [idTenant])

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return avaliacoes.filter((a) => {
      if (filtroStatus !== "todos" && a.status !== filtroStatus) return false
      if (termo) {
        const alvo = `${a.startup} ${a.passo} ${a.comentario || ""}`.toLowerCase()
        if (!alvo.includes(termo)) return false
      }
      return true
    })
  }, [avaliacoes, busca, filtroStatus])

  // Ajustes pedidos primeiro: e a unica linha da lista que ainda espera algo
  // da startup. O resto segue por data, do mais recente para o mais antigo.
  const ordenadas = useMemo(() => {
    return [...filtradas].sort((a, b) => {
      const pendenteA = a.status === "AJUSTE" ? 0 : 1
      const pendenteB = b.status === "AJUSTE" ? 0 : 1
      if (pendenteA !== pendenteB) return pendenteA - pendenteB
      return new Date(b.criado_ts) - new Date(a.criado_ts)
    })
  }, [filtradas])

  const aguardandoStartup = avaliacoes.filter((a) => a.status === "AJUSTE").length

  return (
    <AppLayout>
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <FeedbackIcon sx={{ color: "primary.main" }} />
          <Typography variant="h4" fontWeight={700}>
            Feedback
          </Typography>
        </Box>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          As devolutivas que você já deu — o que pediu para cada startup e o que
          ainda está em aberto.
        </Typography>

        {erro && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {erro}
          </Alert>
        )}

        <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: "wrap" }}>
          <TextField
            data-tour="feedback-busca"
            placeholder="Buscar startup, passo ou comentário..."
            size="small"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            sx={{ flex: 1, minWidth: 240 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            data-tour="feedback-decisao"
            select
            size="small"
            label="Decisão"
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            sx={{ minWidth: 190 }}
          >
            <MenuItem value="todos">Todas as decisões</MenuItem>
            {["APROVADO", "AJUSTE", "REPROVADO"].map((s) => (
              <MenuItem key={s} value={s}>
                {SITUACAO[s].label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        {aguardandoStartup > 0 && filtroStatus === "todos" && (
          <Alert data-tour="feedback-pendentes" severity="info" sx={{ mb: 2 }}>
            {aguardandoStartup === 1
              ? "1 ajuste pedido ainda não foi reenviado pela startup."
              : `${aguardandoStartup} ajustes pedidos ainda não foram reenviados pelas startups.`}
          </Alert>
        )}

        <Paper data-tour="feedback-lista" sx={{ borderRadius: 0, overflow: "hidden" }}>
          {carregando ? (
            <Box sx={{ textAlign: "center", py: 8 }}>
              <CircularProgress />
            </Box>
          ) : ordenadas.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
              <FeedbackIcon sx={{ fontSize: 48, opacity: 0.4 }} />
              <Typography sx={{ mt: 1 }}>
                {avaliacoes.length === 0
                  ? "Você ainda não avaliou nenhuma entrega."
                  : "Nenhuma devolutiva com esses filtros."}
              </Typography>
            </Box>
          ) : (
            ordenadas.map((a) => <ItemFeedback key={a.id_avaliacao} avaliacao={a} />)
          )}
        </Paper>
      </Box>
    </AppLayout>
  )
}
