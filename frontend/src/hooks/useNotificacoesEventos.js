/**
 * Notificacoes de eventos exibidas na Navbar (sino).
 *
 * Reusa o endpoint /eventos: busca os eventos de hoje ate 3 meses a frente e
 * considera "novidade" os que foram criados nos ultimos dias (`criado_ts`).
 * A visibilidade por papel ja e resolvida no backend - admin ve todos os
 * eventos do tenant; mentor e usuario veem os gerais + os das suas startups.
 *
 * O que ja foi lido fica no localStorage por usuario (marca d'agua com a data
 * do ultimo "marcar como lidas"): nao ha tabela de notificacoes no schema, e
 * o estado de leitura e puramente de interface.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { startOfDay, addMonths, subDays } from "date-fns"
import api from "../services/api"

// Por quanto tempo um evento recem-criado continua aparecendo como notificacao.
const JANELA_DIAS = 14
// Ate onde olhamos para frente no calendario ao procurar novidades.
const HORIZONTE_MESES = 3
// Recarrega em segundo plano (eventos criados por outras pessoas aparecem sozinhos).
const INTERVALO_MS = 2 * 60 * 1000
// Teto de itens no painel - o resto fica na pagina de agenda.
const MAX_ITENS = 20

function chaveLocal(idUsuario) {
  return `quiron_notificacoes_eventos_${idUsuario ?? "anon"}`
}

function lerVistoEm(idUsuario) {
  try {
    return localStorage.getItem(chaveLocal(idUsuario))
  } catch {
    return null
  }
}

function salvarVistoEm(idUsuario, iso) {
  try {
    localStorage.setItem(chaveLocal(idUsuario), iso)
  } catch {
    // Ignora quota/localStorage indisponivel.
  }
}

export function useNotificacoesEventos({ idTenant, idUsuario }) {
  const [eventos, setEventos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [vistoEm, setVistoEm] = useState(() => lerVistoEm(idUsuario))

  // Reaplica a marca d'agua quando o usuario logado muda (troca de conta).
  useEffect(() => {
    setVistoEm(lerVistoEm(idUsuario))
  }, [idUsuario])

  const carregar = useCallback(async () => {
    if (!idTenant) {
      setEventos([])
      setCarregando(false)
      return
    }
    setErro(null)
    try {
      const agora = new Date()
      const { data } = await api.get("/eventos", {
        params: {
          id_tenant: idTenant,
          inicio: startOfDay(agora).toISOString(),
          fim: addMonths(agora, HORIZONTE_MESES).toISOString(),
        },
      })
      setEventos(data.eventos)
    } catch (err) {
      setErro(err.response?.data?.erro || "Erro ao carregar as notificações.")
      setEventos([])
    } finally {
      setCarregando(false)
    }
  }, [idTenant])

  // Carga inicial + atualizacao periodica em segundo plano.
  useEffect(() => {
    carregar()
    const timer = setInterval(carregar, INTERVALO_MS)
    return () => clearInterval(timer)
  }, [carregar])

  // Tambem revalida ao voltar para a aba, para nao depender so do intervalo.
  useEffect(() => {
    const aoFocar = () => {
      if (document.visibilityState === "visible") carregar()
    }
    document.addEventListener("visibilitychange", aoFocar)
    return () => document.removeEventListener("visibilitychange", aoFocar)
  }, [carregar])

  // Eventos criados na janela recente, do mais novo para o mais antigo.
  // Os criados pelo proprio usuario ficam de fora: ele ja sabe que existem.
  const notificacoes = useMemo(() => {
    const limite = subDays(new Date(), JANELA_DIAS)
    return eventos
      .filter((ev) => ev.criado_ts && new Date(ev.criado_ts) >= limite)
      .filter((ev) => ev.criado_por !== idUsuario)
      .sort((a, b) => new Date(b.criado_ts) - new Date(a.criado_ts))
      .slice(0, MAX_ITENS)
      .map((ev) => ({ ...ev, lida: vistoEm != null && new Date(ev.criado_ts) <= new Date(vistoEm) }))
  }, [eventos, vistoEm, idUsuario])

  const naoLidas = useMemo(() => notificacoes.filter((n) => !n.lida).length, [notificacoes])

  const marcarTodasLidas = useCallback(() => {
    const agora = new Date().toISOString()
    salvarVistoEm(idUsuario, agora)
    setVistoEm(agora)
  }, [idUsuario])

  return { notificacoes, naoLidas, carregando, erro, marcarTodasLidas, recarregar: carregar }
}
