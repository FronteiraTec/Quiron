/**
 * Antes de entrar: a pessoa ve a propria camera, escolhe microfone e camera,
 * e decide se entra com cada um ligado ou desligado.
 *
 * Nada aqui fala com a sala — a previa usa so o navegador
 * (usePreviewTracks). As trilhas da previa sao paradas quando esta tela sai,
 * e a sala cria as suas ao conectar, com os dispositivos escolhidos.
 *
 * Antes de a sala abrir, a tela ja aparece (da tempo de testar a camera), com
 * a contagem no lugar do botao.
 *
 * GRAVACAO (Etapa 4): quando a reuniao grava, o aviso vem ANTES de ligar o
 * microfone — o que e gravado, quem transcreve, quem le, por quanto tempo
 * fica — e a pessoa escolhe: gravar a propria fala ou nao. Sem escolher, nao
 * entra (a escolha anterior vem marcada). Quem nao aceita entra igual.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  IconButton,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material"
import { FiberManualRecord, Login, Mic, MicOff, Videocam, VideocamOff, MicNone } from "@mui/icons-material"
import { useMediaDevices, usePreviewTracks } from "@livekit/components-react"
import { Track } from "livekit-client"
import { avisoDeGravacao, contagem, iniciais, motivoSemGravacao, quando } from "../../../data/reuniaoMeta"

/** O aviso de gravacao e a escolha da pessoa. */
function EscolhaGravacao({ gravacao, escolha, onEscolha }) {
  return (
    <Box sx={{ mt: 2.5, p: 2, borderRadius: 2, border: "1px solid rgba(255,255,255,0.12)", textAlign: "left" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <FiberManualRecord sx={{ fontSize: 14, color: "#f87171" }} aria-hidden />
        <Typography variant="subtitle2" fontWeight={700}>
          Esta reunião pode gravar a sua fala
        </Typography>
      </Box>
      <Box component="ul" sx={{ m: 0, pl: 2.5, color: "rgba(255,255,255,0.75)" }}>
        {avisoDeGravacao(gravacao).map((frase) => (
          <Typography key={frase} component="li" variant="caption" sx={{ display: "list-item", lineHeight: 1.5 }}>
            {frase}
          </Typography>
        ))}
      </Box>
      <ToggleButtonGroup
        exclusive
        fullWidth
        size="small"
        value={escolha}
        onChange={(_, v) => v !== null && onEscolha(v)}
        aria-label="Gravação da sua fala"
        sx={{ mt: 1.5 }}
      >
        <ToggleButton value={true} sx={{ textTransform: "none" }}>
          Gravar minha fala
        </ToggleButton>
        <ToggleButton value={false} sx={{ textTransform: "none" }}>
          Não gravar
        </ToggleButton>
      </ToggleButtonGroup>
    </Box>
  )
}

export default function PreEntrada({ reuniao, nome, faltam, entrando, erro, escolhas, onEscolhas, onEntrar }) {
  const [erroDispositivo, setErroDispositivo] = useState(null)
  const grava = Boolean(reuniao.gravacao?.disponivel)
  // A escolha anterior vem marcada; quem nunca respondeu escolhe agora.
  const [escolhaGravacao, setEscolhaGravacao] = useState(() =>
    reuniao.meu_consentimento?.decidido ? Boolean(reuniao.meu_consentimento.aceito) : null
  )
  const faltaEscolher = grava && escolhaGravacao === null
  const video = useRef(null)
  const aoErrar = useCallback((err) => {
    setErroDispositivo(
      err?.name === "NotAllowedError"
        ? "O navegador não deu acesso à câmera ou ao microfone. Libere nas permissões do site e recarregue a página."
        : `Não foi possível abrir a câmera ou o microfone (${err?.message || "erro desconhecido"}).`
    )
  }, [])

  const opcoes = useMemo(
    () => ({
      audio: escolhas.microfone ? { deviceId: escolhas.idMicrofone || undefined } : false,
      video: escolhas.camera ? { deviceId: escolhas.idCamera || undefined } : false,
    }),
    [escolhas.microfone, escolhas.camera, escolhas.idMicrofone, escolhas.idCamera]
  )
  const tracks = usePreviewTracks(opcoes, aoErrar)
  const trilhaVideo = tracks?.find((t) => t.kind === Track.Kind.Video)

  useEffect(() => {
    if (!trilhaVideo || !video.current) return undefined
    trilhaVideo.attach(video.current)
    return () => {
      trilhaVideo.detach()
    }
  }, [trilhaVideo])

  // Os nomes dos dispositivos so aparecem depois da permissao: a lista e lida
  // de novo quando as trilhas da previa nascem.
  const microfones = useMediaDevices({ kind: "audioinput" })
  const cameras = useMediaDevices({ kind: "videoinput" })

  const abriu = faltam !== null && faltam <= 0
  const mudar = (campo, valor) => onEscolhas({ ...escolhas, [campo]: valor })

  return (
    <Box sx={{ minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center", p: 2, bgcolor: "background.default", color: "text.primary" }}>
      <Box sx={{ width: "100%", maxWidth: 960, display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.4fr 1fr" }, gap: 3, alignItems: "center" }}>
        <Box>
          <Box sx={{ position: "relative", aspectRatio: "16 / 9", borderRadius: 3, overflow: "hidden", bgcolor: "#1f2329" }}>
            {escolhas.camera && trilhaVideo ? (
              <video ref={video} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
            ) : (
              <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Avatar sx={{ width: 96, height: 96, fontSize: 34, bgcolor: "#3a4049", color: "#e5e7eb" }}>{iniciais(nome)}</Avatar>
              </Box>
            )}
            <Box sx={{ position: "absolute", bottom: 12, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 1.5 }}>
              <Tooltip title={escolhas.microfone ? "Entrar com o microfone desligado" : "Entrar com o microfone ligado"}>
                <IconButton
                  onClick={() => mudar("microfone", !escolhas.microfone)}
                  aria-label={escolhas.microfone ? "Desligar o microfone" : "Ligar o microfone"}
                  aria-pressed={escolhas.microfone}
                  sx={{ width: 52, height: 52, color: "#fff", bgcolor: escolhas.microfone ? "rgba(0,0,0,0.55)" : "#b91c1c", "&:hover": { bgcolor: escolhas.microfone ? "rgba(0,0,0,0.75)" : "#991b1b" } }}
                >
                  {escolhas.microfone ? <Mic /> : <MicOff />}
                </IconButton>
              </Tooltip>
              <Tooltip title={escolhas.camera ? "Entrar com a câmera desligada" : "Entrar com a câmera ligada"}>
                <IconButton
                  onClick={() => mudar("camera", !escolhas.camera)}
                  aria-label={escolhas.camera ? "Desligar a câmera" : "Ligar a câmera"}
                  aria-pressed={escolhas.camera}
                  sx={{ width: 52, height: 52, color: "#fff", bgcolor: escolhas.camera ? "rgba(0,0,0,0.55)" : "#b91c1c", "&:hover": { bgcolor: escolhas.camera ? "rgba(0,0,0,0.75)" : "#991b1b" } }}
                >
                  {escolhas.camera ? <Videocam /> : <VideocamOff />}
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5, mt: 2 }}>
            <TextField
              select
              size="small"
              label="Microfone"
              value={escolhas.idMicrofone || ""}
              onChange={(e) => mudar("idMicrofone", e.target.value)}
              disabled={!escolhas.microfone || microfones.length === 0}

            >
              <MenuItem value="">Padrão do sistema</MenuItem>
              {microfones.filter((d) => d.deviceId && d.deviceId !== "default").map((d) => (
                <MenuItem key={d.deviceId} value={d.deviceId}>
                  {d.label || "Microfone"}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Câmera"
              value={escolhas.idCamera || ""}
              onChange={(e) => mudar("idCamera", e.target.value)}
              disabled={!escolhas.camera || cameras.length === 0}

            >
              <MenuItem value="">Padrão do sistema</MenuItem>
              {cameras.filter((d) => d.deviceId && d.deviceId !== "default").map((d) => (
                <MenuItem key={d.deviceId} value={d.deviceId}>
                  {d.label || "Câmera"}
                </MenuItem>
              ))}
            </TextField>
          </Box>
        </Box>

        <Box sx={{ textAlign: { xs: "center", md: "left" } }}>
          <Typography variant="overline" sx={{ color: "rgba(255,255,255,0.6)" }}>
            {reuniao.categoria_rotulo || "Reunião"}
          </Typography>
          <Typography variant="h5" fontWeight={700} sx={{ wordBreak: "break-word" }}>
            {reuniao.titulo}
          </Typography>
          <Typography sx={{ color: "rgba(255,255,255,0.7)", mt: 0.5, textTransform: "capitalize" }}>{quando(reuniao)}</Typography>
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)", mt: 1 }}>
            {reuniao.na_sala > 0
              ? `${reuniao.na_sala} ${reuniao.na_sala === 1 ? "pessoa já está" : "pessoas já estão"} na sala.`
              : "Ninguém entrou ainda."}
          </Typography>

          {(erroDispositivo || erro) && (
            <Alert severity={erro ? "error" : "warning"} sx={{ mt: 2, textAlign: "left" }}>
              {erro || erroDispositivo}
            </Alert>
          )}

          <Box sx={{ mt: 3 }}>
            {abriu ? (
              <Box>
                <Button
                  size="large"
                  variant="contained"
                  startIcon={entrando ? <CircularProgress size={18} color="inherit" /> : <Login />}
                  disabled={entrando || faltaEscolher}
                  onClick={() => onEntrar(grava ? escolhaGravacao : undefined)}
                  sx={{ px: 4 }}
                >
                  {entrando ? "Entrando…" : "Entrar agora"}
                </Button>
                {faltaEscolher && (
                  <Typography variant="caption" component="p" sx={{ color: "rgba(255,255,255,0.6)", mt: 1 }}>
                    Escolha abaixo se a sua fala será gravada.
                  </Typography>
                )}
              </Box>
            ) : (
              <Box>
                <Button size="large" variant="contained" disabled sx={{ px: 4 }}>
                  A sala abre {contagem(faltam)}
                </Button>
                <Typography variant="caption" component="p" sx={{ color: "rgba(255,255,255,0.6)", mt: 1 }}>
                  Fique nesta tela: o botão libera sozinho {reuniao.minutos_antes} minutos antes do início.
                </Typography>
              </Box>
            )}
          </Box>

          {grava ? (
            <EscolhaGravacao gravacao={reuniao.gravacao} escolha={escolhaGravacao} onEscolha={setEscolhaGravacao} />
          ) : (
            <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", mt: 3, color: "rgba(255,255,255,0.6)", justifyContent: { xs: "center", md: "flex-start" } }}>
              <MicNone sx={{ fontSize: 18, mt: 0.1 }} aria-hidden />
              <Typography variant="caption" sx={{ textAlign: "left" }}>
                {motivoSemGravacao(reuniao.gravacao)} Só os convidados entram na sala.
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  )
}
