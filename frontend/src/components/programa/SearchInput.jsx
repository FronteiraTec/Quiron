/**
 * Campo de busca da arvore, com icone e botao de limpar. Estilo pill discreto,
 * anima o foco com um anel colorido.
 */
import { Box, InputBase, IconButton } from "@mui/material"
import { Search, Close } from "@mui/icons-material"

export default function SearchInput({ value, onChange, placeholder = "Buscar na árvore…" }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 1.25,
        py: 0.5,
        borderRadius: "6px",
        bgcolor: "action.hover",
        border: "1px solid transparent",
        transition: "border-color .15s",
        "&:focus-within": {
          borderColor: "primary.main",
          bgcolor: "background.paper",
        },
      }}
    >
      <Search sx={{ fontSize: 18, color: "text.secondary" }} />
      <InputBase
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        sx={{ flex: 1, fontSize: 13.5 }}
      />
      {value && (
        <IconButton size="small" onClick={() => onChange("")} sx={{ p: 0.25 }}>
          <Close sx={{ fontSize: 15 }} />
        </IconButton>
      )}
    </Box>
  )
}
