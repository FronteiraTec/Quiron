/**
 * Estado e operacoes da Biblioteca de Conhecimento.
 *
 * Le e grava na API (/conteudos). Antes o acervo vivia so em memoria, a partir
 * de um mock — por isso nada do que se criava aqui aparecia no Construtor.
 *
 * Estrategia de sincronizacao: as mutacoes atualizam a lista local com a
 * resposta do servidor, sem refetch. A unica excecao e excluir/duplicar, que
 * mexem no contador de usos e na contagem por tipo, e por isso recarregam.
 *
 * Os filtros (tipo, tag, termo) vao para o servidor, que ja sabe filtrar —
 * evita trazer o acervo inteiro para peneirar no cliente.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import api from "../services/api"
import { useAuthStore } from "../store/authStore"

export function useBiblioteca() {
  const idTenant = useAuthStore((s) => s.usuario?.id_tenant ?? null)

  const [conteudos, setConteudos] = useState([])
  const [contagem, setContagem] = useState({ TODOS: 0 })
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  // Filtros da tela.
  const [tipoFiltro, setTipoFiltro] = useState("TODOS") // TODOS | AULA | VIDEO...
  const [tagFiltro, setTagFiltro] = useState(null) // null = todas
  const [termo, setTermo] = useState("")

  // Descarta respostas de buscas antigas que chegarem fora de ordem: sem isso,
  // digitar rapido pode fazer o resultado de "can" sobrescrever o de "canvas".
  const requisicaoAtual = useRef(0)

  const carregar = useCallback(async () => {
    if (!idTenant) {
      setCarregando(false)
      return
    }

    const id = ++requisicaoAtual.current
    setCarregando(true)

    try {
      const { data } = await api.get("/conteudos", {
        params: {
          id_tenant: idTenant,
          ...(tipoFiltro !== "TODOS" ? { tipo: tipoFiltro } : {}),
          ...(tagFiltro ? { tag: tagFiltro } : {}),
          ...(termo.trim() ? { termo: termo.trim() } : {}),
        },
      })

      if (id !== requisicaoAtual.current) return // resposta obsoleta

      setConteudos(data.conteudos)
      setContagem(data.contagem)
      setErro(null)
    } catch (err) {
      if (id !== requisicaoAtual.current) return
      setErro(err.response?.data?.erro || "Erro ao carregar a biblioteca.")
    } finally {
      if (id === requisicaoAtual.current) setCarregando(false)
    }
  }, [idTenant, tipoFiltro, tagFiltro, termo])

  // Busca com debounce; filtros de tipo/tag aplicam na hora.
  useEffect(() => {
    const atraso = termo.trim() ? 300 : 0
    const t = setTimeout(carregar, atraso)
    return () => clearTimeout(t)
  }, [carregar, termo])

  // ------------------------------------------------------------------- criar
  const criar = useCallback(
    async (tipo) => {
      // O servidor exige url em LINK e VIDEO; um rascunho vazio desses tipos
      // seria recusado, entao ele nasce com um placeholder que o editor troca.
      const corpo = {
        id_tenant: idTenant,
        tipo,
        titulo: "Sem titulo",
        ...(tipo === "LINK" || tipo === "VIDEO" ? { url: "https://" } : {}),
        ...(tipo === "AULA" ? { blocos: [{ tipo: "paragrafo", texto: "" }] } : {}),
      }

      const { data } = await api.post("/conteudos", corpo)
      setConteudos((lista) => [data.conteudo, ...lista])
      setContagem((c) => ({
        ...c,
        TODOS: (c.TODOS || 0) + 1,
        [tipo]: (c[tipo] || 0) + 1,
      }))
      return data.conteudo
    },
    [idTenant]
  )

  // ------------------------------------------------------------------ editar
  const atualizar = useCallback(async (id, patch) => {
    const { data } = await api.patch(`/conteudos/${id}`, patch)
    setConteudos((lista) =>
      lista.map((c) => (c.id_conteudo === id ? { ...c, ...data.conteudo } : c))
    )
    return data.conteudo
  }, [])

  /** Carrega um conteudo completo (blocos + usos) para abrir no editor. */
  const carregarCompleto = useCallback(async (id) => {
    const { data } = await api.get(`/conteudos/${id}`)
    return data.conteudo
  }, [])

  // ---------------------------------------------------------------- duplicar
  const duplicar = useCallback(
    async (id) => {
      const { data } = await api.post(`/conteudos/${id}/duplicar`)
      await carregar()
      return data.conteudo
    },
    [carregar]
  )

  // ---------------------------------------------------------------- excluir
  /**
   * Exclui um conteudo. O servidor recusa com 409 se ele estiver vinculado a
   * algum passo da trilha — a mensagem vem pronta e e repassada a tela.
   */
  const excluir = useCallback(
    async (id) => {
      try {
        await api.delete(`/conteudos/${id}`)
        await carregar()
        return { ok: true }
      } catch (err) {
        return {
          ok: false,
          erro: err.response?.data?.erro || "Erro ao excluir o conteudo.",
        }
      }
    },
    [carregar]
  )

  return {
    conteudos,
    // `filtrados` existe porque a filtragem antes era local; agora o servidor
    // ja devolve a lista filtrada. Mantido para nao mexer na tela.
    filtrados: conteudos,
    contagem,
    carregando,
    erro,
    tipoFiltro,
    setTipoFiltro,
    tagFiltro,
    setTagFiltro,
    termo,
    setTermo,
    criar,
    atualizar,
    carregarCompleto,
    duplicar,
    excluir,
    recarregar: carregar,
  }
}
