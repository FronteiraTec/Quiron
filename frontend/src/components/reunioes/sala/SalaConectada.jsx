/**
 * A sala depois de conectada: a grade de quem esta nela, a barra de controles
 * e o painel lateral de participantes. Vive dentro do <LiveKitRoom>, de onde
 * os hooks tiram a sala.
 *
 * LAYOUT: com alguem compartilhando a tela, a tela vai para o centro e as
 * cameras viram uma faixa ao lado; sem tela, uma grade que se ajusta ao numero
 * de pessoas.
 *
 * O PAINEL lista quem esta na sala e, embaixo, os convidados que ainda nao
 * entraram — e a pergunta que o anfitriao faz nos primeiros minutos.
 *
 * GRAVACAO (Etapa 4): quem aceitou tem a propria fala gravada por este
 * navegador (useGravacao). O painel mostra o selo de cada um — o atributo
 * `gravacao` que o servidor poe na sala — e deixa a pessoa mudar o proprio
 * consentimento sem sair. Se os pedacos param de chegar ao servidor, a sala
 * avisa: "sua fala nao esta sendo gravada". A reuniao segue.
 */
import { useMemo, useState } from "react"
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  Menu,
  MenuItem,
  ListSubheader,
  Switch,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material"
import {
  CallEnd,
  Close,
  FiberManualRecord,
  Group,
  Mic,
  MicOff,
  PresentToAll,
  Settings,
  StopScreenShare,
  Videocam,
  VideocamOff,
  VolumeUp,
} from "@mui/icons-material"
import {
  RoomAudioRenderer,
  useConnectionState,
  useIsMuted,
  useIsSpeaking,
  useMediaDeviceSelect,
  useParticipantAttributes,
  useParticipantInfo,
  useParticipants,
  useRoomContext,
  useStartAudio,
  useTrackToggle,
  useTracks,
} from "@livekit/components-react"
import { ConnectionState, Track } from "livekit-client"
import TileParticipante from "./TileParticipante"
import { useGravacao } from "./useGravacao"
import { iniciais, motivoSemGravacao } from "../../../data/reuniaoMeta"

const CHAVE_TRACK = (t) => `${t.participant.identity}:${t.source}`

/** Colunas da grade para N quadros: 1, 2, 2, 2, 3, 3, ... ate 4. */
function colunasPara(n, estreito) {
  if (estreito) return n <= 1 ? 1 : 2
  if (n <= 1) return 1
  if (n <= 4) return 2
  if (n <= 9) return 3
  return 4
}

function Grade({ estreito }) {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  )
  const telas = tracks.filter((t) => t.source === Track.Source.ScreenShare)
  const cameras = tracks.filter((t) => t.source === Track.Source.Camera)

  if (telas.length > 0) {
    const [principal, ...outrasTelas] = telas
    const faixa = [...outrasTelas, ...cameras]
    return (
      <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: estreito ? "column" : "row", gap: 1, p: 1 }}>
        <Box sx={{ flex: 1, minHeight: 0, minWidth: 0 }}>
          <TileParticipante trackRef={principal} />
        </Box>
        <Box
          sx={{
            display: "flex",
            flexDirection: estreito ? "row" : "column",
            gap: 1,
            width: estreito ? "100%" : 220,
            height: estreito ? 110 : "auto",
            overflow: "auto",
            flexShrink: 0,
          }}
        >
          {faixa.map((t) => (
            <Box key={CHAVE_TRACK(t)} sx={{ flex: "0 0 auto", width: estreito ? 150 : "100%", height: estreito ? "100%" : 130 }}>
              <TileParticipante trackRef={t} compacto />
            </Box>
          ))}
        </Box>
      </Box>
    )
  }

  const colunas = colunasPara(cameras.length, estreito)
  const linhas = Math.ceil(cameras.length / colunas) || 1
  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        display: "grid",
        gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))`,
        // Linhas que dividem a altura disponivel; abaixo de 140 px por quadro
        // a grade passa a rolar em vez de espremer o video.
        gridTemplateRows: `repeat(${linhas}, minmax(${estreito ? 160 : 140}px, 1fr))`,
        gap: 1,
        p: 1,
        overflowY: "auto",
      }}
    >
      {cameras.map((t) => (
        <TileParticipante key={CHAVE_TRACK(t)} trackRef={t} />
      ))}
    </Box>
  )
}

/** O selo de gravacao de uma pessoa: o atributo que o servidor poe na sala. */
function SeloGravacao({ participante }) {
  const { attributes } = useParticipantAttributes({ participant: participante })
  const gravada = attributes?.gravacao === "sim"
  return (
    <Tooltip title={gravada ? "A fala desta pessoa é gravada" : "A fala desta pessoa não é gravada"}>
      <Box
        component="span"
        sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, fontSize: 11, color: gravada ? "#fca5a5" : "rgba(255,255,255,0.45)", whiteSpace: "nowrap" }}
      >
        {gravada ? <FiberManualRecord sx={{ fontSize: 10 }} aria-hidden /> : null}
        {gravada ? "gravando" : "não gravada"}
      </Box>
    </Tooltip>
  )
}

function LinhaPessoa({ participante, grava }) {
  const { name, identity } = useParticipantInfo({ participant: participante })
  const falando = useIsSpeaking(participante)
  const micMudo = useIsMuted({ participant: participante, source: Track.Source.Microphone })
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, py: 0.75 }}>
      <Avatar sx={{ width: 30, height: 30, fontSize: 12, bgcolor: "#3a4049", outline: (t) => (falando ? `2px solid ${t.palette.primary.vivo}` : "none") }}>
        {iniciais(name || identity)}
      </Avatar>
      <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
        {name || identity}
        {participante.isLocal ? " (você)" : ""}
      </Typography>
      {grava && <SeloGravacao participante={participante} />}
      {micMudo ? <MicOff sx={{ fontSize: 18, color: "#f87171" }} aria-label="microfone desligado" /> : <Mic sx={{ fontSize: 18, color: "rgba(255,255,255,0.6)" }} aria-label="microfone ligado" />}
    </Box>
  )
}

/** A propria escolha, dentro da sala: gravar a minha fala ou nao. */
function MeuConsentimento({ aceito, onMudar }) {
  const [mudando, setMudando] = useState(false)
  const [erro, setErro] = useState(null)
  const mudar = async (valor) => {
    setMudando(true)
    setErro(null)
    try {
      await onMudar(valor)
    } catch (err) {
      setErro(err?.response?.data?.erro || "Não foi possível mudar agora.")
    } finally {
      setMudando(false)
    }
  }
  return (
    <Box sx={{ mb: 1.5 }}>
      <FormControlLabel
        control={<Switch size="small" checked={aceito} disabled={mudando} onChange={(e) => mudar(e.target.checked)} />}
        label={<Typography variant="body2">Gravar a minha fala</Typography>}
      />
      <Typography variant="caption" component="p" sx={{ color: "rgba(255,255,255,0.6)" }}>
        {aceito
          ? "A sua fala é gravada e transcrita à noite. Desligue para parar na hora."
          : "A sua fala não é gravada. Ligue se quiser que ela entre na transcrição."}
      </Typography>
      {erro && (
        <Typography variant="caption" component="p" sx={{ color: "#fca5a5", mt: 0.5 }}>
          {erro}
        </Typography>
      )}
    </Box>
  )
}

function Painel({ convidados, onFechar, grava, aceito, gravacao, onMudarConsentimento }) {
  const participantes = useParticipants()
  const presentes = new Set(participantes.map((p) => p.identity))
  const ausentes = convidados.filter((c) => !presentes.has(`u-${c.id_usuario}`))
  return (
    <Box
      component="aside"
      aria-label="Participantes"
      sx={{ width: { xs: "100%", sm: 300 }, flexShrink: 0, bgcolor: "background.paper", borderLeft: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", minHeight: 0 }}
    >
      <Box sx={{ display: "flex", alignItems: "center", px: 2, py: 1.25 }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1 }}>
          Na sala ({participantes.length})
        </Typography>
        <IconButton size="small" onClick={onFechar} aria-label="Fechar painel" sx={{ color: "inherit" }}>
          <Close fontSize="small" />
        </IconButton>
      </Box>
      <Box sx={{ px: 2, overflowY: "auto", flex: 1 }}>
        {participantes.map((p) => (
          <LinhaPessoa key={p.identity} participante={p} grava={grava} />
        ))}
        {ausentes.length > 0 && (
          <>
            <Divider sx={{ my: 1.5, borderColor: "rgba(255,255,255,0.08)" }} />
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>
              Convidados que ainda não entraram
            </Typography>
            {ausentes.map((c) => (
              <Box key={c.id_usuario} sx={{ display: "flex", alignItems: "center", gap: 1.25, py: 0.75, opacity: 0.65 }}>
                <Avatar src={c.foto_url || undefined} sx={{ width: 30, height: 30, fontSize: 12, bgcolor: "#3a4049" }}>
                  {iniciais(c.nome)}
                </Avatar>
                <Typography variant="body2" noWrap>
                  {c.nome}
                </Typography>
              </Box>
            ))}
          </>
        )}
        <Divider sx={{ my: 1.5, borderColor: "rgba(255,255,255,0.08)" }} />
        {grava ? (
          <MeuConsentimento aceito={aceito} onMudar={onMudarConsentimento} />
        ) : (
          <Typography variant="caption" component="p" sx={{ color: "rgba(255,255,255,0.6)", mb: 2 }}>
            {motivoSemGravacao(gravacao)} Só os convidados entram na sala.
          </Typography>
        )}
      </Box>
    </Box>
  )
}

/**
 * Opcoes do seletor de tela do navegador:
 * - a aba do proprio Quiron nao e oferecida (compartilhar a sala dentro da
 *   sala vira um tunel de espelhos);
 * - da para trocar a aba compartilhada sem parar (Chrome/Edge);
 * - o audio vai junto quando o navegador permite (aba no Chrome/Edge; tela
 *   inteira no Windows). Sem tratamento de voz: e video ou musica, nao fala.
 */
const OPCOES_TELA = {
  audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  selfBrowserSurface: "exclude",
  surfaceSwitching: "include",
  systemAudio: "include",
}

/**
 * Cancelar o seletor de tela tambem chega como NotAllowedError — nao e erro,
 * a pessoa desistiu. "by system" e o macOS sem a permissao de gravacao de tela.
 */
function mensagemErroTela(err) {
  if (err?.name !== "NotAllowedError") return `Não foi possível compartilhar a tela: ${err?.message || "erro desconhecido"}.`
  if (/system/i.test(err.message || "")) {
    return "O sistema bloqueou o compartilhamento. No Mac, abra Ajustes do Sistema → Privacidade e Segurança → Gravação de Tela, libere o navegador e reabra-o."
  }
  return null
}

/** Botao redondo da barra. Vermelho quando o recurso esta desligado; na cor da marca quando em destaque. */
function BotaoBarra({ rotulo, ativo = true, perigo = false, destaque = false, onClick, disabled, children }) {
  const fundo = perigo ? "#dc2626" : destaque ? "primary.main" : ativo ? "rgba(255,255,255,0.12)" : "#b91c1c"
  const fundoHover = perigo ? "#b91c1c" : destaque ? "primary.dark" : ativo ? "rgba(255,255,255,0.2)" : "#991b1b"
  return (
    <Tooltip title={rotulo}>
      <span>
        <IconButton
          onClick={onClick}
          disabled={disabled}
          aria-label={rotulo}
          aria-pressed={typeof ativo === "boolean" ? ativo : undefined}
          sx={{
            width: 48,
            height: 48,
            color: destaque ? "primary.contrastText" : "#fff",
            bgcolor: fundo,
            "&:hover": { bgcolor: fundoHover },
            "&.Mui-disabled": { color: "rgba(255,255,255,0.3)", bgcolor: "rgba(255,255,255,0.05)" },
          }}
        >
          {children}
        </IconButton>
      </span>
    </Tooltip>
  )
}

function MenuDispositivos() {
  const [ancora, setAncora] = useState(null)
  const microfones = useMediaDeviceSelect({ kind: "audioinput" })
  const cameras = useMediaDeviceSelect({ kind: "videoinput" })
  const saidas = useMediaDeviceSelect({ kind: "audiooutput" })
  const grupo = (titulo, sel) =>
    sel.devices.length > 0 && [
      <ListSubheader key={`${titulo}-t`}>{titulo}</ListSubheader>,
      ...sel.devices.map((d) => (
        <MenuItem
          key={`${titulo}-${d.deviceId}`}
          selected={d.deviceId === sel.activeDeviceId}
          onClick={() => {
            sel.setActiveMediaDevice(d.deviceId)
            setAncora(null)
          }}
        >
          {d.label || "Dispositivo sem nome"}
        </MenuItem>
      )),
    ]
  return (
    <>
      <BotaoBarra rotulo="Microfone, câmera e som" onClick={(e) => setAncora(e.currentTarget)}>
        <Settings />
      </BotaoBarra>
      <Menu anchorEl={ancora} open={Boolean(ancora)} onClose={() => setAncora(null)} anchorOrigin={{ vertical: "top", horizontal: "center" }} transformOrigin={{ vertical: "bottom", horizontal: "center" }}>
        {grupo("Microfone", microfones)}
        {grupo("Câmera", cameras)}
        {grupo("Saída de som", saidas)}
      </Menu>
    </>
  )
}

/** O que dizer quando a fala de quem aceitou nao esta sendo gravada. */
function avisoDeFalha(estado) {
  switch (estado.fase) {
    case "atrasada":
      return "Ela não chega ao servidor há mais de um minuto. A reunião continua; a gravação volta sozinha quando a conexão melhorar."
    case "recusada":
    case "sem_suporte":
    case "erro":
      return estado.mensagem || ""
    case "parada":
      return estado.mensagem
    default:
      return null
  }
}

export default function SalaConectada({ reuniao, ehAnfitriao, onEncerrar, onMudarConsentimento }) {
  const room = useRoomContext()
  const estado = useConnectionState()
  const estreito = useMediaQuery("(max-width: 700px)")
  const [painelAberto, setPainelAberto] = useState(!estreito)
  const [confirmarEncerrar, setConfirmarEncerrar] = useState(false)
  const [encerrando, setEncerrando] = useState(false)
  const [erroMidia, setErroMidia] = useState(null)

  const avisarErro = (rotulo) => (err) => setErroMidia(`Não foi possível ligar ${rotulo}: ${err?.message || "permissão negada"}.`)
  const mic = useTrackToggle({ source: Track.Source.Microphone, onDeviceError: avisarErro("o microfone") })
  const cam = useTrackToggle({ source: Track.Source.Camera, onDeviceError: avisarErro("a câmera") })
  const tela = useTrackToggle({
    source: Track.Source.ScreenShare,
    captureOptions: OPCOES_TELA,
    onDeviceError: (err) => {
      const msg = mensagemErroTela(err)
      if (msg) setErroMidia(msg)
    },
  })
  const { mergedProps: propsSom, canPlayAudio } = useStartAudio({ room, props: {} })
  const podeCompartilhar = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getDisplayMedia)

  const convidados = useMemo(() => reuniao.participantes || [], [reuniao.participantes])
  const grava = Boolean(reuniao.gravacao?.disponivel)
  const aceito = Boolean(reuniao.meu_consentimento?.aceito)
  const estadoGravacao = useGravacao({ idReuniao: reuniao.id_reuniao, ativo: grava && aceito })
  const falhaGravacao = grava && aceito ? avisoDeFalha(estadoGravacao) : null

  const encerrar = async () => {
    setEncerrando(true)
    try {
      await onEncerrar()
    } finally {
      setEncerrando(false)
      setConfirmarEncerrar(false)
    }
  }

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", bgcolor: "background.default", color: "text.primary" }}>
      <RoomAudioRenderer />

      <Box component="header" sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 2, py: 1, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <Typography variant="subtitle1" fontWeight={700} noWrap sx={{ flex: 1, minWidth: 0 }}>
          {reuniao.titulo}
        </Typography>
        {grava && aceito && estadoGravacao.fase === "gravando" && (
          <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color: "#fca5a5", fontSize: 13 }} role="status">
            <FiberManualRecord sx={{ fontSize: 12 }} aria-hidden /> Gravando a sua fala
          </Box>
        )}
        {estado === ConnectionState.Reconnecting || estado === ConnectionState.SignalReconnecting ? (
          <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1, color: "#fbbf24", fontSize: 14 }} role="status">
            <CircularProgress size={14} sx={{ color: "inherit" }} /> Reconectando…
          </Box>
        ) : null}
      </Box>

      {!canPlayAudio && (
        <Alert
          severity="warning"
          icon={<VolumeUp />}
          sx={{ borderRadius: 0 }}
          action={
            <Button color="inherit" size="small" onClick={propsSom.onClick}>
              Ativar o som
            </Button>
          }
        >
          O navegador bloqueou o som da reunião até você clicar.
        </Alert>
      )}
      {erroMidia && (
        <Alert severity="error" sx={{ borderRadius: 0 }} onClose={() => setErroMidia(null)}>
          {erroMidia}
        </Alert>
      )}
      {falhaGravacao !== null && (
        <Alert severity="warning" sx={{ borderRadius: 0 }}>
          <strong>Sua fala não está sendo gravada.</strong> {falhaGravacao}
        </Alert>
      )}
      {tela.enabled && (
        <Alert
          severity="info"
          icon={<PresentToAll />}
          sx={{ borderRadius: 0 }}
          action={
            <Button color="inherit" size="small" startIcon={<StopScreenShare />} onClick={() => tela.toggle(false)} disabled={tela.pending}>
              Parar de apresentar
            </Button>
          }
        >
          Você está apresentando a sua tela para todos na sala.
        </Alert>
      )}

      <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: estreito && painelAberto ? "column" : "row" }}>
        {!(estreito && painelAberto) && (
          <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex" }}>
            <Grade estreito={estreito} />
          </Box>
        )}
        {painelAberto && (
          <Painel
            convidados={convidados}
            onFechar={() => setPainelAberto(false)}
            grava={grava}
            aceito={aceito}
            gravacao={reuniao.gravacao}
            onMudarConsentimento={onMudarConsentimento}
          />
        )}
      </Box>

      <Box
        component="footer"
        sx={{ display: "flex", justifyContent: "center", alignItems: "center", gap: { xs: 1, sm: 1.5 }, flexWrap: "wrap", px: 2, py: 1.5, borderTop: "1px solid rgba(255,255,255,0.08)" }}
      >
        <BotaoBarra rotulo={mic.enabled ? "Desligar o microfone" : "Ligar o microfone"} ativo={mic.enabled} disabled={mic.pending} onClick={() => mic.toggle()}>
          {mic.enabled ? <Mic /> : <MicOff />}
        </BotaoBarra>
        <BotaoBarra rotulo={cam.enabled ? "Desligar a câmera" : "Ligar a câmera"} ativo={cam.enabled} disabled={cam.pending} onClick={() => cam.toggle()}>
          {cam.enabled ? <Videocam /> : <VideocamOff />}
        </BotaoBarra>
        {/* No celular o navegador nao oferece captura de tela: o botao fica
            visivel, desligado, dizendo por que — some-lo faria parecer que a
            funcao nao existe. */}
        <BotaoBarra
          rotulo={
            !podeCompartilhar
              ? "Este navegador não permite compartilhar a tela (no celular, não há essa opção)"
              : tela.enabled
                ? "Parar de apresentar"
                : "Apresentar a tela"
          }
          ativo
          destaque={tela.enabled}
          disabled={!podeCompartilhar || tela.pending}
          onClick={() => tela.toggle()}
        >
          {tela.enabled ? <StopScreenShare /> : <PresentToAll />}
        </BotaoBarra>
        <MenuDispositivos />
        <BotaoBarra rotulo={painelAberto ? "Fechar a lista de participantes" : "Participantes"} ativo onClick={() => setPainelAberto((a) => !a)}>
          <Group />
        </BotaoBarra>
        <Box sx={{ width: { xs: 0, sm: 16 } }} />
        <Button
          variant="contained"
          color="error"
          startIcon={<CallEnd />}
          onClick={() => room.disconnect()}
          sx={{ borderRadius: 6, px: 2.5, height: 48 }}
        >
          Sair
        </Button>
        {ehAnfitriao && (
          <Button variant="outlined" color="error" onClick={() => setConfirmarEncerrar(true)} sx={{ borderRadius: 6, height: 48, color: "#fca5a5", borderColor: "#7f1d1d" }}>
            Encerrar para todos
          </Button>
        )}
      </Box>

      <Dialog open={confirmarEncerrar} onClose={encerrando ? undefined : () => setConfirmarEncerrar(false)}>
        <DialogTitle>Encerrar a reunião para todos?</DialogTitle>
        <DialogContent>
          <DialogContentText>Todos serão desconectados e a sala fecha. Ninguém mais entra nesta reunião.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmarEncerrar(false)} disabled={encerrando}>
            Voltar
          </Button>
          <Button color="error" variant="contained" onClick={encerrar} disabled={encerrando} startIcon={encerrando ? <CircularProgress size={16} /> : null}>
            Encerrar para todos
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
