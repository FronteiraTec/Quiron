/**
 * Tela de troca obrigatoria de senha no primeiro acesso.
 *
 * Exibida quando o usuario entra com uma senha PROVISORIA criada pelo root/
 * admin (usuario.deve_redefinir_senha === true). So permite prosseguir apos
 * definir uma nova senha valida.
 */
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Box,
  TextField,
  Button,
  Alert,
  Collapse,
  CircularProgress,
  InputAdornment,
  IconButton,
} from "@mui/material"
import { Visibility, VisibilityOff, LockOutlined } from "@mui/icons-material"
import { useAuthStore } from "../store/authStore"
import AuthLayout from "../components/AuthLayout"

export default function DefinirSenha() {
  const navigate = useNavigate()
  const definirNovaSenha = useAuthStore((s) => s.definirNovaSenha)

  const [senha, setSenha] = useState("")
  const [confirmar, setConfirmar] = useState("")
  const [mostrar, setMostrar] = useState(false)
  const [erro, setErro] = useState("")
  const [carregando, setCarregando] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErro("")

    if (senha.length < 6) {
      setErro("A nova senha deve ter ao menos 6 caracteres.")
      return
    }
    if (senha !== confirmar) {
      setErro("As senhas não conferem.")
      return
    }

    setCarregando(true)
    try {
      await definirNovaSenha(senha)
      navigate("/") // senha trocada: segue para o dashboard
    } catch (err) {
      setErro(err.response?.data?.erro || "Não foi possível definir a senha.")
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
    <AuthLayout
      titulo="Defina sua senha"
      subtitulo="Este é seu primeiro acesso. Crie uma nova senha para continuar."
    >
      <Collapse in={Boolean(erro)}>
        <Alert severity="error" sx={{ mb: 2, borderRadius: 0 }}>
          {erro}
        </Alert>
      </Collapse>

      <Box component="form" onSubmit={handleSubmit} noValidate>
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
          {carregando ? "Salvando..." : "Definir senha e entrar"}
        </Button>
      </Box>
    </AuthLayout>
  )
}
