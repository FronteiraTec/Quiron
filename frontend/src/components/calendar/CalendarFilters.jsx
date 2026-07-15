/**
 * CalendarFilters - chips de filtro rapido acima do calendario.
 * Atualizam a visualizacao instantaneamente (reaproveita categoriasAtivas).
 */
import { Box, Chip } from "@mui/material"
import { LISTA_CATEGORIAS, CATEGORIAS } from "./categorias"

const ATALHOS = ["MENTORIA", "EVENTO", "WORKSHOP", "REUNIAO", "ENTREGA", "PRAZO"]

export default function CalendarFilters({ categoriasAtivas, onSelecionar }) {
  const todosAtivos = categoriasAtivas.size === LISTA_CATEGORIAS.length

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, px: 2, pt: 1, pb: 0.5 }}>
      <Chip
        label="Todos"
        size="small"
        onClick={() => onSelecionar(null)}
        color={todosAtivos ? "primary" : "default"}
        variant={todosAtivos ? "filled" : "outlined"}
        sx={{ fontWeight: 600, borderRadius: "999px" }}
      />
      {ATALHOS.map((chave) => {
        const { label, cor } = CATEGORIAS[chave]
        const ativo = !todosAtivos && categoriasAtivas.has(chave) && categoriasAtivas.size === 1
        return (
          <Chip
            key={chave}
            label={label}
            size="small"
            onClick={() => onSelecionar(chave)}
            variant={ativo ? "filled" : "outlined"}
            sx={{
              fontWeight: 600,
              borderRadius: "999px",
              borderColor: cor,
              color: ativo ? "#fff" : cor,
              bgcolor: ativo ? cor : "transparent",
              "&:hover": { bgcolor: ativo ? cor : `${cor}1a` },
            }}
          />
        )
      })}
    </Box>
  )
}
