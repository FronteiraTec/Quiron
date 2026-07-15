/**
 * Aba "Modelos": sub-abas Business Model Canvas / Matriz GUT / 5W2H.
 * Usada tanto em MinhaStartup quanto em StartupDetail.
 */
import { useEffect, useState } from "react"
import {
  Box,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Grid,
  Alert,
  CircularProgress,
  Tooltip,
  Typography,
} from "@mui/material"
import { Add, Delete } from "@mui/icons-material"
import api from "../../services/api"

export default function AbaModelos({ idStartup }) {
  const [modelo, setModelo] = useState("canvas")

  return (
    <>
      <Tabs value={modelo} onChange={(_, v) => setModelo(v)} sx={{ mb: 2 }}>
        <Tab value="canvas" label="Business Model Canvas" sx={{ textTransform: "none" }} />
        <Tab value="gut" label="Matriz GUT" sx={{ textTransform: "none" }} />
        <Tab value="5w2h" label="5W2H" sx={{ textTransform: "none" }} />
      </Tabs>
      {modelo === "canvas" && <ModeloCanvas idStartup={idStartup} />}
      {modelo === "gut" && <ModeloGut idStartup={idStartup} />}
      {modelo === "5w2h" && <Modelo5w2h idStartup={idStartup} />}
    </>
  )
}

const BLOCOS_CANVAS = [
  { chave: "parcerias_chave", titulo: "Parcerias-chave", area: "parcerias" },
  { chave: "atividades_chave", titulo: "Atividades-chave", area: "atividades" },
  { chave: "recursos_chave", titulo: "Recursos-chave", area: "recursos" },
  { chave: "proposta_valor", titulo: "Proposta de valor", area: "proposta" },
  { chave: "relacionamento_clientes", titulo: "Relacionamento com clientes", area: "relacionamento" },
  { chave: "canais", titulo: "Canais", area: "canais" },
  { chave: "segmentos_clientes", titulo: "Segmentos de clientes", area: "segmentos" },
  { chave: "estrutura_custos", titulo: "Estrutura de custos", area: "custos" },
  { chave: "fontes_receita", titulo: "Fontes de receita", area: "receita" },
]

function ModeloCanvas({ idStartup }) {
  const [blocos, setBlocos] = useState({})
  const [carregando, setCarregando] = useState(true)
  const [aviso, setAviso] = useState(null)

  useEffect(() => {
    setCarregando(true)
    api
      .get(`/startups/${idStartup}/canvas`)
      .then(({ data }) => {
        const mapa = {}
        data.blocos.forEach((b) => (mapa[b.bloco] = b.conteudo))
        setBlocos(mapa)
      })
      .catch((err) => setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao carregar o canvas." }))
      .finally(() => setCarregando(false))
  }, [idStartup])

  const salvarBloco = async (bloco, conteudo) => {
    try {
      await api.put(`/startups/${idStartup}/canvas/${bloco}`, { conteudo })
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao salvar o bloco." })
    }
  }

  if (carregando) {
    return (
      <Box sx={{ textAlign: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <>
      {aviso && (
        <Alert severity={aviso.tipo} sx={{ mb: 2 }} onClose={() => setAviso(null)}>
          {aviso.texto}
        </Alert>
      )}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gridTemplateRows: "auto auto auto",
          gridTemplateAreas: `
            "parcerias atividades proposta relacionamento segmentos"
            "parcerias recursos proposta canais segmentos"
            "custos custos custos receita receita"
          `,
          gap: 1.5,
        }}
      >
        {BLOCOS_CANVAS.map((b) => (
          <Box key={b.chave} sx={{ gridArea: b.area }}>
            <Typography variant="caption" fontWeight={700} color="text.secondary">
              {b.titulo}
            </Typography>
            <TextField
              fullWidth
              multiline
              minRows={4}
              size="small"
              defaultValue={blocos[b.chave] || ""}
              onBlur={(e) => salvarBloco(b.chave, e.target.value)}
            />
          </Box>
        ))}
      </Box>
    </>
  )
}

const NOTAS = [1, 2, 3, 4, 5]

function ModeloGut({ idStartup }) {
  const [itens, setItens] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [aviso, setAviso] = useState(null)
  const [dialogAberto, setDialogAberto] = useState(false)

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

  const remover = async (idGut) => {
    if (!window.confirm("Excluir este item?")) return
    try {
      await api.delete(`/startups/${idStartup}/gut/${idGut}`)
      await carregar()
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao excluir o item." })
    }
  }

  return (
    <>
      {aviso && (
        <Alert severity={aviso.tipo} sx={{ mb: 2 }} onClose={() => setAviso(null)}>
          {aviso.texto}
        </Alert>
      )}
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <Button variant="contained" startIcon={<Add />} onClick={() => setDialogAberto(true)}>
          Novo item
        </Button>
      </Box>

      {carregando ? (
        <Box sx={{ textAlign: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : itens.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 6, color: "text.secondary" }}>
          <Typography>Nenhum item cadastrado ainda.</Typography>
        </Box>
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Problema</TableCell>
                <TableCell align="center">Gravidade</TableCell>
                <TableCell align="center">Urgencia</TableCell>
                <TableCell align="center">Tendencia</TableCell>
                <TableCell align="center">Prioridade</TableCell>
                <TableCell align="center" width={70}>
                  Acoes
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {itens.map((i) => (
                <TableRow key={i.id_gut} hover>
                  <TableCell>{i.problema}</TableCell>
                  <TableCell align="center">{i.gravidade}</TableCell>
                  <TableCell align="center">{i.urgencia}</TableCell>
                  <TableCell align="center">{i.tendencia}</TableCell>
                  <TableCell align="center">
                    <Chip size="small" label={i.prioridade} color={i.prioridade >= 60 ? "error" : "default"} />
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="Excluir">
                      <IconButton size="small" color="error" onClick={() => remover(i.id_gut)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <DialogNovoItemGut
        aberto={dialogAberto}
        onFechar={() => setDialogAberto(false)}
        idStartup={idStartup}
        onCriado={async () => {
          setDialogAberto(false)
          await carregar()
        }}
      />
    </>
  )
}

function DialogNovoItemGut({ aberto, onFechar, idStartup, onCriado }) {
  const FORM_VAZIO = { problema: "", gravidade: 3, urgencia: 3, tendencia: 3 }
  const [form, setForm] = useState(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState(null)

  const alterarCampo = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }))

  const salvar = async (e) => {
    e.preventDefault()
    setSalvando(true)
    setAviso(null)
    try {
      await api.post(`/startups/${idStartup}/gut`, form)
      setForm(FORM_VAZIO)
      await onCriado()
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao criar o item." })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={aberto} onClose={onFechar} maxWidth="sm" fullWidth>
      <Box component="form" onSubmit={salvar}>
        <DialogTitle>Novo item da matriz GUT</DialogTitle>
        <DialogContent dividers>
          {aviso && (
            <Alert severity={aviso.tipo} sx={{ mb: 2 }} onClose={() => setAviso(null)}>
              {aviso.texto}
            </Alert>
          )}
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                label="Problema"
                fullWidth
                required
                autoFocus
                value={form.problema}
                onChange={(e) => alterarCampo("problema", e.target.value)}
              />
            </Grid>
            {["gravidade", "urgencia", "tendencia"].map((campo) => (
              <Grid item xs={4} key={campo}>
                <TextField
                  select
                  label={campo[0].toUpperCase() + campo.slice(1)}
                  fullWidth
                  value={form[campo]}
                  onChange={(e) => alterarCampo(campo, Number(e.target.value))}
                >
                  {NOTAS.map((n) => (
                    <MenuItem key={n} value={n}>
                      {n}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onFechar}>Cancelar</Button>
          <Button type="submit" variant="contained" disabled={salvando}>
            {salvando ? <CircularProgress size={22} color="inherit" /> : "Criar"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}

const CAMPOS_5W2H = [
  { chave: "o_que", rotulo: "O que" },
  { chave: "por_que", rotulo: "Por que" },
  { chave: "onde", rotulo: "Onde" },
  { chave: "quando", rotulo: "Quando" },
  { chave: "quem", rotulo: "Quem" },
  { chave: "como", rotulo: "Como" },
  { chave: "quanto_custa", rotulo: "Quanto custa" },
]

function Modelo5w2h({ idStartup }) {
  const [itens, setItens] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [aviso, setAviso] = useState(null)
  const [dialogAberto, setDialogAberto] = useState(false)

  const carregar = async () => {
    setCarregando(true)
    try {
      const { data } = await api.get(`/startups/${idStartup}/5w2h`)
      setItens(data.itens)
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao carregar o 5W2H." })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idStartup])

  const remover = async (id) => {
    if (!window.confirm("Excluir este item?")) return
    try {
      await api.delete(`/startups/${idStartup}/5w2h/${id}`)
      await carregar()
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao excluir o item." })
    }
  }

  return (
    <>
      {aviso && (
        <Alert severity={aviso.tipo} sx={{ mb: 2 }} onClose={() => setAviso(null)}>
          {aviso.texto}
        </Alert>
      )}
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <Button variant="contained" startIcon={<Add />} onClick={() => setDialogAberto(true)}>
          Novo item
        </Button>
      </Box>

      {carregando ? (
        <Box sx={{ textAlign: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : itens.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 6, color: "text.secondary" }}>
          <Typography>Nenhum item cadastrado ainda.</Typography>
        </Box>
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                {CAMPOS_5W2H.map((c) => (
                  <TableCell key={c.chave}>{c.rotulo}</TableCell>
                ))}
                <TableCell align="center" width={70}>
                  Acoes
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {itens.map((i) => (
                <TableRow key={i.id_5w2h} hover>
                  {CAMPOS_5W2H.map((c) => (
                    <TableCell key={c.chave}>{i[c.chave]}</TableCell>
                  ))}
                  <TableCell align="center">
                    <Tooltip title="Excluir">
                      <IconButton size="small" color="error" onClick={() => remover(i.id_5w2h)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <DialogNovoItem5w2h
        aberto={dialogAberto}
        onFechar={() => setDialogAberto(false)}
        idStartup={idStartup}
        onCriado={async () => {
          setDialogAberto(false)
          await carregar()
        }}
      />
    </>
  )
}

function DialogNovoItem5w2h({ aberto, onFechar, idStartup, onCriado }) {
  const FORM_VAZIO = { o_que: "", por_que: "", onde: "", quando: "", quem: "", como: "", quanto_custa: "" }
  const [form, setForm] = useState(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState(null)

  const alterarCampo = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }))

  const salvar = async (e) => {
    e.preventDefault()
    setSalvando(true)
    setAviso(null)
    try {
      await api.post(`/startups/${idStartup}/5w2h`, form)
      setForm(FORM_VAZIO)
      await onCriado()
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao criar o item." })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={aberto} onClose={onFechar} maxWidth="sm" fullWidth>
      <Box component="form" onSubmit={salvar}>
        <DialogTitle>Novo item 5W2H</DialogTitle>
        <DialogContent dividers>
          {aviso && (
            <Alert severity={aviso.tipo} sx={{ mb: 2 }} onClose={() => setAviso(null)}>
              {aviso.texto}
            </Alert>
          )}
          <Grid container spacing={2}>
            {CAMPOS_5W2H.map((c) => (
              <Grid item xs={12} sm={6} key={c.chave}>
                <TextField
                  label={c.rotulo}
                  fullWidth
                  required={c.chave === "o_que"}
                  autoFocus={c.chave === "o_que"}
                  value={form[c.chave]}
                  onChange={(e) => alterarCampo(c.chave, e.target.value)}
                />
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onFechar}>Cancelar</Button>
          <Button type="submit" variant="contained" disabled={salvando}>
            {salvando ? <CircularProgress size={22} color="inherit" /> : "Criar"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}
