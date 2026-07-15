/**
 * Sidebar - menu lateral do sistema (desktop) + conteudo compartilhado.
 *
 * Exporta:
 *   - SidebarConteudo: o miolo (cabecalho de startup, busca, favoritos,
 *     recentes, menu por papel e rodape). Reaproveitado pelo drawer mobile.
 *   - Sidebar (default): o Drawer permanente do desktop/tablet, retratil
 *     entre a largura expandida (280px) e a recolhida (72px).
 *
 * A logica de estado fica em useSidebar; aqui cuidamos so da apresentacao.
 */
import { Drawer, Box, Toolbar, List, Typography, Divider } from "@mui/material"
import { SIDEBAR_WIDTH, SIDEBAR_MINI_WIDTH } from "./menuConfig"
import SidebarItem from "./SidebarItem"
import SidebarGroup from "./SidebarGroup"
import SidebarSearch from "./SidebarSearch"
import StartupSwitcher from "./StartupSwitcher"
import SidebarFooter from "./SidebarFooter"
import SidebarSkeleton from "./SidebarSkeleton"

export { SIDEBAR_WIDTH, SIDEBAR_MINI_WIDTH }

// Rotulo de secao (Favoritos/Recentes); some quando a Sidebar esta recolhida.
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
  startups = [],
  startupAtualId,
  onTrocarStartup,
  onToggleSidebar,
  carregando = false,
  variante = "desktop",
}) {
  if (carregando || !sidebar.usuario) {
    return <SidebarSkeleton recolhida={recolhida} />
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
    itensRecentes,
    navegar,
    setRecolhida,
  } = sidebar

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Cabecalho: startup atual / troca rapida. O logo (foguete) alterna a Sidebar. */}
      <StartupSwitcher
        startups={startups}
        startupAtualId={startupAtualId}
        recolhida={recolhida}
        onTrocar={onTrocarStartup}
        onToggleSidebar={onToggleSidebar ?? (() => setRecolhida(!recolhida))}
        usuario={usuario}
      />
      <Divider
        sx={{
          borderColor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)"),
        }}
      />

      {/* Busca rapida */}
      <SidebarSearch
        recolhida={recolhida}
        valor={busca}
        onChange={setBusca}
        onExpandir={() => setRecolhida(false)}
      />

      {/* Area rolavel do menu */}
      <Box
        component="nav"
        aria-label="Navegacao principal"
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

            {/* Recentes (apenas no modo expandido) */}
            {!recolhida && itensRecentes.length > 0 && (
              <>
                <SecaoLabel recolhida={recolhida}>Recentes</SecaoLabel>
                <List disablePadding>
                  {itensRecentes.map((item) => (
                    <SidebarItem
                      key={`rec-${item.id}`}
                      item={item}
                      ativo={rotaAtiva(item.rota)}
                      recolhida={false}
                      badges={badges}
                      fixado={false}
                      variante={variante}
                      onNavegar={navegar}
                      onFixar={alternarPin}
                    />
                  ))}
                </List>
              </>
            )}

            {(itensFixados.length > 0 || (!recolhida && itensRecentes.length > 0)) && (
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

      {/* Rodape: usuario + menu (Perfil / Preferencias / Sair) */}
      <SidebarFooter usuario={usuario} papel={papel} recolhida={recolhida} />
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
  startups = [],
  startupAtualId,
  onTrocarStartup,
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
        "& .MuiDrawer-paper": {
          width: largura,
          boxSizing: "border-box",
          overflowX: "hidden",
          border: "none",
          borderRight: (theme) =>
            `1px solid ${theme.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)"}`,
          bgcolor: "background.paper",
          boxShadow: (theme) =>
            theme.palette.mode === "dark"
              ? "1px 0 0 rgba(255,255,255,0.02)"
              : "1px 0 12px rgba(15,23,42,0.02)",
          // Animacao suave de expandir/recolher (220ms, curva confortavel).
          transition: (theme) =>
            theme.transitions.create("width", {
              easing: "cubic-bezier(0.4, 0, 0.2, 1)",
              duration: 220,
            }),
        },
      }}
    >
      <Toolbar /> {/* espacador para ficar abaixo da Navbar fixa */}
      <Box sx={{ height: "calc(100% - 64px)" }}>
        <SidebarConteudo
          sidebar={sidebar}
          recolhida={recolhida}
          badges={badges}
          startups={startups}
          startupAtualId={startupAtualId}
          onTrocarStartup={onTrocarStartup}
          onToggleSidebar={onToggleSidebar}
          carregando={carregando}
          variante="desktop"
        />
      </Box>
    </Drawer>
  )
}
