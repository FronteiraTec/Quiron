/**
 * Blueprint da empresa: as areas da startup que vao "ganhando forma".
 *
 * Cada area comeca como contorno (a construir), passa a "em obra" e fica
 * "construida" conforme os passos que a alimentam sao aprovados. E o eixo da
 * SUBSTANCIA: bater o olho aqui responde "o quao pronta esta minha empresa?".
 */
import { Box, Typography, LinearProgress } from "@mui/material"
import { CheckCircle } from "@mui/icons-material"
import { motion } from "framer-motion"
import { STATUS_AREA } from "../../data/jornadaMeta"

export default function CompanyBlueprint({ areas }) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 1.5,
        gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)", md: "repeat(4, 1fr)" },
      }}
    >
      {areas.map((area, i) => {
        const meta = STATUS_AREA[area.status]
        const Icone = area.icon
        const construida = area.status === "CONSTRUIDA"
        const vazia = area.status === "VAZIA"
        return (
          <Box
            key={area.nome}
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
              border: vazia ? "1.5px dashed" : "1.5px solid",
              borderColor: vazia ? "divider" : `${meta.cor}66`,
              bgcolor: vazia ? "transparent" : `${meta.cor}0f`,
              opacity: vazia ? 0.7 : 1,
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
                  bgcolor: vazia ? "action.hover" : `${meta.cor}22`,
                  color: vazia ? "text.disabled" : meta.cor,
                }}
              >
                <Icone sx={{ fontSize: 18 }} />
              </Box>
              {construida && <CheckCircle sx={{ fontSize: 18, color: meta.cor }} />}
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: 13.5, mt: 0.25 }}>{area.nome}</Typography>
            <Typography variant="caption" sx={{ color: vazia ? "text.disabled" : meta.cor, fontWeight: 600 }}>
              {meta.label}
            </Typography>
            {!vazia && (
              <LinearProgress
                variant="determinate"
                value={area.pct}
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
