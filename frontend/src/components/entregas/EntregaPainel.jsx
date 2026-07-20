/**
 * Coluna direita da tela de Entregas: o que a startup entregou e a devolutiva.
 *
 * Duas metades. Em cima, o conteudo entregue — texto, anexos e, quando o passo
 * e um questionario, as respostas pergunta a pergunta. Embaixo, a decisao do
 * mentor.
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
} from "@mui/icons-material"

import SituacaoChip from "./SituacaoChip"
import { SITUACAO, DECISOES } from "../../data/avaliacaoMeta"

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

export default function EntregaPainel({ entrega, carregando, onAvaliar }) {
  const [form, setForm] = useState(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState(null)

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
            O conteudo entregue e o campo de devolutiva aparecem aqui.
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
      setAviso(err.response?.data?.erro || "Nao foi possivel registrar a avaliacao.")
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
          {entrega.respostas?.length > 0 ? (
            <Respostas respostas={entrega.respostas} />
          ) : entrega.texto_resposta ? (
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
              {entrega.texto_resposta}
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary" fontStyle="italic">
              Sem texto — veja os anexos.
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
                      <IconButton
                        size="small"
                        component="a"
                        href={anexo.url}
                        target="_blank"
                        rel="noopener"
                      >
                        <OpenInNew sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  ) : (
                    <Tooltip title="O arquivo nao foi armazenado no servidor — peca a startup pelo canal combinado." arrow>
                      <Typography variant="caption" color="text.secondary">
                        indisponivel
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
                {entrega.comentario || "Sem comentario."}
              </Typography>
              {entrega.avaliador && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                  por {entrega.avaliador}
                </Typography>
              )}
            </Paper>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: "block" }}>
              {entrega.situacao === "AJUSTE"
                ? "A startup pode corrigir e reenviar — quando isso acontecer, a entrega volta para a sua fila."
                : "Esta entrega ja foi respondida."}
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
                label="Decisao"
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
              label="Comentario"
              placeholder="O que funcionou, o que falta e o proximo passo."
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

/**
 * anexos e TEXT[] e o conteudo variou ao longo do tempo: ha JSON
 * ({nome, tamanho, url}, gravado pela Jornada), ha url pura e ha linhas que
 * guardam so o nome do arquivo. Normaliza os tres para {nome, url}.
 */
function parseAnexo(valor) {
  try {
    const obj = JSON.parse(valor)
    if (obj && typeof obj === "object") return obj
  } catch {
    // Nao era JSON: cai no tratamento de texto simples abaixo.
  }
  return { url: valor, nome: valor.split("/").pop() }
}

/**
 * Da para abrir este anexo?
 *
 * Duas armadilhas, as duas presentes nos dados de hoje. `blob:` vem de
 * URL.createObjectURL no envio: so existe na aba de quem enviou, e para o
 * mentor esta morto. E ha anexos gravados apenas com o NOME do arquivo, que
 * viraria um link relativo para lugar nenhum. Nos dois casos vale mais mostrar
 * o nome e dizer que o arquivo nao esta disponivel do que oferecer um botao
 * que nao abre nada.
 */
function anexoAcessivel(anexo) {
  const url = anexo?.url
  if (!url || url.startsWith("blob:")) return false
  return /^https?:\/\//i.test(url) || url.startsWith("/")
}
