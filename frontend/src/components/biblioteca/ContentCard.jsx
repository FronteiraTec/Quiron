/**
 * Card de um conteudo no acervo da Biblioteca.
 *
 * Mostra o tipo (logo do conteudo ou icone + cor de acento), titulo, resumo, tags, quando foi
 * atualizado e o "usado em N" — quantos passos da trilha referenciam este
 * conteudo (o principal sinal de reutilizacao). Menu de contexto com editar,
 * duplicar e excluir.
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
  AccountTree,
} from "@mui/icons-material"
import { motion } from "framer-motion"
import LogoConteudo from "./LogoConteudo"
import { TIPO_CONTEUDO } from "../../data/bibliotecaMeta"

// Formata "atualizado ha X" de forma simples (sem libs extras aqui).
function tempoRelativo(iso) {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (dias <= 0) return "hoje"
  if (dias === 1) return "ontem"
  if (dias < 30) return `há ${dias} dias`
  const meses = Math.floor(dias / 30)
  return meses === 1 ? "há 1 mês" : `há ${meses} meses`
}

export default function ContentCard({ conteudo, onAbrir, onDuplicar, onExcluir }) {
  const meta = TIPO_CONTEUDO[conteudo.tipo]
  const [menu, setMenu] = useState(null)
  // Por fase, e nao por passo: o Construtor so mostra a fase, e o passo
  // "Materiais" que a guarda por baixo nao diz nada a quem le o card.
  const fasesDeUso = [...new Set((conteudo.usos || []).map((u) => u.fase).filter(Boolean))]
  const usos = fasesDeUso.length

  return (
    <Paper
      component={motion.div}
      layout
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      onClick={() => onAbrir(conteudo)}
      elevation={0}
      sx={{
        p: 2,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 1,
        cursor: "pointer",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        transition: "border-color .15s, box-shadow .15s",
        "&:hover": { borderColor: `${meta.cor}66`, boxShadow: 3 },
      }}
    >
      {/* Topo: logo (ou icone do tipo) + badge do tipo + menu */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <LogoConteudo conteudo={conteudo} tamanho={34} fonteIcone={20} />
        <Chip
          label={meta.label}
          size="small"
          sx={{
            height: 20,
            fontSize: 11,
            fontWeight: 700,
            bgcolor: `${meta.cor}1f`,
            color: meta.cor,
          }}
        />
        {conteudo.duracao && (
          <Typography variant="caption" color="text.secondary">
            {conteudo.duracao}
          </Typography>
        )}
        <IconButton
          size="small"
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
      <Typography sx={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3, mt: 0.5 }}>
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
          minHeight: 40,
        }}
      >
        {conteudo.resumo || "Sem descrição."}
      </Typography>

      {/* Tags */}
      {conteudo.tags?.length > 0 && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
          {conteudo.tags.slice(0, 3).map((t) => (
            <Chip key={t} label={t} size="small" variant="outlined" sx={{ height: 22, fontSize: 11 }} />
          ))}
        </Box>
      )}

      {/* Rodape: usado em N + atualizado */}
      <Box
        sx={{
          mt: "auto",
          pt: 1,
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
            usos ? fasesDeUso.join("\n") : "Ainda não está em nenhuma fase"
          }
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: usos ? "primary.main" : "text.disabled" }}>
            <AccountTree sx={{ fontSize: 15 }} />
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              {usos ? `Em ${usos} fase${usos === 1 ? "" : "s"}` : "Fora das trilhas"}
            </Typography>
          </Box>
        </Tooltip>
        <Typography variant="caption" color="text.disabled">
          {tempoRelativo(conteudo.atualizado_ts)}
        </Typography>
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
