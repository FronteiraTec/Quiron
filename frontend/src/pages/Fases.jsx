/**
 * Tela de Fases do programa de incubacao.
 *
 * A trilha da incubadora e organizada em Fases; cada fase contem Modulos e
 * cada modulo contem Tarefas. Esta tela cobre o primeiro nivel: listar e
 * criar as fases do tenant (incubadora) do usuario logado.
 *
 * Endpoints (protegidos por Bearer Token no backend):
 *   GET  /fases?id_tenant=  -> lista as fases do tenant, em ordem
 *   POST /fases             -> cria uma fase
 *
 * O id_tenant vem do usuario logado (authStore). Usuarios sem incubadora
 * vinculada (ex.: root) nao operam esta tela.
 */
import { useEffect, useMemo, useState } from "react"
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Alert,
  CircularProgress,
} from "@mui/material"
import { Add, Timeline } from "@mui/icons-material"
import AppLayout from "../components/AppLayout"
import api from "../services/api"
import { useAuthStore } from "../store/authStore"

// Estado inicial em branco do formulario de criacao.
const FORM_VAZIO = { nome: "", descricao: "", ordem: 1 }

export default function Fases() {
  const usuario = useAuthStore((s) => s.usuario)
  const idTenant = usuario?.id_tenant ?? null

  const [fases, setFases] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [aviso, setAviso] = useState(null) // { tipo, texto }

  // Dialog de criacao.
  const [dialogAberto, setDialogAberto] = useState(false)
  const [form, setForm] = useState(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)

  const carregar = async () => {
    if (!idTenant) {
      setCarregando(false)
      return
    }
    setCarregando(true)
    try {
      const { data } = await api.get("/fases", { params: { id_tenant: idTenant } })
      setFases(data.fases)
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao carregar as fases." })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idTenant])

  // Sugere a proxima ordem: a maior ordem existente + 1 (ou 1 se nao houver).
  const proximaOrdem = useMemo(
    () => (fases.length ? Math.max(...fases.map((f) => f.ordem)) + 1 : 1),
    [fases]
  )

  const abrirCriacao = () => {
    setAviso(null)
    setForm({ ...FORM_VAZIO, ordem: proximaOrdem })
    setDialogAberto(true)
  }

  const alterarCampo = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }))

  const salvar = async (e) => {
    e.preventDefault()
    setAviso(null)
    setSalvando(true)
    try {
      await api.post("/fases", {
        id_tenant: idTenant,
        nome: form.nome,
        descricao: form.descricao,
        ordem: Number(form.ordem),
      })
      setAviso({ tipo: "success", texto: "Fase criada com sucesso." })
      setDialogAberto(false)
      await carregar()
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao criar a fase." })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <AppLayout>
      <Box sx={{ maxWidth: 1000, mx: "auto" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Timeline sx={{ color: "primary.main" }} />
            <Typography variant="h4" fontWeight={700}>
              Fases
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={abrirCriacao}
            disabled={!idTenant}
          >
            Nova fase
          </Button>
        </Box>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Organize a trilha da incubadora em fases. Cada fase agrupa modulos e tarefas.
        </Typography>

        {aviso && (
          <Alert severity={aviso.tipo} sx={{ mb: 3 }} onClose={() => setAviso(null)}>
            {aviso.texto}
          </Alert>
        )}

        {!idTenant ? (
          <Alert severity="info">
            Seu usuario nao esta vinculado a nenhuma incubadora, entao nao ha fases para gerenciar.
          </Alert>
        ) : (
          <Paper sx={{ borderRadius: 3, overflow: "hidden" }}>
            {carregando ? (
              <Box sx={{ textAlign: "center", py: 6 }}>
                <CircularProgress />
              </Box>
            ) : fases.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 6, color: "text.secondary" }}>
                <Timeline sx={{ fontSize: 48, opacity: 0.4 }} />
                <Typography sx={{ mt: 1 }}>Nenhuma fase cadastrada ainda.</Typography>
                <Typography variant="body2">Clique em "Nova fase" para comecar a trilha.</Typography>
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell align="center" width={90}>
                        Ordem
                      </TableCell>
                      <TableCell>Nome</TableCell>
                      <TableCell>Descricao</TableCell>
                      <TableCell align="center" width={110}>
                        Status
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {fases.map((f) => (
                      <TableRow key={f.id_fase} hover>
                        <TableCell align="center">
                          <Chip size="small" label={f.ordem} />
                        </TableCell>
                        <TableCell>
                          <Typography fontWeight={600}>{f.nome}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {f.descricao}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            size="small"
                            label={f.ativa ? "Ativa" : "Inativa"}
                            color={f.ativa ? "success" : "default"}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        )}
      </Box>

      {/* ---------------- Dialog de criacao ---------------- */}
      <Dialog open={dialogAberto} onClose={() => setDialogAberto(false)} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={salvar}>
          <DialogTitle>Nova fase</DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={8}>
                <TextField
                  label="Nome"
                  fullWidth
                  required
                  autoFocus
                  value={form.nome}
                  onChange={(e) => alterarCampo("nome", e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Ordem"
                  type="number"
                  fullWidth
                  required
                  inputProps={{ min: 1 }}
                  value={form.ordem}
                  onChange={(e) => alterarCampo("ordem", e.target.value)}
                  helperText="Posicao na trilha"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Descricao"
                  fullWidth
                  required
                  multiline
                  minRows={3}
                  value={form.descricao}
                  onChange={(e) => alterarCampo("descricao", e.target.value)}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setDialogAberto(false)}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={salvando}>
              {salvando ? <CircularProgress size={22} color="inherit" /> : "Criar fase"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </AppLayout>
  )
}
