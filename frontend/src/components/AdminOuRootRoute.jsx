/**
 * Rota exclusiva de administradores da propria incubadora ou do usuario ROOT.
 *
 * Fluxo:
 *   - Sem token                    -> /login
 *   - Token, usuario nulo          -> carrega /auth/me e exibe loading
 *   - Usuario nao-root e nao-admin -> volta para a home
 *   - Root ou admin                -> renderiza o conteudo
 */
import { useEffect } from "react"
import { Navigate } from "react-router-dom"
import { Box, CircularProgress } from "@mui/material"
import { useAuthStore } from "../store/authStore"

export default function AdminOuRootRoute({ children }) {
  const token = useAuthStore((s) => s.token)
  const usuario = useAuthStore((s) => s.usuario)
  const carregarUsuario = useAuthStore((s) => s.carregarUsuario)

  // Se temos token mas ainda nao os dados do usuario, busca-os.
  useEffect(() => {
    if (token && !usuario) carregarUsuario().catch(() => {})
  }, [token, usuario, carregarUsuario])

  if (!token) return <Navigate to="/login" replace />

  // Ainda carregando os dados do usuario.
  if (!usuario) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!usuario.root && usuario.papel !== "admin") return <Navigate to="/" replace />

  return children
}
