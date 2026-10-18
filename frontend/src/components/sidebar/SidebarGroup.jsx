/**
 * SidebarGroup - um grupo de itens (accordion quando expandido, popover
 * quando recolhido).
 *
 * - Expandido: cabecalho clicavel + subitens que abrem/fecham com animacao de
 *   altura (framer-motion). O chevron gira suavemente.
 * - Recolhido: mostra so o icone; clicar abre um popover (MUI Menu) com os
 *   subitens ao lado, com tooltip no cabecalho.
 */
import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Box,
  Menu,
  MenuItem,
  Typography,
  Badge,
} from "@mui/material"
import { ExpandMore } from "@mui/icons-material"
import SidebarItem from "./SidebarItem"

// Curva/duracao da abertura do accordion (faixa 180-300ms do spec).
const TRANSICAO = { duration: 0.24, ease: [0.4, 0, 0.2, 1] }

export default function SidebarGroup({
  group,
  recolhida = false,
  aberto = false,
  ativo = false,
  badges = {},
  variante = "desktop",
  rotaAtiva,
  pinned = [],
  onToggle,
  onNavegar,
  onFixar,
}) {
  const [anchorEl, setAnchorEl] = useState(null)

  // Soma as contagens pendentes dos filhos para mostrar no cabecalho recolhido.
  const totalBadge = group.filhos.reduce(
    (acc, f) => acc + (f.badgeKey && badges[f.badgeKey] ? badges[f.badgeKey] : 0),
    0
  )

  const abrirPopover = (e) => setAnchorEl(e.currentTarget)
  const fecharPopover = () => setAnchorEl(null)

  const cabecalho = (
    <ListItemButton
      onClick={recolhida ? abrirPopover : () => onToggle?.(group.id)}
      selected={recolhida && ativo}
      aria-expanded={recolhida ? undefined : aberto}
      aria-haspopup={recolhida ? "menu" : undefined}
      sx={{
        minHeight: 42,
        borderRadius: "10px",
        mx: 1.5,
        my: 0.375,
        pl: 2, // icone no mesmo x nos dois modos, como no SidebarItem
        pr: 1.25,
        transition: "background-color 180ms ease, color 180ms ease",
        "&:hover": { bgcolor: "action.hover" },
        "& .MuiListItemIcon-root": {
          color: ativo ? "primary.main" : "text.secondary",
          transition: "color 180ms ease",
        },
      }}
    >
      <ListItemIcon sx={{ minWidth: 0, mr: recolhida ? 0 : 1.75, justifyContent: "center" }}>
        <Badge color="error" variant="dot" invisible={!recolhida || totalBadge === 0} overlap="circular">
          {group.icone}
        </Badge>
      </ListItemIcon>

      {!recolhida && (
        <>
          <ListItemText
            primary={group.texto}
            primaryTypographyProps={{
              noWrap: true,
              fontSize: 14,
              fontWeight: ativo ? 600 : 500,
              color: ativo ? "text.primary" : "text.secondary",
            }}
          />
          <Box
            component={motion.span}
            animate={{ rotate: aberto ? 180 : 0 }}
            transition={TRANSICAO}
            sx={{ display: "inline-flex", color: "text.secondary" }}
          >
            <ExpandMore fontSize="small" />
          </Box>
        </>
      )}
    </ListItemButton>
  )

  return (
    <Box>
      <ListItem disablePadding sx={{ display: "block" }}>
        {recolhida ? (
          <Tooltip
            title={totalBadge > 0 ? `${group.texto} (${totalBadge})` : group.texto}
            placement="right"
            arrow
          >
            {cabecalho}
          </Tooltip>
        ) : (
          cabecalho
        )}
      </ListItem>

      {/* Expandido: subitens inline com accordion animado */}
      {!recolhida && (
        <AnimatePresence initial={false}>
          {aberto && (
            <Box
              component={motion.div}
              key="filhos"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={TRANSICAO}
              sx={{ overflow: "hidden", pt: 0.25, pb: 0.25 }}
            >
              {group.filhos.map((filho) => (
                <SidebarItem
                  key={filho.id}
                  item={filho}
                  nivel={1}
                  ativo={rotaAtiva(filho.rota)}
                  badges={badges}
                  fixado={pinned.includes(filho.id)}
                  variante={variante}
                  onNavegar={onNavegar}
                  onFixar={onFixar}
                />
              ))}
            </Box>
          )}
        </AnimatePresence>
      )}

      {/* Recolhido: popover com os subitens ao lado */}
      {recolhida && (
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={fecharPopover}
          anchorOrigin={{ vertical: "top", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "left" }}
          slotProps={{
            paper: {
              sx: {
                ml: 1,
                minWidth: 230,
                borderRadius: "12px",
                py: 0.5,
                boxShadow: "0 8px 28px rgba(15,23,42,0.12)",
              },
            },
          }}
        >
          <Typography
            variant="overline"
            sx={{ px: 2, pt: 0.5, pb: 0.5, display: "block", color: "text.secondary", fontWeight: 600 }}
          >
            {group.texto}
          </Typography>
          {group.filhos.map((filho) => {
            const c = filho.badgeKey ? badges[filho.badgeKey] : undefined
            return (
              <MenuItem
                key={filho.id}
                selected={rotaAtiva(filho.rota)}
                onClick={() => {
                  onNavegar?.(filho)
                  fecharPopover()
                }}
                sx={{ minHeight: 42, mx: 0.75, borderRadius: "8px" }}
              >
                <ListItemIcon>{filho.icone}</ListItemIcon>
                <ListItemText primary={filho.texto} />
                {typeof c === "number" && c > 0 && (
                  <Badge color="error" badgeContent={c} sx={{ ml: 2 }} />
                )}
              </MenuItem>
            )
          })}
        </Menu>
      )}
    </Box>
  )
}
