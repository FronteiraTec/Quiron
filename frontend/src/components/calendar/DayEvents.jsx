/**
 * DayEvents - agenda do dia selecionado, no topo da sidebar do calendario.
 * Lista apenas os eventos de `dia`, em ordem cronologica, com horario e a
 * cor da categoria. Clicar num item abre o EventDrawer.
 */
import { Box, Typography } from "@mui/material"
import { EventBusy } from "@mui/icons-material"
import { format, isSameDay, isToday } from "date-fns"
import { ptBR } from "date-fns/locale"
import { categoriaInfo } from "./categorias"

export default function DayEvents({ dia, eventos = [], onSelecionar }) {
  const doDia = eventos
    .filter((ev) => isSameDay(new Date(ev.inicio_ts), dia))
    .sort((a, b) => new Date(a.inicio_ts) - new Date(b.inicio_ts))

  return (
    <Box sx={{ px: 2, py: 1.5 }}>
      <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", mb: 1 }}>
        <Typography
          variant="overline"
          sx={{ color: "text.secondary", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em" }}
        >
          {isToday(dia) ? "Hoje" : "Eventos do dia"}
        </Typography>
        {doDia.length > 0 && (
          <Typography variant="caption" color="text.disabled" fontWeight={600}>
            {doDia.length}
          </Typography>
        )}
      </Box>

      <Typography
        variant="body2"
        fontWeight={700}
        sx={{ textTransform: "capitalize", mb: 1, color: isToday(dia) ? "primary.main" : "text.primary" }}
      >
        {format(dia, "EEEE, d 'de' MMMM", { locale: ptBR })}
      </Typography>

      {doDia.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 3, color: "text.disabled" }}>
          <EventBusy sx={{ fontSize: 28, opacity: 0.5 }} />
          <Typography variant="caption" sx={{ display: "block", mt: 0.5 }}>
            Nenhuma atividade neste dia.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
          {doDia.map((ev) => {
            const { cor, label } = categoriaInfo(ev.categoria)
            return (
              <Box
                key={ev.id_evento}
                onClick={() => onSelecionar?.(ev)}
                sx={{
                  display: "flex",
                  gap: 1,
                  p: 0.75,
                  borderRadius: "8px",
                  cursor: "pointer",
                  "&:hover": { bgcolor: "action.hover" },
                }}
              >
                <Box sx={{ width: 3, borderRadius: "2px", bgcolor: cor, flexShrink: 0 }} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" fontWeight={600} noWrap>
                    {ev.titulo}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                    {format(new Date(ev.inicio_ts), "HH:mm")}
                    {ev.fim_ts && ` - ${format(new Date(ev.fim_ts), "HH:mm")}`}
                    {` · ${label}`}
                  </Typography>
                </Box>
              </Box>
            )
          })}
        </Box>
      )}
    </Box>
  )
}
