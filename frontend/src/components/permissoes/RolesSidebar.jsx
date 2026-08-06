/**
 * Coluna esquerda da tela de Permissoes: busca + lista de roles da
 * incubadora + botao para criar uma nova role. A role selecionada fica
 * destacada (mesmo padrao visual de destaque usado em SidebarItem.jsx).
 */
import { useMemo } from "react"
import { Box, List, ListItemButton, ListItemText, Typography, Button, Chip, alpha } from "@mui/material"
import { Add, VerifiedUser } from "@mui/icons-material"
import SearchPermissions from "./SearchPermissions"

export default function RolesSidebar({ roles, selecionadaId, busca, onBuscar, onSelecionar, onNovaRole }) {
  const rolesFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return roles
    return roles.filter((r) => r.nome.toLowerCase().includes(termo))
  }, [roles, busca])

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
        {onNovaRole && (
          <Button variant="contained" startIcon={<Add />} onClick={onNovaRole} fullWidth>
            Nova role
          </Button>
        )}
        <SearchPermissions valor={busca} onChange={onBuscar} placeholder="Buscar role..." />
      </Box>

      <List sx={{ flex: 1, overflowY: "auto", px: 1, pb: 2 }}>
        {rolesFiltradas.length === 0 ? (
          <Typography color="text.secondary" variant="body2" sx={{ textAlign: "center", py: 4 }}>
            Nenhuma role encontrada.
          </Typography>
        ) : (
          rolesFiltradas.map((r) => (
            <ListItemButton
              key={r.id_role}
              selected={r.id_role === selecionadaId}
              onClick={() => onSelecionar(r.id_role)}
              sx={{
                borderRadius: 1,
                mb: 0.5,
                "&.Mui-selected": {
                  bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === "dark" ? 0.18 : 0.09),
                  "&:hover": { bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === "dark" ? 0.24 : 0.13) },
                },
              }}
            >
              <VerifiedUser
                fontSize="small"
                sx={{ mr: 1.5, color: r.id_role === selecionadaId ? "primary.main" : "text.disabled" }}
              />
              <ListItemText
                primary={r.nome}
                secondary={`${r.total_usuarios} usuário(s) · ${r.total_permissoes} permissão(ões)`}
                primaryTypographyProps={{ fontWeight: r.id_role === selecionadaId ? 700 : 500 }}
                secondaryTypographyProps={{ variant: "caption" }}
              />
              {r.sistema && <Chip size="small" label="Sistema" sx={{ ml: 1 }} />}
            </ListItemButton>
          ))
        )}
      </List>
    </Box>
  )
}
