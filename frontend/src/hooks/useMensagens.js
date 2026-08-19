/**
 * Mensagens internas: caixa de entrada, envio e historico.
 *
 * Diferente de useNotificacoesEventos, aqui o estado de LIDA e do servidor
 * (tabela mensagem_destinatario, migracao 012) e nao do localStorage: a
 * mensagem lida no celular continua lida no computador, e o badge do sino e o
 * mesmo numero em qualquer aparelho.
 *
 * Endpoints (backend/src/routes/mensagemRoutes.js):
 *   GET  /mensagens?id_tenant=          -> caixa de entrada
 *   GET  /mensagens/opcoes?id_tenant=   -> publicos que a pessoa pode escolher
 *   GET  /mensagens/enviadas?id_tenant= -> historico de envios
 *   POST /mensagens                     -> envia
 *   POST /mensagens/:id/lida            -> marca uma como lida
 *   POST /mensagens/lidas               -> zera o sino
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import api from "../services/api"

// Recarrega em segundo plano: mensagem escrita por outra pessoa aparece
// sozinha, sem precisar recarregar a pagina.
const INTERVALO_MS = 2 * 60 * 1000
// Teto do que o sino carrega. O resto fica na pagina de Mensagens.
const LIMITE_PADRAO = 50

/**
 * A caixa de entrada do usuario logado no tenant.
 * @param {{idTenant?:number, limite?:number}} params
 */
export function useMensagens({ idTenant, limite = LIMITE_PADRAO } = {}) {
  const [mensagens, setMensagens] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const carregar = useCallback(async () => {
    if (!idTenant) {
      setMensagens([])
      setCarregando(false)
      return
    }
    setErro(null)
    try {
      const { data } = await api.get("/mensagens", { params: { id_tenant: idTenant, limite } })
      setMensagens(data.mensagens)
    } catch (err) {
      setErro(err.response?.data?.erro || "Erro ao carregar as mensagens.")
      setMensagens([])
    } finally {
      setCarregando(false)
    }
  }, [idTenant, limite])

  // Carga inicial + atualizacao periodica.
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

  const naoLidas = useMemo(() => mensagens.filter((m) => !m.lida).length, [mensagens])

  /**
   * Marca UMA mensagem como lida.
   *
   * O estado local muda antes da resposta: quem clicou ja viu a mensagem, e
   * esperar a rede para tirar o negrito faz a interface parecer travada. Se a
   * chamada falhar, a proxima carga traz o estado real de volta.
   */
  const marcarLida = useCallback(async (idMensagem) => {
    setMensagens((atual) =>
      atual.map((m) => (m.id_mensagem === idMensagem ? { ...m, lida: true } : m))
    )
    try {
      await api.post(`/mensagens/${idMensagem}/lida`)
    } catch {
      // Silencioso de proposito: marcar como lida nao e a acao que o usuario
      // pediu (ele pediu para LER), entao um erro aqui nao interrompe nada.
    }
  }, [])

  /** Zera o sino: marca tudo do tenant como lido. */
  const marcarTodasLidas = useCallback(async () => {
    if (!idTenant) return
    setMensagens((atual) => atual.map((m) => ({ ...m, lida: true })))
    try {
      await api.post("/mensagens/lidas", { id_tenant: idTenant })
    } catch {
      carregar()
    }
  }, [idTenant, carregar])

  return { mensagens, naoLidas, carregando, erro, marcarLida, marcarTodasLidas, recarregar: carregar }
}

/**
 * Os publicos que a pessoa logada pode escolher no formulario de envio.
 *
 * Vem do backend ja recortado pelas permissoes dela (ver
 * mensagemService.opcoesDeDestino): quem nao tem a chave de falar com a
 * incubadora inteira nao recebe essa opcao na lista.
 *
 * @param {{idTenant?:number, ativo?:boolean}} params - `ativo` evita a
 *   requisicao enquanto o dialogo esta fechado.
 */
export function useOpcoesDestino({ idTenant, ativo = true } = {}) {
  const [opcoes, setOpcoes] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    if (!idTenant || !ativo) return
    let cancelado = false

    setCarregando(true)
    api
      .get("/mensagens/opcoes", { params: { id_tenant: idTenant } })
      .then(({ data }) => {
        if (!cancelado) setOpcoes(data)
      })
      .catch((err) => {
        if (!cancelado) setErro(err.response?.data?.erro || "Erro ao carregar os destinatários.")
      })
      .finally(() => {
        if (!cancelado) setCarregando(false)
      })

    return () => {
      cancelado = true
    }
  }, [idTenant, ativo])

  return { opcoes, carregando, erro }
}

/**
 * O historico de envios (o que EU mandei; o tenant inteiro para quem tem a
 * chave `comunicacao.mensagens.visualizar`).
 * @param {{idTenant?:number, ativo?:boolean}} params
 */
export function useMensagensEnviadas({ idTenant, ativo = true } = {}) {
  const [mensagens, setMensagens] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const carregar = useCallback(async () => {
    if (!idTenant || !ativo) return
    setCarregando(true)
    setErro(null)
    try {
      const { data } = await api.get("/mensagens/enviadas", { params: { id_tenant: idTenant } })
      setMensagens(data.mensagens)
    } catch (err) {
      setErro(err.response?.data?.erro || "Erro ao carregar as mensagens enviadas.")
      setMensagens([])
    } finally {
      setCarregando(false)
    }
  }, [idTenant, ativo])

  useEffect(() => {
    carregar()
  }, [carregar])

  /** Exclui uma mensagem enviada (some do historico e das caixas de entrada). */
  const excluir = useCallback(async (idMensagem) => {
    await api.delete(`/mensagens/${idMensagem}`)
    setMensagens((atual) => atual.filter((m) => m.id_mensagem !== idMensagem))
  }, [])

  return { mensagens, carregando, erro, excluir, recarregar: carregar }
}

/**
 * Envia uma mensagem.
 * @param {{idTenant:number, assunto:string, corpo:string, destinos:Array,
 *          importante?:boolean, enviarEmail?:boolean}} dados
 */
export async function enviarMensagem({ idTenant, assunto, corpo, destinos, importante, enviarEmail }) {
  const { data } = await api.post("/mensagens", {
    id_tenant: idTenant,
    assunto,
    corpo,
    // O backend le `id_referencia`; o front trabalha com o objeto de opcao.
    destinos: destinos.map((d) => ({ tipo: d.tipo, id_referencia: d.idReferencia ?? null })),
    importante: Boolean(importante),
    enviar_email: Boolean(enviarEmail),
  })
  return data.mensagem
}
