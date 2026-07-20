/**
 * Trilha (breadcrumb) do no selecionado: Programa / Fase / Modulo / Tarefa.
 * Cada segmento e clicavel e leva a selecao do respectivo ancestral.
 */
import { Box, Typography, Chip } from "@mui/material"
import { NavigateNext } from "@mui/icons-material"
import { TIPO_META } from "../../data/trilhaMeta"

export default function Breadcrumb({ programa, trilha, onSelecionar }) {
  const segmentos = [
    { id_no: programa.id_no, nome: programa.nome, tipo: "PROGRAMA" },
    ...trilha,
  ]

  return (
    <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 0.5 }}>
      {segmentos.map((seg, i) => {
        const meta = TIPO_META[seg.tipo]
        const ultimo = i === segmentos.length - 1
        return (
          <Box key={seg.id_no} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Chip
              size="small"
              onClick={() => onSelecionar(seg.id_no)}
              label={seg.nome}
              sx={{
                height: 22,
                fontSize: 12,
                fontWeight: ultimo ? 600 : 500,
                maxWidth: 180,
                bgcolor: ultimo ? `${meta.cor}1f` : "transparent",
                color: ultimo ? meta.cor : "text.secondary",
                cursor: "pointer",
                "&:hover": { bgcolor: `${meta.cor}18` },
              }}
            />
            {!ultimo && (
              <NavigateNext sx={{ fontSize: 16, color: "text.disabled" }} />
            )}
          </Box>
        )
      })}
    </Box>
  )
}
