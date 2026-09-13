/**
 * Estado e operacoes do Construtor de Programa.
 *
 * Le e grava na API (/trilha). Antes a arvore vivia so em memoria: dava F5 e
 * tudo voltava ao mock.
 *
 * VARIAS TRILHAS
 * A incubadora pode ter N trilhas. O banco sempre permitiu (cada uma e um no
 * raiz PROGRAMA, e a API devolvia uma lista); quem limitava a uma era este
 * hook, com `data.trilha[0]`. Agora o estado tem duas camadas:
 *
 *   programas[]      -> as trilhas do tenant (so a raiz + contagens), para o
 *                       seletor da Toolbar
 *   programa         -> a arvore INTEIRA da trilha ativa, carregada sob
 *                       demanda por /trilha/programas/:id
 *
 * Carregar so a trilha aberta importa: com cinco trilhas de doze passos, o
 * `GET /trilha?id_tenant=` traria as cinco arvores a cada F5 para exibir uma.
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

// Lembra a ultima trilha aberta, por tenant. Sem isto, todo F5 volta para a
// padrao e quem esta montando a segunda trilha perde o lugar a cada recarga.
const chaveUltima = (idTenant) => `quiron.construtor.trilha.${idTenant}`

export function usePrograma() {
  const idTenant = useAuthStore((s) => s.usuario?.id_tenant ?? null)

  const [programas, setProgramas] = useState([]) // trilhas do tenant (so raiz)
  const [programaAtivoId, setProgramaAtivoId] = useState(null)
  const [programa, setPrograma] = useState(null) // arvore da trilha ativa
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const [selecionadoId, setSelecionadoId] = useState(null)
  const [expandidos, setExpandidos] = useState({})

  // ------------------------------------------------------- lista de trilhas
  /**
   * Carrega as trilhas do tenant e decide qual abrir: a ultima usada, senao a
   * marcada como padrao, senao a primeira.
   * @returns {Promise<number|null>} o id da trilha ativa.
   */
  const carregarProgramas = useCallback(
    async (preferido) => {
      if (!idTenant) return null

      const { data } = await api.get("/trilha/programas", {
        params: { id_tenant: idTenant },
      })
      setProgramas(data.programas)

      const existe = (id) => data.programas.some((p) => Number(p.id_no) === Number(id))

      const lembrado = localStorage.getItem(chaveUltima(idTenant))
      const escolhido =
        (preferido && existe(preferido) && Number(preferido)) ||
        (lembrado && existe(lembrado) && Number(lembrado)) ||
        data.programas.find((p) => p.padrao)?.id_no ||
        data.programas[0]?.id_no ||
        null

      setProgramaAtivoId(escolhido)
      return escolhido
    },
    [idTenant]
  )

  // ---------------------------------------------------------------- carregar
  /**
   * Carrega a arvore da trilha ativa. Sem id, resolve a lista antes — e o
   * caminho da primeira renderizacao e de qualquer acao que mexa na estrutura.
   */
  const carregar = useCallback(
    async (idPrograma) => {
      if (!idTenant) {
        setCarregando(false)
        return null
      }

      try {
        const alvo = idPrograma ?? (await carregarProgramas())
        if (!alvo) {
          setPrograma(null)
          setErro(null)
          return null
        }

        const { data } = await api.get(`/trilha/programas/${alvo}`)
        setPrograma(data.trilha)
        setErro(null)
        return data.trilha
      } catch (err) {
        setErro(err.response?.data?.erro || "Erro ao carregar a trilha.")
        return null
      } finally {
        setCarregando(false)
      }
    },
    [idTenant, carregarProgramas]
  )

  useEffect(() => {
    carregar()
  }, [carregar])

  /** Troca a trilha aberta no Construtor. */
  const selecionarPrograma = useCallback(
    async (id) => {
      if (!id || Number(id) === Number(programaAtivoId)) return
      setCarregando(true)
      setProgramaAtivoId(id)
      setSelecionadoId(null)
      setExpandidos({})
      localStorage.setItem(chaveUltima(idTenant), String(id))
      await carregar(id)
    },
    [programaAtivoId, idTenant, carregar]
  )

  /**
   * Cria uma trilha nova (no raiz) e ja a abre.
   * Serve tanto para o tenant que ainda nao tem nenhuma quanto para a segunda
   * em diante — do lado do servidor e a mesma operacao: um POST sem id_pai.
   */
  const criarPrograma = useCallback(
    async (nome = "Trilha de Incubação") => {
      const { data } = await api.post("/trilha", { id_tenant: idTenant, nome })
      localStorage.setItem(chaveUltima(idTenant), String(data.no.id_no))
      await carregarProgramas(data.no.id_no)
      await carregar(data.no.id_no)
      return data.no
    },
    [idTenant, carregarProgramas, carregar]
  )

  /**
   * Marca a trilha como padrao — a que vem pre-selecionada no cadastro de
   * startup. Nao mexe em quem ja esta matriculado.
   */
  const definirPadrao = useCallback(
    async (id) => {
      try {
        await api.patch(`/trilha/${id}/padrao`)
        await carregarProgramas(programaAtivoId)
        return { ok: true }
      } catch (err) {
        return {
          ok: false,
          erro: err.response?.data?.erro || "Erro ao definir a trilha padrão.",
        }
      }
    },
    [carregarProgramas, programaAtivoId]
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
          nome: nome || "Sem título",
        })
        await carregar(programaAtivoId)
        if (parentId) setExpandidos((e) => ({ ...e, [parentId]: true }))
        setSelecionadoId(data.no.id_no)
        return data.no.id_no
      } catch (err) {
        setErro(err.response?.data?.erro || "Erro ao criar o item.")
        return null
      }
    },
    [idTenant, programa, carregar, programaAtivoId]
  )

  // ------------------------------------------------------------------ editar
  /**
   * Aplica um patch a um no. Atualiza so o no afetado, sem refetch — e a acao
   * mais frequente do inspector e nao altera a estrutura da arvore.
   */
  const atualizar = useCallback(
    async (id, patch) => {
      const { data } = await api.patch(`/trilha/${id}`, patch)

      setPrograma((raiz) => {
        if (!raiz) return raiz
        const aplicar = (no) =>
          no.id_no === id
            ? { ...no, ...data.no, filhos: no.filhos }
            : { ...no, filhos: (no.filhos ?? []).map(aplicar) }
        return aplicar(raiz)
      })

      // Renomear a raiz muda o rotulo no seletor de trilhas, que le da lista
      // e nao da arvore — sem isto o seletor fica com o nome antigo ate o F5.
      if (data.no.tipo === "PROGRAMA") {
        setProgramas((lista) =>
          lista.map((p) =>
            Number(p.id_no) === Number(id) ? { ...p, ...data.no } : p
          )
        )
      }

      return data.no
    },
    []
  )

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

        // Excluir a raiz apaga a trilha inteira: nao ha o que recarregar nela,
        // e sim uma lista a refazer e outra trilha a abrir.
        if (Number(id) === Number(programaAtivoId)) {
          localStorage.removeItem(chaveUltima(idTenant))
          setSelecionadoId(null)
          setExpandidos({})
          const proximo = await carregarProgramas()
          await carregar(proximo)
        } else {
          await carregar(programaAtivoId)
        }
        return { ok: true }
      } catch (err) {
        return { ok: false, erro: err.response?.data?.erro || "Erro ao excluir." }
      }
    },
    [selecionadoId, carregar, carregarProgramas, programaAtivoId, idTenant]
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
        await carregar(programaAtivoId)
      } catch (err) {
        setErro(err.response?.data?.erro || "Erro ao reordenar.")
      }
    },
    [programa, carregar, programaAtivoId]
  )

  // ---------------------------------------------------------------- duplicar
  /**
   * Duplica um no com TUDO que esta dentro dele.
   *
   * A copia da subarvore acontece no servidor, numa transacao
   * (POST /trilha/:id/duplicar). Antes isto era um POST daqui que copiava so
   * os campos do proprio no: duplicar uma fase devolvia uma fase vazia
   * chamada "(copia)", e quem queria a fase inteira remontava os modulos e
   * passos a mao.
   *
   * Duplicar a RAIZ cria outra trilha do tenant. Ai muda a lista do seletor e
   * a copia e uma arvore que ainda nao esta carregada, entao o caminho e o
   * mesmo de criar uma trilha: recarrega a lista e abre a nova.
   */
  const duplicar = useCallback(
    async (id) => {
      try {
        const { data } = await api.post(`/trilha/${id}/duplicar`)

        if (data.no.tipo === "PROGRAMA") {
          localStorage.setItem(chaveUltima(idTenant), String(data.no.id_no))
          setSelecionadoId(null)
          setExpandidos({})
          await carregarProgramas(data.no.id_no)
          await carregar(data.no.id_no)
        } else {
          await carregar(programaAtivoId)
          setSelecionadoId(data.no.id_no)
        }

        return { ok: true, no: data.no }
      } catch (err) {
        const erro = err.response?.data?.erro || "Erro ao duplicar."
        setErro(erro)
        return { ok: false, erro }
      }
    },
    [idTenant, carregar, carregarProgramas, programaAtivoId]
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

  // Refaz so a LISTA de trilhas, mantendo a aberta. Usado quando muda algo
  // que aparece no rotulo do seletor (a contagem de startups, por exemplo)
  // mas nao mexe na arvore — recarregar a arvore ali seria desperdicio.
  const recarregarProgramas = useCallback(
    () => carregarProgramas(programaAtivoId),
    [carregarProgramas, programaAtivoId]
  )

  return {
    programa,
    programas,
    programaAtivoId,
    selecionarPrograma,
    definirPadrao,
    recarregarProgramas,
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
