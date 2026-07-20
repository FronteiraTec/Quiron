/**
 * Microcelebracao "a startup ganha forma".
 *
 * Aparece quando o incubado conclui uma acao concreta (ex.: envia uma entrega):
 * a AREA da empresa que aquele passo constroi "acende" com um brilho suave.
 * Curta, elegante, sem confete nem gamificacao — reforca a narrativa de que a
 * empresa avancou, nao de que "uma tarefa foi feita".
 *
 * Controlado: recebe `evento` = { area, mensagem } | null e auto-dismiss.
 */
import { useEffect } from "react"
import { Box, Typography } from "@mui/material"
import { AnimatePresence, motion } from "framer-motion"
import { AREAS_EMPRESA } from "../../data/jornadaMeta"

export default function GanhaForma({ evento, onClose }) {
  useEffect(() => {
    if (!evento) return
    const t = setTimeout(onClose, 2600)
    return () => clearTimeout(t)
  }, [evento, onClose])

  const area = evento ? AREAS_EMPRESA.find((a) => a.nome === evento.area) : null
  const Icone = area?.icon

  return (
    <AnimatePresence>
      {evento && (
        <Box
          component={motion.div}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          sx={{
            position: "fixed",
            inset: 0,
            zIndex: 1400,
            display: "grid",
            placeItems: "center",
            bgcolor: "rgba(15,23,42,0.55)",
            backdropFilter: "blur(3px)",
          }}
        >
          <Box
            component={motion.div}
            initial={{ scale: 0.85, y: 12, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
            sx={{
              px: 5,
              py: 4,
              borderRadius: 3,
              bgcolor: "background.paper",
              textAlign: "center",
              boxShadow: 24,
              maxWidth: 360,
            }}
          >
            {/* Aureola + icone da area acendendo */}
            <Box sx={{ position: "relative", display: "inline-grid", placeItems: "center", mb: 2 }}>
              <Box
                component={motion.div}
                initial={{ scale: 0.6, opacity: 0.7 }}
                animate={{ scale: 1.8, opacity: 0 }}
                transition={{ duration: 1.1, repeat: 1, ease: "easeOut" }}
                sx={{
                  position: "absolute",
                  width: 84,
                  height: 84,
                  borderRadius: "50%",
                  bgcolor: "success.main",
                }}
              />
              <Box
                component={motion.div}
                initial={{ scale: 0.5, rotate: -8 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.1 }}
                sx={{
                  position: "relative",
                  width: 72,
                  height: 72,
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  bgcolor: "success.main",
                  color: "success.contrastText",
                }}
              >
                {Icone && <Icone sx={{ fontSize: 34 }} />}
              </Box>
            </Box>

            <Typography variant="overline" sx={{ color: "success.main", fontWeight: 800, letterSpacing: 1 }}>
              Sua empresa avancou
            </Typography>
            <Typography sx={{ fontWeight: 800, fontSize: 20, mt: 0.5 }}>
              {evento.area} esta tomando forma
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {evento.mensagem || "Entrega enviada. O mentor foi notificado para avaliar."}
            </Typography>
          </Box>
        </Box>
      )}
    </AnimatePresence>
  )
}
