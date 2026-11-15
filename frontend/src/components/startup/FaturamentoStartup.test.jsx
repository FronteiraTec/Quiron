/**
 * A secao de faturamento no cadastro da startup. O backend decide o que sai
 * (backend/test/crmFaturamento.test.js); aqui fica o que so a tela faz: startup
 * sem CRM ve uma frase e nao zeros, os numeros chegam formatados, e sem a
 * chave a secao some.
 */
import { afterEach, describe, expect, test, vi } from "vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"

vi.mock("../../services/api", () => ({ default: { get: vi.fn() }, TOKEN_KEY: "quiron_token" }))

import api from "../../services/api"
import FaturamentoStartup from "./FaturamentoStartup"

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const meses = Array.from({ length: 12 }, (_, i) => ({
  mes: `2026-${String(i + 1).padStart(2, "0")}`,
  valor: i === 10 ? 1000 : i === 8 ? 2500 : 0,
  vendas: i === 10 || i === 8 ? 1 : 0,
}))

describe("FaturamentoStartup", () => {
  test("startup sem CRM ve uma frase, nao zeros", async () => {
    api.get.mockResolvedValue({ data: { usa_crm: false, crm_ativo: false } })
    render(<FaturamentoStartup idStartup={7} />)
    expect(await screen.findByText(/não usa o Mini CRM/)).toBeTruthy()
    expect(api.get).toHaveBeenCalledWith("/startups/7/faturamento")
  })

  test("mostra os totais e um mes por barra", async () => {
    api.get.mockResolvedValue({
      data: {
        usa_crm: true,
        crm_ativo: true,
        hoje: "2026-11-04",
        resumo: { vendas: 3, total: 7500, ano_atual: 3500, ultimos_12_meses: 3500, vendas_12_meses: 2, ticket_medio: 2500, primeira_venda: "2024-11-04", ultima_venda: "2026-11-04" },
        meses,
      },
    })
    render(<FaturamentoStartup idStartup={7} />)
    expect(await screen.findByText("Últimos 12 meses")).toBeTruthy()
    expect(screen.getByText("Em 2026")).toBeTruthy()
    expect(screen.getByText(/desde 04\/11\/2024/)).toBeTruthy()
    expect(screen.getAllByRole("listitem", { name: /de 2026:/ })).toHaveLength(12)
    expect(screen.getByRole("listitem", { name: /novembro de 2026: R\$\s1\.000,00 · 1 venda$/ })).toBeTruthy()
  })

  test("revogado avisa que os numeros pararam na revogacao", async () => {
    api.get.mockResolvedValue({
      data: { usa_crm: true, crm_ativo: false, hoje: "2026-11-04", resumo: { vendas: 0, total: 0, ano_atual: 0, ultimos_12_meses: 0, vendas_12_meses: 0, ticket_medio: null, primeira_venda: "", ultima_venda: "" }, meses },
    })
    render(<FaturamentoStartup idStartup={7} />)
    expect(await screen.findByText(/está revogado/)).toBeTruthy()
    expect(screen.getByText("Nenhuma venda registrada no CRM ainda.")).toBeTruthy()
  })

  test("sem a chave (403), a secao some", async () => {
    api.get.mockRejectedValue({ response: { status: 403, data: { erro: "Sem permissão" } } })
    const { container } = render(<FaturamentoStartup idStartup={7} />)
    await waitFor(() => expect(container.innerHTML).toBe(""))
  })
})
