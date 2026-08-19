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
import { useEffect, useMemo, useState } from "react"
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  IconButton,
  Tooltip,
  // A tabela da LISTAGEM e a TabelaDados; estes componentes ficam para a
  // tabelinha de leitura dentro do dialogo de usuarios, onde paginacao e
  // gerenciador de colunas so atrapalhariam.
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Alert,
  CircularProgress,
  Switch,
  MenuItem,
  Divider,
} from "@mui/material"
import { Add, Edit, Business, People, Key } from "@mui/icons-material"
import AppLayout from "../components/AppLayout"
import api from "../services/api"
import TabelaDados from "../components/tabela/TabelaDados"
import ToolbarTabela from "../components/tabela/ToolbarTabela"
import PainelFiltros, { contarFiltros } from "../components/tabela/PainelFiltros"
import { exportarTabelaCsv } from "../components/tabela/exportarTabela"
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

  // Busca, filtros e colunas da listagem (ver TabelaDados).
  const [busca, setBusca] = useState("")
  const [filtros, setFiltros] = useState({})
  const [painelAberto, setPainelAberto] = useState(false)
  const [colunasVisiveis, setColunasVisiveis] = useState([])

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

  // ---------------- Listagem ----------------

  const colunas = useMemo(
    () => [
      {
        chave: "nome",
        rotulo: "Nome",
        obrigatoria: true,
        largura: 240,
        valorTexto: (t) => t.nome,
        render: (t) => (
          <Typography variant="body2" fontWeight={600}>
            {t.nome}
          </Typography>
        ),
      },
      {
        chave: "email",
        rotulo: "Contato",
        largura: 240,
        valorTexto: (t) => [t.email, formatarCelular(t.celular)].filter(Boolean).join(" · "),
        render: (t) => (
          <>
            <Typography variant="body2">{t.email}</Typography>
            <Typography variant="body2" color="text.secondary">
              {formatarCelular(t.celular)}
            </Typography>
          </>
        ),
      },
      {
        chave: "cidade",
        rotulo: "Local",
        largura: 180,
        valorOrdenacao: (t) => `${t.estado || ""} ${t.cidade || ""}`,
        valorTexto: (t) => [`${t.cidade || ""} / ${t.estado || ""}`, t.pais].filter(Boolean).join(" · "),
        render: (t) => (
          <>
            <Typography variant="body2">
              {t.cidade} / {t.estado}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t.pais}
            </Typography>
          </>
        ),
      },
      {
        chave: "total_usuarios",
        rotulo: "Usuários",
        alinhamento: "center",
        largura: 110,
        ajuda: "Usuários cadastrados sobre o limite contratado.",
        // Ordena pelo QUANTO DO LIMITE ja foi usado, e nao pelo total: numa
        // lista de incubadoras, quem esta perto de estourar e o que se procura.
        valorOrdenacao: (t) => (t.qtd_usuarios ? t.total_usuarios / t.qtd_usuarios : 0),
        valorTexto: (t) => `${t.total_usuarios} / ${t.qtd_usuarios}`,
        render: (t) => `${t.total_usuarios} / ${t.qtd_usuarios}`,
      },
      {
        chave: "total_startups",
        rotulo: "Startups",
        alinhamento: "center",
        largura: 110,
        ajuda: "Startups cadastradas sobre o limite contratado.",
        valorOrdenacao: (t) => (t.qtd_startups ? t.total_startups / t.qtd_startups : 0),
        valorTexto: (t) => `${t.total_startups} / ${t.qtd_startups}`,
        render: (t) => `${t.total_startups} / ${t.qtd_startups}`,
      },
      {
        chave: "ativo",
        rotulo: "Status",
        alinhamento: "center",
        largura: 110,
        valorOrdenacao: (t) => (t.ativo ? 0 : 1),
        valorTexto: (t) => (t.ativo ? "Ativa" : "Inativa"),
        render: (t) => (
          <Chip
            size="small"
            label={t.ativo ? "Ativa" : "Inativa"}
            color={t.ativo ? "success" : "default"}
          />
        ),
      },
    ],
    []
  )

  const grupos = useMemo(() => {
    const paises = [...new Set(tenants.map((t) => t.pais).filter(Boolean))].sort()
    const grupos = [
      {
        id: "ativo",
        rotulo: "Status",
        tipo: "checkbox",
        itens: [
          { id: "sim", rotulo: "Ativa" },
          { id: "nao", rotulo: "Inativa" },
        ],
      },
    ]
    // Pais e estado saem dos proprios dados: nao ha cadastro deles em lugar
    // nenhum, e com uma unica opcao o grupo nao filtraria nada.
    if (paises.length > 1) {
      grupos.push({
        id: "pais",
        rotulo: "País",
        tipo: "checkbox",
        itens: paises.map((p) => ({ id: p, rotulo: p })),
      })
    }
    const estados = [...new Set(tenants.map((t) => t.estado).filter(Boolean))].sort()
    if (estados.length > 1) {
      grupos.push({
        id: "estado",
        rotulo: "Estado",
        tipo: "checkbox",
        itens: estados.map((e) => ({ id: e, rotulo: e })),
      })
    }
    return grupos
  }, [tenants])

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const digitos = somenteDigitos(termo)
    return tenants.filter((t) => {
      const status = filtros.ativo || []
      if (status.length && !status.includes(t.ativo ? "sim" : "nao")) return false

      const paises = filtros.pais || []
      if (paises.length && !paises.includes(t.pais)) return false

      const estados = filtros.estado || []
      if (estados.length && !estados.includes(t.estado)) return false

      if (!termo) return true
      const casaTexto = [t.nome, t.email, t.cidade, t.estado, t.pais]
        .filter(Boolean)
        .some((campo) => campo.toLowerCase().includes(termo))
      // O celular e guardado sem mascara: comparar so os digitos faz "(51) 9"
      // encontrar o mesmo que "519".
      const casaCelular = digitos && (t.celular || "").includes(digitos)
      return casaTexto || casaCelular
    })
  }, [tenants, busca, filtros])

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

        <Paper data-tour="tenants-lista" sx={{ borderRadius: 0 }}>
          <ToolbarTabela
            busca={busca}
            onBuscaChange={setBusca}
            placeholderBusca="Buscar por nome, e-mail ou cidade..."
            totalFiltros={contarFiltros(filtros)}
            onAbrirFiltros={() => setPainelAberto(true)}
            onExportar={() => exportarTabelaCsv("incubadoras", colunas, colunasVisiveis, filtradas)}
          />

          <TabelaDados
            dados={filtradas}
            colunas={colunas}
            chaveId="id_tenant"
            chaveStorage="tenants"
            ordemInicial="nome"
            carregando={carregando}
            larguraMinima={860}
            mensagemVazio={
              tenants.length === 0
                ? "Nenhuma incubadora cadastrada."
                : "Nenhuma incubadora corresponde ao filtro."
            }
            onColunasVisiveisChange={setColunasVisiveis}
            larguraAcoes={130}
            // As tres acoes de uma incubadora vem juntas, e uma delas e um
            // interruptor — por isso a forma de funcao, e nao a lista de icones.
            acoes={(t) => (
              <>
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
                  <Switch size="small" checked={t.ativo} onChange={() => alternarStatus(t)} />
                </Tooltip>
              </>
            )}
          />
        </Paper>
      </Box>

      <PainelFiltros
        aberto={painelAberto}
        onFechar={() => setPainelAberto(false)}
        titulo="Filtrar incubadoras"
        grupos={grupos}
        selecionados={filtros}
        onAplicar={setFiltros}
        onLimpar={() => setFiltros({})}
      />

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
