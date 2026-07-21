/**
 * CalendarFilters - chips de filtro rapido acima do calendario.
 * Atualizam a visualizacao instantaneamente (reaproveita categoriasAtivas).
 */
import { Box, Chip } from "@mui/material"
import { useCategorias } from "./categorias"

// Quantos chips de atalho cabem antes da barra virar uma lista. Eram seis
// chaves fixas ("MENTORIA", "EVENTO"...); com categorias configuraveis isso
// quebrava de duas formas na incubadora que personalizasse as suas — as chaves
// dela nao apareceriam, e uma categoria removida derrubava o componente ao
// desestruturar `undefined`. Agora sao as primeiras da ordem que o admin
// definiu, que e justamente onde ele poe o que mais usa.
const MAX_ATALHOS = 6

export default function CalendarFilters({ categoriasAtivas, onSelecionar }) {
  const { categorias } = useCategorias()
  const atalhos = categorias.slice(0, MAX_ATALHOS)
  const todosAtivos = categoriasAtivas.size === categorias.length

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
      {atalhos.map(({ chave, rotulo, cor }) => {
        const ativo = !todosAtivos && categoriasAtivas.has(chave) && categoriasAtivas.size === 1
        return (
          <Chip
            key={chave}
            label={rotulo}
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
