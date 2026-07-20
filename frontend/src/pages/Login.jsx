/**
 * Tela de Login.
 *
 * Formulario (email + senha) que chama a acao de login do authStore.
 * Em caso de sucesso, redireciona para o dashboard; em caso de erro,
 * exibe a mensagem retornada pelo backend.
 */
import { useState } from "react"
import { useNavigate, Link as RouterLink } from "react-router-dom"
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
  Link,
} from "@mui/material"
import { Visibility, VisibilityOff, LockOutlined } from "@mui/icons-material"
import { useAuthStore } from "../store/authStore"

export default function Login() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)

  // Estado do formulario.
  const [email, setEmail] = useState("")
  const [senha, setSenha] = useState("")
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [erro, setErro] = useState("")
  const [carregando, setCarregando] = useState(false)

  /**
   * Envia o formulario: autentica e redireciona.
   */
  const handleSubmit = async (e) => {
    e.preventDefault()
    setErro("")
    setCarregando(true)

    try {
      const { usuario } = await login(email, senha)
      // Senha provisoria: forca a troca antes de entrar no sistema.
      if (usuario?.deve_redefinir_senha) {
        navigate("/definir-senha")
      } else {
        navigate("/") // vai para o dashboard (rota protegida)
      }
    } catch (err) {
      // Usa a mensagem do backend ou uma generica.
      setErro(err.response?.data?.erro || "Nao foi possivel entrar. Tente novamente.")
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
        {/* Cabecalho */}
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
            <LockOutlined />
          </Box>
          <Typography variant="h5" fontWeight={700}>
            Quiron
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Acesse sua conta
          </Typography>
        </Box>

        {/* Mensagem de erro */}
        {erro && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {erro}
          </Alert>
        )}

        {/* Formulario */}
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <TextField
            label="Email"
            type="email"
            fullWidth
            required
            margin="normal"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoFocus
          />

          <TextField
            label="Senha"
            type={mostrarSenha ? "text" : "password"}
            fullWidth
            required
            margin="normal"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="current-password"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setMostrarSenha((v) => !v)}
                    edge="end"
                    aria-label="mostrar senha"
                  >
                    {mostrarSenha ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={carregando}
            sx={{ mt: 3 }}
          >
            {carregando ? <CircularProgress size={24} color="inherit" /> : "Entrar"}
          </Button>

          <Box sx={{ textAlign: "center", mt: 2 }}>
            <Link component={RouterLink} to="/forgot-password" variant="body2">
              Esqueci minha senha
            </Link>
          </Box>
        </Box>
      </Paper>
    </Box>
  )
}
