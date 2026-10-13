/**
 * Agenda resumida da tela inicial (Dashboard).
 *
 * Carrega os eventos de hoje ate o fim da semana atual reusando o mesmo
 * endpoint da pagina Eventos (/eventos). A visibilidade por papel ja e
 * resolvida no backend: admin ve todos os eventos do tenant; mentor e usuario
 * veem apenas os gerais + os das startups a que estao ligados.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { startOfDay, endOfWeek } from "date-fns"
import api from "../services/api"
import { paraHoraDoEvento } from "../utils/horaEvento"

export function useAgendaSemana(idTenant) {
  const [eventos, setEventos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  // Periodo fixo por montagem: de hoje (00:00) ate o fim da semana (sabado).
  const periodo = useMemo(() => {
    const hoje = new Date()
    return {
      inicio: startOfDay(hoje),
      fim: endOfWeek(hoje, { weekStartsOn: 0 }),
    }
  }, [])

  const carregar = useCallback(async () => {
    if (!idTenant) {
      setEventos([])
      setCarregando(false)
      return
    }
    setCarregando(true)
    setErro(null)
    try {
      const { data } = await api.get("/eventos", {
        params: {
          id_tenant: idTenant,
          inicio: paraHoraDoEvento(periodo.inicio),
          fim: paraHoraDoEvento(periodo.fim),
        },
      })
      setEventos(data.eventos)
    } catch (err) {
      setErro(err.response?.data?.erro || "Erro ao carregar a agenda.")
      setEventos([])
    } finally {
      setCarregando(false)
    }
  }, [idTenant, periodo])

  useEffect(() => {
    carregar()
  }, [carregar])

  return { eventos, carregando, erro, recarregar: carregar }
}
