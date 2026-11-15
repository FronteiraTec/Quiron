/**
 * A gravacao no navegador sem navegador: a fila de envio e a sessao, com a
 * API, o MediaRecorder, o relogio e a espera falsos.
 */
import { describe, expect, it, vi } from "vitest"
import { ATRASO_MS, FilaDeEnvio, SessaoDeGravacao, escolherFormato } from "./gravacao"

const erroHttp = (status, dados = {}) => Object.assign(new Error(`HTTP ${status}`), { response: { status, data: dados } })
const tique = () => new Promise((ok) => setTimeout(ok, 0))
/** Deixa a fila trabalhar: espera falsa que nao espera. */
const semEspera = () => Promise.resolve()

describe("escolherFormato", () => {
  it("prefere WebM/Opus; no Safari cai no MP4; sem MediaRecorder, nada", () => {
    expect(escolherFormato({ isTypeSupported: () => true })).toBe("audio/webm;codecs=opus")
    expect(escolherFormato({ isTypeSupported: (m) => m.startsWith("audio/mp4") })).toBe("audio/mp4;codecs=mp4a.40.2")
    expect(escolherFormato({ isTypeSupported: () => false })).toBe(null)
    expect(escolherFormato(undefined)).toBe(null)
  })
})

describe("FilaDeEnvio", () => {
  it("manda em ordem, um de cada vez", async () => {
    const enviados = []
    let emVoo = 0
    let maxEmVoo = 0
    const fila = new FilaDeEnvio({
      enviar: async ({ n }) => {
        emVoo += 1
        maxEmVoo = Math.max(maxEmVoo, emVoo)
        await tique()
        enviados.push(n)
        emVoo -= 1
      },
      esperar: semEspera,
    })
    fila.adicionar(0, "a")
    fila.adicionar(1, "b")
    fila.adicionar(2, "c")
    await fila.esvaziar()
    expect(enviados).toEqual([0, 1, 2])
    expect(maxEmVoo).toBe(1)
  })

  it("rede caiu: repete o MESMO pedaco com espera crescente, e nao pula para o seguinte", async () => {
    const esperas = []
    let falhas = 3
    const enviados = []
    const fila = new FilaDeEnvio({
      enviar: async ({ n }) => {
        if (n === 0 && falhas-- > 0) throw new Error("Network Error")
        enviados.push(n)
      },
      esperar: (ms) => {
        esperas.push(ms)
        return Promise.resolve()
      },
    })
    fila.adicionar(0, "a")
    fila.adicionar(1, "b")
    await fila.esvaziar()
    expect(esperas).toEqual([1000, 2000, 4000])
    expect(enviados).toEqual([0, 1])
  })

  it("servidor sem espaco (507) tambem e repetido; pedaco recusado (413/415) e descartado", async () => {
    const respostas = { 0: [erroHttp(507)], 1: [erroHttp(413)] }
    const enviados = []
    const fila = new FilaDeEnvio({
      enviar: async ({ n }) => {
        const r = respostas[n]?.shift()
        if (r) throw r
        enviados.push(n)
      },
      esperar: semEspera,
    })
    fila.adicionar(0, "a")
    fila.adicionar(1, "b")
    fila.adicionar(2, "c")
    await fila.esvaziar()
    expect(enviados).toEqual([0, 2])
    expect(fila.descartados).toBe(1)
  })

  it("gravacao fechada no servidor (409): a fila para de vez e guarda o motivo", async () => {
    const aoMudar = vi.fn()
    const fila = new FilaDeEnvio({
      enviar: async () => {
        throw erroHttp(409, { codigo: "SEM_CONSENTIMENTO", erro: "Sem o seu consentimento, a sua fala não é gravada." })
      },
      aoMudar,
      esperar: semEspera,
    })
    fila.adicionar(0, "a")
    fila.adicionar(1, "b")
    await fila.esvaziar()
    expect(fila.encerrada).toMatchObject({ status: 409, codigo: "SEM_CONSENTIMENTO" })
    expect(fila.pendentes).toEqual([])
    fila.adicionar(2, "c")
    expect(fila.pendentes).toEqual([], "depois de encerrada, nada mais entra")
  })

  it("fica atrasada quando nada chega ao servidor por mais de um minuto", async () => {
    let agora = 0
    let liberar
    const fila = new FilaDeEnvio({
      enviar: () => new Promise((_, falha) => (liberar = () => falha(new Error("rede")))),
      agora: () => agora,
      esperar: () => new Promise(() => {}), // fica esperando para sempre
    })
    fila.adicionar(0, "a")
    expect(fila.atrasada).toBe(false)
    agora = ATRASO_MS + 1
    expect(fila.atrasada).toBe(true)
    liberar()
  })
})

/** Um MediaRecorder falso: guarda o que recebeu e solta pedacos quando mandado. */
function gravadorFalso() {
  const instancias = []
  class Falso {
    static isTypeSupported = (m) => m === "audio/webm;codecs=opus"
    constructor(fluxo, opcoes) {
      this.fluxo = fluxo
      this.opcoes = opcoes
      this.state = "inactive"
      instancias.push(this)
    }
    start(intervalo) {
      this.intervalo = intervalo
      this.state = "recording"
    }
    stop() {
      this.state = "inactive"
      this.ondataavailable?.({ data: { size: 3, nome: "ultimo" } })
      this.onstop?.()
    }
    soltar(nome) {
      this.ondataavailable?.({ data: { size: 3, nome } })
    }
  }
  return { Falso, instancias }
}

function apiFalsa(extra = {}) {
  return {
    chamadas: [],
    async abrirGravacao(id, mime) {
      this.chamadas.push(["abrir", id, mime])
      return { id_audio: 77, segundos_por_parte: 10 }
    },
    async enviarParte(id, idAudio, n, blob, mime) {
      this.chamadas.push(["parte", idAudio, n, blob.nome, mime])
    },
    async fecharGravacao(id, idAudio) {
      this.chamadas.push(["fechar", idAudio])
    },
    ...extra,
  }
}

describe("SessaoDeGravacao", () => {
  it("abre a gravacao, grava a faixa a ~24 kbps em pedacos de 10 s, envia cada um e fecha ao parar", async () => {
    const { Falso, instancias } = gravadorFalso()
    const api = apiFalsa()
    const estados = []
    const sessao = new SessaoDeGravacao({
      idReuniao: 5,
      trilha: { kind: "audio" },
      api,
      Gravador: Falso,
      criarFluxo: (t) => ({ faixas: [t] }),
      aoEstado: (e) => estados.push(e.fase),
      esperar: semEspera,
    })
    await sessao.iniciar()
    const rec = instancias[0]
    expect(rec.opcoes).toEqual({ mimeType: "audio/webm;codecs=opus", audioBitsPerSecond: 24000 })
    expect(rec.intervalo).toBe(10000)
    expect(rec.fluxo.faixas[0]).toEqual({ kind: "audio" })

    rec.soltar("p0")
    rec.soltar("p1")
    await sessao.parar()

    expect(api.chamadas).toEqual([
      ["abrir", 5, "audio/webm;codecs=opus"],
      ["parte", 77, 0, "p0", "audio/webm;codecs=opus"],
      ["parte", 77, 1, "p1", "audio/webm;codecs=opus"],
      ["parte", 77, 2, "ultimo", "audio/webm;codecs=opus"],
      ["fechar", 77],
    ])
    expect(estados).toEqual(["iniciando", "gravando", "parada"])
  })

  it("o servidor recusa abrir (sem consentimento, sem espaco): fica 'recusada' com o motivo, sem gravar", async () => {
    const { Falso, instancias } = gravadorFalso()
    const api = apiFalsa({
      async abrirGravacao() {
        throw erroHttp(409, { erro: "O servidor está sem espaço para gravar agora." })
      },
    })
    const estados = []
    const sessao = new SessaoDeGravacao({ idReuniao: 5, trilha: {}, api, Gravador: Falso, criarFluxo: () => ({}), aoEstado: (e) => estados.push(e) })
    await sessao.iniciar()
    expect(instancias).toHaveLength(0)
    expect(estados.at(-1)).toEqual({ fase: "recusada", mensagem: "O servidor está sem espaço para gravar agora." })
  })

  it("navegador que nao grava audio: 'sem_suporte', e a pessoa segue na reuniao", async () => {
    const api = apiFalsa()
    const estados = []
    const sessao = new SessaoDeGravacao({ idReuniao: 5, trilha: {}, api, Gravador: undefined, aoEstado: (e) => estados.push(e.fase) })
    await sessao.iniciar()
    expect(estados.at(-1)).toBe("sem_suporte")
    expect(api.chamadas).toEqual([])
  })

  it("a gravacao fechada pelo servidor no meio (consentimento retirado em outra aba) para o gravador", async () => {
    const { Falso, instancias } = gravadorFalso()
    const api = apiFalsa({
      async enviarParte() {
        throw erroHttp(409, { erro: "Esta gravação já foi fechada." })
      },
    })
    const estados = []
    const sessao = new SessaoDeGravacao({
      idReuniao: 5,
      trilha: {},
      api,
      Gravador: Falso,
      criarFluxo: () => ({}),
      aoEstado: (e) => estados.push(e),
      esperar: semEspera,
    })
    await sessao.iniciar()
    instancias[0].soltar("p0")
    await tique()
    await tique()
    expect(instancias[0].state).toBe("inactive")
    expect(estados.at(-1)).toEqual({ fase: "parada", mensagem: "Esta gravação já foi fechada." })
  })
})
