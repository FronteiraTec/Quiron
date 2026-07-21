/**
 * Blueprint da empresa: as FASES da trilha que vao "ganhando forma".
 *
 * Cada fase comeca como contorno (a construir), passa a "em obra" e fica
 * "construida" conforme os passos dela sao aprovados. E o eixo da SUBSTANCIA:
 * bater o olho aqui responde "o quao pronta esta minha empresa?".
 *
 * As fases vem do Construtor da propria incubadora — nao ha lista fixa aqui.
 */
import { Box, Typography, LinearProgress } from "@mui/material"
import { CheckCircle, Lock } from "@mui/icons-material"
import { motion } from "framer-motion"
import { STATUS_BLUEPRINT } from "../../data/jornadaMeta"

export default function CompanyBlueprint({ fases }) {
  if (!fases.length) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
        A trilha da sua incubadora ainda nao tem fases publicadas.
      </Typography>
    )
  }

  return (
    <Box
      sx={{
        display: "grid",
        gap: 1.5,
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
      }}
    >
      {fases.map((fase, i) => {
        const meta = STATUS_BLUEPRINT[fase.status]
        const construida = fase.status === "CONSTRUIDA"
        const bloqueada = fase.status === "BLOQUEADA"
        // Sem cor de preenchimento enquanto a fase nao tem nada aprovado.
        const apagada = bloqueada || fase.status === "VAZIA"
        return (
          <Box
            key={fase.id}
            component={motion.div}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.3 }}
            sx={{
              p: 1.75,
              borderRadius: 2,
              minHeight: 116,
              display: "flex",
              flexDirection: "column",
              gap: 0.75,
              border: apagada ? "1.5px dashed" : "1.5px solid",
              borderColor: apagada ? "divider" : `${meta.cor}66`,
              bgcolor: apagada ? "transparent" : `${meta.cor}0f`,
              opacity: apagada ? 0.7 : 1,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Box
                sx={{
                  display: "grid",
                  placeItems: "center",
                  width: 32,
                  height: 32,
                  borderRadius: 1.5,
                  bgcolor: apagada ? "action.hover" : `${meta.cor}22`,
                  color: apagada ? "text.disabled" : meta.cor,
                  fontWeight: 800,
                  fontSize: 14,
                }}
              >
                {bloqueada ? <Lock sx={{ fontSize: 18 }} /> : fase.ordem}
              </Box>
              {construida && <CheckCircle sx={{ fontSize: 18, color: meta.cor }} />}
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: 13.5, mt: 0.25 }}>{fase.nome}</Typography>
            <Typography
              variant="caption"
              sx={{ color: apagada ? "text.disabled" : meta.cor, fontWeight: 600 }}
            >
              {meta.label}
              {fase.total > 0 && ` · ${fase.feitos}/${fase.total}`}
            </Typography>
            {!apagada && (
              <LinearProgress
                variant="determinate"
                value={fase.pct}
                sx={{
                  mt: "auto",
                  height: 4,
                  borderRadius: 2,
                  bgcolor: "action.hover",
                  "& .MuiLinearProgress-bar": { bgcolor: meta.cor },
                }}
              />
            )}
          </Box>
        )
      })}
    </Box>
  )
}
