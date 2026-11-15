/**
 * Criar ou editar uma reuniao por video.
 *
 * O que vai no formulario e o que a reuniao controla do evento da Agenda
 * (titulo, categoria, horario, startup, descricao) mais os convidados. O
 * anfitriao e quem cria, e nao aparece na lista: ele sempre esta.
 *
 * "CONVIDAR A EQUIPE DA STARTUP" e o atalho do caso comum — a mentoria com
 * todos os membros da startup acompanhada. Acrescenta, nao substitui: quem ja
 * estava na lista continua.
 */
import { useEffect, useMemo, useState } from "react"
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material"
import { GroupAdd } from "@mui/icons-material"
import api from "../../services/api"
import { mensagemErro, reunioesApi } from "../../services/reunioesApi"
import { useAuthStore } from "../../store/authStore"
import {
  CATEGORIAS_REUNIAO,
  PAPEIS_INCUBADORA,
  corpoDoFormulario,
  formularioInicial,
  iniciais,
} from "../../data/reuniaoMeta"

export default function DialogReuniao({ aberto, reuniao, onFechar, onSalvo }) {
  const usuario = useAuthStore((s) => s.usuario)
  const idTenant = usuario?.id_tenant
  const editando = Boolean(reuniao)

  const [form, setForm] = useState(() => formularioInicial(reuniao))
  const [pessoas, setPessoas] = useState([])
  const [startups, setStartups] = useState([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    if (!aberto) return
    setForm(formularioInicial(reuniao))
    setErro(null)
  }, [aberto, reuniao])

  useEffect(() => {
    if (!aberto || !idTenant) return
    reunioesApi
      .convidaveis(idTenant)
      .then(setPessoas)
      .catch(() => setPessoas([]))
    // A lista de startups segue a permissao de startups: o mentor ve as que
    // acompanha. Sem ela, o campo fica vazio e a reuniao vai sem startup.
    api
      .get("/startups", { params: { id_tenant: idTenant } })
      .then(({ data }) => setStartups(data.startups || []))
      .catch(() => setStartups([]))
  }, [aberto, idTenant])

  const idAnfitriao = reuniao?.id_anfitriao ?? usuario?.id
  const opcoes = useMemo(() => pessoas.filter((p) => p.id_usuario !== idAnfitriao), [pessoas, idAnfitriao])
  const porId = useMemo(() => new Map(opcoes.map((p) => [p.id_usuario, p])), [opcoes])
  // Quem ja estava convidado mas nao veio na lista (saiu da incubadora) ainda
  // aparece, para a pessoa ver e decidir tirar.
  const selecionados = form.participantes.map(
    (id) => porId.get(id) || reuniao?.participantes?.find((p) => p.id_usuario === id) || { id_usuario: id, nome: `#${id}` }
  )

  const equipeDaStartup = useMemo(
    () => opcoes.filter((p) => p.startups?.some((s) => String(s.id_startup) === String(form.idStartup))),
    [opcoes, form.idStartup]
  )
  const faltamDaEquipe = equipeDaStartup.filter((p) => !form.participantes.includes(p.id_usuario))
  const nomeStartup = startups.find((s) => String(s.id_startup) === String(form.idStartup))?.nome

  const mudar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }))

  const salvar = async (e) => {
    e?.preventDefault()
    setErro(null)
    if (!form.titulo.trim()) return setErro("Dê um título à reunião.")
    if (!form.data || !form.horaInicio) return setErro("Informe a data e o horário de início.")
    if (form.horaFim && form.horaFim === form.horaInicio) return setErro("O fim precisa ser depois do início.")

    setSalvando(true)
    try {
      const corpo = corpoDoFormulario(form, editando ? null : idTenant)
      const salva = editando
        ? await reunioesApi.atualizar(reuniao.id_reuniao, corpo)
        : await reunioesApi.criar(corpo)
      onSalvo?.(salva)
    } catch (err) {
      setErro(mensagemErro(err, "Não foi possível salvar a reunião."))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={aberto} onClose={salvando ? undefined : onFechar} fullWidth maxWidth="sm" component="form" onSubmit={salvar}>
      <DialogTitle>{editando ? "Editar reunião" : "Nova reunião por vídeo"}</DialogTitle>
      <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2.25 }}>
        {erro && <Alert severity="error">{erro}</Alert>}

        <TextField
          label="Título"
          value={form.titulo}
          onChange={mudar("titulo")}
          required
          autoFocus
          inputProps={{ maxLength: 150 }}
          placeholder="Ex.: Mentoria de pitch"
        />

        <Box>
          <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.5 }}>
            Tipo
          </Typography>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={form.categoria}
            onChange={(_, valor) => valor && setForm((f) => ({ ...f, categoria: valor }))}
            aria-label="Tipo da reunião"
          >
            {CATEGORIAS_REUNIAO.map((c) => (
              <ToggleButton key={c.chave} value={c.chave} sx={{ px: 2, textTransform: "none", fontWeight: 600 }}>
                {c.rotulo}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "1.4fr 1fr 1fr" }, gap: 1.5 }}>
          <TextField
            label="Data"
            type="date"
            value={form.data}
            onChange={mudar("data")}
            required
            InputLabelProps={{ shrink: true }}
            sx={{ gridColumn: { xs: "1 / -1", sm: "auto" } }}
          />
          <TextField label="Início" type="time" value={form.horaInicio} onChange={mudar("horaInicio")} required InputLabelProps={{ shrink: true }} />
          <TextField label="Fim" type="time" value={form.horaFim} onChange={mudar("horaFim")} InputLabelProps={{ shrink: true }} />
        </Box>

        <TextField select label="Startup" value={form.idStartup} onChange={mudar("idStartup")} helperText="Opcional. A startup aparece na Agenda e no histórico.">
          <MenuItem value="">
            <em>Sem startup</em>
          </MenuItem>
          {startups.map((s) => (
            <MenuItem key={s.id_startup} value={s.id_startup}>
              {s.nome}
            </MenuItem>
          ))}
        </TextField>

        <Box>
          <Autocomplete
            multiple
            options={opcoes}
            value={selecionados}
            getOptionLabel={(p) => p.nome || ""}
            isOptionEqualToValue={(a, b) => a.id_usuario === b.id_usuario}
            onChange={(_, valor) => setForm((f) => ({ ...f, participantes: valor.map((p) => p.id_usuario) }))}
            filterSelectedOptions
            noOptionsText="Ninguém com esse nome nesta incubadora"
            renderOption={({ key, ...props }, p) => (
              <Box component="li" {...props} key={key ?? p.id_usuario} sx={{ display: "flex", gap: 1.25, alignItems: "center" }}>
                <Avatar sx={{ width: 28, height: 28, fontSize: 12 }}>{iniciais(p.nome)}</Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600} noWrap>
                    {p.nome}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap component="div">
                    {[PAPEIS_INCUBADORA[p.papel], ...(p.startups || []).map((s) => s.nome)].filter(Boolean).join(" · ")}
                  </Typography>
                </Box>
              </Box>
            )}
            renderTags={(valor, getTagProps) =>
              valor.map((p, i) => {
                const { key, ...props } = getTagProps({ index: i })
                return <Chip {...props} key={key ?? p.id_usuario} size="small" label={p.nome} />
              })
            }
            renderInput={(params) => (
              <TextField {...params} label="Convidados" placeholder={selecionados.length ? "" : "Busque pelo nome"} />
            )}
          />
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mt: 0.75, flexWrap: "wrap" }}>
            <Typography variant="caption" color="text.secondary">
              Você entra como anfitrião. Só quem está na lista entra na sala.
            </Typography>
            {form.idStartup && faltamDaEquipe.length > 0 && (
              <Button
                size="small"
                startIcon={<GroupAdd />}
                onClick={() =>
                  setForm((f) => ({ ...f, participantes: [...f.participantes, ...faltamDaEquipe.map((p) => p.id_usuario)] }))
                }
              >
                Convidar a equipe {nomeStartup ? `da ${nomeStartup}` : "da startup"} ({faltamDaEquipe.length})
              </Button>
            )}
          </Box>
        </Box>

        <TextField
          label="Pauta ou descrição"
          value={form.descricao}
          onChange={mudar("descricao")}
          multiline
          minRows={2}
          maxRows={8}
          inputProps={{ maxLength: 5000 }}
        />

        <Box>
          <FormControlLabel
            control={<Switch checked={form.gravarAudio !== false} onChange={(e) => setForm((f) => ({ ...f, gravarAudio: e.target.checked }))} />}
            label="Gravar e transcrever a fala de quem aceitar"
          />
          <Typography variant="caption" color="text.secondary" component="div" sx={{ ml: 6, mt: -0.5 }}>
            Cada pessoa decide, ao entrar, se a fala dela é gravada. Só funciona se a incubadora tiver configurado a transcrição.
          </Typography>
        </Box>

        <Typography variant="caption" color="text.secondary">
          O convite vai por e-mail e a reunião entra na Agenda de quem foi convidado. A sala abre 15 minutos antes do início.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onFechar} disabled={salvando}>
          Cancelar
        </Button>
        <Button type="submit" variant="contained" disabled={salvando} startIcon={salvando ? <CircularProgress size={16} /> : null}>
          {editando ? "Salvar" : "Criar reunião"}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
