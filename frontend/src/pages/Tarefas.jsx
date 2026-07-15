/**
 * Tela de Tarefas do programa de incubacao.
 *
 * A trilha e: Fase -> Modulo -> Tarefa. Como uma tarefa pertence a um modulo
 * (que pertence a uma fase), esta tela tem dois seletores em cascata no topo:
 * escolhe-se a fase, depois o modulo, e entao lista / cria as tarefas dele.
 *
 * Cada tarefa tem um tipo: Texto, Anexo, Video ou Questionario.
 *
 * Endpoints (protegidos por Bearer Token no backend):
 *   GET  /fases?id_tenant=    -> fases do tenant (1o seletor)
 *   GET  /modulos?id_fase=    -> modulos da fase (2o seletor)
 *   GET  /tarefas?id_modulo=  -> tarefas do modulo, em ordem
 *   POST /tarefas             -> cria uma tarefa
 *
 * O id_tenant vem do usuario logado (authStore).
 */
import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
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
  FormControlLabel,
  Switch,
  Stack,
  Grid,
  Alert,
  CircularProgress,
  Link as MuiLink,
} from "@mui/material"
import {
  Add,
  Assignment,
  Notes,
  AttachFile,
  Videocam,
  Quiz,
  OpenInNew,
} from "@mui/icons-material"
import AppLayout from "../components/AppLayout"
import api from "../services/api"
import { useAuthStore } from "../store/authStore"

// Tipos de tarefa: valor no backend (enum) + rotulo, icone e cor do chip.
const TIPOS = [
  { valor: "TEXTO", rotulo: "Texto", icone: <Notes fontSize="small" />, cor: "default" },
  { valor: "ANEXO", rotulo: "Anexo", icone: <AttachFile fontSize="small" />, cor: "info" },
  { valor: "VIDEO", rotulo: "Video", icone: <Videocam fontSize="small" />, cor: "warning" },
  { valor: "QUESTIONARIO", rotulo: "Questionario", icone: <Quiz fontSize="small" />, cor: "secondary" },
]
const TIPO_POR_VALOR = Object.fromEntries(TIPOS.map((t) => [t.valor, t]))

// Estado inicial em branco do formulario de criacao.
// anexo         -> link do Drive (tipos VIDEO/ANEXO)
// id_questionario -> questionario da plataforma (tipo QUESTIONARIO)
const FORM_VAZIO = {
  titulo: "",
  descricao: "",
  tipo: "TEXTO",
  ordem: 1,
  obrigatoria: true,
  anexo: "",
  id_questionario: "",
}

// Tipos que guardam um link de arquivo no Drive.
const TIPOS_COM_LINK = ["VIDEO", "ANEXO"]

export default function Tarefas() {
  const navigate = useNavigate()
  const usuario = useAuthStore((s) => s.usuario)
  const idTenant = usuario?.id_tenant ?? null

  const [fases, setFases] = useState([])
  const [faseId, setFaseId] = useState("")
  const [carregandoFases, setCarregandoFases] = useState(true)

  const [modulos, setModulos] = useState([])
  const [moduloId, setModuloId] = useState("")
  const [carregandoModulos, setCarregandoModulos] = useState(false)

  const [tarefas, setTarefas] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [aviso, setAviso] = useState(null) // { tipo, texto }

  // Questionarios do tenant (para tarefas do tipo QUESTIONARIO).
  const [questionarios, setQuestionarios] = useState([])

  // Dialog de criacao.
  const [dialogAberto, setDialogAberto] = useState(false)
  const [form, setForm] = useState(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)

  // 1) Carrega as fases do tenant.
  useEffect(() => {
    if (!idTenant) {
      setCarregandoFases(false)
      return
    }
    ;(async () => {
      setCarregandoFases(true)
      try {
        // Carrega em paralelo as fases (para o seletor) e os questionarios do
        // tenant (para tarefas do tipo QUESTIONARIO).
        const [fasesResp, questResp] = await Promise.all([
          api.get("/fases", { params: { id_tenant: idTenant } }),
          api.get("/questionarios", { params: { id_tenant: idTenant } }),
        ])
        setFases(fasesResp.data.fases)
        setQuestionarios(questResp.data.questionarios)
        if (fasesResp.data.fases.length) setFaseId(fasesResp.data.fases[0].id_fase)
      } catch (err) {
        setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao carregar as fases." })
      } finally {
        setCarregandoFases(false)
      }
    })()
  }, [idTenant])

  // 2) Ao trocar a fase, carrega seus modulos e seleciona o primeiro.
  useEffect(() => {
    if (!faseId) {
      setModulos([])
      setModuloId("")
      return
    }
    ;(async () => {
      setCarregandoModulos(true)
      try {
        const { data } = await api.get("/modulos", { params: { id_fase: faseId } })
        setModulos(data.modulos)
        setModuloId(data.modulos.length ? data.modulos[0].id_modulo : "")
      } catch (err) {
        setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao carregar os modulos." })
      } finally {
        setCarregandoModulos(false)
      }
    })()
  }, [faseId])

  const carregarTarefas = async (idModulo) => {
    if (!idModulo) {
      setTarefas([])
      return
    }
    setCarregando(true)
    try {
      const { data } = await api.get("/tarefas", { params: { id_modulo: idModulo } })
      setTarefas(data.tarefas)
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao carregar as tarefas." })
    } finally {
      setCarregando(false)
    }
  }

  // 3) Ao trocar o modulo, carrega suas tarefas.
  useEffect(() => {
    carregarTarefas(moduloId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduloId])

  // Sugere a proxima ordem: a maior ordem existente + 1 (ou 1 se nao houver).
  const proximaOrdem = useMemo(
    () => (tarefas.length ? Math.max(...tarefas.map((t) => t.ordem)) + 1 : 1),
    [tarefas]
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
      await api.post("/tarefas", {
        id_modulo: moduloId,
        titulo: form.titulo,
        descricao: form.descricao,
        tipo: form.tipo,
        ordem: Number(form.ordem),
        obrigatoria: form.obrigatoria,
        // Envia so a referencia relevante ao tipo; o backend valida/normaliza.
        anexo: TIPOS_COM_LINK.includes(form.tipo) ? form.anexo : null,
        id_questionario: form.tipo === "QUESTIONARIO" ? form.id_questionario : null,
      })
      setAviso({ tipo: "success", texto: "Tarefa criada com sucesso." })
      setDialogAberto(false)
      await carregarTarefas(moduloId)
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao criar a tarefa." })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <AppLayout>
      <Box sx={{ maxWidth: 1000, mx: "auto" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Assignment sx={{ color: "primary.main" }} />
            <Typography variant="h4" fontWeight={700}>
              Tarefas
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={abrirCriacao}
            disabled={!moduloId}
          >
            Nova tarefa
          </Button>
        </Box>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Escolha a fase e o modulo, depois adicione as tarefas (Texto, Anexo, Video ou Questionario).
        </Typography>

        {aviso && (
          <Alert severity={aviso.tipo} sx={{ mb: 3 }} onClose={() => setAviso(null)}>
            {aviso.texto}
          </Alert>
        )}

        {!idTenant ? (
          <Alert severity="info">
            Seu usuario nao esta vinculado a nenhuma incubadora, entao nao ha tarefas para gerenciar.
          </Alert>
        ) : carregandoFases ? (
          <Box sx={{ textAlign: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        ) : fases.length === 0 ? (
          <Alert severity="info">
            Nenhuma fase cadastrada ainda. Crie uma fase e um modulo antes de adicionar tarefas.
          </Alert>
        ) : (
          <>
            {/* Seletores em cascata: fase -> modulo */}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
              <TextField
                select
                label="Fase"
                value={faseId}
                onChange={(e) => setFaseId(e.target.value)}
                sx={{ minWidth: 260 }}
              >
                {fases.map((f) => (
                  <MenuItem key={f.id_fase} value={f.id_fase}>
                    {f.ordem}. {f.nome}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                label="Modulo"
                value={moduloId}
                onChange={(e) => setModuloId(e.target.value)}
                sx={{ minWidth: 260 }}
                disabled={carregandoModulos || modulos.length === 0}
                helperText={
                  !carregandoModulos && modulos.length === 0 ? "Esta fase nao tem modulos." : " "
                }
              >
                {modulos.map((m) => (
                  <MenuItem key={m.id_modulo} value={m.id_modulo}>
                    {m.ordem}. {m.nome}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>

            <Paper sx={{ borderRadius: 3, overflow: "hidden" }}>
              {carregando ? (
                <Box sx={{ textAlign: "center", py: 6 }}>
                  <CircularProgress />
                </Box>
              ) : !moduloId ? (
                <Box sx={{ textAlign: "center", py: 6, color: "text.secondary" }}>
                  <Assignment sx={{ fontSize: 48, opacity: 0.4 }} />
                  <Typography sx={{ mt: 1 }}>Selecione um modulo para ver as tarefas.</Typography>
                </Box>
              ) : tarefas.length === 0 ? (
                <Box sx={{ textAlign: "center", py: 6, color: "text.secondary" }}>
                  <Assignment sx={{ fontSize: 48, opacity: 0.4 }} />
                  <Typography sx={{ mt: 1 }}>Nenhuma tarefa neste modulo ainda.</Typography>
                  <Typography variant="body2">Clique em "Nova tarefa" para comecar.</Typography>
                </Box>
              ) : (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell align="center" width={80}>
                          Ordem
                        </TableCell>
                        <TableCell>Titulo</TableCell>
                        <TableCell width={150}>Tipo</TableCell>
                        <TableCell align="center" width={120}>
                          Obrigatoria
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {tarefas.map((t) => {
                        const tipo = TIPO_POR_VALOR[t.tipo] || {}
                        return (
                          <TableRow key={t.id_tarefa} hover>
                            <TableCell align="center">
                              <Chip size="small" label={t.ordem} />
                            </TableCell>
                            <TableCell>
                              <Typography fontWeight={600}>{t.titulo}</Typography>
                              {t.descricao && (
                                <Typography variant="body2" color="text.secondary">
                                  {t.descricao}
                                </Typography>
                              )}
                              {/* Referencia do conteudo, conforme o tipo. */}
                              {t.anexo && (
                                <MuiLink
                                  href={t.anexo}
                                  target="_blank"
                                  rel="noopener"
                                  variant="body2"
                                  sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, mt: 0.5 }}
                                >
                                  <OpenInNew sx={{ fontSize: 14 }} /> Abrir no Drive
                                </MuiLink>
                              )}
                              {t.questionario_titulo && (
                                <Box sx={{ mt: 0.5 }}>
                                  <Typography variant="body2" color="text.secondary">
                                    <Quiz sx={{ fontSize: 14, verticalAlign: "text-bottom", mr: 0.5 }} />
                                    {t.questionario_titulo}
                                  </Typography>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<Quiz />}
                                    sx={{ mt: 0.5 }}
                                    onClick={() => navigate(`/tarefas/${t.id_tarefa}/responder`)}
                                  >
                                    Responder
                                  </Button>
                                </Box>
                              )}
                            </TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                icon={tipo.icone}
                                label={tipo.rotulo || t.tipo}
                                color={tipo.cor || "default"}
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell align="center">
                              <Chip
                                size="small"
                                label={t.obrigatoria ? "Sim" : "Nao"}
                                color={t.obrigatoria ? "primary" : "default"}
                              />
                            </TableCell>
                          </TableRow>
                        )
                      })}
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
          <DialogTitle>Nova tarefa</DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={8}>
                <TextField
                  label="Titulo"
                  fullWidth
                  required
                  autoFocus
                  value={form.titulo}
                  onChange={(e) => alterarCampo("titulo", e.target.value)}
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
                  helperText="Posicao no modulo"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Tipo"
                  select
                  fullWidth
                  required
                  value={form.tipo}
                  onChange={(e) => alterarCampo("tipo", e.target.value)}
                >
                  {TIPOS.map((t) => (
                    <MenuItem key={t.valor} value={t.valor}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        {t.icone}
                        {t.rotulo}
                      </Box>
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6} sx={{ display: "flex", alignItems: "center" }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.obrigatoria}
                      onChange={(e) => alterarCampo("obrigatoria", e.target.checked)}
                    />
                  }
                  label="Tarefa obrigatoria"
                />
              </Grid>

              {/* Campo condicional: link do Drive (Video/Anexo) */}
              {TIPOS_COM_LINK.includes(form.tipo) && (
                <Grid item xs={12}>
                  <TextField
                    label={form.tipo === "VIDEO" ? "Link do video no Drive" : "Link do arquivo no Drive"}
                    fullWidth
                    required
                    type="url"
                    placeholder="https://drive.google.com/..."
                    value={form.anexo}
                    onChange={(e) => alterarCampo("anexo", e.target.value)}
                    helperText="Cole o link do Drive. O sistema apenas exibe/reproduz o conteudo."
                  />
                </Grid>
              )}

              {/* Campo condicional: questionario da plataforma (Questionario) */}
              {form.tipo === "QUESTIONARIO" && (
                <Grid item xs={12}>
                  {questionarios.length === 0 ? (
                    <Alert severity="warning">
                      Nenhum questionario cadastrado neste tenant. Crie um questionario antes de
                      usar este tipo de tarefa.
                    </Alert>
                  ) : (
                    <TextField
                      label="Questionario"
                      select
                      fullWidth
                      required
                      value={form.id_questionario}
                      onChange={(e) => alterarCampo("id_questionario", e.target.value)}
                      helperText="Questionario criado na plataforma"
                    >
                      {questionarios.map((q) => (
                        <MenuItem key={q.id_questionario} value={q.id_questionario}>
                          {q.titulo}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                </Grid>
              )}

              <Grid item xs={12}>
                <TextField
                  label="Descricao"
                  fullWidth
                  multiline
                  minRows={3}
                  value={form.descricao}
                  onChange={(e) => alterarCampo("descricao", e.target.value)}
                  helperText="Opcional"
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setDialogAberto(false)}>Cancelar</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={salvando || (form.tipo === "QUESTIONARIO" && questionarios.length === 0)}
            >
              {salvando ? <CircularProgress size={22} color="inherit" /> : "Criar tarefa"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </AppLayout>
  )
}
