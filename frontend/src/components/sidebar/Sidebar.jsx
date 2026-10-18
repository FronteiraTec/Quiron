/**
 * Sidebar - menu lateral do sistema (desktop) + conteudo compartilhado.
 *
 * Exporta:
 *   - SidebarConteudo: o miolo (cabecalho de startup, busca, favoritos,
 *     menu por papel e rodape). Reaproveitado pelo drawer mobile.
 *   - Sidebar (default): o Drawer permanente do desktop/tablet, retratil
 *     entre a largura expandida (280px) e a recolhida (72px).
 *
 * A logica de estado fica em useSidebar; aqui cuidamos so da apresentacao.
 */
import { Drawer, Box, List, Typography, Divider } from "@mui/material"
import { SIDEBAR_WIDTH, SIDEBAR_MINI_WIDTH, SIDEBAR_TRANSICAO } from "./menuConfig"
import SidebarItem from "./SidebarItem"
import SidebarGroup from "./SidebarGroup"
import SidebarSearch from "./SidebarSearch"
import StartupSwitcher from "./StartupSwitcher"
import SidebarSkeleton from "./SidebarSkeleton"

export { SIDEBAR_WIDTH, SIDEBAR_MINI_WIDTH, SIDEBAR_TRANSICAO }

// Rotulo de secao (Favoritos/Menu); some quando a Sidebar esta recolhida.
function SecaoLabel({ children, recolhida }) {
  if (recolhida) return <Divider sx={{ my: 1.5, mx: 2 }} />
  return (
    <Typography
      variant="overline"
      sx={{
        px: 2.5,
        pt: 2.5,
        pb: 0.75,
        display: "block",
        color: "text.secondary",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.06em",
        lineHeight: 1.4,
      }}
    >
      {children}
    </Typography>
  )
}

/**
 * Miolo da Sidebar (compartilhado entre desktop e mobile).
 * @param {object} props
 * @param {ReturnType<import('../../hooks/useSidebar').useSidebar>} props.sidebar
 */
export function SidebarConteudo({
  sidebar,
  recolhida = false,
  badges = {},
  onToggleSidebar,
  carregando = false,
  variante = "desktop",
}) {
  // Cabecalho fora do esqueleto: e o comeco da faixa preta do topo, e sumir
  // com ele durante o carregamento quebraria a barra ao lado da Navbar.
  const cabecalho = (
    <StartupSwitcher
      recolhida={recolhida}
      onToggleSidebar={onToggleSidebar ?? (() => sidebar.setRecolhida(!recolhida))}
    />
  )

  if (carregando || !sidebar.usuario) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {cabecalho}
        <SidebarSkeleton recolhida={recolhida} />
      </Box>
    )
  }

  const {
    usuario,
    papel,
    menu,
    rotaAtiva,
    grupoAtivo,
    gruposAbertos,
    alternarGrupo,
    busca,
    setBusca,
    resultadosBusca,
    pinned,
    alternarPin,
    itensFixados,
    navegar,
    setRecolhida,
  } = sidebar

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Cabecalho: a marca e o botao que alterna a Sidebar. */}
      {cabecalho}

      {/* Busca rapida */}
      <Box data-tour="sidebar-busca">
        <SidebarSearch
          recolhida={recolhida}
          valor={busca}
          onChange={setBusca}
          onExpandir={() => setRecolhida(false)}
        />
      </Box>

      {/* Area rolavel do menu */}
      <Box
        component="nav"
        data-tour="sidebar-menu"
        aria-label="Navegação principal"
        sx={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          pb: 2,
          "&::-webkit-scrollbar": { width: 6 },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: "action.disabled",
            borderRadius: 3,
          },
          "&::-webkit-scrollbar-track": { backgroundColor: "transparent" },
        }}
      >
        {resultadosBusca ? (
          // --- Resultados da busca ---
          <List sx={{ pt: 1 }}>
            {resultadosBusca.length === 0 ? (
              <Typography variant="body2" sx={{ px: 3, py: 2, color: "text.secondary" }}>
                Nenhum resultado.
              </Typography>
            ) : (
              resultadosBusca.map((item) => (
                <SidebarItem
                  key={item.id}
                  item={item}
                  ativo={rotaAtiva(item.rota)}
                  recolhida={false}
                  badges={badges}
                  fixado={pinned.includes(item.id)}
                  variante={variante}
                  onNavegar={navegar}
                  onFixar={alternarPin}
                />
              ))
            )}
          </List>
        ) : (
          <>
            {/* Favoritos */}
            {itensFixados.length > 0 && (
              <>
                <SecaoLabel recolhida={recolhida}>Favoritos</SecaoLabel>
                <List disablePadding>
                  {itensFixados.map((item) => (
                    <SidebarItem
                      key={`fav-${item.id}`}
                      item={item}
                      ativo={rotaAtiva(item.rota)}
                      recolhida={recolhida}
                      badges={badges}
                      fixado
                      variante={variante}
                      onNavegar={navegar}
                      onFixar={alternarPin}
                    />
                  ))}
                </List>
              </>
            )}

            {itensFixados.length > 0 && (
              <SecaoLabel recolhida={recolhida}>Menu</SecaoLabel>
            )}

            {/* Menu principal por papel */}
            <List disablePadding>
              {menu.map((item) =>
                item.filhos ? (
                  <SidebarGroup
                    key={item.id}
                    group={item}
                    recolhida={recolhida}
                    aberto={!!gruposAbertos[item.id]}
                    ativo={grupoAtivo(item.filhos)}
                    badges={badges}
                    variante={variante}
                    rotaAtiva={rotaAtiva}
                    pinned={pinned}
                    onToggle={alternarGrupo}
                    onNavegar={navegar}
                    onFixar={alternarPin}
                  />
                ) : (
                  <SidebarItem
                    key={item.id}
                    item={item}
                    ativo={rotaAtiva(item.rota)}
                    recolhida={recolhida}
                    badges={badges}
                    fixado={pinned.includes(item.id)}
                    variante={variante}
                    onNavegar={navegar}
                    onFixar={alternarPin}
                  />
                )
              )}
            </List>
          </>
        )}
      </Box>
    </Box>
  )
}

/**
 * Sidebar do desktop/tablet: Drawer permanente e retratil.
 * @param {object} props
 * @param {ReturnType<import('../../hooks/useSidebar').useSidebar>} props.sidebar
 */
export default function Sidebar({
  sidebar,
  badges = {},
  onToggleSidebar,
  carregando = false,
}) {
  const { recolhida } = sidebar
  const largura = recolhida ? SIDEBAR_MINI_WIDTH : SIDEBAR_WIDTH

  return (
    <Drawer
      variant="permanent"
      open
      sx={{
        display: { xs: "none", sm: "block" },
        width: largura,
        flexShrink: 0,
        // A raiz e quem ocupa espaco no layout (o papel e fixo): sem animar a
        // largura dela, o conteudo pulava de uma vez enquanto o papel ainda
        // deslizava, cobrindo a pagina ao recolher e abrindo um vao ao expandir.
        transition: (theme) => theme.transitions.create("width", SIDEBAR_TRANSICAO),
        "& .MuiDrawer-paper": {
          width: largura,
          boxSizing: "border-box",
          overflowX: "hidden",
          border: "none",
          borderRight: (theme) => `1px solid ${theme.palette.divider}`,
          bgcolor: "background.paper",
          transition: (theme) => theme.transitions.create("width", SIDEBAR_TRANSICAO),
        },
      }}
    >
      {/* Sem espacador: o cabecalho da Sidebar fica na altura da Navbar, ao
          lado dela, e nao embaixo. O miolo ja nasce na largura final e o papel
          so o revela ou esconde: assim os rotulos nao vao se espremendo em
          reticencias quadro a quadro durante a animacao. */}
      <Box sx={{ height: "100%", width: largura, flexShrink: 0 }}>
        <SidebarConteudo
          sidebar={sidebar}
          recolhida={recolhida}
          badges={badges}
          onToggleSidebar={onToggleSidebar}
          carregando={carregando}
          variante="desktop"
        />
      </Box>
    </Drawer>
  )
}
