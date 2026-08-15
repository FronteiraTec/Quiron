/**
 * Tela "Enviar Feedback".
 *
 * Formulario simples para o usuario mandar uma sugestao, elogio ou problema
 * sobre a plataforma. Aberta pelo item "Enviar Feedback" do UserPanel
 * (avatar da Navbar). Grava em POST /feedback (tabela "feedback").
 */
import { useState } from "react"
import { Box, Paper, Typography, TextField, Button, Alert, CircularProgress } from "@mui/material"
import { Send } from "@mui/icons-material"
import AppLayout from "../components/AppLayout"
import api from "../services/api"
import { useAuthStore } from "../store/authStore"

const MENSAGEM_MAX = 2000

export default function EnviarFeedback() {
  const usuario = useAuthStore((s) => s.usuario)
  const [mensagem, setMensagem] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState(null) // { tipo, texto }

  const enviar = async (e) => {
    e.preventDefault()
    if (!mensagem.trim()) return

    setAviso(null)
    setEnviando(true)
    try {
      await api.post("/feedback", { mensagem, id_tenant: usuario?.id_tenant })
      setMensagem("")
      setAviso({ tipo: "success", texto: "Feedback enviado. Obrigado!" })
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao enviar o feedback." })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <AppLayout>
      <Box>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Enviar Feedback
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Sugestões, elogios ou problemas que você encontrou na plataforma.
        </Typography>

        {aviso && (
          <Alert severity={aviso.tipo} sx={{ mb: 3 }} onClose={() => setAviso(null)}>
            {aviso.texto}
          </Alert>
        )}

        <Paper sx={{ p: 3, borderRadius: 0 }} component="form" onSubmit={enviar}>
          <TextField
            label="Sua mensagem"
            placeholder="Conte o que você gostaria de melhorar, elogiar ou reportar..."
            fullWidth
            required
            multiline
            minRows={6}
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            inputProps={{ maxLength: MENSAGEM_MAX }}
            helperText={`${mensagem.length}/${MENSAGEM_MAX}`}
          />
          <Box sx={{ mt: 2, textAlign: "right" }}>
            <Button
              type="submit"
              variant="contained"
              startIcon={enviando ? undefined : <Send />}
              disabled={enviando || !mensagem.trim()}
            >
              {enviando ? <CircularProgress size={22} color="inherit" /> : "Enviar feedback"}
            </Button>
          </Box>
        </Paper>
      </Box>
    </AppLayout>
  )
}
