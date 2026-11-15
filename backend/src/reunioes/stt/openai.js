/**
 * Transcricao pela API da OpenAI — e por qualquer servidor COMPATIVEL com ela
 * (Groq, um Whisper local), que muda so a `urlBase`.
 *
 * TEMPO DOS TRECHOS: o `whisper-1` (e os whisper dos compativeis) devolvem
 * cada segmento com inicio e fim (`verbose_json`). Os `gpt-4o-*-transcribe`
 * respondem so o texto: nesse caso `devolveTempos` e falso, e o lote corta o
 * audio nos silencios antes de mandar, para cada pedaco virar um trecho
 * (ver reunioes/transcricao.js).
 *
 * ALUCINACAO NO SILENCIO: o Whisper as vezes "ouve" frases inteiras onde nao
 * ha fala ("Obrigado por assistir"). O segmento com alta probabilidade de nao
 * ser fala E baixa confianca e descartado.
 */
const { ErroProvedor, TIPOS, chamar, wavDeSilencio } = require("../provedores")

const URL_OPENAI = "https://api.openai.com/v1"

/** O limite de upload da OpenAI e 25 MB; a folga cobre o multipart. */
const LIMITE_BYTES = 24 * 1024 * 1024

const EXTENSAO = { "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/webm": "webm", "audio/mp4": "m4a" }

/** O segmento que o Whisper inventou no silencio (heuristica usual). */
function pareceAlucinacao(segmento) {
  const semFala = Number(segmento.no_speech_prob ?? 0)
  const confianca = Number(segmento.avg_logprob ?? 0)
  return semFala > 0.6 && confianca < -1
}

/**
 * @param {{chave: string, modelo: string, urlBase?: string, rotulo?: string}} config
 */
function criarOpenAI({ chave, modelo, urlBase = URL_OPENAI, rotulo = "OpenAI" }) {
  const devolveTempos = /whisper/i.test(modelo)
  const base = urlBase.replace(/\/+$/, "")

  async function transcrever({ audio, mime, idioma = "pt", sinal }) {
    const tipo = String(mime).split(";")[0]
    const form = new FormData()
    form.append("file", new Blob([audio], { type: tipo }), `audio.${EXTENSAO[tipo] || "ogg"}`)
    form.append("model", modelo)
    form.append("language", idioma)
    if (devolveTempos) {
      form.append("response_format", "verbose_json")
      form.append("timestamp_granularities[]", "segment")
    } else {
      form.append("response_format", "json")
    }

    const resposta = await chamar(
      `${base}/audio/transcriptions`,
      { method: "POST", headers: { Authorization: `Bearer ${chave}` }, body: form },
      { rotulo, sinal }
    )
    let dados
    try {
      dados = await resposta.json()
    } catch {
      throw new ErroProvedor(TIPOS.RESPOSTA_INVALIDA, `${rotulo} respondeu algo que não é JSON.`)
    }

    if (Array.isArray(dados?.segments)) {
      return dados.segments
        .filter((s) => !pareceAlucinacao(s))
        .map((s) => ({
          texto: String(s.text ?? "").trim(),
          inicioMs: Math.round(Number(s.start) * 1000),
          fimMs: Math.round(Number(s.end) * 1000),
          confianca: Number.isFinite(Number(s.avg_logprob)) ? Math.exp(Number(s.avg_logprob)) : null,
        }))
        .filter((t) => t.texto && Number.isFinite(t.inicioMs) && Number.isFinite(t.fimMs))
    }
    if (typeof dados?.text === "string") {
      const texto = dados.text.trim()
      // Sem tempos: o trecho e o pedaco inteiro; quem chamou poe o fim.
      return texto ? [{ texto, inicioMs: 0, fimMs: null, confianca: null }] : []
    }
    throw new ErroProvedor(TIPOS.RESPOSTA_INVALIDA, `${rotulo} respondeu sem o texto da transcrição.`)
  }

  return {
    rotulo,
    origem: modelo,
    capacidades: () => ({ devolveTempos, limiteBytes: LIMITE_BYTES }),
    transcrever,
    /** Chave E modelo de uma vez: transcreve 1 s de silencio. */
    testar: ({ sinal } = {}) => transcrever({ audio: wavDeSilencio(1), mime: "audio/wav", sinal }).then(() => true),
  }
}

module.exports = { criarOpenAI, URL_OPENAI }
