/**
 * Um quadro da sala: o video (camera ou tela) de uma pessoa, ou o avatar
 * quando a camera esta desligada.
 *
 * Desenhado com MUI, sobre os hooks do @livekit/components-react — e nao com o
 * ParticipantTile pronto, que depende do CSS do LiveKit (docs/reunioes.md,
 * secao 6). A borda acende quando a pessoa fala.
 */
import { Avatar, Box, Tooltip, Typography } from "@mui/material"
import { MicOff, PresentToAll, SignalCellularAlt, SignalCellularAlt1Bar, SignalCellularAlt2Bar } from "@mui/icons-material"
import {
  VideoTrack,
  isTrackReference,
  useConnectionQualityIndicator,
  useIsMuted,
  useIsSpeaking,
  useParticipantInfo,
} from "@livekit/components-react"
import { ConnectionQuality, Track } from "livekit-client"
import { iniciais } from "../../../data/reuniaoMeta"

/** A foto vem nos metadados do token (ver reuniaoService.emitirToken). */
function fotoDosMetadados(metadata) {
  try {
    return JSON.parse(metadata || "{}").foto_url || undefined
  } catch {
    return undefined
  }
}

const QUALIDADE = {
  [ConnectionQuality.Excellent]: { Icone: SignalCellularAlt, cor: "#4ade80", rotulo: "Conexão excelente" },
  [ConnectionQuality.Good]: { Icone: SignalCellularAlt2Bar, cor: "#a3e635", rotulo: "Conexão boa" },
  [ConnectionQuality.Poor]: { Icone: SignalCellularAlt1Bar, cor: "#fb923c", rotulo: "Conexão fraca" },
  [ConnectionQuality.Lost]: { Icone: SignalCellularAlt1Bar, cor: "#f87171", rotulo: "Conexão perdida" },
}

export default function TileParticipante({ trackRef, compacto = false }) {
  const participante = trackRef.participant
  const ehTela = trackRef.source === Track.Source.ScreenShare
  const falando = useIsSpeaking(participante)
  const micMudo = useIsMuted({ participant: participante, source: Track.Source.Microphone })
  const videoMudo = useIsMuted(trackRef)
  const { quality } = useConnectionQualityIndicator({ participant: participante })
  const { name, identity, metadata } = useParticipantInfo({ participant: participante })

  const nome = name || identity || "Participante"
  const mostrarVideo = isTrackReference(trackRef) && !videoMudo
  const qualidade = QUALIDADE[quality]

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: compacto ? 96 : 140,
        borderRadius: 2,
        overflow: "hidden",
        bgcolor: "#1f2329",
        outline: (t) => (falando && !ehTela ? `3px solid ${t.palette.primary.vivo}` : "1px solid rgba(255,255,255,0.08)"),
        outlineOffset: -3,
        transition: "outline-color 120ms",
      }}
    >
      {mostrarVideo ? (
        <VideoTrack
          trackRef={trackRef}
          style={{
            width: "100%",
            height: "100%",
            objectFit: ehTela ? "contain" : "cover",
            // A propria camera aparece espelhada, como num espelho de verdade.
            transform: participante.isLocal && !ehTela ? "scaleX(-1)" : undefined,
            background: "#111",
          }}
        />
      ) : (
        <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Avatar
            src={fotoDosMetadados(metadata)}
            sx={{
              width: compacto ? 48 : 88,
              height: compacto ? 48 : 88,
              fontSize: compacto ? 18 : 32,
              bgcolor: "#3a4049",
              color: "#e5e7eb",
            }}
          >
            {iniciais(nome)}
          </Avatar>
        </Box>
      )}

      <Box
        sx={{
          position: "absolute",
          left: 8,
          bottom: 8,
          right: 8,
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          pointerEvents: "none",
        }}
      >
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.5,
            maxWidth: "100%",
            px: 1,
            py: 0.25,
            borderRadius: 1,
            bgcolor: "rgba(0,0,0,0.6)",
            color: "#fff",
          }}
        >
          {ehTela && <PresentToAll sx={{ fontSize: 15 }} aria-hidden />}
          {!ehTela && micMudo && <MicOff sx={{ fontSize: 15, color: "#f87171" }} aria-label="microfone desligado" />}
          <Typography variant="caption" fontWeight={600} noWrap>
            {ehTela ? `Tela de ${nome}` : participante.isLocal ? `${nome} (você)` : nome}
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        {!ehTela && qualidade && (
          <Tooltip title={qualidade.rotulo}>
            <Box sx={{ display: "inline-flex", pointerEvents: "auto", bgcolor: "rgba(0,0,0,0.6)", borderRadius: 1, p: 0.25 }}>
              <qualidade.Icone sx={{ fontSize: 16, color: qualidade.cor }} aria-label={qualidade.rotulo} />
            </Box>
          </Tooltip>
        )}
      </Box>
    </Box>
  )
}
