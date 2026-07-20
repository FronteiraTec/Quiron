/**
 * Tela "Mentores" — quem mentora na incubadora e quais startups cada um pega.
 *
 * Mestre-detalhe, como a tela de Entregas: os mentores a esquerda com a carga
 * de cada um, as startups do selecionado a direita.
 *
 * A tela existe para uma decisao so: distribuir startups entre mentores. Por
 * isso a lista mostra carga (startups + entregas paradas) em vez de dados
 * cadastrais — cadastro de pessoa e a tela de Usuarios.
 *
 * Restrita a admin do tenant (ou root), como o backend exige em
 * mentorService via tenantService.garantirAcessoTenant.
 *
 * Endpoints:
 *   GET    /mentores?id_tenant=                      -> lista + carga
 *   GET    /mentores/:idUsuario/startups?id_tenant=  -> acompanha + disponiveis
 *   POST   /mentores/:idUsuario/startups             -> vincula
 *   DELETE /mentores/:idUsuario/startups/:idStartup  -> desvincula
 */
import { useEffect, useMemo, useState } from "react"
import {
  Box,
  Paper,
  Typography,
  TextField,
  InputAdornment,
  Alert,
  CircularProgress,
} from "@mui/material"
import { Search, SupervisorAccount } from "@mui/icons-material"

import AppLayout from "../components/AppLayout"
import MentorLista from "../components/mentores/MentorLista"
import MentorPainel from "../components/mentores/MentorPainel"
import { useMentores } from "../hooks/useMentores"
import { useAuthStore } from "../store/authStore"

/** Numero + rotulo do topo da coluna esquerda. */
function Resumo({ total, semStartups }) {
  return (
    <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
      <Typography variant="h5" fontWeight={700}>
        {total}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {total === 1 ? "mentor" : "mentores"}
      </Typography>
      {semStartups > 0 && (
        <Typography variant="body2" sx={{ color: "#f97316", fontWeight: 700 }}>
          · {semStartups} sem startup
        </Typography>
      )}
    </Box>
  )
}

export default function Mentores() {
  const usuario = useAuthStore((s) => s.usuario)
  const idTenant = usuario?.id_tenant ?? null

  const { mentores, carregando, erro, buscarDetalhe, vincular, desvincular } = useMentores(idTenant)

  const [busca, setBusca] = useState("")
  const [selecionado, setSelecionado] = useState(null)
  const [detalhe, setDetalhe] = useState(null)
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return mentores
    return mentores.filter((m) => `${m.nome} ${m.email}`.toLowerCase().includes(termo))
  }, [mentores, busca])

  const semStartups = useMemo(() => mentores.filter((m) => m.startups === 0).length, [mentores])

  const mentorAberto = useMemo(
    () => mentores.find((m) => m.id_usuario === selecionado) || null,
    [mentores, selecionado]
  )

  // Abre o primeiro da lista sozinho; se o selecionado sumiu do filtro, cai no
  // primeiro visivel.
  useEffect(() => {
    if (filtrados.length === 0) {
      setSelecionado(null)
      return
    }
    if (!filtrados.some((m) => m.id_usuario === selecionado)) {
      setSelecionado(filtrados[0].id_usuario)
    }
  }, [filtrados, selecionado])

  // Carrega as startups do mentor aberto.
  useEffect(() => {
    let cancelado = false
    if (!selecionado) {
      setDetalhe(null)
      return
    }
    setCarregandoDetalhe(true)
    buscarDetalhe(selecionado)
      .then((d) => {
        if (!cancelado) setDetalhe(d)
      })
      .catch(() => {
        if (!cancelado) setDetalhe(null)
      })
      .finally(() => {
        if (!cancelado) setCarregandoDetalhe(false)
      })
    // Evita que a resposta de um mentor antigo sobrescreva o atual.
    return () => {
      cancelado = true
    }
  }, [selecionado, buscarDetalhe])

  // Depois de vincular/desvincular o painel precisa ser relido: as duas listas
  // (acompanha e disponiveis) trocam de lado. O hook ja recarregou a carga da
  // coluna esquerda.
  const aplicarVinculo = async (acao, idUsuario, idStartup) => {
    await acao(idUsuario, idStartup)
    setDetalhe(await buscarDetalhe(idUsuario))
  }

  return (
    <AppLayout>
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <SupervisorAccount sx={{ color: "primary.main" }} />
          <Typography variant="h4" fontWeight={700}>
            Mentores
          </Typography>
        </Box>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Quem mentora na incubadora e quais startups cada um acompanha.
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
            {/* ---- Coluna esquerda: os mentores ---- */}
            <Box
              sx={{
                width: 360,
                flexShrink: 0,
                borderRight: "1px solid",
                borderColor: "divider",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Box sx={{ px: 2.5, py: 2, borderBottom: "1px solid", borderColor: "divider" }}>
                <Resumo total={mentores.length} semStartups={semStartups} />

                <TextField
                  placeholder="Buscar mentor..."
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

              <MentorLista
                mentores={filtrados}
                selecionado={selecionado}
                onSelecionar={setSelecionado}
              />
            </Box>

            {/* ---- Coluna direita: as startups do mentor ---- */}
            <Box sx={{ flex: 1, display: "flex", minWidth: 0 }}>
              <MentorPainel
                mentor={mentorAberto}
                detalhe={detalhe}
                carregando={carregandoDetalhe}
                onVincular={(idUsuario, idStartup) =>
                  aplicarVinculo(vincular, idUsuario, idStartup)
                }
                onDesvincular={(idUsuario, idStartup) =>
                  aplicarVinculo(desvincular, idUsuario, idStartup)
                }
              />
            </Box>
          </Paper>
        )}
      </Box>
    </AppLayout>
  )
}
