/**
 * Estado vazio reutilizavel: icone circular, titulo, descricao e acao opcional.
 * Usado na arvore (sem fases / busca sem resultado) e no Inspector (nada
 * selecionado).
 */
import { Box, Typography, Button } from "@mui/material"
import {
  Timeline,
  SearchOff,
  TouchApp,
  AutoStories,
} from "@mui/icons-material"

const ICONES = {
  fases: Timeline,
  busca: SearchOff,
  selecao: TouchApp,
  programa: AutoStories,
}

export default function EmptyState({
  variante = "selecao",
  titulo,
  descricao,
  acaoTexto,
  onAcao,
}) {
  const Icone = ICONES[variante] || TouchApp
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 1,
        px: 3,
        py: 6,
        color: "text.secondary",
      }}
    >
      <Box
        sx={{
          display: "grid",
          placeItems: "center",
          width: 56,
          height: 56,
          borderRadius: "12px",
          bgcolor: "action.hover",
          mb: 0.5,
        }}
      >
        <Icone sx={{ fontSize: 28, opacity: 0.7 }} />
      </Box>
      <Typography sx={{ fontWeight: 600, color: "text.primary" }}>{titulo}</Typography>
      <Typography variant="body2" sx={{ maxWidth: 260 }}>
        {descricao}
      </Typography>
      {acaoTexto && (
        <Button variant="outlined" size="small" onClick={onAcao} sx={{ mt: 1, textTransform: "none" }}>
          {acaoTexto}
        </Button>
      )}
    </Box>
  )
}
