/**
 * Estado e operacoes do Construtor de Programa.
 *
 * Le e grava na API (/trilha). Antes a arvore vivia so em memoria: dava F5 e
 * tudo voltava ao mock.
 *
 * Como a arvore e um recurso do servidor, as mutacoes seguem o padrao
 * "manda e recarrega": cada acao chama a API e refaz o fetch da arvore. E mais
 * simples e mais correto que remendar a arvore local — o servidor calcula
 * ordem, valida hierarquia e pode recusar a operacao, e qualquer tentativa de
 * prever isso no cliente acabaria divergindo.
 *
 * A excecao e `atualizar` (edicao de campos no inspector), que aplica a
 * resposta no no correspondente sem refetch: e a acao mais frequente e nao
 * mexe na estrutura.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import api from "../services/api"
import { useAuthStore } from "../store/authStore"
import { acharNo, caminhoAte, percorrer } from "../data/trilhaMeta"

export function usePrograma() {
  const idTenant = useAuthStore((s) => s.usuario?.id_tenant ?? null)

  const [programa, setPrograma] = useState(null) // no raiz (PROGRAMA)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const [selecionadoId, setSelecionadoId] = useState(null)
  const [expandidos, setExpandidos] = useState({})

  // ---------------------------------------------------------------- carregar
  const carregar = useCallback(async () => {
    if (!idTenant) {
      setCarregando(false)
      return null
    }

    try {
      const { data } = await api.get("/trilha", { params: { id_tenant: idTenant } })
      const raiz = data.trilha[0] ?? null
      setPrograma(raiz)
      setErro(null)
      return raiz
    } catch (err) {
      setErro(err.response?.data?.erro || "Erro ao carregar a trilha.")
      return null
    } finally {
      setCarregando(false)
    }
  }, [idTenant])

  useEffect(() => {
    carregar()
  }, [carregar])

  /**
   * Cria o programa raiz quando o tenant ainda nao tem trilha nenhuma.
   * A arvore precisa de uma raiz antes de aceitar fases.
   */
  const criarPrograma = useCallback(
    async (nome = "Trilha de Incubacao") => {
      const { data } = await api.post("/trilha", { id_tenant: idTenant, nome })
      await carregar()
      return data.no
    },
    [idTenant, carregar]
  )

  // ------------------------------------------------------------------ selecao
  const selecionado = useMemo(() => {
    if (!programa || !selecionadoId || selecionadoId === programa.id_no) return null
    return acharNo([programa], selecionadoId)
  }, [programa, selecionadoId])

  // Cadeia de ancestrais do no selecionado (para o breadcrumb), sem a raiz.
  const trilha = useMemo(() => {
    if (!programa || !selecionadoId) return []
    return (caminhoAte([programa], selecionadoId) ?? []).slice(1)
  }, [programa, selecionadoId])

  // ------------------------------------------------------- expandir/recolher
  const alternarExpandido = useCallback((id) => {
    setExpandidos((e) => ({ ...e, [id]: !e[id] }))
  }, [])

  const expandirTodos = useCallback(() => {
    if (!programa) return
    const ids = {}
    percorrer([programa], (no) => {
      if (no.filhos?.length) ids[no.id_no] = true
    })
    setExpandidos(ids)
  }, [programa])

  const recolherTodos = useCallback(() => setExpandidos({}), [])

  // ------------------------------------------------------------------- criar
  /**
   * Cria um filho no pai informado. O tipo do no e deduzido pelo servidor a
   * partir do pai, entao o cliente nao precisa (nem pode) escolher o nivel.
   * @returns o id do no criado, ou null se falhou.
   */
  const adicionar = useCallback(
    async (parentId, _tipoFilho, nome = "") => {
      try {
        const { data } = await api.post("/trilha", {
          id_tenant: idTenant,
          id_pai: parentId ?? programa?.id_no ?? null,
          nome: nome || "Sem titulo",
        })
        await carregar()
        if (parentId) setExpandidos((e) => ({ ...e, [parentId]: true }))
        setSelecionadoId(data.no.id_no)
        return data.no.id_no
      } catch (err) {
        setErro(err.response?.data?.erro || "Erro ao criar o item.")
        return null
      }
    },
    [idTenant, programa, carregar]
  )

  // ------------------------------------------------------------------ editar
  /**
   * Aplica um patch a um no. Atualiza so o no afetado, sem refetch — e a acao
   * mais frequente do inspector e nao altera a estrutura da arvore.
   */
  const atualizar = useCallback(async (id, patch) => {
    const { data } = await api.patch(`/trilha/${id}`, patch)

    setPrograma((raiz) => {
      if (!raiz) return raiz
      const aplicar = (no) =>
        no.id_no === id
          ? { ...no, ...data.no, filhos: no.filhos }
          : { ...no, filhos: (no.filhos ?? []).map(aplicar) }
      return aplicar(raiz)
    })

    return data.no
  }, [])

  const alternarAtivo = useCallback(
    async (id) => {
      const no = programa ? acharNo([programa], id) : null
      if (no) await atualizar(id, { ativo: !no.ativo })
    },
    [programa, atualizar]
  )

  // ---------------------------------------------------------------- excluir
  /**
   * Remove o no (e sua subarvore, por cascata no banco).
   * Nao ha "Desfazer": recriar a subarvore geraria ids novos e as entregas
   * das startups apontariam para nos que nao existem mais.
   */
  const excluir = useCallback(
    async (id) => {
      try {
        await api.delete(`/trilha/${id}`)
        if (selecionadoId === id) setSelecionadoId(null)
        await carregar()
        return { ok: true }
      } catch (err) {
        return { ok: false, erro: err.response?.data?.erro || "Erro ao excluir." }
      }
    },
    [selecionadoId, carregar]
  )

  // -------------------------------------------------------------- reordenar
  /**
   * Reordena por drag and drop: move `dragId` para a posicao de `dropId`.
   * So reordena entre irmaos; o servidor exige a lista completa de filhos.
   */
  const reordenar = useCallback(
    async (dragId, dropId) => {
      if (!programa || dragId === dropId) return

      const caminhoDrag = caminhoAte([programa], dragId)
      const caminhoDrop = caminhoAte([programa], dropId)
      if (!caminhoDrag || !caminhoDrop) return

      const paiDrag = caminhoDrag[caminhoDrag.length - 2]
      const paiDrop = caminhoDrop[caminhoDrop.length - 2]
      if (!paiDrag || !paiDrop || paiDrag.id_no !== paiDrop.id_no) return // pais diferentes

      const ids = paiDrag.filhos.map((f) => f.id_no)
      const de = ids.indexOf(dragId)
      const para = ids.indexOf(dropId)
      ids.splice(para, 0, ...ids.splice(de, 1))

      try {
        await api.patch(`/trilha/${paiDrag.id_no}/filhos/ordem`, { ids })
        await carregar()
      } catch (err) {
        setErro(err.response?.data?.erro || "Erro ao reordenar.")
      }
    },
    [programa, carregar]
  )

  // ---------------------------------------------------------------- duplicar
  /**
   * Duplica um no copiando seus campos. A copia entra no fim da lista de
   * irmaos; a subarvore NAO e copiada (o servidor nao tem essa operacao, e
   * duplicar recursivamente do cliente geraria uma cascata de chamadas).
   */
  const duplicar = useCallback(
    async (id) => {
      if (!programa) return
      const no = acharNo([programa], id)
      const caminho = caminhoAte([programa], id)
      if (!no || !caminho) return

      const pai = caminho[caminho.length - 2]
      if (!pai) return

      try {
        const { data } = await api.post("/trilha", {
          id_tenant: idTenant,
          id_pai: pai.id_no,
          nome: `${no.nome} (copia)`,
          descricao: no.descricao,
          ...(no.tipo === "PASSO" && {
            tipo_passo: no.tipo_passo,
            permite_entrega: no.permite_entrega,
            obrigatoria: no.obrigatoria,
            prazo: no.prazo,
            carga_horaria: no.carga_horaria,
            entregavel: no.entregavel,
          }),
        })
        await carregar()
        setSelecionadoId(data.no.id_no)
      } catch (err) {
        setErro(err.response?.data?.erro || "Erro ao duplicar.")
      }
    },
    [programa, idTenant, carregar]
  )

  // ------------------------------------------------------------------ busca
  /**
   * Filtra a arvore por termo (nos que casam ou que possuem descendente que
   * casa). Feito no cliente: a arvore inteira ja esta carregada, e ir ao
   * servidor a cada tecla seria pior.
   * @returns { programa, matchIds } — matchIds sao os nos que casam direto.
   */
  const filtrar = useCallback(
    (termo) => {
      const t = termo.trim().toLowerCase()
      if (!t || !programa) return { programa, matchIds: null }

      const matchIds = new Set()

      const filtrarNo = (no) => {
        const casa = no.nome.toLowerCase().includes(t)
        const filhos = (no.filhos ?? []).map(filtrarNo).filter(Boolean)
        if (casa) matchIds.add(no.id_no)
        if (casa || filhos.length) return { ...no, filhos }
        return null
      }

      const filhos = (programa.filhos ?? []).map(filtrarNo).filter(Boolean)
      return { programa: { ...programa, filhos }, matchIds }
    },
    [programa]
  )

  return {
    programa,
    carregando,
    erro,
    setErro,
    selecionadoId,
    selecionado,
    trilha,
    expandidos,
    setSelecionadoId,
    alternarExpandido,
    expandirTodos,
    recolherTodos,
    criarPrograma,
    adicionar,
    atualizar,
    alternarAtivo,
    excluir,
    duplicar,
    reordenar,
    filtrar,
    recarregar: carregar,
  }
}
