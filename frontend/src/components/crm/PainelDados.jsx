/**
 * Os blocos do painel lateral das telas de detalhe do CRM: um cartao com
 * titulo e uma lista de "rotulo: valor".
 */
import { Box, Paper, Typography } from "@mui/material"

export function Painel({ titulo, acao, children }) {
  return (
    <Paper sx={{ borderRadius: 0, p: 2, mb: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography variant="overline" component="h3" color="text.secondary" sx={{ lineHeight: 1.6 }}>
          {titulo}
        </Typography>
        {acao}
      </Box>
      {children}
    </Paper>
  )
}

export function Dado({ rotulo, children }) {
  return (
    <Box sx={{ mb: 1.25, "&:last-of-type": { mb: 0 } }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.4 }}>
        {rotulo}
      </Typography>
      <Typography variant="body2" component="div" sx={{ wordBreak: "break-word" }}>
        {children}
      </Typography>
    </Box>
  )
}
