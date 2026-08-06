/**
 * Hook da fila de avaliacao do mentor.
 *
 * Carrega as entregas enviadas das startups que o usuario acompanha e expoe
 * a acao de avaliar. Depois de avaliar, recarrega a fila: a entrega sai de
 * "pendente" e o proximo item ja aparece no topo, que e como o mentor usa a
 * tela — uma atras da outra.
 *
 * Endpoints:
 *   GET  /entregas/fila?id_tenant=  -> fila (com `situacao` derivada)
 *   GET  /entregas/:id/detalhe      -> conteudo da entrega + respostas
 *   POST /avaliacoes                -> registra a devolutiva
 */
import { useCallback, useEffect, useState } from "react"
import api from "../services/api"

export function useFilaEntregas(idTenant) {
  const [entregas, setEntregas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const carregar = useCallback(async () => {
    if (!idTenant) {
      setEntregas([])
      setCarregando(false)
      return
    }
    setCarregando(true)
    setErro(null)
    try {
      const { data } = await api.get("/entregas/fila", { params: { id_tenant: idTenant } })
      setEntregas(data.entregas)
    } catch (err) {
      setErro(err.response?.data?.erro || "Não foi possível carregar a fila de entregas.")
      setEntregas([])
    } finally {
      setCarregando(false)
    }
  }, [idTenant])

  useEffect(() => {
    carregar()
  }, [carregar])

  /** Carrega o conteudo completo de uma entrega (painel da direita). */
  const buscarDetalhe = useCallback(async (idEntrega) => {
    const { data } = await api.get(`/entregas/${idEntrega}/detalhe`)
    return data.entrega
  }, [])

  /**
   * Registra a devolutiva e recarrega a fila.
   * @param {{idEntrega, status, nota, comentario}} avaliacao
   */
  const avaliar = useCallback(
    async ({ idEntrega, status, nota, comentario }) => {
      await api.post("/avaliacoes", {
        id_entrega: idEntrega,
        status,
        nota: nota === "" || nota == null ? null : Number(nota),
        comentario: comentario || null,
      })
      await carregar()
    },
    [carregar]
  )

  return { entregas, carregando, erro, recarregar: carregar, buscarDetalhe, avaliar }
}
