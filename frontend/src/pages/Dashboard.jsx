/**
 * Tela inicial (Home / Dashboard).
 *
 * Usa o AppLayout (Navbar + Sidebar) e exibe uma saudacao e cards de resumo.
 * O carregamento do usuario e das preferencias fica a cargo do AppLayout.
 */
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Grid,
  Card,
  CardContent,
} from "@mui/material"
import { People, Business, Assignment } from "@mui/icons-material"
import AppLayout from "../components/AppLayout"
import { useAuthStore } from "../store/authStore"

// Cards de resumo exibidos na tela inicial. Adicione/edite itens aqui.
const RESUMO = [
  { rotulo: "Usuarios", valor: "—", icone: <People fontSize="large" />, cor: "primary.main" },
  { rotulo: "Incubadoras", valor: "—", icone: <Business fontSize="large" />, cor: "secondary.main" },
  { rotulo: "Tarefas", valor: "—", icone: <Assignment fontSize="large" />, cor: "#f59e0b" },
]

export default function Dashboard() {
  const usuario = useAuthStore((s) => s.usuario)

  return (
    <AppLayout>
      {!usuario ? (
        <Box sx={{ textAlign: "center", mt: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box sx={{ maxWidth: 1100, mx: "auto" }}>
          {/* Saudacao */}
          <Paper sx={{ p: 4, borderRadius: 3, mb: 3 }}>
            <Typography variant="h4" fontWeight={700} gutterBottom>
              Bem-vindo{usuario?.nome ? `, ${usuario.nome}` : ""}!
            </Typography>
            <Typography color="text.secondary">
              Este e o painel inicial do Quiron.
              {usuario?.email && ` Voce esta logado como ${usuario.email}.`}
            </Typography>
          </Paper>

          {/* Cards de resumo */}
          <Grid container spacing={3}>
            {RESUMO.map((item) => (
              <Grid item xs={12} sm={6} md={4} key={item.rotulo}>
                <Card sx={{ borderRadius: 3 }}>
                  <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Box
                      sx={{
                        width: 56,
                        height: 56,
                        borderRadius: 2,
                        bgcolor: item.cor,
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {item.icone}
                    </Box>
                    <Box>
                      <Typography variant="h5" fontWeight={700}>
                        {item.valor}
                      </Typography>
                      <Typography color="text.secondary" variant="body2">
                        {item.rotulo}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}
    </AppLayout>
  )
}
