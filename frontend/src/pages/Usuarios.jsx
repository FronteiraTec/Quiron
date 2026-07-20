/**
 * Tela de Usuarios da incubadora (menu "Incubadora > Usuarios", admin).
 *
 * Layout mestre-detalhe: lista de usuarios a esquerda (com filtro
 * ativos/todos e criacao de usuario) e o detalhe do usuario selecionado a
 * direita (papel, contato e informacoes da conta/teamspace). Reune tambem os
 * Grupos (roles) e a reativacao de usuarios inativos em abas, no mesmo
 * espirito de telas como Salesforce/HubSpot "Users & Teams".
 *
 * Endpoints (autorizacao no backend: admin do proprio tenant ou root):
 *   GET    /tenants/:id/usuarios
 *   POST   /tenants/:id/usuarios
 *   PUT    /tenants/:id/usuarios/:idUsuario
 *   PATCH  /tenants/:id/usuarios/:idUsuario/status
 *   GET    /tenants/:id/roles
 *   GET    /tenants/:id/usuarios-roles
 *   POST   /tenants/:id/roles/:idRole/usuarios
 *   DELETE /tenants/:id/roles/:idRole/usuarios/:idUsuario
 *
 * Aba "Permissoes": gerenciamento de Roles e Permissoes (RBAC) da
 * incubadora, organizado por modulo -> recurso -> acao.
 *   GET    /permissoes/catalogo
 *   GET    /tenants/:id/roles
 *   POST   /tenants/:id/roles
 *   GET    /tenants/:id/roles/:idRole
 *   PUT    /tenants/:id/roles/:idRole
 *   DELETE /tenants/:id/roles/:idRole
 *   PUT    /tenants/:id/roles/:idRole/permissoes
 *
 * Aba "Startups" (incubados): cria e lista as startups da incubadora e seus
 * membros (sem autorizacao extra no backend alem do Bearer Token).
 *   GET  /startups?id_tenant=
 *   POST /startups
 *   GET  /startups/:id/membros
 *   POST /startups/:id/membros
 */
import { useEffect, useMemo, useState } from "react"
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  TextField,
  MenuItem,
  Select,
  InputAdornment,
  List,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Badge,
  Chip,
  ButtonGroup,
  Button,
  IconButton,
  Menu,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Divider,
  Drawer,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Switch,
  Alert,
  CircularProgress,
  useTheme,
  useMediaQuery,
  alpha,
} from "@mui/material"
import {
  People,
  Add,
  ArrowDropDown,
  Search,
  Edit,
  Email,
  Phone,
  Business,
  Groups,
  HowToReg,
  RocketLaunch,
  StarRate,
  LockReset,
  AdminPanelSettings,
  Menu as MenuIcon,
} from "@mui/icons-material"
import AppLayout from "../components/AppLayout"
import ConfirmDialog from "../components/programa/ConfirmDialog"
import RolesSidebar from "../components/permissoes/RolesSidebar"
import RoleHeader from "../components/permissoes/RoleHeader"
import SearchPermissions from "../components/permissoes/SearchPermissions"
import PermissionsAccordion from "../components/permissoes/PermissionsAccordion"
import RoleActions from "../components/permissoes/RoleActions"
import api from "../services/api"
import { useAuthStore } from "../store/authStore"

const PAPEL_ROTULO = { admin: "Administrador", mentor: "Mentor", usuario: "Usuario" }
const PAPEL_COR = { admin: "warning", mentor: "info", usuario: "default" }
const FORM_USUARIO_VAZIO = { nome: "", email: "", celular: "", senha: "", papel: "usuario" }

const STATUS_STARTUP_ROTULO = { ATIVA: "Ativa", PAUSADA: "Pausada", ENCERRADA: "Encerrada" }
const STATUS_STARTUP_COR = { ATIVA: "success", PAUSADA: "warning", ENCERRADA: "default" }
const FORM_STARTUP_VAZIO = { nome: "", cnpj: "" }

export default function Usuarios() {
  const usuarioLogado = useAuthStore((s) => s.usuario)
  const idTenant = usuarioLogado?.id_tenant ?? null

  const [aba, setAba] = useState("usuarios") 

  return (
    <AppLayout>
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <People sx={{ color: "primary.main" }} />
          <Typography variant="h4" fontWeight={700}>
            Usuarios
          </Typography>
        </Box>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Gerencie os usuarios, permissoes, grupos e acessos da incubadora.
        </Typography>

        <Paper sx={{ borderRadius: 0, mb: 3 }}>
          <Tabs value={aba} onChange={(_, v) => setAba(v)} variant="scrollable" scrollButtons="auto">
            <Tab value="usuarios" label="Usuarios" sx={{ textTransform: "none" }} />
            <Tab value="permissoes" label="Permissoes" sx={{ textTransform: "none" }} />
            <Tab value="grupos" label="Grupos" sx={{ textTransform: "none" }} />
            <Tab value="ativar" label="Ativar usuarios" sx={{ textTransform: "none" }} />
            <Tab value="startups" label="Startups" sx={{ textTransform: "none" }} />
          </Tabs>
        </Paper>

        {!idTenant ? (
          <Paper sx={{ borderRadius: 0, p: { xs: 3, sm: 6 }, textAlign: "center", color: "text.secondary" }}>
            <Business sx={{ fontSize: 48, opacity: 0.4 }} />
            <Typography sx={{ mt: 1 }}>Nenhuma incubadora vinculada ao seu usuario.</Typography>
          </Paper>
        ) : (
          <>
            {aba === "usuarios" && <AbaUsuarios idTenant={idTenant} />}
            {aba === "permissoes" && <AbaPermissoes idTenant={idTenant} />}
            {aba === "grupos" && <AbaGrupos idTenant={idTenant} />}
            {aba === "ativar" && <AbaAtivarUsuarios idTenant={idTenant} />}
            {aba === "startups" && <AbaStartups idTenant={idTenant} />}
          </>
        )}
      </Box>
    </AppLayout>
  )
}

// ---------------------------------------------------------------------------
// Aba "Usuarios": lista mestre-detalhe.
// ---------------------------------------------------------------------------
function AbaUsuarios({ idTenant }) {
  const usuarioLogado = useAuthStore((s) => s.usuario)

  const [usuarios, setUsuarios] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [aviso, setAviso] = useState(null) // { tipo, texto }

  const [filtro, setFiltro] = useState("ativos") // ativos | todos
  const [busca, setBusca] = useState("")
  const [selecionadoId, setSelecionadoId] = useState(null)

  const [menuNovoAncora, setMenuNovoAncora] = useState(null)
  const [dialogNovo, setDialogNovo] = useState(false)
  const [dialogEditar, setDialogEditar] = useState(false)

  // Permissao RBAC "usuarios.usuarios.redefinir_senha": so quem tem (ou o
  // root) ve o botao de redefinir senha. O backend tambem valida na rota.
  const [podeRedefinirSenha, setPodeRedefinirSenha] = useState(false)
  useEffect(() => {
    if (usuarioLogado?.root) {
      setPodeRedefinirSenha(true)
      return
    }
    if (!idTenant) return
    api
      .get("/permissoes/minhas", { params: { id_tenant: idTenant } })
      .then(({ data }) => setPodeRedefinirSenha(data.permissoes.includes("usuarios.usuarios.redefinir_senha")))
      .catch(() => setPodeRedefinirSenha(false))
  }, [idTenant, usuarioLogado?.root])

  const carregar = async () => {
    setCarregando(true)
    setAviso(null)
    try {
      const { data } = await api.get(`/tenants/${idTenant}/usuarios`)
      setUsuarios(data.usuarios)
      setSelecionadoId((atual) => atual ?? data.usuarios.find((u) => u.ativo)?.id_usuario ?? null)
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao carregar usuarios." })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idTenant])

  const listaFiltrada = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return usuarios
      .filter((u) => (filtro === "ativos" ? u.ativo : true))
      .filter((u) => !termo || u.nome.toLowerCase().includes(termo) || u.email.toLowerCase().includes(termo))
  }, [usuarios, filtro, busca])

  const selecionado = useMemo(
    () => usuarios.find((u) => u.id_usuario === selecionadoId) || null,
    [usuarios, selecionadoId]
  )

  const alterarStatus = async (idUsuario, ativo) => {
    setAviso(null)
    try {
      await api.patch(`/tenants/${idTenant}/usuarios/${idUsuario}/status`, { ativo })
      await carregar()
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao alterar o status do usuario." })
    }
  }

  const redefinirSenha = async (idUsuario) => {
    setAviso(null)
    try {
      const { data } = await api.post(`/tenants/${idTenant}/usuarios/${idUsuario}/redefinir-senha`)
      setAviso({ tipo: "success", texto: data.mensagem || "Link de redefinicao de senha enviado." })
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao redefinir a senha do usuario." })
    }
  }

  return (
    <>
      {aviso && (
        <Alert severity={aviso.tipo} sx={{ mb: 3 }} onClose={() => setAviso(null)}>
          {aviso.texto}
        </Alert>
      )}

      <Box sx={{ display: "flex", gap: 3, alignItems: "flex-start", flexWrap: { xs: "wrap", md: "nowrap" } }}>
        {/* --------------------------- Coluna esquerda --------------------------- */}
        <Box sx={{ width: { xs: "100%", md: 340 }, flexShrink: 0 }}>
          <Box sx={{ display: "flex", gap: 1, mb: 1.5, alignItems: "center" }}>
            <Select
              size="small"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              sx={{ minWidth: 190 }}
            >
              <MenuItem value="ativos">Usuarios Ativos ({usuarios.filter((u) => u.ativo).length})</MenuItem>
              <MenuItem value="todos">Todos os usuarios ({usuarios.length})</MenuItem>
            </Select>
            <Box sx={{ flex: 1 }} />
            <ButtonGroup variant="contained" size="small">
              <Button startIcon={<Add />} sx={{ textTransform: "none" }} onClick={() => setDialogNovo(true)}>
                Novo usuario
              </Button>
              <Button size="small" onClick={(e) => setMenuNovoAncora(e.currentTarget)} sx={{ px: 0.5 }}>
                <ArrowDropDown fontSize="small" />
              </Button>
            </ButtonGroup>
            <Menu anchorEl={menuNovoAncora} open={Boolean(menuNovoAncora)} onClose={() => setMenuNovoAncora(null)}>
              <MenuItem disabled>Importar usuarios (em breve)</MenuItem>
            </Menu>
          </Box>

          <TextField
            fullWidth
            size="small"
            placeholder="Buscar usuario..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            sx={{ mb: 1.5 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            }}
          />

          <Paper sx={{ borderRadius: 0, overflow: "hidden" }}>
            {carregando ? (
              <Box sx={{ textAlign: "center", py: 6 }}>
                <CircularProgress size={28} />
              </Box>
            ) : listaFiltrada.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 6, color: "text.secondary" }}>
                <People sx={{ fontSize: 40, opacity: 0.4 }} />
                <Typography sx={{ mt: 1 }} variant="body2">
                  Nenhum usuario encontrado.
                </Typography>
              </Box>
            ) : (
              <List sx={{ py: 0 }}>
                {listaFiltrada.map((u) => (
                  <ListItemButton
                    key={u.id_usuario}
                    selected={u.id_usuario === selecionadoId}
                    onClick={() => setSelecionadoId(u.id_usuario)}
                    sx={{
                      py: 1.25,
                      "&.Mui-selected": {
                        bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === "dark" ? 0.18 : 0.09),
                        "&:hover": { bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === "dark" ? 0.24 : 0.13) },
                      },
                    }}
                  >
                    <ListItemAvatar>
                      <Badge
                        overlap="circular"
                        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                        variant="dot"
                        color={u.ativo ? "success" : "default"}
                      >
                        <Avatar sx={{ bgcolor: "primary.main" }}>{u.nome.charAt(0).toUpperCase()}</Avatar>
                      </Badge>
                    </ListItemAvatar>
                    <ListItemText
                      primary={u.nome}
                      secondary={
                        <>
                          {PAPEL_ROTULO[u.papel] || u.papel}
                          {u.papel === "admin" && (
                            <Chip
                              size="small"
                              label="Administrador"
                              color="warning"
                              sx={{ ml: 1, height: 18, fontSize: 11 }}
                            />
                          )}
                        </>
                      }
                      primaryTypographyProps={{ fontWeight: 600, noWrap: true }}
                      secondaryTypographyProps={{ component: "span", variant: "caption" }}
                    />
                  </ListItemButton>
                ))}
              </List>
            )}
          </Paper>
        </Box>

        {/* --------------------------- Coluna direita --------------------------- */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {!selecionado ? (
            <Paper sx={{ borderRadius: 0, p: { xs: 3, sm: 6 }, textAlign: "center", color: "text.secondary" }}>
              <People sx={{ fontSize: 48, opacity: 0.4 }} />
              <Typography sx={{ mt: 1 }}>Selecione um usuario para ver os detalhes.</Typography>
            </Paper>
          ) : (
            <DetalheUsuario
              usuario={selecionado}
              onEditar={() => setDialogEditar(true)}
              onAlterarStatus={alterarStatus}
              podeRedefinirSenha={podeRedefinirSenha}
              onRedefinirSenha={redefinirSenha}
            />
          )}
        </Box>
      </Box>

      <DialogNovoUsuario
        aberto={dialogNovo}
        onFechar={() => setDialogNovo(false)}
        idTenant={idTenant}
        onCriado={(idUsuario) => {
          setDialogNovo(false)
          carregar()
          setSelecionadoId(idUsuario)
        }}
      />
      {selecionado && (
        <DialogEditarUsuario
          aberto={dialogEditar}
          onFechar={() => setDialogEditar(false)}
          idTenant={idTenant}
          usuario={selecionado}
          onSalvo={() => {
            setDialogEditar(false)
            carregar()
          }}
        />
      )}
    </>
  )
}

/** Cartao de detalhes do usuario selecionado (perfil + informacoes da conta). */
function DetalheUsuario({ usuario, onEditar, onAlterarStatus, podeRedefinirSenha, onRedefinirSenha }) {
  return (
    <Paper sx={{ borderRadius: 0, p: { xs: 2, sm: 3 } }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
        <Avatar sx={{ width: 72, height: 72, bgcolor: "primary.main", fontSize: 28 }}>
          {usuario.nome.charAt(0).toUpperCase()}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <Typography variant="h6" fontWeight={700}>
              {usuario.nome}
            </Typography>
            <Chip size="small" label={PAPEL_ROTULO[usuario.papel] || usuario.papel} color={PAPEL_COR[usuario.papel] || "default"} />
            {!usuario.ativo && <Chip size="small" label="Inativo" variant="outlined" />}
            <IconButton size="small" onClick={onEditar} aria-label="Editar usuario">
              <Edit fontSize="small" />
            </IconButton>
          </Box>

          <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", mt: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "text.secondary" }}>
              <Email fontSize="small" />
              <Typography variant="body2">{usuario.email}</Typography>
            </Box>
            {usuario.celular && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "text.secondary" }}>
                <Phone fontSize="small" />
                <Typography variant="body2">{usuario.celular}</Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      <Divider sx={{ my: 2 }} />

      <Box sx={{ display: "flex", alignItems: "center", mb: 1.5 }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1 }}>
          Informacoes da conta
        </Typography>
        {podeRedefinirSenha && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<LockReset />}
            sx={{ textTransform: "none" }}
            onClick={() => onRedefinirSenha(usuario.id_usuario)}
          >
            Redefinir senha
          </Button>
        )}
      </Box>
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <LinhaDetalhe rotulo="Vinculado desde" valor={new Date(usuario.criado_ts).toLocaleDateString("pt-BR")} />
        <LinhaDetalhe
          rotulo="Ultimo login"
          valor={usuario.ultimo_login_ts ? new Date(usuario.ultimo_login_ts).toLocaleString("pt-BR") : "Nunca acessou"}
        />
        <LinhaDetalhe rotulo="Deve redefinir senha" valor={usuario.deve_redefinir_senha ? "Sim" : "Nao"} />
        <Grid item xs={12} sm={6}>
          <Typography variant="caption" color="text.secondary" display="block">
            Status
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Switch
              size="small"
              checked={usuario.ativo}
              onChange={(e) => onAlterarStatus(usuario.id_usuario, e.target.checked)}
            />
            <Typography variant="body2">{usuario.ativo ? "Ativo" : "Inativo"}</Typography>
          </Box>
        </Grid>
      </Grid>
    </Paper>
  )
}

function LinhaDetalhe({ rotulo, valor }) {
  return (
    <Grid item xs={12} sm={6}>
      <Typography variant="caption" color="text.secondary" display="block">
        {rotulo}
      </Typography>
      <Typography variant="body2">{valor}</Typography>
    </Grid>
  )
}

/** Dialog de criacao de usuario (POST /tenants/:id/usuarios). */
function DialogNovoUsuario({ aberto, onFechar, idTenant, onCriado }) {
  const [form, setForm] = useState(FORM_USUARIO_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    if (aberto) {
      setForm(FORM_USUARIO_VAZIO)
      setErro(null)
    }
  }, [aberto])

  const alterarCampo = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }))

  const salvar = async (e) => {
    e.preventDefault()
    setSalvando(true)
    setErro(null)
    try {
      const { data } = await api.post(`/tenants/${idTenant}/usuarios`, form)
      onCriado(data.usuario.id_usuario)
    } catch (err) {
      setErro(err.response?.data?.erro || "Erro ao criar o usuario.")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={aberto} onClose={onFechar} maxWidth="sm" fullWidth component="form" onSubmit={salvar}>
      <DialogTitle>Novo usuario</DialogTitle>
      <DialogContent>
        {erro && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {erro}
          </Alert>
        )}
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={12} sm={6}>
            <TextField label="Nome" fullWidth required value={form.nome} onChange={(e) => alterarCampo("nome", e.target.value)} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Celular"
              fullWidth
              required
              value={form.celular}
              onChange={(e) => alterarCampo("celular", e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Email"
              type="email"
              fullWidth
              required
              value={form.email}
              onChange={(e) => alterarCampo("email", e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              select
              label="Papel"
              fullWidth
              required
              value={form.papel}
              onChange={(e) => alterarCampo("papel", e.target.value)}
            >
              <MenuItem value="admin">Administrador</MenuItem>
              <MenuItem value="mentor">Mentor</MenuItem>
              <MenuItem value="usuario">Usuario</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Senha provisoria"
              type="password"
              fullWidth
              required
              helperText="O usuario sera obrigado a redefini-la no primeiro login."
              value={form.senha}
              onChange={(e) => alterarCampo("senha", e.target.value)}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onFechar} disabled={salvando}>
          Cancelar
        </Button>
        <Button type="submit" variant="contained" disabled={salvando}>
          {salvando ? <CircularProgress size={22} color="inherit" /> : "Criar usuario"}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

/** Dialog de edicao (PUT /tenants/:id/usuarios/:idUsuario). */
function DialogEditarUsuario({ aberto, onFechar, idTenant, usuario, onSalvo }) {
  const [form, setForm] = useState({ nome: "", celular: "", papel: "usuario" })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    if (aberto && usuario) {
      setForm({ nome: usuario.nome, celular: usuario.celular || "", papel: usuario.papel })
      setErro(null)
    }
  }, [aberto, usuario])

  const alterarCampo = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }))

  const salvar = async (e) => {
    e.preventDefault()
    setSalvando(true)
    setErro(null)
    try {
      await api.put(`/tenants/${idTenant}/usuarios/${usuario.id_usuario}`, form)
      onSalvo()
    } catch (err) {
      setErro(err.response?.data?.erro || "Erro ao salvar o usuario.")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={aberto} onClose={onFechar} maxWidth="sm" fullWidth component="form" onSubmit={salvar}>
      <DialogTitle>Editar usuario</DialogTitle>
      <DialogContent>
        {erro && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {erro}
          </Alert>
        )}
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={12} sm={6}>
            <TextField label="Nome" fullWidth required value={form.nome} onChange={(e) => alterarCampo("nome", e.target.value)} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Celular"
              fullWidth
              required
              value={form.celular}
              onChange={(e) => alterarCampo("celular", e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="Email" fullWidth value={usuario.email} disabled />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              select
              label="Papel"
              fullWidth
              required
              value={form.papel}
              onChange={(e) => alterarCampo("papel", e.target.value)}
            >
              <MenuItem value="admin">Administrador</MenuItem>
              <MenuItem value="mentor">Mentor</MenuItem>
              <MenuItem value="usuario">Usuario</MenuItem>
            </TextField>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onFechar} disabled={salvando}>
          Cancelar
        </Button>
        <Button type="submit" variant="contained" disabled={salvando}>
          {salvando ? <CircularProgress size={22} color="inherit" /> : "Salvar"}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Aba "Permissoes": gerenciamento de Roles e Permissoes (RBAC) da incubadora.
// ---------------------------------------------------------------------------
const LARGURA_SIDEBAR_PERMISSOES = 300
const ROLE_FORM_VAZIO = { nome: "", descricao: "" }

function AbaPermissoes({ idTenant }) {
  const theme = useTheme()
  const smUp = useMediaQuery(theme.breakpoints.up("sm"))

  const [catalogo, setCatalogo] = useState([])
  const [roles, setRoles] = useState([])
  const [roleSelecionadaId, setRoleSelecionadaId] = useState(null)
  const [roleDetalhe, setRoleDetalhe] = useState(null)
  const [permissoesSelecionadas, setPermissoesSelecionadas] = useState(new Set())

  const [buscaRoles, setBuscaRoles] = useState("")
  const [buscaPermissoes, setBuscaPermissoes] = useState("")
  const [sidebarMobileAberta, setSidebarMobileAberta] = useState(false)

  const [carregando, setCarregando] = useState(true)
  const [carregandoRole, setCarregandoRole] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState(null) // { tipo, texto }

  const [dialogRole, setDialogRole] = useState(null) // null | { modo: "criar"|"editar" }
  const [roleForm, setRoleForm] = useState(ROLE_FORM_VAZIO)
  const [salvandoRole, setSalvandoRole] = useState(false)
  const [confirmExcluir, setConfirmExcluir] = useState(false)

  // Carrega catalogo + roles quando a incubadora-alvo estiver definida.
  useEffect(() => {
    if (!idTenant) return
    setCarregando(true)
    Promise.all([api.get("/permissoes/catalogo"), api.get(`/tenants/${idTenant}/roles`)])
      .then(([catalogoRes, rolesRes]) => {
        setCatalogo(catalogoRes.data.catalogo)
        setRoles(rolesRes.data.roles)
        setRoleSelecionadaId((atual) => atual ?? rolesRes.data.roles[0]?.id_role ?? null)
      })
      .catch((err) => setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao carregar permissoes." }))
      .finally(() => setCarregando(false))
  }, [idTenant])

  const carregarRoles = async () => {
    const { data } = await api.get(`/tenants/${idTenant}/roles`)
    setRoles(data.roles)
    return data.roles
  }

  const carregarDetalheRole = async (idRole) => {
    if (!idRole) return
    setCarregandoRole(true)
    setAviso(null)
    try {
      const { data } = await api.get(`/tenants/${idTenant}/roles/${idRole}`)
      setRoleDetalhe(data.role)
      setPermissoesSelecionadas(new Set(data.role.permissoes))
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao carregar a role." })
    } finally {
      setCarregandoRole(false)
    }
  }

  useEffect(() => {
    carregarDetalheRole(roleSelecionadaId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleSelecionadaId])

  // ---------------- Selecao de permissoes (estado local, salvo sob demanda) ----------------

  const alternarPermissao = (chave) => {
    setPermissoesSelecionadas((atual) => {
      const novo = new Set(atual)
      if (novo.has(chave)) novo.delete(chave)
      else novo.add(chave)
      return novo
    })
  }

  const selecionarModulo = (modulo, marcar, recurso) => {
    const mod = catalogo.find((m) => m.modulo === modulo)
    if (!mod) return
    const chaves = mod.recursos
      .filter((r) => !recurso || r.recurso === recurso)
      .flatMap((r) => r.acoes.map((a) => a.chave))

    setPermissoesSelecionadas((atual) => {
      const novo = new Set(atual)
      chaves.forEach((c) => (marcar ? novo.add(c) : novo.delete(c)))
      return novo
    })
  }

  const todasAsChaves = useMemo(
    () => catalogo.flatMap((m) => m.recursos.flatMap((r) => r.acoes.map((a) => a.chave))),
    [catalogo]
  )
  const selecionarTudo = () => setPermissoesSelecionadas(new Set(todasAsChaves))
  const limparTudo = () => setPermissoesSelecionadas(new Set())

  const temAlteracoes = useMemo(() => {
    if (!roleDetalhe) return false
    const original = new Set(roleDetalhe.permissoes)
    if (original.size !== permissoesSelecionadas.size) return true
    for (const c of permissoesSelecionadas) if (!original.has(c)) return true
    return false
  }, [roleDetalhe, permissoesSelecionadas])

  const salvarPermissoes = async () => {
    setSalvando(true)
    setAviso(null)
    try {
      await api.put(`/tenants/${idTenant}/roles/${roleSelecionadaId}/permissoes`, {
        permissoes: Array.from(permissoesSelecionadas),
      })
      setAviso({ tipo: "success", texto: "Permissoes atualizadas com sucesso." })
      await carregarDetalheRole(roleSelecionadaId)
      await carregarRoles()
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao salvar as permissoes." })
    } finally {
      setSalvando(false)
    }
  }

  // ---------------- Filtro do catalogo pela busca de permissoes ----------------

  const catalogoFiltrado = useMemo(() => {
    const termo = buscaPermissoes.trim().toLowerCase()
    if (!termo) return catalogo
    return catalogo
      .map((mod) => ({
        ...mod,
        recursos: mod.recursos.filter(
          (rec) =>
            rec.rotulo.toLowerCase().includes(termo) || rec.acoes.some((a) => a.rotulo.toLowerCase().includes(termo))
        ),
      }))
      .filter((mod) => mod.recursos.length > 0)
  }, [catalogo, buscaPermissoes])

  // ---------------- CRUD de roles ----------------

  const abrirCriacaoRole = () => {
    setRoleForm(ROLE_FORM_VAZIO)
    setDialogRole({ modo: "criar" })
  }

  const abrirEdicaoRole = () => {
    if (!roleDetalhe) return
    setRoleForm({ nome: roleDetalhe.nome, descricao: roleDetalhe.descricao || "" })
    setDialogRole({ modo: "editar" })
  }

  const salvarRole = async (e) => {
    e.preventDefault()
    setSalvandoRole(true)
    setAviso(null)
    try {
      if (dialogRole.modo === "criar") {
        const { data } = await api.post(`/tenants/${idTenant}/roles`, roleForm)
        await carregarRoles()
        setRoleSelecionadaId(data.role.id_role)
        setAviso({ tipo: "success", texto: "Role criada com sucesso." })
      } else {
        await api.put(`/tenants/${idTenant}/roles/${roleSelecionadaId}`, roleForm)
        await carregarRoles()
        await carregarDetalheRole(roleSelecionadaId)
        setAviso({ tipo: "success", texto: "Role atualizada com sucesso." })
      }
      setDialogRole(null)
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao salvar a role." })
    } finally {
      setSalvandoRole(false)
    }
  }

  const excluirRole = async () => {
    setAviso(null)
    try {
      await api.delete(`/tenants/${idTenant}/roles/${roleSelecionadaId}`)
      setConfirmExcluir(false)
      setRoleSelecionadaId(null)
      setRoleDetalhe(null)
      await carregarRoles()
      setAviso({ tipo: "success", texto: "Role excluida com sucesso." })
    } catch (err) {
      setConfirmExcluir(false)
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao excluir a role." })
    }
  }

  // ---------------- Render ----------------

  const conteudoSidebar = (
    <RolesSidebar
      roles={roles}
      selecionadaId={roleSelecionadaId}
      busca={buscaRoles}
      onBuscar={setBuscaRoles}
      onSelecionar={(id) => {
        setRoleSelecionadaId(id)
        setSidebarMobileAberta(false)
      }}
      onNovaRole={abrirCriacaoRole}
    />
  )

  return (
    <>
      {carregando ? (
        <Box sx={{ textAlign: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box sx={{ display: "flex", gap: 3, alignItems: "flex-start" }}>
          {smUp ? (
            <Paper sx={{ borderRadius: 0, width: LARGURA_SIDEBAR_PERMISSOES, flexShrink: 0, overflow: "hidden" }}>
              {conteudoSidebar}
            </Paper>
          ) : (
            <Drawer
              anchor="left"
              open={sidebarMobileAberta}
              onClose={() => setSidebarMobileAberta(false)}
              PaperProps={{ sx: { width: "85%", maxWidth: LARGURA_SIDEBAR_PERMISSOES } }}
            >
              {conteudoSidebar}
            </Drawer>
          )}

          <Box sx={{ flex: 1, minWidth: 0 }}>
            {!smUp && (
              <Button
                startIcon={<MenuIcon />}
                onClick={() => setSidebarMobileAberta(true)}
                sx={{ mb: 2, textTransform: "none" }}
                variant="outlined"
              >
                {roleDetalhe?.nome || "Selecionar role"}
              </Button>
            )}

            {aviso && (
              <Alert severity={aviso.tipo} sx={{ mb: 3 }} onClose={() => setAviso(null)}>
                {aviso.texto}
              </Alert>
            )}

            {carregandoRole ? (
              <Box sx={{ textAlign: "center", py: 8 }}>
                <CircularProgress />
              </Box>
            ) : !roleDetalhe ? (
              <Paper sx={{ borderRadius: 0, p: { xs: 3, sm: 6 }, textAlign: "center", color: "text.secondary" }}>
                <AdminPanelSettings sx={{ fontSize: 48, opacity: 0.4 }} />
                <Typography sx={{ mt: 1 }}>
                  {roles.length === 0 ? "Nenhuma role cadastrada ainda. Crie a primeira." : "Selecione uma role."}
                </Typography>
              </Paper>
            ) : (
              <>
                <RoleHeader role={roleDetalhe} onEditar={abrirEdicaoRole} onExcluir={() => setConfirmExcluir(true)} />

                <Box sx={{ mb: 2 }}>
                  <SearchPermissions
                    valor={buscaPermissoes}
                    onChange={setBuscaPermissoes}
                    placeholder="Buscar permissao (ex.: cliente, startup)..."
                  />
                </Box>

                <RoleActions
                  temAlteracoes={temAlteracoes}
                  salvando={salvando}
                  onSelecionarTudo={selecionarTudo}
                  onLimparTudo={limparTudo}
                  onSalvar={salvarPermissoes}
                />

                <PermissionsAccordion
                  catalogo={catalogoFiltrado}
                  selecionadas={permissoesSelecionadas}
                  onToggle={alternarPermissao}
                  onSelecionarModulo={selecionarModulo}
                  buscaAtiva={Boolean(buscaPermissoes.trim())}
                />
              </>
            )}
          </Box>
        </Box>
      )}

      {/* ---------------- Dialog de criacao/edicao de role ---------------- */}
      <Dialog open={Boolean(dialogRole)} onClose={() => setDialogRole(null)} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={salvarRole}>
          <DialogTitle>{dialogRole?.modo === "criar" ? "Nova role" : "Editar role"}</DialogTitle>
          <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2 }}>
            <TextField
              label="Nome"
              fullWidth
              required
              value={roleForm.nome}
              onChange={(e) => setRoleForm((f) => ({ ...f, nome: e.target.value }))}
            />
            <TextField
              label="Descricao"
              fullWidth
              multiline
              minRows={2}
              value={roleForm.descricao}
              onChange={(e) => setRoleForm((f) => ({ ...f, descricao: e.target.value }))}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setDialogRole(null)}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={salvandoRole}>
              {salvandoRole ? <CircularProgress size={22} color="inherit" /> : "Salvar"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* ---------------- Confirmacao de exclusao ---------------- */}
      <ConfirmDialog
        aberto={confirmExcluir}
        titulo="Excluir role"
        mensagem={`Tem certeza que deseja excluir a role "${roleDetalhe?.nome}"? Esta acao nao pode ser desfeita.`}
        onConfirmar={excluirRole}
        onCancelar={() => setConfirmExcluir(false)}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Aba "Grupos": roles da incubadora + membros.
// ---------------------------------------------------------------------------
function AbaGrupos({ idTenant }) {
  const [roles, setRoles] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [roleSelecionadaId, setRoleSelecionadaId] = useState(null)
  const [buscaRoles, setBuscaRoles] = useState("")

  const [carregando, setCarregando] = useState(true)
  const [aviso, setAviso] = useState(null)
  const [alternandoUsuario, setAlternandoUsuario] = useState(null)

  const carregar = async () => {
    setCarregando(true)
    setAviso(null)
    try {
      const [rolesRes, usuariosRes] = await Promise.all([
        api.get(`/tenants/${idTenant}/roles`),
        api.get(`/tenants/${idTenant}/usuarios-roles`),
      ])
      setRoles(rolesRes.data.roles)
      setUsuarios(usuariosRes.data.usuarios)
      setRoleSelecionadaId((atual) => atual ?? rolesRes.data.roles[0]?.id_role ?? null)
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao carregar os grupos." })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idTenant])

  const roleSelecionada = useMemo(
    () => roles.find((r) => r.id_role === roleSelecionadaId) || null,
    [roles, roleSelecionadaId]
  )

  const ehMembro = (u) => (u.roles || []).some((r) => r.id_role === roleSelecionadaId)

  const alternarMembro = async (idUsuario, membro) => {
    setAlternandoUsuario(idUsuario)
    setAviso(null)
    try {
      if (membro) {
        await api.delete(`/tenants/${idTenant}/roles/${roleSelecionadaId}/usuarios/${idUsuario}`)
      } else {
        await api.post(`/tenants/${idTenant}/roles/${roleSelecionadaId}/usuarios`, { id_usuario: idUsuario })
      }
      await carregar()
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao atualizar o vinculo." })
    } finally {
      setAlternandoUsuario(null)
    }
  }

  if (carregando) {
    return (
      <Box sx={{ textAlign: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <>
      {aviso && (
        <Alert severity={aviso.tipo} sx={{ mb: 3 }} onClose={() => setAviso(null)}>
          {aviso.texto}
        </Alert>
      )}

      <Box sx={{ display: "flex", gap: 3, alignItems: "flex-start" }}>
        <Paper sx={{ borderRadius: 0, width: 300, flexShrink: 0, overflow: "hidden", display: { xs: "none", sm: "block" } }}>
          <RolesSidebar
            roles={roles}
            selecionadaId={roleSelecionadaId}
            busca={buscaRoles}
            onBuscar={setBuscaRoles}
            onSelecionar={setRoleSelecionadaId}
          />
        </Paper>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          {!roleSelecionada ? (
            <Paper sx={{ borderRadius: 0, p: { xs: 3, sm: 6 }, textAlign: "center", color: "text.secondary" }}>
              <Groups sx={{ fontSize: 48, opacity: 0.4 }} />
              <Typography sx={{ mt: 1 }}>
                {roles.length === 0 ? "Nenhum grupo cadastrado ainda." : "Selecione um grupo."}
              </Typography>
            </Paper>
          ) : (
            <>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
                {roleSelecionada.nome}
              </Typography>
              {roleSelecionada.descricao && (
                <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>
                  {roleSelecionada.descricao}
                </Typography>
              )}

              <Paper sx={{ borderRadius: 0, overflow: "hidden" }}>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Nome</TableCell>
                        <TableCell>E-mail</TableCell>
                        <TableCell align="right">Pertence ao grupo</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {usuarios.map((u) => (
                        <TableRow key={u.id_usuario} hover>
                          <TableCell>
                            <Typography fontWeight={600}>{u.nome}</Typography>
                          </TableCell>
                          <TableCell>{u.email}</TableCell>
                          <TableCell align="right">
                            <Checkbox
                              checked={ehMembro(u)}
                              disabled={alternandoUsuario === u.id_usuario}
                              onChange={() => alternarMembro(u.id_usuario, ehMembro(u))}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </>
          )}
        </Box>
      </Box>
    </>
  )
}

// ---------------------------------------------------------------------------
// Aba "Ativar usuarios": usuarios inativos, com acao rapida de reativacao.
// ---------------------------------------------------------------------------
function AbaAtivarUsuarios({ idTenant }) {
  const [usuarios, setUsuarios] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [aviso, setAviso] = useState(null)
  const [ativando, setAtivando] = useState(null)

  const carregar = async () => {
    setCarregando(true)
    setAviso(null)
    try {
      const { data } = await api.get(`/tenants/${idTenant}/usuarios`)
      setUsuarios(data.usuarios.filter((u) => !u.ativo))
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao carregar usuarios inativos." })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idTenant])

  const ativar = async (idUsuario) => {
    setAtivando(idUsuario)
    setAviso(null)
    try {
      await api.patch(`/tenants/${idTenant}/usuarios/${idUsuario}/status`, { ativo: true })
      await carregar()
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao ativar o usuario." })
    } finally {
      setAtivando(null)
    }
  }

  return (
    <>
      {aviso && (
        <Alert severity={aviso.tipo} sx={{ mb: 3 }} onClose={() => setAviso(null)}>
          {aviso.texto}
        </Alert>
      )}

      <Paper sx={{ borderRadius: 0, overflow: "hidden" }}>
        {carregando ? (
          <Box sx={{ textAlign: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        ) : usuarios.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 6, color: "text.secondary" }}>
            <HowToReg sx={{ fontSize: 48, opacity: 0.4 }} />
            <Typography sx={{ mt: 1 }}>Nenhum usuario inativo no momento.</Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Nome</TableCell>
                  <TableCell>E-mail</TableCell>
                  <TableCell>Papel</TableCell>
                  <TableCell align="right">Acao</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {usuarios.map((u) => (
                  <TableRow key={u.id_usuario} hover>
                    <TableCell>
                      <Typography fontWeight={600}>{u.nome}</Typography>
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{PAPEL_ROTULO[u.papel] || u.papel}</TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<HowToReg />}
                        disabled={ativando === u.id_usuario}
                        onClick={() => ativar(u.id_usuario)}
                        sx={{ textTransform: "none" }}
                      >
                        Ativar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </>
  )
}

// ---------------------------------------------------------------------------
// Aba "Startups": cadastro dos incubados da incubadora + membros.
// ---------------------------------------------------------------------------
function AbaStartups({ idTenant }) {
  const [startups, setStartups] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [membros, setMembros] = useState([])
  const [selecionadaId, setSelecionadaId] = useState(null)
  const [busca, setBusca] = useState("")

  const [carregando, setCarregando] = useState(true)
  const [carregandoMembros, setCarregandoMembros] = useState(false)
  const [aviso, setAviso] = useState(null)

  const [dialogNova, setDialogNova] = useState(false)
  const [dialogMembro, setDialogMembro] = useState(false)

  const carregar = async () => {
    setCarregando(true)
    setAviso(null)
    try {
      const [startupsRes, usuariosRes] = await Promise.all([
        api.get("/startups", { params: { id_tenant: idTenant } }),
        api.get(`/tenants/${idTenant}/usuarios`),
      ])
      setStartups(startupsRes.data.startups)
      setUsuarios(usuariosRes.data.usuarios.filter((u) => u.ativo))
      setSelecionadaId((atual) => atual ?? startupsRes.data.startups[0]?.id_startup ?? null)
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

  const carregarMembros = async (idStartup) => {
    if (!idStartup) {
      setMembros([])
      return
    }
    setCarregandoMembros(true)
    try {
      const { data } = await api.get(`/startups/${idStartup}/membros`)
      setMembros(data.membros)
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao carregar os membros da startup." })
    } finally {
      setCarregandoMembros(false)
    }
  }

  useEffect(() => {
    carregarMembros(selecionadaId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionadaId])

  const listaFiltrada = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return startups
    return startups.filter((s) => s.nome.toLowerCase().includes(termo))
  }, [startups, busca])

  const selecionada = useMemo(
    () => startups.find((s) => s.id_startup === selecionadaId) || null,
    [startups, selecionadaId]
  )

  const idsMembros = useMemo(() => new Set(membros.map((m) => m.id_usuario)), [membros])

  return (
    <>
      {aviso && (
        <Alert severity={aviso.tipo} sx={{ mb: 3 }} onClose={() => setAviso(null)}>
          {aviso.texto}
        </Alert>
      )}

      <Box sx={{ display: "flex", gap: 3, alignItems: "flex-start", flexWrap: { xs: "wrap", md: "nowrap" } }}>
        {/* --------------------------- Coluna esquerda --------------------------- */}
        <Box sx={{ width: { xs: "100%", md: 340 }, flexShrink: 0 }}>
          <Box sx={{ display: "flex", gap: 1, mb: 1.5, alignItems: "center" }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ flex: 1 }}>
              Startups ({startups.length})
            </Typography>
            <Button
              variant="contained"
              size="small"
              startIcon={<Add />}
              sx={{ textTransform: "none" }}
              onClick={() => setDialogNova(true)}
            >
              Nova startup
            </Button>
          </Box>

          <TextField
            fullWidth
            size="small"
            placeholder="Buscar startup..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            sx={{ mb: 1.5 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            }}
          />

          <Paper sx={{ borderRadius: 0, overflow: "hidden" }}>
            {carregando ? (
              <Box sx={{ textAlign: "center", py: 6 }}>
                <CircularProgress size={28} />
              </Box>
            ) : listaFiltrada.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 6, color: "text.secondary" }}>
                <RocketLaunch sx={{ fontSize: 40, opacity: 0.4 }} />
                <Typography sx={{ mt: 1 }} variant="body2">
                  Nenhuma startup cadastrada ainda.
                </Typography>
              </Box>
            ) : (
              <List sx={{ py: 0 }}>
                {listaFiltrada.map((s) => (
                  <ListItemButton
                    key={s.id_startup}
                    selected={s.id_startup === selecionadaId}
                    onClick={() => setSelecionadaId(s.id_startup)}
                    sx={{
                      py: 1.25,
                      "&.Mui-selected": {
                        bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === "dark" ? 0.18 : 0.09),
                        "&:hover": { bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === "dark" ? 0.24 : 0.13) },
                      },
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: "secondary.main" }}>{s.nome.charAt(0).toUpperCase()}</Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={s.nome}
                      secondary={STATUS_STARTUP_ROTULO[s.status] || s.status}
                      primaryTypographyProps={{ fontWeight: 600, noWrap: true }}
                      secondaryTypographyProps={{ variant: "caption" }}
                    />
                  </ListItemButton>
                ))}
              </List>
            )}
          </Paper>
        </Box>

        {/* --------------------------- Coluna direita --------------------------- */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {!selecionada ? (
            <Paper sx={{ borderRadius: 0, p: { xs: 3, sm: 6 }, textAlign: "center", color: "text.secondary" }}>
              <RocketLaunch sx={{ fontSize: 48, opacity: 0.4 }} />
              <Typography sx={{ mt: 1 }}>
                {startups.length === 0 ? "Cadastre a primeira startup incubada." : "Selecione uma startup."}
              </Typography>
            </Paper>
          ) : (
            <Paper sx={{ borderRadius: 0, p: { xs: 2, sm: 3 } }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 0.5 }}>
                <Typography variant="h6" fontWeight={700}>
                  {selecionada.nome}
                </Typography>
                <Chip
                  size="small"
                  label={STATUS_STARTUP_ROTULO[selecionada.status] || selecionada.status}
                  color={STATUS_STARTUP_COR[selecionada.status] || "default"}
                />
              </Box>
              {selecionada.cnpj && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  CNPJ: {selecionada.cnpj}
                </Typography>
              )}

              <Divider sx={{ my: 2 }} />

              <Box sx={{ display: "flex", alignItems: "center", mb: 1.5 }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1 }}>
                  Membros
                </Typography>
                <Button
                  size="small"
                  startIcon={<Add />}
                  sx={{ textTransform: "none" }}
                  onClick={() => setDialogMembro(true)}
                >
                  Adicionar membro
                </Button>
              </Box>

              {carregandoMembros ? (
                <Box sx={{ textAlign: "center", py: 4 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : membros.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                  Nenhum membro vinculado a esta startup ainda.
                </Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Nome</TableCell>
                        <TableCell>E-mail</TableCell>
                        <TableCell align="right">Papel</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {membros.map((m) => (
                        <TableRow key={m.id_usuario} hover>
                          <TableCell>
                            <Typography fontWeight={600}>{m.nome}</Typography>
                          </TableCell>
                          <TableCell>{m.email}</TableCell>
                          <TableCell align="right">
                            {m.lider ? (
                              <Chip size="small" icon={<StarRate sx={{ fontSize: 14 }} />} label="Lider" color="primary" />
                            ) : (
                              <Chip size="small" label="Membro" variant="outlined" />
                            )}
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
      </Box>

      <DialogNovaStartup
        aberto={dialogNova}
        onFechar={() => setDialogNova(false)}
        idTenant={idTenant}
        onCriada={(idStartup) => {
          setDialogNova(false)
          carregar()
          setSelecionadaId(idStartup)
        }}
      />
      {selecionada && (
        <DialogAdicionarMembro
          aberto={dialogMembro}
          onFechar={() => setDialogMembro(false)}
          idStartup={selecionada.id_startup}
          usuarios={usuarios}
          idsMembros={idsMembros}
          onAdicionado={() => {
            setDialogMembro(false)
            carregarMembros(selecionada.id_startup)
          }}
        />
      )}
    </>
  )
}

/** Dialog de criacao de startup (POST /startups). */
function DialogNovaStartup({ aberto, onFechar, idTenant, onCriada }) {
  const [form, setForm] = useState(FORM_STARTUP_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    if (aberto) {
      setForm(FORM_STARTUP_VAZIO)
      setErro(null)
    }
  }, [aberto])

  const alterarCampo = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }))

  const salvar = async (e) => {
    e.preventDefault()
    setSalvando(true)
    setErro(null)
    try {
      const { data } = await api.post("/startups", { id_tenant: idTenant, ...form })
      onCriada(data.startup.id_startup)
    } catch (err) {
      setErro(err.response?.data?.erro || "Erro ao criar a startup.")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={aberto} onClose={onFechar} maxWidth="sm" fullWidth component="form" onSubmit={salvar}>
      <DialogTitle>Nova startup</DialogTitle>
      <DialogContent>
        {erro && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {erro}
          </Alert>
        )}
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={12}>
            <TextField label="Nome da startup" fullWidth required value={form.nome} onChange={(e) => alterarCampo("nome", e.target.value)} />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="CNPJ"
              fullWidth
              value={form.cnpj}
              onChange={(e) => alterarCampo("cnpj", e.target.value)}
              helperText="Opcional."
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onFechar} disabled={salvando}>
          Cancelar
        </Button>
        <Button type="submit" variant="contained" disabled={salvando}>
          {salvando ? <CircularProgress size={22} color="inherit" /> : "Criar startup"}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

/** Dialog de vinculo de membro a uma startup (POST /startups/:id/membros). */
function DialogAdicionarMembro({ aberto, onFechar, idStartup, usuarios, idsMembros, onAdicionado }) {
  const [idUsuario, setIdUsuario] = useState("")
  const [lider, setLider] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    if (aberto) {
      setIdUsuario("")
      setLider(false)
      setErro(null)
    }
  }, [aberto])

  const disponiveis = useMemo(() => usuarios.filter((u) => !idsMembros.has(u.id_usuario)), [usuarios, idsMembros])

  const salvar = async (e) => {
    e.preventDefault()
    if (!idUsuario) return
    setSalvando(true)
    setErro(null)
    try {
      await api.post(`/startups/${idStartup}/membros`, { id_usuario: idUsuario, lider })
      onAdicionado()
    } catch (err) {
      setErro(err.response?.data?.erro || "Erro ao adicionar o membro.")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={aberto} onClose={onFechar} maxWidth="sm" fullWidth component="form" onSubmit={salvar}>
      <DialogTitle>Adicionar membro</DialogTitle>
      <DialogContent>
        {erro && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {erro}
          </Alert>
        )}
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={12}>
            <TextField
              select
              label="Usuario"
              fullWidth
              required
              value={idUsuario}
              onChange={(e) => setIdUsuario(e.target.value)}
              helperText={disponiveis.length === 0 ? "Todos os usuarios ativos ja fazem parte desta startup." : undefined}
            >
              {disponiveis.map((u) => (
                <MenuItem key={u.id_usuario} value={u.id_usuario}>
                  {u.nome} ({u.email})
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Checkbox checked={lider} onChange={(e) => setLider(e.target.checked)} id="lider-checkbox" />
              <Typography component="label" htmlFor="lider-checkbox" variant="body2">
                Definir como lider da startup
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onFechar} disabled={salvando}>
          Cancelar
        </Button>
        <Button type="submit" variant="contained" disabled={salvando || !idUsuario}>
          {salvando ? <CircularProgress size={22} color="inherit" /> : "Adicionar"}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
