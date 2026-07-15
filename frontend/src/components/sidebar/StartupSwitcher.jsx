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
import { useState } from "react"
import {
  Box,
  Avatar,
  Typography,
  Menu,
  MenuItem,
  ListItemAvatar,
  ListItemText,
  ButtonBase,
  Tooltip,
} from "@mui/material"
import { UnfoldMore, RocketLaunch, Check } from "@mui/icons-material"

function iniciais(nome = "") {
  return nome.trim().slice(0, 1).toUpperCase() || "?"
}

export default function StartupSwitcher({
  startups = [],
  startupAtualId,
  recolhida = false,
  onTrocar,
  onToggleSidebar,
  usuario,
}) {
  const [anchorEl, setAnchorEl] = useState(null)
  const varias = startups.length > 1
  const atual = startups.find((s) => s.id === startupAtualId) || startups[0] || null

  // Sem startup, usa a foto de perfil do usuario (cadastrada em Perfil) como
  // substituta do icone padrao (foguete).
  const fotoUsuario = !atual ? usuario?.foto_url : null

  // Avatar/logo (foguete): sempre clicavel, alterna recolher/expandir a Sidebar.
  const logoBotao = (
    <Tooltip title={recolhida ? "Expandir menu" : "Recolher menu"} placement="right" arrow>
      <ButtonBase
        onClick={onToggleSidebar}
        aria-label={recolhida ? "Expandir menu" : "Recolher menu"}
        sx={{
          borderRadius: "10px",
          transition: "background-color 180ms ease, transform 180ms ease",
          "&:hover": { bgcolor: "action.hover" },
          "&:active": { transform: "scale(0.94)" },
        }}
      >
        <Avatar
          src={atual?.logo || fotoUsuario || undefined}
          variant="rounded"
          sx={{ width: 36, height: 36, bgcolor: "primary.main", fontSize: 16, borderRadius: "10px" }}
        >
          {atual ? iniciais(atual.nome) : usuario?.nome ? iniciais(usuario.nome) : <RocketLaunch fontSize="small" />}
        </Avatar>
      </ButtonBase>
    </Tooltip>
  )

  const texto = (
    <Box sx={{ minWidth: 0, flex: 1, textAlign: "left" }}>
      <Typography
        variant="caption"
        color="text.secondary"
        noWrap
        sx={{ display: "block", fontSize: 11, fontWeight: 500 }}
      >
        {atual ? "Startup" : "Sistema"}
      </Typography>
      <Typography variant="subtitle2" noWrap fontWeight={700} sx={{ fontSize: 14.5 }}>
        {atual?.nome || "Quiron"}
      </Typography>
    </Box>
  )

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: 1.5,
        py: 1.25,
        justifyContent: recolhida ? "center" : "flex-start",
      }}
    >
      {logoBotao}

      {!recolhida && (
        varias ? (
          <ButtonBase
            onClick={(e) => setAnchorEl(e.currentTarget)}
            aria-haspopup="listbox"
            aria-label="Trocar de startup"
            sx={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              alignItems: "center",
              gap: 1,
              borderRadius: "10px",
              px: 1,
              py: 0.5,
              transition: "background-color 180ms ease",
              "&:hover": { bgcolor: "action.hover" },
            }}
          >
            {texto}
            <UnfoldMore fontSize="small" sx={{ color: "text.disabled" }} />
          </ButtonBase>
        ) : (
          <Box sx={{ flex: 1, minWidth: 0, display: "flex" }}>{texto}</Box>
        )
      )}

      {varias && (
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
          slotProps={{
            paper: {
              sx: { minWidth: 240, maxHeight: 360, borderRadius: "12px", boxShadow: "0 8px 28px rgba(15,23,42,0.12)" },
            },
          }}
        >
          {startups.map((s) => (
            <MenuItem
              key={s.id}
              selected={s.id === atual?.id}
              onClick={() => {
                onTrocar?.(s.id)
                setAnchorEl(null)
              }}
              sx={{ mx: 0.75, my: 0.25, borderRadius: "8px" }}
            >
              <ListItemAvatar>
                <Avatar src={s.logo || undefined} variant="rounded" sx={{ width: 32, height: 32, borderRadius: "8px" }}>
                  {iniciais(s.nome)}
                </Avatar>
              </ListItemAvatar>
              <ListItemText primary={s.nome} />
              {s.id === atual?.id && <Check fontSize="small" color="primary" />}
            </MenuItem>
          ))}
        </Menu>
      )}
    </Box>
  )
}
