/**
 * Tela de gestao de Tenants (incubadoras) — exclusiva do usuario ROOT.
 *
 * Permite ao root:
 *   - listar todas as incubadoras da plataforma (com contagens de uso);
 *   - criar uma nova incubadora;
 *   - editar os dados cadastrais e os limites de uso;
 *   - ativar / desativar uma incubadora.
 *
 * Endpoints (todos protegidos por root no backend):
 *   GET    /tenants            -> lista
 *   POST   /tenants            -> cria
 *   PUT    /tenants/:id        -> atualiza
 *   PATCH  /tenants/:id/status -> ativa/desativa
 */
import { useEffect, useState } from "react"
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
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Alert,
  CircularProgress,
  Switch,
  Stack,
  MenuItem,
  Divider,
} from "@mui/material"
import { Add, Edit, Apartment, Business, People, Key } from "@mui/icons-material"
import AppLayout from "../components/AppLayout"
import api from "../services/api"
import {
  MAX_CELULAR,
  celularValido,
  formatarCelular,
  mascararCelular,
  somenteDigitos,
} from "../utils/mascaras"

// Estado inicial em branco do formulario de criacao/edicao.
const FORM_VAZIO = {
  nome: "",
  email: "",
  celular: "",
  pais: "",
  estado: "",
  cidade: "",
  rua: "",
  qtd_usuarios: 5,
  qtd_startups: 10,
}

// Estado inicial do formulario de criacao de usuario da incubadora.
const USUARIO_VAZIO = { nome: "", email: "", celular: "", senha: "", papel: "usuario" }

const PAPEIS = [
  { valor: "admin", rotulo: "Admin" },
  { valor: "mentor", rotulo: "Mentor" },
  { valor: "usuario", rotulo: "Usuário" },
]

export default function Tenants() {
  const [tenants, setTenants] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [aviso, setAviso] = useState(null) // { tipo, texto }

  // Dialog de criacao/edicao.
  const [dialogAberto, setDialogAberto] = useState(false)
  const [editandoId, setEditandoId] = useState(null) // null => criacao
  const [form, setForm] = useState(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)

  // Dialog de usuarios da incubadora.
  const [usuariosDialog, setUsuariosDialog] = useState(null) // tenant selecionado ou null
  const [usuarios, setUsuarios] = useState([])
  const [carregandoUsuarios, setCarregandoUsuarios] = useState(false)
  const [usuarioForm, setUsuarioForm] = useState(USUARIO_VAZIO)
  const [salvandoUsuario, setSalvandoUsuario] = useState(false)
  const [avisoUsuario, setAvisoUsuario] = useState(null) // { tipo, texto }

  const carregar = async () => {
    setCarregando(true)
    try {
      const { data } = await api.get("/tenants")
      setTenants(data.tenants)
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao carregar incubadoras." })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  const abrirCriacao = () => {
    setEditandoId(null)
    setForm(FORM_VAZIO)
    setDialogAberto(true)
  }

  const abrirEdicao = (t) => {
    setEditandoId(t.id_tenant)
    setForm({
      nome: t.nome || "",
      email: t.email || "",
      celular: mascararCelular(t.celular || ""),
      pais: t.pais || "",
      estado: t.estado || "",
      cidade: t.cidade || "",
      rua: t.rua || "",
      qtd_usuarios: t.qtd_usuarios ?? 5,
      qtd_startups: t.qtd_startups ?? 10,
    })
    setDialogAberto(true)
  }

  const alterarCampo = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }))

  const salvar = async (e) => {
    e.preventDefault()
    if (!celularValido(form.celular)) {
      setAviso({ tipo: "error", texto: "Informe um celular válido, com DDD." })
      return
    }
    setAviso(null)
    setSalvando(true)
    try {
      const payload = {
        ...form,
        // O banco guarda o celular sem mascara (VARCHAR(15)).
        celular: somenteDigitos(form.celular),
        qtd_usuarios: Number(form.qtd_usuarios),
        qtd_startups: Number(form.qtd_startups),
      }
      if (editandoId) {
        await api.put(`/tenants/${editandoId}`, payload)
        setAviso({ tipo: "success", texto: "Incubadora atualizada com sucesso." })
      } else {
        await api.post("/tenants", payload)
        setAviso({ tipo: "success", texto: "Incubadora criada com sucesso." })
      }
      setDialogAberto(false)
      await carregar()
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao salvar a incubadora." })
    } finally {
      setSalvando(false)
    }
  }

  const alternarStatus = async (t) => {
    setAviso(null)
    try {
      await api.patch(`/tenants/${t.id_tenant}/status`, { ativo: !t.ativo })
      await carregar()
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao alterar o status." })
    }
  }

  // ---------------- Usuarios da incubadora ----------------

  const carregarUsuarios = async (idTenant) => {
    setCarregandoUsuarios(true)
    try {
      const { data } = await api.get(`/tenants/${idTenant}/usuarios`)
      setUsuarios(data.usuarios)
    } catch (err) {
      setAvisoUsuario({ tipo: "error", texto: err.response?.data?.erro || "Erro ao carregar usuários." })
    } finally {
      setCarregandoUsuarios(false)
    }
  }

  const abrirUsuarios = (t) => {
    setUsuariosDialog(t)
    setUsuarios([])
    setUsuarioForm(USUARIO_VAZIO)
    setAvisoUsuario(null)
    carregarUsuarios(t.id_tenant)
  }

  const alterarUsuarioCampo = (campo, valor) => setUsuarioForm((f) => ({ ...f, [campo]: valor }))

  const criarUsuario = async (e) => {
    e.preventDefault()
    if (!celularValido(usuarioForm.celular)) {
      setAvisoUsuario({ tipo: "error", texto: "Informe um celular válido, com DDD." })
      return
    }
    setAvisoUsuario(null)
    setSalvandoUsuario(true)
    try {
      await api.post(`/tenants/${usuariosDialog.id_tenant}/usuarios`, {
        ...usuarioForm,
        celular: somenteDigitos(usuarioForm.celular),
      })
      setAvisoUsuario({
        tipo: "success",
        texto: "Usuário criado. Ele deverá redefinir a senha no primeiro acesso.",
      })
      setUsuarioForm(USUARIO_VAZIO)
      await carregarUsuarios(usuariosDialog.id_tenant)
      await carregar() // atualiza a contagem de usuarios na tabela
    } catch (err) {
      setAvisoUsuario({ tipo: "error", texto: err.response?.data?.erro || "Erro ao criar o usuário." })
    } finally {
      setSalvandoUsuario(false)
    }
  }

  return (
    <AppLayout>
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Business sx={{ color: "primary.main" }} />
            <Typography variant="h4" fontWeight={700}>
              Incubadoras
            </Typography>
          </Box>
          <Button data-tour="tenants-nova" variant="contained" startIcon={<Add />} onClick={abrirCriacao}>
            Nova incubadora
          </Button>
        </Box>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Gerencie todas as incubadoras (tenants) da plataforma.
        </Typography>

        {aviso && (
          <Alert severity={aviso.tipo} sx={{ mb: 3 }} onClose={() => setAviso(null)}>
            {aviso.texto}
          </Alert>
        )}

        <Paper data-tour="tenants-lista" sx={{ borderRadius: 0, overflow: "hidden" }}>
          {carregando ? (
            <Box sx={{ textAlign: "center", py: 6 }}>
              <CircularProgress />
            </Box>
          ) : tenants.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 6, color: "text.secondary" }}>
              <Apartment sx={{ fontSize: 48, opacity: 0.4 }} />
              <Typography sx={{ mt: 1 }}>Nenhuma incubadora cadastrada.</Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Nome</TableCell>
                    <TableCell>Contato</TableCell>
                    <TableCell>Local</TableCell>
                    <TableCell align="center">Usuários</TableCell>
                    <TableCell align="center">Startups</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell align="right">Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tenants.map((t) => (
                    <TableRow key={t.id_tenant} hover>
                      <TableCell>
                        <Typography fontWeight={600}>{t.nome}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{t.email}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {formatarCelular(t.celular)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {t.cidade} / {t.estado}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {t.pais}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        {t.total_usuarios} / {t.qtd_usuarios}
                      </TableCell>
                      <TableCell align="center">
                        {t.total_startups} / {t.qtd_startups}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          size="small"
                          label={t.ativo ? "Ativa" : "Inativa"}
                          color={t.ativo ? "success" : "default"}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center">
                          <Tooltip title="Usuários">
                            <IconButton size="small" onClick={() => abrirUsuarios(t)}>
                              <People fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Editar">
                            <IconButton size="small" onClick={() => abrirEdicao(t)}>
                              <Edit fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={t.ativo ? "Desativar" : "Ativar"}>
                            <Switch
                              size="small"
                              checked={t.ativo}
                              onChange={() => alternarStatus(t)}
                            />
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Box>

      {/* ---------------- Dialog de criacao / edicao ---------------- */}
      <Dialog open={dialogAberto} onClose={() => setDialogAberto(false)} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={salvar}>
          <DialogTitle>{editandoId ? "Editar incubadora" : "Nova incubadora"}</DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label="Nome"
                  fullWidth
                  required
                  value={form.nome}
                  onChange={(e) => alterarCampo("nome", e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="E-mail"
                  type="email"
                  fullWidth
                  required
                  value={form.email}
                  onChange={(e) => alterarCampo("email", e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Celular"
                  fullWidth
                  required
                  value={form.celular}
                  onChange={(e) => alterarCampo("celular", mascararCelular(e.target.value))}
                  placeholder="(11) 98765-4321"
                  inputProps={{ maxLength: MAX_CELULAR, inputMode: "numeric" }}
                  error={Boolean(form.celular) && !celularValido(form.celular)}
                  helperText={
                    form.celular && !celularValido(form.celular) ? "Informe o DDD e o número completo." : undefined
                  }
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="País"
                  fullWidth
                  required
                  value={form.pais}
                  onChange={(e) => alterarCampo("pais", e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Estado"
                  fullWidth
                  required
                  value={form.estado}
                  onChange={(e) => alterarCampo("estado", e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Cidade"
                  fullWidth
                  required
                  value={form.cidade}
                  onChange={(e) => alterarCampo("cidade", e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Rua"
                  fullWidth
                  required
                  value={form.rua}
                  onChange={(e) => alterarCampo("rua", e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Limite de usuários"
                  type="number"
                  fullWidth
                  inputProps={{ min: 1 }}
                  value={form.qtd_usuarios}
                  onChange={(e) => alterarCampo("qtd_usuarios", e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Limite de startups"
                  type="number"
                  fullWidth
                  inputProps={{ min: 1 }}
                  value={form.qtd_startups}
                  onChange={(e) => alterarCampo("qtd_startups", e.target.value)}
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

      {/* ---------------- Dialog de usuarios da incubadora ---------------- */}
      <Dialog
        open={Boolean(usuariosDialog)}
        onClose={() => setUsuariosDialog(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Usuários — {usuariosDialog?.nome}</DialogTitle>
        <DialogContent dividers>
          {avisoUsuario && (
            <Alert severity={avisoUsuario.tipo} sx={{ mb: 2 }} onClose={() => setAvisoUsuario(null)}>
              {avisoUsuario.texto}
            </Alert>
          )}

          {/* Formulario de criacao de usuario com senha provisoria */}
          <Box component="form" onSubmit={criarUsuario} sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, display: "flex", alignItems: "center", gap: 0.5 }}>
              <Add fontSize="small" /> Novo usuário
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Nome"
                  fullWidth
                  required
                  size="small"
                  value={usuarioForm.nome}
                  onChange={(e) => alterarUsuarioCampo("nome", e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="E-mail"
                  type="email"
                  fullWidth
                  required
                  size="small"
                  value={usuarioForm.email}
                  onChange={(e) => alterarUsuarioCampo("email", e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Celular"
                  fullWidth
                  required
                  size="small"
                  value={usuarioForm.celular}
                  onChange={(e) => alterarUsuarioCampo("celular", mascararCelular(e.target.value))}
                  placeholder="(11) 98765-4321"
                  inputProps={{ maxLength: MAX_CELULAR, inputMode: "numeric" }}
                  error={Boolean(usuarioForm.celular) && !celularValido(usuarioForm.celular)}
                  helperText={
                    usuarioForm.celular && !celularValido(usuarioForm.celular)
                      ? "Informe o DDD e o número completo."
                      : undefined
                  }
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Senha provisória"
                  fullWidth
                  required
                  size="small"
                  value={usuarioForm.senha}
                  onChange={(e) => alterarUsuarioCampo("senha", e.target.value)}
                  helperText="Mínimo 6 caracteres"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Papel"
                  select
                  fullWidth
                  required
                  size="small"
                  value={usuarioForm.papel}
                  onChange={(e) => alterarUsuarioCampo("papel", e.target.value)}
                >
                  {PAPEIS.map((p) => (
                    <MenuItem key={p.valor} value={p.valor}>
                      {p.rotulo}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>
            <Box sx={{ mt: 2, textAlign: "right" }}>
              <Button type="submit" variant="contained" size="small" disabled={salvandoUsuario}>
                {salvandoUsuario ? <CircularProgress size={20} color="inherit" /> : "Criar usuário"}
              </Button>
            </Box>
          </Box>

          <Divider sx={{ mb: 2 }} />

          {/* Lista de usuarios vinculados */}
          {carregandoUsuarios ? (
            <Box sx={{ textAlign: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          ) : usuarios.length === 0 ? (
            <Typography color="text.secondary" sx={{ textAlign: "center", py: 3 }}>
              Nenhum usuário vinculado a esta incubadora.
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Nome</TableCell>
                    <TableCell>E-mail</TableCell>
                    <TableCell>Papel</TableCell>
                    <TableCell align="center">Senha</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {usuarios.map((u) => (
                    <TableRow key={u.id_usuario} hover>
                      <TableCell>{u.nome}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        <Chip size="small" label={u.papel} />
                      </TableCell>
                      <TableCell align="center">
                        {u.deve_redefinir_senha ? (
                          <Tooltip title="Senha provisória — será trocada no primeiro acesso">
                            <Chip size="small" color="warning" icon={<Key />} label="Provisória" />
                          </Tooltip>
                        ) : (
                          <Chip size="small" color="success" label="Definida" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setUsuariosDialog(null)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </AppLayout>
  )
}
