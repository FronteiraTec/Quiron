/**
 * A gravacao da PROPRIA fala, no navegador de quem aceitou (docs/reunioes.md,
 * decisao 3 e secao 3.2).
 *
 * O MediaRecorder grava a MESMA faixa de microfone que vai para a sala — que
 * ja sai do navegador com o cancelamento de eco — e entrega um pedaco a cada
 * 10 s. Cada pedaco vai para a API em ordem, um de cada vez:
 *
 *   - falhou por rede ou pelo servidor (5xx, disco cheio): fica na fila e e
 *     reenviado com espera crescente (1 s, 2 s, 4 s ... ate 30 s). O servidor
 *     grava cada numero uma vez so, entao repetir nunca duplica;
 *   - o pedaco em si foi recusado (400, 413, 415): e descartado e a fila segue;
 *   - a GRAVACAO foi fechada do lado do servidor (404, 409 — consentimento
 *     retirado, reuniao encerrada ha mais de 10 min): a fila para de vez.
 *
 * Silenciar o microfone na sala NAO para a gravacao: o LiveKit desativa a
 * faixa sem destrui-la, e o gravador registra silencio — a linha do tempo
 * segue certa. Uma faixa NOVA (reconexao, troca de microfone) e outra
 * gravacao: quem cuida disso e o useGravacao.
 *
 * Se nenhum pedaco chega ao servidor por mais de 1 minuto, a sessao fica
 * "atrasada" e a sala avisa: "sua fala nao esta sendo gravada". A reuniao nao
 * para por isso.
 *
 * Sem React aqui: as duas classes recebem o que tocam o mundo (a API, o
 * MediaRecorder, o relogio, a espera), e o teste roda sem navegador.
 */

export const BITS_POR_SEGUNDO = 24000
/** Sem sucesso de envio por mais que isto: avisa a pessoa. */
export const ATRASO_MS = 60000
/** Pedacos que esperam na memoria (90 x 10 s = 15 min) antes de descartar os mais velhos. */
const MAX_PENDENTES = 90

// A mesma ordem do /reunioes/diagnostico: WebM/Opus (Chrome, Edge, Firefox),
// Ogg/Opus (Firefox antigo), MP4/AAC (Safari).
const CANDIDATOS = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm"]

/** O primeiro formato que este navegador grava, ou null. */
export function escolherFormato(Gravador = globalThis.MediaRecorder) {
  if (!Gravador) return null
  if (typeof Gravador.isTypeSupported !== "function") return "audio/webm"
  return CANDIDATOS.find((m) => Gravador.isTypeSupported(m)) || null
}

const statusDe = (err) => err?.response?.status ?? null

/** Envia os pedacos em ordem, repetindo o que falhou. */
export class FilaDeEnvio {
  /**
   * @param {{enviar: (item: {n: number, blob: Blob}) => Promise<unknown>,
   *          aoMudar?: () => void, agora?: () => number, esperar?: (ms: number) => Promise<void>}} p
   */
  constructor({ enviar, aoMudar = () => {}, agora = () => Date.now(), esperar = (ms) => new Promise((ok) => setTimeout(ok, ms)) }) {
    this.enviar = enviar
    this.aoMudar = aoMudar
    this.agora = agora
    this.esperar = esperar
    this.pendentes = []
    this.enviados = 0
    this.descartados = 0
    this.encerrada = null // { status, codigo, mensagem } quando o servidor fechou a gravacao
    this.ultimoSucesso = agora()
    this.rodando = false
    this.esperas = []
  }

  adicionar(n, blob) {
    if (this.encerrada) return
    this.pendentes.push({ n, blob })
    // Memoria cheia (servidor fora por muito tempo): sai o mais velho — menos
    // o pedaco 0, que tem o cabecalho sem o qual nada se le.
    while (this.pendentes.length > MAX_PENDENTES) {
      const i = this.pendentes.findIndex((p) => p.n !== 0)
      if (i < 0) break
      this.pendentes.splice(i, 1)
      this.descartados += 1
    }
    this.processar()
  }

  async processar() {
    if (this.rodando) return
    this.rodando = true
    let tentativa = 0
    try {
      while (this.pendentes.length && !this.encerrada) {
        const item = this.pendentes[0]
        try {
          await this.enviar(item)
          this.pendentes.shift()
          this.enviados += 1
          this.ultimoSucesso = this.agora()
          tentativa = 0
          this.aoMudar()
        } catch (err) {
          const status = statusDe(err)
          if (status === 404 || status === 409) {
            this.encerrada = {
              status,
              codigo: err?.response?.data?.codigo || null,
              mensagem: err?.response?.data?.erro || "A gravação foi encerrada pelo servidor.",
            }
            this.pendentes = []
            this.aoMudar()
            break
          }
          if (status === 400 || status === 413 || status === 415) {
            this.pendentes.shift()
            this.descartados += 1
            this.aoMudar()
            continue
          }
          tentativa += 1
          this.aoMudar()
          await this.esperar(Math.min(30000, 1000 * 2 ** (tentativa - 1)))
        }
      }
    } finally {
      this.rodando = false
      this.esperas.splice(0).forEach((ok) => ok())
    }
  }

  /** Ha pedaco esperando ha mais de ATRASO_MS sem nenhum envio dar certo? */
  get atrasada() {
    return this.pendentes.length > 0 && this.agora() - this.ultimoSucesso > ATRASO_MS
  }

  /**
   * Espera a fila esvaziar, ou o prazo (um relogio de verdade — a espera
   * injetada e so a das novas tentativas).
   */
  async esvaziar(prazoMs = 15000) {
    if (!this.rodando && !this.pendentes.length) return
    let relogio
    await Promise.race([
      new Promise((ok) => this.esperas.push(ok)),
      new Promise((ok) => {
        relogio = setTimeout(ok, prazoMs)
      }),
    ])
    clearTimeout(relogio)
  }
}

/**
 * Uma gravacao: abre no servidor, grava a faixa, envia os pedacos, fecha.
 *
 * `aoEstado` recebe { fase, mensagem }:
 *   iniciando | gravando | atrasada | parada | recusada | sem_suporte | erro
 */
export class SessaoDeGravacao {
  /**
   * @param {{idReuniao: number|string, trilha: MediaStreamTrack, api: object,
   *          Gravador?: typeof MediaRecorder, criarFluxo?: (t: MediaStreamTrack) => MediaStream,
   *          aoEstado?: (estado: {fase: string, mensagem: string|null}) => void,
   *          agora?: () => number, esperar?: (ms: number) => Promise<void>}} p
   */
  constructor({ idReuniao, trilha, api, Gravador = globalThis.MediaRecorder, criarFluxo, aoEstado = () => {}, agora, esperar }) {
    this.idReuniao = idReuniao
    this.trilha = trilha
    this.api = api
    this.Gravador = Gravador
    this.criarFluxo = criarFluxo || ((t) => new MediaStream([t]))
    this.aoEstado = aoEstado
    this.agora = agora
    this.esperar = esperar
    this.fase = null
    this.mensagem = null
    this.parando = false
    this.n = 0
  }

  definir(fase, mensagem = null) {
    if (this.fase === fase && this.mensagem === mensagem) return
    this.fase = fase
    this.mensagem = mensagem
    this.aoEstado({ fase, mensagem })
  }

  async iniciar() {
    this.definir("iniciando")
    this.mime = escolherFormato(this.Gravador)
    if (!this.mime) {
      this.definir("sem_suporte", "Este navegador não grava áudio. Você continua na reunião, sem ter a fala gravada.")
      return
    }
    let abertura
    try {
      abertura = await this.api.abrirGravacao(this.idReuniao, this.mime)
    } catch (err) {
      this.definir("recusada", err?.response?.data?.erro || "Não foi possível começar a gravar a sua fala.")
      return
    }
    if (this.parando) {
      // Saiu da sala enquanto a gravacao abria: fecha sem gravar nada.
      await this.api.fecharGravacao(this.idReuniao, abertura.id_audio).catch(() => {})
      return
    }
    this.idAudio = abertura.id_audio
    this.fila = new FilaDeEnvio({
      enviar: ({ n, blob }) => this.api.enviarParte(this.idReuniao, this.idAudio, n, blob, this.mime),
      aoMudar: () => this.conferir(),
      ...(this.agora ? { agora: this.agora } : {}),
      ...(this.esperar ? { esperar: this.esperar } : {}),
    })

    try {
      this.gravador = new this.Gravador(this.criarFluxo(this.trilha), { mimeType: this.mime, audioBitsPerSecond: BITS_POR_SEGUNDO })
    } catch (err) {
      this.definir("erro", `O navegador não conseguiu gravar: ${err?.message || "erro desconhecido"}.`)
      return
    }
    this.parou = new Promise((ok) => {
      this.gravador.onstop = ok
    })
    this.gravador.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this.fila.adicionar(this.n++, e.data)
    }
    this.gravador.onerror = (e) => this.definir("erro", `A gravação parou: ${e?.error?.name || "erro do navegador"}.`)
    this.gravador.start((abertura.segundos_por_parte || 10) * 1000)
    this.definir("gravando")
  }

  /** Atualiza a fase pela fila (chamado a cada envio e por um relogio). */
  conferir() {
    if (!this.fila || this.parando) return
    if (this.fila.encerrada) {
      this.pararGravador()
      this.definir("parada", this.fila.encerrada.mensagem)
      return
    }
    if (this.fase === "erro") return
    this.definir(this.fila.atrasada ? "atrasada" : "gravando")
  }

  pararGravador() {
    if (this.gravador && this.gravador.state !== "inactive") {
      try {
        this.gravador.stop()
      } catch {
        // ja parado
      }
    }
  }

  /**
   * Para de gravar, manda o que falta (o ultimo pedaco sai no stop) e fecha a
   * gravacao no servidor. Se a aba fechar no meio, o servidor fecha sozinho
   * pelo ultimo pedaco que chegou — perde-se no maximo o ultimo pedaco.
   */
  async parar() {
    if (this.parando) return
    this.parando = true
    if (this.gravador && this.gravador.state !== "inactive") {
      this.pararGravador()
      await Promise.race([this.parou, new Promise((ok) => setTimeout(ok, 2000))])
    }
    if (this.fila) await this.fila.esvaziar(15000)
    if (this.idAudio && !this.fila?.encerrada) {
      await this.api.fecharGravacao(this.idReuniao, this.idAudio).catch(() => {})
    }
    this.fase = "parada"
    this.aoEstado({ fase: "parada", mensagem: null })
  }
}
