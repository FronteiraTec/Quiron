/**
 * Vocabulario e apresentacao do Espaco do Mentor (migracao 020).
 *
 * O dado vem da API (/espaco-mentor e /jornada/materiais); aqui fica o que e
 * de tela: rotulos, icones, cores e os filtros que as listagens aplicam em
 * memoria — o mesmo desenho das outras listagens do sistema (TabelaDados), que
 * recebem tudo do backend e filtram no navegador.
 *
 * Funcoes puras, testadas em espacoMentorMeta.test.js.
 */
import {
  PictureAsPdf,
  Description,
  TableChart,
  Slideshow,
  Image as ImageIcon,
  Link as LinkIcon,
  InsertDriveFile,
  MenuBook,
  Videocam,
  Article,
} from "@mui/icons-material"

/**
 * O que o upload aceita, espelho de MIMES_PRIVADO do arquivoService (backend):
 * imagem, PDF, Office e texto. Quem decide e o servidor — isto so filtra o
 * seletor de arquivos para nao oferecer o que vai ser recusado.
 */
export const ACEITOS = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
].join(",")

/** O teto do regime PRIVADO no arquivoService (15MB). */
export const LIMITE_ARQUIVO_MB = 15
export const LIMITE_ARQUIVO = LIMITE_ARQUIVO_MB * 1024 * 1024

/** Teto da orientacao, igual ao do backend (mentores/material.js). */
export const MAX_ORIENTACAO = 2000

/**
 * O formato de um material, para o icone e para o filtro "tipo de arquivo".
 * A ordem aqui e a ordem do filtro.
 */
export const FORMATOS = {
  PDF: { rotulo: "PDF", icone: PictureAsPdf, cor: "#dc2626" },
  DOCUMENTO: { rotulo: "Documento", icone: Description, cor: "#2563eb" },
  PLANILHA: { rotulo: "Planilha", icone: TableChart, cor: "#16a34a" },
  APRESENTACAO: { rotulo: "Apresentação", icone: Slideshow, cor: "#ea580c" },
  IMAGEM: { rotulo: "Imagem", icone: ImageIcon, cor: "#9333ea" },
  LINK: { rotulo: "Link", icone: LinkIcon, cor: "#0ea5e9" },
  AULA: { rotulo: "Aula", icone: MenuBook, cor: "#6366f1" },
  VIDEO: { rotulo: "Vídeo", icone: Videocam, cor: "#ef4444" },
  TEMPLATE: { rotulo: "Template", icone: Article, cor: "#f59e0b" },
  ARQUIVO: { rotulo: "Arquivo", icone: InsertDriveFile, cor: "#64748b" },
}

/** O formato de um arquivo pelo tipo MIME. */
export function formatoDoMime(mime = "") {
  const m = String(mime || "").toLowerCase()
  if (m === "application/pdf") return "PDF"
  if (m.startsWith("image/")) return "IMAGEM"
  if (m.includes("spreadsheet") || m.includes("ms-excel") || m === "text/csv") return "PLANILHA"
  if (m.includes("presentation") || m.includes("ms-powerpoint")) return "APRESENTACAO"
  if (m.includes("word") || m === "text/plain") return "DOCUMENTO"
  return "ARQUIVO"
}

/**
 * O formato de um material — da biblioteca pessoal ou de um compartilhamento.
 *
 * As duas origens usam a palavra "ARQUIVO" para coisas diferentes: no material
 * pessoal e um upload (o MIME diz o formato); no conteudo da Biblioteca e um
 * material cujo endereco a incubadora digitou. `origem` desambigua.
 */
export function formatoDoMaterial(item) {
  if (!item) return "ARQUIVO"
  if (item.origem === "INSTITUCIONAL") {
    return FORMATOS[item.tipo] && item.tipo !== "ARQUIVO" ? item.tipo : "ARQUIVO"
  }
  if (item.tipo === "LINK") return "LINK"
  return formatoDoMime(item.arquivo_mime)
}

/** Material de referencia x apoio a uma atividade. */
export const FINALIDADES = {
  REFERENCIA: {
    rotulo: "Referência",
    descricao: "Para consulta. A startup encontra o material no lugar da trilha que você escolher.",
    cor: "#0ea5e9",
  },
  ATIVIDADE: {
    rotulo: "Apoio à atividade",
    descricao: "Associado a um passo da trilha: aparece dentro da atividade, junto da entrega.",
    cor: "#8b5cf6",
  },
}

/**
 * Em que pe o compartilhamento esta, do ponto de vista da startup (o backend
 * calcula — ver mentorCompartilhamentoService.situacao).
 */
export const SITUACOES = {
  DISPONIVEL: {
    rotulo: "Disponível",
    cor: "#10b981",
    ajuda: "A startup vê o material no lugar da trilha em que você o colocou.",
  },
  ETAPA_INDISPONIVEL: {
    rotulo: "Etapa indisponível",
    cor: "#f59e0b",
    ajuda:
      "A etapa foi desativada ou movida no Construtor. A startup continua vendo o material, no nível da trilha.",
  },
  FORA_DA_TRILHA: {
    rotulo: "Fora da trilha",
    cor: "#64748b",
    ajuda: "A startup não está mais nesta trilha e não vê o material.",
  },
}

/** Sugestoes de categoria, somadas as que o mentor ja usa. */
export const CATEGORIAS_SUGERIDAS = [
  "Modelo",
  "Planilha",
  "Roteiro",
  "Checklist",
  "Leitura",
  "Apresentação",
  "Estudo de caso",
]

/** Sugestoes sem repeticao, ignorando maiuscula, na ordem: as em uso primeiro. */
export function sugestoesDeCategoria(emUso = []) {
  const vistas = new Set()
  const lista = []
  for (const c of [...emUso, ...CATEGORIAS_SUGERIDAS]) {
    const chave = String(c || "").trim().toLowerCase()
    if (!chave || vistas.has(chave)) continue
    vistas.add(chave)
    lista.push(String(c).trim())
  }
  return lista
}

/** "1 material", "3 materiais". */
export const contarMateriais = (n) => (n === 1 ? "1 material" : `${n} materiais`)

/**
 * O material saiu ha pouco? E o selo "Novo" da aba da incubadora: o mentor
 * nao recebe aviso a cada publicacao (seria um e-mail por guia), entao a lista
 * mostra o que chegou nos ultimos dias.
 */
export function publicadoHaPouco(ts, agora = Date.now(), dias = 14) {
  const t = new Date(ts).getTime()
  return Number.isFinite(t) && agora - t >= 0 && agora - t <= dias * 24 * 60 * 60 * 1000
}

/**
 * Onde, dentro da trilha, um compartilhamento esta.
 *   sem etapa -> "Trilha inteira"
 *   FASE      -> "Fase X"
 *   PASSO     -> "Fase X › Passo Y"
 */
export function rotuloEtapa(item) {
  if (!item?.id_no) return "Trilha inteira"
  if (item.etapa_tipo === "PASSO") {
    return [item.fase_nome, item.etapa_nome].filter(Boolean).join(" › ")
  }
  return item.fase_nome || item.etapa_nome || "Trilha inteira"
}

/**
 * Data de um TIMESTAMP (criado_ts) no formato brasileiro. Aqui a conversao de
 * fuso e a desejada — e um instante, nao uma coluna DATE (ver
 * engajamento/vocabulario.js para a diferenca).
 */
export function dataBR(ts) {
  if (!ts) return ""
  const d = new Date(ts)
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR")
}

/** Busca sem acento e sem diferenca de maiuscula. */
export function normalizarBusca(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
}

/**
 * Filtra a biblioteca pessoal.
 *
 * @param {object[]} materiais
 * @param {{busca?: string, categorias?: string[], formatos?: string[], situacao?: string, compartilhado?: string}} filtros
 *   situacao: "ATIVOS" (padrao) | "ARQUIVADOS" | "TODOS"
 *   compartilhado: "SIM" | "NAO" | undefined
 */
export function filtrarMateriais(materiais = [], filtros = {}) {
  const termo = normalizarBusca(filtros.busca)
  const situacao = filtros.situacao || "ATIVOS"
  const categorias = filtros.categorias || []
  const formatos = filtros.formatos || []

  return materiais.filter((m) => {
    if (situacao === "ATIVOS" && m.arquivado) return false
    if (situacao === "ARQUIVADOS" && !m.arquivado) return false
    if (categorias.length && !categorias.includes(m.categoria || "")) return false
    if (formatos.length && !formatos.includes(formatoDoMaterial(m))) return false
    if (filtros.compartilhado === "SIM" && !(m.total_compartilhamentos > 0)) return false
    if (filtros.compartilhado === "NAO" && m.total_compartilhamentos > 0) return false
    if (termo) {
      const alvo = normalizarBusca(`${m.titulo} ${m.descricao || ""}`)
      if (!alvo.includes(termo)) return false
    }
    return true
  })
}

/**
 * Filtra a visao consolidada dos compartilhamentos.
 *
 * @param {object[]} lista
 * @param {{busca?: string, startups?: number[], trilhas?: number[], finalidades?: string[],
 *          origens?: string[], situacoes?: string[], autoria?: string}} filtros
 *   autoria: "MEUS" | "OUTROS" | undefined (todos)
 */
export function filtrarCompartilhamentos(lista = [], filtros = {}) {
  const termo = normalizarBusca(filtros.busca)
  const em = (valores, valor) => !valores?.length || valores.includes(valor)

  return lista.filter((c) => {
    if (!em(filtros.startups, c.id_startup)) return false
    if (!em(filtros.trilhas, c.id_programa)) return false
    if (!em(filtros.finalidades, c.finalidade)) return false
    if (!em(filtros.origens, c.origem)) return false
    if (!em(filtros.situacoes, c.situacao)) return false
    if (filtros.autoria === "MEUS" && !c.meu) return false
    if (filtros.autoria === "OUTROS" && c.meu) return false
    if (termo) {
      const alvo = normalizarBusca(
        `${c.titulo} ${c.startup_nome} ${c.orientacao || ""} ${c.programa_nome} ${rotuloEtapa(c)}`
      )
      if (!alvo.includes(termo)) return false
    }
    return true
  })
}

/**
 * Agrupa os materiais recebidos pelo lugar da trilha, para a Jornada.
 *   daTrilha       os que valem para a trilha inteira
 *   porFase(id)    os da fase E os dos passos dela
 *   doPasso(id)    os de um passo
 */
export function agruparRecebidos(materiais = []) {
  return {
    daTrilha: materiais.filter((m) => !m.id_no),
    porFase: (idFase) => materiais.filter((m) => m.id_no && Number(m.id_fase) === Number(idFase)),
    doPasso: (idPasso) =>
      materiais.filter((m) => m.etapa_tipo === "PASSO" && Number(m.id_no) === Number(idPasso)),
  }
}
