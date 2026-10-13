/**
 * Hook de persistencia das preferencias da Sidebar.
 *
 * Dois niveis de persistencia:
 *   1. Backend (usuario_preferencias): o estado "recolhida" reaproveita a
 *      coluna `sidebar_recolhida` via preferenciaStore (PUT /preferencias).
 *   2. localStorage (por usuario): favoritos (pinned) e a ultima secao
 *      aberta - dados de UI que ainda nao tem coluna no schema.
 *
 * Assim o comportamento fica identico ao spec (salvar automaticamente estado
 * recolhido, itens fixados e ultima secao aberta) sem exigir migracao de banco.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { usePreferenciaStore } from "../store/preferenciaStore"
import { useAuthStore } from "../store/authStore"

function chaveLocal(idUsuario) {
  return `quiron_sidebar_${idUsuario ?? "anon"}`
}

function lerLocal(idUsuario) {
  try {
    const bruto = localStorage.getItem(chaveLocal(idUsuario))
    if (!bruto) return {}
    return JSON.parse(bruto)
  } catch {
    return {}
  }
}

function salvarLocal(idUsuario, dados) {
  try {
    localStorage.setItem(chaveLocal(idUsuario), JSON.stringify(dados))
  } catch {
    // Ignora quota/localStorage indisponivel.
  }
}

export function useSidebarPreferences() {
  const idUsuario = useAuthStore((s) => s.usuario?.id)
  const preferencias = usePreferenciaStore((s) => s.preferencias)
  const salvarPreferencias = usePreferenciaStore((s) => s.salvar)

  // --- Estado recolhido (espelha o backend) ---
  const recolhida = !!preferencias.sidebar_recolhida

  // Evita gravar no backend na primeira renderizacao (quando ainda estamos
  // carregando as preferencias reais do usuario).
  const setRecolhida = useCallback(
    (valor) => {
      salvarPreferencias({ sidebar_recolhida: valor }).catch(() => {})
    },
    [salvarPreferencias]
  )

  // --- Estado local por usuario (pinned / ultima secao) ---
  const [pinned, setPinned] = useState([])
  const [ultimaSecao, setUltimaSecao] = useState(null)
  const carregado = useRef(false)

  // Carrega o estado local quando o usuario fica conhecido.
  useEffect(() => {
    const dados = lerLocal(idUsuario)
    setPinned(Array.isArray(dados.pinned) ? dados.pinned : [])
    setUltimaSecao(dados.ultimaSecao ?? null)
    carregado.current = true
  }, [idUsuario])

  // Persiste no localStorage sempre que algo muda (apos o carregamento).
  useEffect(() => {
    if (!carregado.current) return
    salvarLocal(idUsuario, { pinned, ultimaSecao })
  }, [idUsuario, pinned, ultimaSecao])

  const alternarPin = useCallback((id) => {
    setPinned((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]
    )
  }, [])

  return {
    recolhida,
    setRecolhida,
    pinned,
    alternarPin,
    ultimaSecao,
    setUltimaSecao,
  }
}
