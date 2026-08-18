/**
 * Tela de Login.
 *
 * Formulario (email + senha) que chama a acao de login do authStore.
 * Em caso de sucesso, redireciona para o dashboard; em caso de erro,
 * exibe a mensagem retornada pelo backend.
 *
 * A moldura (marca, logo, cartao) vem do AuthLayout, compartilhado com as
 * demais telas de autenticacao.
 */
import { useState } from "react"
import { useNavigate, Link as RouterLink } from "react-router-dom"
import {
  Box,
  TextField,
  Button,
  Alert,
  Collapse,
  CircularProgress,
  InputAdornment,
  IconButton,
  Tooltip,
  Link,
} from "@mui/material"
import {
  Visibility,
  VisibilityOff,
  MailOutlined,
  LockOutlined,
  KeyboardCapslockOutlined,
} from "@mui/icons-material"
import { useAuthStore } from "../store/authStore"
import AuthLayout from "../components/AuthLayout"

export default function Login() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)

  // Estado do formulario.
  const [email, setEmail] = useState("")
  const [senha, setSenha] = useState("")
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
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
      // Email copiado de outro lugar costuma vir com espaco sobrando; o
      // backend compara a string crua e recusaria um login valido.
      const { usuario } = await login(email.trim(), senha)
      // Senha provisoria: forca a troca antes de entrar no sistema.
      if (usuario?.deve_redefinir_senha) {
        navigate("/definir-senha")
      } else {
        navigate("/") // vai para o dashboard (rota protegida)
      }
    } catch (err) {
      // Usa a mensagem do backend ou uma generica.
      setErro(err.response?.data?.erro || "Não foi possível entrar. Tente novamente.")
    } finally {
      setCarregando(false)
    }
  }

  /**
   * Caps Lock ligado e a causa mais comum de "minha senha nao funciona".
   * O estado da tecla so e legivel a partir de um evento de teclado.
   */
  const verificarCapsLock = (e) => setCapsLock(e.getModifierState?.("CapsLock") ?? false)

  return (
    <AuthLayout titulo="Entrar" subtitulo="Acesse sua conta para continuar">
      {/* Mensagem de erro */}
      <Collapse in={Boolean(erro)}>
        <Alert severity="error" sx={{ mb: 2, borderRadius: 0 }}>
          {erro}
        </Alert>
      </Collapse>

      {/* Formulario */}
      <Box component="form" onSubmit={handleSubmit} noValidate>
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

        <TextField
          label="Senha"
          type={mostrarSenha ? "text" : "password"}
          fullWidth
          required
          margin="normal"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          onKeyUp={verificarCapsLock}
          onKeyDown={verificarCapsLock}
          onBlur={() => setCapsLock(false)}
          autoComplete="current-password"
          disabled={carregando}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <LockOutlined fontSize="small" color="action" />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                {capsLock && (
                  <Tooltip title="Caps Lock está ligado" arrow>
                    <KeyboardCapslockOutlined fontSize="small" color="warning" />
                  </Tooltip>
                )}
                <IconButton
                  onClick={() => setMostrarSenha((v) => !v)}
                  edge="end"
                  aria-label={mostrarSenha ? "ocultar senha" : "mostrar senha"}
                >
                  {mostrarSenha ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <Box sx={{ textAlign: "right", mt: 1 }}>
          <Link component={RouterLink} to="/forgot-password" variant="body2" underline="hover">
            Esqueci minha senha
          </Link>
        </Box>

        <Button
          type="submit"
          variant="contained"
          fullWidth
          size="large"
          disableElevation
          disabled={carregando || !email.trim() || !senha}
          sx={{ mt: 3, borderRadius: 0, py: 1.25, fontWeight: 600 }}
          startIcon={carregando ? <CircularProgress size={18} color="inherit" /> : null}
        >
          {carregando ? "Entrando..." : "Entrar"}
        </Button>
      </Box>
    </AuthLayout>
  )
}
