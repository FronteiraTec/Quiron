/**
 * UpcomingEvents - lista resumida dos proximos compromissos, agrupada por dia
 * (Hoje / Amanha / dd-MM), exibida na sidebar do calendario.
 */
import { Box, Typography } from "@mui/material"
import { format, isToday, isTomorrow } from "date-fns"
import { EventBusy } from "@mui/icons-material"
import { categoriaInfo } from "./categorias"

function rotuloDia(data) {
  if (isToday(data)) return "Hoje"
  if (isTomorrow(data)) return "Amanha"
  return format(data, "dd/MM")
}

export default function UpcomingEvents({ eventos = [], onSelecionar, limite = 6 }) {
  const agora = new Date()
  const proximos = eventos
    .filter((ev) => new Date(ev.inicio_ts) >= new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()))
    .sort((a, b) => new Date(a.inicio_ts) - new Date(b.inicio_ts))
    .slice(0, limite)

  // Agrupa mantendo a ordem cronologica.
  const grupos = []
  for (const ev of proximos) {
    const rotulo = rotuloDia(new Date(ev.inicio_ts))
    let grupo = grupos.find((g) => g.rotulo === rotulo)
    if (!grupo) {
      grupo = { rotulo, itens: [] }
      grupos.push(grupo)
    }
    grupo.itens.push(ev)
  }

  return (
    <Box sx={{ px: 2, py: 1 }}>
      <Typography
        variant="overline"
        sx={{ color: "text.secondary", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em" }}
      >
        Proximos eventos
      </Typography>

      {grupos.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 3, color: "text.disabled" }}>
          <EventBusy sx={{ fontSize: 28, opacity: 0.5 }} />
          <Typography variant="caption" sx={{ display: "block", mt: 0.5 }}>
            Nada por aqui ainda.
          </Typography>
        </Box>
      ) : (
        grupos.map((grupo) => (
          <Box key={grupo.rotulo} sx={{ mt: 1 }}>
            <Typography variant="caption" fontWeight={700} sx={{ display: "block", mb: 0.5 }}>
              {grupo.rotulo}
            </Typography>
            {grupo.itens.map((ev) => {
              const { cor } = categoriaInfo(ev.categoria)
              return (
                <Box
                  key={ev.id_evento}
                  onClick={() => onSelecionar?.(ev)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    py: 0.5,
                    px: 0.5,
                    borderRadius: "8px",
                    cursor: "pointer",
                    "&:hover": { bgcolor: "action.hover" },
                  }}
                >
                  <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: cor, flexShrink: 0 }} />
                  <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                    {ev.titulo}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {format(new Date(ev.inicio_ts), "HH:mm")}
                  </Typography>
                </Box>
              )
            })}
          </Box>
        ))
      )}
    </Box>
  )
}
