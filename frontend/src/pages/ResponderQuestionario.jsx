/**
 * Tela de resposta a um questionario dentro de um PASSO da trilha.
 *
 * Fluxo: o passo e do tipo QUESTIONARIO e aponta para um questionario. Esta
 * tela carrega o questionario, renderiza cada pergunta conforme seu tipo
 * (texto curto, paragrafo, escolha unica, caixas de selecao) e envia as
 * respostas como uma ENTREGA da startup.
 *
 * Endpoints:
 *   GET  /trilha/:id              -> o passo (tem tipo_passo e id_questionario)
 *   GET  /questionarios/:id       -> questionario com perguntas/alternativas
 *   GET  /startups?id_tenant=     -> startups (seletor de autoria da entrega)
 *   POST /entregas/questionario   -> grava entrega + respostas
 */
import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  MenuItem,
  Radio,
  RadioGroup,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormLabel,
  FormGroup,
  Stack,
  Alert,
  CircularProgress,
} from "@mui/material"
import { Quiz, ArrowBack } from "@mui/icons-material"
import AppLayout from "../components/AppLayout"
import api from "../services/api"
import { useAuthStore } from "../store/authStore"

const TIPOS_TEXTO = ["TEXTO_CURTO", "PARAGRAFO"]

export default function ResponderQuestionario() {
  const { idNo } = useParams()
  const navigate = useNavigate()
  const usuario = useAuthStore((s) => s.usuario)
  const idTenant = usuario?.id_tenant ?? null

  const [passo, setPasso] = useState(null)
  const [questionario, setQuestionario] = useState(null)
  const [startups, setStartups] = useState([])
  const [startupId, setStartupId] = useState("")
  const [carregando, setCarregando] = useState(true)
  const [aviso, setAviso] = useState(null) // { tipo, texto }
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  // Respostas em edicao, indexadas por id_pergunta:
  //   texto -> string (tipos de texto)
  //   alternativas -> number[] (tipos de escolha)
  const [respostas, setRespostas] = useState({})

  useEffect(() => {
    ;(async () => {
      setCarregando(true)
      setAviso(null)
      try {
        const { data: pData } = await api.get(`/trilha/${idNo}`)
        const p = pData.no
        setPasso(p)

        if (p.tipo_passo !== "QUESTIONARIO" || !p.id_questionario) {
          setAviso({ tipo: "error", texto: "Este passo nao possui questionario." })
          return
        }

        const [qResp, sResp] = await Promise.all([
          api.get(`/questionarios/${p.id_questionario}`),
          idTenant ? api.get("/startups", { params: { id_tenant: idTenant } }) : Promise.resolve({ data: { startups: [] } }),
        ])
        setQuestionario(qResp.data.questionario)
        setStartups(sResp.data.startups)
        if (sResp.data.startups.length === 1) setStartupId(sResp.data.startups[0].id_startup)
      } catch (err) {
        setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao carregar o questionario." })
      } finally {
        setCarregando(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idNo])

  const setTexto = (idPergunta, texto) =>
    setRespostas((r) => ({ ...r, [idPergunta]: { texto } }))

  const setEscolhaUnica = (idPergunta, idAlternativa) =>
    setRespostas((r) => ({ ...r, [idPergunta]: { alternativas: [Number(idAlternativa)] } }))

  const toggleCaixa = (idPergunta, idAlternativa, marcado) =>
    setRespostas((r) => {
      const atual = new Set(r[idPergunta]?.alternativas || [])
      if (marcado) atual.add(Number(idAlternativa))
      else atual.delete(Number(idAlternativa))
      return { ...r, [idPergunta]: { alternativas: [...atual] } }
    })

  const enviar = async (e) => {
    e.preventDefault()
    setAviso(null)

    if (!startupId) {
      setAviso({ tipo: "error", texto: "Selecione a startup responsavel pela entrega." })
      return
    }

    // Monta o payload no formato esperado pelo backend.
    const payload = questionario.perguntas.map((p) => ({
      idPergunta: p.id_pergunta,
      texto: respostas[p.id_pergunta]?.texto || "",
      alternativas: respostas[p.id_pergunta]?.alternativas || [],
    }))

    setEnviando(true)
    try {
      await api.post("/entregas/questionario", {
        id_no: Number(idNo),
        id_startup: startupId,
        respostas: payload,
      })
      setEnviado(true)
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao enviar as respostas." })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <AppLayout>
      <Box>
        <Button startIcon={<ArrowBack />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>
          Voltar
        </Button>

        {aviso && (
          <Alert severity={aviso.tipo} sx={{ mb: 3 }} onClose={() => setAviso(null)}>
            {aviso.texto}
          </Alert>
        )}

        {carregando ? (
          <Box sx={{ textAlign: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        ) : enviado ? (
          <Paper sx={{ p: 4, borderRadius: 0, textAlign: "center" }}>
            <Quiz sx={{ fontSize: 48, color: "success.main" }} />
            <Typography variant="h6" sx={{ mt: 1 }}>
              Respostas enviadas!
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              A entrega do questionario foi registrada com sucesso.
            </Typography>
            <Button variant="contained" onClick={() => navigate(-1)}>
              Concluir
            </Button>
          </Paper>
        ) : questionario ? (
          <Box component="form" onSubmit={enviar}>
            {/* Cabecalho */}
            <Paper sx={{ p: 3, borderRadius: 0, mb: 2, borderTop: 6, borderColor: "primary.main" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Quiz sx={{ color: "primary.main" }} />
                <Typography variant="h5" fontWeight={700}>
                  {questionario.titulo}
                </Typography>
              </Box>
              {passo?.nome && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Passo: {passo.nome}
                </Typography>
              )}
              {questionario.descricao && (
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  {questionario.descricao}
                </Typography>
              )}

              <TextField
                select
                label="Startup responsavel"
                required
                value={startupId}
                onChange={(e) => setStartupId(e.target.value)}
                sx={{ mt: 2, minWidth: 260 }}
                helperText="A entrega sera registrada em nome desta startup."
              >
                {startups.map((s) => (
                  <MenuItem key={s.id_startup} value={s.id_startup}>
                    {s.nome}
                  </MenuItem>
                ))}
              </TextField>
            </Paper>

            {/* Perguntas */}
            <Stack spacing={2}>
              {questionario.perguntas.map((p, i) => (
                <Paper key={p.id_pergunta} sx={{ p: 3, borderRadius: 0 }}>
                  <FormControl component="fieldset" fullWidth required={p.obrigatoria}>
                    <FormLabel component="legend" sx={{ mb: 1, color: "text.primary" }}>
                      <Typography component="span" fontWeight={600}>
                        {i + 1}. {p.pergunta}
                      </Typography>
                      {p.obrigatoria && (
                        <Typography component="span" color="error" sx={{ ml: 0.5 }}>
                          *
                        </Typography>
                      )}
                    </FormLabel>

                    {p.tipo === "TEXTO_CURTO" && (
                      <TextField
                        fullWidth
                        placeholder="Sua resposta"
                        value={respostas[p.id_pergunta]?.texto || ""}
                        onChange={(e) => setTexto(p.id_pergunta, e.target.value)}
                      />
                    )}

                    {p.tipo === "PARAGRAFO" && (
                      <TextField
                        fullWidth
                        multiline
                        minRows={3}
                        placeholder="Sua resposta"
                        value={respostas[p.id_pergunta]?.texto || ""}
                        onChange={(e) => setTexto(p.id_pergunta, e.target.value)}
                      />
                    )}

                    {p.tipo === "ESCOLHA_UNICA" && (
                      <RadioGroup
                        value={respostas[p.id_pergunta]?.alternativas?.[0] ?? ""}
                        onChange={(e) => setEscolhaUnica(p.id_pergunta, e.target.value)}
                      >
                        {p.alternativas.map((a) => (
                          <FormControlLabel
                            key={a.id_alternativa}
                            value={a.id_alternativa}
                            control={<Radio />}
                            label={a.descricao}
                          />
                        ))}
                      </RadioGroup>
                    )}

                    {p.tipo === "CAIXAS_SELECAO" && (
                      <FormGroup>
                        {p.alternativas.map((a) => (
                          <FormControlLabel
                            key={a.id_alternativa}
                            control={
                              <Checkbox
                                checked={
                                  respostas[p.id_pergunta]?.alternativas?.includes(a.id_alternativa) || false
                                }
                                onChange={(e) =>
                                  toggleCaixa(p.id_pergunta, a.id_alternativa, e.target.checked)
                                }
                              />
                            }
                            label={a.descricao}
                          />
                        ))}
                      </FormGroup>
                    )}
                  </FormControl>
                </Paper>
              ))}
            </Stack>

            <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 3 }}>
              <Button type="submit" variant="contained" size="large" disabled={enviando}>
                {enviando ? <CircularProgress size={24} color="inherit" /> : "Enviar respostas"}
              </Button>
            </Box>
          </Box>
        ) : null}
      </Box>
    </AppLayout>
  )
}
