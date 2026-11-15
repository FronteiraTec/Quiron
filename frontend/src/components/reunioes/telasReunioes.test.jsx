/**
 * Reunioes por video pelo lado do navegador.
 *
 * O backend confere tudo de novo (backend/test/reunioes.test.js). Aqui fica o
 * que so a tela faz:
 *   - o formulario manda o horario de PAREDE e os convidados escolhidos, e o
 *     atalho "convidar a equipe da startup" acrescenta os membros dela;
 *   - na Agenda, o evento de uma reuniao leva a sala, e nao a edicao (que o
 *     servidor recusaria).
 */
import { afterEach, describe, expect, test, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { ThemeProvider } from "@mui/material"
import { construirTema } from "../../theme"

vi.mock("../../services/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  TOKEN_KEY: "quiron_token",
}))
vi.mock("../../store/authStore", () => ({
  useAuthStore: (seletor) => seletor({ usuario: { id: 1, id_tenant: 10, nome: "Mentora Ana" } }),
}))

import api from "../../services/api"
import DialogReuniao from "./DialogReuniao"
import EventDrawer from "../calendar/EventDrawer"

const tema = construirTema({})
const montar = (no) => render(<ThemeProvider theme={tema}><MemoryRouter>{no}</MemoryRouter></ThemeProvider>)

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const PESSOAS = [
  { id_usuario: 1, nome: "Mentora Ana", papel: "mentor", startups: [] },
  { id_usuario: 2, nome: "Bruno", papel: "usuario", startups: [{ id_startup: 7, nome: "Acme" }] },
  { id_usuario: 3, nome: "Carla", papel: "usuario", startups: [{ id_startup: 7, nome: "Acme" }] },
  { id_usuario: 4, nome: "Davi", papel: "usuario", startups: [{ id_startup: 8, nome: "Outra" }] },
]

describe("DialogReuniao", () => {
  test("convidar a equipe da startup acrescenta os membros dela, e o horario vai como parede", async () => {
    api.get.mockImplementation((url) => {
      if (url === "/reunioes/convidaveis") return Promise.resolve({ data: { pessoas: PESSOAS } })
      if (url === "/startups") return Promise.resolve({ data: { startups: [{ id_startup: 7, nome: "Acme" }, { id_startup: 8, nome: "Outra" }] } })
      return Promise.reject(new Error(url))
    })
    api.post.mockResolvedValue({ data: { reuniao: { id_reuniao: 99 } } })
    const onSalvo = vi.fn()

    montar(<DialogReuniao aberto reuniao={null} onFechar={() => {}} onSalvo={onSalvo} />)

    fireEvent.change(screen.getByLabelText(/Título/), { target: { value: "Mentoria de pitch" } })
    fireEvent.change(screen.getByLabelText(/Data/), { target: { value: "2026-11-05" } })
    fireEvent.change(screen.getByLabelText(/Início/), { target: { value: "14:00" } })
    fireEvent.change(screen.getByLabelText(/^Fim/), { target: { value: "15:00" } })

    // Escolhe a startup Acme no select do MUI.
    fireEvent.mouseDown(await screen.findByLabelText(/Startup/))
    fireEvent.click(await screen.findByRole("option", { name: "Acme" }))

    fireEvent.click(await screen.findByRole("button", { name: /Convidar a equipe da Acme \(2\)/ }))
    expect(screen.getByText("Bruno")).toBeTruthy()
    expect(screen.getByText("Carla")).toBeTruthy()
    expect(screen.queryByText("Davi")).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Criar reunião" }))
    await waitFor(() => expect(onSalvo).toHaveBeenCalled())

    const [url, corpo] = api.post.mock.calls[0]
    expect(url).toBe("/reunioes")
    expect(corpo).toMatchObject({
      id_tenant: 10,
      titulo: "Mentoria de pitch",
      categoria: "MENTORIA",
      inicio_ts: "2026-11-05T14:00:00",
      fim_ts: "2026-11-05T15:00:00",
      id_startup: 7,
      participantes: [2, 3],
    })
  })

  test("o anfitriao nao aparece como opcao de convidado", async () => {
    api.get.mockImplementation((url) =>
      Promise.resolve({ data: url === "/reunioes/convidaveis" ? { pessoas: PESSOAS } : { startups: [] } })
    )
    montar(<DialogReuniao aberto reuniao={null} onFechar={() => {}} />)
    const campo = screen.getByLabelText("Convidados")
    fireEvent.mouseDown(campo)
    fireEvent.change(campo, { target: { value: "a" } })
    await screen.findByRole("option", { name: /Bruno/ })
    expect(screen.queryByRole("option", { name: /Mentora Ana/ })).toBeNull()
  })
})

describe("EventDrawer", () => {
  const base = {
    id_evento: 5,
    titulo: "Mentoria de pitch",
    categoria: "MENTORIA",
    inicio_ts: "2026-11-05T14:00:00",
    startups: [],
    anexos: [],
  }

  test("o evento de uma reuniao leva para a sala, sem Editar nem Excluir", async () => {
    api.get.mockResolvedValue({ data: { participantes: [] } })
    montar(<EventDrawer aberto evento={{ ...base, id_reuniao: 3, reuniao_status: "AGENDADA" }} onClose={() => {}} onEditar={() => {}} onExcluir={() => {}} />)
    expect(await screen.findByRole("button", { name: /Entrar na reunião/ })).toBeTruthy()
    expect(screen.getByRole("button", { name: /Ver a reunião/ })).toBeTruthy()
    expect(screen.queryByRole("button", { name: /^Editar$/ })).toBeNull()
  })

  test("reuniao encerrada nao oferece entrar; evento comum continua com Editar", async () => {
    api.get.mockResolvedValue({ data: { participantes: [] } })
    const { unmount } = montar(
      <EventDrawer aberto evento={{ ...base, id_reuniao: 3, reuniao_status: "ENCERRADA" }} onClose={() => {}} onEditar={() => {}} onExcluir={() => {}} />
    )
    expect(await screen.findByRole("button", { name: /Ver a reunião/ })).toBeTruthy()
    expect(screen.queryByRole("button", { name: /Entrar na reunião/ })).toBeNull()
    unmount()

    montar(<EventDrawer aberto evento={base} onClose={() => {}} onEditar={() => {}} onExcluir={() => {}} />)
    expect(await screen.findByRole("button", { name: /Editar/ })).toBeTruthy()
  })
})
