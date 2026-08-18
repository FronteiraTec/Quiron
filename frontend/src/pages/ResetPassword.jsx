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
  TextField,
  Button,
  Alert,
  Collapse,
  CircularProgress,
  InputAdornment,
  IconButton,
  Link,
} from "@mui/material"
import { LockOutlined, Visibility, VisibilityOff } from "@mui/icons-material"
import api from "../services/api"
import AuthLayout from "../components/AuthLayout"

export default function ResetPassword() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get("token")

  const [senha, setSenha] = useState("")
  const [confirmar, setConfirmar] = useState("")
  const [mostrar, setMostrar] = useState(false)
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
      setErro("As senhas não conferem.")
      return
    }

    setCarregando(true)
    try {
      await api.post("/auth/reset-password", { token, senha })
      setOk(true)
      // Redireciona ao login apos alguns segundos.
      setTimeout(() => navigate("/login"), 2500)
    } catch (err) {
      setErro(err.response?.data?.erro || "Não foi possível redefinir a senha.")
    } finally {
      setCarregando(false)
    }
  }

  // Adorno compartilhado pelos dois campos: cadeado + olho de mostrar/ocultar.
  const adornos = {
    startAdornment: (
      <InputAdornment position="start">
        <LockOutlined fontSize="small" color="action" />
      </InputAdornment>
    ),
    endAdornment: (
      <InputAdornment position="end">
        <IconButton
          onClick={() => setMostrar((v) => !v)}
          edge="end"
          aria-label={mostrar ? "ocultar senha" : "mostrar senha"}
        >
          {mostrar ? <VisibilityOff /> : <Visibility />}
        </IconButton>
      </InputAdornment>
    ),
  }

  return (
    <AuthLayout titulo="Nova senha" subtitulo="Escolha uma senha com pelo menos 6 caracteres">
      {!token ? (
        <>
          <Alert severity="error" sx={{ mb: 2, borderRadius: 0 }}>
            Link inválido. Solicite uma nova redefinição de senha.
          </Alert>
          <Button
            component={RouterLink}
            to="/forgot-password"
            variant="contained"
            fullWidth
            size="large"
            disableElevation
            sx={{ borderRadius: 0, py: 1.25, fontWeight: 600 }}
          >
            Solicitar novo link
          </Button>
        </>
      ) : ok ? (
        <Alert severity="success" sx={{ borderRadius: 0 }}>
          Senha redefinida com sucesso! Redirecionando para o login...
        </Alert>
      ) : (
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <Collapse in={Boolean(erro)}>
            <Alert severity="error" sx={{ mb: 2, borderRadius: 0 }}>
              {erro}
            </Alert>
          </Collapse>

          <TextField
            label="Nova senha"
            type={mostrar ? "text" : "password"}
            fullWidth
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="new-password"
            autoFocus
            disabled={carregando}
            InputProps={adornos}
          />

          <TextField
            label="Confirmar nova senha"
            type={mostrar ? "text" : "password"}
            fullWidth
            required
            margin="normal"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            autoComplete="new-password"
            disabled={carregando}
            InputProps={adornos}
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disableElevation
            disabled={carregando || !senha || !confirmar}
            sx={{ mt: 3, borderRadius: 0, py: 1.25, fontWeight: 600 }}
            startIcon={carregando ? <CircularProgress size={18} color="inherit" /> : null}
          >
            {carregando ? "Salvando..." : "Redefinir senha"}
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
