/**
 * O documento de uma aula, do lado do cliente.
 *
 * Funcoes puras sobre a estrutura que o BlockNote produz e consome (uma lista
 * de blocos). Ficam separadas dos componentes porque quem pergunta "esta
 * vazio?" nem sempre esta montando o editor — a tela do incubado precisa
 * decidir se renderiza a aula ou o formato antigo sem carregar o BlockNote.
 */

/** Blocos que valem por si, mesmo sem uma letra digitada. */
const BLOCOS_SEM_TEXTO = ["image", "divider", "table", "videoEmbutido", "anexo"]

/**
 * O bloco tem algum conteudo?
 *
 * Um paragrafo vazio nao conta: e o que o editor cria sozinho ao abrir, e
 * tratar isso como "aula escrita" faria toda aula nova nascer suja e disparar
 * um salvamento a toa.
 */
function blocoTemConteudo(bloco) {
  if (!bloco || typeof bloco !== "object") return false
  if (BLOCOS_SEM_TEXTO.includes(bloco.type)) return true

  const texto = Array.isArray(bloco.content)
    ? bloco.content.map((t) => t?.text ?? "").join("")
    : typeof bloco.content === "string"
      ? bloco.content
      : ""

  if (texto.trim()) return true
  return Array.isArray(bloco.children) && bloco.children.some(blocoTemConteudo)
}

/**
 * O documento esta vazio (nada escrito ainda)?
 * @param {Array|null|undefined} documento
 */
export function documentoVazio(documento) {
  if (!Array.isArray(documento) || documento.length === 0) return true
  return !documento.some(blocoTemConteudo)
}

/**
 * O que passar para `initialContent` do BlockNote.
 *
 * O editor RECUSA uma lista vazia (o ProseMirror precisa de pelo menos um
 * no), e responde a `undefined` criando um paragrafo em branco — que e
 * exatamente a aula nova. Por isso o vazio vira `undefined` aqui, e nao um
 * bloco fabricado a mao.
 *
 * @param {Array|null|undefined} documento
 * @returns {Array|undefined}
 */
export function conteudoInicial(documento) {
  if (!Array.isArray(documento) || documento.length === 0) return undefined
  return documento
}

/**
 * Resumo do documento em texto puro.
 *
 * Serve para onde o corpo aparece encolhido (card, busca, aviso) e nao ha
 * lugar para renderizar blocos. Nao e o formato de armazenamento — o
 * documento continua sendo a fonte de verdade.
 *
 * @param {Array} documento
 * @param {number} [limite] - corta o texto neste tamanho
 */
export function documentoParaTexto(documento, limite = 0) {
  if (!Array.isArray(documento)) return ""

  const pedacos = []
  const visitar = (blocos) => {
    for (const bloco of blocos) {
      if (Array.isArray(bloco?.content)) {
        pedacos.push(bloco.content.map((t) => t?.text ?? "").join(""))
      } else if (typeof bloco?.content === "string") {
        pedacos.push(bloco.content)
      }
      if (Array.isArray(bloco?.children)) visitar(bloco.children)
    }
  }
  visitar(documento)

  const texto = pedacos.filter(Boolean).join(" ").replace(/\s+/g, " ").trim()
  if (!limite || texto.length <= limite) return texto
  return `${texto.slice(0, limite).trimEnd()}…`
}
