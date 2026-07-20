/**
 * Navbar (barra superior) - estilo PrimarySearchAppBar do MUI, adaptado.
 *
 * Traz a busca de startups (visivel so para admin e mentor - ver
 * BuscaStartups), o atalho para a Agenda (pagina Eventos), o sino de
 * notificacoes dos eventos criados recentemente e o menu de conta (avatar).
 * Acompanha a Sidebar retratil: fica fixa e deslocada para a direita, com a
 * largura/margem seguindo `sidebarWidth`. O botao ☰ so aparece no mobile
 * (abre/fecha a gaveta); no desktop o logo (foguete) na propria Sidebar
 * recolhe/expande o menu.
 */
import { useNavigate } from "react-router-dom"
import { AppBar, Box, Toolbar, IconButton, Button, Tooltip, Typography } from "@mui/material"
import { Menu as MenuIcon, CalendarMonth } from "@mui/icons-material"
import UserPanel from "./UserPanel"
import BuscaStartups from "./BuscaStartups"
import NotificacoesEventos from "./NotificacoesEventos"

export default function Navbar({ onToggleSidebar, sidebarWidth }) {
  const navigate = useNavigate()
  const irParaAgenda = () => navigate("/eventos")

  return (
    <AppBar
      position="fixed"
      sx={{
        width: { sm: `calc(100% - ${sidebarWidth}px)` },
        ml: { sm: `${sidebarWidth}px` },
        transition: (theme) =>
          theme.transitions.create(["width", "margin"], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
      }}
    >
      <Toolbar>
        {/* ☰ : so no mobile (abre a gaveta). No desktop, o logo da Sidebar alterna. */}
        <IconButton
          color="inherit"
          aria-label="abrir menu"
          edge="start"
          onClick={onToggleSidebar}
          sx={{ mr: 2, display: { xs: "inline-flex", sm: "none" } }}
        >
          <MenuIcon />
        </IconButton>

        <Typography
          variant="h6"
          noWrap
          component="div"
          sx={{ display: { xs: "none", sm: "block" }, fontWeight: 700 }}
        >
          Quiron
        </Typography>

        {/* Busca de startups: so aparece para admin e mentor (ver BuscaStartups). */}
        <BuscaStartups />

        <Box sx={{ flexGrow: 1 }} />

        {/* Atalho para a Agenda: botao com rotulo no desktop, so o icone no mobile. */}
        <Button
          color="inherit"
          onClick={irParaAgenda}
          startIcon={<CalendarMonth />}
          sx={{
            display: { xs: "none", sm: "inline-flex" },
            mr: 0.5,
            textTransform: "none",
            fontWeight: 600,
            borderRadius: 2,
          }}
        >
          Agenda
        </Button>
        <Tooltip title="Agenda">
          <IconButton
            size="large"
            color="inherit"
            onClick={irParaAgenda}
            aria-label="abrir agenda"
            sx={{ display: { xs: "inline-flex", sm: "none" } }}
          >
            <CalendarMonth />
          </IconButton>
        </Tooltip>

        {/* Sino: eventos criados recentemente (ver useNotificacoesEventos) */}
        <NotificacoesEventos />

        {/* Avatar/conta - sempre visivel, abre o UserPanel */}
        <Box sx={{ display: "flex", ml: 1 }}>
          <UserPanel />
        </Box>
      </Toolbar>
    </AppBar>
  )
}
