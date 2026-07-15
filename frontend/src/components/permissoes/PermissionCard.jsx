/**
 * Um recurso dentro de um modulo (ex.: "Clientes"), exibido como um pequeno
 * card contendo suas acoes disponiveis (PermissionItem) + atalho para marcar
 * todas as acoes do recurso de uma vez.
 */
import { Paper, Box, Typography, Button } from "@mui/material"
import PermissionItem from "./PermissionItem"

export default function PermissionCard({ recurso, rotulo, acoes, selecionadas, onToggle, onSelecionarTudo }) {
  const total = acoes.length
  const marcadas = acoes.filter((a) => selecionadas.has(a.chave)).length
  const todasMarcadas = total > 0 && marcadas === total

  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 1,
        p: 2.5,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 1,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
        <Typography fontWeight={600}>{rotulo}</Typography>
        <Button size="small" onClick={() => onSelecionarTudo(recurso, !todasMarcadas)} sx={{ textTransform: "none" }}>
          {todasMarcadas ? "Limpar" : "Marcar todas"}
        </Button>
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column" }}>
        {acoes.map((a) => (
          <PermissionItem
            key={a.chave}
            chave={a.chave}
            rotulo={a.rotulo}
            marcado={selecionadas.has(a.chave)}
            onToggle={onToggle}
          />
        ))}
      </Box>
    </Paper>
  )
}
