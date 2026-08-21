/**
 * Hook da tela de Tarefas: a lista, o que ela precisa para se desenhar
 * (pessoas da equipe e startups, para os seletores) e as escritas.
 *
 * TRAZ TUDO DE UMA VEZ, sem paginar. As duas visualizacoes da tela — tabela e
 * kanban — trabalham sobre o mesmo array em memoria, e trocar de uma para a
 * outra nao pode custar uma ida ao servidor: sao dois jeitos de olhar para o
 * mesmo conjunto, nao duas telas.
 *
 * O MOVER E OTIMISTA, e so ele. Arrastar um cartao e um gesto continuo: se o
 * cartao voltasse para o lugar antigo e pulasse para o novo meio segundo
 * depois, o quadro pareceria estar brigando com quem o usa. As demais escritas
 * (criar, editar, excluir) acontecem num painel, com botao e estado de
 * "salvando", onde esperar a resposta e o comportamento certo.
 *
 * Endpoints:
 *   GET    /tarefas?id_tenant=            -> a lista, com o vocabulario resolvido
 *   GET    /tarefas/resumo?id_tenant=     -> os numeros do topo e o ESCOPO da lista
 *   GET    /tarefas/:id?id_tenant=        -> a tarefa completa, com os anexos
 *   POST   /tarefas                       -> cria
 *   PUT    /tarefas/:id                   -> atualiza
 *   PATCH  /tarefas/:id/mover             -> o arrasto do kanban
 *   DELETE /tarefas/:id?id_tenant=        -> exclui
 *   GET    /tarefas/equipe?id_tenant=     -> a equipe, para o seletor de responsavel
 *   GET    /startups?id_tenant=           -> as startups, para o vinculo opcional
 */
import { useCallback, useEffect, useState } from "react"
import api from "../services/api"

export function useTarefas(idTenant) {
  const [tarefas, setTarefas] = useState([])
  // Os numeros do topo. `escopo` diz se a lista e o quadro inteiro ("TODAS") ou
  // so o que e desta pessoa ("MINHAS") — quem nao tem a chave
  // `tarefas.tarefas.visualizar` cai no segundo, e a tela precisa avisar em vez
  // de deixar parecer que a incubadora so tem tres tarefas.
  const [resumo, setResumo] = useState(null)
  const [pessoas, setPessoas] = useState([])
  const [startups, setStartups] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const carregar = useCallback(async () => {
    if (!idTenant) {
      setTarefas([])
      setCarregando(false)
      return
    }
    setCarregando(true)
    setErro(null)
    try {
      // As tres em paralelo. A das startups tolera falha: ela exige
      // `startups.startups.visualizar`, e quem nao tem continua enxergando o
      // quadro — perde o seletor de startup, nao a tela. A da equipe nao
      // precisa de guarda: e a mesma chave da lista de tarefas.
      const [respTarefas, respResumo, respPessoas, respStartups] = await Promise.all([
        api.get("/tarefas", { params: { id_tenant: idTenant } }),
        api.get("/tarefas/resumo", { params: { id_tenant: idTenant } }),
        api.get("/tarefas/equipe", { params: { id_tenant: idTenant } }),
        api.get("/startups", { params: { id_tenant: idTenant } }).catch(() => null),
      ])
      setTarefas(respTarefas.data.tarefas)
      setResumo(respResumo.data)
      setPessoas(respPessoas.data.pessoas || [])
      setStartups(respStartups?.data?.startups || [])
    } catch (err) {
      setErro(err.response?.data?.erro || "Não foi possível carregar as tarefas.")
      setTarefas([])
    } finally {
      setCarregando(false)
    }
  }, [idTenant])

  useEffect(() => {
    carregar()
  }, [carregar])

  /**
   * A tarefa COMPLETA, para abrir na edicao.
   *
   * A listagem nao traz os anexos (so a contagem): abrir o painel com o que a
   * linha tem faria o salvar apagar a lista de anexos, exatamente como
   * acontecia com os contatos no cadastro de startup.
   */
  const carregarCompleta = useCallback(
    async (idTarefa) => {
      const { data } = await api.get(`/tarefas/${idTarefa}`, { params: { id_tenant: idTenant } })
      return data.tarefa
    },
    [idTenant]
  )

  const criar = useCallback(
    async (dados) => {
      const { data } = await api.post("/tarefas", { ...dados, id_tenant: idTenant })
      await carregar()
      return data.tarefa
    },
    [idTenant, carregar]
  )

  const atualizar = useCallback(
    async (idTarefa, dados) => {
      const { data } = await api.put(`/tarefas/${idTarefa}`, { ...dados, id_tenant: idTenant })
      await carregar()
      return data.tarefa
    },
    [idTenant, carregar]
  )

  const excluir = useCallback(
    async (idTarefa) => {
      await api.delete(`/tarefas/${idTarefa}`, { params: { id_tenant: idTenant } })
      await carregar()
    },
    [idTenant, carregar]
  )

  /**
   * Move uma tarefa de coluna/posicao — o arrasto do kanban.
   *
   * Pinta a tela primeiro e chama a API depois. Se a chamada falhar, RECARREGA:
   * desfazer "na mao" exigiria guardar a posicao anterior de todo mundo, e a
   * verdade do servidor e mais barata e mais confiavel que essa contabilidade.
   *
   * @param {number} idTarefa
   * @param {string} status - a coluna de destino.
   * @param {number} ordem - a posicao na coluna, contando a lista SEM esta
   *   tarefa. E o mesmo indice que o backend espera (ver tarefaRepository.mover).
   */
  const mover = useCallback(
    async (idTarefa, status, ordem) => {
      setTarefas((atuais) => {
        const tarefa = atuais.find((t) => t.id_tarefa === idTarefa)
        if (!tarefa) return atuais

        // A lista da coluna de destino sem a tarefa, com ela reinserida na
        // posicao pedida — o mesmo calculo que o backend fara, para a tela nao
        // piscar quando a resposta chegar.
        const destino = atuais.filter((t) => t.status === status && t.id_tarefa !== idTarefa)
        const movida = { ...tarefa, status }
        destino.splice(Math.max(0, Math.min(ordem, destino.length)), 0, movida)
        const posicoes = new Map(destino.map((t, i) => [t.id_tarefa, i]))

        return atuais.map((t) => {
          if (t.id_tarefa === idTarefa) return { ...movida, ordem: posicoes.get(idTarefa) }
          return posicoes.has(t.id_tarefa) ? { ...t, ordem: posicoes.get(t.id_tarefa) } : t
        })
      })

      try {
        await api.patch(`/tarefas/${idTarefa}/mover`, { id_tenant: idTenant, status, ordem })
        // Recarrega mesmo no sucesso: o `status_rotulo`, a cor e o
        // `concluida_ts` da tarefa movida sao derivados no backend, e a tela
        // otimista nao tem como calcula-los.
        await carregar()
      } catch (err) {
        // Recarrega e RELANCA. O recarregar desfaz o otimismo (a verdade do
        // servidor e mais barata que guardar a posicao anterior de todo mundo);
        // o relance existe porque a acao em massa precisa contar quantas
        // falharam, e um erro engolido aqui a faria anunciar sucesso sempre.
        // Quem chama decide como mostrar.
        await carregar()
        throw err
      }
    },
    [idTenant, carregar]
  )

  /**
   * Move VARIAS tarefas para a mesma coluna — a acao em massa da tabela.
   *
   * Existe separada de `mover` por causa do recarregamento: `mover` recarrega a
   * lista a cada chamada (o que e certo para um arrasto, onde a resposta precisa
   * trazer os campos derivados de volta na hora), e chama-la em laco para 20
   * tarefas dispararia 20 recarregamentos da tela inteira em paralelo. Aqui as
   * escritas vao juntas e o recarregamento acontece uma vez, no fim.
   *
   * Sem otimismo: a acao sai de um popover com botao e estado de "aplicando", e
   * nao de um gesto continuo — esperar e o comportamento certo.
   *
   * @returns {Promise<{movidas: number, falhas: number, erro?: string}>}
   */
  const moverVarias = useCallback(
    async (ids, status, ordem) => {
      const resultados = await Promise.allSettled(
        ids.map((id) => api.patch(`/tarefas/${id}/mover`, { id_tenant: idTenant, status, ordem }))
      )
      await carregar()

      const falhas = resultados.filter((r) => r.status === "rejected")
      return {
        movidas: resultados.length - falhas.length,
        falhas: falhas.length,
        erro: falhas[0]?.reason?.response?.data?.erro,
      }
    },
    [idTenant, carregar]
  )

  return {
    tarefas,
    resumo,
    pessoas,
    startups,
    carregando,
    erro,
    limparErro: () => setErro(null),
    recarregar: carregar,
    carregarCompleta,
    criar,
    atualizar,
    excluir,
    mover,
    moverVarias,
  }
}
