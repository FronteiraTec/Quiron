/**
 * Metadados da Biblioteca de Conhecimento (rotulos, icones e cores).
 *
 * O acervo em si vem da API (/conteudos) — aqui fica so o que e de
 * apresentacao e nao pertence ao banco:
 *
 *   TIPO_CONTEUDO / TIPOS_ORDEM -> como cada tipo aparece e em que ordem
 *   TAGS                        -> vocabulario de temas do acervo
 *   BLOCOS_TIPOS / criarBloco   -> o editor de aulas estilo Notion
 *
 * As chaves de TIPO_CONTEUDO e de BLOCOS_TIPOS casam com os enums
 * conteudoTipo e blocoTipo do banco (schema.sql).
 */
import {
  MenuBook,
  Videocam,
  Description,
  Link as LinkIcon,
  Article,
} from "@mui/icons-material"

// ---------------------------------------------------------------------------
// Metadados por tipo de conteudo: rotulo, icone, cor de acento e o campo
// "corpo" que cada tipo edita. Centraliza o que varia entre os tipos.
// ---------------------------------------------------------------------------
export const TIPO_CONTEUDO = {
  AULA: {
    label: "Aula",
    plural: "Aulas",
    descricao: "Pagina rica com blocos: texto, videos, imagens e destaques.",
    icon: MenuBook,
    cor: "#6366f1",
  },
  VIDEO: {
    label: "Video",
    plural: "Videos",
    descricao: "Um video (link do YouTube/Vimeo ou upload) com descricao.",
    icon: Videocam,
    cor: "#ef4444",
  },
  ARQUIVO: {
    label: "Material",
    plural: "Materiais",
    descricao: "Arquivo de apoio: PDF, planilha, apresentacao.",
    icon: Description,
    cor: "#0d9488",
  },
  TEMPLATE: {
    label: "Template",
    plural: "Templates",
    descricao: "Modelo que a startup preenche e devolve como entregavel.",
    icon: Article,
    cor: "#f59e0b",
  },
  LINK: {
    label: "Link",
    plural: "Links",
    descricao: "Leitura complementar ou referencia externa.",
    icon: LinkIcon,
    cor: "#0ea5e9",
  },
}

// Ordem em que os tipos aparecem no menu "Novo conteudo" e nos filtros.
export const TIPOS_ORDEM = ["AULA", "VIDEO", "ARQUIVO", "TEMPLATE", "LINK"]

// Tags do acervo (temas de ensino). Servem de filtro e de organizacao.
export const TAGS = [
  "Ideacao",
  "Mercado",
  "Validacao",
  "Produto",
  "MVP",
  "Modelo de Negocio",
  "Financeiro",
  "Pitch",
  "Vendas",
  "Juridico",
]

// Gerador de ids locais para blocos ainda nao salvos (o editor precisa de uma
// key estavel antes de o servidor atribuir o id definitivo).
let _seq = 2000
export const novoId = (prefixo = "bloco") => `${prefixo}-${++_seq}`

// ---------------------------------------------------------------------------
// Fabrica de blocos (usados pela AULA — editor estilo Notion).
// Cada bloco: { id, tipo, texto, url?, nome?, variante? }.
// ---------------------------------------------------------------------------
export const BLOCOS_TIPOS = {
  h1: { label: "Titulo", atalho: "Titulo grande" },
  h2: { label: "Subtitulo", atalho: "Titulo de secao" },
  paragrafo: { label: "Texto", atalho: "Paragrafo comum" },
  lista: { label: "Lista", atalho: "Item com marcador" },
  callout: { label: "Destaque", atalho: "Caixa de dica/aviso" },
  video: { label: "Video", atalho: "Video embutido" },
  arquivo: { label: "Anexo", atalho: "Arquivo inline" },
  divisor: { label: "Divisor", atalho: "Linha separadora" },
}

export function criarBloco(tipo = "paragrafo") {
  const base = { id: novoId("bloco"), tipo, texto: "" }
  if (tipo === "callout") return { ...base, variante: "dica" }
  if (tipo === "video" || tipo === "arquivo") return { ...base, url: "", nome: "" }
  if (tipo === "divisor") return { id: base.id, tipo, texto: "" }
  return base
}

// ---------------------------------------------------------------------------
