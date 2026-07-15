/**
 * Dialogo de confirmacao de exclusao. Generico: recebe titulo, mensagem e o
 * rotulo/severidade do botao de confirmar. Animacao de entrada suave.
 */
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Box,
} from "@mui/material"
import { WarningAmberRounded } from "@mui/icons-material"
import { motion } from "framer-motion"

export default function ConfirmDialog({
  aberto,
  titulo = "Confirmar exclusao",
  mensagem,
  confirmarTexto = "Excluir",
  onConfirmar,
  onCancelar,
}) {
  return (
    <Dialog
      open={aberto}
      onClose={onCancelar}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        component: motion.div,
        initial: { opacity: 0, scale: 0.95, y: 10 },
        animate: { opacity: 1, scale: 1, y: 0 },
        transition: { duration: 0.2 },
        sx: { borderRadius: "10px", p: 1 },
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "center", pt: 2 }}>
        <Box
          sx={{
            display: "grid",
            placeItems: "center",
            width: 52,
            height: 52,
            borderRadius: "10px",
            bgcolor: "error.main",
            color: "error.contrastText",
            opacity: 0.9,
          }}
        >
          <WarningAmberRounded />
        </Box>
      </Box>
      <DialogTitle sx={{ textAlign: "center", pb: 0.5 }}>{titulo}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ textAlign: "center" }}>{mensagem}</DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onCancelar} fullWidth sx={{ textTransform: "none" }}>
          Cancelar
        </Button>
        <Button
          onClick={onConfirmar}
          fullWidth
          variant="contained"
          color="error"
          sx={{ textTransform: "none", boxShadow: "none" }}
        >
          {confirmarTexto}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
