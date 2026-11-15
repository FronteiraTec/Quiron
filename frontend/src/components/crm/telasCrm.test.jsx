/**
 * Pecas do Mini CRM pelo lado do navegador.
 *
 * O backend confere tudo de novo (backend/test/crm.test.js). Aqui fica o que
 * so a tela faz:
 *   - a linha do tempo diz quem fez o que, mostra o texto inteiro da anotacao
 *     e pagina pelo cursor do ultimo evento exibido;
 *   - o kanban soma os valores da coluna, move entre etapas e, ao soltar em
 *     Ganho, pede o encerramento em vez de "mover".
 */
import { afterEach, describe, expect, test, vi } from "vitest"
import { cleanup, createEvent, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { ThemeProvider } from "@mui/material"
import { construirTema } from "../../theme"
import LinhaDoTempo from "./LinhaDoTempo"
import KanbanOportunidades from "./KanbanOportunidades"

const tema = construirTema({})
const montar = (no) => render(<ThemeProvider theme={tema}><MemoryRouter>{no}</MemoryRouter></ThemeProvider>)

afterEach(() => cleanup())

const evento = (id, tipo, descricao, extra = {}) => ({
  id_evento: id,
  tipo,
  descricao,
  autor_nome: "Gustavo",
  criado_ts: new Date().toISOString(),
  metadados: {},
  dados_anteriores: null,
  dados_novos: null,
  ...extra,
})

describe("LinhaDoTempo", () => {
  test("autor em negrito, a frase do servidor e o texto inteiro da anotacao", async () => {
    const carregar = vi.fn().mockResolvedValue({
      eventos: [
        evento(3, "ANOTACAO", 'adicionou uma anotação: "Cliente demonstrou…"', {
          metadados: { texto: "Cliente demonstrou interesse na proposta e pediu desconto." },
        }),
        evento(2, "ETAPA_ALTERADA", 'alterou a etapa de "Contato feito" para "Apresentação"', {
          dados_anteriores: { etapa: "Contato feito" },
          metadados: { dias_na_etapa_anterior: 4 },
        }),
      ],
      temMais: false,
    })
    montar(<LinhaDoTempo carregar={carregar} />)

    expect(await screen.findByText("adicionou uma anotação", { exact: false })).toBeTruthy()
    expect(screen.getByText("Cliente demonstrou interesse na proposta e pediu desconto.")).toBeTruthy()
    expect(screen.getByText('alterou a etapa de "Contato feito" para "Apresentação"', { exact: false })).toBeTruthy()
    expect(screen.getByText(/Ficou 4 dias em “Contato feito”/)).toBeTruthy()
    expect(screen.getAllByText("Gustavo")[0].tagName).toBe("STRONG")
    expect(screen.getByText("Hoje")).toBeTruthy()
    expect(carregar).toHaveBeenCalledWith(null)
  })

  test("carrega os registros anteriores a partir do ultimo exibido", async () => {
    const carregar = vi
      .fn()
      .mockResolvedValueOnce({ eventos: [evento(9, "TAREFA_CRIADA", 'criou a tarefa "Enviar orçamento"')], temMais: true })
      .mockResolvedValueOnce({ eventos: [evento(4, "OPORTUNIDADE_CRIADA", 'criou a oportunidade "Site"')], temMais: false })
    montar(<LinhaDoTempo carregar={carregar} />)

    fireEvent.click(await screen.findByRole("button", { name: /Carregar registros anteriores/ }))
    expect(await screen.findByText('criou a oportunidade "Site"', { exact: false })).toBeTruthy()
    expect(carregar).toHaveBeenLastCalledWith(9)
    expect(screen.getByText('criou a tarefa "Enviar orçamento"', { exact: false })).toBeTruthy()
    await waitFor(() => expect(screen.queryByRole("button", { name: /Carregar registros anteriores/ })).toBeNull())
  })

  test("vazio diz o que acontece ali", async () => {
    montar(<LinhaDoTempo carregar={async () => ({ eventos: [], temMais: false })} vazio="Nada ainda por aqui." />)
    expect(await screen.findByText("Nada ainda por aqui.")).toBeTruthy()
  })
})

describe("KanbanOportunidades", () => {
  const etapas = [
    { id_etapa: 1, nome: "Sem contato", cor: "#94a3b8", ativo: true },
    { id_etapa: 2, nome: "Proposta enviada", cor: "#8b5cf6", ativo: true },
  ]
  const op = (id, extra = {}) => ({
    id_oportunidade: id,
    titulo: `Venda ${id}`,
    cliente_nome: "Acme",
    situacao: "ABERTA",
    id_etapa: 1,
    valor_estimado: 1000,
    tarefas_abertas: 0,
    tarefas_atrasadas: 0,
    etapa_ts: new Date().toISOString(),
    ...extra,
  })

  /** Arrasta o cartao ate a coluna, pelos eventos HTML5 que o quadro escuta. */
  function arrastar(titulo, coluna) {
    const cartao = screen.getByRole("button", { name: new RegExp(`^${titulo}`) }).parentElement
    const dados = { setData: () => {}, effectAllowed: "", dropEffect: "" }
    fireEvent.dragStart(cartao, { dataTransfer: dados })
    const alvo = screen.getByRole("region", { name: coluna }).querySelector("div:last-child")
    const sobre = createEvent.dragOver(alvo, { dataTransfer: dados })
    fireEvent(alvo, sobre)
    fireEvent.drop(alvo, { dataTransfer: dados })
  }

  test("o cabecalho da coluna traz a quantidade e a soma dos valores", () => {
    montar(<KanbanOportunidades etapas={etapas} oportunidades={[op(1), op(2, { valor_estimado: 2500 })]} />)
    const coluna = screen.getByRole("region", { name: "Sem contato" })
    expect(within(coluna).getByLabelText("2 oportunidades")).toBeTruthy()
    expect(within(coluna).getByText(/3\.500,00/)).toBeTruthy()
  })

  test("soltar em outra etapa move; soltar em Ganho pede o encerramento", () => {
    const onMover = vi.fn()
    const onGanhar = vi.fn()
    montar(<KanbanOportunidades etapas={etapas} oportunidades={[op(1)]} onMover={onMover} onGanhar={onGanhar} />)

    arrastar("Venda 1", "Proposta enviada")
    expect(onMover).toHaveBeenCalledWith(expect.objectContaining({ id_oportunidade: 1 }), etapas[1])

    arrastar("Venda 1", "Ganho")
    expect(onGanhar).toHaveBeenCalledWith(expect.objectContaining({ id_oportunidade: 1 }))
  })

  test("a encerrada aparece na coluna do desfecho e nao arrasta", () => {
    const fechada = op(3, { situacao: "GANHA", valor_vendido: 900, encerrado_ts: new Date().toISOString(), fechamento_dt: "2026-11-02" })
    montar(<KanbanOportunidades etapas={etapas} oportunidades={[fechada]} />)
    const ganho = screen.getByRole("region", { name: "Ganho" })
    const cartao = within(ganho).getByRole("button", { name: /^Venda 3/ }).parentElement
    expect(cartao.getAttribute("draggable")).toBe("false")
  })
})
