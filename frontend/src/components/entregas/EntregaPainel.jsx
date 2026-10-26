/**
 * Coluna direita da tela de Entregas: o que a startup entregou e a devolutiva.
 *
 * Duas metades. Em cima, o conteudo entregue — texto, anexos e, quando o passo
 * e um questionario, as respostas pergunta a pergunta (numa prova, ja
 * corrigidas contra o gabarito). Embaixo, a decisao do mentor.
 *
 * Se a entrega ja foi avaliada, o painel mostra a devolutiva anterior em vez do
 * formulario: o reenvio da startup apaga as avaliacoes antigas
 * (jornadaRepository.reenviar), entao avaliar de novo aqui so empilharia
 * opiniao sobre a mesma versao do trabalho.
 */
import { useEffect, useState } from "react"
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  MenuItem,
  Divider,
  Alert,
  CircularProgress,
  Stack,
  Tooltip,
  IconButton,
} from "@mui/material"
import {
  Inbox,
  PictureAsPdf,
  OpenInNew,
  CalendarMonth,
  Person,
  CheckCircle,
  Cancel,
} from "@mui/icons-material"

import SituacaoChip from "./SituacaoChip"
import { SITUACAO, DECISOES } from "../../data/avaliacaoMeta"
import { abrirArquivo, anexoAcessivel, parseAnexo } from "../../services/arquivos"

const FORM_VAZIO = { status: "", nota: "", comentario: "" }

const dataHora = (ts) =>
  ts
    ? new Date(ts).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—"

/** Rotulo curto acima de um valor, repetido varias vezes no cabecalho. */
function Meta({ icone, children }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, color: "text.secondary" }}>
      {icone}
      <Typography variant="caption">{children}</Typography>
    </Box>
  )
}

/** Respostas de um passo do tipo QUESTIONARIO, agrupadas por pergunta. */
function Respostas({ respostas }) {
  // Caixas de selecao geram uma linha por alternativa marcada: junta de volta.
  const porPergunta = []
  for (const r of respostas) {
    const atual = porPergunta.find((p) => p.id_pergunta === r.id_pergunta)
    const valor = r.alternativa_descricao || r.texto_resposta
    if (atual) atual.valores.push(valor)
    else porPergunta.push({ id_pergunta: r.id_pergunta, pergunta: r.pergunta, valores: [valor] })
  }

  return (
    <Stack spacing={2}>
      {porPergunta.map((p) => (
        <Box key={p.id_pergunta}>
          <Typography variant="body2" fontWeight={700} gutterBottom>
            {p.pergunta}
          </Typography>
          {p.valores.map((v, i) => (
            <Typography key={i} variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>
              {v || "—"}
            </Typography>
          ))}
        </Box>
      ))}
    </Stack>
  )
}

/**
 * Respostas de uma PROVA, ja corrigidas. Percorre as perguntas da correcao, e
 * nao as respostas, para que a pergunta deixada em branco tambem apareca — ela
 * conta como erro na nota.
 */
function RespostasProva({ respostas, resultado }) {
  const percentual = resultado.total ? Math.round((resultado.acertos / resultado.total) * 100) : 0

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ px: 2, py: 1.5, borderRadius: 0 }}>
        <Typography variant="caption" fontWeight={700} color="text.secondary">
          CORREÇÃO AUTOMÁTICA
        </Typography>
        <Typography variant="h6" fontWeight={700}>
          {resultado.acertos} de {resultado.total} ({percentual}%)
        </Typography>
      </Paper>

      {resultado.perguntas.map((p) => {
        const marcadas = respostas.filter((r) => r.id_pergunta === p.id_pergunta && r.id_alternativa != null)
        return (
          <Box key={p.id_pergunta}>
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.75, mb: 0.5 }}>
              {p.acertou ? (
                <CheckCircle fontSize="small" color="success" sx={{ mt: 0.125 }} />
              ) : (
                <Cancel fontSize="small" color="error" sx={{ mt: 0.125 }} />
              )}
              <Typography variant="body2" fontWeight={700}>
                {p.pergunta}
              </Typography>
            </Box>
            <Box sx={{ pl: 3.5 }}>
              {marcadas.length === 0 ? (
                <Typography variant="body2" color="text.secondary" fontStyle="italic">
                  Em branco
                </Typography>
              ) : (
                marcadas.map((r) => {
                  const certa = p.corretas.includes(r.id_alternativa)
                  return (
                    <Typography
                      key={r.id_resposta}
                      variant="body2"
                      color={certa ? "success.main" : "error.main"}
                    >
                      {certa ? "✓" : "✗"} {r.alternativa_descricao}
                    </Typography>
                  )
                })
              )}
              {!p.acertou && (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                  Gabarito: {p.gabarito.join(" · ")}
                </Typography>
              )}
            </Box>
          </Box>
        )
      })}
    </Stack>
  )
}

export default function EntregaPainel({ entrega, carregando, onAvaliar }) {
  const [form, setForm] = useState(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState(null)

  /**
   * Abre um anexo da entrega.
   *
   * Nao pode ser <a href>: o anexo e PRIVADO e a API exige token, que a tag nao
   * envia. `abrirArquivo` busca com o cabecalho e abre o blob resultante — e
   * este e o caminho que o mentor usa para finalmente LER o que vai avaliar.
   */
  const abrirAnexo = async (anexo) => {
    setAviso(null)
    try {
      await abrirArquivo(anexo.url, anexo.nome)
    } catch (err) {
      setAviso({ tipo: "error", texto: err.message })
    }
  }

  // Trocar de entrega limpa o formulario: a decisao e sempre sobre a que esta
  // aberta, e um comentario digitado para outra startup nao pode vazar aqui.
  useEffect(() => {
    setForm(FORM_VAZIO)
    setAviso(null)
  }, [entrega?.id_entrega])

  if (carregando) {
    return (
      <Box sx={{ display: "grid", placeItems: "center", flex: 1, py: 10 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!entrega) {
    return (
      <Box sx={{ display: "grid", placeItems: "center", flex: 1, py: 10, px: 4, textAlign: "center" }}>
        <Box sx={{ color: "text.secondary" }}>
          <Inbox sx={{ fontSize: 56, opacity: 0.35 }} />
          <Typography sx={{ mt: 1 }}>Escolha uma entrega da fila</Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            O conteúdo entregue e o campo de devolutiva aparecem aqui.
          </Typography>
        </Box>
      </Box>
    )
  }

  const jaAvaliada = entrega.situacao !== "PENDENTE"
  const metaAvaliacao = SITUACAO[entrega.situacao] || SITUACAO.PENDENTE
  const alterar = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }))

  const enviar = async (e) => {
    e.preventDefault()
    setAviso(null)
    setSalvando(true)
    try {
      await onAvaliar({
        idEntrega: entrega.id_entrega,
        status: form.status,
        nota: form.nota,
        comentario: form.comentario,
      })
      setForm(FORM_VAZIO)
    } catch (err) {
      setAviso(err.response?.data?.erro || "Não foi possível registrar a avaliação.")
    } finally {
      setSalvando(false)
    }
  }

  const decisao = DECISOES.find((d) => d.valor === form.status)

  return (
    <Box sx={{ flex: 1, overflowY: "auto" }}>
      {/* --- Cabecalho: de quem e, de que passo e quando chegou --- */}
      <Box sx={{ px: 3, py: 2.5 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" fontWeight={700}>
              {entrega.passo}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {entrega.startup}
              {entrega.fase ? ` · ${entrega.fase}` : ""}
              {entrega.modulo ? ` · ${entrega.modulo}` : ""}
            </Typography>
          </Box>
          <SituacaoChip situacao={entrega.situacao} />
        </Box>

        <Stack direction="row" spacing={2.5} sx={{ mt: 1.5, flexWrap: "wrap" }}>
          <Meta icone={<Person sx={{ fontSize: 15 }} />}>
            Enviada por {entrega.autor || "—"}
          </Meta>
          <Meta icone={<CalendarMonth sx={{ fontSize: 15 }} />}>
            {dataHora(entrega.atualizado_ts || entrega.criado_ts)}
          </Meta>
        </Stack>

        {/* O que o passo pedia — sem isso o mentor avalia no escuro. */}
        {(entrega.entregavel || entrega.objetivo) && (
          <Paper
            variant="outlined"
            sx={{ mt: 2, p: 2, borderRadius: 0, bgcolor: "action.hover" }}
          >
            <Typography variant="caption" fontWeight={700} color="text.secondary">
              O QUE O PASSO PEDIA
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: "pre-wrap" }}>
              {entrega.entregavel || entrega.objetivo}
            </Typography>
          </Paper>
        )}
      </Box>

      <Divider />

      {/* --- O que foi entregue --- */}
      <Box sx={{ px: 3, py: 2.5 }}>
        <Typography variant="caption" fontWeight={700} color="text.secondary">
          A ENTREGA
        </Typography>

        <Box sx={{ mt: 1.5 }}>
          {entrega.resultado ? (
            <RespostasProva respostas={entrega.respostas} resultado={entrega.resultado} />
          ) : entrega.respostas?.length > 0 ? (
            <Respostas respostas={entrega.respostas} />
          ) : entrega.texto_resposta ? (
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
              {entrega.texto_resposta}
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary" fontStyle="italic">
              Sem texto, veja os anexos.
            </Typography>
          )}
        </Box>

        {entrega.anexos?.length > 0 && (
          <Stack spacing={1} sx={{ mt: 2 }}>
            {entrega.anexos.map((a, i) => {
              // anexos e TEXT[]: pode vir string (url) ou JSON com nome/url.
              const anexo = typeof a === "string" ? parseAnexo(a) : a
              const acessivel = anexoAcessivel(anexo)
              return (
                <Box
                  key={i}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    p: 1,
                    borderRadius: 1.5,
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <PictureAsPdf sx={{ color: acessivel ? "#ef4444" : "text.disabled" }} />
                  <Typography sx={{ flex: 1, fontWeight: 600, fontSize: 14 }} noWrap>
                    {anexo.nome || `Anexo ${i + 1}`}
                  </Typography>
                  {acessivel ? (
                    <Tooltip title="Abrir" arrow>
                      <IconButton size="small" onClick={() => abrirAnexo(anexo)}>
                        <OpenInNew sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  ) : (
                    <Tooltip title="O arquivo não foi armazenado no servidor, peça a startup pelo canal combinado." arrow>
                      <Typography variant="caption" color="text.secondary">
                        indisponível
                      </Typography>
                    </Tooltip>
                  )}
                </Box>
              )
            })}
          </Stack>
        )}

        {entrega.arquivo_url && (
          <Button
            size="small"
            startIcon={<OpenInNew />}
            component="a"
            href={entrega.arquivo_url}
            target="_blank"
            rel="noopener"
            sx={{ mt: 1.5, textTransform: "none" }}
          >
            Abrir arquivo enviado
          </Button>
        )}
      </Box>

      <Divider />

      {/* --- A devolutiva: formulario, ou o que ja foi respondido --- */}
      <Box sx={{ px: 3, py: 2.5 }}>
        {jaAvaliada ? (
          <>
            <Typography variant="caption" fontWeight={700} color="text.secondary">
              SUA DEVOLUTIVA
            </Typography>
            <Paper
              variant="outlined"
              sx={{
                mt: 1.5,
                p: 2,
                borderRadius: 0,
                borderLeft: "3px solid",
                borderLeftColor: metaAvaliacao.cor,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
                <Typography fontWeight={700} sx={{ color: metaAvaliacao.cor }}>
                  {metaAvaliacao.label}
                </Typography>
                {entrega.nota != null && (
                  <Typography variant="body2" color="text.secondary">
                    Nota {entrega.nota}
                  </Typography>
                )}
                <Box sx={{ flex: 1 }} />
                <Typography variant="caption" color="text.secondary">
                  {dataHora(entrega.avaliacao_ts)}
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                {entrega.comentario || "Sem comentário."}
              </Typography>
              {entrega.avaliador && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                  por {entrega.avaliador}
                </Typography>
              )}
            </Paper>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: "block" }}>
              {entrega.situacao === "AJUSTE"
                ? "A startup pode corrigir e reenviar, quando isso acontecer, a entrega volta para a sua fila."
                : "Esta entrega já foi respondida."}
            </Typography>
          </>
        ) : (
          <Box component="form" onSubmit={enviar}>
            <Typography variant="caption" fontWeight={700} color="text.secondary">
              SUA DEVOLUTIVA
            </Typography>

            {aviso && (
              <Alert severity="error" sx={{ mt: 1.5 }} onClose={() => setAviso(null)}>
                {aviso}
              </Alert>
            )}

            <Stack direction="row" spacing={2} sx={{ mt: 1.5 }}>
              <TextField
                select
                required
                size="small"
                label="Decisão"
                value={form.status}
                onChange={(e) => alterar("status", e.target.value)}
                sx={{ flex: 1 }}
                helperText={decisao?.ajuda || " "}
              >
                {DECISOES.map((d) => (
                  <MenuItem key={d.valor} value={d.valor}>
                    {d.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                size="small"
                label="Nota"
                type="number"
                value={form.nota}
                onChange={(e) => alterar("nota", e.target.value)}
                inputProps={{ min: 0, max: 100, step: "0.5" }}
                sx={{ width: 110 }}
                helperText="Opcional"
              />
            </Stack>

            <TextField
              fullWidth
              multiline
              minRows={4}
              label="Comentário"
              placeholder="O que funcionou, o que falta e o próximo passo."
              value={form.comentario}
              onChange={(e) => alterar("comentario", e.target.value)}
              // Pedir ajuste sem dizer o que ajustar devolve a startup ao ponto
              // de partida — o backend recusa, e o campo avisa antes.
              required={form.status === "AJUSTE"}
              sx={{ mt: 1 }}
            />

            <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
              <Button
                type="submit"
                variant="contained"
                disabled={salvando || !form.status}
              >
                {salvando ? <CircularProgress size={22} color="inherit" /> : "Registrar devolutiva"}
              </Button>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  )
}
