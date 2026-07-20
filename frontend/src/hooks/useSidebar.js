/**
 * Hook principal da Sidebar: reune papel, menu, busca, grupos abertos,
 * item ativo, favoritos/recentes e navegacao.
 *
 * Concentra toda a logica de estado para que os componentes visuais
 * (Sidebar, SidebarGroup, SidebarItem...) fiquem simples e declarativos.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { useMediaQuery, useTheme } from "@mui/material"
import { useAuthStore } from "../store/authStore"
import { usePermissaoStore } from "../store/permissaoStore"
import { useSidebarPreferences } from "./useSidebarPreferences"
import {
  menuPorPapel,
  resolverPapel,
  achatarMenu,
} from "../components/sidebar/menuConfig"

/**
 * Remove do menu o que o usuario nao tem permissao de abrir, e os grupos que
 * ficam vazios por consequencia — um grupo "Relatorios" sem nenhum relatorio
 * dentro so ocuparia espaco para abrir e nao mostrar nada.
 */
function filtrarPorPermissao(menu, pode) {
  return menu
    .map((item) => {
      if (!item.filhos) return item
      return { ...item, filhos: item.filhos.filter((f) => pode(f.permissao)) }
    })
    .filter((item) => (item.filhos ? item.filhos.length > 0 : pode(item.permissao)))
}

/**
 * @param {object} params
 * @param {() => void} [params.onNavegar] - Chamado apos navegar (fecha o drawer no mobile).
 */
export function useSidebar({ onNavegar } = {}) {
  const navigate = useNavigate()
  const location = useLocation()
  const usuario = useAuthStore((s) => s.usuario)

  const theme = useTheme()
  const ehDesktop = useMediaQuery(theme.breakpoints.up("md"))
  const ehTablet = useMediaQuery(theme.breakpoints.between("sm", "md"))

  const prefs = useSidebarPreferences()

  // --- Papel + menu ---
  //
  // Duas camadas: o PAPEL escolhe qual menu (admin/mentor/usuario/root) — sao
  // navegacoes de formatos diferentes, nao subconjuntos uma da outra — e a
  // PERMISSAO poda desse menu o que daria 403.
  const papel = useMemo(() => resolverPapel(usuario), [usuario])
  const chaves = usePermissaoStore((s) => s.chaves)
  const pode = usePermissaoStore((s) => s.pode)
  const menu = useMemo(
    () => filtrarPorPermissao(menuPorPapel(papel), pode),
    // `chaves` entra na lista porque `pode` e estavel (zustand) e nao
    // dispararia o recalculo sozinho quando as permissoes chegassem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [papel, pode, chaves]
  )
  const itensPlanos = useMemo(() => achatarMenu(menu), [menu])

  // --- Deteccao de rota ativa ---
  const rotaAtiva = useCallback(
    (rota) => {
      if (!rota) return false
      if (rota === "/") return location.pathname === "/"
      return location.pathname === rota || location.pathname.startsWith(rota + "/")
    },
    [location.pathname]
  )
  const grupoAtivo = useCallback(
    (filhos) => filhos.some((f) => rotaAtiva(f.rota)),
    [rotaAtiva]
  )

  // Item plano atualmente ativo (usado para o indicador deslizante e recentes).
  const itemAtivo = useMemo(
    () => itensPlanos.find((i) => rotaAtiva(i.rota)),
    [itensPlanos, rotaAtiva]
  )

  // --- Grupos abertos (accordion) ---
  // Inicia com o grupo do item ativo (ou a ultima secao aberta) expandido.
  const [gruposAbertos, setGruposAbertos] = useState({})
  useEffect(() => {
    const grupoDoAtivo = itemAtivo?.grupoId
    const inicial = grupoDoAtivo || prefs.ultimaSecao
    if (inicial) setGruposAbertos((s) => ({ ...s, [inicial]: true }))
    // Roda quando muda o item ativo (navegacao) ou o papel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemAtivo?.grupoId, papel])

  const alternarGrupo = useCallback(
    (id) => {
      setGruposAbertos((s) => {
        const proximo = { ...s, [id]: !s[id] }
        if (proximo[id]) prefs.setUltimaSecao(id)
        return proximo
      })
    },
    [prefs]
  )

  // --- Busca rapida ---
  const [busca, setBusca] = useState("")
  const resultadosBusca = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return null
    return itensPlanos.filter(
      (i) =>
        i.texto.toLowerCase().includes(termo) ||
        (i.grupoTexto && i.grupoTexto.toLowerCase().includes(termo))
    )
  }, [busca, itensPlanos])

  // --- Favoritos / recentes resolvidos para itens completos ---
  const porId = useMemo(() => {
    const m = new Map()
    itensPlanos.forEach((i) => m.set(i.id, i))
    return m
  }, [itensPlanos])

  const itensFixados = useMemo(
    () => prefs.pinned.map((id) => porId.get(id)).filter(Boolean),
    [prefs.pinned, porId]
  )
  const itensRecentes = useMemo(
    () =>
      prefs.recentes
        .map((id) => porId.get(id))
        .filter(Boolean)
        .filter((i) => !prefs.pinned.includes(i.id)),
    [prefs.recentes, prefs.pinned, porId]
  )

  // --- Navegacao ---
  const navegar = useCallback(
    (item) => {
      if (!item?.rota) return
      prefs.registrarRecente(item.id)
      navigate(item.rota)
      setBusca("")
      onNavegar?.()
    },
    [navigate, prefs, onNavegar]
  )

  return {
    // contexto
    usuario,
    papel,
    ehDesktop,
    ehTablet,
    // menu
    menu,
    rotaAtiva,
    grupoAtivo,
    itemAtivo,
    // grupos
    gruposAbertos,
    alternarGrupo,
    // busca
    busca,
    setBusca,
    resultadosBusca,
    // favoritos / recentes
    pinned: prefs.pinned,
    alternarPin: prefs.alternarPin,
    itensFixados,
    itensRecentes,
    // preferencias recolhida
    recolhida: prefs.recolhida,
    setRecolhida: prefs.setRecolhida,
    // acao
    navegar,
  }
}
