/**
 * Metadados de exibicao do Mini CRM: rotulos e cores dos valores fechados
 * (espelho dos enums da migracao 026) e os formatos de data, hora e dinheiro.
 *
 * DUAS FORMAS DE TEMPO, de proposito:
 *   - DATA (previsao de fechamento, data do ganho) chega como "AAAA-MM-DD" e e
 *     lida pelo TEXTO — `new Date("2026-11-05")` e meia-noite UTC, e em Brasilia
 *     isso e o dia 4.
 *   - INSTANTE (prazo da tarefa, data de cada evento) chega em ISO com "Z" e
 *     passa por `new Date`: ai a conversao para o fuso de quem le e o certo.
 */
import { PRIORIDADES } from "./tarefaMeta"
import { formatarCelular, formatarCnpj, somenteDigitos } from "../utils/mascaras"

export const STATUS_CLIENTE = {
  LEAD: { rotulo: "Lead", cor: "#0ea5e9" },
  ATIVO: { rotulo: "Cliente ativo", cor: "#16a34a" },
  INATIVO: { rotulo: "Inativo", cor: "#94a3b8" },
}

export const TIPO_PESSOA = {
  PF: { rotulo: "Pessoa física", curto: "PF" },
  PJ: { rotulo: "Pessoa jurídica", curto: "PJ" },
}

/** A situacao da oportunidade. Ganho e perda sao estados finais, nao etapas. */
export const SITUACAO = {
  ABERTA: { rotulo: "Em andamento", cor: "#0ea5e9" },
  GANHA: { rotulo: "Ganha", cor: "#16a34a" },
  PERDIDA: { rotulo: "Perdida", cor: "#dc2626" },
}

export const STATUS_TAREFA = {
  PENDENTE: { rotulo: "Pendente", cor: "#64748b" },
  EM_ANDAMENTO: { rotulo: "Em andamento", cor: "#0ea5e9" },
  CONCLUIDA: { rotulo: "Concluída", cor: "#16a34a" },
  CANCELADA: { rotulo: "Cancelada", cor: "#94a3b8" },
}

export const TAREFA_ABERTA = (status) => status === "PENDENTE" || status === "EM_ANDAMENTO"

/** As tres prioridades do CRM — as mesmas chaves e cores do quadro de tarefas, sem "Urgente". */
export const PRIORIDADES_CRM = PRIORIDADES.filter((p) => p.chave !== "URGENTE")

export const CANAIS_CONTATO = [
  { valor: "TELEFONE", rotulo: "Telefone" },
  { valor: "WHATSAPP", rotulo: "WhatsApp" },
  { valor: "EMAIL", rotulo: "E-mail" },
  { valor: "PRESENCIAL", rotulo: "Presencial" },
  { valor: "OUTRO", rotulo: "Outro" },
]

export const PERIODOS_PAINEL = [
  { valor: "30d", rotulo: "Últimos 30 dias" },
  { valor: "90d", rotulo: "Últimos 90 dias" },
  { valor: "12m", rotulo: "Últimos 12 meses" },
  { valor: "tudo", rotulo: "Todo o período" },
]

// ------------------------------------------------------------------ dinheiro

export function moeda(valor) {
  if (valor === null || valor === undefined || valor === "") return "—"
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

/** "R$ 12,5 mil" — para cabecalho de coluna e indicador, onde a largura e curta. */
export function moedaCurta(valor) {
  const n = Number(valor || 0)
  if (Math.abs(n) < 10000) return moeda(n)
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  })
}

// --------------------------------------------------------------------- datas

/** "2026-11-05" -> "05/11/2026", pelo texto. */
export function dataBR(valor) {
  if (!valor) return ""
  const [a, m, d] = String(valor).slice(0, 10).split("-")
  return a && m && d ? `${d}/${m}/${a}` : ""
}

/** Hoje como "AAAA-MM-DD", no fuso de quem esta olhando. */
export function hojeISO(agora = new Date()) {
  const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

/** Um instante (ISO) na data e hora de quem le: "05/11/2026 14:00". */
export function dataHoraBR(iso) {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const horaBR = (d) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })

/** Dias de calendario entre dois instantes, no fuso de quem le (negativo = passado). */
function diasDeCalendario(de, ate) {
  const a = new Date(de.getFullYear(), de.getMonth(), de.getDate())
  const b = new Date(ate.getFullYear(), ate.getMonth(), ate.getDate())
  return Math.round((b - a) / 86400000)
}

/** O dia local de um instante, "AAAA-MM-DD" — a chave do agrupamento da linha do tempo. */
export function diaLocal(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return hojeISO(d)
}

/** "Hoje", "Ontem" ou "segunda-feira, 2 de novembro" (com o ano, se nao for o corrente). */
export function rotuloDoDia(iso, agora = new Date()) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const dias = diasDeCalendario(d, agora)
  if (dias === 0) return "Hoje"
  if (dias === 1) return "Ontem"
  const texto = d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(d.getFullYear() !== agora.getFullYear() ? { year: "numeric" } : {}),
  })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** "14:32" no fuso de quem le. */
export function horaDe(iso) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "" : horaBR(d)
}

/** "agora", "há 5 min", "há 3 h", "ontem", "há 4 dias", ou a data. */
export function tempoRelativo(iso, agora = new Date()) {
  if (!iso) return ""
  const d = new Date(iso)
  const seg = Math.round((agora - d) / 1000)
  if (Number.isNaN(seg)) return ""
  if (seg < 60) return "agora"
  if (seg < 3600) return `há ${Math.floor(seg / 60)} min`
  const dias = -diasDeCalendario(agora, d)
  if (dias === 0) return `há ${Math.floor(seg / 3600)} h`
  if (dias === 1) return "ontem"
  if (dias < 30) return `há ${dias} dias`
  return d.toLocaleDateString("pt-BR")
}

/** Dias inteiros desde um instante (quanto tempo a oportunidade esta na etapa). */
export function diasDesde(iso, agora = new Date()) {
  if (!iso) return null
  const ms = agora - new Date(iso)
  return Number.isNaN(ms) ? null : Math.max(0, Math.floor(ms / 86400000))
}

/**
 * O estado do prazo de uma tarefa do CRM. A conclusao (ou o cancelamento) vem
 * primeiro: tarefa feita com atraso nao esta atrasada, foi feita.
 *
 * @returns {{tipo: 'sem-prazo'|'encerrada'|'atrasada'|'hoje'|'amanha'|'proxima'|'futura', rotulo: string}}
 */
export function situacaoVencimento(tarefa, agora = new Date()) {
  if (!tarefa?.vencimento_ts) return { tipo: "sem-prazo", rotulo: "Sem prazo" }
  const venc = new Date(tarefa.vencimento_ts)
  if (Number.isNaN(venc.getTime())) return { tipo: "sem-prazo", rotulo: "Sem prazo" }
  const quando = `${venc.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às ${horaBR(venc)}`
  if (!TAREFA_ABERTA(tarefa.status)) return { tipo: "encerrada", rotulo: quando }

  const dias = diasDeCalendario(agora, venc)
  if (venc < agora) {
    const atraso = -dias
    return {
      tipo: "atrasada",
      rotulo: atraso >= 1 ? `Atrasada ${atraso} dia${atraso > 1 ? "s" : ""}` : `Venceu às ${horaBR(venc)}`,
    }
  }
  if (dias === 0) return { tipo: "hoje", rotulo: `Hoje às ${horaBR(venc)}` }
  if (dias === 1) return { tipo: "amanha", rotulo: `Amanhã às ${horaBR(venc)}` }
  if (dias <= 3) return { tipo: "proxima", rotulo: `Em ${dias} dias` }
  return { tipo: "futura", rotulo: quando }
}

/** O valor de um <input type="datetime-local"> a partir de um instante ISO. */
export function paraCampoDataHora(iso) {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

/** O caminho inverso: o horario local do campo vira o instante ISO (UTC) da API. */
export function deCampoDataHora(valor) {
  if (!valor) return null
  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

// --------------------------------------------------------------- documentos

/** CPF "529.982.247-25" ou CNPJ "11.222.333/0001-81", pelo tamanho. */
export function formatarDocumento(valor) {
  const d = somenteDigitos(valor)
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
  if (d.length === 14) return formatarCnpj(d)
  return valor || ""
}

/** Mascara do campo enquanto se digita, pelo tipo de pessoa. */
export function mascararDocumento(valor, tipoPessoa) {
  const d = somenteDigitos(valor).slice(0, tipoPessoa === "PJ" ? 14 : 11)
  if (tipoPessoa === "PJ") return mascaraParcialCnpj(d)
  let s = d.slice(0, 3)
  if (d.length > 3) s += `.${d.slice(3, 6)}`
  if (d.length > 6) s += `.${d.slice(6, 9)}`
  if (d.length > 9) s += `-${d.slice(9)}`
  return s
}

function mascaraParcialCnpj(d) {
  let s = d.slice(0, 2)
  if (d.length > 2) s += `.${d.slice(2, 5)}`
  if (d.length > 5) s += `.${d.slice(5, 8)}`
  if (d.length > 8) s += `/${d.slice(8, 12)}`
  if (d.length > 12) s += `-${d.slice(12)}`
  return s
}

export const formatarTelefone = (valor) => formatarCelular(valor)

/** Link de conversa no WhatsApp (o numero e gravado sem o 55). */
export function linkWhatsapp(valor) {
  const d = somenteDigitos(valor)
  if (!d) return null
  return `https://wa.me/${d.length <= 11 ? `55${d}` : d}`
}

/** A mensagem de erro da API, ou uma frase padrao. */
export const erroDaApi = (err, padrao) => err?.response?.data?.erro || padrao
