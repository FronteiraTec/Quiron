/**
 * Tela "Presenca" — a chamada dos eventos ja realizados.
 *
 * Mestre-detalhe, como /entregas e /mentores: os eventos a esquerda com o
 * andamento da chamada, a lista de convidados do selecionado a direita.
 *
 * Por que a tela existe: `evento_presenca` era lida pelo relatorio de
 * engajamento mas nada nunca escrevia nela — a taxa de presenca ficava em zero
 * para sempre e "confirmou mas faltou" acusava todo mundo que deu RSVP. Esta e
 * a tela que produz esse dado.
 *
 * Nao confundir com a confirmacao (RSVP) do participante, que fica no
 * calendario: la a pessoa diz que pretende ir; aqui o admin registra quem foi.
 *
 * Endpoints:
 *   GET  /eventos/presenca/resumo?id_tenant=  -> eventos + andamento
 *   GET  /eventos/:id/presenca                -> lista de chamada
 *   POST /eventos/:id/presenca                -> marca (uma ou varias)
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Box,
  Paper,
  Typography,
  TextField,
  InputAdornment,
  Alert,
  CircularProgress,
} from "@mui/material"
import { Search, HowToReg } from "@mui/icons-material"

import AppLayout from "../components/AppLayout"
import EventoPresencaLista from "../components/presenca/EventoPresencaLista"
import ChamadaPainel from "../components/presenca/ChamadaPainel"
import { usePresencaEventos } from "../hooks/usePresencaEventos"
import { useAuthStore } from "../store/authStore"

/** Numero + rotulo do topo da coluna esquerda. */
function Resumo({ total, pendentes }) {
  return (
    <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
      <Typography variant="h5" fontWeight={700}>
        {total}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {total === 1 ? "evento realizado" : "eventos realizados"}
      </Typography>
      {pendentes > 0 && (
        <Typography variant="body2" sx={{ color: "#f97316", fontWeight: 700 }}>
          · {pendentes} sem chamada
        </Typography>
      )}
    </Box>
  )
}

export default function PresencaEventos() {
  const usuario = useAuthStore((s) => s.usuario)
  const idTenant = usuario?.id_tenant ?? null

  const { eventos, carregando, erro, buscarChamada, marcar } = usePresencaEventos(idTenant)

  const [busca, setBusca] = useState("")
  const [selecionado, setSelecionado] = useState(null)
  const [chamada, setChamada] = useState(null)
  const [carregandoChamada, setCarregandoChamada] = useState(false)
  // Quem esta com a marcacao em voo, para esmaecer so aquelas linhas.
  const [salvandoIds, setSalvandoIds] = useState(new Set())

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return eventos
    return eventos.filter((e) => `${e.titulo} ${e.local || ""}`.toLowerCase().includes(termo))
  }, [eventos, busca])

  const semChamada = useMemo(() => eventos.filter((e) => e.marcados === 0).length, [eventos])

  // Abre o primeiro da lista sozinho; se o selecionado sumiu do filtro, cai no
  // primeiro visivel.
  useEffect(() => {
    if (filtrados.length === 0) {
      setSelecionado(null)
      return
    }
    if (!filtrados.some((e) => e.id_evento === selecionado)) {
      setSelecionado(filtrados[0].id_evento)
    }
  }, [filtrados, selecionado])

  // Carrega a chamada do evento aberto.
  useEffect(() => {
    let cancelado = false
    if (!selecionado) {
      setChamada(null)
      return
    }
    setCarregandoChamada(true)
    buscarChamada(selecionado)
      .then((c) => {
        if (!cancelado) setChamada(c)
      })
      .catch(() => {
        if (!cancelado) setChamada(null)
      })
      .finally(() => {
        if (!cancelado) setCarregandoChamada(false)
      })
    // Evita que a resposta de um evento antigo sobrescreva o atual.
    return () => {
      cancelado = true
    }
  }, [selecionado, buscarChamada])

  /**
   * Marca e atualiza SO as linhas afetadas, em vez de recarregar a chamada.
   * Marcar presenca e uma sequencia rapida de cliques: um refetch a cada clique
   * faria a lista piscar embaixo do dedo de quem marca.
   */
  const marcarPresenca = useCallback(
    async (idsUsuarios, presente) => {
      setSalvandoIds(new Set(idsUsuarios))
      try {
        const marcados = await marcar(selecionado, idsUsuarios, presente)
        const porUsuario = new Map(marcados.map((m) => [m.id_usuario, m]))
        setChamada((atual) => {
          if (!atual) return atual
          return {
            ...atual,
            publico: atual.publico.map((p) =>
              porUsuario.has(p.id_usuario)
                ? {
                    ...p,
                    presente: porUsuario.get(p.id_usuario).presente,
                    checkin_ts: new Date().toISOString(),
                    marcado_por_nome: usuario?.nome || p.marcado_por_nome,
                  }
                : p
            ),
          }
        })
      } finally {
        setSalvandoIds(new Set())
      }
    },
    [marcar, selecionado, usuario]
  )

  return (
    <AppLayout>
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <HowToReg sx={{ color: "primary.main" }} />
          <Typography variant="h4" fontWeight={700}>
            Presenca
          </Typography>
        </Box>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Quem apareceu em cada evento. E daqui que sai a taxa de presenca dos
          relatorios.
        </Typography>

        {erro && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {erro}
          </Alert>
        )}

        {carregando ? (
          <Box sx={{ textAlign: "center", py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Paper
            sx={{
              borderRadius: 0,
              overflow: "hidden",
              display: "flex",
              // Altura fixa: as duas colunas rolam por dentro, o cabecalho e a
              // busca ficam parados.
              height: "calc(100vh - 260px)",
              minHeight: 460,
            }}
          >
            {/* ---- Coluna esquerda: os eventos ---- */}
            <Box
              sx={{
                width: 340,
                flexShrink: 0,
                borderRight: "1px solid",
                borderColor: "divider",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Box sx={{ px: 2.5, py: 2, borderBottom: "1px solid", borderColor: "divider" }}>
                <Resumo total={eventos.length} pendentes={semChamada} />

                <TextField
                  placeholder="Buscar evento..."
                  size="small"
                  fullWidth
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  sx={{ mt: 1.5 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>

              <EventoPresencaLista
                eventos={filtrados}
                selecionado={selecionado}
                onSelecionar={setSelecionado}
              />
            </Box>

            {/* ---- Coluna direita: a chamada ---- */}
            <Box sx={{ flex: 1, display: "flex", minWidth: 0 }}>
              <ChamadaPainel
                chamada={chamada}
                carregando={carregandoChamada}
                salvandoIds={salvandoIds}
                onMarcar={marcarPresenca}
              />
            </Box>
          </Paper>
        )}
      </Box>
    </AppLayout>
  )
}
