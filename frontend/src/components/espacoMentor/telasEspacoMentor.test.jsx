/**
 * As telas do Espaco do Mentor, pelo lado do navegador.
 *
 * O backend confere tudo de novo (backend/test/espacoMentor.test.js e
 * materiaisIncubadora.test.js); o que vale testar AQUI e o que so a tela faz:
 *
 *   - o dialogo de compartilhar manda exatamente o que o mentor escolheu — a
 *     etapa da arvore, o material, a finalidade e a orientacao — e nao oferece
 *     o que o servidor recusaria (material arquivado, atividade fora de um
 *     passo, startup sem trilha);
 *   - a Jornada mostra o que a startup recebeu e abre o material certo, e nao
 *     desenha a secao quando nao ha nada;
 *   - a aba "Materiais da incubadora" e leitura para o mentor e publicacao
 *     para a coordenacao.
 *
 * A API e substituida por um dublê: o teste e da tela, nao da rede.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"

vi.mock("../../services/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  TOKEN_KEY: "quiron_token",
}))

import api from "../../services/api"
import DialogCompartilhar from "./DialogCompartilhar"
import AbaMateriaisIncubadora from "./AbaMateriaisIncubadora"
import MateriaisDoMentor, { MaterialNoPasso } from "../jornada/MateriaisDoMentor"

const ACME = {
  id_startup: 1,
  nome: "Acme",
  trilhas: [{ id_no: 10, nome: "Pré-incubação", status: "EM_ANDAMENTO" }],
}

const BIBLIOTECA = {
  materiais: [
    { id_material: 5, titulo: "Roteiro de entrevista", tipo: "LINK", arquivado: false, startups_compartilhadas: [] },
    { id_material: 6, titulo: "Planilha antiga", tipo: "LINK", arquivado: true, startups_compartilhadas: [] },
  ],
  categorias: [],
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

describe("DialogCompartilhar", () => {
  test("a partir de uma atividade da trilha: manda a etapa, o material, a finalidade e a orientacao", async () => {
    api.get.mockImplementation((url) =>
      url === "/espaco-mentor/materiais"
        ? Promise.resolve({ data: BIBLIOTECA })
        : Promise.reject(new Error(`rota inesperada: ${url}`))
    )
    api.post.mockResolvedValue({
      data: { compartilhamento: { id_compartilhamento: 1, titulo: "Roteiro de entrevista", startup_nome: "Acme" } },
    })
    const onConcluido = vi.fn()

    render(
      <DialogCompartilhar
        aberto
        idTenant={7}
        presets={{
          startup: ACME,
          trilha: { id_no: 10, nome: "Pré-incubação" },
          etapa: { id_no: 99, tipo: "PASSO", nome: "Entrevistas", fase_nome: "Validação" },
        }}
        onFechar={vi.fn()}
        onConcluido={onConcluido}
      />
    )

    // O lugar ja decidido aparece como resumo, nao como pergunta.
    expect(screen.getByText("Acme › Pré-incubação › Validação › Entrevistas")).toBeTruthy()
    expect(screen.queryByLabelText("Startup")).toBeNull()

    // Material arquivado nao e oferecido: o servidor recusaria.
    await screen.findByText("Roteiro de entrevista")
    expect(screen.queryByText("Planilha antiga")).toBeNull()

    const compartilhar = screen.getByRole("button", { name: "Compartilhar" })
    expect(compartilhar.disabled).toBe(true)

    fireEvent.click(screen.getByText("Roteiro de entrevista"))
    fireEvent.click(screen.getByLabelText(/Material de apoio a uma atividade/))
    fireEvent.change(screen.getByLabelText(/Orientação para a startup/), {
      target: { value: "  Traga as respostas para a próxima mentoria.  " },
    })
    fireEvent.click(screen.getByRole("button", { name: "Compartilhar" }))

    await waitFor(() => expect(onConcluido).toHaveBeenCalledTimes(1))
    expect(api.post).toHaveBeenCalledWith("/espaco-mentor/compartilhamentos", {
      id_startup: 1,
      id_programa: 10,
      id_no: 99,
      id_material: 5,
      finalidade: "ATIVIDADE",
      orientacao: "Traga as respostas para a próxima mentoria.",
    })
  })

  test("o erro do servidor aparece no dialogo, e ele continua aberto", async () => {
    api.get.mockResolvedValue({ data: BIBLIOTECA })
    api.post.mockRejectedValue({ response: { data: { erro: "Voce nao acompanha esta startup." } } })
    const onConcluido = vi.fn()

    render(
      <DialogCompartilhar
        aberto
        idTenant={7}
        presets={{ startup: ACME, trilha: { id_no: 10, nome: "Pré-incubação" }, etapa: null }}
        onFechar={vi.fn()}
        onConcluido={onConcluido}
      />
    )

    fireEvent.click(await screen.findByText("Roteiro de entrevista"))
    fireEvent.click(screen.getByRole("button", { name: "Compartilhar" }))

    expect(await screen.findByText("Voce nao acompanha esta startup.")).toBeTruthy()
    expect(onConcluido).not.toHaveBeenCalled()
  })

  test("a partir do material: pergunta a startup, e sem passo nao ha atividade", async () => {
    api.get.mockImplementation((url) =>
      url === "/espaco-mentor/incubados"
        ? Promise.resolve({ data: { startups: [ACME] } })
        : Promise.reject(new Error(`rota inesperada: ${url}`))
    )

    render(
      <DialogCompartilhar
        aberto
        idTenant={7}
        presets={{ material: { id_material: 5, titulo: "Roteiro de entrevista", tipo: "LINK" } }}
        onFechar={vi.fn()}
        onConcluido={vi.fn()}
      />
    )

    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith("/espaco-mentor/incubados", { params: { id_tenant: 7 } })
    )
    expect(screen.getByLabelText("Startup")).toBeTruthy()
    // Sem startup escolhida, nao ha o que compartilhar.
    expect(screen.getByRole("button", { name: "Compartilhar" }).disabled).toBe(true)
    // A etapa ainda e a trilha inteira: atividade so existe num passo.
    expect(screen.getByLabelText(/Material de apoio a uma atividade/).disabled).toBe(true)
  })

  test("startup sem trilha: explica por que nao da para compartilhar", async () => {
    api.get.mockResolvedValue({ data: BIBLIOTECA })

    render(
      <DialogCompartilhar
        aberto
        idTenant={7}
        presets={{ startup: { id_startup: 2, nome: "Beta", trilhas: [] } }}
        onFechar={vi.fn()}
        onConcluido={vi.fn()}
      />
    )

    expect(await screen.findByText(/Beta ainda não está matriculada em nenhuma trilha/)).toBeTruthy()
    fireEvent.click(await screen.findByText("Roteiro de entrevista"))
    expect(screen.getByRole("button", { name: "Compartilhar" }).disabled).toBe(true)
  })
})

describe("o que a startup ve na Jornada", () => {
  const recebido = {
    id_compartilhamento: 3,
    titulo: "Modelo de hipóteses",
    tipo: "ARQUIVO",
    origem: "PESSOAL",
    arquivo_mime: "application/pdf",
    finalidade: "ATIVIDADE",
    orientacao: "Organize as hipóteses e traga para a mentoria.",
    compartilhado_por_nome: "Ana Mentora",
    criado_ts: "2026-10-17T12:00:00.000Z",
    id_no: 9,
    etapa_tipo: "PASSO",
    etapa_nome: "Entrevistas",
    fase_nome: "Validação",
  }

  test("lista o material com autor e etapa, e abre o que foi clicado", () => {
    const onAbrir = vi.fn()
    render(<MateriaisDoMentor titulo="Materiais do seu mentor" materiais={[recebido]} onAbrir={onAbrir} />)

    expect(screen.getByText("Materiais do seu mentor")).toBeTruthy()
    expect(screen.getByText(/Ana Mentora/)).toBeTruthy()
    expect(screen.getByText(/Validação › Entrevistas/)).toBeTruthy()

    fireEvent.click(screen.getByText("Modelo de hipóteses"))
    expect(onAbrir).toHaveBeenCalledWith(recebido)
  })

  test("sem material, a secao nao aparece", () => {
    const { container } = render(<MateriaisDoMentor titulo="x" materiais={[]} onAbrir={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  test("dentro da atividade, a orientacao vem por extenso", () => {
    render(<MaterialNoPasso material={recebido} onAbrir={vi.fn()} />)
    expect(screen.getByText("Organize as hipóteses e traga para a mentoria.")).toBeTruthy()
    expect(screen.getByText(/Apoio à atividade/)).toBeTruthy()
  })
})

describe("AbaMateriaisIncubadora", () => {
  const guia = {
    id_material: 7,
    titulo: "Guia do mentor 2026",
    descricao: "Como conduzir a primeira reunião.",
    categoria: "Guia",
    tipo: "LINK",
    url: "https://docs.exemplo.com/guia",
    arquivado: false,
    criado_por_nome: "Coordenação",
    criado_ts: "2026-10-01T12:00:00.000Z",
    atualizado_ts: "2026-10-01T12:00:00.000Z",
  }

  const montar = (props) =>
    render(
      <AbaMateriaisIncubadora
        idTenant={7}
        versao={0}
        onMudou={vi.fn()}
        onAviso={vi.fn()}
        podeCriar={false}
        podeEditar={false}
        podeExcluir={false}
        {...props}
      />
    )

  beforeEach(() => {
    window.localStorage.clear()
  })

  test("para o mentor e leitura: lista, abre o material, e nao oferece publicar", async () => {
    api.get.mockResolvedValue({ data: { materiais: [guia], categorias: ["Guia"] } })
    const abrirAba = vi.spyOn(window, "open").mockImplementation(() => null)

    montar()

    fireEvent.click(await screen.findByText("Guia do mentor 2026"))
    expect(api.get).toHaveBeenCalledWith("/espaco-mentor/incubadora", { params: { id_tenant: 7 } })
    expect(screen.queryByText("Publicar material")).toBeNull()
    expect(abrirAba).toHaveBeenCalledWith("https://docs.exemplo.com/guia", "_blank", "noopener")
    abrirAba.mockRestore()
  })

  test("para a coordenacao: publica, e clicar na linha abre a edicao", async () => {
    api.get.mockResolvedValue({ data: { materiais: [guia], categorias: ["Guia"] } })

    montar({ podeCriar: true, podeEditar: true, podeExcluir: true })

    fireEvent.click(await screen.findByText("Guia do mentor 2026"))
    expect(screen.getByText("Publicar material")).toBeTruthy()
    expect(await screen.findByText("Editar material dos mentores")).toBeTruthy()
    expect(screen.getByText(/Publicado por Coordenação/)).toBeTruthy()
  })

  test("vazia: o mentor le que nada foi publicado; a coordenacao ganha o convite", async () => {
    api.get.mockResolvedValue({ data: { materiais: [], categorias: [] } })
    montar()
    expect(await screen.findByText("Nenhum material da incubadora por enquanto")).toBeTruthy()
    cleanup()

    montar({ podeCriar: true, podeEditar: true })
    expect(await screen.findByText("Nada publicado para os mentores ainda")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Publicar material" })).toBeTruthy()
  })
})
