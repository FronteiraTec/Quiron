/**
 * Pecas compartilhadas entre os modelos (Canvas, SWOT, GUT e 5W2H):
 * toast de feedback, empty state, dialogo de confirmacao, os indicadores do
 * salvamento automatico e o conteudo do popover de ajuda dos modelos de texto
 * livre, e as faixas de prioridade da matriz GUT (cores validadas para
 * acessibilidade em tema claro e escuro).
 */
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Snackbar,
  Typography,
} from "@mui/material"
import { alpha } from "@mui/material/styles"
import CloudDoneOutlinedIcon from "@mui/icons-material/CloudDoneOutlined"
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined"
import CheckRoundedIcon from "@mui/icons-material/CheckRounded"
import TipsAndUpdatesOutlinedIcon from "@mui/icons-material/TipsAndUpdatesOutlined"

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

/** Chip do cabecalho com o estado geral do salvamento automatico. */
export function IndicadorAutoSave({ salvando, comErro }) {
  if (comErro) {
    return (
      <Chip
        size="small"
        icon={<CloudOffOutlinedIcon />}
        label="Erro ao salvar — revise sua conexão"
        color="warning"
        variant="outlined"
      />
    )
  }
  if (salvando) {
    return (
      <Chip
        size="small"
        icon={<CircularProgress size={12} thickness={5} sx={{ ml: 0.5 }} />}
        label="Salvando..."
        variant="outlined"
        sx={{ color: "text.secondary" }}
      />
    )
  }
  return (
    <Chip
      size="small"
      icon={<CloudDoneOutlinedIcon sx={{ fontSize: 16 }} />}
      label="Salvo automaticamente"
      variant="outlined"
      sx={{ color: "success.main", borderColor: (t) => alpha(t.palette.success.main, 0.4), "& .MuiChip-icon": { color: "success.main" } }}
    />
  )
}

/** Status do salvamento de um bloco, no rodape dele. */
export function StatusBloco({ status }) {
  if (status === "saving") {
    return (
      <Typography variant="caption" color="text.disabled" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <CircularProgress size={10} thickness={5} /> salvando
      </Typography>
    )
  }
  if (status === "saved") {
    return (
      <Typography variant="caption" color="success.main" sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
        <CheckRoundedIcon sx={{ fontSize: 13 }} /> salvo
      </Typography>
    )
  }
  if (status === "error") {
    return (
      <Typography variant="caption" color="error.main">
        erro ao salvar
      </Typography>
    )
  }
  return null
}

/**
 * Conteudo do popover de ajuda de um bloco: o que e, exemplos reais, erros
 * comuns e uma dica pratica (`bloco.titulo` + `bloco.ajuda`).
 */
export function ConteudoAjuda({ bloco }) {
  return (
    <>
      <Typography variant="subtitle2" fontWeight={700} gutterBottom>
        {bloco.titulo}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {bloco.ajuda.oQueE}
      </Typography>

      <Typography variant="caption" fontWeight={700} color="text.primary">
        Exemplos reais
      </Typography>
      <Box component="ul" sx={{ m: 0, mb: 1.5, pl: 2.25 }}>
        {bloco.ajuda.exemplos.map((ex) => (
          <Typography key={ex} component="li" variant="caption" color="text.secondary" sx={{ lineHeight: 1.7 }}>
            {ex}
          </Typography>
        ))}
      </Box>

      <Typography variant="caption" fontWeight={700} color="text.primary">
        Erros comuns
      </Typography>
      <Box component="ul" sx={{ m: 0, mb: 1.5, pl: 2.25 }}>
        {bloco.ajuda.errosComuns.map((erro) => (
          <Typography key={erro} component="li" variant="caption" color="text.secondary" sx={{ lineHeight: 1.7 }}>
            {erro}
          </Typography>
        ))}
      </Box>

      <Box
        sx={{
          display: "flex",
          gap: 1,
          p: 1.25,
          borderRadius: 2,
          bgcolor: (t) => alpha(t.palette.primary.main, 0.06),
        }}
      >
        <TipsAndUpdatesOutlinedIcon sx={{ fontSize: 18, color: "primary.main", mt: 0.25 }} />
        <Typography variant="caption" sx={{ lineHeight: 1.6 }}>
          {bloco.ajuda.dica}
        </Typography>
      </Box>
    </>
  )
}
