/**
 * O recorte da tela de Tarefas: busca, filtros do painel e os INDICADORES do
 * topo, que tambem filtram.
 *
 * FORA DO COMPONENTE para poder ser testado sem desenhar a tela, e porque as
 * duas visualizacoes (tabela e kanban) leem o mesmo resultado: o filtro e um
 * so, senao trocar de aba mudaria o conjunto sob os pes de quem acabou de
 * filtrar.
 *
 * OS INDICADORES CONTAM NO CLIENTE, sobre a mesma lista que a tela desenha, e
 * nao a partir do GET /tarefas/resumo. A semantica e a mesma do backend (ver
 * tarefaRepository.resumoPorTenant) — aberta e o que nao esta numa coluna de
 * conclusao; atrasada e aberta com prazo antes de hoje —, mas o "hoje" e o de
 * quem esta olhando. O CURRENT_DATE do banco roda em UTC: depois das 21h em
 * Brasilia ele ja e amanha, e o indicador diria "1 atrasada" enquanto o cartao
 * diz "Vence hoje". Contando aqui, o numero do indicador e exatamente o que
 * aparece ao clicar nele.
 */
import { estaAtrasada } from "../../data/tarefaMeta"
import { PREFIXO_FILTRO_EXTRA, casaFiltroCampoExtra } from "../../utils/camposExtras"

/** Quem nao tem responsavel precisa de um id proprio no filtro: "" nao agrupa. */
export const SEM_RESPONSAVEL = "__sem__"

/** A janela do indicador "Concluidas", em dias. */
export const DIAS_CONCLUIDAS = 7

const DIA_MS = 86400000

/** Pela CATEGORIA: e o unico jeito de saber o que e "aberta" sem conhecer as colunas. */
const estaAberta = (t) => t.status_categoria !== "CONCLUIDA"

/**
 * Os recortes dos indicadores. Cada um recebe a tarefa e o contexto
 * `{ idUsuario, agora }` — o `agora` entra por parametro para o teste poder
 * fixar o relogio.
 */
export const RECORTES = {
  abertas: (t) => estaAberta(t),
  atrasadas: (t) => estaAtrasada(t),
  // Sem usuario nao ha "minhas": Number(null) e 0, e casaria com toda tarefa
  // sem responsavel.
  minhas: (t, { idUsuario }) =>
    estaAberta(t) &&
    idUsuario != null &&
    t.id_responsavel != null &&
    Number(t.id_responsavel) === Number(idUsuario),
  // `concluida_ts` e preenchido pelo backend quando a tarefa entra numa coluna
  // de conclusao, e apagado quando ela volta: e a data real da entrega.
  concluidas: (t, { agora = Date.now() }) => {
    if (estaAberta(t) || !t.concluida_ts) return false
    const quando = Date.parse(t.concluida_ts)
    return !Number.isNaN(quando) && quando >= agora - DIAS_CONCLUIDAS * DIA_MS
  },
}

/** Quantas tarefas caem em cada recorte. */
export function contarRecortes(tarefas, contexto = {}) {
  return Object.fromEntries(
    Object.entries(RECORTES).map(([id, casa]) => [
      id,
      tarefas.filter((t) => casa(t, contexto)).length,
    ])
  )
}

/**
 * Aplica busca, recorte do indicador e filtros do painel.
 *
 * @param {Array<object>} tarefas
 * @param {object} opcoes
 * @param {string} [opcoes.busca] - titulo, descricao, responsavel ou startup.
 * @param {object} [opcoes.filtros] - o objeto do PainelFiltros.
 * @param {string|null} [opcoes.recorte] - uma chave de RECORTES.
 * @param {Array<object>} [opcoes.campos] - os campos personalizaveis.
 * @param {object} [opcoes.contexto] - `{ idUsuario, agora }`.
 */
export function filtrarTarefas(
  tarefas,
  { busca = "", filtros = {}, recorte = null, campos = [], contexto = {} } = {}
) {
  const termo = busca.trim().toLowerCase()
  const casaRecorte = recorte ? RECORTES[recorte] : null

  return tarefas.filter((t) => {
    if (termo) {
      const casaTitulo = (t.titulo || "").toLowerCase().includes(termo)
      const casaDescricao = (t.descricao || "").toLowerCase().includes(termo)
      const casaResponsavel = (t.responsavel_nome || "").toLowerCase().includes(termo)
      const casaStartup = (t.startup_nome || "").toLowerCase().includes(termo)
      if (!casaTitulo && !casaDescricao && !casaResponsavel && !casaStartup) return false
    }

    if (casaRecorte && !casaRecorte(t, contexto)) return false

    const statusSel = filtros.status || []
    if (statusSel.length && !statusSel.includes(t.status)) return false

    const prioridadesSel = filtros.prioridade || []
    if (prioridadesSel.length && !prioridadesSel.includes(t.prioridade)) return false

    const responsaveisSel = filtros.responsavel || []
    if (responsaveisSel.length) {
      const chave = t.id_responsavel ? String(t.id_responsavel) : SEM_RESPONSAVEL
      if (!responsaveisSel.includes(chave)) return false
    }

    const startupsSel = filtros.startup || []
    if (startupsSel.length && !startupsSel.includes(String(t.id_startup))) return false

    // O <input type="date"> devolve YYYY-MM-DD e o prazo comeca do mesmo
    // jeito: comparar os dez primeiros caracteres compara as datas sem
    // arrastar fuso horario para dentro do filtro.
    const periodo = filtros.prazo
    if (periodo?.de || periodo?.ate) {
      const dia = (t.prazo || "").slice(0, 10)
      if (!dia) return false
      if (periodo.de && dia < periodo.de) return false
      if (periodo.ate && dia > periodo.ate) return false
    }

    return campos.every((campo) => {
      const selecao = filtros[PREFIXO_FILTRO_EXTRA + campo.chave]
      return casaFiltroCampoExtra(campo, (t.campos_extras || {})[campo.chave], selecao)
    })
  })
}

const paraDataBR = (valor) => (valor ? valor.split("-").reverse().join("/") : "")

/** Os filtros sem um grupo inteiro. */
function semGrupo(filtros, idGrupo) {
  const novos = { ...filtros }
  delete novos[idGrupo]
  return novos
}

/**
 * Os filtros ativos como chips: cada um com o rotulo legivel e a funcao que
 * devolve os filtros SEM ele — o "x" do chip e um desmarcar de um clique.
 *
 * O mesmo vocabulario do resumo dentro do PainelFiltros, para o que esta
 * escrito no chip da tela ser o que estava escrito no painel.
 *
 * @returns {Array<{chave: string, rotulo: string, remover: (filtros: object) => object}>}
 */
export function chipsDosFiltros(grupos, filtros = {}) {
  const chips = []

  grupos.forEach((grupo) => {
    const valor = filtros[grupo.id]
    if (!valor) return
    const prefixo = `${grupo.rotulo}: `

    if (grupo.tipo === "texto" || grupo.tipo === "radio") {
      const item = (grupo.itens || []).find((it) => it.id === valor)
      chips.push({
        chave: grupo.id,
        rotulo: prefixo + (item ? item.rotulo : valor),
        remover: (f) => semGrupo(f, grupo.id),
      })
      return
    }

    if (grupo.tipo === "data" || grupo.tipo === "intervalo") {
      const [de, ate] =
        grupo.tipo === "data"
          ? [paraDataBR(valor.de), paraDataBR(valor.ate)]
          : [valor.min, valor.max].map((v) =>
              v === "" || v == null
                ? ""
                : `${grupo.prefixo || ""}${v}${grupo.sufixo ? ` ${grupo.sufixo}` : ""}`
            )
      const faixa = de && ate ? `${de} – ${ate}` : de ? `a partir de ${de}` : ate ? `até ${ate}` : ""
      if (faixa) {
        chips.push({ chave: grupo.id, rotulo: prefixo + faixa, remover: (f) => semGrupo(f, grupo.id) })
      }
      return
    }

    // Lista de marcar: um chip por item, para desmarcar um sem perder os outros.
    ;(Array.isArray(valor) ? valor : []).forEach((id) => {
      const item = (grupo.itens || []).find((it) => it.id === id)
      chips.push({
        chave: `${grupo.id}:${id}`,
        rotulo: prefixo + (item ? item.rotulo : id),
        remover: (f) => {
          const resto = (f[grupo.id] || []).filter((x) => x !== id)
          return resto.length ? { ...f, [grupo.id]: resto } : semGrupo(f, grupo.id)
        },
      })
    })
  })

  return chips
}
