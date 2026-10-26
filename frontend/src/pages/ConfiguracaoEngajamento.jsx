/**
 * Subpágina de Configurações: o desenho do ENGAJAMENTO — temporadas, ações que
 * pontuam, níveis de cada liga e os selos da incubadora.
 *
 * QUATRO BLOCOS, e cada um responde uma pergunta da coordenação:
 *   TEMPORADA  qual semestre está em disputa e o que está em jogo.
 *   AÇÕES      o que vale ponto, e quanto.
 *   NÍVEIS     a escada de cada liga (mentor e incubado sobem em ritmos
 *              diferentes, então são duas escadas).
 *   SELOS      o que a incubadora reconhece — e que NÃO vale ponto nenhum.
 *
 * O QUE NÃO SE EDITA AQUI, de propósito: a lista do que nunca pontua
 * (experimento, validação de hipótese, momento formativo, ajudar outro
 * empreendedor, publicar conteúdo). Ela é decisão de política da coordenação,
 * mora no backend e aparece na tela de Engajamento — transformá-la em
 * interruptor faria dela mais uma configuração a mexer, e o desenho inteiro
 * depende de ela ser estável.
 *
 * DESATIVAR, NÃO EXCLUIR, nas ações e nos selos: a ação já pontuou gente (o
 * extrato aponta para ela) e o selo já virou credencial pública de alguém.
 * Excluir só vale para selo que nunca saiu — e o backend devolve 409 com a
 * orientação quando não vale.
 *
 * Endpoints (autorização: `engajamento.configuracao.gerenciar` e
 * `engajamento.selos.*`):
 *   GET/POST/PUT/PATCH/DELETE /engajamento-config/temporadas
 *   GET/POST/PUT/PATCH        /engajamento-config/acoes
 *   GET/PUT                   /engajamento-config/niveis/:liga
 *   PUT                       /engajamento-config/linkedin
 *   GET/POST/PUT/PATCH/DELETE /selos
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { useOutletContext } from "react-router-dom"
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material"
import {
  Add,
  DeleteOutline,
  EditOutlined,
  InfoOutlined,
  MilitaryTech,
} from "@mui/icons-material"

import api from "../services/api"
import SeloAvatar from "../components/engajamento/SeloAvatar"
import {
  GATILHOS,
  LIGAS,
  LISTA_ICONES,
  PERIODOS_TETO,
  dataDiaBR,
  iconeDe,
  pts,
  rotuloGatilho,
  rotuloTeto,
} from "../components/engajamento/vocabulario"
import { useAgendaConfigStore } from "../store/agendaConfigStore"

const CORES = [
  "#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#64748b", "#7c3aed",
]

/** Cabeçalho de bloco: título, explicação e a ação principal. */
function Bloco({ titulo, descricao, acao, children }) {
  return (
    <Paper sx={{ borderRadius: 0, p: { xs: 2, sm: 3 }, mb: 3 }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, mb: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" fontWeight={700}>
            {titulo}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {descricao}
          </Typography>
        </Box>
        {acao}
      </Box>
      {children}
    </Paper>
  )
}

/** Seletor de cor em bolinhas — o mesmo gesto das outras telas de vocabulário. */
function EscolhaCor({ valor, onChange }) {
  return (
    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
      {CORES.map((cor) => (
        <Box
          key={cor}
          onClick={() => onChange(cor)}
          sx={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            bgcolor: cor,
            cursor: "pointer",
            outline: valor === cor ? "2px solid" : "none",
            outlineColor: "text.primary",
            outlineOffset: 2,
          }}
        />
      ))}
    </Box>
  )
}

function EscolhaIcone({ valor, onChange }) {
  return (
    <TextField select fullWidth label="Ícone" value={valor} onChange={(e) => onChange(e.target.value)}>
      {LISTA_ICONES.map((nome) => {
        const Icone = iconeDe(nome)
        return (
          <MenuItem key={nome} value={nome}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Icone fontSize="small" />
              {nome}
            </Box>
          </MenuItem>
        )
      })}
    </TextField>
  )
}

// ---------------------------------------------------------------------------
// TEMPORADAS
// ---------------------------------------------------------------------------

const TEMPORADA_VAZIA = { nome: "", inicio_dt: "", fim_dt: "", premiacao: "" }

function DialogoTemporada({ aberto, inicial, onFechar, onSalvar }) {
  const [form, setForm] = useState(TEMPORADA_VAZIA)
  const [erro, setErro] = useState(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!aberto) return
    setForm(
      inicial
        ? {
            nome: inicial.nome,
            inicio_dt: String(inicial.inicio_dt).slice(0, 10),
            fim_dt: String(inicial.fim_dt).slice(0, 10),
            premiacao: inicial.premiacao || "",
          }
        : TEMPORADA_VAZIA
    )
    setErro(null)
  }, [aberto, inicial])

  async function salvar() {
    setSalvando(true)
    setErro(null)
    try {
      await onSalvar(form)
      onFechar()
    } catch (err) {
      setErro(err.response?.data?.erro || "Não foi possível salvar a temporada.")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={aberto} onClose={onFechar} fullWidth maxWidth="sm">
      <DialogTitle>{inicial ? "Editar temporada" : "Nova temporada"}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
        {erro && (
          <Alert severity="error" sx={{ borderRadius: 0 }}>
            {erro}
          </Alert>
        )}
        <TextField
          label="Nome"
          value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
          placeholder="2026.2"
          helperText="Como a temporada aparece no placar."
        />
        <Box sx={{ display: "flex", gap: 2 }}>
          <TextField
            type="date"
            label="Início"
            fullWidth
            value={form.inicio_dt}
            onChange={(e) => setForm({ ...form, inicio_dt: e.target.value })}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            type="date"
            label="Término"
            fullWidth
            value={form.fim_dt}
            onChange={(e) => setForm({ ...form, fim_dt: e.target.value })}
            InputLabelProps={{ shrink: true }}
          />
        </Box>
        <TextField
          label="O que está em jogo"
          value={form.premiacao}
          onChange={(e) => setForm({ ...form, premiacao: e.target.value })}
          multiline
          minRows={2}
          placeholder="Viagem para o South Summit, imersão de 3 dias, a definir..."
          helperText="Aparece no topo da tela de Engajamento. Texto livre, a viabilidade muda a cada semestre."
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onFechar}>Cancelar</Button>
        <Button variant="contained" onClick={salvar} disabled={salvando}>
          {salvando ? <CircularProgress size={18} /> : "Salvar"}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// ACOES
// ---------------------------------------------------------------------------

const ACAO_VAZIA = {
  rotulo: "",
  descricao: "",
  gatilho: "MANUAL",
  categoria_evento: "",
  liga: "",
  pontos: 10,
  teto_pontos: "",
  teto_periodo: "",
  icone: "EmojiEvents",
  cor: "#6366f1",
}

function DialogoAcao({ aberto, inicial, categorias, acoes, onFechar, onSalvar }) {
  const [form, setForm] = useState(ACAO_VAZIA)
  const [erro, setErro] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const editando = Boolean(inicial)

  useEffect(() => {
    if (!aberto) return
    setForm(
      inicial
        ? {
            ...ACAO_VAZIA,
            ...inicial,
            descricao: inicial.descricao || "",
            liga: inicial.liga || "",
            teto_pontos: inicial.teto_pontos ?? "",
            teto_periodo: inicial.teto_periodo || "",
            categoria_evento: inicial.categoria_evento || "",
          }
        : ACAO_VAZIA
    )
    setErro(null)
  }, [aberto, inicial])

  async function salvar() {
    setSalvando(true)
    setErro(null)
    try {
      await onSalvar(form)
      onFechar()
    } catch (err) {
      setErro(err.response?.data?.erro || "Não foi possível salvar a ação.")
    } finally {
      setSalvando(false)
    }
  }

  const gatilho = GATILHOS.find((g) => g.valor === form.gatilho)

  // O banco aceita uma acao por categoria (uq_engajamento_acao_categoria) e
  // uma de mentoria por tenant — contando as desativadas. O que ja tem dono
  // aparece travado, com o nome da acao, em vez de falhar so ao salvar.
  const donoDaCategoria = new Map(
    acoes.filter((a) => a.categoria_evento).map((a) => [a.categoria_evento, a])
  )
  const acaoMentoria = acoes.find((a) => a.gatilho === "MENTORIA_MINISTRADA")

  return (
    <Dialog open={aberto} onClose={onFechar} fullWidth maxWidth="sm">
      <DialogTitle>{editando ? "Editar ação" : "Nova ação que pontua"}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
        {erro && (
          <Alert severity="error" sx={{ borderRadius: 0 }}>
            {erro}
          </Alert>
        )}

        <TextField
          label="Nome"
          value={form.rotulo}
          onChange={(e) => setForm({ ...form, rotulo: e.target.value })}
        />

        <TextField
          select
          label="De onde vem o ponto"
          value={form.gatilho}
          onChange={(e) => setForm({ ...form, gatilho: e.target.value })}
          disabled={editando}
          helperText={
            editando
              ? "O gatilho não muda depois de criado: trocá-lo mudaria o significado do que já foi pontuado."
              : gatilho?.ajuda
          }
        >
          {GATILHOS.map((g) => (
            <MenuItem
              key={g.valor}
              value={g.valor}
              disabled={!editando && g.valor === "MENTORIA_MINISTRADA" && Boolean(acaoMentoria)}
            >
              {g.rotulo}
              {!editando && g.valor === "MENTORIA_MINISTRADA" && acaoMentoria
                ? `, já existe ("${acaoMentoria.rotulo}")`
                : ""}
            </MenuItem>
          ))}
        </TextField>

        {form.gatilho === "PRESENCA_EVENTO" && (
          <TextField
            select
            label="Categoria da agenda"
            value={form.categoria_evento}
            onChange={(e) => setForm({ ...form, categoria_evento: e.target.value })}
            disabled={editando}
            helperText="Cada categoria é pontuada por uma ação só. Categoria sem ação não vale ponto."
          >
            {categorias.map((c) => {
              const dono = donoDaCategoria.get(c.chave)
              return (
                <MenuItem key={c.chave} value={c.chave} disabled={!editando && Boolean(dono)}>
                  {c.rotulo}
                  {!editando && dono
                    ? `, já pontuada por "${dono.rotulo}"${dono.ativo ? "" : " (desativada)"}`
                    : ""}
                </MenuItem>
              )
            })}
          </TextField>
        )}

        <TextField
          label="Descrição"
          value={form.descricao}
          onChange={(e) => setForm({ ...form, descricao: e.target.value })}
          multiline
          minRows={2}
        />

        <Box sx={{ display: "flex", gap: 2 }}>
          <TextField
            type="number"
            label="Pontos"
            fullWidth
            value={form.pontos}
            onChange={(e) => setForm({ ...form, pontos: e.target.value })}
            inputProps={{ min: 0, max: 1000 }}
          />
          <TextField
            select
            label="Vale para"
            fullWidth
            value={form.liga}
            onChange={(e) => setForm({ ...form, liga: e.target.value })}
            helperText="Em branco: as duas ligas."
          >
            <MenuItem value="">As duas ligas</MenuItem>
            {LIGAS.map((l) => (
              <MenuItem key={l.valor} value={l.valor}>
                Só {l.rotulo.toLowerCase()}
              </MenuItem>
            ))}
          </TextField>
        </Box>

        <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
          <TextField
            type="number"
            label="Teto de pontos"
            fullWidth
            value={form.teto_pontos}
            onChange={(e) => setForm({ ...form, teto_pontos: e.target.value })}
            inputProps={{ min: 1 }}
            helperText="Opcional. Impede que a ação repetível vire fazenda de pontos."
          />
          <TextField
            select
            label="Janela do teto"
            fullWidth
            value={form.teto_periodo}
            onChange={(e) => setForm({ ...form, teto_periodo: e.target.value })}
            disabled={!form.teto_pontos}
          >
            <MenuItem value="">—</MenuItem>
            {PERIODOS_TETO.map((p) => (
              <MenuItem key={p.valor} value={p.valor}>
                {p.rotulo}
              </MenuItem>
            ))}
          </TextField>
        </Box>

        <EscolhaIcone valor={form.icone} onChange={(icone) => setForm({ ...form, icone })} />
        <EscolhaCor valor={form.cor} onChange={(cor) => setForm({ ...form, cor })} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onFechar}>Cancelar</Button>
        <Button variant="contained" onClick={salvar} disabled={salvando}>
          {salvando ? <CircularProgress size={18} /> : "Salvar"}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// SELOS
// ---------------------------------------------------------------------------

const SELO_VAZIO = {
  nome: "",
  descricao: "",
  criterio: "",
  categoria: "",
  cor: "#7c3aed",
  icone: "MilitaryTech",
  imagem_url: "",
  permite_repetir: false,
}

function DialogoSelo({ aberto, inicial, onFechar, onSalvar }) {
  const [form, setForm] = useState(SELO_VAZIO)
  const [erro, setErro] = useState(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!aberto) return
    setForm(
      inicial
        ? {
            ...SELO_VAZIO,
            ...inicial,
            descricao: inicial.descricao || "",
            criterio: inicial.criterio || "",
            categoria: inicial.categoria || "",
            imagem_url: inicial.imagem_url || "",
          }
        : SELO_VAZIO
    )
    setErro(null)
  }, [aberto, inicial])

  async function salvar() {
    setSalvando(true)
    setErro(null)
    try {
      await onSalvar(form)
      onFechar()
    } catch (err) {
      setErro(err.response?.data?.erro || "Não foi possível salvar o selo.")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={aberto} onClose={onFechar} fullWidth maxWidth="sm">
      <DialogTitle>{inicial ? "Editar selo" : "Novo selo"}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
        {erro && (
          <Alert severity="error" sx={{ borderRadius: 0 }}>
            {erro}
          </Alert>
        )}

        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <SeloAvatar selo={form} tamanho={56} />
          <Typography variant="body2" color="text.secondary">
            É assim que ele aparece no mural, no perfil de quem receber e na credencial pública.
          </Typography>
        </Box>

        <TextField
          label="Nome"
          value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
          placeholder="Protagonismo em validação"
        />

        <TextField
          label="Critério"
          value={form.criterio}
          onChange={(e) => setForm({ ...form, criterio: e.target.value })}
          multiline
          minRows={2}
          helperText="Aparece na credencial pública. É o que faz o selo provar alguma coisa para quem não conhece a incubadora."
        />

        <TextField
          label="Categoria"
          value={form.categoria}
          onChange={(e) => setForm({ ...form, categoria: e.target.value })}
          placeholder="Protagonismo, Comunidade, Aprendizado..."
          helperText="Texto livre, serve para agrupar o mural."
        />

        <TextField
          label="Imagem do selo (URL, opcional)"
          value={form.imagem_url}
          onChange={(e) => setForm({ ...form, imagem_url: e.target.value })}
          helperText="Sem imagem, o selo usa o ícone e a cor abaixo."
        />

        <EscolhaIcone valor={form.icone} onChange={(icone) => setForm({ ...form, icone })} />
        <EscolhaCor valor={form.cor} onChange={(cor) => setForm({ ...form, cor })} />

        <FormControlLabel
          control={
            <Switch
              checked={form.permite_repetir}
              onChange={(e) => setForm({ ...form, permite_repetir: e.target.checked })}
            />
          }
          label="A mesma pessoa pode receber mais de uma vez"
        />

        <Alert severity="info" sx={{ borderRadius: 0 }}>
          Selo não vale pontos. Ele reconhece evolução e protagonismo, o que a coordenação
          decidiu que <strong>não</strong> deve virar moeda de ranking.
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={onFechar}>Cancelar</Button>
        <Button variant="contained" onClick={salvar} disabled={salvando}>
          {salvando ? <CircularProgress size={18} /> : "Salvar"}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// A PAGINA
// ---------------------------------------------------------------------------

export default function ConfiguracaoEngajamento() {
  const { idTenant } = useOutletContext()
  // `categorias` nasce null no store (ainda nao carregou) — o dialogo itera
  // sobre ela, entao o fallback evita a tela quebrar no primeiro render.
  const categorias = useAgendaConfigStore((s) => s.categorias) || []
  const carregarAgenda = useAgendaConfigStore((s) => s.carregar)

  const [temporadas, setTemporadas] = useState([])
  const [acoes, setAcoes] = useState([])
  const [niveis, setNiveis] = useState([])
  const [selos, setSelos] = useState([])
  const [linkedin, setLinkedin] = useState("")
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [aviso, setAviso] = useState(null)

  const [dlgTemporada, setDlgTemporada] = useState(null) // {inicial} | null
  const [dlgAcao, setDlgAcao] = useState(null)
  const [dlgSelo, setDlgSelo] = useState(null)

  // A escada de cada liga, memorizada: o EditorNiveis reinicia as linhas quando
  // esta prop muda, e um `niveis.filter()` direto no JSX criaria um array novo
  // a cada render da pagina — abrir um dialogo ou digitar no campo do LinkedIn
  // apagaria os degraus ainda nao salvos.
  const niveisPorLiga = useMemo(
    () => Object.fromEntries(LIGAS.map((l) => [l.valor, niveis.filter((n) => n.liga === l.valor)])),
    [niveis]
  )

  const carregar = useCallback(async () => {
    if (!idTenant) return
    setCarregando(true)
    setErro(null)
    try {
      const params = { id_tenant: idTenant }
      const [t, a, n, s, tenant] = await Promise.all([
        api.get("/engajamento-config/temporadas", { params }),
        api.get("/engajamento-config/acoes", { params: { ...params, incluir_inativas: true } }),
        api.get("/engajamento-config/niveis", { params }),
        api.get("/selos", { params: { ...params, incluir_inativos: true } }),
        api.get(`/tenants/${idTenant}`),
      ])
      setTemporadas(t.data.temporadas)
      setAcoes(a.data.acoes)
      setNiveis(n.data.niveis)
      setSelos(s.data.selos)
      setLinkedin(tenant.data.tenant?.linkedin_org_id || "")
    } catch (err) {
      setErro(err.response?.data?.erro || "Não foi possível carregar a configuração.")
    } finally {
      setCarregando(false)
    }
  }, [idTenant])

  useEffect(() => {
    carregar()
    if (idTenant) carregarAgenda(idTenant)
  }, [carregar, idTenant, carregarAgenda])

  async function comAviso(fn, texto) {
    await fn()
    setAviso({ tipo: "success", texto })
    await carregar()
  }

  if (!idTenant) {
    return <Alert severity="info">Selecione uma incubadora para configurar o engajamento.</Alert>
  }
  if (carregando) return <CircularProgress />

  return (
    <Box>
      {erro && (
        <Alert severity="error" sx={{ borderRadius: 0, mb: 3 }}>
          {erro}
        </Alert>
      )}
      {aviso && (
        <Alert
          severity={aviso.tipo}
          sx={{ borderRadius: 0, mb: 3 }}
          onClose={() => setAviso(null)}
        >
          {aviso.texto}
        </Alert>
      )}

      {/* --- TEMPORADAS --- */}
      <Bloco
        titulo="Temporadas"
        descricao="O período que se disputa. O ranking e os níveis são sempre dentro de uma temporada, encerrar congela o resultado para a premiação."
        acao={
          <Button startIcon={<Add />} onClick={() => setDlgTemporada({ inicial: null })}>
            Nova
          </Button>
        }
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Nome</TableCell>
              <TableCell>Período</TableCell>
              <TableCell>Em jogo</TableCell>
              <TableCell align="center">Encerrada</TableCell>
              <TableCell align="right" width={100} />
            </TableRow>
          </TableHead>
          <TableBody>
            {temporadas.map((t) => (
              <TableRow key={t.id_temporada}>
                <TableCell>{t.nome}</TableCell>
                <TableCell>
                  {dataDiaBR(t.inicio_dt)} a {dataDiaBR(t.fim_dt)}
                </TableCell>
                <TableCell sx={{ maxWidth: 240 }}>
                  <Typography variant="body2" noWrap title={t.premiacao || ""}>
                    {t.premiacao || "—"}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Switch
                    size="small"
                    checked={t.encerrada}
                    onChange={(e) =>
                      comAviso(
                        () =>
                          api.patch(`/engajamento-config/temporadas/${t.id_temporada}/encerrada`, {
                            id_tenant: idTenant,
                            encerrada: e.target.checked,
                          }),
                        e.target.checked
                          ? `Temporada "${t.nome}" encerrada: o resultado está congelado.`
                          : `Temporada "${t.nome}" reaberta.`
                      )
                    }
                  />
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => setDlgTemporada({ inicial: t })}>
                    <EditOutlined fontSize="small" />
                  </IconButton>
                  <Tooltip title="Excluir. Os lançamentos não somem: viram histórico sem temporada.">
                    <IconButton
                      size="small"
                      onClick={() =>
                        comAviso(
                          () =>
                            api.delete(`/engajamento-config/temporadas/${t.id_temporada}`, {
                              params: { id_tenant: idTenant },
                            }),
                          `Temporada "${t.nome}" excluída.`
                        )
                      }
                    >
                      <DeleteOutline fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Bloco>

      {/* --- ACOES --- */}
      <Bloco
        titulo="O que gera pontos"
        descricao="Participação e relacionamento com a incubadora. Categoria de agenda sem ação aqui não vale ponto, o opt-in é explícito."
        acao={
          <Button startIcon={<Add />} onClick={() => setDlgAcao({ inicial: null })}>
            Nova ação
          </Button>
        }
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Ação</TableCell>
              <TableCell>Origem</TableCell>
              <TableCell>Liga</TableCell>
              <TableCell align="right">Pontos</TableCell>
              <TableCell>Teto</TableCell>
              <TableCell align="center">Ativa</TableCell>
              <TableCell align="right" width={56} />
            </TableRow>
          </TableHead>
          <TableBody>
            {acoes.map((a) => {
              const Icone = iconeDe(a.icone)
              return (
                <TableRow key={a.chave} sx={{ opacity: a.ativo ? 1 : 0.55 }}>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Icone sx={{ fontSize: 18, color: a.cor }} />
                      {a.rotulo}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{rotuloGatilho(a.gatilho)}</Typography>
                  </TableCell>
                  <TableCell>{a.liga || "Ambas"}</TableCell>
                  <TableCell align="right">{pts(a.pontos)}</TableCell>
                  <TableCell>
                    <Typography variant="caption">{rotuloTeto(a)}</Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Switch
                      size="small"
                      checked={a.ativo}
                      onChange={(e) =>
                        comAviso(
                          () =>
                            api.patch(`/engajamento-config/acoes/${a.chave}/ativo`, {
                              id_tenant: idTenant,
                              ativo: e.target.checked,
                            }),
                          e.target.checked
                            ? `"${a.rotulo}" voltou a pontuar.`
                            : `"${a.rotulo}" parou de pontuar. O que já foi lançado continua valendo.`
                        )
                      }
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => setDlgAcao({ inicial: a })}>
                      <EditOutlined fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>

        <Alert severity="info" icon={<InfoOutlined />} sx={{ borderRadius: 0, mt: 2 }}>
          Reprecificar uma ação <strong>não</strong> refaz o passado: cada ponto guarda o valor que
          valia no dia. Recalcular mudaria o ranking de um semestre que as pessoas já
          acompanharam.
        </Alert>
      </Bloco>

      {/* --- NIVEIS --- */}
      <Bloco
        titulo="Níveis"
        descricao="A escada de cada liga, dentro da temporada. São duas porque mentor e incubado participam em volumes diferentes, uma escada só deixaria a liga dos mentores parada no primeiro degrau."
      >
        <Grid container spacing={3}>
          {LIGAS.map((liga) => (
            <Grid item xs={12} md={6} key={liga.valor}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                {liga.rotulo}
              </Typography>
              <EditorNiveis
                idTenant={idTenant}
                liga={liga.valor}
                niveis={niveisPorLiga[liga.valor]}
                onSalvo={(qtd) =>
                  comAviso(async () => {}, `Escada de ${liga.rotulo.toLowerCase()} salva com ${qtd} níveis.`)
                }
              />
            </Grid>
          ))}
        </Grid>
      </Bloco>

      {/* --- SELOS --- */}
      <Bloco
        titulo="Selos"
        descricao="O que esta incubadora reconhece. Selos não valem pontos: eles reconhecem evolução e protagonismo, e viram credencial pública que a pessoa publica no LinkedIn."
        acao={
          <Button startIcon={<Add />} onClick={() => setDlgSelo({ inicial: null })}>
            Novo selo
          </Button>
        }
      >
        {selos.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 3 }}>
            <MilitaryTech sx={{ fontSize: 40, color: "text.disabled" }} />
            <Typography color="text.secondary">
              Nenhum selo ainda. Comece pelo que você já reconhece informalmente na incubadora.
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={2}>
            {selos.map((s) => (
              <Grid item xs={12} sm={6} key={s.id_selo}>
                <Paper
                  variant="outlined"
                  sx={{
                    borderRadius: 0,
                    p: 2,
                    display: "flex",
                    gap: 1.5,
                    opacity: s.ativo ? 1 : 0.55,
                  }}
                >
                  <SeloAvatar selo={s} tamanho={44} apagado={!s.ativo} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2" fontWeight={700} noWrap>
                      {s.nome}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {s.categoria || "Sem categoria"} · concedido {s.concedidos}x
                      {s.permite_repetir ? " · repetível" : ""}
                    </Typography>
                    {s.criterio && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {s.criterio}
                      </Typography>
                    )}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 1 }}>
                      <IconButton size="small" onClick={() => setDlgSelo({ inicial: s })}>
                        <EditOutlined fontSize="small" />
                      </IconButton>
                      <Tooltip
                        title={
                          s.concedidos > 0
                            ? "Já concedido: não pode ser excluído (há credenciais publicadas). Use o interruptor para desativar."
                            : "Excluir"
                        }
                      >
                        <span>
                          <IconButton
                            size="small"
                            disabled={s.concedidos > 0}
                            onClick={() =>
                              comAviso(
                                () =>
                                  api.delete(`/selos/${s.id_selo}`, {
                                    params: { id_tenant: idTenant },
                                  }),
                                `Selo "${s.nome}" excluído.`
                              )
                            }
                          >
                            <DeleteOutline fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Switch
                        size="small"
                        checked={s.ativo}
                        onChange={(e) =>
                          comAviso(
                            () =>
                              api.patch(`/selos/${s.id_selo}/ativo`, {
                                id_tenant: idTenant,
                                ativo: e.target.checked,
                              }),
                            e.target.checked
                              ? `Selo "${s.nome}" reativado.`
                              : `Selo "${s.nome}" desativado. As credenciais já emitidas continuam valendo.`
                          )
                        }
                      />
                    </Box>
                  </Box>
                </Paper>
              </Grid>
            ))}
          </Grid>
        )}

        <Divider sx={{ my: 3 }} />

        <Typography variant="subtitle2" fontWeight={700}>
          Página da incubadora no LinkedIn
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Opcional. Com ela, o botão "Adicionar ao perfil" da credencial liga a certificação à
          página real da organização; sem ela, o LinkedIn guarda só o nome como texto.
        </Typography>
        <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", maxWidth: 520 }}>
          <TextField
            size="small"
            fullWidth
            label="ID da página"
            value={linkedin}
            onChange={(e) => setLinkedin(e.target.value)}
            placeholder="1234567"
            helperText="Só dígitos, é o número que aparece na URL de administração da página."
          />
          <Button
            onClick={() =>
              comAviso(
                () =>
                  api.put("/engajamento-config/linkedin", {
                    id_tenant: idTenant,
                    linkedin_org_id: linkedin,
                  }),
                "Página do LinkedIn salva."
              )
            }
          >
            Salvar
          </Button>
        </Box>
      </Bloco>

      <DialogoTemporada
        aberto={Boolean(dlgTemporada)}
        inicial={dlgTemporada?.inicial}
        onFechar={() => setDlgTemporada(null)}
        onSalvar={async (form) => {
          const corpo = { ...form, id_tenant: idTenant }
          if (dlgTemporada?.inicial) {
            await api.put(
              `/engajamento-config/temporadas/${dlgTemporada.inicial.id_temporada}`,
              corpo
            )
          } else {
            await api.post("/engajamento-config/temporadas", corpo)
          }
          await carregar()
        }}
      />

      <DialogoAcao
        aberto={Boolean(dlgAcao)}
        inicial={dlgAcao?.inicial}
        categorias={categorias}
        acoes={acoes}
        onFechar={() => setDlgAcao(null)}
        onSalvar={async (form) => {
          const corpo = { ...form, id_tenant: idTenant }
          if (dlgAcao?.inicial) {
            await api.put(`/engajamento-config/acoes/${dlgAcao.inicial.chave}`, corpo)
          } else {
            await api.post("/engajamento-config/acoes", corpo)
          }
          await carregar()
        }}
      />

      <DialogoSelo
        aberto={Boolean(dlgSelo)}
        inicial={dlgSelo?.inicial}
        onFechar={() => setDlgSelo(null)}
        onSalvar={async (form) => {
          const corpo = { ...form, id_tenant: idTenant }
          if (dlgSelo?.inicial) {
            await api.put(`/selos/${dlgSelo.inicial.id_selo}`, corpo)
          } else {
            await api.post("/selos", corpo)
          }
          await carregar()
        }}
      />
    </Box>
  )
}

/**
 * A escada de uma liga, editada por inteiro.
 *
 * SUBSTITUI A ESCADA TODA em vez de fazer CRUD por degrau: a edição real é
 * "mexi nos níveis", e um CRUD linha a linha deixaria a escada num estado
 * inválido (dois degraus no mesmo corte) entre uma requisição e outra.
 *
 * O primeiro degrau é sempre 0 e o campo fica travado: sem ele, quem ainda não
 * pontuou ficaria sem nível nenhum — exatamente as pessoas que o módulo existe
 * para trazer para dentro.
 */
function EditorNiveis({ idTenant, liga, niveis, onSalvo }) {
  const [linhas, setLinhas] = useState(niveis)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(null)

  useEffect(() => setLinhas(niveis), [niveis])

  const alterar = (i, campo, valor) =>
    setLinhas(linhas.map((l, j) => (i === j ? { ...l, [campo]: valor } : l)))

  async function salvar() {
    setSalvando(true)
    setErro(null)
    try {
      await api.put(`/engajamento-config/niveis/${liga}`, {
        id_tenant: idTenant,
        niveis: linhas.map((l) => ({
          nome: l.nome,
          pontos_min: Number(l.pontos_min),
          cor: l.cor,
          icone: l.icone,
        })),
      })
      onSalvo(linhas.length)
    } catch (err) {
      setErro(err.response?.data?.erro || "Não foi possível salvar os níveis.")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Box>
      {erro && (
        <Alert severity="error" sx={{ borderRadius: 0, mb: 1 }}>
          {erro}
        </Alert>
      )}

      {linhas.map((n, i) => {
        const Icone = iconeDe(n.icone)
        return (
          <Box key={i} sx={{ display: "flex", gap: 1, alignItems: "center", mb: 1 }}>
            <Icone sx={{ fontSize: 20, color: n.cor }} />
            <TextField
              size="small"
              value={n.nome}
              onChange={(e) => alterar(i, "nome", e.target.value)}
              sx={{ flex: 1 }}
            />
            <TextField
              size="small"
              type="number"
              value={n.pontos_min}
              onChange={(e) => alterar(i, "pontos_min", e.target.value)}
              disabled={i === 0}
              sx={{ width: 100 }}
              inputProps={{ min: 0 }}
            />
            <IconButton
              size="small"
              disabled={i === 0}
              onClick={() => setLinhas(linhas.filter((_, j) => j !== i))}
            >
              <DeleteOutline fontSize="small" />
            </IconButton>
          </Box>
        )
      })}

      <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
        <Button
          size="small"
          startIcon={<Add />}
          onClick={() =>
            setLinhas([
              ...linhas,
              {
                nome: "Novo nível",
                pontos_min: (Number(linhas.at(-1)?.pontos_min) || 0) + 100,
                cor: "#6366f1",
                icone: "EmojiEvents",
              },
            ])
          }
        >
          Degrau
        </Button>
        <Button size="small" variant="contained" onClick={salvar} disabled={salvando}>
          {salvando ? <CircularProgress size={16} /> : "Salvar escada"}
        </Button>
      </Box>
    </Box>
  )
}
