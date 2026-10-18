/**
 * Os envios em andamento — arquivos soltos na biblioteca ou escolhidos em
 * "Enviar arquivos". Um painel no canto, como o de downloads do navegador:
 * a pessoa continua navegando enquanto os arquivos sobem, e ve na hora qual
 * foi recusado e por que.
 */
import { Box, CircularProgress, IconButton, Paper, Typography } from "@mui/material"
import { CheckCircle, Close, ErrorOutline, Schedule } from "@mui/icons-material"

const ICONES = {
  fila: <Schedule sx={{ fontSize: 18, color: "text.disabled" }} />,
  enviando: <CircularProgress size={16} />,
  ok: <CheckCircle sx={{ fontSize: 18, color: "success.main" }} />,
  erro: <ErrorOutline sx={{ fontSize: 18, color: "error.main" }} />,
}

export default function PainelEnvios({ envios = [], onFechar }) {
  if (!envios.length) return null
  const pendentes = envios.filter((e) => e.estado === "fila" || e.estado === "enviando").length
  const erros = envios.filter((e) => e.estado === "erro").length
  const titulo = pendentes
    ? `Enviando ${envios.length - pendentes + 1} de ${envios.length}…`
    : erros
      ? `${envios.length - erros} de ${envios.length} enviados`
      : envios.length === 1
        ? "Arquivo enviado"
        : `${envios.length} arquivos enviados`

  return (
    <Paper
      elevation={8}
      role="status"
      aria-live="polite"
      sx={{
        position: "fixed",
        right: { xs: 8, sm: 24 },
        bottom: { xs: 8, sm: 24 },
        width: { xs: "calc(100% - 16px)", sm: 360 },
        zIndex: (t) => t.zIndex.snackbar - 1,
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", px: 2, py: 1.25, borderBottom: 1, borderColor: "divider" }}>
        <Typography sx={{ flex: 1, fontWeight: 700, fontSize: 14 }}>{titulo}</Typography>
        {!pendentes && (
          <IconButton size="small" onClick={onFechar} aria-label="Fechar">
            <Close fontSize="small" />
          </IconButton>
        )}
      </Box>
      <Box sx={{ maxHeight: 240, overflowY: "auto", py: 0.5 }}>
        {envios.map((e) => (
          <Box key={e.id} sx={{ display: "flex", alignItems: "flex-start", gap: 1.25, px: 2, py: 0.75 }}>
            <Box sx={{ width: 18, display: "grid", placeItems: "center", pt: 0.25 }}>{ICONES[e.estado]}</Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" noWrap>
                {e.nome}
              </Typography>
              {e.erro && (
                <Typography variant="caption" color="error" sx={{ display: "block" }}>
                  {e.erro}
                </Typography>
              )}
            </Box>
          </Box>
        ))}
      </Box>
    </Paper>
  )
}
