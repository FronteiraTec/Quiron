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
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { ThemeProvider, CssBaseline } from "@mui/material"

import Login from "./pages/Login"
import ForgotPassword from "./pages/ForgotPassword"
import ResetPassword from "./pages/ResetPassword"
import Dashboard from "./pages/Dashboard"
import Perfil from "./pages/Perfil"
import FalaConosco from "./pages/FalaConosco"
import EnviarFeedback from "./pages/EnviarFeedback"
import CentralAjuda from "./pages/CentralAjuda"
import DefinirSenha from "./pages/DefinirSenha"
import Tenants from "./pages/Tenants"
import Programa from "./pages/Programa"
import Biblioteca from "./pages/Biblioteca"
import Questionarios from "./pages/Questionarios"
import Eventos from "./pages/Eventos"
import ResponderQuestionario from "./pages/ResponderQuestionario"
import ConfiguracoesLayout from "./pages/ConfiguracoesLayout"
import DadosCadastrais from "./pages/DadosCadastrais"
import ConfiguracaoEmail from "./pages/ConfiguracaoEmail"
import ConfiguracaoAgenda from "./pages/ConfiguracaoAgenda"
import Auditoria from "./pages/Auditoria"
import RelatorioProgresso from "./pages/RelatorioProgresso"
import RelatorioEntregas from "./pages/RelatorioEntregas"
import RelatorioGargalos from "./pages/RelatorioGargalos"
import RelatorioEngajamento from "./pages/RelatorioEngajamento"
import Usuarios from "./pages/Usuarios"
import Jornada from "./pages/Jornada"
import MinhaStartup from "./pages/MinhaStartup"
import Startups from "./pages/Startups"
import StartupDetail from "./pages/StartupDetail"
import Entregas from "./pages/Entregas"
import Feedback from "./pages/Feedback"
import Mentores from "./pages/Mentores"
import PresencaEventos from "./pages/PresencaEventos"
import Membros from "./pages/Membros"
import Avaliacoes from "./pages/Avaliacoes"
import NotFound from "./pages/NotFound"
import ProtectedRoute from "./components/ProtectedRoute"
import RootRoute from "./components/RootRoute"
import AdminOuRootRoute from "./components/AdminOuRootRoute"
import { TourProvider } from "./tour/TourProvider"
import { construirTema } from "./theme"
import { usePreferenciaStore } from "./store/preferenciaStore"


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
        {/* TourProvider dentro do Router: o tour exibido depende da rota atual */}
        <TourProvider>
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

            {/* Fala Conosco: canais de contato (Instagram/WhatsApp) da
                FronteiraTec e da INNE. Aberta pelo item "Conversar conosco"
                do UserPanel. */}
            <Route
              path="/fala-conosco"
              element={
                <ProtectedRoute>
                  <FalaConosco />
                </ProtectedRoute>
              }
            />

            {/* Enviar Feedback: formulario livre sobre a plataforma. Aberta
                pelo item "Enviar Feedback" do UserPanel. Distinta de
                /feedback, que e o historico de devolutivas do mentor. */}
            <Route
              path="/enviar-feedback"
              element={
                <ProtectedRoute>
                  <EnviarFeedback />
                </ProtectedRoute>
              }
            />

            {/* Central de Ajuda: FAQ estatico. Aberta pelo item "Central de
                Ajuda" do UserPanel. */}
            <Route
              path="/central-ajuda"
              element={
                <ProtectedRoute>
                  <CentralAjuda />
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

            {/* Biblioteca de Conhecimento: acervo reutilizavel do que se ensina */}
            <Route
              path="/biblioteca"
              element={
                <ProtectedRoute>
                  <Biblioteca />
                </ProtectedRoute>
              }
            />

            {/* Resposta a um questionario de um PASSO da trilha.
                As telas /fases, /modulos e /tarefas foram substituidas pelo
                Construtor (/programa), que edita a arvore inteira numa tela. */}
            <Route
              path="/passos/:idNo/responder"
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

            {/* Presenca: a chamada dos eventos ja realizados. E a unica escrita
                em evento_presenca, que o relatorio de engajamento le para
                calcular a taxa de presenca. Marcar presenca e ato do admin
                (a linha guarda marcado_por), diferente do /eventos, onde o
                proprio participante confirma que pretende ir. */}
            <Route
              path="/eventos/presenca"
              element={
                <AdminOuRootRoute>
                  <PresencaEventos />
                </AdminOuRootRoute>
              }
            />

            {/* Jornada do incubado: ambiente de estudo/execucao (3 colunas) com
                a trilha da startup, o conteudo de cada passo e a entrega. */}
            <Route
              path="/jornada"
              element={
                <ProtectedRoute>
                  <Jornada />
                </ProtectedRoute>
              }
            />

            {/* Minha Startup: membros, modelos de gestao, fases concluidas e a
                evolucao (Blueprint + maturidade) da startup do usuario logado. */}
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
            {/* Membros: as pessoas de todas as startups, e principalmente os
                incubados que nao estao em nenhuma. Antes de "/startups/:id",
                senao "membros" seria lido como o id de uma startup. */}
            <Route
              path="/startups/membros"
              element={
                <AdminOuRootRoute>
                  <Membros />
                </AdminOuRootRoute>
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

            {/* Mentores: distribuicao das startups entre os mentores. O vinculo
                editado aqui e o que recorta a fila de avaliacao de cada um.
                Restrita ao admin da propria incubadora (ou root), como o
                mentorService exige. */}
            <Route
              path="/mentores"
              element={
                <AdminOuRootRoute>
                  <Mentores />
                </AdminOuRootRoute>
              }
            />

            {/* Avaliacao de entregas (mentor/admin): a fila do que foi enviado
                e o historico das devolutivas ja dadas. O recorte por startup
                acompanhada e feito no backend (entregaService.listarFila). */}
            <Route
              path="/entregas"
              element={
                <ProtectedRoute>
                  <Entregas />
                </ProtectedRoute>
              }
            />
            <Route
              path="/feedback"
              element={
                <ProtectedRoute>
                  <Feedback />
                </ProtectedRoute>
              }
            />

            {/* Avaliacoes: as devolutivas de TODOS os avaliadores. Distinta de
                /feedback, que traz so as do mentor logado — por isso restrita
                ao admin: e a visao sobre o trabalho da mentoria. */}
            <Route
              path="/avaliacoes"
              element={
                <AdminOuRootRoute>
                  <Avaliacoes />
                </AdminOuRootRoute>
              }
            />

            {/* Relatorios de gestao do programa. Substituem as antigas telas
                de Logs/Auditoria no menu: a auditoria virou aba de
                Configuracoes (/configuracoes/auditoria), que e onde o registro
                de conformidade pertence. */}
            <Route
              path="/relatorios/progresso"
              element={
                <ProtectedRoute>
                  <RelatorioProgresso />
                </ProtectedRoute>
              }
            />
            <Route
              path="/relatorios/entregas"
              element={
                <ProtectedRoute>
                  <RelatorioEntregas />
                </ProtectedRoute>
              }
            />
            <Route
              path="/relatorios/gargalos"
              element={
                <ProtectedRoute>
                  <RelatorioGargalos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/relatorios/engajamento"
              element={
                <ProtectedRoute>
                  <RelatorioEngajamento />
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
              <Route path="agenda" element={<ConfiguracaoAgenda />} />
              <Route path="auditoria" element={<Auditoria />} />
            </Route>

            {/* Qualquer outra rota cai na tela de 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TourProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}
