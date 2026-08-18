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
  TextField,
  Button,
  Alert,
  Collapse,
  CircularProgress,
  InputAdornment,
  Link,
} from "@mui/material"
import { MailOutlined } from "@mui/icons-material"
import api from "../services/api"
import AuthLayout from "../components/AuthLayout"

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
      await api.post("/auth/forgot-password", { email: email.trim() })
      setEnviado(true)
    } catch (err) {
      setErro(err.response?.data?.erro || "Não foi possível enviar o email.")
    } finally {
      setCarregando(false)
    }
  }

  return (
    <AuthLayout
      titulo="Recuperar senha"
      subtitulo="Enviaremos um link de redefinição para o seu email"
    >
      {enviado ? (
        <>
          <Alert severity="success" sx={{ mb: 2, borderRadius: 0 }}>
            Se o email estiver cadastrado, você receberá um link para redefinir a senha.
          </Alert>
          <Button
            component={RouterLink}
            to="/login"
            variant="contained"
            fullWidth
            size="large"
            disableElevation
            sx={{ borderRadius: 0, py: 1.25, fontWeight: 600 }}
          >
            Voltar ao login
          </Button>
        </>
      ) : (
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <Collapse in={Boolean(erro)}>
            <Alert severity="error" sx={{ mb: 2, borderRadius: 0 }}>
              {erro}
            </Alert>
          </Collapse>

          <TextField
            label="Email"
            type="email"
            fullWidth
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoFocus
            disabled={carregando}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <MailOutlined fontSize="small" color="action" />
                </InputAdornment>
              ),
            }}
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disableElevation
            disabled={carregando || !email.trim()}
            sx={{ mt: 3, borderRadius: 0, py: 1.25, fontWeight: 600 }}
            startIcon={carregando ? <CircularProgress size={18} color="inherit" /> : null}
          >
            {carregando ? "Enviando..." : "Enviar link"}
          </Button>

          <Box sx={{ textAlign: "center", mt: 2 }}>
            <Link component={RouterLink} to="/login" variant="body2" underline="hover">
              Voltar ao login
            </Link>
          </Box>
        </Box>
      )}
    </AuthLayout>
  )
}
