/**
 * SidebarItem - um item navegavel (link) da Sidebar.
 *
 * Suporta:
 *   - estado ativo com indicador deslizante (framer-motion layoutId)
 *   - modo recolhido (so icone) com tooltip a direita
 *   - badge de contagem pendente + ponto "novo"
 *   - botao de fixar/favoritar (pin) que aparece no hover
 *   - area de clique >= 44px, foco visivel e aria-current
 */
import { motion } from "framer-motion"
import {
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Badge,
  Box,
  IconButton,
  alpha,
} from "@mui/material"
import { PushPin, PushPinOutlined } from "@mui/icons-material"

// Duracao/curva das microinteracoes (dentro da faixa 180-300ms do spec).
const MOLA = { type: "spring", stiffness: 500, damping: 34 }

export default function SidebarItem({
  item,
  ativo,
  recolhida = false,
  nivel = 0,
  badges = {},
  fixado = false,
  mostrarPin = true,
  variante = "desktop",
  onNavegar,
  onFixar,
}) {
  const contagem = item.badgeKey ? badges[item.badgeKey] : undefined
  const temBadge = typeof contagem === "number" && contagem > 0

  const botao = (
    <ListItemButton
      onClick={() => onNavegar?.(item)}
      selected={ativo}
      aria-current={ativo ? "page" : undefined}
      sx={{
        position: "relative",
        minHeight: 42,
        borderRadius: "10px",
        mx: 1.5,
        my: 0.375,
        pl: recolhida ? 1.5 : 1.75 + nivel * 1.75,
        pr: 1.25,
        justifyContent: recolhida ? "center" : "flex-start",
        color: "text.primary",
        transition: "background-color 180ms ease, color 180ms ease",
        "&:hover": {
          bgcolor: (theme) => theme.palette.action.hover,
        },
        "&:hover .pin-btn": { opacity: 1 },
        "& .MuiListItemIcon-root": {
          color: ativo ? "primary.main" : "text.secondary",
          transition: "color 180ms ease",
        },
        "&.Mui-selected": {
          bgcolor: (theme) => alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.18 : 0.09),
        },
        "&.Mui-selected:hover": {
          bgcolor: (theme) => alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.24 : 0.13),
        },
      }}
    >
      {/* Indicador deslizante do item ativo (barra vertical a esquerda). */}
      {ativo && (
        <Box
          component={motion.span}
          layoutId={`sb-ativo-${variante}`}
          transition={MOLA}
          sx={{
            position: "absolute",
            left: 6,
            top: 9,
            bottom: 9,
            width: 3,
            borderRadius: 2,
            bgcolor: "primary.main",
          }}
        />
      )}

      <ListItemIcon
        sx={{ minWidth: 0, mr: recolhida ? 0 : 1.75, justifyContent: "center" }}
      >
        <Badge
          color="error"
          variant={recolhida && temBadge ? "dot" : "standard"}
          badgeContent={recolhida ? undefined : temBadge ? contagem : undefined}
          overlap="circular"
        >
          {item.icone}
        </Badge>
      </ListItemIcon>

      {!recolhida && (
        <>
          <ListItemText
            primary={item.texto}
            primaryTypographyProps={{
              noWrap: true,
              fontSize: 14,
              fontWeight: ativo ? 600 : 500,
              color: ativo ? "text.primary" : "text.secondary",
            }}
          />

          {/* Ponto "novo" */}
          {item.novo && (
            <Box
              sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "secondary.main", mr: 1 }}
              aria-label="novo"
            />
          )}

          {/* Badge de contagem (modo expandido) */}
          {temBadge && (
            <Box
              sx={{
                minWidth: 20,
                height: 20,
                px: 0.75,
                borderRadius: 5,
                bgcolor: "error.main",
                color: "error.contrastText",
                fontSize: 11,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {contagem > 99 ? "99+" : contagem}
            </Box>
          )}

          {/* Botao fixar (aparece no hover) */}
          {mostrarPin && onFixar && (
            <IconButton
              className="pin-btn"
              size="small"
              aria-label={fixado ? `Desafixar ${item.texto}` : `Fixar ${item.texto}`}
              onClick={(e) => {
                e.stopPropagation()
                onFixar(item.id)
              }}
              sx={{
                ml: 0.5,
                opacity: fixado ? 1 : 0,
                transition: "opacity 180ms ease",
                color: fixado ? "primary.main" : "text.disabled",
              }}
            >
              {fixado ? <PushPin sx={{ fontSize: 16 }} /> : <PushPinOutlined sx={{ fontSize: 16 }} />}
            </IconButton>
          )}
        </>
      )}
    </ListItemButton>
  )

  return (
    <ListItem disablePadding sx={{ display: "block" }}>
      {recolhida ? (
        <Tooltip
          title={temBadge ? `${item.texto} (${contagem})` : item.texto}
          placement="right"
          arrow
        >
          {botao}
        </Tooltip>
      ) : (
        botao
      )}
    </ListItem>
  )
}
