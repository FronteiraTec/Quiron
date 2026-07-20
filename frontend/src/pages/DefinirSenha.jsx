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
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
} from "@mui/material"
import { Visibility, VisibilityOff, LockReset } from "@mui/icons-material"
import { useAuthStore } from "../store/authStore"

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
      setErro("As senhas nao conferem.")
      return
    }

    setCarregando(true)
    try {
      await definirNovaSenha(senha)
      navigate("/") // senha trocada: segue para o dashboard
    } catch (err) {
      setErro(err.response?.data?.erro || "Nao foi possivel definir a senha.")
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
            <LockReset />
          </Box>
          <Typography variant="h5" fontWeight={700}>
            Defina sua senha
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Este e seu primeiro acesso. Crie uma nova senha para continuar.
          </Typography>
        </Box>

        {erro && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {erro}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} noValidate>
          <TextField
            label="Nova senha"
            type={mostrar ? "text" : "password"}
            fullWidth
            required
            margin="normal"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="new-password"
            autoFocus
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setMostrar((v) => !v)} edge="end" aria-label="mostrar senha">
                    {mostrar ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
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
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={carregando}
            sx={{ mt: 3 }}
          >
            {carregando ? <CircularProgress size={24} color="inherit" /> : "Definir senha e entrar"}
          </Button>
        </Box>
      </Paper>
    </Box>
  )
}
