/**
 * Barra de acoes acima do accordion de permissoes: selecionar/limpar tudo e
 * salvar as alteracoes pendentes da role selecionada.
 */
import { Box, Button, CircularProgress, Typography } from "@mui/material"
import { DoneAll, ClearAll, Save } from "@mui/icons-material"

export default function RoleActions({ temAlteracoes, salvando, onSelecionarTudo, onLimparTudo, onSalvar }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, flexWrap: "wrap", gap: 1 }}>
      <Box sx={{ display: "flex", gap: 1 }}>
        <Button size="small" startIcon={<DoneAll />} onClick={onSelecionarTudo} sx={{ textTransform: "none" }}>
          Selecionar todas
        </Button>
        <Button size="small" startIcon={<ClearAll />} onClick={onLimparTudo} sx={{ textTransform: "none" }}>
          Limpar seleção
        </Button>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        {temAlteracoes && (
          <Typography variant="caption" color="text.secondary">
            Alterações não salvas
          </Typography>
        )}
        <Button
          variant="contained"
          startIcon={salvando ? <CircularProgress size={16} color="inherit" /> : <Save />}
          disabled={!temAlteracoes || salvando}
          onClick={onSalvar}
        >
          Salvar alterações
        </Button>
      </Box>
    </Box>
  )
}
