/**
 * Hook da tela de Presenca (check-in dos eventos, marcado pelo admin).
 *
 * Presenca NAO e a confirmacao: confirmar ("pretendo ir") e ato do
 * participante; marcar presenca ("esteve la") e ato do admin. Sao tabelas
 * diferentes — evento_confirmacao e evento_presenca.
 *
 * O que se marca aqui alimenta direto o relatorio de engajamento: ele conta
 * evento_presenca e, sem esta tela, a taxa de presenca ficava sempre em zero.
 *
 * Endpoints:
 *   GET  /eventos/presenca/resumo?id_tenant=&dias=  -> eventos + andamento
 *   GET  /eventos/:id/presenca                      -> lista de chamada
 *   POST /eventos/:id/presenca                      -> marca (uma ou varias)
 */
import { useCallback, useEffect, useState } from "react"
import api from "../services/api"

export function usePresencaEventos(idTenant) {
  const [eventos, setEventos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const carregar = useCallback(async () => {
    if (!idTenant) {
      setEventos([])
      setCarregando(false)
      return
    }
    setCarregando(true)
    setErro(null)
    try {
      const { data } = await api.get("/eventos/presenca/resumo", {
        params: { id_tenant: idTenant },
      })
      setEventos(data.eventos)
    } catch (err) {
      setErro(err.response?.data?.erro || "Nao foi possivel carregar os eventos.")
      setEventos([])
    } finally {
      setCarregando(false)
    }
  }, [idTenant])

  useEffect(() => {
    carregar()
  }, [carregar])

  /** Lista de chamada de um evento: convidados, RSVP e presenca ja marcada. */
  const buscarChamada = useCallback(async (idEvento) => {
    const { data } = await api.get(`/eventos/${idEvento}/presenca`)
    return data
  }, [])

  /**
   * Marca presenca/ausencia de uma ou varias pessoas.
   *
   * Devolve as linhas marcadas para a tela atualizar so elas, sem recarregar a
   * chamada inteira: marcar presenca e uma sequencia rapida de cliques e um
   * refetch a cada clique faria a lista piscar embaixo do dedo de quem marca.
   *
   * @param {number[]} idsUsuarios
   * @param {boolean} presente
   */
  const marcar = useCallback(
    async (idEvento, idsUsuarios, presente) => {
      const { data } = await api.post(`/eventos/${idEvento}/presenca`, {
        id_usuarios: idsUsuarios,
        presente,
      })
      // O andamento da coluna esquerda (marcados/presentes) mudou.
      await carregar()
      return data.marcados
    },
    [carregar]
  )

  return { eventos, carregando, erro, recarregar: carregar, buscarChamada, marcar }
}
