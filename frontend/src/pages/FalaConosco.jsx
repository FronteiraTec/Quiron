/**
 * Tela "Fala Conosco".
 *
 * Mostra os canais de contato (Instagram e WhatsApp) da FronteiraTec e da
 * INNE. Aberta pelo item "Conversar conosco" do UserPanel (avatar da Navbar).
 */
import { Box, Paper, Grid, Typography, Stack, Button } from "@mui/material"
import { Instagram, WhatsApp } from "@mui/icons-material"
import AppLayout from "../components/AppLayout"

const CANAIS = [
  {
    nome: "FronteiraTec",
    instagram: { arroba: "@fronteira_tec", url: "https://instagram.com/fronteira_tec" },
    whatsapp: { rotulo: "(49) 8893-5115", url: "https://wa.me/554988935115" },
  },
  {
    nome: "INNE",
    instagram: { arroba: "@inneuffs", url: "https://instagram.com/inneuffs" },
    whatsapp: { rotulo: "(49) 2049-6549", url: "https://wa.me/554920496549" },
  },
]

function CartaoContato({ canal }) {
  return (
    <Grid item xs={12} sm={6}>
      <Paper sx={{ p: 3, borderRadius: 0, height: "100%" }}>
        <Typography variant="h6" fontWeight={700} gutterBottom>
          {canal.nome}
        </Typography>
        <Stack spacing={1.5} sx={{ mt: 2 }}>
          <Button
            component="a"
            href={canal.instagram.url}
            target="_blank"
            rel="noopener noreferrer"
            variant="outlined"
            startIcon={<Instagram />}
            sx={{ justifyContent: "flex-start" }}
          >
            {canal.instagram.arroba}
          </Button>
          <Button
            component="a"
            href={canal.whatsapp.url}
            target="_blank"
            rel="noopener noreferrer"
            variant="outlined"
            startIcon={<WhatsApp />}
            sx={{ justifyContent: "flex-start" }}
          >
            {canal.whatsapp.rotulo}
          </Button>
        </Stack>
      </Paper>
    </Grid>
  )
}

export default function FalaConosco() {
  return (
    <AppLayout>
      <Box>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Fala Conosco
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Canais de contato da FronteiraTec e da INNE.
        </Typography>

        <Grid container data-tour="fala-conosco-canais" spacing={2}>
          {CANAIS.map((canal) => (
            <CartaoContato key={canal.nome} canal={canal} />
          ))}
        </Grid>
      </Box>
    </AppLayout>
  )
}
