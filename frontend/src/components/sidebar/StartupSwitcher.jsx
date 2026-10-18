/**
 * StartupSwitcher - cabecalho da Sidebar.
 *
 * E o comeco da barra do topo: tem a mesma altura e as mesmas cores da
 * Navbar (palette.barra no tema — a cor principal escolhida, ajustada a
 * aparencia), entao as duas leem como uma faixa so, de ponta a ponta.
 *
 * O botao de menu e sempre clicavel e alterna a Sidebar entre recolhida e
 * expandida (substitui o antigo botao "hamburguer" da Navbar). Expandida, a
 * marca (centauro + QUIRON) vem ao lado; recolhida, sobra so o botao.
 */
import { Box, ButtonBase, Tooltip, useTheme } from "@mui/material"
import { alpha } from "@mui/material/styles"
import { Menu as MenuIcon } from "@mui/icons-material"
import MarcaQuiron from "../marca/MarcaQuiron"

export default function StartupSwitcher({
  recolhida = false,
  onToggleSidebar,
}) {
  const { barra } = useTheme().palette

  return (
    <Box
      sx={(t) => ({
        ...t.mixins.toolbar, // mesma altura da Navbar em cada breakpoint
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: 1,
        justifyContent: recolhida ? "center" : "flex-start",
        px: 1.5,
        bgcolor: "barra.fundo",
        color: "barra.texto",
        // A mesma linha da Navbar (sombra interna, ver MuiAppBar no tema).
        boxShadow: `inset 0 -1px 0 ${alpha(barra.texto, 0.12)}`,
      })}
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
            flexShrink: 0,
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            "&:hover": { bgcolor: alpha(barra.texto, 0.1) },
            "&:focus-visible": { outline: `2px solid ${barra.destaque}`, outlineOffset: -2 },
          }}
        >
          <MenuIcon />
        </ButtonBase>
      </Tooltip>

      {!recolhida && (
        <MarcaQuiron tamanho={28} cor={barra.destaque} corNome={barra.texto} fundo={barra.fundo} />
      )}
    </Box>
  )
}
