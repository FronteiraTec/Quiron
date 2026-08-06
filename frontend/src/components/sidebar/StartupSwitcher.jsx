/**
 * StartupSwitcher - cabecalho da Sidebar com a startup atual.
 *
 * - Sem startup associada: mostra a marca do sistema (Quiron).
 * - Uma startup: mostra nome + logo (sem troca).
 * - Varias startups: area de texto vira um botao que abre um menu para troca rapida.
 * O avatar/logo (foguete) e sempre clicavel e alterna a Sidebar entre
 * recolhida e expandida (substitui o antigo botao "hamburguer" da Navbar).
 * No modo recolhido, exibe apenas o avatar/logo centralizado.
 */
import { Box, ButtonBase, Tooltip } from "@mui/material"
import { Menu as MenuIcon } from "@mui/icons-material"

export default function StartupSwitcher({
  recolhida = false,
  onToggleSidebar,
}) {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: recolhida ? "center" : "flex-start",
        px: 1.5,
        py: 1.25,
      }}
    >
      <Tooltip
        title={recolhida ? "Expandir menu" : "Recolher menu"}
        placement="right"
        arrow
      >
        <ButtonBase
          onClick={onToggleSidebar}
          aria-label={recolhida ? "Expandir menu" : "Recolher menu"}
          sx={{
            width: 40,
            height: 40,
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            "&:hover": {
              bgcolor: "action.hover",
            },
          }}
        >
          <MenuIcon />
        </ButtonBase>
      </Tooltip>
    </Box>
  )
}