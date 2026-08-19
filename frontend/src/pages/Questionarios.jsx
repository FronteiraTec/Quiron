/**
 * Tela de Questionarios (estilo Google Forms).
 *
 * Um questionario pertence a uma incubadora (tenant) e e composto por perguntas
 * de quatro tipos: Texto curto, Paragrafo, Escolha unica e Caixas de selecao.
 * Perguntas de escolha tem alternativas; as de texto, nao.
 *
 * Regra de acesso: apenas ADMIN da incubadora pode criar/ativar questionarios.
 * Os demais papeis veem a lista (leitura) para saber o que existe.
 *
 * Endpoints (protegidos por Bearer Token):
 *   GET   /questionarios?id_tenant=  -> lista do tenant
 *   GET   /questionarios/:id         -> questionario com perguntas/alternativas
 *   POST  /questionarios             -> cria (admin)
 *   PATCH /questionarios/:id/ativo   -> ativa/desativa (admin)
 */
import { useEffect, useMemo, useState } from "react"
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
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
  Divider,
  Alert,
  CircularProgress,
  Tooltip,
} from "@mui/material"
import {
  Add,
  Quiz,
  Delete,
  Visibility,
  DragIndicator,
  Notes,
  Subject,
  RadioButtonChecked,
  CheckBox,
} from "@mui/icons-material"
import AppLayout from "../components/AppLayout"
import api from "../services/api"
import { useAuthStore } from "../store/authStore"
import TabelaDados from "../components/tabela/TabelaDados"
import ToolbarTabela from "../components/tabela/ToolbarTabela"
import PainelFiltros, { contarFiltros } from "../components/tabela/PainelFiltros"
import { exportarTabelaCsv } from "../components/tabela/exportarTabela"

// Tipos de pergunta: valor no backend (enum) + rotulo e icone.
const TIPOS_PERGUNTA = [
  { valor: "TEXTO_CURTO", rotulo: "Texto curto", icone: <Notes fontSize="small" />, alternativas: false },
  { valor: "PARAGRAFO", rotulo: "Parágrafo", icone: <Subject fontSize="small" />, alternativas: false },
  { valor: "ESCOLHA_UNICA", rotulo: "Escolha única", icone: <RadioButtonChecked fontSize="small" />, alternativas: true },
  { valor: "CAIXAS_SELECAO", rotulo: "Caixas de seleção", icone: <CheckBox fontSize="small" />, alternativas: true },
]
const TIPO_POR_VALOR = Object.fromEntries(TIPOS_PERGUNTA.map((t) => [t.valor, t]))
const tipoTemAlternativas = (tipo) => !!TIPO_POR_VALOR[tipo]?.alternativas

// Fabricas de estado em branco para o construtor.
const novaAlternativa = () => ({ descricao: "" })
const novaPergunta = () => ({
  pergunta: "",
  tipo: "TEXTO_CURTO",
  obrigatoria: false,
  alternativas: [novaAlternativa(), novaAlternativa()],
})
const FORM_VAZIO = () => ({ titulo: "", descricao: "", perguntas: [novaPergunta()] })

export default function Questionarios() {
  const usuario = useAuthStore((s) => s.usuario)
  const idTenant = usuario?.id_tenant ?? null
  const isAdmin = usuario?.papel === "admin"

  const [questionarios, setQuestionarios] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [aviso, setAviso] = useState(null) // { tipo, texto }

  // Busca, filtros e colunas da listagem (ver TabelaDados).
  const [busca, setBusca] = useState("")
  const [filtros, setFiltros] = useState({})
  const [painelAberto, setPainelAberto] = useState(false)
  const [colunasVisiveis, setColunasVisiveis] = useState([])

  // Dialog de criacao (construtor).
  const [dialogAberto, setDialogAberto] = useState(false)
  const [form, setForm] = useState(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)

  // Dialog de visualizacao (leitura).
  const [preview, setPreview] = useState(null) // questionario completo
  const [carregandoPreview, setCarregandoPreview] = useState(false)

  const carregar = async () => {
    if (!idTenant) {
      setCarregando(false)
      return
    }
    setCarregando(true)
    try {
      const { data } = await api.get("/questionarios", { params: { id_tenant: idTenant } })
      setQuestionarios(data.questionarios)
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao carregar os questionários." })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idTenant])

  const abrirCriacao = () => {
    setAviso(null)
    setForm(FORM_VAZIO())
    setDialogAberto(true)
  }

  // ---- Manipulacao do construtor (perguntas / alternativas) ----
  const alterarCampo = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }))

  const alterarPergunta = (indice, patch) =>
    setForm((f) => ({
      ...f,
      perguntas: f.perguntas.map((p, i) => (i === indice ? { ...p, ...patch } : p)),
    }))

  const adicionarPergunta = () =>
    setForm((f) => ({ ...f, perguntas: [...f.perguntas, novaPergunta()] }))

  const removerPergunta = (indice) =>
    setForm((f) => ({ ...f, perguntas: f.perguntas.filter((_, i) => i !== indice) }))

  const alterarAlternativa = (pIndice, aIndice, valor) =>
    setForm((f) => ({
      ...f,
      perguntas: f.perguntas.map((p, i) =>
        i !== pIndice
          ? p
          : { ...p, alternativas: p.alternativas.map((a, j) => (j === aIndice ? { descricao: valor } : a)) }
      ),
    }))

  const adicionarAlternativa = (pIndice) =>
    setForm((f) => ({
      ...f,
      perguntas: f.perguntas.map((p, i) =>
        i !== pIndice ? p : { ...p, alternativas: [...p.alternativas, novaAlternativa()] }
      ),
    }))

  const removerAlternativa = (pIndice, aIndice) =>
    setForm((f) => ({
      ...f,
      perguntas: f.perguntas.map((p, i) =>
        i !== pIndice ? p : { ...p, alternativas: p.alternativas.filter((_, j) => j !== aIndice) }
      ),
    }))

  const salvar = async (e) => {
    e.preventDefault()
    setAviso(null)
    setSalvando(true)
    try {
      // Envia so as alternativas dos tipos de escolha; o backend valida tudo.
      const perguntas = form.perguntas.map((p) => ({
        pergunta: p.pergunta,
        tipo: p.tipo,
        obrigatoria: p.obrigatoria,
        alternativas: tipoTemAlternativas(p.tipo) ? p.alternativas : [],
      }))
      await api.post("/questionarios", {
        id_tenant: idTenant,
        titulo: form.titulo,
        descricao: form.descricao,
        perguntas,
      })
      setAviso({ tipo: "success", texto: "Questionário criado com sucesso." })
      setDialogAberto(false)
      await carregar()
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao criar o questionário." })
    } finally {
      setSalvando(false)
    }
  }

  const alternarAtivo = async (q) => {
    setAviso(null)
    try {
      await api.patch(`/questionarios/${q.id_questionario}/ativo`, { ativo: !q.ativo })
      await carregar()
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao alterar o status." })
    }
  }

  const abrirPreview = async (id) => {
    setCarregandoPreview(true)
    setPreview({ carregando: true })
    try {
      const { data } = await api.get(`/questionarios/${id}`)
      setPreview(data.questionario)
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao abrir o questionário." })
      setPreview(null)
    } finally {
      setCarregandoPreview(false)
    }
  }

  const colunas = useMemo(
    () => [
      {
        chave: "titulo",
        rotulo: "Título",
        obrigatoria: true,
        largura: 420,
        valorTexto: (q) => q.titulo,
        render: (q) => (
          <>
            <Typography variant="body2" fontWeight={600}>
              {q.titulo}
            </Typography>
            {q.descricao && (
              <Typography variant="body2" color="text.secondary">
                {q.descricao}
              </Typography>
            )}
          </>
        ),
      },
      { chave: "descricao", rotulo: "Descrição", visivelPadrao: false, largura: 320 },
      {
        chave: "total_perguntas",
        rotulo: "Perguntas",
        alinhamento: "center",
        largura: 120,
        valorOrdenacao: (q) => Number(q.total_perguntas),
        valorTexto: (q) => String(q.total_perguntas),
        render: (q) => <Chip size="small" label={q.total_perguntas} />,
      },
      {
        chave: "ativo",
        rotulo: "Status",
        alinhamento: "center",
        largura: 120,
        valorOrdenacao: (q) => (q.ativo ? 0 : 1),
        valorTexto: (q) => (q.ativo ? "Ativo" : "Inativo"),
        // O interruptor mora na COLUNA de status, e nao na area de acoes: e o
        // proprio valor da coluna que ele muda. Quem nao e admin le o mesmo
        // estado como chip.
        render: (q) =>
          isAdmin ? (
            <Tooltip title={q.ativo ? "Desativar" : "Ativar"}>
              <Switch
                data-tour="questionarios-ativo"
                size="small"
                checked={q.ativo}
                onChange={() => alternarAtivo(q)}
              />
            </Tooltip>
          ) : (
            <Chip
              size="small"
              label={q.ativo ? "Ativo" : "Inativo"}
              color={q.ativo ? "success" : "default"}
            />
          ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAdmin]
  )

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return questionarios.filter((q) => {
      const status = filtros.ativo || []
      if (status.length && !status.includes(q.ativo ? "sim" : "nao")) return false
      if (!termo) return true
      return `${q.titulo} ${q.descricao || ""}`.toLowerCase().includes(termo)
    })
  }, [questionarios, busca, filtros])

  const grupos = [
    {
      id: "ativo",
      rotulo: "Status",
      tipo: "checkbox",
      itens: [
        { id: "sim", rotulo: "Ativo" },
        { id: "nao", rotulo: "Inativo" },
      ],
    },
  ]

  return (
    <AppLayout>
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Quiz sx={{ color: "primary.main" }} />
            <Typography variant="h4" fontWeight={700}>
              Questionários
            </Typography>
          </Box>
          {isAdmin && (
            <Button data-tour="questionarios-novo" variant="contained" startIcon={<Add />} onClick={abrirCriacao} disabled={!idTenant}>
              Novo questionário
            </Button>
          )}
        </Box>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Crie formulários com perguntas de texto e de escolha. Os questionários ficam disponíveis
          para as tarefas do tipo Questionário.
        </Typography>

        {aviso && (
          <Alert severity={aviso.tipo} sx={{ mb: 3 }} onClose={() => setAviso(null)}>
            {aviso.texto}
          </Alert>
        )}

        {!idTenant ? (
          <Alert severity="info">
            Seu usuário não está vinculado a nenhuma incubadora, então não há questionários para gerenciar.
          </Alert>
        ) : (
          <Paper data-tour="questionarios-lista" sx={{ borderRadius: 0 }}>
            <ToolbarTabela
              busca={busca}
              onBuscaChange={setBusca}
              placeholderBusca="Buscar por título ou descrição..."
              totalFiltros={contarFiltros(filtros)}
              onAbrirFiltros={() => setPainelAberto(true)}
              onExportar={() =>
                exportarTabelaCsv("questionarios", colunas, colunasVisiveis, filtrados)
              }
            />

            <TabelaDados
              dados={filtrados}
              colunas={colunas}
              chaveId="id_questionario"
              chaveStorage="questionarios"
              ordemInicial="titulo"
              carregando={carregando}
              larguraMinima={720}
              mensagemVazio={
                questionarios.length === 0
                  ? "Nenhum questionário cadastrado ainda."
                  : "Nenhum questionário corresponde ao filtro."
              }
              onColunasVisiveisChange={setColunasVisiveis}
              larguraAcoes={56}
              acoes={[
                {
                  rotulo: "Visualizar",
                  icone: <Visibility fontSize="small" />,
                  atributos: { "data-tour": "questionarios-preview" },
                  onClick: (q) => abrirPreview(q.id_questionario),
                },
              ]}
            />
          </Paper>
        )}
      </Box>

      <PainelFiltros
        aberto={painelAberto}
        onFechar={() => setPainelAberto(false)}
        titulo="Filtrar questionários"
        grupos={grupos}
        selecionados={filtros}
        onAplicar={setFiltros}
        onLimpar={() => setFiltros({})}
      />

      {/* ---------------- Construtor (dialog de criacao) ---------------- */}
      <Dialog open={dialogAberto} onClose={() => setDialogAberto(false)} maxWidth="md" fullWidth>
        <Box component="form" onSubmit={salvar}>
          <DialogTitle>Novo questionário</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2}>
              <TextField
                label="Título"
                fullWidth
                required
                autoFocus
                value={form.titulo}
                onChange={(e) => alterarCampo("titulo", e.target.value)}
              />
              <TextField
                label="Descrição"
                fullWidth
                required
                multiline
                minRows={2}
                value={form.descricao}
                onChange={(e) => alterarCampo("descricao", e.target.value)}
              />

              <Divider textAlign="left">
                <Typography variant="overline" color="text.secondary">
                  Perguntas
                </Typography>
              </Divider>

              {form.perguntas.map((p, i) => (
                <Paper key={i} variant="outlined" sx={{ p: 2, borderRadius: 0 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                    <DragIndicator sx={{ color: "text.disabled" }} />
                    <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                      Pergunta {i + 1}
                    </Typography>
                    <Tooltip title="Remover pergunta">
                      <span>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => removerPergunta(i)}
                          disabled={form.perguntas.length === 1}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>

                  <Stack spacing={2}>
                    <TextField
                      label="Enunciado"
                      fullWidth
                      required
                      value={p.pergunta}
                      onChange={(e) => alterarPergunta(i, { pergunta: e.target.value })}
                    />
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
                      <TextField
                        label="Tipo"
                        select
                        value={p.tipo}
                        onChange={(e) => alterarPergunta(i, { tipo: e.target.value })}
                        sx={{ minWidth: 220 }}
                      >
                        {TIPOS_PERGUNTA.map((t) => (
                          <MenuItem key={t.valor} value={t.valor}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              {t.icone}
                              {t.rotulo}
                            </Box>
                          </MenuItem>
                        ))}
                      </TextField>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={p.obrigatoria}
                            onChange={(e) => alterarPergunta(i, { obrigatoria: e.target.checked })}
                          />
                        }
                        label="Obrigatória"
                      />
                    </Stack>

                    {/* Alternativas (apenas para tipos de escolha) */}
                    {tipoTemAlternativas(p.tipo) && (
                      <Box sx={{ pl: 1 }}>
                        {p.alternativas.map((a, j) => (
                          <Box key={j} sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                            {p.tipo === "ESCOLHA_UNICA" ? (
                              <RadioButtonChecked fontSize="small" sx={{ color: "text.disabled" }} />
                            ) : (
                              <CheckBox fontSize="small" sx={{ color: "text.disabled" }} />
                            )}
                            <TextField
                              size="small"
                              fullWidth
                              placeholder={`Alternativa ${j + 1}`}
                              value={a.descricao}
                              onChange={(e) => alterarAlternativa(i, j, e.target.value)}
                            />
                            <IconButton
                              size="small"
                              onClick={() => removerAlternativa(i, j)}
                              disabled={p.alternativas.length <= 2}
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </Box>
                        ))}
                        <Button size="small" startIcon={<Add />} onClick={() => adicionarAlternativa(i)}>
                          Adicionar alternativa
                        </Button>
                      </Box>
                    )}
                  </Stack>
                </Paper>
              ))}

              <Button startIcon={<Add />} onClick={adicionarPergunta} variant="outlined">
                Adicionar pergunta
              </Button>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setDialogAberto(false)}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={salvando}>
              {salvando ? <CircularProgress size={22} color="inherit" /> : "Criar questionário"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* ---------------- Visualizacao (leitura) ---------------- */}
      <Dialog open={!!preview} onClose={() => setPreview(null)} maxWidth="sm" fullWidth>
        {carregandoPreview || preview?.carregando ? (
          <Box sx={{ textAlign: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        ) : preview ? (
          <>
            <DialogTitle>{preview.titulo}</DialogTitle>
            <DialogContent dividers>
              {preview.descricao && (
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                  {preview.descricao}
                </Typography>
              )}
              <Stack spacing={2}>
                {preview.perguntas?.map((p, i) => {
                  const tipo = TIPO_POR_VALOR[p.tipo] || {}
                  return (
                    <Box key={p.id_pergunta}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Typography fontWeight={600}>
                          {i + 1}. {p.pergunta}
                        </Typography>
                        {p.obrigatoria && (
                          <Typography component="span" color="error">
                            *
                          </Typography>
                        )}
                      </Box>
                      <Chip
                        size="small"
                        icon={tipo.icone}
                        label={tipo.rotulo || p.tipo}
                        variant="outlined"
                        sx={{ mt: 0.5 }}
                      />
                      {p.alternativas?.length > 0 && (
                        <Stack sx={{ pl: 2, mt: 1 }} spacing={0.5}>
                          {p.alternativas.map((a) => (
                            <Typography key={a.id_alternativa} variant="body2" color="text.secondary">
                              {p.tipo === "ESCOLHA_UNICA" ? "○" : "☐"} {a.descricao}
                            </Typography>
                          ))}
                        </Stack>
                      )}
                    </Box>
                  )
                })}
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button onClick={() => setPreview(null)}>Fechar</Button>
            </DialogActions>
          </>
        ) : null}
      </Dialog>
    </AppLayout>
  )
}
