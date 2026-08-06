/**
 * Hook da tela de Mentores (gestao do vinculo mentor <-> startup pelo admin).
 *
 * "Mentor" nao e uma tabela: e o papel 'mentor' em tenant_usuarios. A lista ja
 * vem do backend com a CARGA de cada um (quantas startups acompanha, quantas
 * entregas esperam resposta) — e o que o admin precisa para decidir quem ainda
 * aguenta mais uma startup.
 *
 * Vincular e desvincular recarregam a lista porque as duas acoes mudam a carga
 * exibida: mover uma startup de um mentor para outro tem que aparecer nos dois
 * imediatamente, senao o admin distribui olhando um numero velho.
 *
 * Endpoints:
 *   GET    /mentores?id_tenant=                        -> lista + carga
 *   GET    /mentores/:idUsuario/startups?id_tenant=    -> acompanha + disponiveis
 *   POST   /mentores/:idUsuario/startups               -> vincula
 *   DELETE /mentores/:idUsuario/startups/:idStartup    -> desvincula
 */
import { useCallback, useEffect, useState } from "react"
import api from "../services/api"

export function useMentores(idTenant) {
  const [mentores, setMentores] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const carregar = useCallback(async () => {
    if (!idTenant) {
      setMentores([])
      setCarregando(false)
      return
    }
    setCarregando(true)
    setErro(null)
    try {
      const { data } = await api.get("/mentores", { params: { id_tenant: idTenant } })
      setMentores(data.mentores)
    } catch (err) {
      setErro(err.response?.data?.erro || "Não foi possível carregar os mentores.")
      setMentores([])
    } finally {
      setCarregando(false)
    }
  }, [idTenant])

  useEffect(() => {
    carregar()
  }, [carregar])

  /**
   * Startups que o mentor acompanha + as que ainda pode acompanhar.
   * As duas listas vem juntas do backend: oferecer uma startup ja vinculada
   * so daria 409.
   */
  const buscarDetalhe = useCallback(
    async (idUsuario) => {
      const { data } = await api.get(`/mentores/${idUsuario}/startups`, {
        params: { id_tenant: idTenant },
      })
      return data
    },
    [idTenant]
  )

  const vincular = useCallback(
    async (idUsuario, idStartup) => {
      await api.post(`/mentores/${idUsuario}/startups`, {
        id_tenant: idTenant,
        id_startup: idStartup,
      })
      await carregar()
    },
    [idTenant, carregar]
  )

  const desvincular = useCallback(
    async (idUsuario, idStartup) => {
      await api.delete(`/mentores/${idUsuario}/startups/${idStartup}`, {
        params: { id_tenant: idTenant },
      })
      await carregar()
    },
    [idTenant, carregar]
  )

  return { mentores, carregando, erro, recarregar: carregar, buscarDetalhe, vincular, desvincular }
}
