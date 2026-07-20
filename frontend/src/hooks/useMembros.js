/**
 * Hook da tela de Membros (visao do admin sobre as pessoas das startups).
 *
 * Traz duas listas de uma vez porque a tela existe para cruzar as duas: quem
 * esta em qual startup, e quem ficou de FORA de todas. A segunda e a que gera
 * acao — sem vinculo, o incubado nao tem jornada nem entrega, e nada na tela
 * dele explica o porque.
 *
 * Endpoints:
 *   GET  /startups/membros?id_tenant=      -> { membros, semStartup }
 *   GET  /startups?id_tenant=              -> destinos possiveis ao vincular
 *   POST /startups/:id/membros             -> vincula alguem a uma startup
 */
import { useCallback, useEffect, useState } from "react"
import api from "../services/api"

export function useMembros(idTenant) {
  const [membros, setMembros] = useState([])
  const [semStartup, setSemStartup] = useState([])
  const [startups, setStartups] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const carregar = useCallback(async () => {
    if (!idTenant) {
      setMembros([])
      setSemStartup([])
      setCarregando(false)
      return
    }
    setCarregando(true)
    setErro(null)
    try {
      const [membrosRes, startupsRes] = await Promise.all([
        api.get("/startups/membros", { params: { id_tenant: idTenant } }),
        api.get("/startups", { params: { id_tenant: idTenant } }),
      ])
      setMembros(membrosRes.data.membros)
      setSemStartup(membrosRes.data.semStartup)
      setStartups(startupsRes.data.startups)
    } catch (err) {
      setErro(err.response?.data?.erro || "Nao foi possivel carregar os membros.")
      setMembros([])
      setSemStartup([])
    } finally {
      setCarregando(false)
    }
  }, [idTenant])

  useEffect(() => {
    carregar()
  }, [carregar])

  /** Vincula uma pessoa a uma startup (o caminho de saida da lista "sem startup"). */
  const vincular = useCallback(
    async (idStartup, idUsuario, lider = false) => {
      await api.post(`/startups/${idStartup}/membros`, { id_usuario: idUsuario, lider })
      await carregar()
    },
    [carregar]
  )

  return { membros, semStartup, startups, carregando, erro, recarregar: carregar, vincular }
}
