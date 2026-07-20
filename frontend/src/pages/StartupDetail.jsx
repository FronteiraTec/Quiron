/**
 * Tela de detalhe de uma startup (visao admin/mentor da incubadora).
 *
 * Cabecalho com nome, data de entrada, fase atual e progresso na trilha,
 * alem de acoes (editar dados cadastrais, pausar/ativar/encerrar). Abaixo,
 * as mesmas abas de MinhaStartup (Membros, Modelos, Fases concluidas), agora
 * aplicadas a startup escolhida na lista.
 *
 * Endpoints:
 *   GET   /startups/:id        -> dados + fase_atual/progresso_pct
 *   PUT   /startups/:id        -> atualiza nome/cnpj
 *   PATCH /startups/:id/status -> ativa/pausa/encerra
 */
import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Chip,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Alert,
  CircularProgress,
} from "@mui/material"
import {
  RocketLaunch,
  Groups,
  ViewModule,
  CheckCircle,
  Edit,
  MoreVert,
  ArrowBack,
} from "@mui/icons-material"
import AppLayout from "../components/AppLayout"
import api from "../services/api"
import AbaMembros from "../components/startup/AbaMembros"
import AbaModelos from "../components/startup/AbaModelos"
import AbaFasesConcluidas from "../components/startup/AbaFasesConcluidas"
import { STATUS_ROTULO, STATUS_COR } from "../data/startupMeta"

export default function StartupDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [startup, setStartup] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [aviso, setAviso] = useState(null)
  const [aba, setAba] = useState("membros")

  const [dialogAberto, setDialogAberto] = useState(false)
  const [form, setForm] = useState({ nome: "", cnpj: "" })
  const [salvando, setSalvando] = useState(false)

  const [menuAncora, setMenuAncora] = useState(null)

  const carregar = async () => {
    setCarregando(true)
    try {
      const { data } = await api.get(`/startups/${id}`)
      setStartup(data.startup)
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao carregar a startup." })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const abrirEdicao = () => {
    setForm({ nome: startup.nome || "", cnpj: startup.cnpj || "" })
    setDialogAberto(true)
  }

  const salvar = async (e) => {
    e.preventDefault()
    setSalvando(true)
    setAviso(null)
    try {
      await api.put(`/startups/${id}`, form)
      setDialogAberto(false)
      await carregar()
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao salvar a startup." })
    } finally {
      setSalvando(false)
    }
  }

  const alterarStatus = async (status) => {
    setMenuAncora(null)
    setAviso(null)
    try {
      await api.patch(`/startups/${id}/status`, { status })
      await carregar()
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao alterar o status." })
    }
  }

  if (carregando) {
    return (
      <AppLayout>
        <Box sx={{ textAlign: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      </AppLayout>
    )
  }

  if (!startup) {
    return (
      <AppLayout>
        <Alert severity="error">{aviso?.texto || "Startup nao encontrada."}</Alert>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <Box>
        <Button startIcon={<ArrowBack />} onClick={() => navigate("/startups")} sx={{ mb: 2 }}>
          Voltar
        </Button>

        {aviso && (
          <Alert severity={aviso.tipo} sx={{ mb: 3 }} onClose={() => setAviso(null)}>
            {aviso.texto}
          </Alert>
        )}

        <Paper sx={{ borderRadius: 0, p: 3, mb: 3 }}>
          <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <RocketLaunch sx={{ color: "primary.main", fontSize: 32 }} />
              <Box>
                <Typography variant="h4" fontWeight={700}>
                  {startup.nome}
                </Typography>
                <Typography color="text.secondary">
                  Startup incubada desde{" "}
                  {startup.criado_ts ? new Date(startup.criado_ts).toLocaleDateString("pt-BR") : "-"}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button variant="outlined" startIcon={<Edit />} onClick={abrirEdicao}>
                Editar
              </Button>
              <IconButton onClick={(e) => setMenuAncora(e.currentTarget)}>
                <MoreVert />
              </IconButton>
              <Menu anchorEl={menuAncora} open={Boolean(menuAncora)} onClose={() => setMenuAncora(null)}>
                {startup.status !== "ATIVA" && (
                  <MenuItem onClick={() => alterarStatus("ATIVA")}>Ativar</MenuItem>
                )}
                {startup.status !== "PAUSADA" && (
                  <MenuItem onClick={() => alterarStatus("PAUSADA")}>Pausar</MenuItem>
                )}
                {startup.status !== "ENCERRADA" && (
                  <MenuItem onClick={() => alterarStatus("ENCERRADA")}>Encerrar (graduar)</MenuItem>
                )}
              </Menu>
            </Box>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 3 }}>
            <Chip label={startup.fase_atual || "Graduada"} variant="outlined" />
            <Chip
              label={STATUS_ROTULO[startup.status] || startup.status}
              color={STATUS_COR[startup.status] || "default"}
            />
            <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: 1 }}>
              <LinearProgress
                variant="determinate"
                value={startup.progresso_pct}
                sx={{ flex: 1, height: 10, borderRadius: 5 }}
              />
              <Typography variant="body2" color="text.secondary" sx={{ width: 44, textAlign: "right" }}>
                {startup.progresso_pct}%
              </Typography>
            </Box>
          </Box>
        </Paper>

        <Paper sx={{ borderRadius: 0, overflow: "hidden" }}>
          <Tabs
            value={aba}
            onChange={(_, v) => setAba(v)}
            sx={{ borderBottom: 1, borderColor: "divider", px: 2 }}
          >
            <Tab value="membros" label="Membros" icon={<Groups />} iconPosition="start" />
            <Tab value="modelos" label="Modelos" icon={<ViewModule />} iconPosition="start" />
            <Tab value="fases" label="Fases concluidas" icon={<CheckCircle />} iconPosition="start" />
          </Tabs>
          <Box sx={{ p: 3 }}>
            {aba === "membros" && <AbaMembros idStartup={startup.id_startup} idTenant={startup.id_tenant} />}
            {aba === "modelos" && <AbaModelos idStartup={startup.id_startup} />}
            {aba === "fases" && <AbaFasesConcluidas idStartup={startup.id_startup} />}
          </Box>
        </Paper>
      </Box>

      <Dialog open={dialogAberto} onClose={() => setDialogAberto(false)} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={salvar}>
          <DialogTitle>Editar startup</DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label="Nome"
                  fullWidth
                  required
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="CNPJ"
                  fullWidth
                  value={form.cnpj}
                  onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setDialogAberto(false)}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={salvando}>
              {salvando ? <CircularProgress size={22} color="inherit" /> : "Salvar"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </AppLayout>
  )
}
