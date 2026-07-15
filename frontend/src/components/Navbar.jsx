/**
 * Navbar (barra superior) - estilo PrimarySearchAppBar do MUI, adaptado.
 *
 * Traz busca, icones de mensagens/notificacoes e o menu de conta (avatar).
 * Acompanha a Sidebar retratil: fica fixa e deslocada para a direita, com a
 * largura/margem seguindo `sidebarWidth`. O botao ☰ so aparece no mobile
 * (abre/fecha a gaveta); no desktop o logo (foguete) na propria Sidebar
 * recolhe/expande o menu.
 */
import { useState } from "react"
import { styled, alpha } from "@mui/material/styles"
import {
  AppBar,
  Box,
  Toolbar,
  IconButton,
  Typography,
  InputBase,
  Badge,
  Menu,
  MenuItem,
} from "@mui/material"
import {
  Menu as MenuIcon,
  Search as SearchIcon,
  Mail as MailIcon,
  Notifications as NotificationsIcon,
  MoreVert as MoreIcon,
} from "@mui/icons-material"
import UserPanel from "./UserPanel"

// Campo de busca estilizado (do exemplo do MUI).
const Search = styled("div")(({ theme }) => ({
  position: "relative",
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.common.white, 0.15),
  "&:hover": { backgroundColor: alpha(theme.palette.common.white, 0.25) },
  marginRight: theme.spacing(2),
  marginLeft: 0,
  width: "100%",
  [theme.breakpoints.up("sm")]: { marginLeft: theme.spacing(3), width: "auto" },
}))

const SearchIconWrapper = styled("div")(({ theme }) => ({
  padding: theme.spacing(0, 2),
  height: "100%",
  position: "absolute",
  pointerEvents: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
}))

const StyledInputBase = styled(InputBase)(({ theme }) => ({
  color: "inherit",
  "& .MuiInputBase-input": {
    padding: theme.spacing(1, 1, 1, 0),
    paddingLeft: `calc(1em + ${theme.spacing(4)})`,
    transition: theme.transitions.create("width"),
    width: "100%",
    [theme.breakpoints.up("md")]: { width: "20ch" },
  },
}))

export default function Navbar({ onToggleSidebar, sidebarWidth }) {
  // Menu "mais" (mobile) - reune acoes que ficam escondidas em telas pequenas.
  const [mobileMoreAnchorEl, setMobileMoreAnchorEl] = useState(null)
  const mobileMenuAberto = Boolean(mobileMoreAnchorEl)

  const abrirMenuMobile = (e) => setMobileMoreAnchorEl(e.currentTarget)
  const fecharMenuMobile = () => setMobileMoreAnchorEl(null)

  // Menu "mais" (mobile): reune as acoes que ficam escondidas em telas pequenas.
  const menuMobile = (
    <Menu
      anchorEl={mobileMoreAnchorEl}
      anchorOrigin={{ vertical: "top", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "right" }}
      open={mobileMenuAberto}
      onClose={fecharMenuMobile}
    >
      <MenuItem>
        <IconButton size="large" color="inherit" aria-label="mensagens">
          <Badge badgeContent={4} color="error">
            <MailIcon />
          </Badge>
        </IconButton>
        <p>Mensagens</p>
      </MenuItem>
      <MenuItem>
        <IconButton size="large" color="inherit" aria-label="notificacoes">
          <Badge badgeContent={17} color="error">
            <NotificationsIcon />
          </Badge>
        </IconButton>
        <p>Notificacoes</p>
      </MenuItem>
    </Menu>
  )

  return (
    <>
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

          <Search>
            <SearchIconWrapper>
              <SearchIcon />
            </SearchIconWrapper>
            <StyledInputBase placeholder="Buscar…" inputProps={{ "aria-label": "buscar" }} />
          </Search>

          <Box sx={{ flexGrow: 1 }} />

          {/* Acoes a direita (desktop) */}
          <Box sx={{ display: { xs: "none", md: "flex" } }}>
            <IconButton size="large" color="inherit" aria-label="mensagens">
              <Badge badgeContent={4} color="error">
                <MailIcon />
              </Badge>
            </IconButton>
            <IconButton size="large" color="inherit" aria-label="notificacoes">
              <Badge badgeContent={17} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
          </Box>

          {/* Acao "mais" (mobile) */}
          <Box sx={{ display: { xs: "flex", md: "none" } }}>
            <IconButton
              size="large"
              aria-label="mais opcoes"
              aria-haspopup="true"
              onClick={abrirMenuMobile}
              color="inherit"
            >
              <MoreIcon />
            </IconButton>
          </Box>

          {/* Avatar/conta - sempre visivel, abre o UserPanel */}
          <Box sx={{ display: "flex", ml: 1 }}>
            <UserPanel />
          </Box>
        </Toolbar>
      </AppBar>

      {menuMobile}
    </>
  )
}
