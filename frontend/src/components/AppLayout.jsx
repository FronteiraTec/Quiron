/**
 * Layout base das telas internas.
 *
 * Reune a Navbar fixa no topo, a Sidebar (desktop retratil + drawer no mobile)
 * a esquerda e o conteudo principal (children) a direita. Ao montar, garante
 * que o usuario logado e as preferencias visuais estejam carregados.
 *
 * O estado da Sidebar (papel, recolhida, favoritos, busca...) vem do
 * hook useSidebar; aqui so orquestramos larguras e o drawer mobile.
 */
import { useEffect, useState } from "react"
import { Box, Toolbar, useTheme, useMediaQuery } from "@mui/material"
import Navbar from "./Navbar"
import Sidebar, { SIDEBAR_WIDTH, SIDEBAR_MINI_WIDTH, SIDEBAR_TRANSICAO } from "./sidebar/Sidebar"
import SidebarMobile from "./sidebar/SidebarMobile"
import { useSidebar } from "../hooks/useSidebar"
import { useAuthStore } from "../store/authStore"
import { usePreferenciaStore } from "../store/preferenciaStore"
import { usePermissaoStore } from "../store/permissaoStore"
import { useAgendaConfigStore } from "../store/agendaConfigStore"
import { useStartupConfigStore } from "../store/startupConfigStore"
import { useTarefaConfigStore } from "../store/tarefaConfigStore"

/**
 * @param {boolean} [fullBleed] Remove o padding do main e faz o conteudo ocupar
 *   exatamente a altura da viewport abaixo da Navbar (telas tipo calendario,
 *   que gerenciam a propria rolagem interna).
 */
export default function AppLayout({ children, fullBleed = false }) {
  const usuario = useAuthStore((s) => s.usuario)
  const carregarUsuario = useAuthStore((s) => s.carregarUsuario)
  const carregarPreferencias = usePreferenciaStore((s) => s.carregar)
  const carregarPermissoes = usePermissaoStore((s) => s.carregar)
  const carregarAgendaConfig = useAgendaConfigStore((s) => s.carregar)
  const carregarStartupConfig = useStartupConfigStore((s) => s.carregar)
  const carregarTarefaConfig = useTarefaConfigStore((s) => s.carregar)

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

  // As permissoes do tenant, assim que sabemos qual e. Ficam aqui e nao no
  // login porque o usuario tambem chega por /auth/me ao recarregar a pagina —
  // carregar so no login deixaria o menu sem chaves apos um F5.
  useEffect(() => {
    if (usuario?.id_tenant) carregarPermissoes(usuario.id_tenant)
  }, [usuario?.id_tenant, carregarPermissoes])

  // Categorias e locais da agenda, pelo mesmo motivo das permissoes: sao lidos
  // por telas espalhadas (calendario, dashboard, presenca, notificacoes) e
  // carregar em cada uma renderia a mesma requisicao varias vezes por
  // navegacao. O store ignora a chamada repetida para o tenant ja carregado.
  useEffect(() => {
    if (usuario?.id_tenant) carregarAgendaConfig(usuario.id_tenant)
  }, [usuario?.id_tenant, carregarAgendaConfig])

  // Tipos, situacoes e campos personalizaveis do cadastro de startup, pelo
  // mesmo motivo: sao lidos na lista de startups, no cadastro, no detalhe e em
  // "Minha Startup".
  useEffect(() => {
    if (usuario?.id_tenant) carregarStartupConfig(usuario.id_tenant)
  }, [usuario?.id_tenant, carregarStartupConfig])

  // Colunas e campos personalizaveis do quadro de tarefas, pelo mesmo motivo:
  // sao lidos na tela de tarefas (nas duas visualizacoes) e no painel de
  // cadastro. Quem nao tem a chave recebe 403 e o store guarda listas vazias —
  // essa pessoa nao ve o item de menu de qualquer forma.
  useEffect(() => {
    if (usuario?.id_tenant) carregarTarefaConfig(usuario.id_tenant)
  }, [usuario?.id_tenant, carregarTarefaConfig])

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
          minWidth: 0,
          p: fullBleed ? 0 : 3,
          width: { sm: `calc(100% - ${largura}px)` },
          ...(fullBleed && { height: "100vh", display: "flex", flexDirection: "column" }),
          transition: (t) => t.transitions.create("width", SIDEBAR_TRANSICAO),
        }}
      >
        <Toolbar sx={{ flexShrink: 0 }} /> {/* espacador para o conteudo ficar abaixo da Navbar fixa */}
        {fullBleed ? (
          <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>{children}</Box>
        ) : (
          children
        )}
      </Box>
    </Box>
  )
}
