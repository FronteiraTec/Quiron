/**
 * Indicador de estado de um passo. Duas formas:
 *   - variant="icon" -> so o icone colorido (usado na lista/sidebar)
 *   - variant="chip" -> chip com rotulo (usado no cabecalho do passo)
 *
 * Le tudo do mapa unico STATUS_PASSO (jornadaMeta), garantindo consistencia.
 */
import { Box, Chip } from "@mui/material"
import { STATUS_PASSO } from "../../data/jornadaMeta"

export default function StatusPasso({ status, variant = "icon", size = 20 }) {
  const meta = STATUS_PASSO[status] || STATUS_PASSO.NAO_INICIADA
  const Icone = meta.icon

  if (variant === "chip") {
    return (
      <Chip
        size="small"
        icon={<Icone sx={{ fontSize: 16, color: `${meta.cor} !important` }} />}
        label={meta.label}
        sx={{
          height: 24,
          fontWeight: 700,
          fontSize: 12,
          bgcolor: `${meta.cor}1f`,
          color: meta.cor,
        }}
      />
    )
  }

  return (
    <Box sx={{ display: "grid", placeItems: "center", color: meta.cor, flexShrink: 0 }}>
      <Icone sx={{ fontSize: size }} />
    </Box>
  )
}
