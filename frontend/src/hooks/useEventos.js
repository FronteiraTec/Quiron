/**
 * Estado e operacoes da tela de Calendario (pagina Eventos).
 *
 * Concentra: navegacao entre datas/visoes, filtros (categorias visiveis,
 * "meus eventos", busca) e as chamadas HTTP (listar/criar/atualizar/excluir/
 * confirmar presenca) contra /eventos. A pagina e os componentes de
 * apresentacao (CalendarGrid, CalendarSidebar, etc.) ficam livres de logica.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
} from "date-fns"
import api from "../services/api"
import { LISTA_CATEGORIAS } from "../components/calendar/categorias"

/** Calcula o intervalo [inicio, fim] a buscar na API, de acordo com a visao. */
function calcularPeriodo(dataReferencia, visao) {
  switch (visao) {
    case "dia":
      return { inicio: dataReferencia, fim: dataReferencia }
    case "semana":
      return {
        inicio: startOfWeek(dataReferencia, { weekStartsOn: 0 }),
        fim: endOfWeek(dataReferencia, { weekStartsOn: 0 }),
      }
    case "agenda":
      return { inicio: dataReferencia, fim: addMonths(dataReferencia, 3) }
    case "mes":
    default:
      return {
        inicio: startOfWeek(startOfMonth(dataReferencia), { weekStartsOn: 0 }),
        fim: endOfWeek(endOfMonth(dataReferencia), { weekStartsOn: 0 }),
      }
  }
}

export function useEventos({ idTenant, usuarioId }) {
  const [dataReferencia, setDataReferencia] = useState(() => new Date())
  const [visao, setVisao] = useState("mes") // dia | semana | mes | agenda

  const [eventos, setEventos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [aviso, setAviso] = useState(null) // { tipo, texto }

  // --- Filtros ---
  const [categoriasAtivas, setCategoriasAtivas] = useState(() => new Set(LISTA_CATEGORIAS))
  const [somenteMeus, setSomenteMeus] = useState(false)
  const [busca, setBusca] = useState("")

  const periodo = useMemo(() => calcularPeriodo(dataReferencia, visao), [dataReferencia, visao])

  const carregar = useCallback(async () => {
    if (!idTenant) {
      setCarregando(false)
      return
    }
    setCarregando(true)
    try {
      const { data } = await api.get("/eventos", {
        params: {
          id_tenant: idTenant,
          inicio: periodo.inicio.toISOString(),
          fim: periodo.fim.toISOString(),
        },
      })
      setEventos(data.eventos)
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao carregar o calendario." })
    } finally {
      setCarregando(false)
    }
  }, [idTenant, periodo])

  useEffect(() => {
    carregar()
  }, [carregar])

  // ------------------------------------------------------------- navegacao
  const irParaHoje = useCallback(() => setDataReferencia(new Date()), [])
  const irParaData = useCallback((data) => setDataReferencia(data), [])
  const irAnterior = useCallback(() => {
    setDataReferencia((d) => {
      if (visao === "dia") return subDays(d, 1)
      if (visao === "semana") return subWeeks(d, 1)
      return subMonths(d, 1)
    })
  }, [visao])
  const irProximo = useCallback(() => {
    setDataReferencia((d) => {
      if (visao === "dia") return addDays(d, 1)
      if (visao === "semana") return addWeeks(d, 1)
      return addMonths(d, 1)
    })
  }, [visao])

  // -------------------------------------------------------------- filtros
  const alternarCategoria = useCallback((categoria) => {
    setCategoriasAtivas((atuais) => {
      const novas = new Set(atuais)
      if (novas.has(categoria)) novas.delete(categoria)
      else novas.add(categoria)
      return novas
    })
  }, [])

  const mostrarSomenteCategoria = useCallback((categoria) => {
    setCategoriasAtivas(categoria ? new Set([categoria]) : new Set(LISTA_CATEGORIAS))
  }, [])

  const alternarSomenteMeus = useCallback(() => setSomenteMeus((v) => !v), [])

  const eventosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return eventos.filter((ev) => {
      if (!categoriasAtivas.has(ev.categoria)) return false
      if (somenteMeus && ev.criado_por !== usuarioId) return false
      if (termo && !ev.titulo.toLowerCase().includes(termo) && !ev.descricao?.toLowerCase().includes(termo)) {
        return false
      }
      return true
    })
  }, [eventos, categoriasAtivas, somenteMeus, usuarioId, busca])

  // ------------------------------------------------------------------ CRUD
  const criarEvento = useCallback(
    async (dados) => {
      await api.post("/eventos", { id_tenant: idTenant, ...dados })
      await carregar()
    },
    [idTenant, carregar]
  )

  const atualizarEvento = useCallback(
    async (id, dados) => {
      await api.put(`/eventos/${id}`, dados)
      await carregar()
    },
    [carregar]
  )

  const excluirEvento = useCallback(
    async (id) => {
      await api.delete(`/eventos/${id}`)
      await carregar()
    },
    [carregar]
  )

  const confirmarPresenca = useCallback(
    async (id, status) => {
      await api.post(`/eventos/${id}/confirmar`, { status })
      await carregar()
    },
    [carregar]
  )

  return {
    dataReferencia,
    visao,
    setVisao,
    irParaHoje,
    irParaData,
    irAnterior,
    irProximo,

    eventos: eventosFiltrados,
    todosEventos: eventos,
    carregando,
    aviso,
    limparAviso: () => setAviso(null),

    categoriasAtivas,
    alternarCategoria,
    mostrarSomenteCategoria,
    somenteMeus,
    alternarSomenteMeus,
    busca,
    setBusca,

    criarEvento,
    atualizarEvento,
    excluirEvento,
    confirmarPresenca,
    recarregar: carregar,
  }
}
