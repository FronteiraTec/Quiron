/**
 * O recorte da tela de Tarefas (filtrosTarefas.js).
 *
 * O que importa garantir: o numero de cada indicador e o que aparece ao
 * clicar nele, a semantica de "aberta" e "atrasada" e a do backend, e os
 * filtros que ja existiam continuam filtrando como antes.
 */
import { describe, expect, it } from "vitest"
import {
  SEM_RESPONSAVEL,
  chipsDosFiltros,
  contarRecortes,
  filtrarTarefas,
} from "./filtrosTarefas"

/** "YYYY-MM-DD" a `dias` de hoje, no fuso local — o mesmo "hoje" do tarefaMeta. */
function dia(dias) {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

const AGORA = Date.now()
const ha = (dias) => new Date(AGORA - dias * 86400000).toISOString()

const TAREFAS = [
  { id_tarefa: 1, titulo: "Revisar contrato", status: "A_FAZER", status_categoria: "PENDENTE", prioridade: "ALTA", id_responsavel: 7, responsavel_nome: "Ana Souza", prazo: dia(-2) },
  { id_tarefa: 2, titulo: "Montar relatório", descricao: "Edital FAPESC", status: "EM_ANDAMENTO", status_categoria: "EM_ANDAMENTO", prioridade: "MEDIA", id_responsavel: 8, responsavel_nome: "Bruno Lima", prazo: dia(0), id_startup: 3, startup_nome: "Acme" },
  { id_tarefa: 3, titulo: "Evento de abertura", status: "CONCLUIDA", status_categoria: "CONCLUIDA", prioridade: "URGENTE", id_responsavel: 7, responsavel_nome: "Ana Souza", prazo: dia(-10), concluida_ts: ha(2) },
  { id_tarefa: 4, titulo: "Planilha antiga", status: "CONCLUIDA", status_categoria: "CONCLUIDA", prioridade: "BAIXA", id_responsavel: null, prazo: null, concluida_ts: ha(30) },
  { id_tarefa: 5, titulo: "Sem coluna conhecida", status: "X", status_categoria: null, prioridade: "BAIXA", id_responsavel: null, prazo: dia(5) },
]

const ids = (lista) => lista.map((t) => t.id_tarefa)
const contexto = { idUsuario: 7, agora: AGORA }

describe("contarRecortes", () => {
  it("conta abertas, atrasadas, minhas e concluidas na janela", () => {
    expect(contarRecortes(TAREFAS, contexto)).toEqual({
      // Categoria nula conta como aberta, como o COALESCE do backend.
      abertas: 3,
      // A concluida com prazo vencido nao esta atrasada: foi entregue.
      atrasadas: 1,
      // A concluida da Ana nao entra: "minhas" e o que esta aberto com ela.
      minhas: 1,
      // A de 30 dias atras fica fora da janela de 7.
      concluidas: 1,
    })
  })

  it("sem usuario, ninguem e 'meu' — nem as tarefas sem responsavel", () => {
    expect(contarRecortes(TAREFAS, { idUsuario: null, agora: AGORA }).minhas).toBe(0)
  })

  it("o numero do indicador e o tamanho da lista ao clicar nele", () => {
    const contagem = contarRecortes(TAREFAS, contexto)
    for (const recorte of Object.keys(contagem)) {
      expect(filtrarTarefas(TAREFAS, { recorte, contexto })).toHaveLength(contagem[recorte])
    }
  })
})

describe("filtrarTarefas", () => {
  it("sem nada, devolve tudo", () => {
    expect(ids(filtrarTarefas(TAREFAS))).toEqual([1, 2, 3, 4, 5])
  })

  it("busca por titulo, descricao, responsavel e startup, sem diferenciar caixa", () => {
    expect(ids(filtrarTarefas(TAREFAS, { busca: "CONTRATO" }))).toEqual([1])
    expect(ids(filtrarTarefas(TAREFAS, { busca: "fapesc" }))).toEqual([2])
    expect(ids(filtrarTarefas(TAREFAS, { busca: "ana" }))).toEqual([1, 3])
    expect(ids(filtrarTarefas(TAREFAS, { busca: "acme" }))).toEqual([2])
  })

  it("filtra por status, prioridade e startup", () => {
    expect(ids(filtrarTarefas(TAREFAS, { filtros: { status: ["CONCLUIDA"] } }))).toEqual([3, 4])
    expect(ids(filtrarTarefas(TAREFAS, { filtros: { prioridade: ["BAIXA", "ALTA"] } }))).toEqual([1, 4, 5])
    expect(ids(filtrarTarefas(TAREFAS, { filtros: { startup: ["3"] } }))).toEqual([2])
  })

  it("'Sem responsavel' e um valor de filtro como outro qualquer", () => {
    expect(ids(filtrarTarefas(TAREFAS, { filtros: { responsavel: [SEM_RESPONSAVEL] } }))).toEqual([4, 5])
    expect(ids(filtrarTarefas(TAREFAS, { filtros: { responsavel: ["8", SEM_RESPONSAVEL] } }))).toEqual([2, 4, 5])
  })

  it("o periodo de prazo compara o dia, e tarefa sem prazo sai", () => {
    const filtros = { prazo: { de: dia(-3), ate: dia(0) } }
    expect(ids(filtrarTarefas(TAREFAS, { filtros }))).toEqual([1, 2])
  })

  it("recorte, busca e filtros se somam", () => {
    const resultado = filtrarTarefas(TAREFAS, {
      busca: "ana",
      recorte: "abertas",
      filtros: { prioridade: ["ALTA"] },
      contexto,
    })
    expect(ids(resultado)).toEqual([1])
  })
})

describe("chipsDosFiltros", () => {
  const grupos = [
    { id: "status", rotulo: "Status", tipo: "checkbox", itens: [{ id: "A_FAZER", rotulo: "A fazer" }, { id: "CONCLUIDA", rotulo: "Concluída" }] },
    { id: "prazo", rotulo: "Prazo", tipo: "data" },
    { id: "extra:centro", rotulo: "Centro de custo", tipo: "texto" },
  ]

  it("um chip por item marcado, com o rotulo do item", () => {
    const chips = chipsDosFiltros(grupos, { status: ["A_FAZER", "CONCLUIDA"] })
    expect(chips.map((c) => c.rotulo)).toEqual(["Status: A fazer", "Status: Concluída"])
  })

  it("remover um item mantem os outros, e o ultimo apaga o grupo", () => {
    const filtros = { status: ["A_FAZER", "CONCLUIDA"], prazo: { de: "2026-10-01", ate: "" } }
    const [primeiro] = chipsDosFiltros(grupos, filtros)
    const depois = primeiro.remover(filtros)
    expect(depois.status).toEqual(["CONCLUIDA"])

    const [ultimo] = chipsDosFiltros(grupos, depois)
    expect(ultimo.remover(depois)).toEqual({ prazo: { de: "2026-10-01", ate: "" } })
  })

  it("periodo e texto viram um chip so", () => {
    const chips = chipsDosFiltros(grupos, {
      prazo: { de: "2026-10-01", ate: "2026-10-31" },
      "extra:centro": "inovação",
    })
    expect(chips.map((c) => c.rotulo)).toEqual([
      "Prazo: 01/10/2026 – 31/10/2026",
      "Centro de custo: inovação",
    ])
  })

  it("periodo vazio nao vira chip", () => {
    expect(chipsDosFiltros(grupos, { prazo: { de: "", ate: "" } })).toEqual([])
  })
})
