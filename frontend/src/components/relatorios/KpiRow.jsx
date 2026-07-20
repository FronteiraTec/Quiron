/**
 * Linha de numeros de destaque no topo de um relatorio.
 *
 * Cada card responde uma pergunta inteira sozinho — por isso o rotulo e uma
 * frase e nao um jargao ("startups sem atividade ha 14 dias", nao "inativas").
 * A tabela abaixo detalha; estes numeros existem para quem so vai olhar cinco
 * segundos.
 *
 * O valor fica sempre em cor de texto. Quando um card representa um estado
 * ruim, quem carrega o alerta e a faixa colorida + o icone + o rotulo — nunca
 * a cor sozinha, que some para quem nao a distingue.
 */
import { Box, Paper, Typography, Grid, Tooltip } from "@mui/material"
import { InfoOutlined } from "@mui/icons-material"

/**
 * @param {object} props
 * @param {Array<{
 *   rotulo: string, valor: React.ReactNode, sufixo?: string,
 *   cor?: string, icone?: React.ReactNode, ajuda?: string
 * }>} props.itens
 */
export default function KpiRow({ itens }) {
  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      {itens.map((item) => (
        <Grid item xs={6} sm={4} md key={item.rotulo}>
          <Paper
            sx={{
              borderRadius: 0,
              p: 2,
              height: "100%",
              // Faixa lateral: o sinal de estado que sobrevive em preto e
              // branco, porque e posicao alem de cor.
              borderLeft: item.cor ? "4px solid" : "4px solid transparent",
              borderLeftColor: item.cor || "transparent",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
              {item.icone && (
                <Box sx={{ display: "flex", color: item.cor || "text.secondary" }}>
                  {item.icone}
                </Box>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3 }}>
                {item.rotulo}
              </Typography>
              {item.ajuda && (
                <Tooltip title={item.ajuda}>
                  <InfoOutlined sx={{ fontSize: 14, color: "text.disabled", flexShrink: 0 }} />
                </Tooltip>
              )}
            </Box>

            <Typography variant="h4" fontWeight={700} sx={{ lineHeight: 1.1 }}>
              {item.valor}
              {item.sufixo && (
                <Typography component="span" variant="h6" color="text.secondary">
                  {item.sufixo}
                </Typography>
              )}
            </Typography>
          </Paper>
        </Grid>
      ))}
    </Grid>
  )
}
