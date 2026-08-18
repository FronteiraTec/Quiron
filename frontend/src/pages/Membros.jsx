/**
 * Tela "Membros" — as pessoas das startups, vistas de cima.
 *
 * A aba de membros de UMA startup (StartupDetail) ja existe e resolve o
 * cadastro. Esta tela responde o que aquela nao alcanca: quem esta em qual
 * startup, quem lidera o que — e, principalmente, QUEM NAO ESTA EM NENHUMA.
 *
 * Essa ultima e a razao da tela existir. Um incubado sem vinculo entra no
 * sistema e nao encontra jornada, entrega nem startup, e nenhuma tela dele diz
 * por que. Do lado do admin, ele simplesmente nao aparece em lugar nenhum —
 * some entre as startups. Aqui ele fica no topo, com o botao que resolve.
 *
 * Endpoints:
 *   GET  /startups/membros?id_tenant=  -> { membros, semStartup }
 *   POST /startups/:id/membros         -> vincula
 */
import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Box,
  Paper,
  Typography,
  TextField,
  InputAdornment,
  MenuItem,
  Avatar,
  Chip,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  AlertTitle,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  CircularProgress,
} from "@mui/material"
import { Search, Groups, PersonAdd, OpenInNew } from "@mui/icons-material"

import AppLayout from "../components/AppLayout"
import { useMembros } from "../hooks/useMembros"
import { useAuthStore } from "../store/authStore"
import { STATUS_ROTULO, STATUS_COR } from "../data/startupMeta"

function inicial(nome) {
  return (nome || "?").trim().charAt(0).toUpperCase()
}

/** Dialogo que tira alguem da lista "sem startup". */
function DialogVincular({ pessoa, startups, onFechar, onVincular }) {
  const [idStartup, setIdStartup] = useState("")
  const [lider, setLider] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(null)

  const salvar = async (e) => {
    e.preventDefault()
    if (!idStartup) return
    setSalvando(true)
    setErro(null)
    try {
      await onVincular(idStartup, pessoa.id_usuario, lider)
      onFechar()
    } catch (err) {
      setErro(err.response?.data?.erro || "Não foi possível vincular.")
      setSalvando(false)
    }
  }

  return (
    <Dialog open={Boolean(pessoa)} onClose={onFechar} maxWidth="xs" fullWidth>
      <Box component="form" onSubmit={salvar}>
        <DialogTitle>Vincular {pessoa?.nome}</DialogTitle>
        <DialogContent dividers>
          {erro && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {erro}
            </Alert>
          )}
          <TextField
            select
            label="Startup"
            fullWidth
            required
            value={idStartup}
            onChange={(e) => setIdStartup(e.target.value)}
            sx={{ mb: 2 }}
          >
            {startups.map((s) => (
              <MenuItem key={s.id_startup} value={s.id_startup}>
                {s.nome}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Papel"
            fullWidth
            value={lider ? "1" : "0"}
            onChange={(e) => setLider(e.target.value === "1")}
          >
            <MenuItem value="0">Membro</MenuItem>
            <MenuItem value="1">Líder</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onFechar} sx={{ textTransform: "none" }}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={salvando || !idStartup}
            sx={{ textTransform: "none", boxShadow: "none" }}
          >
            {salvando ? <CircularProgress size={22} color="inherit" /> : "Vincular"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}

export default function Membros() {
  const navigate = useNavigate()
  const usuario = useAuthStore((s) => s.usuario)
  const idTenant = usuario?.id_tenant ?? null

  const { membros, semStartup, startups, carregando, erro, vincular } = useMembros(idTenant)

  const [busca, setBusca] = useState("")
  const [filtroStartup, setFiltroStartup] = useState("todas")
  const [aVincular, setAVincular] = useState(null)

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return membros.filter((m) => {
      if (filtroStartup !== "todas" && String(m.id_startup) !== String(filtroStartup)) return false
      if (termo && !`${m.nome} ${m.email} ${m.startup}`.toLowerCase().includes(termo)) return false
      return true
    })
  }, [membros, busca, filtroStartup])

  // Pessoas distintas: uma pessoa em duas startups e um so incubado, ainda que
  // sejam duas linhas na tabela.
  const pessoas = useMemo(() => new Set(membros.map((m) => m.id_usuario)).size, [membros])

  // Startups do filtro saem dos proprios membros, mas o dialogo de vincular usa
  // a lista completa: dar para vincular alguem a uma startup ainda vazia e
  // justamente um dos casos.
  const startupsComMembros = useMemo(() => {
    const mapa = new Map()
    for (const m of membros) mapa.set(m.id_startup, m.startup)
    return [...mapa.entries()]
      .map(([id_startup, nome]) => ({ id_startup, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [membros])

  return (
    <AppLayout>
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <Groups sx={{ color: "primary.main" }} />
          <Typography variant="h4" fontWeight={700}>
            Membros
          </Typography>
        </Box>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Quem está em cada startup da incubadora.
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
          <>
            {/* ---- Os que ficaram de fora: o unico estado que pede acao ---- */}
            {semStartup.length > 0 && (
              <Alert data-tour="membros-sem-startup" severity="warning" sx={{ mb: 3 }}>
                <AlertTitle>
                  {semStartup.length}{" "}
                  {semStartup.length === 1
                    ? "incubado sem startup"
                    : "incubados sem startup"}
                </AlertTitle>
                <Typography variant="body2" sx={{ mb: 1.5 }}>
                  Sem vínculo, essas pessoas entram no sistema e não encontram
                  jornada, entrega nem startup — e a tela delas não explica o
                  porquê.
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                  {semStartup.map((p) => (
                    <Chip
                      key={p.id_usuario}
                      avatar={<Avatar src={p.foto_url || undefined}>{inicial(p.nome)}</Avatar>}
                      label={p.nome}
                      onClick={() => setAVincular(p)}
                      onDelete={() => setAVincular(p)}
                      deleteIcon={
                        <Tooltip title="Vincular a uma startup" arrow>
                          <PersonAdd fontSize="small" />
                        </Tooltip>
                      }
                      sx={{ bgcolor: "background.paper" }}
                    />
                  ))}
                </Box>
              </Alert>
            )}

            {/* ---- Filtros ---- */}
            <Box sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap", alignItems: "center" }}>
              <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mr: 1 }}>
                <Typography variant="h5" fontWeight={700}>
                  {pessoas}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {pessoas === 1 ? "pessoa" : "pessoas"} em {startupsComMembros.length}{" "}
                  {startupsComMembros.length === 1 ? "startup" : "startups"}
                </Typography>
              </Box>
              <Box sx={{ flex: 1 }} />
              <TextField
                data-tour="membros-busca"
                placeholder="Buscar pessoa ou startup..."
                size="small"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                sx={{ minWidth: 240 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                data-tour="membros-filtro-startup"
                select
                size="small"
                value={filtroStartup}
                onChange={(e) => setFiltroStartup(e.target.value)}
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="todas">Todas as startups</MenuItem>
                {startupsComMembros.map((s) => (
                  <MenuItem key={s.id_startup} value={String(s.id_startup)}>
                    {s.nome}
                  </MenuItem>
                ))}
              </TextField>
            </Box>

            {/* ---- A tabela ---- */}
            <Paper data-tour="membros-tabela" sx={{ borderRadius: 0, overflow: "hidden" }}>
              {visiveis.length === 0 ? (
                <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
                  <Groups sx={{ fontSize: 48, opacity: 0.4 }} />
                  <Typography sx={{ mt: 1 }}>
                    {membros.length === 0
                      ? "Nenhuma startup tem membros ainda."
                      : "Ninguém corresponde ao filtro."}
                  </Typography>
                </Box>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Pessoa</TableCell>
                        <TableCell>Startup</TableCell>
                        <TableCell align="center">Papel</TableCell>
                        <TableCell align="center">Entrada</TableCell>
                        <TableCell align="center" width={60} />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {visiveis.map((m) => (
                        <TableRow key={`${m.id_startup}-${m.id_usuario}`} hover>
                          <TableCell>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                              <Avatar
                                src={m.foto_url || undefined}
                                sx={{ width: 32, height: 32, fontSize: 14, bgcolor: "primary.main" }}
                              >
                                {inicial(m.nome)}
                              </Avatar>
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant="body2" fontWeight={600} noWrap>
                                  {m.nome}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" noWrap>
                                  {m.email}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              <Typography variant="body2">{m.startup}</Typography>
                              {m.startup_status !== "ATIVA" && (
                                <Chip
                                  size="small"
                                  label={STATUS_ROTULO[m.startup_status] || m.startup_status}
                                  color={STATUS_COR[m.startup_status] || "default"}
                                />
                              )}
                            </Box>
                          </TableCell>
                          <TableCell align="center">
                            {m.lider ? (
                              <Chip size="small" label="Líder" color="primary" />
                            ) : (
                              <Typography variant="caption" color="text.secondary">
                                Membro
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="center">
                            <Typography variant="caption" color="text.secondary">
                              {m.entrada_dt
                                ? new Date(m.entrada_dt).toLocaleDateString("pt-BR")
                                : "—"}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Tooltip title="Abrir a startup" arrow>
                              <Button
                                size="small"
                                onClick={() => navigate(`/startups/${m.id_startup}`)}
                                sx={{ minWidth: 0, px: 1 }}
                              >
                                <OpenInNew fontSize="small" />
                              </Button>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </>
        )}

        {aVincular && (
          <DialogVincular
            pessoa={aVincular}
            startups={startups}
            onFechar={() => setAVincular(null)}
            onVincular={vincular}
          />
        )}
      </Box>
    </AppLayout>
  )
}
