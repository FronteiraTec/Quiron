/**
 * O endereco do provedor "compativel com a OpenAI" (url_base) — o unico que a
 * incubadora digita.
 *
 * O RISCO: quem configura a IA e admin da incubadora, nao da plataforma. Sem
 * esta conferencia, bastaria apontar a URL para dentro do servidor
 * (`http://postgres:5432`, `http://169.254.169.254/` dos metadados da nuvem)
 * para o lote noturno bater la com a chave e o audio de quem falou.
 *
 * A REGRA (docs/reunioes.md, secao 7):
 *   - so https, sem usuario/senha na URL;
 *   - o host nao pode ser nome interno (sem ponto, ou um servico do stack);
 *   - TODOS os enderecos para os quais o nome resolve tem de ser publicos.
 *
 * A EXCECAO e IA_URL_BASE_PERMITIDAS: a lista (separada por virgula) de bases
 * que o responsavel pelo SERVIDOR libera — um Whisper rodando na rede local,
 * por exemplo. Uma URL que comeca por uma delas passa direto, http inclusive.
 *
 * A conferencia roda ao salvar E antes de cada chamada (o nome pode passar a
 * resolver para outro lugar depois de salvo).
 */
const dns = require("dns").promises
const net = require("net")
const { erroNegocio } = require("../utils/erros")

/** Nomes dos servicos do proprio stack (docker-compose.yml). */
const NOMES_INTERNOS = new Set(["localhost", "postgres", "backend", "frontend", "nginx", "migracao", "processamento", "permissoes", "caddy"])

const PRIVADOS = new net.BlockList()
for (const [rede, bits] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 3], // multicast e reservados, ate 255.255.255.255
]) {
  PRIVADOS.addSubnet(rede, bits, "ipv4")
}
for (const [rede, bits] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
]) {
  PRIVADOS.addSubnet(rede, bits, "ipv6")
}

/** IPv4 escrito como IPv6 (::ffff:10.0.0.1) e conferido como IPv4. */
function enderecoPrivado(endereco, familia) {
  const mapeado = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(endereco)
  if (mapeado) return PRIVADOS.check(mapeado[1], "ipv4")
  return PRIVADOS.check(endereco, familia === 6 ? "ipv6" : "ipv4")
}

/** Sem barra no fim: a URL de cada chamada e montada como `${base}/...`. */
const semBarraFinal = (url) => url.replace(/\/+$/, "")

function permitidasPeloServidor() {
  return String(process.env.IA_URL_BASE_PERMITIDAS || "")
    .split(",")
    .map((s) => semBarraFinal(s.trim()))
    .filter(Boolean)
}

/**
 * Confere a url_base e devolve a forma normalizada, ou lanca 400.
 * @param {string} valor
 * @param {{resolver?: (host: string) => Promise<Array<{address: string, family: number}>>}} [opcoes]
 * @returns {Promise<string>}
 */
async function validarUrlBase(valor, { resolver } = {}) {
  const texto = String(valor ?? "").trim()
  if (!texto) throw erroNegocio(400, "Informe o endereço do provedor.")
  if (texto.length > 255) throw erroNegocio(400, "O endereço do provedor aceita no máximo 255 caracteres.")

  let url
  try {
    url = new URL(texto)
  } catch {
    throw erroNegocio(400, "O endereço do provedor não é uma URL válida.")
  }
  const normalizada = semBarraFinal(`${url.origin}${url.pathname}`)

  // A lista do servidor vem antes de tudo: e decisao de quem administra a VPS.
  if (permitidasPeloServidor().some((base) => normalizada === base || normalizada.startsWith(`${base}/`))) {
    return normalizada
  }

  if (url.protocol !== "https:") throw erroNegocio(400, "O endereço do provedor precisa começar com https://.")
  if (url.username || url.password) throw erroNegocio(400, "Não coloque usuário ou senha na URL; a chave vai no campo próprio.")
  if (url.search || url.hash) throw erroNegocio(400, "O endereço do provedor não leva ? nem #.")

  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase()
  const recusado = () => erroNegocio(400, "Este endereço aponta para uma rede interna e não pode ser usado.", "URL_INTERNA")

  if (net.isIP(host)) {
    if (enderecoPrivado(host, net.isIP(host))) throw recusado()
    return normalizada
  }
  if (NOMES_INTERNOS.has(host) || !host.includes(".") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw recusado()
  }

  let enderecos
  try {
    enderecos = resolver ? await resolver(host) : await dns.lookup(host, { all: true, verbatim: true })
  } catch {
    throw erroNegocio(400, `Não foi possível encontrar o endereço ${host}.`)
  }
  if (!enderecos.length || enderecos.some((e) => enderecoPrivado(e.address, e.family))) throw recusado()

  return normalizada
}

module.exports = { validarUrlBase }
