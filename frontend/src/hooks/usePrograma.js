/**
 * Estado e operacoes do Construtor de Programa.
 *
 * Mantem a arvore (Programa -> Fases -> Modulos -> Tarefas) em memoria e expoe
 * acoes imutaveis para criar, editar, mover, reordenar e excluir nos, alem de
 * selecao, undo de exclusao e expandir/recolher. Sem backend: tudo local.
 *
 * A arvore e aninhada (filhos dentro do pai); os helpers abaixo localizam e
 * transformam nos por id, sempre retornando novas referencias para o React
 * reagir e o framer-motion animar.
 */
import { useCallback, useMemo, useState } from "react"
import { PROGRAMA_INICIAL, TIPO_META, criarNo, novoId } from "../data/programaMock"

// Clona um no (e toda a subarvore) atribuindo novos ids a cada nivel.
function clonarComNovosIds(no) {
  const meta = TIPO_META[no.tipo]
  const copia = { ...no, id: novoId(no.tipo) }
  if (meta.childKey) copia[meta.childKey] = no[meta.childKey].map(clonarComNovosIds)
  return copia
}

// Reindexa o campo `ordem` (1..n) apos qualquer insercao/remocao/reordenacao.
const reindexar = (lista) => lista.map((no, i) => ({ ...no, ordem: i + 1 }))

/**
 * Percorre a arvore procurando um no por id, devolvendo o contexto necessario
 * para editar (lista de irmaos, indice e cadeia de ancestrais ate o programa).
 * @returns {{ no, siblings, index, ancestrais }| null}
 */
function localizar(programa, id) {
  const visitar = (no, ancestrais, siblings, index) => {
    if (no.id === id) return { no, siblings, index, ancestrais }
    const meta = TIPO_META[no.tipo]
    const filhos = meta.childKey ? no[meta.childKey] : null
    if (!filhos) return null
    for (let i = 0; i < filhos.length; i++) {
      const achou = visitar(filhos[i], [...ancestrais, no], filhos, i)
      if (achou) return achou
    }
    return null
  }
  const filhos = programa.fases
  for (let i = 0; i < filhos.length; i++) {
    const achou = visitar(filhos[i], [programa], filhos, i)
    if (achou) return achou
  }
  return null
}

/**
 * Retorna uma copia da arvore com `transform` aplicado a lista de filhos do
 * pai indicado (ou a lista de fases quando parentId e null/raiz).
 */
function transformarFilhos(programa, parentId, transform) {
  if (parentId == null || parentId === programa.id) {
    return { ...programa, fases: transform(programa.fases) }
  }
  const recurse = (no) => {
    const meta = TIPO_META[no.tipo]
    if (!meta.childKey) return no
    const filhos = no[meta.childKey]
    if (no.id === parentId) {
      return { ...no, [meta.childKey]: transform(filhos) }
    }
    return { ...no, [meta.childKey]: filhos.map(recurse) }
  }
  return { ...programa, fases: programa.fases.map(recurse) }
}

// Aplica um patch (merge raso) ao no de id informado, em qualquer nivel.
function patchNo(programa, id, patch) {
  const recurse = (no) => {
    if (no.id === id) return { ...no, ...patch }
    const meta = TIPO_META[no.tipo]
    if (!meta.childKey) return no
    return { ...no, [meta.childKey]: no[meta.childKey].map(recurse) }
  }
  if (programa.id === id) return { ...programa, ...patch }
  return { ...programa, fases: programa.fases.map(recurse) }
}

export function usePrograma() {
  const [programa, setPrograma] = useState(PROGRAMA_INICIAL)
  const [selecionadoId, setSelecionadoId] = useState(null)
  const [expandidos, setExpandidos] = useState(() => ({ "fase-1": true, "modulo-1": true }))

  // ------------------------------------------------------------------ selecao
  const selecionado = useMemo(() => {
    if (!selecionadoId || selecionadoId === programa.id) return null
    return localizar(programa, selecionadoId)?.no ?? null
  }, [programa, selecionadoId])

  // Cadeia de ancestrais do no selecionado (para o breadcrumb).
  const trilha = useMemo(() => {
    if (!selecionadoId) return []
    const ctx = localizar(programa, selecionadoId)
    if (!ctx) return []
    return [...ctx.ancestrais.slice(1), ctx.no] // remove o "programa" raiz
  }, [programa, selecionadoId])

  // ------------------------------------------------------------- expandir/recolher
  const alternarExpandido = useCallback((id) => {
    setExpandidos((e) => ({ ...e, [id]: !e[id] }))
  }, [])

  const expandirTodos = useCallback(() => {
    const ids = {}
    const visitar = (no) => {
      const meta = TIPO_META[no.tipo]
      if (!meta.childKey) return
      ids[no.id] = true
      no[meta.childKey].forEach(visitar)
    }
    programa.fases.forEach(visitar)
    setExpandidos(ids)
  }, [programa])

  const recolherTodos = useCallback(() => setExpandidos({}), [])

  // ------------------------------------------------------------------- criar
  /**
   * Cria um filho no pai informado. Para uma fase nova, parentId = null.
   * Seleciona automaticamente o no criado e expande o pai.
   * @returns o id do no criado.
   */
  const adicionar = useCallback(
    (parentId, tipoFilho, nome = "") => {
      let novoIdCriado = null
      setPrograma((prog) =>
        transformarFilhos(prog, parentId, (lista) => {
          const no = criarNo(tipoFilho, lista.length + 1, nome)
          novoIdCriado = no.id
          return reindexar([...lista, no])
        })
      )
      if (parentId) setExpandidos((e) => ({ ...e, [parentId]: true }))
      setSelecionadoId(novoIdCriado)
      return novoIdCriado
    },
    []
  )

  // ------------------------------------------------------------------ editar
  const atualizar = useCallback((id, patch) => {
    setPrograma((prog) => patchNo(prog, id, patch))
  }, [])

  const alternarAtivo = useCallback(
    (id) => {
      const ctx = localizar(programa, id)
      if (ctx) atualizar(id, { ativo: !ctx.no.ativo })
    },
    [programa, atualizar]
  )

  // ---------------------------------------------------------------- excluir
  /**
   * Remove o no e devolve um snapshot { no, parentId, index } para permitir o
   * "Desfazer". Nao usa o estado antigo: recalcula o pai na hora.
   */
  const excluir = useCallback(
    (id) => {
      const ctx = localizar(programa, id)
      if (!ctx) return null
      const parentId = ctx.ancestrais[ctx.ancestrais.length - 1].id
      const snapshot = { no: ctx.no, parentId, index: ctx.index }
      setPrograma((prog) =>
        transformarFilhos(prog, parentId, (lista) =>
          reindexar(lista.filter((n) => n.id !== id))
        )
      )
      if (selecionadoId === id) setSelecionadoId(null)
      return snapshot
    },
    [programa, selecionadoId]
  )

  // Reinsere um no removido na posicao original (usado pelo Desfazer).
  const restaurar = useCallback((snapshot) => {
    if (!snapshot) return
    const { no, parentId, index } = snapshot
    setPrograma((prog) =>
      transformarFilhos(prog, parentId, (lista) => {
        const nova = [...lista]
        nova.splice(Math.min(index, nova.length), 0, no)
        return reindexar(nova)
      })
    )
    setSelecionadoId(no.id)
  }, [])

  // ---------------------------------------------------------------- duplicar
  // Duplica o no logo abaixo do original, com "(copia)" no nome.
  const duplicar = useCallback(
    (id) => {
      const ctx = localizar(programa, id)
      if (!ctx) return
      const parentId = ctx.ancestrais[ctx.ancestrais.length - 1].id
      const copia = clonarComNovosIds({ ...ctx.no, nome: `${ctx.no.nome} (copia)` })
      setPrograma((prog) =>
        transformarFilhos(prog, parentId, (lista) => {
          const nova = [...lista]
          nova.splice(ctx.index + 1, 0, copia)
          return reindexar(nova)
        })
      )
      setSelecionadoId(copia.id)
    },
    [programa]
  )

  // -------------------------------------------------------------- reordenar
  /**
   * Reordena por drag and drop: move `dragId` para a posicao de `dropId`.
   * So reordena entre irmaos (mesmo pai); ignora tipos diferentes.
   */
  const reordenar = useCallback(
    (dragId, dropId) => {
      if (dragId === dropId) return
      const ctxDrag = localizar(programa, dragId)
      const ctxDrop = localizar(programa, dropId)
      if (!ctxDrag || !ctxDrop) return
      if (ctxDrag.no.tipo !== ctxDrop.no.tipo) return
      if (ctxDrag.siblings !== ctxDrop.siblings) return // pais diferentes
      const parentId = ctxDrag.ancestrais[ctxDrag.ancestrais.length - 1].id
      setPrograma((prog) =>
        transformarFilhos(prog, parentId, (lista) => {
          const nova = [...lista]
          const [movido] = nova.splice(ctxDrag.index, 1)
          const alvo = nova.findIndex((n) => n.id === dropId)
          nova.splice(alvo, 0, movido)
          return reindexar(nova)
        })
      )
    },
    [programa]
  )

  // ------------------------------------------------------------------ busca
  // Filtra a arvore por termo (nos que casam ou que possuem descendente que
  // casa). Retorna { fases, matchIds } — matchIds sao os nos que casam direto.
  const filtrar = useCallback(
    (termo) => {
      const t = termo.trim().toLowerCase()
      if (!t) return { programa, matchIds: null }
      const matchIds = new Set()
      const filtrarNo = (no) => {
        const meta = TIPO_META[no.tipo]
        const casa = no.nome.toLowerCase().includes(t)
        const filhos = meta.childKey ? no[meta.childKey] : null
        const filhosFiltrados = filhos
          ? filhos.map(filtrarNo).filter(Boolean)
          : null
        if (casa) matchIds.add(no.id)
        if (casa || (filhosFiltrados && filhosFiltrados.length)) {
          return meta.childKey
            ? { ...no, [meta.childKey]: filhosFiltrados }
            : no
        }
        return null
      }
      const fases = programa.fases.map(filtrarNo).filter(Boolean)
      return { programa: { ...programa, fases }, matchIds }
    },
    [programa]
  )

  return {
    programa,
    selecionadoId,
    selecionado,
    trilha,
    expandidos,
    setSelecionadoId,
    alternarExpandido,
    expandirTodos,
    recolherTodos,
    adicionar,
    atualizar,
    alternarAtivo,
    excluir,
    restaurar,
    duplicar,
    reordenar,
    filtrar,
  }
}
