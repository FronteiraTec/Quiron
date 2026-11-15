/**
 * Os pedacos de audio no volume `audio` da VPS (docs/reunioes.md, decisao 4).
 *
 *   <AUDIO_DIR>/<id_tenant>/<id_reuniao>/<id_audio>/<n>.parte
 *
 * O CAMINHO SAI SO DOS IDS, todos inteiros conferidos aqui: nada que o
 * navegador mande vira caminho. Nenhuma rota serve estes arquivos — eles so
 * saem do servidor para o provedor de transcricao da incubadora.
 *
 * Cada pedaco e gravado com criacao EXCLUSIVA (`wx`): o reenvio do mesmo
 * pedaco (o navegador repete o que nao recebeu resposta) nao sobrescreve nem
 * conta duas vezes.
 *
 * O AUDIO_DIR e lido a cada chamada, e nao no carregamento do modulo, para o
 * teste poder apontar para uma pasta temporaria.
 */
const fs = require("fs")
const fsp = fs.promises
const path = require("path")

const baseDir = () => process.env.AUDIO_DIR || path.resolve(__dirname, "../../audio")

/** Abaixo deste espaco livre a API para de aceitar pedacos (protege o Postgres). */
const minimoLivreMb = () => {
  const n = Number(process.env.AUDIO_DISCO_MIN_MB)
  return Number.isFinite(n) && n >= 0 ? n : 5120
}

function inteiro(valor, rotulo) {
  const n = Number(valor)
  if (!Number.isSafeInteger(n) || n < 0) throw new Error(`${rotulo} inválido para caminho de áudio: ${valor}`)
  return String(n)
}

function pastaDoAudio({ idTenant, idReuniao, idAudio }) {
  return path.join(baseDir(), inteiro(idTenant, "id_tenant"), inteiro(idReuniao, "id_reuniao"), inteiro(idAudio, "id_audio"))
}

const arquivoDaParte = (ids, n) => path.join(pastaDoAudio(ids), `${inteiro(n, "parte")}.parte`)

/**
 * Os primeiros bytes de cada formato aceito. So o pedaco 0 tem cabecalho de
 * arquivo; os seguintes sao continuacao do mesmo fluxo e nao tem assinatura
 * propria — a defesa deles e o ffmpeg ler com lista fechada de formatos.
 */
function confereAssinatura(mimeBase, dados) {
  if (!dados || dados.length < 12) return false
  switch (mimeBase) {
    case "audio/webm":
      return dados.readUInt32BE(0) === 0x1a45dfa3 // EBML
    case "audio/ogg":
      return dados.toString("latin1", 0, 4) === "OggS"
    case "audio/mp4":
      return dados.toString("latin1", 4, 8) === "ftyp"
    default:
      return false
  }
}

/**
 * Grava um pedaco. Devolve `novo: false` se ele ja existia (reenvio).
 * @returns {Promise<{novo: boolean}>}
 */
async function gravarParte(ids, n, dados) {
  await fsp.mkdir(pastaDoAudio(ids), { recursive: true })
  try {
    await fsp.writeFile(arquivoDaParte(ids, n), dados, { flag: "wx" })
    return { novo: true }
  } catch (err) {
    if (err.code === "EEXIST") return { novo: false }
    throw err
  }
}

/** Os numeros dos pedacos que estao no disco, em ordem. */
async function listarPartes(ids) {
  let nomes
  try {
    nomes = await fsp.readdir(pastaDoAudio(ids))
  } catch (err) {
    if (err.code === "ENOENT") return []
    throw err
  }
  return nomes
    .map((nome) => /^(\d+)\.parte$/.exec(nome))
    .filter(Boolean)
    .map((m) => Number(m[1]))
    .sort((a, b) => a - b)
}

/** Apaga a pasta da gravacao e as pastas vazias acima dela. */
async function apagarAudio(ids) {
  const pasta = pastaDoAudio(ids)
  await fsp.rm(pasta, { recursive: true, force: true })
  for (const acima of [path.dirname(pasta), path.dirname(path.dirname(pasta))]) {
    try {
      await fsp.rmdir(acima) // so apaga se estiver vazia
    } catch {
      break
    }
  }
}

/** Espaco livre no disco do volume, em MB. */
async function espacoLivreMb() {
  let alvo = baseDir()
  // O volume pode ainda nao ter a pasta (nenhuma gravacao): mede o pai.
  while (!fs.existsSync(alvo) && path.dirname(alvo) !== alvo) alvo = path.dirname(alvo)
  const info = await fsp.statfs(alvo)
  return (Number(info.bavail) * Number(info.bsize)) / (1024 * 1024)
}

async function temEspaco() {
  return (await espacoLivreMb()) >= minimoLivreMb()
}

/**
 * As pastas de gravacao mais velhas que `dias` (pelo arquivo mais recente
 * dentro dela) — a rede de seguranca da faxina, que nao depende do banco.
 * @returns {Promise<Array<{idTenant: number, idReuniao: number, idAudio: number}>>}
 */
async function pastasAntigas(dias, agora = Date.now()) {
  const limite = agora - dias * 86400000
  const achadas = []
  const numeros = async (dir) => {
    try {
      return (await fsp.readdir(dir, { withFileTypes: true }))
        .filter((d) => d.isDirectory() && /^\d+$/.test(d.name))
        .map((d) => d.name)
    } catch {
      return []
    }
  }
  for (const t of await numeros(baseDir())) {
    for (const r of await numeros(path.join(baseDir(), t))) {
      for (const a of await numeros(path.join(baseDir(), t, r))) {
        const pasta = path.join(baseDir(), t, r, a)
        let maisRecente = (await fsp.stat(pasta)).mtimeMs
        for (const nome of await fsp.readdir(pasta).catch(() => [])) {
          const st = await fsp.stat(path.join(pasta, nome)).catch(() => null)
          if (st && st.mtimeMs > maisRecente) maisRecente = st.mtimeMs
        }
        if (maisRecente < limite) achadas.push({ idTenant: Number(t), idReuniao: Number(r), idAudio: Number(a) })
      }
    }
  }
  return achadas
}

module.exports = {
  baseDir,
  minimoLivreMb,
  pastaDoAudio,
  arquivoDaParte,
  confereAssinatura,
  gravarParte,
  listarPartes,
  apagarAudio,
  espacoLivreMb,
  temEspaco,
  pastasAntigas,
}
