/**
 * O que todo provedor externo de IA (transcricao agora, relatorio na Etapa 5)
 * compartilha: o erro padronizado, a chamada HTTP com prazo e o filtro que
 * impede segredo de ir parar no banco ou no log.
 *
 * ERRO PADRONIZADO. Cada provedor traduz a propria falha num ErroProvedor com
 * um `tipo`, e a fila decide pelo tipo — nunca pelo codigo HTTP de cada
 * fornecedor (docs/reunioes.md, secao 5.2):
 *
 *   CHAVE_INVALIDA     401/403, ou a conta sem credito. Falha sem nova
 *                      tentativa e avisa quem configura a IA.
 *   LIMITE             429. Adia respeitando o Retry-After.
 *   TEMPORARIA         5xx, prazo vencido, rede. Adia com espera crescente.
 *   RESPOSTA_INVALIDA  o provedor respondeu, mas fora do formato esperado.
 *   RECUSADA           400/404/413/415/422: o pedido em si foi recusado
 *                      (modelo que nao existe, formato de audio). Repetir nao
 *                      adianta; e configuracao.
 *   SEM_CONFIGURACAO   a incubadora nao configurou (ou desativou) o provedor.
 */

class ErroProvedor extends Error {
  /**
   * @param {string} tipo - um de TIPOS.
   * @param {string} mensagem - ja limpa de segredos.
   * @param {{status?: number, retryAfterS?: number}} [extra]
   */
  constructor(tipo, mensagem, { status = null, retryAfterS = null } = {}) {
    super(mensagem)
    this.name = "ErroProvedor"
    this.tipo = tipo
    this.status = status
    this.retryAfterS = retryAfterS
  }
}

const TIPOS = Object.freeze({
  CHAVE_INVALIDA: "CHAVE_INVALIDA",
  LIMITE: "LIMITE",
  TEMPORARIA: "TEMPORARIA",
  RESPOSTA_INVALIDA: "RESPOSTA_INVALIDA",
  RECUSADA: "RECUSADA",
  SEM_CONFIGURACAO: "SEM_CONFIGURACAO",
})

/**
 * Tira de um texto tudo que tenha cara de segredo, e corta.
 *
 * Roda em TODA mensagem que vai para `erro_mensagem`, para o log da fila e
 * para o console. O provedor as vezes ecoa parte da chave no erro ("Incorrect
 * API key provided: sk-proj-...") — e o corpo inteiro da resposta nunca e
 * guardado, so a frase de erro dele.
 */
function limparSegredos(texto, max = 300) {
  let limpo = String(texto ?? "")
    .replace(/\b(Bearer|Token|Basic)\s+[^\s"',]+/gi, "$1 [oculto]")
    .replace(/\b(sk|pk|rk|gsk|xai|key|api[_-]?key)[-_][A-Za-z0-9_\-*.]{6,}/gi, "[oculto]")
    .replace(/\bAIza[0-9A-Za-z_-]{20,}/g, "[oculto]")
    // Qualquer sequencia longa sem espaco (hex, base64, JWT) e tratada como segredo.
    .replace(/[A-Za-z0-9_\-+/=.]{32,}/g, "[oculto]")
    .replace(/\s+/g, " ")
    .trim()
  if (limpo.length > max) limpo = `${limpo.slice(0, max - 1)}…`
  return limpo
}

/** A frase de erro que o provedor mandou no corpo, se houver. */
function fraseDoProvedor(corpo) {
  try {
    const json = JSON.parse(corpo)
    const frase =
      json?.error?.message || json?.error?.msg || json?.err_msg || json?.message || json?.detail ||
      (typeof json?.error === "string" ? json.error : null)
    return frase ? limparSegredos(frase, 200) : null
  } catch {
    return null
  }
}

/** O Retry-After em segundos (o cabecalho aceita segundos ou uma data HTTP). */
function lerRetryAfter(valor) {
  if (!valor) return null
  const n = Number(valor)
  if (Number.isFinite(n) && n >= 0) return Math.ceil(n)
  const data = Date.parse(valor)
  return Number.isFinite(data) ? Math.max(0, Math.ceil((data - Date.now()) / 1000)) : null
}

/**
 * fetch com prazo, que devolve a resposta OK ou lanca ErroProvedor.
 *
 * @param {string} url
 * @param {RequestInit} opcoes
 * @param {{rotulo: string, timeoutMs?: number, sinal?: AbortSignal}} contexto
 * @returns {Promise<Response>}
 */
async function chamar(url, opcoes, { rotulo, timeoutMs = 300000, sinal } = {}) {
  const prazo = AbortSignal.timeout(timeoutMs)
  const signal = sinal ? AbortSignal.any([sinal, prazo]) : prazo

  let resposta
  try {
    resposta = await fetch(url, { ...opcoes, signal, redirect: "error" })
  } catch (err) {
    if (prazo.aborted) {
      throw new ErroProvedor(TIPOS.TEMPORARIA, `${rotulo} não respondeu em ${Math.round(timeoutMs / 1000)} s.`)
    }
    if (sinal?.aborted) throw new ErroProvedor(TIPOS.TEMPORARIA, "Processamento interrompido.")
    throw new ErroProvedor(TIPOS.TEMPORARIA, `Sem conexão com ${rotulo} (${limparSegredos(err?.cause?.code || err?.message, 80)}).`)
  }

  if (resposta.ok) return resposta

  const corpo = await resposta.text().catch(() => "")
  const frase = fraseDoProvedor(corpo)
  const status = resposta.status
  const comFrase = (base) => (frase ? `${base} ${rotulo} disse: "${frase}"` : base)

  if (status === 401 || status === 403) {
    throw new ErroProvedor(TIPOS.CHAVE_INVALIDA, comFrase(`${rotulo} recusou a chave de API (${status}).`), { status })
  }
  if (status === 429) {
    // A OpenAI responde 429 tambem para a conta SEM CREDITO — esperar nao
    // resolve; e configuracao.
    if (/insufficient_quota|quota|billing|credit/i.test(corpo)) {
      throw new ErroProvedor(TIPOS.CHAVE_INVALIDA, comFrase(`A conta em ${rotulo} está sem crédito.`), { status })
    }
    throw new ErroProvedor(TIPOS.LIMITE, comFrase(`${rotulo} pediu para esperar (limite de uso).`), {
      status,
      retryAfterS: lerRetryAfter(resposta.headers.get("retry-after")),
    })
  }
  if (status === 408 || status === 409 || status >= 500) {
    throw new ErroProvedor(TIPOS.TEMPORARIA, comFrase(`${rotulo} falhou do lado dele (${status}).`), { status })
  }
  throw new ErroProvedor(TIPOS.RECUSADA, comFrase(`${rotulo} recusou o pedido (${status}).`), { status })
}

/**
 * Um WAV de 1 s de silencio (16 kHz, mono, 16 bits), montado na mao: e o que
 * o "testar conexao" manda para conferir chave E modelo de uma vez, sem
 * depender do ffmpeg.
 */
function wavDeSilencio(segundos = 1) {
  const taxa = 16000
  const dados = taxa * 2 * segundos
  const b = Buffer.alloc(44 + dados)
  b.write("RIFF", 0)
  b.writeUInt32LE(36 + dados, 4)
  b.write("WAVE", 8)
  b.write("fmt ", 12)
  b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20) // PCM
  b.writeUInt16LE(1, 22) // mono
  b.writeUInt32LE(taxa, 24)
  b.writeUInt32LE(taxa * 2, 28)
  b.writeUInt16LE(2, 32)
  b.writeUInt16LE(16, 34)
  b.write("data", 36)
  b.writeUInt32LE(dados, 40)
  return b
}

module.exports = { ErroProvedor, TIPOS, limparSegredos, chamar, lerRetryAfter, wavDeSilencio }
