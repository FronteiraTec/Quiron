/**
 * CalendarEvent - representacao visual de um evento do calendario.
 *
 * variante="pilula" -> chip compacto usado dentro de uma celula do mes.
 * variante="lista"   -> card mais largo usado nas visoes semana/dia/agenda.
 */
import { Box, Typography, alpha } from "@mui/material"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { useCategorias } from "./categorias"

export default function CalendarEvent({ evento, variante = "pilula", onClick }) {
  const { categoriaInfo } = useCategorias()
  const { label, cor, Icone } = categoriaInfo(evento.categoria)
  const hora = format(new Date(evento.inicio_ts), "HH:mm")

  if (variante === "lista") {
    return (
      <Box
        onClick={onClick}
        sx={{
          display: "flex",
          alignItems: "flex-start",
          gap: 1.25,
          p: 1.25,
          borderRadius: "12px",
          border: "1px solid",
          borderColor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"),
          bgcolor: "background.paper",
          cursor: "pointer",
          transition: "transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease",
          "&:hover": {
            borderColor: alpha(cor, 0.5),
            boxShadow: `0 4px 16px ${alpha(cor, 0.16)}`,
            transform: "translateY(-1px)",
          },
        }}
      >
        <Box
          sx={{
            width: 34,
            height: 34,
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: alpha(cor, 0.14),
            color: cor,
            flexShrink: 0,
          }}
        >
          <Icone sx={{ fontSize: 18 }} />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="body2" fontWeight={700} noWrap>
            {evento.titulo}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            {hora}
            {evento.local ? ` · ${evento.local}` : ""}
          </Typography>
        </Box>
        <Box
          sx={{
            fontSize: 11,
            fontWeight: 600,
            color: cor,
            bgcolor: alpha(cor, 0.1),
            px: 1,
            py: 0.25,
            borderRadius: "999px",
            whiteSpace: "nowrap",
            alignSelf: "center",
          }}
        >
          {label}
        </Box>
      </Box>
    )
  }

  return (
    <Box
      onClick={onClick}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.375,
        px: 0.5,
        py: 0.125,
        borderRadius: "6px",
        bgcolor: alpha(cor, 0.12),
        color: cor,
        cursor: "pointer",
        overflow: "hidden",
        transition: "background-color 140ms ease, transform 140ms ease",
        "&:hover": { bgcolor: alpha(cor, 0.22), transform: "translateX(1px)" },
      }}
    >
      <Icone sx={{ fontSize: 11, flexShrink: 0 }} />
      <Typography
        variant="caption"
        fontWeight={600}
        noWrap
        sx={{ fontSize: 10.5, color: "inherit", lineHeight: 1.3 }}
      >
        {hora} {evento.titulo}
      </Typography>
    </Box>
  )
}

/** Formata a data completa em pt-BR (usado no drawer e nos cabecalhos). */
export function formatarDataCompleta(data) {
  return format(data, "EEEE, d 'de' MMMM", { locale: ptBR })
}
