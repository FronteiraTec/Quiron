/**
 * Linha do tempo da startup — a "biografia" da empresa: os marcos de tudo o que
 * ja foi validado/aprovado, do mais recente ao mais antigo.
 */
import { Box, Typography } from "@mui/material"
import { motion } from "framer-motion"

export default function StartupTimeline({ eventos }) {
  if (!eventos.length) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
        Sua história começa aqui. Conclua os primeiros passos e os marcos vão
        aparecer nesta linha do tempo.
      </Typography>
    )
  }

  return (
    <Box sx={{ position: "relative", pl: 1 }}>
      {eventos.map((ev, i) => (
        <Box
          key={i}
          component={motion.div}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          sx={{ display: "flex", gap: 1.5, pb: i < eventos.length - 1 ? 2 : 0, position: "relative" }}
        >
          {/* Linha vertical */}
          {i < eventos.length - 1 && (
            <Box
              sx={{
                position: "absolute",
                left: 5,
                top: 14,
                bottom: 0,
                width: 2,
                bgcolor: "divider",
              }}
            />
          )}
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              bgcolor: "success.main",
              mt: 0.4,
              flexShrink: 0,
              zIndex: 1,
            }}
          />
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{ev.titulo}</Typography>
            <Typography variant="caption" color="text.secondary">
              {ev.data} · {ev.area}
              {ev.por ? ` · ${ev.por}` : ""}
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  )
}
