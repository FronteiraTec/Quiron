/**
 * Subpagina de Configuracoes: as integracoes de Inteligencia Artificial da
 * incubadora (docs/reunioes.md, decisao 6) — o provedor que transcreve as
 * reunioes gravadas, e a retencao do que foi gravado.
 *
 * A incubadora escolhe e PAGA o provedor. Sem a transcricao configurada e
 * ativa, as reunioes funcionam, mas nao gravam.
 *
 * A CHAVE DE API: a tela manda, o servidor guarda cifrada e nunca devolve —
 * aqui so aparece "termina em …abcd". Salvar sem preencher o campo mantem a
 * chave atual.
 *
 * Endpoints (autorizacao no backend: configuracoes.ia.visualizar / editar):
 *   GET  /ia-config?id_tenant=
 *   PUT  /ia-config/TRANSCRICAO
 *   POST /ia-config/TRANSCRICAO/testar
 *   PUT  /ia-config/retencao
 */
import { useCallback, useEffect, useState } from "react"
import { useOutletContext } from "react-router-dom"
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Grid,
  MenuItem,
  Paper,
  Switch,
  TextField,
  Typography,
} from "@mui/material"
import { CheckCircle, ErrorOutline, NetworkCheck, Save } from "@mui/icons-material"
import { iaConfigApi, mensagemErro } from "../services/reunioesApi"
import { instanteBR } from "../data/reuniaoMeta"

const AJUDA_PROVEDOR = {
  OPENAI: "Chave criada em platform.openai.com. O whisper-1 devolve o horário de cada frase.",
  DEEPGRAM: "Chave criada em console.deepgram.com. O nova-2 transcreve português do Brasil.",
  OPENAI_COMPATIVEL: "Qualquer serviço com a API de transcrição da OpenAI (ex.: Groq, em https://api.groq.com/openai/v1).",
}

const VAZIO = { provedor: "OPENAI", modelo: "whisper-1", url_base: "", chave: "", ativo: true }

function Validacao({ cfg }) {
  if (!cfg?.ultima_validacao_ts) {
    return (
      <Typography variant="caption" color="text.secondary">
        Conexão ainda não testada.
      </Typography>
    )
  }
  return cfg.ultima_validacao_ok ? (
    <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", color: "success.main" }}>
      <CheckCircle sx={{ fontSize: 18 }} />
      <Typography variant="caption">Funcionou no teste de {instanteBR(cfg.ultima_validacao_ts)}.</Typography>
    </Box>
  ) : (
    <Box sx={{ display: "flex", gap: 0.75, alignItems: "flex-start", color: "error.main" }}>
      <ErrorOutline sx={{ fontSize: 18, mt: 0.1 }} />
      <Typography variant="caption">
        Falhou em {instanteBR(cfg.ultima_validacao_ts)}: {cfg.ultima_validacao_erro}
      </Typography>
    </Box>
  )
}

export default function ConfiguracaoIA() {
  const { idTenant } = useOutletContext()
  const [dados, setDados] = useState(null)
  const [form, setForm] = useState(VAZIO)
  const [retencao, setRetencao] = useState({ audio_dias: 0, transcricao_dias: 180 })
  const [aviso, setAviso] = useState(null) // { tipo, texto }
  const [salvando, setSalvando] = useState(null) // "transcricao" | "teste" | "retencao"

  const carregar = useCallback(async () => {
    if (!idTenant) return
    try {
      const r = await iaConfigApi.listar(idTenant)
      setDados(r)
      setRetencao(r.retencao)
      const cfg = r.configuracoes.find((c) => c.finalidade === "TRANSCRICAO")
      setForm(cfg ? { provedor: cfg.provedor, modelo: cfg.modelo, url_base: cfg.url_base || "", chave: "", ativo: cfg.ativo } : VAZIO)
    } catch (err) {
      setAviso({ tipo: "error", texto: mensagemErro(err, "Não foi possível carregar as integrações.") })
    }
  }, [idTenant])

  useEffect(() => {
    setDados(null)
    setAviso(null)
    carregar()
  }, [carregar])

  if (!dados) {
    return (
      <Paper sx={{ borderRadius: 0, p: { xs: 3, sm: 6 }, textAlign: "center" }}>
        {aviso ? <Alert severity={aviso.tipo}>{aviso.texto}</Alert> : <CircularProgress />}
      </Paper>
    )
  }

  const catalogo = dados.provedores.TRANSCRICAO
  const cfg = dados.configuracoes.find((c) => c.finalidade === "TRANSCRICAO")
  const editavel = dados.pode_editar
  const mudar = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }))

  const salvarTranscricao = async (e) => {
    e.preventDefault()
    setSalvando("transcricao")
    setAviso(null)
    try {
      const corpo = { provedor: form.provedor, modelo: form.modelo, ativo: form.ativo }
      if (form.provedor === "OPENAI_COMPATIVEL") corpo.url_base = form.url_base
      if (form.chave.trim()) corpo.chave = form.chave.trim()
      await iaConfigApi.salvar(idTenant, "TRANSCRICAO", corpo)
      await carregar()
      setAviso({ tipo: "success", texto: "Integração de transcrição salva. Use “Testar conexão” para conferir a chave." })
    } catch (err) {
      setAviso({ tipo: "error", texto: mensagemErro(err, "Não foi possível salvar.") })
    } finally {
      setSalvando(null)
    }
  }

  const testar = async () => {
    setSalvando("teste")
    setAviso(null)
    try {
      const r = await iaConfigApi.testar(idTenant, "TRANSCRICAO")
      await carregar()
      setAviso(r.ok ? { tipo: "success", texto: "Conexão funcionando: o provedor aceitou a chave e o modelo." } : { tipo: "error", texto: `O teste falhou: ${r.erro}` })
    } catch (err) {
      setAviso({ tipo: "error", texto: mensagemErro(err, "Não foi possível testar.") })
    } finally {
      setSalvando(null)
    }
  }

  const salvarRetencao = async (e) => {
    e.preventDefault()
    setSalvando("retencao")
    setAviso(null)
    try {
      setRetencao(
        await iaConfigApi.salvarRetencao(idTenant, {
          audio_dias: Number(retencao.audio_dias),
          transcricao_dias: Number(retencao.transcricao_dias),
        })
      )
      setAviso({ tipo: "success", texto: "Retenção salva." })
    } catch (err) {
      setAviso({ tipo: "error", texto: mensagemErro(err, "Não foi possível salvar a retenção.") })
    } finally {
      setSalvando(null)
    }
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {aviso && (
        <Alert severity={aviso.tipo} onClose={() => setAviso(null)}>
          {aviso.texto}
        </Alert>
      )}

      <Paper component="form" onSubmit={salvarTranscricao} sx={{ borderRadius: 0, p: { xs: 2, sm: 3 } }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 0.5 }}>
          <Typography variant="h6" fontWeight={700}>
            Transcrição das reuniões
          </Typography>
          {cfg ? (
            <Chip size="small" label={cfg.ativo ? "Ativa" : "Desativada"} color={cfg.ativo ? "success" : "default"} />
          ) : (
            <Chip size="small" label="Não configurada" variant="outlined" />
          )}
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          Transforma em texto a fala de quem aceitou ser gravado. Roda à noite, fora do horário de expediente. Sem esta
          integração, as reuniões funcionam, mas não gravam.
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              select
              fullWidth
              label="Provedor"
              value={form.provedor}
              disabled={!editavel}
              onChange={(e) => setForm((f) => ({ ...f, provedor: e.target.value, modelo: catalogo[e.target.value].modeloPadrao }))}
              helperText={AJUDA_PROVEDOR[form.provedor]}
            >
              {Object.entries(catalogo).map(([chave, p]) => (
                <MenuItem key={chave} value={chave}>
                  {p.rotulo}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Autocomplete
              freeSolo
              options={catalogo[form.provedor]?.modelos || []}
              value={form.modelo}
              disabled={!editavel}
              onInputChange={(_, v) => mudar("modelo", v)}
              renderInput={(params) => <TextField {...params} label="Modelo" required />}
            />
          </Grid>
          {form.provedor === "OPENAI_COMPATIVEL" && (
            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                label="Endereço da API"
                placeholder="https://api.groq.com/openai/v1"
                value={form.url_base}
                disabled={!editavel}
                onChange={(e) => mudar("url_base", e.target.value)}
                helperText="Precisa ser https e público. Endereços da rede interna são recusados."
              />
            </Grid>
          )}
          <Grid item xs={12}>
            <TextField
              fullWidth
              type="password"
              autoComplete="new-password"
              label="Chave de API"
              value={form.chave}
              disabled={!editavel}
              onChange={(e) => mudar("chave", e.target.value)}
              placeholder={cfg?.chave_final ? `•••••••• termina em ${cfg.chave_final}` : ""}
              helperText={
                cfg?.chave_final
                  ? "Deixe em branco para manter a chave atual. A chave fica cifrada e ninguém a lê de volta."
                  : "A chave fica cifrada no servidor e ninguém a lê de volta, nem por esta tela."
              }
            />
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={<Switch checked={form.ativo} disabled={!editavel} onChange={(e) => mudar("ativo", e.target.checked)} />}
              label="Gravar e transcrever as reuniões"
            />
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
          <Validacao cfg={cfg} />
          {editavel && (
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={salvando === "teste" ? <CircularProgress size={16} /> : <NetworkCheck />}
                disabled={!cfg || Boolean(salvando)}
                onClick={testar}
              >
                Testar conexão
              </Button>
              <Button type="submit" variant="contained" startIcon={salvando === "transcricao" ? <CircularProgress size={16} color="inherit" /> : <Save />} disabled={Boolean(salvando)}>
                Salvar
              </Button>
            </Box>
          )}
        </Box>
      </Paper>

      <Paper sx={{ borderRadius: 0, p: { xs: 2, sm: 3 } }}>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
          Relatório das reuniões por IA
        </Typography>
        <Typography variant="body2" color="text.secondary">
          O resumo, as decisões e o plano de ação de cada reunião, gerados a partir da transcrição. Chega na próxima etapa do
          módulo de reuniões.
        </Typography>
      </Paper>

      <Paper component="form" onSubmit={salvarRetencao} sx={{ borderRadius: 0, p: { xs: 2, sm: 3 } }}>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
          Por quanto tempo guardar
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          O que a incubadora guarda das reuniões gravadas. A exclusão é automática e fica registrada na auditoria.
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="number"
              label="Áudio (dias depois da transcrição)"
              value={retencao.audio_dias}
              disabled={!editavel}
              onChange={(e) => setRetencao((r) => ({ ...r, audio_dias: e.target.value }))}
              inputProps={{ min: 0, max: 30 }}
              helperText="0 = apaga logo depois de transcrever (recomendado). Máximo de 30 dias."
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="number"
              label="Transcrição (dias depois da reunião)"
              value={retencao.transcricao_dias}
              disabled={!editavel}
              onChange={(e) => setRetencao((r) => ({ ...r, transcricao_dias: e.target.value }))}
              inputProps={{ min: 1, max: 3650 }}
              helperText="Depois disso, o texto da reunião é apagado."
            />
          </Grid>
        </Grid>
        {editavel && (
          <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
            <Button type="submit" variant="contained" startIcon={salvando === "retencao" ? <CircularProgress size={16} color="inherit" /> : <Save />} disabled={Boolean(salvando)}>
              Salvar retenção
            </Button>
          </Box>
        )}
      </Paper>
    </Box>
  )
}
