/**
 * Hook de carregamento de um relatorio.
 *
 * Os quatro relatorios tem a mesma mecanica — GET /relatorios/<algo> com
 * id_tenant e, nos de periodo, dias — entao ela mora num lugar so. Cada tela
 * cuida apenas de desenhar o que voltou.
 */
import { useCallback, useEffect, useState } from "react"
import api from "../services/api"

/**
 * @param {string} caminho - ex.: "progresso" -> GET /relatorios/progresso
 * @param {{idTenant: number|null, dias?: number}} opcoes
 * @returns {{dados, carregando, erro, recarregar}}
 */
export function useRelatorio(caminho, { idTenant, dias } = {}) {
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const carregar = useCallback(async () => {
    // Root sem incubadora escolhida ainda: nao ha o que pedir.
    if (!idTenant) {
      setDados(null)
      setCarregando(false)
      return
    }

    setCarregando(true)
    setErro(null)
    try {
      const params = { id_tenant: idTenant }
      if (dias) params.dias = dias

      const { data } = await api.get(`/relatorios/${caminho}`, { params })
      setDados(data)
    } catch (err) {
      setErro(err.response?.data?.erro || "Não foi possível carregar o relatório.")
      setDados(null)
    } finally {
      setCarregando(false)
    }
  }, [caminho, idTenant, dias])

  useEffect(() => {
    carregar()
  }, [carregar])

  return { dados, carregando, erro, recarregar: carregar }
}
