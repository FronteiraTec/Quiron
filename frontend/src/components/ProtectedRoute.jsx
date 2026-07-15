/**
 * Rota protegida.
 *
 * Fluxo:
 *   - Sem token                         -> /login
 *   - Token, usuario ainda nao carregado -> carrega /auth/me e exibe loading
 *   - Usuario com senha provisoria        -> /definir-senha (troca obrigatoria)
 *   - Caso contrario                      -> renderiza o conteudo
 *
 * A prop `ignorarRedefinicao` desativa o redirecionamento para /definir-senha
 * (usada justamente pela propria tela de definir senha, para evitar loop).
 */
import { useEffect } from "react"
import { Navigate } from "react-router-dom"
import { Box, CircularProgress } from "@mui/material"
import { useAuthStore } from "../store/authStore"

export default function ProtectedRoute({ children, ignorarRedefinicao = false }) {
  const token = useAuthStore((s) => s.token)
  const usuario = useAuthStore((s) => s.usuario)
  const carregarUsuario = useAuthStore((s) => s.carregarUsuario)

  // Se temos token mas ainda nao os dados do usuario, busca-os.
  useEffect(() => {
    if (token && !usuario) carregarUsuario().catch(() => {})
  }, [token, usuario, carregarUsuario])

  if (!token) return <Navigate to="/login" replace />

  // Ainda carregando os dados do usuario (necessario p/ checar a flag).
  if (!usuario) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <CircularProgress />
      </Box>
    )
  }

  // Senha provisoria: obriga a troca antes de acessar qualquer tela.
  if (usuario.deve_redefinir_senha && !ignorarRedefinicao) {
    return <Navigate to="/definir-senha" replace />
  }

  return children
}
