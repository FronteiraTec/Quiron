/**
 * Tela de Modulos do programa de incubacao.
 *
 * Cada Fase da trilha agrupa Modulos (e cada modulo, por sua vez, agrupa
 * Tarefas). Como um modulo pertence a uma fase, esta tela primeiro pede a
 * fase (seletor no topo) e entao lista / cria os modulos dela.
 *
 * Endpoints (protegidos por Bearer Token no backend):
 *   GET  /fases?id_tenant=  -> fases do tenant (para o seletor)
 *   GET  /modulos?id_fase=  -> modulos da fase escolhida, em ordem
 *   POST /modulos           -> cria um modulo
 *
 * O id_tenant vem do usuario logado (authStore).
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
  MenuItem,
  Grid,
  Alert,
  CircularProgress,
} from "@mui/material"
import { Add, ViewModule } from "@mui/icons-material"
import AppLayout from "../components/AppLayout"
import api from "../services/api"
import { useAuthStore } from "../store/authStore"

// Estado inicial em branco do formulario de criacao.
const FORM_VAZIO = { nome: "", descricao: "", ordem: 1 }

export default function Modulos() {
  const usuario = useAuthStore((s) => s.usuario)
  const idTenant = usuario?.id_tenant ?? null

  const [fases, setFases] = useState([])
  const [faseId, setFaseId] = useState("") // fase selecionada
  const [carregandoFases, setCarregandoFases] = useState(true)

  const [modulos, setModulos] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [aviso, setAviso] = useState(null) // { tipo, texto }

  // Dialog de criacao.
  const [dialogAberto, setDialogAberto] = useState(false)
  const [form, setForm] = useState(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)

  // Carrega as fases do tenant (para o seletor).
  useEffect(() => {
    if (!idTenant) {
      setCarregandoFases(false)
      return
    }
    ;(async () => {
      setCarregandoFases(true)
      try {
        const { data } = await api.get("/fases", { params: { id_tenant: idTenant } })
        setFases(data.fases)
        // Ja seleciona a primeira fase, se houver.
        if (data.fases.length) setFaseId(data.fases[0].id_fase)
      } catch (err) {
        setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao carregar as fases." })
      } finally {
        setCarregandoFases(false)
      }
    })()
  }, [idTenant])

  const carregarModulos = async (idFase) => {
    if (!idFase) {
      setModulos([])
      return
    }
    setCarregando(true)
    try {
      const { data } = await api.get("/modulos", { params: { id_fase: idFase } })
      setModulos(data.modulos)
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao carregar os modulos." })
    } finally {
      setCarregando(false)
    }
  }

  // Recarrega os modulos sempre que a fase selecionada muda.
  useEffect(() => {
    carregarModulos(faseId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faseId])

  // Sugere a proxima ordem: a maior ordem existente + 1 (ou 1 se nao houver).
  const proximaOrdem = useMemo(
    () => (modulos.length ? Math.max(...modulos.map((m) => m.ordem)) + 1 : 1),
    [modulos]
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
      await api.post("/modulos", {
        id_fase: faseId,
        nome: form.nome,
        descricao: form.descricao,
        ordem: Number(form.ordem),
      })
      setAviso({ tipo: "success", texto: "Modulo criado com sucesso." })
      setDialogAberto(false)
      await carregarModulos(faseId)
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao criar o modulo." })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <AppLayout>
      <Box sx={{ maxWidth: 1000, mx: "auto" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <ViewModule sx={{ color: "primary.main" }} />
            <Typography variant="h4" fontWeight={700}>
              Modulos
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={abrirCriacao}
            disabled={!faseId}
          >
            Novo modulo
          </Button>
        </Box>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Escolha uma fase e organize seus modulos. Cada modulo agrupa tarefas.
        </Typography>

        {aviso && (
          <Alert severity={aviso.tipo} sx={{ mb: 3 }} onClose={() => setAviso(null)}>
            {aviso.texto}
          </Alert>
        )}

        {!idTenant ? (
          <Alert severity="info">
            Seu usuario nao esta vinculado a nenhuma incubadora, entao nao ha modulos para gerenciar.
          </Alert>
        ) : carregandoFases ? (
          <Box sx={{ textAlign: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        ) : fases.length === 0 ? (
          <Alert severity="info">
            Nenhuma fase cadastrada ainda. Crie uma fase antes de adicionar modulos.
          </Alert>
        ) : (
          <>
            {/* Seletor de fase */}
            <TextField
              select
              label="Fase"
              value={faseId}
              onChange={(e) => setFaseId(e.target.value)}
              sx={{ mb: 3, minWidth: 320 }}
            >
              {fases.map((f) => (
                <MenuItem key={f.id_fase} value={f.id_fase}>
                  {f.ordem}. {f.nome}
                </MenuItem>
              ))}
            </TextField>

            <Paper sx={{ borderRadius: 3, overflow: "hidden" }}>
              {carregando ? (
                <Box sx={{ textAlign: "center", py: 6 }}>
                  <CircularProgress />
                </Box>
              ) : modulos.length === 0 ? (
                <Box sx={{ textAlign: "center", py: 6, color: "text.secondary" }}>
                  <ViewModule sx={{ fontSize: 48, opacity: 0.4 }} />
                  <Typography sx={{ mt: 1 }}>Nenhum modulo nesta fase ainda.</Typography>
                  <Typography variant="body2">Clique em "Novo modulo" para comecar.</Typography>
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
                      {modulos.map((m) => (
                        <TableRow key={m.id_modulo} hover>
                          <TableCell align="center">
                            <Chip size="small" label={m.ordem} />
                          </TableCell>
                          <TableCell>
                            <Typography fontWeight={600}>{m.nome}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {m.descricao}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              size="small"
                              label={m.ativo ? "Ativo" : "Inativo"}
                              color={m.ativo ? "success" : "default"}
                            />
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
      </Box>

      {/* ---------------- Dialog de criacao ---------------- */}
      <Dialog open={dialogAberto} onClose={() => setDialogAberto(false)} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={salvar}>
          <DialogTitle>Novo modulo</DialogTitle>
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
                  helperText="Posicao na fase"
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
              {salvando ? <CircularProgress size={22} color="inherit" /> : "Criar modulo"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </AppLayout>
  )
}
