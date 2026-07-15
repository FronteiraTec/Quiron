/**
 * Campo de busca reutilizado nas duas areas da tela de Permissoes: filtrar a
 * lista de roles (RolesSidebar) e filtrar recursos/acoes (PermissionsAccordion).
 * Visual modelado em components/sidebar/SidebarSearch.jsx.
 */
import { Box, InputBase, IconButton } from "@mui/material"
import { Search, Close } from "@mui/icons-material"

export default function SearchPermissions({ valor, onChange, placeholder = "Buscar..." }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 1.5,
        height: 40,
        borderRadius: "6px",
        bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.035)"),
        border: (t) => `1px solid ${t.palette.mode === "dark" ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.07)"}`,
        transition: "box-shadow 180ms ease, border-color 180ms ease, background-color 180ms ease",
        "&:hover": {
          bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)"),
        },
        "&:focus-within": {
          bgcolor: "background.paper",
          borderColor: "primary.main",
          boxShadow: (t) => `0 0 0 3px ${t.palette.primary.main}1a`,
        },
      }}
    >
      <Search fontSize="small" sx={{ color: "text.disabled" }} />
      <InputBase
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputProps={{ "aria-label": placeholder }}
        sx={{ flex: 1, fontSize: 14 }}
      />
      {valor && (
        <IconButton size="small" aria-label="limpar busca" onClick={() => onChange("")}>
          <Close sx={{ fontSize: 16 }} />
        </IconButton>
      )}
    </Box>
  )
}
