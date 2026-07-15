/**
 * Placeholder - pagina generica "em construcao".
 *
 * Usada temporariamente pelas rotas do menu que ainda nao tem tela propria.
 * Descobre o titulo/icone a partir do menuConfig (pela rota atual) para o
 * cabecalho ficar coerente com o item selecionado na Sidebar.
 */
import { useLocation } from "react-router-dom"
import { Box, Paper, Typography } from "@mui/material"
import { Construction } from "@mui/icons-material"
import AppLayout from "../components/AppLayout"
import {
  menuPorPapel,
  achatarMenu,
} from "../components/sidebar/menuConfig"

// Junta os itens de todos os papeis para achar o titulo por rota.
const TODOS = ["admin", "mentor", "usuario"].flatMap((p) => achatarMenu(menuPorPapel(p)))

function tituloDaRota(pathname) {
  const item = TODOS.find((i) => i.rota === pathname)
  if (item) return item.grupoTexto ? `${item.grupoTexto} · ${item.texto}` : item.texto
  return pathname
}

export default function Placeholder() {
  const { pathname } = useLocation()
  const titulo = tituloDaRota(pathname)

  return (
    <AppLayout>
      <Box sx={{ maxWidth: 1100, mx: "auto" }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          {titulo}
        </Typography>
        <Paper
          sx={{
            p: 6,
            borderRadius: 3,
            mt: 2,
            textAlign: "center",
            color: "text.secondary",
            border: (t) => `1px dashed ${t.palette.divider}`,
          }}
        >
          <Construction sx={{ fontSize: 56, mb: 1, opacity: 0.6 }} />
          <Typography variant="h6">Tela em construcao</Typography>
          <Typography variant="body2">
            Esta secao ({pathname}) ainda nao foi implementada.
          </Typography>
        </Paper>
      </Box>
    </AppLayout>
  )
}
