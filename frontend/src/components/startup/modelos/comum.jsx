/**
 * Pecas compartilhadas entre os modelos (Canvas, GUT e 5W2H):
 * toast de feedback, empty state, dialogo de confirmacao e as faixas de
 * prioridade da matriz GUT (cores validadas para acessibilidade em tema
 * claro e escuro).
 */
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Snackbar, Typography } from "@mui/material"
import { alpha } from "@mui/material/styles"

/**
 * Faixas de prioridade da GUT (prioridade = G x U x T, de 1 a 125).
 * As cores foram validadas contra as superficies clara (#fff) e escura
 * (#1e293b) para separacao em daltonismo; o valor numerico e o rotulo
 * sempre acompanham a cor, que nunca e o unico canal de informacao.
 */
const FAIXAS = [
  { min: 60, rotulo: "Crítica", corClaro: "#991b1b", corEscuro: "#ef4444" },
  { min: 40, rotulo: "Alta", corClaro: "#c2410c", corEscuro: "#c2410c" },
  { min: 20, rotulo: "Média", corClaro: "#ca8a04", corEscuro: "#bd8103" },
  { min: 0, rotulo: "Baixa", corClaro: "#16a34a", corEscuro: "#16a34a" },
]

/** Resolve a faixa (cor + rotulo) de uma prioridade GUT no tema atual. */
export function faixaPrioridade(prioridade, modo = "light") {
  const faixa = FAIXAS.find((f) => prioridade >= f.min) || FAIXAS[FAIXAS.length - 1]
  return { rotulo: faixa.rotulo, cor: modo === "dark" ? faixa.corEscuro : faixa.corClaro }
}

/** Legenda das faixas, da menor para a maior prioridade. */
export function legendaFaixas(modo = "light") {
  return [...FAIXAS]
    .reverse()
    .map((f, i, arr) => ({
      rotulo: f.rotulo,
      cor: modo === "dark" ? f.corEscuro : f.corClaro,
      intervalo: i === arr.length - 1 ? `${f.min}+` : `${f.min}–${arr[i + 1].min}`,
    }))
}

/** Toast padrao (Snackbar + Alert) usado apos salvar, criar e excluir. */
export function ToastFeedback({ toast, onFechar }) {
  return (
    <Snackbar
      open={Boolean(toast)}
      autoHideDuration={3000}
      onClose={onFechar}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
    >
      {toast ? (
        <Alert
          severity={toast.tipo || "success"}
          variant="filled"
          onClose={onFechar}
          sx={{ borderRadius: 2, boxShadow: 4 }}
        >
          {toast.texto}
        </Alert>
      ) : (
        <span />
      )}
    </Snackbar>
  )
}

/** Empty state ilustrado com chamada para a primeira acao. */
export function EmptyState({ icone: Icone, titulo, descricao, rotuloAcao, onAcao }) {
  return (
    <Box
      sx={{
        textAlign: "center",
        py: 8,
        px: 3,
        borderRadius: 0,
        border: (t) => `1.5px dashed ${alpha(t.palette.primary.main, 0.3)}`,
        bgcolor: (t) => alpha(t.palette.primary.main, 0.03),
      }}
    >
      {Icone && (
        <Box
          sx={{
            width: 64,
            height: 64,
            mx: "auto",
            mb: 2,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
            color: "primary.main",
          }}
        >
          <Icone sx={{ fontSize: 32 }} />
        </Box>
      )}
      <Typography variant="h6" fontWeight={700} gutterBottom>
        {titulo}
      </Typography>
      <Typography color="text.secondary" sx={{ maxWidth: 420, mx: "auto", mb: 3 }}>
        {descricao}
      </Typography>
      {rotuloAcao && (
        <Button variant="contained" size="large" onClick={onAcao} sx={{ textTransform: "none", px: 4 }}>
          {rotuloAcao}
        </Button>
      )}
    </Box>
  )
}

/** Dialogo de confirmacao de exclusao (substitui o window.confirm). */
export function DialogConfirmar({ aberto, titulo, descricao, onConfirmar, onCancelar }) {
  return (
    <Dialog open={aberto} onClose={onCancelar} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{titulo}</DialogTitle>
      <DialogContent>
        <Typography color="text.secondary">{descricao}</Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancelar} sx={{ textTransform: "none" }}>
          Cancelar
        </Button>
        <Button variant="contained" color="error" onClick={onConfirmar} sx={{ textTransform: "none" }}>
          Excluir
        </Button>
      </DialogActions>
    </Dialog>
  )
}
