/**
 * Componente raiz: define o tema (MUI) e as rotas da aplicacao.
 *
 * O tema e reconstruido em tempo real a partir das preferencias visuais do
 * usuario (cor do painel, tema claro/escuro, densidade e bordas), guardadas
 * no preferenciaStore.
 *
 * - /login    -> tela publica de login
 * - /         -> dashboard (protegido por Bearer Token)
 * - /perfil   -> perfil e personalizacao (protegido)
 */
import { useEffect, useMemo } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { ThemeProvider, CssBaseline } from "@mui/material"

import Login from "./pages/Login"
import ForgotPassword from "./pages/ForgotPassword"
import ResetPassword from "./pages/ResetPassword"
import Dashboard from "./pages/Dashboard"
import Perfil from "./pages/Perfil"
import DefinirSenha from "./pages/DefinirSenha"
import Tenants from "./pages/Tenants"
import Programa from "./pages/Programa"
import Fases from "./pages/Fases"
import Modulos from "./pages/Modulos"
import Tarefas from "./pages/Tarefas"
import Questionarios from "./pages/Questionarios"
import Eventos from "./pages/Eventos"
import ResponderQuestionario from "./pages/ResponderQuestionario"
import ConfiguracoesLayout from "./pages/ConfiguracoesLayout"
import DadosCadastrais from "./pages/DadosCadastrais"
import ConfiguracaoEmail from "./pages/ConfiguracaoEmail"
import Usuarios from "./pages/Usuarios"
import MinhaStartup from "./pages/MinhaStartup"
import Startups from "./pages/Startups"
import StartupDetail from "./pages/StartupDetail"
import Placeholder from "./pages/Placeholder"
import ProtectedRoute from "./components/ProtectedRoute"
import RootRoute from "./components/RootRoute"
import AdminOuRootRoute from "./components/AdminOuRootRoute"
import { construirTema } from "./theme"
import { usePreferenciaStore } from "./store/preferenciaStore"

// Rotas do menu que ainda nao tem tela propria: usam o Placeholder por
// enquanto. Ao criar a tela real, troque o elemento aqui.
const ROTAS_PLACEHOLDER = [
  "/startups/membros",
  "/mentores",
  "/eventos/presenca",
  "/entregas",
  "/avaliacoes",
  "/logs",
  "/auditoria",
  "/feedback",
]

export default function App() {
  // Reconstroi o tema sempre que as preferencias do usuario mudam.
  const preferencias = usePreferenciaStore((s) => s.preferencias)
  const theme = useMemo(() => construirTema(preferencias), [preferencias])

  // Esconde o texto de carregamento inicial (boot) do index.html.
  useEffect(() => {
    const boot = document.getElementById("boot-status")
    if (boot) boot.style.display = "none"
  }, [])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          {/* Rotas publicas */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Troca obrigatoria de senha no primeiro acesso (exige token,
              mas nao redireciona de volta para si mesma) */}
          <Route
            path="/definir-senha"
            element={
              <ProtectedRoute ignorarRedefinicao>
                <DefinirSenha />
              </ProtectedRoute>
            }
          />

          {/* Rotas protegidas: exigem token */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/perfil"
            element={
              <ProtectedRoute>
                <Perfil />
              </ProtectedRoute>
            }
          />

          {/* Gestao de incubadoras: exclusiva do usuario root */}
          <Route
            path="/tenants"
            element={
              <RootRoute>
                <Tenants />
              </RootRoute>
            }
          />

          {/* Construtor de Programa: monta toda a trilha numa unica tela */}
          <Route
            path="/programa"
            element={
              <ProtectedRoute>
                <Programa />
              </ProtectedRoute>
            }
          />

          {/* Programa: fases da trilha de incubacao */}
          <Route
            path="/fases"
            element={
              <ProtectedRoute>
                <Fases />
              </ProtectedRoute>
            }
          />
          <Route
            path="/modulos"
            element={
              <ProtectedRoute>
                <Modulos />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tarefas"
            element={
              <ProtectedRoute>
                <Tarefas />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tarefas/:idTarefa/responder"
            element={
              <ProtectedRoute>
                <ResponderQuestionario />
              </ProtectedRoute>
            }
          />
          <Route
            path="/questionarios"
            element={
              <ProtectedRoute>
                <Questionarios />
              </ProtectedRoute>
            }
          />
          <Route
            path="/eventos"
            element={
              <ProtectedRoute>
                <Eventos />
              </ProtectedRoute>
            }
          />

          {/* Minha Startup: membros, modelos de gestao e fases concluidas
              da startup do usuario logado. */}
          <Route
            path="/minha-startup"
            element={
              <ProtectedRoute>
                <MinhaStartup />
              </ProtectedRoute>
            }
          />

          {/* Startups: lista (admin/mentor) e pagina de detalhe de uma
              startup especifica da incubadora. */}
          <Route
            path="/startups"
            element={
              <ProtectedRoute>
                <Startups />
              </ProtectedRoute>
            }
          />
          <Route
            path="/startups/:id"
            element={
              <ProtectedRoute>
                <StartupDetail />
              </ProtectedRoute>
            }
          />

          {/* Usuarios da incubadora: lista mestre-detalhe, grupos e
              reativacao. Restrita ao admin da propria incubadora (ou root). */}
          <Route
            path="/usuarios"
            element={
              <AdminOuRootRoute>
                <Usuarios />
              </AdminOuRootRoute>
            }
          />

          {/* Configuracoes da incubadora: admin da propria incubadora ou root.
              Layout com abas (Dados cadastrais, Config. e-mail), cada
              subpagina renderizada via Outlet. Permissoes, Usuarios e Grupos
              ficam na tela "Usuarios" (rota /usuarios). */}
          <Route
            path="/configuracoes"
            element={
              <AdminOuRootRoute>
                <ConfiguracoesLayout />
              </AdminOuRootRoute>
            }
          >
            <Route index element={<DadosCadastrais />} />
            <Route path="email" element={<ConfiguracaoEmail />} />
          </Route>

          {/* Rotas do menu ainda sem tela: exibem o Placeholder */}
          {ROTAS_PLACEHOLDER.map((rota) => (
            <Route
              key={rota}
              path={rota}
              element={
                <ProtectedRoute>
                  <Placeholder />
                </ProtectedRoute>
              }
            />
          ))}

          {/* Qualquer outra rota volta para a home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}
