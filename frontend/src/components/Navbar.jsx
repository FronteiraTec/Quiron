/**
 * Navbar (barra superior) - estilo PrimarySearchAppBar do MUI, adaptado.
 *
 * Traz a busca de startups (visivel so para admin e mentor - ver
 * BuscaStartups), o atalho para a Agenda (pagina Eventos), o sino de
 * notificacoes (mensagens internas e eventos novos) e o menu de conta (avatar).
 * Acompanha a Sidebar retratil: fica fixa e deslocada para a direita, com a
 * largura/margem seguindo `sidebarWidth`. O botao ☰ so aparece no mobile
 * (abre/fecha a gaveta); no desktop o botao de menu da propria Sidebar
 * recolhe/expande o menu.
 *
 * A barra pinta na cor principal escolhida, ajustada a aparencia (tema:
 * MuiAppBar / palette.barra), e continua o cabecalho da Sidebar, onde fica a
 * marca — por isso o nome "Quiron" nao se repete aqui.
 */
import { useNavigate } from "react-router-dom"
import { AppBar, Box, Toolbar, IconButton, Button, Tooltip } from "@mui/material"
import { Menu as MenuIcon, CalendarMonth } from "@mui/icons-material"
import UserPanel from "./UserPanel"
import BuscaStartups from "./BuscaStartups"
import CentralNotificacoes from "./notificacoes/CentralNotificacoes"
import { SIDEBAR_TRANSICAO } from "./sidebar/menuConfig"

export default function Navbar({ onToggleSidebar, sidebarWidth }) {
  const navigate = useNavigate()
  const irParaAgenda = () => navigate("/eventos")

  return (
    <AppBar
      position="fixed"
      sx={{
        width: { sm: `calc(100% - ${sidebarWidth}px)` },
        ml: { sm: `${sidebarWidth}px` },
        // Mesma curva da Sidebar: com a "sharp" de antes, a borda da Navbar e
        // a do menu se separavam no meio da animacao e abria um vao na faixa.
        transition: (theme) => theme.transitions.create(["width", "margin"], SIDEBAR_TRANSICAO),
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

        {/* Busca de startups: so aparece para admin e mentor (ver BuscaStartups). */}
        <BuscaStartups />

        <Box sx={{ flexGrow: 1 }} />

        {/* Atalho para a Agenda: botao com rotulo no desktop, so o icone no mobile. */}
        <Button
          data-tour="nav-agenda"
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

        {/* Sino: mensagens internas + eventos novos (ver CentralNotificacoes) */}
        <Box data-tour="nav-notificacoes" sx={{ display: "flex" }}>
          <CentralNotificacoes />
        </Box>

        {/* Avatar/conta - sempre visivel, abre o UserPanel */}
        <Box data-tour="nav-conta" sx={{ display: "flex", ml: 1 }}>
          <UserPanel />
        </Box>
      </Toolbar>
    </AppBar>
  )
}
