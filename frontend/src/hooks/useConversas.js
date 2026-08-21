/**
 * Conversas (migracao 013): a lista de quem falou com voce e a thread aberta.
 *
 * ATUALIZACAO POR SONDAGEM, e nao por WebSocket. A pilha do Quiron e HTTP
 * simples atras do Nginx, sem canal persistente; abrir um so para o chat
 * significaria infraestrutura nova (sticky session, reconexao, autenticacao do
 * socket) para um produto onde a conversa e assincrona por natureza — ninguem
 * espera resposta imediata de um mentor. A sondagem entrega "chegou uma
 * mensagem" em segundos, sem nada disso.
 *
 * As duas cadencias sao diferentes de proposito: a thread ABERTA e o que a
 * pessoa esta olhando agora, entao vai mais rapido; a lista de conversas e
 * pano de fundo. As duas param quando a aba nao esta visivel — sondar uma aba
 * que ninguem ve e so gastar bateria e banco.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import api from "../services/api"

const INTERVALO_LISTA_MS = 20 * 1000
const INTERVALO_THREAD_MS = 8 * 1000

/** Roda `fn` a cada `intervalo`, mas so enquanto a aba estiver visivel. */
function useSondagem(fn, intervalo) {
  useEffect(() => {
    const rodar = () => {
      if (document.visibilityState === "visible") fn()
    }
    const timer = setInterval(rodar, intervalo)
    // Voltar para a aba tambem revalida: quem estava fora quer o estado de
    // agora, nao o de quando saiu.
    document.addEventListener("visibilitychange", rodar)
    return () => {
      clearInterval(timer)
      document.removeEventListener("visibilitychange", rodar)
    }
  }, [fn, intervalo])
}

/** A lista de conversas do usuario logado, da mais recente para a mais antiga. */
export function useConversas({ idTenant } = {}) {
  const [conversas, setConversas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const carregar = useCallback(async () => {
    if (!idTenant) {
      setConversas([])
      setCarregando(false)
      return
    }
    try {
      const { data } = await api.get("/mensagens/conversas", { params: { id_tenant: idTenant } })
      setConversas(data.conversas)
      setErro(null)
    } catch (err) {
      setErro(err.response?.data?.erro || "Erro ao carregar as conversas.")
    } finally {
      setCarregando(false)
    }
  }, [idTenant])

  useEffect(() => {
    setCarregando(true)
    carregar()
  }, [carregar])

  useSondagem(carregar, INTERVALO_LISTA_MS)

  /**
   * Zera o nao lido de uma conversa na lista, sem esperar o servidor.
   *
   * Existe porque abrir a thread ja marca como lida no backend; sem isto a
   * lista continuaria com o badge aceso ate a proxima sondagem, contradizendo a
   * tela que a pessoa esta olhando.
   */
  const zerarNaoLidas = useCallback((idOutro) => {
    setConversas((atual) =>
      atual.map((c) => (c.id_usuario === idOutro ? { ...c, nao_lidas: 0 } : c))
    )
  }, [])

  return { conversas, carregando, erro, recarregar: carregar, zerarNaoLidas }
}

/**
 * A thread com uma pessoa. Abrir marca como lido o que ela mandou.
 * @param {{idTenant?:number, idOutro?:number}} params
 */
export function useConversa({ idTenant, idOutro } = {}) {
  const [pessoa, setPessoa] = useState(null)
  const [mensagens, setMensagens] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState(null)
  // Guarda quem estava aberto na ultima carga: ao TROCAR de conversa a tela
  // mostra o esqueleto; ao recarregar a mesma, atualiza sem piscar.
  const abertaRef = useRef(null)

  const carregar = useCallback(async () => {
    if (!idTenant || !idOutro) {
      setPessoa(null)
      setMensagens([])
      return
    }
    const troca = abertaRef.current !== idOutro
    if (troca) setCarregando(true)

    try {
      const { data } = await api.get(`/mensagens/conversas/${idOutro}`, {
        params: { id_tenant: idTenant },
      })
      setPessoa(data.pessoa)
      setMensagens(data.mensagens)
      setErro(null)
      abertaRef.current = idOutro
    } catch (err) {
      setErro(err.response?.data?.erro || "Erro ao abrir a conversa.")
      setMensagens([])
    } finally {
      setCarregando(false)
    }
  }, [idTenant, idOutro])

  useEffect(() => {
    carregar()
  }, [carregar])

  useSondagem(carregar, INTERVALO_THREAD_MS)

  /**
   * Responde na conversa.
   *
   * A mensagem entra na lista antes da confirmacao do servidor (com
   * `pendente`), porque num chat a propria fala tem de aparecer no instante em
   * que se aperta Enter. Se o envio falhar, ela sai e o erro aparece — o texto
   * volta para a caixa, em vez de sumir.
   */
  const responder = useCallback(
    async (corpo, idMensagemPai) => {
      const texto = corpo.trim()
      if (!texto || !idTenant || !idOutro) return

      const provisoria = {
        id_mensagem: `pendente-${Date.now()}`,
        corpo: texto,
        assunto: null,
        minha: true,
        pendente: true,
        criado_ts: new Date().toISOString(),
        destinos: [],
      }
      setMensagens((atual) => [...atual, provisoria])
      setEnviando(true)
      setErro(null)

      try {
        const { data } = await api.post(`/mensagens/conversas/${idOutro}`, {
          id_tenant: idTenant,
          corpo: texto,
          id_mensagem_pai: idMensagemPai || null,
        })
        setMensagens((atual) =>
          atual.map((m) =>
            m.id_mensagem === provisoria.id_mensagem
              ? { ...data.mensagem, minha: true, lida_ts: null }
              : m
          )
        )
        return data.mensagem
      } catch (err) {
        setMensagens((atual) => atual.filter((m) => m.id_mensagem !== provisoria.id_mensagem))
        setErro(err.response?.data?.erro || "Não foi possível enviar.")
        throw err
      } finally {
        setEnviando(false)
      }
    },
    [idTenant, idOutro]
  )

  return { pessoa, mensagens, carregando, enviando, erro, responder, recarregar: carregar }
}
