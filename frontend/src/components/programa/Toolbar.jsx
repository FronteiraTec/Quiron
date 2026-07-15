/**
 * Barra superior do Construtor: titulo, acoes globais da arvore (expandir /
 * recolher todos) e o botao de destaque "Visualizar como incubada".
 * Tambem exibe o botao de alternar a arvore em telas menores (tablet).
 */
import { Box, Typography, Button, IconButton, Tooltip, Divider } from "@mui/material"
import {
  UnfoldMore,
  UnfoldLess,
  Visibility,
  AccountTree,
  MenuOpen,
} from "@mui/icons-material"

export default function Toolbar({
  onExpandirTodos,
  onRecolherTodos,
  onPreview,
  onToggleArvore,
  mostrarToggleArvore,
}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: { xs: 2, md: 3 },
        py: 1.5,
        borderBottom: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      {mostrarToggleArvore && (
        <IconButton onClick={onToggleArvore} size="small">
          <MenuOpen />
        </IconButton>
      )}

      <AccountTree sx={{ color: "primary.main" }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 17, lineHeight: 1.1 }} noWrap>
          Construtor de Programa
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: { xs: "none", sm: "block" } }}>
          Monte a trilha de incubacao arrastando, criando e editando em um so lugar
        </Typography>
      </Box>

      <Tooltip title="Expandir todos" arrow>
        <IconButton onClick={onExpandirTodos} size="small">
          <UnfoldMore />
        </IconButton>
      </Tooltip>
      <Tooltip title="Recolher todos" arrow>
        <IconButton onClick={onRecolherTodos} size="small">
          <UnfoldLess />
        </IconButton>
      </Tooltip>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 1 }} />

      <Button
        onClick={onPreview}
        variant="contained"
        disableElevation
        startIcon={<Visibility />}
        sx={{
          textTransform: "none",
          fontWeight: 600,
          borderRadius: "6px",
        }}
      >
        <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
          Visualizar como&nbsp;
        </Box>
        incubada
      </Button>
    </Box>
  )
}
