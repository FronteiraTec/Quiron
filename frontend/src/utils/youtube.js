/**
 * Leitura de links do YouTube.
 *
 * A incubadora sempre anexa o video pelo YouTube — o link e colado no campo
 * "url" de um conteudo VIDEO/LINK da Biblioteca ou no bloco de video de uma
 * aula. Este e o UNICO ponto do frontend que sabe extrair o id do video das
 * varias formas de endereco que o YouTube produz; as telas so perguntam
 * "isto e YouTube?" e passam o resultado ao PlayerYoutube.
 *
 * Formas aceitas:
 *   youtube.com/watch?v=ID (&t=1m30s)   youtu.be/ID?t=90
 *   youtube.com/embed/ID                youtube.com/shorts/ID
 *   youtube.com/live/ID                 youtube.com/v/ID
 *   youtube.com/playlist?list=LISTA     (playlist sem video inicial)
 * Tambem vale o dominio youtube-nocookie.com, o m./music. e o link sem
 * "https://" na frente (que e como muita gente copia da barra do navegador).
 */

const HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
])

// Ids de video do YouTube tem 11 caracteres de [A-Za-z0-9_-].
const ID_VALIDO = /^[\w-]{11}$/

// Caminhos que trazem o id no segundo segmento: /embed/ID, /shorts/ID, ...
const SEGMENTOS_COM_ID = new Set(["embed", "shorts", "live", "v", "e"])

/**
 * Converte o "t"/"start" do link em segundos. O YouTube aceita tanto o numero
 * cru ("90") quanto o formato humano ("1m30s", "1h2m3s").
 */
function segundos(valor) {
  if (!valor) return 0
  const cru = String(valor).trim()
  if (/^\d+$/.test(cru)) return Number(cru)

  const m = cru.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i)
  if (!m || !m[0]) return 0
  return Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0)
}

/**
 * Le um endereco e devolve { id, inicio, lista } quando ele e do YouTube, ou
 * null quando nao e (link do Vimeo, PDF, arquivo interno...). Quem chama usa o
 * null para cair no cartao de link de sempre.
 */
export function lerYoutube(url) {
  if (!url || typeof url !== "string") return null

  const cru = url.trim()
  if (!cru) return null

  let u
  try {
    u = new URL(/^https?:\/\//i.test(cru) ? cru : `https://${cru}`)
  } catch {
    return null
  }

  if (!HOSTS.has(u.hostname.toLowerCase())) return null

  const partes = u.pathname.split("/").filter(Boolean)
  const lista = u.searchParams.get("list") || null
  const inicio = segundos(u.searchParams.get("t") || u.searchParams.get("start"))

  let id = null
  if (u.hostname.toLowerCase().endsWith("youtu.be")) {
    id = partes[0] || null
  } else if (partes[0] === "watch") {
    id = u.searchParams.get("v")
  } else if (SEGMENTOS_COM_ID.has(partes[0])) {
    id = partes[1] || null
  }

  // "videoseries" e o pseudo-id que o proprio YouTube usa no embed de
  // playlist; nao e um video, entao vale so a lista.
  if (id === "videoseries") id = null

  if (id && !ID_VALIDO.test(id)) return null
  if (!id && !lista) return null

  return { id, inicio, lista }
}

/** Atalho para os lugares que so querem saber se da para tocar aqui dentro. */
export const ehYoutube = (url) => lerYoutube(url) !== null

/**
 * Capa do video (a que o YouTube gera para todo video enviado). Usada na
 * fachada que aparece antes do play: assim a pagina nao carrega um iframe do
 * YouTube por video so de abrir o passo.
 */
export const capaYoutube = (id) => (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null)

/** Endereco para o botao "abrir no YouTube" (saida para a aba de fora). */
export function urlYoutube({ id, lista, inicio } = {}) {
  if (id) {
    const p = new URLSearchParams({ v: id })
    if (lista) p.set("list", lista)
    if (inicio) p.set("t", String(inicio))
    return `https://www.youtube.com/watch?${p}`
  }
  return lista ? `https://www.youtube.com/playlist?list=${lista}` : null
}
