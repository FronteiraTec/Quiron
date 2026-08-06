/**
 * Cabecalho da area principal: nome/descricao da role selecionada, as
 * contagens de usuarios e permissoes, e as acoes Editar/Excluir.
 */
import { Box, Paper, Typography, Chip, IconButton, Tooltip, Stack } from "@mui/material"
import { Edit, Delete, People, Key } from "@mui/icons-material"

export default function RoleHeader({ role, onEditar, onExcluir }) {
  if (!role) return null

  return (
    <Paper sx={{ borderRadius: 1, p: 3, mb: 3 }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2 }}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="h5" fontWeight={700}>
              {role.nome}
            </Typography>
            {role.sistema && <Chip size="small" label="Role de sistema" />}
          </Stack>
          {role.descricao && (
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              {role.descricao}
            </Typography>
          )}
          <Stack direction="row" spacing={2} sx={{ mt: 1.5 }}>
            <Stack direction="row" alignItems="center" spacing={0.5} color="text.secondary">
              <People fontSize="small" />
              <Typography variant="body2">{role.usuarios?.length ?? 0} usuário(s)</Typography>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={0.5} color="text.secondary">
              <Key fontSize="small" />
              <Typography variant="body2">{role.permissoes?.length ?? 0} permissão(ões)</Typography>
            </Stack>
          </Stack>
        </Box>

        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Editar role">
            <IconButton onClick={onEditar}>
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={role.sistema ? "Roles de sistema não podem ser excluídas" : "Excluir role"}>
            <span>
              <IconButton onClick={onExcluir} disabled={role.sistema} color="error">
                <Delete fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Box>
    </Paper>
  )
}
