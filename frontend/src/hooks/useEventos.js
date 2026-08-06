/**
 * Estado e operacoes da tela de Calendario (pagina Eventos).
 *
 * Concentra: navegacao entre datas/visoes, filtros (categorias visiveis,
 * "meus eventos", busca) e as chamadas HTTP (listar/criar/atualizar/excluir/
 * confirmar presenca) contra /eventos. A pagina e os componentes de
 * apresentacao (CalendarGrid, CalendarSidebar, etc.) ficam livres de logica.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
} from "date-fns"
import api from "../services/api"
import { useCategorias } from "../components/calendar/categorias"

/** Calcula o intervalo [inicio, fim] a buscar na API, de acordo com a visao. */
function calcularPeriodo(dataReferencia, visao) {
  switch (visao) {
    case "dia":
      return { inicio: startOfDay(dataReferencia), fim: endOfDay(dataReferencia) }
    case "semana":
      return {
        inicio: startOfWeek(dataReferencia, { weekStartsOn: 0 }),
        fim: endOfWeek(dataReferencia, { weekStartsOn: 0 }),
      }
    case "agenda":
      return { inicio: startOfDay(dataReferencia), fim: endOfDay(addMonths(dataReferencia, 3)) }
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
  // As categorias sao configuracao da incubadora e chegam por requisicao, entao
  // o filtro nasce VAZIO e e semeado quando a lista chega. Inicializa-lo com a
  // lista (como era, quando ela vinha de uma constante) daria um Set vazio no
  // primeiro render e nenhum evento passaria pelo filtro.
  const { listaCategorias, carregada: categoriasCarregadas } = useCategorias()
  const [categoriasAtivas, setCategoriasAtivas] = useState(() => new Set())
  const filtroSemeado = useRef(false)
  const [somenteMeus, setSomenteMeus] = useState(false)
  const [busca, setBusca] = useState("")

  // Semeia UMA vez: depois disso o conjunto e do usuario, e re-semear a cada
  // atualizacao do store desfaria o filtro que ele acabou de aplicar.
  useEffect(() => {
    if (!categoriasCarregadas || filtroSemeado.current) return
    filtroSemeado.current = true
    setCategoriasAtivas(new Set(listaCategorias))
  }, [categoriasCarregadas, listaCategorias])

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
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao carregar o calendário." })
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

  const mostrarSomenteCategoria = useCallback(
    (categoria) => {
      setCategoriasAtivas(categoria ? new Set([categoria]) : new Set(listaCategorias))
    },
    [listaCategorias]
  )

  const alternarSomenteMeus = useCallback(() => setSomenteMeus((v) => !v), [])

  const eventosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return eventos.filter((ev) => {
      // Enquanto as categorias nao chegaram, nao filtra por categoria: o
      // conjunto ainda esta vazio, e aplica-lo esconderia TODOS os eventos ate
      // a resposta chegar. "Nao filtrado" e o padrao correto aqui.
      if (categoriasCarregadas && !categoriasAtivas.has(ev.categoria)) return false
      if (somenteMeus && ev.criado_por !== usuarioId) return false
      if (termo && !ev.titulo.toLowerCase().includes(termo) && !ev.descricao?.toLowerCase().includes(termo)) {
        return false
      }
      return true
    })
  }, [eventos, categoriasAtivas, categoriasCarregadas, somenteMeus, usuarioId, busca])

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
