/**
 * CalendarSearch - campo de busca da sidebar (filtra por titulo/descricao).
 */
import { InputBase, Box } from "@mui/material"
import { Search } from "@mui/icons-material"

export default function CalendarSearch({ valor, onChange }) {
  return (
    <Box
      sx={{
        mx: 2,
        mt: 1.5,
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 1.5,
        py: 0.75,
        borderRadius: "10px",
        bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.04)"),
      }}
    >
      <Search sx={{ fontSize: 18, color: "text.disabled" }} />
      <InputBase
        placeholder="Pesquisar calendarios ou atividades"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        sx={{ fontSize: 13.5, flex: 1 }}
      />
    </Box>
  )
}
