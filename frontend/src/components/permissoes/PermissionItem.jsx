/**
 * Uma unica acao dentro de um recurso (ex.: "Visualizar" em "Clientes").
 * Responsabilidade unica: exibir a checkbox e notificar o toggle.
 */
import { FormControlLabel, Checkbox } from "@mui/material"

export default function PermissionItem({ chave, rotulo, marcado, onToggle }) {
  return (
    <FormControlLabel
      control={<Checkbox size="small" checked={marcado} onChange={() => onToggle(chave)} />}
      label={rotulo}
      sx={{ ml: 0, width: "100%", "& .MuiFormControlLabel-label": { fontSize: 14 } }}
    />
  )
}
