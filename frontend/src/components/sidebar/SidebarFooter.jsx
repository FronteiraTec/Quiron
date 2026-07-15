/**
 * SidebarFooter - rodape com o usuario logado.
 *
 * Mostra avatar + nome + papel e abre um menu suspenso com Perfil,
 * Preferencias e Sair. No modo recolhido mostra apenas o avatar (com tooltip).
 */
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Box,
  Avatar,
  Typography,
  Menu,
  MenuItem,
  ListItemIcon,
  Divider,
  ButtonBase,
  Tooltip,
  Chip,
} from "@mui/material"
import { Person, Tune, Logout, MoreVert } from "@mui/icons-material"
import { useAuthStore } from "../../store/authStore"

const ROTULO_PAPEL = { admin: "Administrador", mentor: "Mentor", usuario: "Usuario" }

function iniciais(nome = "") {
  const partes = nome.trim().split(/\s+/)
  return ((partes[0]?.[0] || "") + (partes[1]?.[0] || "")).toUpperCase() || "?"
}

export default function SidebarFooter({ usuario, papel, recolhida = false }) {
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)
  const [anchorEl, setAnchorEl] = useState(null)

  const fechar = () => setAnchorEl(null)
  const irPara = (rota) => {
    fechar()
    navigate(rota)
  }
  const sair = async () => {
    fechar()
    await logout()
    navigate("/login")
  }

  const avatar = (
    <Avatar src={usuario?.avatar || undefined} sx={{ width: 36, height: 36, bgcolor: "secondary.main" }}>
      {iniciais(usuario?.nome)}
    </Avatar>
  )

  const gatilho = (
    <ButtonBase
      onClick={(e) => setAnchorEl(e.currentTarget)}
      aria-haspopup="menu"
      aria-label="Menu do usuario"
      sx={{
        width: "100%",
        borderRadius: "10px",
        p: 1.25,
        gap: 1.5,
        display: "flex",
        alignItems: "center",
        justifyContent: recolhida ? "center" : "flex-start",
        transition: "background-color 180ms ease",
        "&:hover": { bgcolor: "action.hover" },
      }}
    >
      {avatar}
      {!recolhida && (
        <>
          <Box sx={{ minWidth: 0, flex: 1, textAlign: "left" }}>
            <Typography variant="subtitle2" noWrap fontWeight={600} sx={{ fontSize: 14 }}>
              {usuario?.nome || "Usuario"}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              noWrap
              sx={{ display: "block", fontSize: 12 }}
            >
              {ROTULO_PAPEL[papel] || papel}
            </Typography>
          </Box>
          <MoreVert fontSize="small" sx={{ color: "text.disabled" }} />
        </>
      )}
    </ButtonBase>
  )

  return (
    <Box
      sx={{
        p: 1.25,
        borderTop: (t) => `1px solid ${t.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)"}`,
      }}
    >
      {recolhida ? (
        <Tooltip title={usuario?.nome || "Usuario"} placement="right" arrow>
          <Box>{gatilho}</Box>
        </Tooltip>
      ) : (
        gatilho
      )}

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={fechar}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        transformOrigin={{ vertical: "bottom", horizontal: "center" }}
        slotProps={{
          paper: { sx: { minWidth: 220, mb: 1, borderRadius: "12px", boxShadow: "0 8px 28px rgba(15,23,42,0.12)" } },
        }}
      >
        <Box sx={{ px: 2, py: 1.25 }}>
          <Typography variant="subtitle2" noWrap fontWeight={600}>
            {usuario?.nome || "Usuario"}
          </Typography>
          {usuario?.email && (
            <Typography variant="body2" color="text.secondary" noWrap sx={{ fontSize: 12.5 }}>
              {usuario.email}
            </Typography>
          )}
          <Chip
            size="small"
            label={ROTULO_PAPEL[papel] || papel}
            sx={{ mt: 0.75, borderRadius: "6px" }}
            color="primary"
            variant="outlined"
          />
        </Box>
        <Divider />
        <MenuItem onClick={() => irPara("/perfil")} sx={{ minHeight: 42, mx: 0.75, my: 0.25, borderRadius: "8px" }}>
          <ListItemIcon><Person fontSize="small" /></ListItemIcon>
          Perfil
        </MenuItem>
        <MenuItem onClick={() => irPara("/perfil")} sx={{ minHeight: 42, mx: 0.75, my: 0.25, borderRadius: "8px" }}>
          <ListItemIcon><Tune fontSize="small" /></ListItemIcon>
          Preferencias
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={sair}
          sx={{ minHeight: 42, mx: 0.75, my: 0.25, borderRadius: "8px", color: "error.main" }}
        >
          <ListItemIcon><Logout fontSize="small" color="error" /></ListItemIcon>
          Sair
        </MenuItem>
      </Menu>
    </Box>
  )
}
