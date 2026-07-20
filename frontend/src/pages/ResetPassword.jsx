/**
 * Tela de redefinicao de senha.
 *
 * Le o "token" da query string (?token=...) que veio no link do email e
 * chama POST /auth/reset-password com a nova senha.
 */
import { useState } from "react"
import { useSearchParams, useNavigate, Link as RouterLink } from "react-router-dom"
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
import { LockResetOutlined } from "@mui/icons-material"
import api from "../services/api"

export default function ResetPassword() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get("token")

  const [senha, setSenha] = useState("")
  const [confirmar, setConfirmar] = useState("")
  const [erro, setErro] = useState("")
  const [ok, setOk] = useState(false)
  const [carregando, setCarregando] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErro("")

    // Validacoes basicas no cliente.
    if (senha.length < 6) {
      setErro("A senha deve ter pelo menos 6 caracteres.")
      return
    }
    if (senha !== confirmar) {
      setErro("As senhas nao conferem.")
      return
    }

    setCarregando(true)
    try {
      await api.post("/auth/reset-password", { token, senha })
      setOk(true)
      // Redireciona ao login apos alguns segundos.
      setTimeout(() => navigate("/login"), 2500)
    } catch (err) {
      setErro(err.response?.data?.erro || "Nao foi possivel redefinir a senha.")
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
            <LockResetOutlined />
          </Box>
          <Typography variant="h5" fontWeight={700}>
            Nova senha
          </Typography>
        </Box>

        {!token ? (
          <Alert severity="error">
            Link invalido. Solicite uma nova redefinicao de senha.
          </Alert>
        ) : ok ? (
          <Alert severity="success">
            Senha redefinida com sucesso! Redirecionando para o login...
          </Alert>
        ) : (
          <Box component="form" onSubmit={handleSubmit} noValidate>
            {erro && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {erro}
              </Alert>
            )}
            <TextField
              label="Nova senha"
              type="password"
              fullWidth
              required
              margin="normal"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoFocus
            />
            <TextField
              label="Confirmar nova senha"
              type="password"
              fullWidth
              required
              margin="normal"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={carregando}
              sx={{ mt: 3 }}
            >
              {carregando ? <CircularProgress size={24} color="inherit" /> : "Redefinir senha"}
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
