/**
 * O ffmpeg do lote noturno: junta os pedacos de uma gravacao, normaliza,
 * mede, acha os silencios e recorta.
 *
 * O QUE O NAVEGADOR GRAVA: o MediaRecorder, com intervalo de 10 s, entrega UM
 * fluxo continuo fatiado — so o pedaco 0 tem o cabecalho do arquivo, e os
 * seguintes sao continuacao. Juntar os pedacos em ordem, byte a byte, refaz o
 * arquivo original. O Chrome/Edge/Firefox gravam WebM ou Ogg com Opus; o
 * Safari, MP4 com AAC.
 *
 * O PEDACO QUE NAO CHEGOU nao pode deslocar o resto. Juntar por cima do
 * buraco nao serve: testado em 14/11/2026, o WebM atravessa, mas o Ogg perde o
 * compasso e encurta o tempo, e o MP4 para de ler no buraco. Por isso quem
 * chama divide a gravacao em CORRIDAS de pedacos consecutivos e normaliza cada
 * uma separado. A corrida que nao comeca no pedaco 0 recebe na frente o
 * CABECALHO do pedaco 0 (`extrairCabecalho`): os quadros carregam o proprio
 * horario (cluster do WebM, granule do Ogg, tfdt do MP4), e o
 * `aresample=async=1:first_pts=0` preenche com silencio do inicio da gravacao
 * ate o primeiro quadro. Resultado: TODA corrida sai na linha do tempo da
 * gravacao inteira, e os trechos dela ja nascem no horario certo. Sem o pedaco
 * 0 nao ha cabecalho, e a gravacao nao se le (quem chama marca FALHOU).
 *
 * A SAIDA e sempre OGG/Opus mono, 16 kHz, ~24 kbps: o formato que todos os
 * provedores aceitam, ~11 MB por hora.
 *
 * O CONTEUDO VEM DO NAVEGADOR, entao o ffmpeg le com formato de entrada
 * FORCADO (lista fechada, nada de adivinhar) e protocolo so `file`.
 *
 * Tudo aqui e uma funcao sobre arquivos, sem banco: o lote recebe este modulo
 * por injecao, e o teste sem ffmpeg troca por um falso.
 */
const { spawn } = require("child_process")
const fsp = require("fs").promises

const FFMPEG = () => process.env.FFMPEG_BIN || "ffmpeg"
const FFPROBE = () => process.env.FFPROBE_BIN || "ffprobe"

/** O demuxer de cada formato aceito — e so estes. */
const FORMATO_ENTRADA = { "audio/webm": "matroska", "audio/ogg": "ogg", "audio/mp4": "mov" }

/** Codecs que se aceita decodificar. */
const CODECS = "opus,vorbis,aac"

/**
 * Roda um binario e devolve o stderr (onde o ffmpeg escreve o que interessa).
 * Prazo proprio: um arquivo malformado nao prende o lote.
 */
function executar(binario, args, { timeoutMs = 15 * 60 * 1000, sinal } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(binario, args, { stdio: ["ignore", "pipe", "pipe"] })
    let saida = ""
    let erro = ""
    proc.stdout.on("data", (d) => {
      if (saida.length < 1e6) saida += d
    })
    proc.stderr.on("data", (d) => {
      if (erro.length < 2e6) erro += d
    })
    const prazo = setTimeout(() => proc.kill("SIGKILL"), timeoutMs)
    const parar = () => proc.kill("SIGKILL")
    sinal?.addEventListener("abort", parar, { once: true })
    proc.on("error", (err) => {
      clearTimeout(prazo)
      reject(err.code === "ENOENT" ? new Error(`${binario} não está instalado.`) : err)
    })
    proc.on("close", (codigo) => {
      clearTimeout(prazo)
      sinal?.removeEventListener("abort", parar)
      if (codigo === 0) resolve({ saida, erro })
      else reject(new Error(`${binario} terminou com código ${codigo}: ${erro.split("\n").filter(Boolean).slice(-3).join(" | ")}`))
    })
  })
}

/**
 * Concatena os pedacos, em ordem, num arquivo so — com o cabecalho na frente,
 * quando vem. Cada pedaco tem no maximo 512 KB: lido inteiro e escrito.
 */
async function juntar(arquivosDasPartes, destino, cabecalho = null) {
  const saida = await fsp.open(destino, "w")
  try {
    if (cabecalho?.length) await saida.write(cabecalho)
    for (const arquivo of arquivosDasPartes) await saida.write(await fsp.readFile(arquivo))
  } finally {
    await saida.close()
  }
}

/** Posicao de uma sequencia de bytes, a partir de `desde`. */
const achar = (dados, texto, desde = 0) => dados.indexOf(Buffer.from(texto, "latin1"), desde)

/**
 * O cabecalho do arquivo, tirado do pedaco 0: tudo o que vem antes do primeiro
 * quadro de audio. Devolve null quando nao reconhece (a corrida sem o pedaco 0
 * fica de fora, e quem chama registra).
 *   WebM: ate o primeiro Cluster (1F 43 B6 75).
 *   Ogg:  as duas primeiras paginas (OpusHead e OpusTags).
 *   MP4:  ate o primeiro `moof` (ftyp + moov).
 */
function extrairCabecalho(mime, parte0) {
  const tipo = String(mime).split(";")[0]
  if (tipo === "audio/webm") {
    const i = parte0.indexOf(Buffer.from([0x1f, 0x43, 0xb6, 0x75]))
    return i > 0 ? parte0.subarray(0, i) : null
  }
  if (tipo === "audio/ogg") {
    let pos = 0
    for (let pagina = 0; pagina < 2; pagina++) {
      if (parte0.toString("latin1", pos, pos + 4) !== "OggS" || pos + 27 > parte0.length) return null
      const segmentos = parte0[pos + 26]
      let tamanho = 27 + segmentos
      for (let k = 0; k < segmentos; k++) tamanho += parte0[pos + 27 + k]
      pos += tamanho
    }
    return pos <= parte0.length ? parte0.subarray(0, pos) : null
  }
  if (tipo === "audio/mp4") {
    const i = achar(parte0, "moof")
    return i >= 4 ? parte0.subarray(0, i - 4) : null
  }
  return null
}

/**
 * Pedacos consecutivos -> OGG/Opus mono 16 kHz, na linha do tempo da gravacao.
 * @param {{partes: string[], mime: string, temporario: string, destino: string,
 *          cabecalho?: Buffer|null, sinal?: AbortSignal}} p
 */
async function normalizar({ partes, mime, temporario, destino, cabecalho = null, sinal }) {
  const formato = FORMATO_ENTRADA[String(mime).split(";")[0]]
  if (!formato) throw new Error(`Formato de gravação não aceito: ${mime}`)
  await juntar(partes, temporario, cabecalho)
  await executar(
    FFMPEG(),
    [
      "-hide_banner", "-nostdin", "-loglevel", "error", "-y",
      "-protocol_whitelist", "file",
      "-codec_whitelist", CODECS,
      // Um quadro cortado na emenda e descartado, e nao derruba o resto.
      "-fflags", "+discardcorrupt",
      "-err_detect", "ignore_err",
      // Mantem o horario de cada quadro como veio (sem isto o ffmpeg desloca a
      // entrada para comecar do zero, e a corrida depois de um buraco perderia
      // o lugar dela na linha do tempo).
      "-copyts",
      "-f", formato,
      "-i", temporario,
      "-vn",
      "-af", "aresample=async=1:first_pts=0",
      "-ac", "1", "-ar", "16000",
      "-c:a", "libopus", "-b:a", "24k", "-application", "voip",
      "-f", "ogg", destino,
    ],
    { sinal }
  )
}

/** Duracao, em segundos. */
async function duracao(arquivo, { sinal } = {}) {
  const { saida } = await executar(
    FFPROBE(),
    ["-v", "error", "-protocol_whitelist", "file", "-show_entries", "format=duration", "-of", "csv=p=0", arquivo],
    { sinal, timeoutMs: 60000 }
  )
  const s = Number(String(saida).trim())
  if (!Number.isFinite(s)) throw new Error("Não foi possível medir a duração do áudio.")
  return s
}

/**
 * Os silencios do arquivo: [{ inicio, fim }] em segundos.
 * Ruido abaixo de -35 dB por pelo menos 0,6 s conta como silencio.
 */
async function silencios(arquivo, { ruidoDb = -35, minimoS = 0.6, sinal } = {}) {
  const { erro } = await executar(
    FFMPEG(),
    ["-hide_banner", "-nostdin", "-protocol_whitelist", "file", "-i", arquivo, "-af", `silencedetect=noise=${ruidoDb}dB:d=${minimoS}`, "-f", "null", "-"],
    { sinal }
  )
  const lista = []
  let aberto = null
  for (const linha of erro.split("\n")) {
    const ini = /silence_start:\s*(-?[\d.]+)/.exec(linha)
    if (ini) aberto = Math.max(0, Number(ini[1]))
    const fim = /silence_end:\s*([\d.]+)/.exec(linha)
    if (fim && aberto !== null) {
      lista.push({ inicio: aberto, fim: Number(fim[1]) })
      aberto = null
    }
  }
  // Silencio ate o fim do arquivo: o ffmpeg abre e nao fecha.
  if (aberto !== null) lista.push({ inicio: aberto, fim: Infinity })
  return lista
}

/** Um pedaco do arquivo normalizado, em OGG/Opus. */
async function recortar(arquivo, inicioS, duracaoS, destino, { sinal } = {}) {
  await executar(
    FFMPEG(),
    [
      "-hide_banner", "-nostdin", "-loglevel", "error", "-y",
      "-protocol_whitelist", "file",
      "-ss", inicioS.toFixed(3), "-t", duracaoS.toFixed(3),
      "-i", arquivo,
      "-ac", "1", "-ar", "16000", "-c:a", "libopus", "-b:a", "24k", "-application", "voip",
      "-f", "ogg", destino,
    ],
    { sinal }
  )
}

module.exports = { normalizar, duracao, silencios, recortar, juntar, extrairCabecalho, FORMATO_ENTRADA }
