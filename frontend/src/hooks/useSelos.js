/**
 * Hooks dos SELOS — o catalogo da incubadora, o mural e as conquistas da
 * propria pessoa.
 *
 * TRES HOOKS, porque sao tres autorizacoes diferentes:
 *   useSelos       o catalogo + o mural  -> `engajamento.selos.visualizar`
 *   useMeusSelos   as proprias conquistas -> NAO passa por RBAC (sao suas)
 *   useGestaoSelos criar/editar/conceder/revogar -> chaves de escrita
 *
 * SELO NAO VALE PONTO. Nenhuma chamada daqui mexe em ranking, e nao e para
 * mexer: selo mede evolucao e protagonismo, ponto mede participacao. Ver o
 * cabecalho de backend/src/services/seloService.js.
 *
 * Endpoints:
 *   GET    /selos?id_tenant=&incluir_inativos=
 *   GET    /selos/concessoes?id_tenant=&id_selo=&id_usuario=
 *   GET    /selos/meus?id_tenant=
 *   POST   /selos                              PUT /selos/:id
 *   PATCH  /selos/:id/ativo                    DELETE /selos/:id
 *   POST   /selos/:id/conceder
 *   PATCH  /selos/concessoes/:id/revogar
 *   PATCH  /selos/concessoes/:id/publico       -> so o dono
 */
import { useCallback, useEffect, useState } from "react"
import api from "../services/api"

/** O catalogo de selos da incubadora (com quantas vezes cada um foi concedido). */
export function useSelos(idTenant, { incluirInativos = false, comMural = false } = {}) {
  const [selos, setSelos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [concessoes, setConcessoes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const carregar = useCallback(async () => {
    if (!idTenant) {
      setSelos([])
      setConcessoes([])
      setCarregando(false)
      return
    }
    setCarregando(true)
    setErro(null)
    try {
      const [catalogo, mural] = await Promise.all([
        api.get("/selos", {
          params: { id_tenant: idTenant, incluir_inativos: incluirInativos || undefined },
        }),
        comMural
          ? api.get("/selos/concessoes", { params: { id_tenant: idTenant } })
          : Promise.resolve({ data: { concessoes: [] } }),
      ])
      setSelos(catalogo.data.selos)
      setCategorias(catalogo.data.categorias)
      setConcessoes(mural.data.concessoes)
    } catch (err) {
      setErro(err.response?.data?.erro || "Não foi possível carregar os selos.")
      setSelos([])
      setConcessoes([])
    } finally {
      setCarregando(false)
    }
  }, [idTenant, incluirInativos, comMural])

  useEffect(() => {
    carregar()
  }, [carregar])

  return { selos, categorias, concessoes, carregando, erro, recarregar: carregar }
}

/**
 * As conquistas da propria pessoa, com o interruptor da credencial publica.
 *
 * Traz as REVOGADAS junto: a pessoa precisa entender por que a credencial que
 * ela publicou parou de valer, e esconder a linha so geraria a duvida.
 */
export function useMeusSelos(idTenant) {
  const [selos, setSelos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const carregar = useCallback(async () => {
    if (!idTenant) {
      setSelos([])
      setCarregando(false)
      return
    }
    setCarregando(true)
    setErro(null)
    try {
      const { data } = await api.get("/selos/meus", { params: { id_tenant: idTenant } })
      setSelos(data.selos)
    } catch (err) {
      setErro(err.response?.data?.erro || "Não foi possível carregar as suas conquistas.")
      setSelos([])
    } finally {
      setCarregando(false)
    }
  }, [idTenant])

  useEffect(() => {
    carregar()
  }, [carregar])

  /**
   * Liga/desliga a credencial publica.
   *
   * Atualiza a lista local em vez de recarregar tudo: e um interruptor, e
   * piscar a secao inteira a cada clique faria parecer que algo deu errado.
   */
  const alterarPublico = useCallback(
    async (idConcessao, publico) => {
      const { data } = await api.patch(`/selos/concessoes/${idConcessao}/publico`, {
        id_tenant: idTenant,
        publico,
      })
      setSelos((atual) =>
        atual.map((s) =>
          s.id_concessao === idConcessao ? { ...s, publico: data.concessao.publico } : s
        )
      )
      return data.concessao
    },
    [idTenant]
  )

  return { selos, carregando, erro, recarregar: carregar, alterarPublico }
}

/** As escritas do catalogo e das concessoes. */
export function useGestaoSelos(idTenant) {
  const criar = useCallback(
    async (dados) => (await api.post("/selos", { ...dados, id_tenant: idTenant })).data.selo,
    [idTenant]
  )

  const atualizar = useCallback(
    async (idSelo, dados) =>
      (await api.put(`/selos/${idSelo}`, { ...dados, id_tenant: idTenant })).data.selo,
    [idTenant]
  )

  const alterarAtivo = useCallback(
    async (idSelo, ativo) =>
      (await api.patch(`/selos/${idSelo}/ativo`, { id_tenant: idTenant, ativo })).data.selo,
    [idTenant]
  )

  const excluir = useCallback(
    async (idSelo) =>
      (await api.delete(`/selos/${idSelo}`, { params: { id_tenant: idTenant } })).data,
    [idTenant]
  )

  /** Em lote: o ato real e em lote ("os cinco que apresentaram no Demoday"). */
  const conceder = useCallback(
    async (idSelo, { idsUsuarios, justificativa, evidenciaUrl, idStartup }) =>
      (
        await api.post(`/selos/${idSelo}/conceder`, {
          id_tenant: idTenant,
          ids_usuarios: idsUsuarios,
          justificativa,
          evidencia_url: evidenciaUrl,
          id_startup: idStartup,
        })
      ).data,
    [idTenant]
  )

  const revogar = useCallback(
    async (idConcessao, motivo) =>
      (
        await api.patch(`/selos/concessoes/${idConcessao}/revogar`, {
          id_tenant: idTenant,
          motivo,
        })
      ).data.concessao,
    [idTenant]
  )

  return { criar, atualizar, alterarAtivo, excluir, conceder, revogar }
}
