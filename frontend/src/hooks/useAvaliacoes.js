/**
 * Hook da tela de Avaliacoes (visao do admin sobre as devolutivas).
 *
 * Nao confundir com useFilaEntregas (o que falta responder) nem com o
 * /feedback do mentor (o que EU respondi). Aqui e o registro de todas as
 * devolutivas do tenant, de todos os avaliadores.
 *
 * Endpoint:
 *   GET /avaliacoes?id_tenant=  -> todas as devolutivas do tenant
 */
import { useCallback, useEffect, useState } from "react"
import api from "../services/api"

export function useAvaliacoes(idTenant) {
  const [avaliacoes, setAvaliacoes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const carregar = useCallback(async () => {
    if (!idTenant) {
      setAvaliacoes([])
      setCarregando(false)
      return
    }
    setCarregando(true)
    setErro(null)
    try {
      const { data } = await api.get("/avaliacoes", { params: { id_tenant: idTenant } })
      setAvaliacoes(data.avaliacoes)
    } catch (err) {
      setErro(err.response?.data?.erro || "Nao foi possivel carregar as avaliacoes.")
      setAvaliacoes([])
    } finally {
      setCarregando(false)
    }
  }, [idTenant])

  useEffect(() => {
    carregar()
  }, [carregar])

  return { avaliacoes, carregando, erro, recarregar: carregar }
}
