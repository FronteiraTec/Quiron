/**
 * O salvamento automatico.
 *
 * E o componente onde um erro custa o trabalho de alguem: salvar de menos
 * perde o que foi escrito, salvar de mais transforma cada tecla numa
 * requisicao. Os testes abaixo sao sobre exatamente esses dois extremos, mais
 * o que acontece quando a rede cai no meio.
 *
 * O relogio e falso (`vi.useFakeTimers`): esperar 1,2s de verdade a cada caso
 * tornaria a suite lenta sem provar nada a mais.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest"
import { act, cleanup, renderHook } from "@testing-library/react"
import { useSalvamentoAutomatico } from "./useSalvamentoAutomatico"

const ATRASO = 1200

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  // Desmonta o que ficou montado. Sem isso o ouvinte de `beforeunload` de um
  // teste continua vivo no teste seguinte — a limpeza automatica da
  // @testing-library so se registra com `globals: true`, que este projeto
  // nao usa.
  cleanup()
  vi.useRealTimers()
})

/** Avanca o relogio e deixa as promessas pendentes resolverem. */
async function avancar(ms) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

/** Monta o hook com um `salvar` espionado. */
function montar({ salvar, valor = () => ({ texto: "conteudo" }), ...resto } = {}) {
  const espiao = salvar || vi.fn().mockResolvedValue(undefined)
  const retorno = renderHook(() =>
    useSalvamentoAutomatico({ obterValor: valor, salvar: espiao, ...resto })
  )
  return { ...retorno, salvar: espiao }
}

describe("a janela de espera", () => {
  test("comeca ocioso e nao salva nada sozinho", async () => {
    const { result, salvar } = montar()

    expect(result.current.estado).toBe("ocioso")
    await avancar(5000)
    expect(salvar).not.toHaveBeenCalled()
  })

  test("uma alteracao salva depois da pausa, e nao na hora", async () => {
    const { result, salvar } = montar()

    act(() => result.current.avisarAlteracao())
    expect(result.current.estado).toBe("pendente")
    expect(salvar).not.toHaveBeenCalled()

    await avancar(ATRASO)
    expect(salvar).toHaveBeenCalledTimes(1)
    expect(result.current.estado).toBe("salvo")
  })

  test("digitar sem parar NAO manda uma requisicao por tecla", async () => {
    const { result, salvar } = montar()

    // Vinte "teclas" com 100ms entre elas: nada pode sair enquanto isso.
    for (let i = 0; i < 20; i++) {
      act(() => result.current.avisarAlteracao())
      await avancar(100)
    }
    expect(salvar).not.toHaveBeenCalled()

    await avancar(ATRASO)
    expect(salvar).toHaveBeenCalledTimes(1)
  })

  test("salva o valor de AGORA, nao o de quando a alteracao comecou", async () => {
    let texto = "primeiro"
    const { result, salvar } = montar({ valor: () => ({ texto }) })

    act(() => result.current.avisarAlteracao())
    texto = "corrigido antes de salvar"
    await avancar(ATRASO)

    expect(salvar).toHaveBeenCalledWith({ texto: "corrigido antes de salvar" })
  })

  test("salvarAgora nao espera a pausa e confirma que gravou", async () => {
    const { result, salvar } = montar()

    act(() => result.current.avisarAlteracao())

    let deuCerto
    await act(async () => {
      deuCerto = await result.current.salvarAgora()
    })

    expect(salvar).toHaveBeenCalledTimes(1)
    // Quem fecha a tela decide sair a partir desta resposta.
    expect(deuCerto).toBe(true)
  })

  test("salvarAgora avisa quando NAO conseguiu gravar", async () => {
    const salvar = vi.fn().mockRejectedValue(new Error("rede fora"))
    const { result } = montar({ salvar })

    act(() => result.current.avisarAlteracao())

    let deuCerto
    await act(async () => {
      deuCerto = await result.current.salvarAgora()
    })

    expect(deuCerto).toBe(false)
    expect(result.current.estado).toBe("erro")
  })

  test("`ativo: false` desliga o salvamento (modo leitura)", async () => {
    const { result, salvar } = montar({ ativo: false })

    act(() => result.current.avisarAlteracao())
    await avancar(5000)

    expect(salvar).not.toHaveBeenCalled()
    expect(result.current.estado).toBe("ocioso")
  })
})

describe("gravacoes que se atropelam", () => {
  test("alteracao durante a gravacao vira uma segunda gravacao, nao duas em paralelo", async () => {
    let liberar
    const salvar = vi
      .fn()
      .mockImplementationOnce(() => new Promise((ok) => (liberar = ok)))
      .mockResolvedValue(undefined)

    const { result } = montar({ salvar })

    act(() => result.current.avisarAlteracao())
    await avancar(ATRASO)
    expect(salvar).toHaveBeenCalledTimes(1)

    // Escreve mais enquanto a primeira gravacao ainda esta no ar.
    act(() => result.current.avisarAlteracao())
    await avancar(ATRASO)
    expect(salvar).toHaveBeenCalledTimes(1) // continua sendo uma so

    await act(async () => {
      liberar()
    })
    await avancar(ATRASO)
    expect(salvar).toHaveBeenCalledTimes(2)
    expect(result.current.estado).toBe("salvo")
  })
})

describe("quando a gravacao falha", () => {
  test("mostra o erro da API e continua marcando pendencia", async () => {
    const salvar = vi
      .fn()
      .mockRejectedValue({ response: { data: { erro: "Bloco 1: tipo de bloco invalido." } } })
    const { result } = montar({ salvar })

    act(() => result.current.avisarAlteracao())
    await avancar(ATRASO)

    expect(result.current.estado).toBe("erro")
    expect(result.current.erro).toBe("Bloco 1: tipo de bloco invalido.")
    expect(result.current.pendente).toBe(true)
  })

  test("tenta de novo sozinho, esperando cada vez mais", async () => {
    const salvar = vi.fn().mockRejectedValue(new Error("rede fora"))
    const { result } = montar({ salvar })

    act(() => result.current.avisarAlteracao())
    await avancar(ATRASO)
    expect(salvar).toHaveBeenCalledTimes(1)

    // Primeira repeticao: 4s.
    await avancar(4000)
    expect(salvar).toHaveBeenCalledTimes(2)

    // A segunda so vem depois de 8s — em 4s ainda nao tentou de novo.
    await avancar(4000)
    expect(salvar).toHaveBeenCalledTimes(2)
    await avancar(4000)
    expect(salvar).toHaveBeenCalledTimes(3)
  })

  test("quando a rede volta, grava e limpa o erro", async () => {
    const salvar = vi
      .fn()
      .mockRejectedValueOnce(new Error("rede fora"))
      .mockResolvedValue(undefined)
    const { result } = montar({ salvar })

    act(() => result.current.avisarAlteracao())
    await avancar(ATRASO)
    expect(result.current.estado).toBe("erro")

    await avancar(4000)
    expect(result.current.estado).toBe("salvo")
    expect(result.current.erro).toBeNull()
    expect(result.current.pendente).toBe(false)
  })

  test("a espera volta ao inicio depois de uma gravacao boa", async () => {
    const salvar = vi
      .fn()
      .mockRejectedValueOnce(new Error("falhou"))
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("falhou de novo"))
      .mockResolvedValue(undefined)

    const { result } = montar({ salvar })

    act(() => result.current.avisarAlteracao())
    await avancar(ATRASO)
    await avancar(4000) // repeticao: sucesso
    expect(result.current.estado).toBe("salvo")

    // Nova falha mais adiante deve esperar 4s de novo, e nao 8s.
    act(() => result.current.avisarAlteracao())
    await avancar(ATRASO)
    expect(result.current.estado).toBe("erro")

    const antes = salvar.mock.calls.length
    await avancar(4000)
    expect(salvar.mock.calls.length).toBe(antes + 1)
  })
})

describe("sair da tela", () => {
  test("avisa o navegador enquanto houver pendencia", async () => {
    const { result } = montar()

    const semPendencia = new Event("beforeunload", { cancelable: true })
    window.dispatchEvent(semPendencia)
    expect(semPendencia.defaultPrevented).toBe(false)

    act(() => result.current.avisarAlteracao())

    const comPendencia = new Event("beforeunload", { cancelable: true })
    window.dispatchEvent(comPendencia)
    expect(comPendencia.defaultPrevented).toBe(true)
  })

  test("depois de salvar, sair deixa de ser um problema", async () => {
    const { result } = montar()

    act(() => result.current.avisarAlteracao())
    await avancar(ATRASO)
    expect(result.current.estado).toBe("salvo")

    const evento = new Event("beforeunload", { cancelable: true })
    window.dispatchEvent(evento)
    expect(evento.defaultPrevented).toBe(false)
  })

  test("desmontar cancela o relogio — nada e gravado depois", async () => {
    const { result, salvar, unmount } = montar()

    act(() => result.current.avisarAlteracao())
    unmount()
    await avancar(5000)

    expect(salvar).not.toHaveBeenCalled()
  })
})
