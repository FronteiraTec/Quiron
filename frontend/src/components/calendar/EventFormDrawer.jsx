/**
 * EventFormDrawer - drawer de criacao/edicao de uma atividade do calendario.
 * Usado pelo botao "Nova Atividade" e pelo "Editar" do EventDrawer.
 */
import { useEffect, useState } from "react"
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Button,
  Divider,
  TextField,
  MenuItem,
  Checkbox,
  ListItemText,
  Chip,
  Grid,
  Alert,
  CircularProgress,
  FormHelperText,
} from "@mui/material"
import { Close, Add, DeleteOutline } from "@mui/icons-material"
import { format } from "date-fns"
import { CATEGORIAS, LISTA_CATEGORIAS } from "./categorias"

const FORM_VAZIO = {
  titulo: "",
  categoria: "EVENTO",
  descricao: "",
  idsStartups: [],
  mentor_nome: "",
  local: "",
  data: format(new Date(), "yyyy-MM-dd"),
  horaInicio: "09:00",
  horaFim: "",
  vagas: "",
  anexos: [],
}

/** Converte um evento vindo da API para o shape do formulario. */
function eventoParaForm(evento) {
  const inicio = new Date(evento.inicio_ts)
  const fim = evento.fim_ts ? new Date(evento.fim_ts) : null
  return {
    titulo: evento.titulo,
    categoria: evento.categoria,
    descricao: evento.descricao || "",
    idsStartups: (evento.startups || []).map((s) => s.id_startup),
    mentor_nome: evento.mentor_nome || "",
    local: evento.local || "",
    data: format(inicio, "yyyy-MM-dd"),
    horaInicio: format(inicio, "HH:mm"),
    horaFim: fim ? format(fim, "HH:mm") : "",
    vagas: evento.vagas || "",
    anexos: evento.anexos || [],
  }
}

export default function EventFormDrawer({ aberto, onClose, onSalvar, startups = [], eventoEditar, dataInicial }) {
  const [form, setForm] = useState(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    if (!aberto) return
    if (eventoEditar) {
      setForm(eventoParaForm(eventoEditar))
    } else {
      setForm({ ...FORM_VAZIO, data: format(dataInicial || new Date(), "yyyy-MM-dd") })
    }
    setErro(null)
  }, [aberto, eventoEditar, dataInicial])

  const alterar = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }))

  const adicionarAnexo = () => alterar("anexos", [...form.anexos, { nome: "", url: "" }])
  const alterarAnexo = (i, campo, valor) => {
    const novos = [...form.anexos]
    novos[i] = { ...novos[i], [campo]: valor }
    alterar("anexos", novos)
  }
  const removerAnexo = (i) => alterar("anexos", form.anexos.filter((_, idx) => idx !== i))

  const salvar = async (e) => {
    e.preventDefault()
    setErro(null)
    setSalvando(true)
    try {
      await onSalvar({
        titulo: form.titulo,
        categoria: form.categoria,
        descricao: form.descricao || null,
        local: form.local || null,
        id_startups: form.idsStartups,
        mentor_nome: form.mentor_nome || null,
        anexos: form.anexos.filter((a) => a.nome || a.url),
        vagas: form.vagas ? Number(form.vagas) : null,
        inicio_ts: `${form.data}T${form.horaInicio}:00`,
        fim_ts: form.horaFim ? `${form.data}T${form.horaFim}:00` : null,
      })
      onClose()
    } catch (err) {
      setErro(err.response?.data?.erro || "Erro ao salvar a atividade.")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Drawer anchor="right" open={aberto} onClose={onClose}>
      <Box
        component="form"
        onSubmit={salvar}
        sx={{ width: 420, maxWidth: "100vw", height: "100%", display: "flex", flexDirection: "column" }}
      >
        <Box sx={{ p: 3, pb: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="h6" fontWeight={700}>
            {eventoEditar ? "Editar atividade" : "Nova atividade"}
          </Typography>
          <IconButton size="small" onClick={onClose}>
            <Close fontSize="small" />
          </IconButton>
        </Box>
        <Divider />

        <Box sx={{ flex: 1, overflowY: "auto", p: 3 }}>
          {erro && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro(null)}>
              {erro}
            </Alert>
          )}
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                label="Titulo"
                fullWidth
                required
                autoFocus
                value={form.titulo}
                onChange={(e) => alterar("titulo", e.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                select
                label="Categoria"
                fullWidth
                required
                value={form.categoria}
                onChange={(e) => alterar("categoria", e.target.value)}
              >
                {LISTA_CATEGORIAS.map((chave) => (
                  <MenuItem key={chave} value={chave}>
                    {CATEGORIAS[chave].label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={7}>
              <TextField
                label="Data"
                type="date"
                fullWidth
                required
                InputLabelProps={{ shrink: true }}
                value={form.data}
                onChange={(e) => alterar("data", e.target.value)}
              />
            </Grid>
            <Grid item xs={5}>
              <TextField
                label="Inicio"
                type="time"
                fullWidth
                required
                InputLabelProps={{ shrink: true }}
                value={form.horaInicio}
                onChange={(e) => alterar("horaInicio", e.target.value)}
              />
            </Grid>
            <Grid item xs={7}>
              <TextField
                label="Local"
                fullWidth
                value={form.local}
                onChange={(e) => alterar("local", e.target.value)}
              />
            </Grid>
            <Grid item xs={5}>
              <TextField
                label="Termino"
                type="time"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={form.horaFim}
                onChange={(e) => alterar("horaFim", e.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                select
                label="Startups"
                fullWidth
                value={form.idsStartups}
                onChange={(e) => {
                  const { value } = e.target
                  alterar("idsStartups", typeof value === "string" ? value.split(",") : value)
                }}
                SelectProps={{
                  multiple: true,
                  renderValue: (selecionados) =>
                    selecionados.length === 0 ? (
                      "Todas as startups (evento geral)"
                    ) : (
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                        {selecionados.map((id) => (
                          <Chip key={id} size="small" label={startups.find((s) => s.id_startup === id)?.nome || id} />
                        ))}
                      </Box>
                    ),
                }}
              >
                {startups.map((s) => (
                  <MenuItem key={s.id_startup} value={s.id_startup}>
                    <Checkbox size="small" checked={form.idsStartups.includes(s.id_startup)} />
                    <ListItemText primary={s.nome} />
                  </MenuItem>
                ))}
              </TextField>
              <FormHelperText>Deixe em branco para direcionar a todas as startups incubadas.</FormHelperText>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Mentor responsavel"
                fullWidth
                value={form.mentor_nome}
                onChange={(e) => alterar("mentor_nome", e.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Descricao"
                fullWidth
                multiline
                minRows={3}
                value={form.descricao}
                onChange={(e) => alterar("descricao", e.target.value)}
              />
            </Grid>

            <Grid item xs={12}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                <Typography variant="body2" fontWeight={600}>
                  Anexos
                </Typography>
                <Button size="small" startIcon={<Add />} onClick={adicionarAnexo}>
                  Adicionar
                </Button>
              </Box>
              {form.anexos.map((anexo, i) => (
                <Box key={i} sx={{ display: "flex", gap: 1, mb: 1 }}>
                  <TextField
                    size="small"
                    placeholder="Nome"
                    value={anexo.nome}
                    onChange={(e) => alterarAnexo(i, "nome", e.target.value)}
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    size="small"
                    placeholder="URL"
                    value={anexo.url}
                    onChange={(e) => alterarAnexo(i, "url", e.target.value)}
                    sx={{ flex: 1.5 }}
                  />
                  <IconButton size="small" onClick={() => removerAnexo(i)}>
                    <DeleteOutline fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </Grid>
          </Grid>
        </Box>

        <Divider />
        <Box sx={{ p: 2, display: "flex", gap: 1 }}>
          <Button fullWidth onClick={onClose}>
            Cancelar
          </Button>
          <Button fullWidth type="submit" variant="contained" disabled={salvando}>
            {salvando ? <CircularProgress size={22} color="inherit" /> : "Salvar"}
          </Button>
        </Box>
      </Box>
    </Drawer>
  )
}
