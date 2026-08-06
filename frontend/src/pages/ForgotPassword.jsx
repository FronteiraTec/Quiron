/**
 * Tela "Esqueci minha senha".
 *
 * Pede o email e chama POST /auth/forgot-password. A resposta e sempre
 * generica (nao revela se o email existe), entao mostramos uma confirmacao
 * independentemente do resultado.
 */
import { useState } from "react"
import { Link as RouterLink } from "react-router-dom"
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Link,
} from "@mui/material"
import { EmailOutlined } from "@mui/icons-material"
import api from "../services/api"

export default function ForgotPassword() {
  const [email, setEmail] = useState("")
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState("")
  const [carregando, setCarregando] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErro("")
    setCarregando(true)
    try {
      await api.post("/auth/forgot-password", { email })
      setEnviado(true)
    } catch (err) {
      setErro(err.response?.data?.erro || "Não foi possível enviar o email.")
    } finally {
      setCarregando(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "#f5f7fb",
        p: 2,
      }}
    >
      <Paper elevation={0} sx={{ p: 4, width: "100%", maxWidth: 400, borderRadius: 0, border: "1px solid", borderColor: "divider" }}>
        <Box sx={{ textAlign: "center", mb: 3 }}>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              bgcolor: "primary.main",
              color: "#fff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              mb: 1,
            }}
          >
            <EmailOutlined />
          </Box>
          <Typography variant="h5" fontWeight={700}>
            Recuperar senha
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Enviaremos um link de redefinição para o seu email
          </Typography>
        </Box>

        {enviado ? (
          <>
            <Alert severity="success" sx={{ mb: 2 }}>
              Se o email estiver cadastrado, você receberá um link para redefinir a senha.
            </Alert>
            <Button component={RouterLink} to="/login" fullWidth>
              Voltar ao login
            </Button>
          </>
        ) : (
          <Box component="form" onSubmit={handleSubmit} noValidate>
            {erro && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {erro}
              </Alert>
            )}
            <TextField
              label="Email"
              type="email"
              fullWidth
              required
              margin="normal"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={carregando}
              sx={{ mt: 3 }}
            >
              {carregando ? <CircularProgress size={24} color="inherit" /> : "Enviar link"}
            </Button>
            <Box sx={{ textAlign: "center", mt: 2 }}>
              <Link component={RouterLink} to="/login" variant="body2">
                Voltar ao login
              </Link>
            </Box>
          </Box>
        )}
      </Paper>
    </Box>
  )
}
