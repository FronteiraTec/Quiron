/**
 * Layout base das telas internas.
 *
 * Reune a Navbar fixa no topo, a Sidebar (desktop retratil + drawer no mobile)
 * a esquerda e o conteudo principal (children) a direita. Ao montar, garante
 * que o usuario logado e as preferencias visuais estejam carregados.
 *
 * O estado da Sidebar (papel, recolhida, favoritos, recentes, busca...) vem do
 * hook useSidebar; aqui so orquestramos larguras e o drawer mobile.
 */
import { useEffect, useState } from "react"
import { Box, Toolbar, useTheme, useMediaQuery } from "@mui/material"
import Navbar from "./Navbar"
import Sidebar, { SIDEBAR_WIDTH, SIDEBAR_MINI_WIDTH } from "./sidebar/Sidebar"
import SidebarMobile from "./sidebar/SidebarMobile"
import { useSidebar } from "../hooks/useSidebar"
import { useAuthStore } from "../store/authStore"
import { usePreferenciaStore } from "../store/preferenciaStore"

export default function AppLayout({ children }) {
  const usuario = useAuthStore((s) => s.usuario)
  const carregarUsuario = useAuthStore((s) => s.carregarUsuario)
  const carregarPreferencias = usePreferenciaStore((s) => s.carregar)

  const theme = useTheme()
  const smUp = useMediaQuery(theme.breakpoints.up("sm"))

  // Drawer mobile (xs). No desktop/tablet, o toggle recolhe/expande.
  const [mobileAberto, setMobileAberto] = useState(false)
  const sidebar = useSidebar({ onNavegar: () => setMobileAberto(false) })

  // Contagens pendentes por chave (badgeKey no menuConfig). Quando o backend
  // expuser esses numeros, basta alimentar este objeto.
  //   ex.: { tarefas: 5, eventos: 2, entregas: 3 }
  const badges = {}

  // Startups do usuario (troca rapida). Vazio => cabecalho mostra "Quiron".
  //   ex.: [{ id: 1, nome: "Acme", logo: "https://…" }]
  const startups = []
  const [startupAtualId, setStartupAtualId] = useState(null)

  // Largura atual da Sidebar (para a Navbar e o conteudo acompanharem).
  const largura = sidebar.recolhida ? SIDEBAR_MINI_WIDTH : SIDEBAR_WIDTH

  const alternarSidebar = () =>
    smUp ? sidebar.setRecolhida(!sidebar.recolhida) : setMobileAberto((v) => !v)

  // Carrega usuario (se so temos o token) e preferencias ao entrar.
  useEffect(() => {
    if (!usuario) carregarUsuario().catch(() => {})
    carregarPreferencias().catch(() => {})
  }, [usuario, carregarUsuario, carregarPreferencias])

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <Navbar onToggleSidebar={alternarSidebar} sidebarWidth={largura} />

      {/* Desktop / tablet: drawer permanente retratil */}
      <Sidebar
        sidebar={sidebar}
        badges={badges}
        startups={startups}
        startupAtualId={startupAtualId}
        onTrocarStartup={setStartupAtualId}
        onToggleSidebar={alternarSidebar}
      />

      {/* Mobile: drawer temporario com swipe */}
      <SidebarMobile
        aberto={mobileAberto}
        onAbrir={() => setMobileAberto(true)}
        onFechar={() => setMobileAberto(false)}
        sidebar={sidebar}
        badges={badges}
        startups={startups}
        startupAtualId={startupAtualId}
        onTrocarStartup={setStartupAtualId}
      />

      {/* Conteudo principal (deslocado a direita da Sidebar) */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${largura}px)` },
          transition: (t) =>
            t.transitions.create("width", {
              easing: t.transitions.easing.easeInOut,
              duration: t.transitions.duration.enteringScreen,
            }),
        }}
      >
        <Toolbar /> {/* espacador para o conteudo ficar abaixo da Navbar fixa */}
        {children}
      </Box>
    </Box>
  )
}
