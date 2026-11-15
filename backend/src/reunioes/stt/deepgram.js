/**
 * Transcricao pelo Deepgram (POST /v1/listen, audio cru no corpo).
 *
 * Devolve "utterances" — cada fala continua com inicio e fim —, que e
 * exatamente o trecho que o Quiron guarda.
 */
const { ErroProvedor, TIPOS, chamar, wavDeSilencio } = require("../provedores")

const URL_DEEPGRAM = "https://api.deepgram.com/v1"

/** O Deepgram aceita ate 2 GB; o teto aqui so evita mandar algo absurdo. */
const LIMITE_BYTES = 500 * 1024 * 1024

/** O Deepgram quer a variante regional ("pt-BR"). */
const IDIOMAS = { pt: "pt-BR" }

/**
 * @param {{chave: string, modelo: string, urlBase?: string}} config
 */
function criarDeepgram({ chave, modelo, urlBase = URL_DEEPGRAM }) {
  const rotulo = "Deepgram"
  const base = urlBase.replace(/\/+$/, "")

  async function transcrever({ audio, mime, idioma = "pt", sinal }) {
    const params = new URLSearchParams({
      model: modelo,
      language: IDIOMAS[idioma] || idioma,
      punctuate: "true",
      smart_format: "true",
      utterances: "true",
    })
    const resposta = await chamar(
      `${base}/listen?${params}`,
      {
        method: "POST",
        headers: { Authorization: `Token ${chave}`, "Content-Type": String(mime).split(";")[0] },
        body: audio,
      },
      { rotulo, sinal }
    )
    let dados
    try {
      dados = await resposta.json()
    } catch {
      throw new ErroProvedor(TIPOS.RESPOSTA_INVALIDA, "Deepgram respondeu algo que não é JSON.")
    }

    const falas = dados?.results?.utterances
    if (Array.isArray(falas)) {
      return falas
        .map((u) => ({
          texto: String(u.transcript ?? "").trim(),
          inicioMs: Math.round(Number(u.start) * 1000),
          fimMs: Math.round(Number(u.end) * 1000),
          confianca: Number.isFinite(Number(u.confidence)) ? Number(u.confidence) : null,
        }))
        .filter((t) => t.texto && Number.isFinite(t.inicioMs) && Number.isFinite(t.fimMs))
    }
    const alternativa = dados?.results?.channels?.[0]?.alternatives?.[0]
    if (alternativa && typeof alternativa.transcript === "string") {
      const texto = alternativa.transcript.trim()
      return texto ? [{ texto, inicioMs: 0, fimMs: null, confianca: alternativa.confidence ?? null }] : []
    }
    throw new ErroProvedor(TIPOS.RESPOSTA_INVALIDA, "Deepgram respondeu sem o texto da transcrição.")
  }

  return {
    rotulo,
    origem: modelo,
    capacidades: () => ({ devolveTempos: true, limiteBytes: LIMITE_BYTES }),
    transcrever,
    testar: ({ sinal } = {}) => transcrever({ audio: wavDeSilencio(1), mime: "audio/wav", sinal }).then(() => true),
  }
}

module.exports = { criarDeepgram, URL_DEEPGRAM }
