/**
 * Uma linha de material compartilhado, compacta — a que aparece pendurada na
 * etapa da trilha em "Meus incubados". Mostra o que a startup recebeu, de quem
 * e quando, e o comeco da orientacao; editar e remover so para o autor (o
 * backend confere de novo).
 */
import { Box, Chip, IconButton, Tooltip, Typography } from "@mui/material"
import { VisibilityOutlined, EditOutlined, DeleteOutline } from "@mui/icons-material"
import IconeFormato from "./IconeFormato"
import { FINALIDADES, SITUACOES, dataBR } from "../../data/espacoMentorMeta"

export default function LinhaCompartilhamento({ item, onAbrir, onEditar, onRemover }) {
  const situacao = SITUACOES[item.situacao]
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        gap: 1.25,
        py: 1,
        px: 1,
        borderRadius: "4px",
        "&:hover": { bgcolor: "action.hover" },
      }}
    >
      <IconeFormato item={item} tamanho={28} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {item.titulo}
          </Typography>
          {item.finalidade === "ATIVIDADE" && (
            <Chip
              size="small"
              label={FINALIDADES.ATIVIDADE.rotulo}
              sx={{ height: 20, fontSize: 11, fontWeight: 700, bgcolor: `${FINALIDADES.ATIVIDADE.cor}1f`, color: FINALIDADES.ATIVIDADE.cor }}
            />
          )}
          {item.situacao !== "DISPONIVEL" && situacao && (
            <Tooltip title={situacao.ajuda} arrow>
              <Chip
                size="small"
                label={situacao.rotulo}
                sx={{ height: 20, fontSize: 11, fontWeight: 700, bgcolor: `${situacao.cor}1f`, color: situacao.cor }}
              />
            </Tooltip>
          )}
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
          {item.meu ? "Você" : item.compartilhado_por_nome || "Mentor"} · {dataBR(item.criado_ts)}
          {item.origem === "INSTITUCIONAL" ? " · Biblioteca da incubadora" : ""}
        </Typography>
        {item.orientacao && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mt: 0.25,
              fontStyle: "italic",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            “{item.orientacao}”
          </Typography>
        )}
      </Box>
      <Box sx={{ display: "flex", flexShrink: 0 }}>
        <Tooltip title="Ver material">
          <IconButton size="small" onClick={() => onAbrir(item)} aria-label={`Ver ${item.titulo}`}>
            <VisibilityOutlined fontSize="small" />
          </IconButton>
        </Tooltip>
        {item.meu && item.acompanha && (
          <Tooltip title="Editar orientação">
            <IconButton size="small" onClick={() => onEditar(item)} aria-label={`Editar ${item.titulo}`}>
              <EditOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {item.meu && (
          <Tooltip title="Remover da startup">
            <IconButton
              size="small"
              onClick={() => onRemover(item)}
              aria-label={`Remover ${item.titulo}`}
              sx={{ color: "error.main" }}
            >
              <DeleteOutline fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  )
}
