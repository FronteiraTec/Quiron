/**
 * Diagnostico de gravacao no navegador (/reunioes/diagnostico).
 *
 * POR QUE EXISTE: a Etapa 4 grava a fala de cada participante no PROPRIO
 * navegador (MediaRecorder, pedacos de 10 s mandados para a API — decisao 3 de
 * docs/reunioes.md). Antes de escrever a transcricao, a secao 12 do desenho
 * pede para confirmar, em Chrome, Edge, Firefox e Safari (e no celular):
 *
 *   1. os pedacos se juntam num arquivo que toca (o Safari grava MP4/AAC);
 *   2. silenciar o microfone grava silencio, sem encurtar o tempo;
 *   3. um pedaco perdido nao estraga o resto (aqui se simula a perda; a
 *      conferencia final e do ffmpeg, no servidor);
 *   4. a gravacao continua com a aba em segundo plano;
 *   5. no celular com a tela bloqueada, continua ou para de forma limpa.
 *
 * Esta tela faz a gravacao exatamente como a sala vai fazer — mesmas
 * restricoes de microfone, mesma taxa, mesmo intervalo — e registra o que
 * aconteceu. NADA SAI DO NAVEGADOR: os pedacos ficam na memoria e o arquivo e
 * baixado pela propria pessoa. O "Copiar relatorio" leva o resumo para quem
 * esta conduzindo a validacao.
 */
import { useEffect, useRef, useState } from "react"
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControlLabel,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material"
import { ContentCopy, Download, FiberManualRecord, Mic, MicOff, Stop } from "@mui/icons-material"
import AppLayout from "../components/AppLayout"

// Os mesmos valores que a gravacao da Etapa 4 vai usar.
const SEGUNDOS_POR_PARTE = 10
const BITS_POR_SEGUNDO = 24000
const RESTRICOES = { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }

const CANDIDATOS = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm"]

const hora = (ms) => new Date(ms).toLocaleTimeString("pt-BR", { hour12: false })
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`

export default function DiagnosticoGravacao() {
  const suportados = typeof MediaRecorder !== "undefined" ? CANDIDATOS.filter((m) => MediaRecorder.isTypeSupported?.(m)) : []
  const [mime, setMime] = useState(suportados[0] || "")
  const [gravando, setGravando] = useState(false)
  const [mudo, setMudo] = useState(false)
  const [partes, setPartes] = useState([])
  const [eventos, setEventos] = useState([])
  const [inicio, setInicio] = useState(null)
  const [fim, setFim] = useState(null)
  const [descartar, setDescartar] = useState("")
  const [erro, setErro] = useState(null)
  const [arquivo, setArquivo] = useState(null) // { url, nome, bytes, semParte }
  const [duracaoTocada, setDuracaoTocada] = useState(null)
  const [agora, setAgora] = useState(Date.now())

  const gravador = useRef(null)
  const fluxo = useRef(null)

  const anotar = (texto) => setEventos((e) => [...e, { ts: Date.now(), texto }])

  useEffect(() => {
    const visibilidade = () => anotar(document.visibilityState === "hidden" ? "aba foi para segundo plano" : "aba voltou a ficar visível")
    document.addEventListener("visibilitychange", visibilidade)
    const timer = setInterval(() => setAgora(Date.now()), 1000)
    return () => {
      document.removeEventListener("visibilitychange", visibilidade)
      clearInterval(timer)
      fluxo.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const comecar = async () => {
    setErro(null)
    setPartes([])
    setEventos([])
    setArquivo(null)
    setDuracaoTocada(null)
    setFim(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: RESTRICOES })
      fluxo.current = stream
      const trilha = stream.getAudioTracks()[0]
      trilha.addEventListener("mute", () => anotar("o sistema silenciou a trilha (mute)"))
      trilha.addEventListener("unmute", () => anotar("a trilha voltou (unmute)"))
      trilha.addEventListener("ended", () => anotar("a trilha do microfone terminou (ended)"))

      const rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: BITS_POR_SEGUNDO })
      rec.ondataavailable = (e) => {
        if (e.data?.size > 0) setPartes((p) => [...p, { n: p.length, ts: Date.now(), blob: e.data }])
      }
      rec.onerror = (e) => anotar(`erro do gravador: ${e.error?.name || "desconhecido"}`)
      rec.onpause = () => anotar("o gravador pausou")
      rec.onresume = () => anotar("o gravador retomou")
      rec.onstop = () => {
        anotar("o gravador parou")
        setGravando(false)
        setFim(Date.now())
      }
      rec.start(SEGUNDOS_POR_PARTE * 1000)
      gravador.current = rec
      setInicio(Date.now())
      setGravando(true)
      setMudo(false)
      anotar(`gravando em ${rec.mimeType || "formato padrão"} · configurações: ${JSON.stringify(trilha.getSettings?.() || {})}`)
    } catch (err) {
      setErro(err?.name === "NotAllowedError" ? "O navegador não deu acesso ao microfone." : `Não foi possível gravar: ${err?.message || err}`)
    }
  }

  const parar = () => {
    gravador.current?.state !== "inactive" && gravador.current?.stop()
    fluxo.current?.getTracks().forEach((t) => t.stop())
  }

  // Silenciar como o LiveKit silencia: a trilha fica, desativada.
  const alternarMudo = () => {
    const trilha = fluxo.current?.getAudioTracks()[0]
    if (!trilha) return
    trilha.enabled = !trilha.enabled
    setMudo(!trilha.enabled)
    anotar(trilha.enabled ? "microfone religado" : "microfone silenciado (enabled = false)")
  }

  // Monta o arquivo quando a gravacao termina e o ultimo pedaco chega.
  useEffect(() => {
    if (gravando || !fim || partes.length === 0) return
    const n = descartar === "" ? null : Number(descartar)
    const usadas = partes.filter((p) => p.n !== n)
    const tipo = partes[0].blob.type || mime || "audio/webm"
    const blob = new Blob(usadas.map((p) => p.blob), { type: tipo })
    const ext = tipo.includes("mp4") ? "m4a" : tipo.includes("ogg") ? "ogg" : "webm"
    const url = URL.createObjectURL(blob)
    setArquivo({ url, nome: `gravacao-teste${n !== null ? `-sem-parte-${n}` : ""}.${ext}`, bytes: blob.size, semParte: n })
    return () => URL.revokeObjectURL(url)
  }, [gravando, fim, partes, descartar, mime])

  const decorrido = inicio ? Math.round(((fim || agora) - inicio) / 1000) : 0
  const esperadas = Math.ceil(decorrido / SEGUNDOS_POR_PARTE)

  const relatorio = [
    `Navegador: ${navigator.userAgent}`,
    `Formatos aceitos: ${suportados.join(", ") || "nenhum"}`,
    `Formato usado: ${partes[0]?.blob.type || mime || "padrão"}`,
    `Tempo de relógio: ${decorrido} s · pedaços recebidos: ${partes.length} (esperados ~${esperadas})`,
    `Tamanho total: ${kb(partes.reduce((s, p) => s + p.blob.size, 0))}`,
    duracaoTocada !== null ? `Duração do arquivo ao tocar: ${duracaoTocada}` : null,
    arquivo?.semParte !== null && arquivo?.semParte !== undefined ? `Arquivo montado SEM o pedaço ${arquivo.semParte}` : null,
    "Eventos:",
    ...eventos.map((e) => `  ${hora(e.ts)}  ${e.texto}`),
  ]
    .filter(Boolean)
    .join("\n")

  return (
    <AppLayout>
      <Box sx={{ maxWidth: 900, mx: "auto" }}>
        <Typography variant="h4" component="h1" fontWeight={700}>
          Teste de gravação no navegador
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2.5 }}>
          Grava o seu microfone em pedaços de {SEGUNDOS_POR_PARTE} segundos, do mesmo jeito que a reunião vai gravar. Nada sai deste
          navegador: o arquivo fica com você.
        </Typography>

        {suportados.length === 0 && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Este navegador não grava áudio (MediaRecorder indisponível). Aqui, a fala não poderia ser gravada.
          </Alert>
        )}
        {erro && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {erro}
          </Alert>
        )}

        <Paper variant="outlined" sx={{ p: 2.5, mb: 2.5 }}>
          <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
            <TextField select size="small" label="Formato" value={mime} onChange={(e) => setMime(e.target.value)} disabled={gravando} sx={{ minWidth: 260 }}>
              {suportados.map((m) => (
                <MenuItem key={m} value={m}>
                  {m}
                </MenuItem>
              ))}
            </TextField>
            {!gravando ? (
              <Button variant="contained" color="error" startIcon={<FiberManualRecord />} onClick={comecar} disabled={suportados.length === 0}>
                Começar a gravar
              </Button>
            ) : (
              <>
                <Button variant="outlined" startIcon={mudo ? <Mic /> : <MicOff />} onClick={alternarMudo}>
                  {mudo ? "Religar o microfone" : "Silenciar"}
                </Button>
                <Button variant="contained" startIcon={<Stop />} onClick={parar}>
                  Parar
                </Button>
              </>
            )}
            {inicio && (
              <Chip
                color={gravando ? "error" : "default"}
                label={`${decorrido} s · ${partes.length} pedaço(s)`}
                sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}
              />
            )}
          </Box>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5 }}>
            Roteiro sugerido: fale contando de 1 a 60 em voz alta; silencie por uns 20 segundos no meio; troque de aba por um tempo; no
            celular, bloqueie a tela. Depois pare e ouça: a contagem deve estar inteira, com o silêncio no lugar certo.
          </Typography>
        </Paper>

        {fim && partes.length > 0 && (
          <Paper variant="outlined" sx={{ p: 2.5, mb: 2.5 }}>
            <Typography variant="subtitle1" fontWeight={700}>
              Resultado
            </Typography>
            <FormControlLabel
              sx={{ mt: 1 }}
              control={<Checkbox checked={descartar !== ""} onChange={(e) => setDescartar(e.target.checked ? String(Math.min(1, partes.length - 1)) : "")} />}
              label="Simular um pedaço que não chegou ao servidor"
            />
            {descartar !== "" && (
              <TextField select size="small" label="Pedaço descartado" value={descartar} onChange={(e) => setDescartar(e.target.value)} sx={{ ml: 1, minWidth: 160 }}>
                {partes.map((p) => (
                  <MenuItem key={p.n} value={String(p.n)}>
                    nº {p.n}
                  </MenuItem>
                ))}
              </TextField>
            )}
            {arquivo && (
              <Box sx={{ mt: 2 }}>
                <audio
                  controls
                  src={arquivo.url}
                  style={{ width: "100%" }}
                  onLoadedMetadata={(e) => {
                    const d = e.currentTarget.duration
                    setDuracaoTocada(Number.isFinite(d) ? `${d.toFixed(1)} s` : "desconhecida até tocar inteiro (WebM sem índice — normal)")
                  }}
                />
                <Box sx={{ display: "flex", gap: 1.5, mt: 1.5, flexWrap: "wrap", alignItems: "center" }}>
                  <Button variant="outlined" startIcon={<Download />} component="a" href={arquivo.url} download={arquivo.nome}>
                    Baixar {arquivo.nome} ({kb(arquivo.bytes)})
                  </Button>
                  {duracaoTocada && (
                    <Typography variant="body2" color="text.secondary">
                      Relógio: {decorrido} s · arquivo: {duracaoTocada}
                    </Typography>
                  )}
                </Box>
              </Box>
            )}
          </Paper>
        )}

        {partes.length > 0 && (
          <Paper variant="outlined" sx={{ mb: 2.5, overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Pedaço</TableCell>
                  <TableCell>Chegou às</TableCell>
                  <TableCell align="right">Tamanho</TableCell>
                  <TableCell>Tipo</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {partes.map((p) => (
                  <TableRow key={p.n}>
                    <TableCell>nº {p.n}</TableCell>
                    <TableCell>{hora(p.ts)}</TableCell>
                    <TableCell align="right">{kb(p.blob.size)}</TableCell>
                    <TableCell>{p.blob.type || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        )}

        {(eventos.length > 0 || partes.length > 0) && (
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
              <Typography variant="subtitle1" fontWeight={700}>
                Relatório
              </Typography>
              <Button size="small" startIcon={<ContentCopy />} onClick={() => navigator.clipboard?.writeText(relatorio)}>
                Copiar relatório
              </Button>
            </Box>
            <Box component="pre" sx={{ m: 0, fontSize: 12.5, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "text.secondary" }}>
              {relatorio}
            </Box>
          </Paper>
        )}
      </Box>
    </AppLayout>
  )
}
