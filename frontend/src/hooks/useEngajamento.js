/**
 * Hooks da tela de Engajamento.
 *
 * SAO DOIS, e a separacao importa: o PAINEL e dado da propria pessoa e nao
 * passa por RBAC; o RANKING e o placar da incubadora e exige
 * `engajamento.ranking.visualizar`. Juntar os dois numa chamada so faria a
 * tela inteira falhar com 403 para quem so pode ver o proprio progresso — que
 * e exatamente quem o modulo existe para trazer para dentro.
 *
 * A TEMPORADA E DA TELA: `idTemporada` vai na requisicao porque olhar o
 * semestre passado e uma pergunta legitima ("como fechou o ciclo anterior"), e
 * o backend devolve a temporada que de fato usou — e ela que rotula o
 * cabecalho.
 *
 * Endpoints:
 *   GET    /engajamento/ranking?id_tenant=&id_temporada=
 *   GET    /engajamento/meu-painel?id_tenant=&id_temporada=
 *   POST   /engajamento/pontos            -> lancamento manual da coordenacao
 *   DELETE /engajamento/pontos/:id        -> estorno (so lancamento manual)
 */
import { useCallback, useEffect, useState } from "react"
import api from "../services/api"

/** O placar das duas ligas + o placar por startup. */
export function useRanking(idTenant, idTemporada = null) {
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const carregar = useCallback(async () => {
    if (!idTenant) {
      setDados(null)
      setCarregando(false)
      return
    }
    setCarregando(true)
    setErro(null)
    try {
      const { data } = await api.get("/engajamento/ranking", {
        params: { id_tenant: idTenant, id_temporada: idTemporada || undefined },
      })
      setDados(data)
    } catch (err) {
      setErro(err.response?.data?.erro || "Não foi possível carregar o ranking.")
      setDados(null)
    } finally {
      setCarregando(false)
    }
  }, [idTenant, idTemporada])

  useEffect(() => {
    carregar()
  }, [carregar])

  return { dados, carregando, erro, recarregar: carregar }
}

/**
 * O painel da propria pessoa: liga, pontos, nivel, posicao, extrato — e as
 * REGRAS DO JOGO (o que pontua e o que nao pontua), que vem do backend junto.
 *
 * As regras vem da API, e nao de uma constante no front, porque sao politica
 * da coordenacao: quem consumir a API por outro caminho tem que receber a
 * mesma lista, e mudar a regra nao pode exigir rebuild do front.
 */
export function useMeuPainel(idTenant, idTemporada = null) {
  const [painel, setPainel] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const carregar = useCallback(async () => {
    if (!idTenant) {
      setPainel(null)
      setCarregando(false)
      return
    }
    setCarregando(true)
    setErro(null)
    try {
      const { data } = await api.get("/engajamento/meu-painel", {
        params: { id_tenant: idTenant, id_temporada: idTemporada || undefined },
      })
      setPainel(data)
    } catch (err) {
      setErro(err.response?.data?.erro || "Não foi possível carregar o seu painel.")
      setPainel(null)
    } finally {
      setCarregando(false)
    }
  }, [idTenant, idTemporada])

  useEffect(() => {
    carregar()
  }, [carregar])

  return { painel, carregando, erro, recarregar: carregar }
}

/**
 * As acoes de lancamento manual da coordenacao.
 *
 * Devolve `ignorados` junto com `lancados`: quem nao tem liga (admin, ou
 * pessoa sem startup ativa) e silenciosamente pulado pelo backend, e a tela
 * precisa dizer isso — senao a coordenacao lanca para dez, ve "lançado" e nao
 * descobre que dois ficaram de fora.
 */
export function useLancamentos(idTenant) {
  const lancar = useCallback(
    async ({ idsUsuarios, chaveAcao, ocorridoDt, observacao }) => {
      const { data } = await api.post("/engajamento/pontos", {
        id_tenant: idTenant,
        ids_usuarios: idsUsuarios,
        chave_acao: chaveAcao,
        ocorrido_dt: ocorridoDt,
        observacao,
      })
      return data
    },
    [idTenant]
  )

  const estornar = useCallback(async (idPonto) => {
    const { data } = await api.delete(`/engajamento/pontos/${idPonto}`)
    return data
  }, [])

  return { lancar, estornar }
}

/** O extrato de OUTRA pessoa (o proprio ja vem no painel). */
export async function buscarExtrato(idTenant, idUsuario, idTemporada = null) {
  const { data } = await api.get("/engajamento/extrato", {
    params: {
      id_tenant: idTenant,
      id_usuario: idUsuario,
      id_temporada: idTemporada || undefined,
    },
  })
  return data
}
