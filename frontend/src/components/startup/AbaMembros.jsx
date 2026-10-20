/**
 * Aba "Membros": a equipe da startup e, para a gestao, quem a acompanha.
 * Usada tanto em MinhaStartup (startup do usuario logado) quanto em
 * StartupDetail (visao da incubadora sobre qualquer startup).
 *
 * Com `gestao` (admin/root em StartupDetail), a aba tambem:
 *   - lista, vincula e desvincula os MENTORES da startup (mentor_startup);
 *   - cadastra uma pessoa nova e ja a coloca na equipe, sem passar pela tela
 *     de Usuarios — POST /tenants/:id/usuarios e, em seguida,
 *     POST /startups/:id/membros.
 * Os dois exigem o admin no backend, por isso ficam fora da MinhaStartup.
 *
 * Com `somenteLeitura` (MinhaStartup), a aba so mostra a equipe: sem
 * adicionar, sem remover. O papel Colaborador nao tem
 * startups.membros.adicionar/remover, entao os botoes so levariam a um 403.
 *
 * Em qualquer modo, clicar num membro abre o perfil dele (somente leitura).
 */
import { useEffect, useMemo, useState } from "react"
import {
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  TextField,
  MenuItem,
  Alert,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material"
import { Add, CalendarMonth, Delete, Email, LinkOff, PersonAddAlt1, Phone, Visibility } from "@mui/icons-material"
import api from "../../services/api"
import TabelaDados from "../tabela/TabelaDados"
import CampoSenhaProvisoria from "../CampoSenhaProvisoria"
import { celularValido, formatarCelular, mascararCelular, MAX_CELULAR, somenteDigitos } from "../../utils/mascaras"
import { SITUACAO_ATIVO } from "../mentores/vocabulario"
import { dataDiaBR } from "../engajamento/vocabulario"

export default function AbaMembros({ idStartup, idTenant, gestao = false, somenteLeitura = false }) {
  const [membros, setMembros] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [aviso, setAviso] = useState(null)
  const [dialogAberto, setDialogAberto] = useState(false)
  const [perfil, setPerfil] = useState(null)

  const carregar = async () => {
    setCarregando(true)
    try {
      // A lista de usuarios do tenant so alimenta o "Adicionar membro" — e o
      // incubado nem tem acesso a ela.
      const [membrosRes, usuariosRes] = await Promise.all([
        api.get(`/startups/${idStartup}/membros`),
        somenteLeitura ? null : api.get(`/tenants/${idTenant}/usuarios`),
      ])
      setMembros(membrosRes.data.membros)
      if (usuariosRes) setUsuarios(usuariosRes.data.usuarios.filter((u) => u.ativo))
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao carregar os membros." })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idStartup])

  const idsMembros = useMemo(() => new Set(membros.map((m) => m.id_usuario)), [membros])

  const remover = async (idUsuario) => {
    if (!window.confirm("Remover este membro da startup?")) return
    setAviso(null)
    try {
      await api.delete(`/startups/${idStartup}/membros/${idUsuario}`)
      await carregar()
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao remover o membro." })
    }
  }

  const colunas = useMemo(
    () => [
      {
        chave: "nome",
        rotulo: "Nome",
        obrigatoria: true,
        largura: 220,
        valorTexto: (m) => m.nome,
        render: (m) => (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Avatar src={m.foto_url || undefined} sx={{ width: 32, height: 32, fontSize: 14, bgcolor: "primary.main" }}>
              {m.nome?.charAt(0).toUpperCase()}
            </Avatar>
            <Typography variant="body2" noWrap>
              {m.nome}
            </Typography>
          </Box>
        ),
      },
      { chave: "email", rotulo: "E-mail", largura: 240 },
      {
        chave: "lider",
        rotulo: "Papel",
        alinhamento: "center",
        largura: 110,
        valorOrdenacao: (m) => (m.lider ? 0 : 1),
        valorTexto: (m) => (m.lider ? "Lider" : "Membro"),
        render: (m) =>
          m.lider ? (
            <Chip size="small" label="Líder" color="primary" />
          ) : (
            <Typography variant="caption" color="text.secondary">
              Membro
            </Typography>
          ),
      },
      {
        chave: "entrada_dt",
        rotulo: "Entrada",
        alinhamento: "center",
        largura: 130,
        valorOrdenacao: (m) => m.entrada_dt,
        // entrada_dt e DATE: dataDiaBR le o dia gravado, sem converter fuso
        // (o toLocaleDateString mostrava um dia a menos em UTC-3).
        valorTexto: (m) => dataDiaBR(m.entrada_dt),
        render: (m) => dataDiaBR(m.entrada_dt) || "—",
      },
    ],
    []
  )

  return (
    <>
      {gestao && <SecaoMentores idStartup={idStartup} idTenant={idTenant} />}

      {aviso && (
        <Alert severity={aviso.tipo} sx={{ mb: 2 }} onClose={() => setAviso(null)}>
          {aviso.texto}
        </Alert>
      )}
      {(gestao || !somenteLeitura) && (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
          {gestao ? (
            <Typography variant="subtitle1" fontWeight={700}>
              Equipe
            </Typography>
          ) : (
            <span />
          )}
          {!somenteLeitura && (
            <Button variant="contained" startIcon={<Add />} onClick={() => setDialogAberto(true)}>
              Adicionar membro
            </Button>
          )}
        </Box>
      )}

      <TabelaDados
        dados={membros}
        colunas={colunas}
        chaveId="id_usuario"
        chaveStorage="startup-membros"
        ordemInicial="nome"
        carregando={carregando}
        larguraMinima={680}
        mensagemVazio="Nenhum membro cadastrado ainda."
        larguraAcoes={somenteLeitura ? 56 : 88}
        onClickLinha={setPerfil}
        acoes={[
          {
            rotulo: "Ver perfil",
            icone: <Visibility fontSize="small" />,
            onClick: setPerfil,
          },
          ...(somenteLeitura
            ? []
            : [
                {
                  rotulo: "Remover",
                  icone: <Delete fontSize="small" />,
                  cor: "error.main",
                  onClick: (m) => remover(m.id_usuario),
                },
              ]),
        ]}
      />

      <DialogPerfilMembro membro={perfil} onFechar={() => setPerfil(null)} />

      {!somenteLeitura && (
        <DialogAdicionarMembro
          aberto={dialogAberto}
          onFechar={() => setDialogAberto(false)}
          idStartup={idStartup}
          idTenant={idTenant}
          usuarios={usuarios}
          idsMembros={idsMembros}
          podeCadastrar={gestao}
          onAdicionado={async () => {
            setDialogAberto(false)
            await carregar()
          }}
        />
      )}
    </>
  )
}

/**
 * O perfil de um membro, so para ver: foto, papel na equipe e como falar com
 * ele. Editar a pessoa continua sendo na tela de Usuarios (admin) ou no
 * proprio Perfil (o dono).
 */
function DialogPerfilMembro({ membro, onFechar }) {
  return (
    <Dialog open={Boolean(membro)} onClose={onFechar} maxWidth="xs" fullWidth>
      {membro && (
        <>
          <DialogContent sx={{ pt: 4, textAlign: "center" }}>
            <Avatar
              src={membro.foto_url || undefined}
              sx={{ width: 96, height: 96, fontSize: 36, bgcolor: "primary.main", mx: "auto", mb: 1.5 }}
            >
              {membro.nome?.charAt(0).toUpperCase()}
            </Avatar>
            <Typography variant="h6" fontWeight={700}>
              {membro.nome}
            </Typography>
            <Chip
              size="small"
              label={membro.lider ? "Líder" : "Membro"}
              color={membro.lider ? "primary" : "default"}
              sx={{ mt: 0.5, mb: 2.5 }}
            />

            <Box sx={{ display: "grid", gap: 1.25, textAlign: "left" }}>
              <LinhaPerfil icone={<Email fontSize="small" />}>
                <a href={`mailto:${membro.email}`} style={{ color: "inherit" }}>
                  {membro.email}
                </a>
              </LinhaPerfil>
              {membro.celular && (
                <LinhaPerfil icone={<Phone fontSize="small" />}>{formatarCelular(membro.celular)}</LinhaPerfil>
              )}
              {membro.entrada_dt && (
                <LinhaPerfil icone={<CalendarMonth fontSize="small" />}>
                  Na equipe desde {dataDiaBR(membro.entrada_dt)}
                </LinhaPerfil>
              )}
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={onFechar}>Fechar</Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  )
}

function LinhaPerfil({ icone, children }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "text.secondary", minWidth: 0 }}>
      {icone}
      <Typography variant="body2" sx={{ color: "text.primary", overflowWrap: "anywhere" }}>
        {children}
      </Typography>
    </Box>
  )
}

const FORM_PESSOA_VAZIO = { nome: "", email: "", celular: "", senha: "" }

function DialogAdicionarMembro({
  aberto,
  onFechar,
  idStartup,
  idTenant,
  usuarios,
  idsMembros,
  podeCadastrar,
  onAdicionado,
}) {
  // "existente" escolhe alguem ja cadastrado na incubadora; "novo" cadastra a
  // pessoa (papel usuario, senha provisoria) e ja a coloca na equipe.
  const [modo, setModo] = useState("existente")
  const [idUsuario, setIdUsuario] = useState("")
  const [pessoa, setPessoa] = useState(FORM_PESSOA_VAZIO)
  // A pessoa ja criada numa tentativa em que o vinculo falhou: tentar de novo
  // so refaz o vinculo, senao o cadastro repetido daria "e-mail ja cadastrado".
  const [idCriado, setIdCriado] = useState(null)
  const [lider, setLider] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState(null)

  useEffect(() => {
    if (!aberto) return
    setModo("existente")
    setIdUsuario("")
    setPessoa(FORM_PESSOA_VAZIO)
    setIdCriado(null)
    setLider(false)
    setAviso(null)
  }, [aberto])

  const disponiveis = useMemo(() => usuarios.filter((u) => !idsMembros.has(u.id_usuario)), [usuarios, idsMembros])
  const alterarPessoa = (campo, valor) => setPessoa((p) => ({ ...p, [campo]: valor }))

  const salvar = async (e) => {
    e.preventDefault()
    setAviso(null)
    if (modo === "novo" && !celularValido(pessoa.celular)) {
      setAviso({ tipo: "error", texto: "Informe um celular válido, com DDD." })
      return
    }
    if (modo === "existente" && !idUsuario) return
    setSalvando(true)
    try {
      let id = idUsuario
      if (modo === "novo") {
        id = idCriado
        if (!id) {
          // O banco guarda o celular sem mascara (VARCHAR(15)).
          const { data } = await api.post(`/tenants/${idTenant}/usuarios`, {
            ...pessoa,
            celular: somenteDigitos(pessoa.celular),
            papel: "usuario",
          })
          id = data.usuario.id_usuario
          setIdCriado(id)
        }
      }
      await api.post(`/startups/${idStartup}/membros`, { id_usuario: id, lider })
      await onAdicionado()
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao adicionar o membro." })
    } finally {
      setSalvando(false)
    }
  }

  const podeSalvar = modo === "existente" ? Boolean(idUsuario) : true

  const campoPapel = (
    <TextField
      select
      label="Papel"
      fullWidth
      value={lider ? "1" : "0"}
      onChange={(e) => setLider(e.target.value === "1")}
    >
      <MenuItem value="0">Membro</MenuItem>
      <MenuItem value="1">Líder</MenuItem>
    </TextField>
  )

  const painelExistente = (
    <>
      <TextField
        select
        label="Usuário"
        fullWidth
        required
        value={idUsuario}
        onChange={(e) => setIdUsuario(e.target.value)}
        sx={{ mb: 2 }}
        helperText={
          disponiveis.length === 0 && podeCadastrar
            ? "Ninguém disponível. Use \"Cadastrar nova pessoa\"."
            : undefined
        }
      >
        {disponiveis.map((u) => (
          <MenuItem key={u.id_usuario} value={u.id_usuario}>
            {u.nome} ({u.email})
          </MenuItem>
        ))}
      </TextField>
      {campoPapel}
    </>
  )

  const painelNovo = (
    <>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Nome"
            fullWidth
            required
            value={pessoa.nome}
            onChange={(e) => alterarPessoa("nome", e.target.value)}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Celular"
            fullWidth
            required
            value={pessoa.celular}
            onChange={(e) => alterarPessoa("celular", mascararCelular(e.target.value))}
            placeholder="(11) 98765-4321"
            inputProps={{ maxLength: MAX_CELULAR, inputMode: "numeric" }}
            error={Boolean(pessoa.celular) && !celularValido(pessoa.celular)}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            label="E-mail"
            type="email"
            fullWidth
            required
            value={pessoa.email}
            onChange={(e) => alterarPessoa("email", e.target.value)}
          />
        </Grid>
        <Grid item xs={12}>
          <CampoSenhaProvisoria
            helperText="Ao menos 6 caracteres. A pessoa será obrigada a redefini-la no primeiro login."
            value={pessoa.senha}
            onChange={(senha) => alterarPessoa("senha", senha)}
            email={pessoa.email}
          />
        </Grid>
      </Grid>
      {campoPapel}
    </>
  )

  return (
    <Dialog open={aberto} onClose={onFechar} maxWidth={podeCadastrar ? "sm" : "xs"} fullWidth>
      <Box component="form" onSubmit={salvar}>
        <DialogTitle>Adicionar membro</DialogTitle>
        <DialogContent dividers>
          {aviso && (
            <Alert severity={aviso.tipo} sx={{ mb: 2 }} onClose={() => setAviso(null)}>
              {aviso.texto}
            </Alert>
          )}

          {podeCadastrar && (
            <ToggleButtonGroup
              exclusive
              fullWidth
              size="small"
              value={modo}
              onChange={(_, v) => v && setModo(v)}
              disabled={Boolean(idCriado)}
              sx={{ mb: 2 }}
            >
              <ToggleButton value="existente">Já cadastrado</ToggleButton>
              <ToggleButton value="novo">Cadastrar nova pessoa</ToggleButton>
            </ToggleButtonGroup>
          )}

          {podeCadastrar ? (
            // Os dois paineis dividem a mesma celula do grid: o card fica com a
            // altura do maior e nao muda de tamanho ao trocar de aba.
            <Box sx={{ display: "grid" }}>
              <PainelModo ativo={modo === "existente"}>{painelExistente}</PainelModo>
              <PainelModo ativo={modo === "novo"}>{painelNovo}</PainelModo>
            </Box>
          ) : (
            painelExistente
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onFechar}>Cancelar</Button>
          <Button type="submit" variant="contained" disabled={salvando || !podeSalvar}>
            {salvando ? (
              <CircularProgress size={22} color="inherit" />
            ) : modo === "novo" ? (
              "Cadastrar e adicionar"
            ) : (
              "Adicionar"
            )}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}

/**
 * Um painel do DialogAdicionarMembro. O inativo continua no DOM (e o que segura
 * a altura do card), mas invisivel e num fieldset desabilitado: assim os campos
 * "required" dele nao barram o envio do formulario da outra aba.
 */
function PainelModo({ ativo, children }) {
  return (
    <Box
      component="fieldset"
      disabled={!ativo}
      sx={{ gridArea: "1 / 1", visibility: ativo ? "visible" : "hidden", border: 0, m: 0, p: 0, minWidth: 0 }}
    >
      {children}
    </Box>
  )
}

/**
 * Os mentores que acompanham a startup. O vinculo e o mesmo da tela de
 * Mentores (mentor_startup); aqui e so o atalho pelo lado da startup.
 */
function SecaoMentores({ idStartup, idTenant }) {
  const [mentores, setMentores] = useState([])
  const [todos, setTodos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [aviso, setAviso] = useState(null)
  const [dialogAberto, setDialogAberto] = useState(false)
  const [escolhido, setEscolhido] = useState("")
  const [salvando, setSalvando] = useState(false)

  const carregar = async () => {
    setCarregando(true)
    try {
      const [daStartup, doTenant] = await Promise.all([
        api.get(`/startups/${idStartup}/mentores`),
        api.get("/mentores", { params: { id_tenant: idTenant } }),
      ])
      setMentores(daStartup.data.mentores)
      setTodos(doTenant.data.mentores)
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao carregar os mentores." })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idStartup])

  // So mentores ativos que ainda nao acompanham esta startup.
  const disponiveis = useMemo(() => {
    const ja = new Set(mentores.map((m) => m.id_usuario))
    return todos.filter((m) => !ja.has(m.id_usuario) && m.situacao === SITUACAO_ATIVO)
  }, [mentores, todos])

  const vincular = async (e) => {
    e.preventDefault()
    if (!escolhido) return
    setSalvando(true)
    setAviso(null)
    try {
      await api.post(`/mentores/${escolhido}/startups`, { id_tenant: idTenant, id_startup: idStartup })
      setDialogAberto(false)
      setEscolhido("")
      await carregar()
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao vincular o mentor." })
    } finally {
      setSalvando(false)
    }
  }

  const desvincular = async (mentor) => {
    if (!window.confirm(`${mentor.nome} deixará de acompanhar esta startup. Continuar?`)) return
    setAviso(null)
    try {
      await api.delete(`/mentores/${mentor.id_usuario}/startups/${idStartup}`, {
        params: { id_tenant: idTenant },
      })
      await carregar()
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao desvincular o mentor." })
    }
  }

  return (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
        <Typography variant="subtitle1" fontWeight={700}>
          Mentores
        </Typography>
        <Button variant="outlined" startIcon={<PersonAddAlt1 />} onClick={() => setDialogAberto(true)}>
          Adicionar mentor
        </Button>
      </Box>

      {aviso && (
        <Alert severity={aviso.tipo} sx={{ mb: 2 }} onClose={() => setAviso(null)}>
          {aviso.texto}
        </Alert>
      )}

      {carregando ? (
        <CircularProgress size={22} />
      ) : mentores.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Nenhum mentor acompanha esta startup ainda.
        </Typography>
      ) : (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          {mentores.map((m) => (
            <Chip
              key={m.id_usuario}
              label={m.nome}
              title={m.email}
              onDelete={() => desvincular(m)}
              deleteIcon={<LinkOff />}
            />
          ))}
        </Box>
      )}

      <Dialog open={dialogAberto} onClose={() => setDialogAberto(false)} maxWidth="xs" fullWidth>
        <Box component="form" onSubmit={vincular}>
          <DialogTitle>Adicionar mentor</DialogTitle>
          <DialogContent dividers>
            <TextField
              select
              label="Mentor"
              fullWidth
              required
              value={escolhido}
              onChange={(e) => setEscolhido(e.target.value)}
              helperText={
                disponiveis.length === 0
                  ? "Nenhum mentor ativo disponível. Cadastre mentores na tela de Mentores."
                  : undefined
              }
            >
              {disponiveis.map((m) => (
                <MenuItem key={m.id_usuario} value={m.id_usuario}>
                  {m.nome} ({m.email})
                </MenuItem>
              ))}
            </TextField>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setDialogAberto(false)}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={salvando || !escolhido}>
              {salvando ? <CircularProgress size={22} color="inherit" /> : "Adicionar"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  )
}
