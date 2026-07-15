/**
 * SidebarMobile - a Sidebar como gaveta (drawer) no mobile.
 *
 * Usa SwipeableDrawer do MUI: abre pelo botao hamburguer (Navbar), escurece o
 * fundo (overlay) e permite fechar arrastando (swipe). O conteudo e o mesmo do
 * desktop (SidebarConteudo), sempre no modo expandido.
 */
import { SwipeableDrawer, Box } from "@mui/material"
import { SidebarConteudo, SIDEBAR_WIDTH } from "./Sidebar"

// iOS precisa desta flag para a fisica de arrastar funcionar bem.
const iOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent)

export default function SidebarMobile({
  aberto,
  onAbrir,
  onFechar,
  sidebar,
  badges = {},
  startups = [],
  startupAtualId,
  onTrocarStartup,
  carregando = false,
}) {
  // No mobile, o logo (foguete) fecha a gaveta (equivalente a "recolher").
  const onToggleSidebar = onFechar
  return (
    <SwipeableDrawer
      variant="temporary"
      open={aberto}
      onOpen={onAbrir}
      onClose={onFechar}
      disableBackdropTransition={!iOS}
      disableDiscovery={iOS}
      ModalProps={{ keepMounted: true }} // melhor performance de abertura no mobile
      sx={{
        display: { xs: "block", sm: "none" },
        "& .MuiDrawer-paper": { width: SIDEBAR_WIDTH, boxSizing: "border-box" },
        "& .MuiBackdrop-root": { backgroundColor: "rgba(0,0,0,0.5)" },
      }}
    >
      <Box sx={{ height: "100%" }} role="presentation">
        <SidebarConteudo
          sidebar={sidebar}
          recolhida={false}
          badges={badges}
          startups={startups}
          startupAtualId={startupAtualId}
          onTrocarStartup={onTrocarStartup}
          onToggleSidebar={onToggleSidebar}
          carregando={carregando}
          variante="mobile"
        />
      </Box>
    </SwipeableDrawer>
  )
}
