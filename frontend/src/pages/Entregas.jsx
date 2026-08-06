/**
 * Tela "Entregas" — a fila de avaliacao do mentor.
 *
 * Mestre-detalhe: a fila a esquerda, a entrega aberta a direita. O mentor
 * trabalha de cima para baixo, e por isso o padrao e "pendentes" ordenadas da
 * mais antiga para a mais nova — quem espera ha mais tempo trava a startup.
 *
 * O admin cai na mesma tela vendo o tenant inteiro; o mentor ve so as startups
 * que acompanha (o recorte e feito no backend, em entregaService.listarFila).
 *
 * Endpoints:
 *   GET  /entregas/fila?id_tenant=  -> a fila
 *   GET  /entregas/:id/detalhe      -> conteudo da entrega selecionada
 *   POST /avaliacoes                -> registra a devolutiva
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
} from "@mui/material"
import { Search, Inbox } from "@mui/icons-material"

import AppLayout from "../components/AppLayout"
import FilaLista, { DIAS_FILA_CRITICA, diasEsperando } from "../components/entregas/FilaLista"
import EntregaPainel from "../components/entregas/EntregaPainel"
import { useFilaEntregas } from "../hooks/useFilaEntregas"
import { useAuthStore } from "../store/authStore"
import { SITUACAO } from "../data/avaliacaoMeta"

// Abre em "pendentes": a fila existe para mostrar o que falta responder, nao
// o historico — esse tem tela propria (/feedback).
const FILTRO_INICIAL = "PENDENTE"

/** Numero + rotulo do topo da coluna esquerda. */
function Resumo({ pendentes, atrasadas }) {
  return (
    <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
      <Typography variant="h5" fontWeight={700}>
        {pendentes}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {pendentes === 1 ? "entrega aguardando" : "entregas aguardando"}
      </Typography>
      {atrasadas > 0 && (
        <Typography variant="body2" sx={{ color: "#f97316", fontWeight: 700 }}>
          · {atrasadas} há {DIAS_FILA_CRITICA}+ dias
        </Typography>
      )}
    </Box>
  )
}

export default function Entregas() {
  const usuario = useAuthStore((s) => s.usuario)
  const idTenant = usuario?.id_tenant ?? null

  const { entregas, carregando, erro, buscarDetalhe, avaliar } = useFilaEntregas(idTenant)

  const [busca, setBusca] = useState("")
  const [filtroStartup, setFiltroStartup] = useState("todas")
  const [filtroSituacao, setFiltroSituacao] = useState(FILTRO_INICIAL)

  const [selecionada, setSelecionada] = useState(null)
  const [detalhe, setDetalhe] = useState(null)
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)

  // As startups do filtro saem da propria fila: so faz sentido filtrar por
  // quem tem entrega aqui.
  const startups = useMemo(() => {
    const nomes = [...new Set(entregas.map((e) => e.startup))]
    return nomes.sort((a, b) => a.localeCompare(b))
  }, [entregas])

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return entregas.filter((e) => {
      if (filtroSituacao !== "todas" && e.situacao !== filtroSituacao) return false
      if (filtroStartup !== "todas" && e.startup !== filtroStartup) return false
      if (termo) {
        const alvo = `${e.startup} ${e.passo} ${e.fase || ""} ${e.modulo || ""}`.toLowerCase()
        if (!alvo.includes(termo)) return false
      }
      return true
    })
  }, [entregas, busca, filtroStartup, filtroSituacao])

  const pendentes = useMemo(
    () => entregas.filter((e) => e.situacao === "PENDENTE"),
    [entregas]
  )
  const atrasadas = useMemo(
    () => pendentes.filter((e) => diasEsperando(e.atualizado_ts || e.criado_ts) >= DIAS_FILA_CRITICA),
    [pendentes]
  )

  // Abre a primeira da lista sozinho: a fila e para trabalhar, nao para
  // escolher. Se a selecionada sumiu do filtro, cai na primeira visivel.
  useEffect(() => {
    if (filtradas.length === 0) {
      setSelecionada(null)
      return
    }
    if (!filtradas.some((e) => e.id_entrega === selecionada)) {
      setSelecionada(filtradas[0].id_entrega)
    }
  }, [filtradas, selecionada])

  // Carrega o conteudo da entrega aberta.
  useEffect(() => {
    let cancelado = false
    if (!selecionada) {
      setDetalhe(null)
      return
    }
    setCarregandoDetalhe(true)
    buscarDetalhe(selecionada)
      .then((e) => {
        if (!cancelado) setDetalhe(e)
      })
      .catch(() => {
        if (!cancelado) setDetalhe(null)
      })
      .finally(() => {
        if (!cancelado) setCarregandoDetalhe(false)
      })
    // Evita que a resposta de uma entrega antiga sobrescreva a atual.
    return () => {
      cancelado = true
    }
  }, [selecionada, buscarDetalhe])

  const registrarAvaliacao = async (dados) => {
    await avaliar(dados)
    // Recarrega o painel para mostrar a devolutiva recem-gravada; a fila em si
    // ja foi atualizada pelo hook.
    const atualizada = await buscarDetalhe(dados.idEntrega)
    setDetalhe(atualizada)
  }

  return (
    <AppLayout>
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <Inbox sx={{ color: "primary.main" }} />
          <Typography variant="h4" fontWeight={700}>
            Entregas
          </Typography>
        </Box>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          O que as startups enviaram e ainda espera a sua resposta.
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
              // Altura fixa: as duas colunas rolam por dentro, o cabecalho e os
              // filtros ficam parados.
              height: "calc(100vh - 260px)",
              minHeight: 460,
            }}
          >
            {/* ---- Coluna esquerda: a fila ---- */}
            <Box
              sx={{
                width: 380,
                flexShrink: 0,
                borderRight: "1px solid",
                borderColor: "divider",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Box sx={{ px: 2.5, py: 2, borderBottom: "1px solid", borderColor: "divider" }}>
                <Resumo pendentes={pendentes.length} atrasadas={atrasadas.length} />

                <TextField
                  placeholder="Buscar startup ou passo..."
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

                <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                  <TextField
                    select
                    size="small"
                    value={filtroSituacao}
                    onChange={(e) => setFiltroSituacao(e.target.value)}
                    sx={{ flex: 1 }}
                  >
                    <MenuItem value="todas">Todas</MenuItem>
                    {Object.entries(SITUACAO).map(([valor, meta]) => (
                      <MenuItem key={valor} value={valor}>
                        {meta.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    select
                    size="small"
                    value={filtroStartup}
                    onChange={(e) => setFiltroStartup(e.target.value)}
                    sx={{ flex: 1 }}
                  >
                    <MenuItem value="todas">Startups</MenuItem>
                    {startups.map((s) => (
                      <MenuItem key={s} value={s}>
                        {s}
                      </MenuItem>
                    ))}
                  </TextField>
                </Box>
              </Box>

              <FilaLista
                entregas={filtradas}
                selecionada={selecionada}
                onSelecionar={setSelecionada}
              />
            </Box>

            {/* ---- Coluna direita: a entrega aberta ---- */}
            <Box sx={{ flex: 1, display: "flex", minWidth: 0 }}>
              <EntregaPainel
                entrega={detalhe}
                carregando={carregandoDetalhe}
                onAvaliar={registrarAvaliacao}
              />
            </Box>
          </Paper>
        )}
      </Box>
    </AppLayout>
  )
}
