/**
 * Card de um conteudo no acervo da Biblioteca.
 *
 * Hierarquia, de cima para baixo: o que e (logo ou icone + tipo), do que trata
 * (titulo, resumo, tags) e onde esta em uso (rodape com as trilhas vinculadas
 * — o principal sinal de reutilizacao). O menu de contexto (editar, duplicar,
 * excluir) so aparece no hover, para nao poluir a grade; em telas de toque,
 * sem hover, ele fica sempre visivel.
 */
import { useState } from "react"
import {
  Box,
  Paper,
  Typography,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
} from "@mui/material"
import {
  MoreVert,
  EditOutlined,
  ContentCopy,
  DeleteOutline,
  NorthEast,
} from "@mui/icons-material"
import { motion } from "framer-motion"
import LogoConteudo from "./LogoConteudo"
import { TIPO_CONTEUDO } from "../../data/bibliotecaMeta"

// Chip neutro e baixo, usado no tipo e nas tags.
const chipNeutro = {
  height: 22,
  fontSize: 12,
  fontWeight: 600,
  bgcolor: "action.selected",
  "& .MuiChip-label": { px: 1 },
}

/**
 * "1 trilha vinculada" / "N trilhas vinculadas". Conta trilhas DISTINTAS: o
 * mesmo conteudo pode estar em varios passos de uma mesma trilha.
 */
function rotuloTrilhas(usos) {
  const n = new Set(usos.map((u) => u.id_trilha)).size
  if (!n) return "Nenhuma trilha vinculada"
  return n === 1 ? "1 trilha vinculada" : `${n} trilhas vinculadas`
}

export default function ContentCard({ conteudo, onAbrir, onDuplicar, onExcluir }) {
  const meta = TIPO_CONTEUDO[conteudo.tipo]
  const [menu, setMenu] = useState(null)
  const usos = conteudo.usos || []

  return (
    <Paper
      component={motion.div}
      layout
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      onClick={() => onAbrir(conteudo)}
      elevation={0}
      sx={{
        p: 2,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 1.25,
        cursor: "pointer",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        transition: "border-color .15s, box-shadow .15s",
        "&:hover": { borderColor: `${meta.cor}66`, boxShadow: 3 },
        "& .card-menu": { opacity: Boolean(menu) ? 1 : 0, transition: "opacity .15s" },
        "&:hover .card-menu, & .card-menu:focus-visible": { opacity: 1 },
        "@media (hover: none)": { "& .card-menu": { opacity: 1 } },
      }}
    >
      {/* Topo: logo (ou icone do tipo) + tipo + menu */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <LogoConteudo conteudo={conteudo} tamanho={36} fonteIcone={20} />
        <Chip label={meta.label} size="small" sx={chipNeutro} />
        {conteudo.duracao && (
          <Typography variant="caption" color="text.secondary">
            {conteudo.duracao}
          </Typography>
        )}
        <IconButton
          className="card-menu"
          size="small"
          aria-label="Ações do conteúdo"
          sx={{ ml: "auto" }}
          onClick={(e) => {
            e.stopPropagation()
            setMenu(e.currentTarget)
          }}
        >
          <MoreVert fontSize="small" />
        </IconButton>
      </Box>

      {/* Titulo + resumo */}
      <Typography sx={{ fontWeight: 700, fontSize: 16, lineHeight: 1.3, mt: 0.5 }}>
        {conteudo.titulo || "Sem título"}
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {conteudo.resumo || "Sem descrição."}
      </Typography>

      {/* Tags */}
      {conteudo.tags?.length > 0 && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
          {conteudo.tags.slice(0, 3).map((t) => (
            <Chip key={t} label={t} size="small" sx={chipNeutro} />
          ))}
        </Box>
      )}

      {/* Rodape: trilhas vinculadas + seta de abrir */}
      <Box
        sx={{
          mt: "auto",
          pt: 1.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: "1px solid",
          borderColor: "divider",
        }}
      >
        <Tooltip
          arrow
          title={
            usos.length ? (
              <Box sx={{ whiteSpace: "pre-line" }}>
                {usos.map((u) => `${u.fase} › ${u.passo}`).join("\n")}
              </Box>
            ) : (
              "Ainda não usado em nenhum passo"
            )
          }
        >
          <Typography
            variant="caption"
            sx={{ color: usos.length ? "text.secondary" : "text.disabled" }}
          >
            {rotuloTrilhas(usos)}
          </Typography>
        </Tooltip>
        <NorthEast sx={{ fontSize: 16, color: "text.secondary" }} />
      </Box>

      {/* Menu de contexto */}
      <Menu
        anchorEl={menu}
        open={Boolean(menu)}
        onClose={() => setMenu(null)}
        onClick={(e) => e.stopPropagation()}
      >
        <MenuItem
          onClick={() => {
            setMenu(null)
            onAbrir(conteudo)
          }}
        >
          <ListItemIcon>
            <EditOutlined fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Editar" />
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenu(null)
            onDuplicar(conteudo)
          }}
        >
          <ListItemIcon>
            <ContentCopy fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Duplicar" />
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenu(null)
            onExcluir(conteudo)
          }}
          sx={{ color: "error.main" }}
        >
          <ListItemIcon>
            <DeleteOutline fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText primary="Excluir" />
        </MenuItem>
      </Menu>
    </Paper>
  )
}
