/**
 * Tela "Startups" - lista das startups da incubadora (visao admin/mentor).
 *
 * Permite buscar por nome e filtrar por fase da trilha / status, alem de
 * criar uma nova startup. Cada linha leva para a pagina de detalhe
 * (/startups/:id).
 *
 * Endpoints:
 *   GET  /startups?id_tenant=  -> lista (com fase_atual e progresso_pct)
 *   GET  /trilha?id_tenant=    -> arvore da trilha; as fases saem dela (filtro)
 *   POST /startups             -> cria uma startup
 */
import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  InputAdornment,
  MenuItem,
  Chip,
  LinearProgress,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
} from "@mui/material"
import { Add, Search, RocketLaunch } from "@mui/icons-material"
import AppLayout from "../components/AppLayout"
import api from "../services/api"
import { useAuthStore } from "../store/authStore"
import { STATUS_ROTULO, STATUS_COR } from "../data/startupMeta"
import { MAX_CNPJ, cnpjValido, mascararCnpj, somenteDigitos } from "../utils/mascaras"

const FORM_VAZIO = { nome: "", cnpj: "", id_trilha: "" }

export default function Startups() {
  const navigate = useNavigate()
  const usuario = useAuthStore((s) => s.usuario)
  const idTenant = usuario?.id_tenant ?? null

  const [startups, setStartups] = useState([])
  const [fases, setFases] = useState([])
  // Trilhas da incubadora, para o seletor do cadastro.
  const [trilhas, setTrilhas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [aviso, setAviso] = useState(null)

  const [busca, setBusca] = useState("")
  const [filtroFase, setFiltroFase] = useState("todas")
  const [filtroStatus, setFiltroStatus] = useState("todos")

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
      const [startupsRes, trilhaRes, programasRes] = await Promise.all([
        api.get("/startups", { params: { id_tenant: idTenant } }),
        api.get("/trilha", { params: { id_tenant: idTenant } }),
        api.get("/trilha/programas", { params: { id_tenant: idTenant } }),
      ])
      setStartups(startupsRes.data.startups)
      // As fases do filtro sao os filhos diretos das trilhas. Com varias
      // trilhas o filtro passa a listar as fases de todas — o nome da fase e
      // o que a linha da tabela mostra, e ele nao diz de qual trilha veio.
      setFases(trilhaRes.data.trilha.flatMap((programa) => programa.filhos || []))
      setTrilhas(programasRes.data.programas)
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao carregar as startups." })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idTenant])

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return startups.filter((s) => {
      if (termo && !s.nome.toLowerCase().includes(termo)) return false
      if (filtroFase !== "todas" && (s.fase_atual || "Graduada") !== filtroFase) return false
      if (filtroStatus !== "todos" && s.status !== filtroStatus) return false
      return true
    })
  }, [startups, busca, filtroFase, filtroStatus])

  /**
   * Abre o cadastro com a trilha PADRAO ja escolhida — e so uma sugestao:
   * o campo continua editavel, e quem cadastra pode comecar a startup em
   * qualquer outra trilha.
   */
  const abrirCriacao = () => {
    const padrao = trilhas.find((t) => t.padrao) ?? trilhas[0]
    setForm({ ...FORM_VAZIO, id_trilha: padrao?.id_no ?? "" })
    setDialogAberto(true)
  }

  const alterarCampo = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }))

  const salvar = async (e) => {
    e.preventDefault()
    if (form.cnpj && !cnpjValido(form.cnpj)) {
      setAviso({ tipo: "error", texto: "CNPJ inválido — confira os números digitados." })
      return
    }
    setSalvando(true)
    setAviso(null)
    try {
      await api.post("/startups", {
        id_tenant: idTenant,
        nome: form.nome,
        // Sem mascara: a coluna e CHAR(14).
        cnpj: somenteDigitos(form.cnpj) || null,
        id_trilha: form.id_trilha || null,
      })
      setDialogAberto(false)
      await carregar()
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao criar a startup." })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <AppLayout>
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <RocketLaunch sx={{ color: "primary.main" }} />
            <Typography variant="h4" fontWeight={700}>
              Startups
            </Typography>
          </Box>
          <Button data-tour="startups-nova" variant="contained" startIcon={<Add />} onClick={abrirCriacao}>
            Nova Startup
          </Button>
        </Box>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Acompanhe todas as startups incubadas e o progresso de cada uma na trilha.
        </Typography>

        {aviso && (
          <Alert severity={aviso.tipo} sx={{ mb: 3 }} onClose={() => setAviso(null)}>
            {aviso.texto}
          </Alert>
        )}

        <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap" }}>
          <TextField
            data-tour="startups-busca"
            placeholder="Pesquisar..."
            size="small"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            sx={{ flex: 1, minWidth: 220 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            data-tour="startups-filtros"
            select
            size="small"
            label="Fase"
            value={filtroFase}
            onChange={(e) => setFiltroFase(e.target.value)}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="todas">Todas as fases</MenuItem>
            {fases.map((f) => (
              <MenuItem key={f.id_no} value={f.nome}>
                {f.nome}
              </MenuItem>
            ))}
            <MenuItem value="Graduada">Graduada</MenuItem>
          </TextField>
          <TextField
            data-tour="startups-filtros"
            select
            size="small"
            label="Status"
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="todos">Todos os status</MenuItem>
            {Object.entries(STATUS_ROTULO).map(([valor, rotulo]) => (
              <MenuItem key={valor} value={valor}>
                {rotulo}
              </MenuItem>
            ))}
          </TextField>
        </Box>

        <Paper data-tour="startups-lista" sx={{ borderRadius: 0, overflow: "hidden" }}>
          {carregando ? (
            <Box sx={{ textAlign: "center", py: 6 }}>
              <CircularProgress />
            </Box>
          ) : filtradas.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 6, color: "text.secondary" }}>
              <RocketLaunch sx={{ fontSize: 48, opacity: 0.4 }} />
              <Typography sx={{ mt: 1 }}>Nenhuma startup encontrada.</Typography>
            </Box>
          ) : (
            filtradas.map((s, i) => (
              <Box
                key={s.id_startup}
                onClick={() => navigate(`/startups/${s.id_startup}`)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  px: 3,
                  py: 2,
                  cursor: "pointer",
                  borderTop: i === 0 ? "none" : "1px solid",
                  borderColor: "divider",
                  "&:hover": { bgcolor: "action.hover" },
                }}
              >
                <Typography fontWeight={600} sx={{ flex: "1 1 220px", minWidth: 0 }} noWrap>
                  {s.nome}
                </Typography>
                <Chip
                  size="small"
                  label={s.fase_atual || "Graduada"}
                  sx={{ flex: "0 0 160px" }}
                  variant="outlined"
                />
                <Chip
                  size="small"
                  label={STATUS_ROTULO[s.status] || s.status}
                  color={STATUS_COR[s.status] || "default"}
                  sx={{ flex: "0 0 110px" }}
                />
                <Box sx={{ flex: "1 1 200px", display: "flex", alignItems: "center", gap: 1, minWidth: 140 }}>
                  <LinearProgress
                    variant="determinate"
                    value={s.progresso_pct}
                    sx={{ flex: 1, height: 8, borderRadius: 4 }}
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ width: 40, textAlign: "right" }}>
                    {s.progresso_pct}%
                  </Typography>
                </Box>
              </Box>
            ))
          )}
        </Paper>
      </Box>

      <Dialog open={dialogAberto} onClose={() => setDialogAberto(false)} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={salvar}>
          <DialogTitle>Nova startup</DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label="Nome"
                  fullWidth
                  required
                  autoFocus
                  value={form.nome}
                  onChange={(e) => alterarCampo("nome", e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="CNPJ"
                  fullWidth
                  value={form.cnpj}
                  onChange={(e) => alterarCampo("cnpj", mascararCnpj(e.target.value))}
                  placeholder="12.345.678/0001-95"
                  inputProps={{ maxLength: MAX_CNPJ, inputMode: "numeric" }}
                  error={Boolean(form.cnpj) && !cnpjValido(form.cnpj)}
                  helperText={form.cnpj && !cnpjValido(form.cnpj) ? "CNPJ inválido." : "Opcional."}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  select
                  label="Trilha"
                  fullWidth
                  value={form.id_trilha}
                  onChange={(e) => alterarCampo("id_trilha", e.target.value)}
                  disabled={trilhas.length === 0}
                  helperText={
                    trilhas.length === 0
                      ? "Sua incubadora ainda não tem trilhas. A startup será criada sem trilha."
                      : "A trilha padrão já vem escolhida — troque se esta startup começa em outra."
                  }
                >
                  <MenuItem value="">
                    <em>Sem trilha por enquanto</em>
                  </MenuItem>
                  {trilhas.map((t) => (
                    <MenuItem key={t.id_no} value={t.id_no}>
                      {t.nome}
                      {t.padrao ? " (padrão)" : ""}
                    </MenuItem>
                  ))}
                </TextField>
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
