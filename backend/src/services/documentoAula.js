/**
 * O documento de uma AULA: o formato do editor de blocos (BlockNote).
 *
 * DUAS RESPONSABILIDADES, e as duas existem por motivos de fora do editor:
 *
 *   converterBlocos()  traduz o corpo ANTIGO (linhas de conteudo_bloco) para
 *                      o formato novo. Roda na LEITURA, nao numa migracao em
 *                      massa: assim o autor VE a aula convertida no editor
 *                      antes que qualquer coisa seja reescrita no banco.
 *
 *   validarDocumento() e o portao de entrada. O documento chega do cliente e
 *                      vai para uma coluna JSONB, entao o banco aceitaria
 *                      qualquer JSON — inclusive um <a href="javascript:...">
 *                      que o leitor da aula clicaria depois. Confiar no
 *                      editor aqui seria confiar no frontend.
 *
 * O FORMATO
 * Um documento e uma lista de blocos. Cada bloco:
 *   { type, props?, content?, children? }
 * `content` e a lista de trechos inline (texto com estilos, links). Os campos
 * omitidos o BlockNote preenche com o padrao ao carregar — por isso a
 * conversao abaixo escreve o minimo, e nao um bloco completo.
 */
const { erroNegocio } = require("../utils/erros")

// ---------------------------------------------------------------------------
// Tipos aceitos.
//
// Lista de PERMITIDOS, nao de proibidos: um tipo desconhecido e recusado. Os
// tres ultimos sao do Quiron (ver frontend/src/components/editor/esquema.jsx)
// e existem para que os blocos do editor antigo tenham para onde ir sem
// perder o que significavam.
// ---------------------------------------------------------------------------
const TIPOS_DOCUMENTO = [
  "paragraph",
  "heading",
  "quote",
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "toggleListItem",
  "codeBlock",
  "divider",
  "image",
  "table",
  // Do Quiron:
  "destaque", // a caixa de dica/atencao/boa pratica do editor antigo
  "videoEmbutido", // video do YouTube, que toca dentro do sistema
  "anexo", // arquivo de apoio da aula
]

// Esquemas que um endereco pode usar. E o mesmo conjunto que o BlockNote
// aceita em links (isAllowedUri), mais o caminho relativo — que e como a
// propria API serve os arquivos enviados (/api/arquivos/<uuid>).
const ESQUEMAS_PERMITIDOS = [
  "http:", "https:", "mailto:", "tel:", "ftp:", "ftps:", "callto:", "sms:", "xmpp:",
]

// Props que carregam endereco e precisam passar pela checagem acima.
const PROPS_COM_URL = ["url", "href", "src", "previewUrl"]

// Teto do documento inteiro, em bytes de JSON. O corpo do express aceita 4mb
// (server.js) e o logo ja pode levar 2mb; 1mb de JSON e muito texto — imagem
// nao entra aqui, sobe para /arquivos e fica como url.
const DOCUMENTO_MAX_BYTES = 1024 * 1024

// Ate onde o documento pode aninhar (lista dentro de lista dentro de...).
// Existe para que um JSON montado a mao nao derrube o servidor por recursao.
const PROFUNDIDADE_MAX = 10

// ---------------------------------------------------------------------------
// Conversao do formato antigo
// ---------------------------------------------------------------------------

/** Trecho inline de texto simples (o formato antigo nao tinha estilos). */
function textoInline(texto) {
  const valor = texto ?? ""
  if (!valor) return []
  return [{ type: "text", text: valor, styles: {} }]
}

/**
 * Traduz UM bloco antigo. O mapa cobre os oito tipos do enum blocoTipo; o
 * `default` existe porque o enum pode ganhar um valor antes deste arquivo
 * saber dele, e perder o texto seria pior que mostra-lo como paragrafo.
 */
function converterBloco(bloco) {
  const texto = bloco.texto ?? ""

  switch (bloco.tipo) {
    case "h1":
      return { type: "heading", props: { level: 1 }, content: textoInline(texto) }
    case "h2":
      return { type: "heading", props: { level: 2 }, content: textoInline(texto) }
    case "lista":
      return { type: "bulletListItem", content: textoInline(texto) }
    case "callout":
      return {
        type: "destaque",
        props: { variante: bloco.variante || "dica" },
        content: textoInline(texto),
      }
    case "video":
      return {
        type: "videoEmbutido",
        props: { url: bloco.url || "", legenda: bloco.nome || "" },
      }
    case "arquivo":
      return {
        type: "anexo",
        props: { url: bloco.url || "", nome: bloco.nome || "" },
      }
    case "divisor":
      return { type: "divider" }
    default:
      return { type: "paragraph", content: textoInline(texto) }
  }
}

/**
 * Traduz a lista inteira de blocos antigos para um documento.
 *
 * @param {Array<{tipo:string, texto?:string, url?:string, nome?:string, variante?:string}>} blocos
 * @returns {Array<object>} documento no formato BlockNote
 */
function converterBlocos(blocos) {
  if (!Array.isArray(blocos)) return []
  return blocos.map(converterBloco)
}

/**
 * O documento de uma aula, venha ele de onde vier.
 *
 * E a unica pergunta que as telas fazem: "qual e o corpo desta aula?". Quem
 * chama nao precisa saber se a aula e de antes ou de depois da migracao 018.
 *
 * @param {object} conteudo - a linha de `conteudo` (le tipo e documento)
 * @param {Array} [blocos] - as linhas de `conteudo_bloco`, quando houver
 * @returns {Array<object>|undefined} undefined para conteudo que nao e AULA
 */
function documentoDe(conteudo, blocos) {
  if (!conteudo || conteudo.tipo !== "AULA") return undefined
  if (Array.isArray(conteudo.documento)) return conteudo.documento
  return converterBlocos(blocos)
}

// ---------------------------------------------------------------------------
// Validacao
// ---------------------------------------------------------------------------

/**
 * O endereco e de um esquema que podemos servir ao leitor?
 *
 * `javascript:` num href e o caso que isto existe para barrar: o autor de uma
 * aula escreve para os incubados de outra empresa, e um link desses roda
 * script no navegador de quem le. `data:` cai junto — data:text/html e a
 * mesma coisa por outro caminho.
 *
 * Endereco relativo (/api/arquivos/<uuid>) passa: e a propria API.
 */
function urlPermitida(url) {
  if (typeof url !== "string" || !url.trim()) return true // vazio = bloco ainda sem midia
  const cru = url.trim()

  if (cru.startsWith("/")) return true

  // Sem esquema explicito o navegador trata como caminho relativo, o que e
  // seguro; com esquema, ele precisa estar na lista.
  const esquema = cru.match(/^([a-z][a-z0-9+.-]*):/i)
  if (!esquema) return true

  return ESQUEMAS_PERMITIDOS.includes(esquema[1].toLowerCase() + ":")
}

/** Imagem aceita tambem data:image — nao executa nada e e o que o colar gera. */
function urlDeImagemPermitida(url) {
  if (typeof url === "string" && /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(url.trim())) {
    return true
  }
  return urlPermitida(url)
}

/** Confere os enderecos de um bloco: os das props e os dos links do texto. */
function validarUrls(bloco, caminho) {
  const props = bloco.props
  if (props && typeof props === "object") {
    for (const chave of PROPS_COM_URL) {
      const valor = props[chave]
      if (valor === undefined || valor === null) continue

      const ok = bloco.type === "image" ? urlDeImagemPermitida(valor) : urlPermitida(valor)
      if (!ok) {
        throw erroNegocio(400, `${caminho}: endereco nao permitido em "${chave}".`)
      }
    }
  }

  if (Array.isArray(bloco.content)) {
    for (const trecho of bloco.content) {
      if (trecho && trecho.type === "link" && !urlPermitida(trecho.href)) {
        throw erroNegocio(400, `${caminho}: endereco de link nao permitido.`)
      }
    }
  }
}

/** Valida um bloco e desce nos filhos. */
function validarBloco(bloco, caminho, profundidade) {
  if (profundidade > PROFUNDIDADE_MAX) {
    throw erroNegocio(400, "O documento tem blocos aninhados demais.")
  }
  if (!bloco || typeof bloco !== "object" || Array.isArray(bloco)) {
    throw erroNegocio(400, `${caminho}: cada bloco deve ser um objeto.`)
  }
  if (typeof bloco.type !== "string" || !TIPOS_DOCUMENTO.includes(bloco.type)) {
    throw erroNegocio(
      400,
      `${caminho}: tipo de bloco invalido (${bloco.type}). Use: ${TIPOS_DOCUMENTO.join(", ")}.`
    )
  }

  validarUrls(bloco, caminho)

  if (bloco.children !== undefined) {
    if (!Array.isArray(bloco.children)) {
      throw erroNegocio(400, `${caminho}: "children" deve ser uma lista.`)
    }
    bloco.children.forEach((filho, i) =>
      validarBloco(filho, `${caminho} > bloco ${i + 1}`, profundidade + 1)
    )
  }
}

/**
 * Valida o documento inteiro. Lanca erro de negocio (400) na primeira falha.
 *
 * @param {string} tipo - tipo do conteudo; so AULA tem documento
 * @param {Array} documento
 */
function validarDocumento(tipo, documento) {
  if (tipo !== "AULA") {
    throw erroNegocio(400, "Apenas conteudos do tipo AULA possuem documento.")
  }
  if (!Array.isArray(documento)) {
    throw erroNegocio(400, "documento deve ser uma lista de blocos.")
  }

  const tamanho = Buffer.byteLength(JSON.stringify(documento), "utf8")
  if (tamanho > DOCUMENTO_MAX_BYTES) {
    throw erroNegocio(
      400,
      "O conteudo da aula passou do tamanho maximo. Divida-a em mais de uma aula."
    )
  }

  documento.forEach((bloco, i) => validarBloco(bloco, `Bloco ${i + 1}`, 1))
}

module.exports = {
  TIPOS_DOCUMENTO,
  DOCUMENTO_MAX_BYTES,
  converterBlocos,
  documentoDe,
  validarDocumento,
  urlPermitida,
}
