/**
 * Vocabulario e formatos das reunioes por video.
 *
 * DOIS RELOGIOS, como no backend (reuniaoRepository):
 *   - `inicio_ts` / `fim_ts` sao horario de PAREDE da incubadora, sem fuso:
 *     leia com `horaDoEvento`, nunca com `new Date()`.
 *   - os `*_ts` da reuniao (iniciada, encerrada, entrou, saiu) sao instantes
 *     em UTC, com "Z": esses sim vao para o fuso de quem le.
 *
 * `segundos_para_inicio` vem calculado pelo servidor no momento da resposta.
 * Para contar o tempo na tela, desconte o que passou desde que ela chegou
 * (`recebidoEm`) — o relogio do navegador pode estar errado, o intervalo nao.
 */
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { horaDoEvento } from "../utils/horaEvento"

export const MINUTOS_ANTES_PADRAO = 15

export const CATEGORIAS_REUNIAO = [
  { chave: "REUNIAO", rotulo: "Reunião" },
  { chave: "MENTORIA", rotulo: "Mentoria" },
]

export const PAPEIS_INCUBADORA = { admin: "Coordenação", mentor: "Mentor", usuario: "Incubado" }

export const ABERTAS = ["AGENDADA", "EM_ANDAMENTO"]
export const ehAberta = (reuniao) => ABERTAS.includes(reuniao?.status)

/**
 * Quantos segundos faltam para a sala abrir, agora. Negativo = ja abriu.
 * @param {object} reuniao - com `segundos_para_inicio` do servidor.
 * @param {number} recebidoEm - Date.now() de quando a resposta chegou.
 * @param {number} [agora]
 */
export function segundosParaAbrir(reuniao, recebidoEm, agora = Date.now(), minutosAntes = MINUTOS_ANTES_PADRAO) {
  if (typeof reuniao?.segundos_para_inicio !== "number") return null
  const passados = Math.max(0, Math.floor((agora - recebidoEm) / 1000))
  return reuniao.segundos_para_inicio - minutosAntes * 60 - passados
}

/**
 * A situacao que a tela mostra: o status, mais "Sala aberta" para a agendada
 * cuja sala ja abriu. Um rotulo so, como pede docs/reunioes.md (secao 6).
 *
 * @returns {{chave: string, rotulo: string, cor: string}}
 *   `cor` e uma cor de Chip do MUI.
 */
export function situacao(reuniao, recebidoEm = Date.now(), agora = Date.now(), minutosAntes) {
  switch (reuniao?.status) {
    case "EM_ANDAMENTO":
      return { chave: "EM_ANDAMENTO", rotulo: "Em andamento", cor: "success" }
    case "ENCERRADA":
      return { chave: "ENCERRADA", rotulo: "Encerrada", cor: "default" }
    case "CANCELADA":
      return { chave: "CANCELADA", rotulo: "Cancelada", cor: "default" }
    case "AGENDADA": {
      const faltam = segundosParaAbrir(reuniao, recebidoEm, agora, minutosAntes)
      if (faltam !== null && faltam <= 0) return { chave: "SALA_ABERTA", rotulo: "Sala aberta", cor: "primary" }
      return { chave: "AGENDADA", rotulo: "Agendada", cor: "info" }
    }
    default:
      return { chave: "DESCONHECIDA", rotulo: "—", cor: "default" }
  }
}

/** A pessoa pode entrar na sala agora? (O servidor confere de novo.) */
export function podeEntrarAgora(reuniao, recebidoEm, agora = Date.now(), minutosAntes) {
  if (!reuniao?.meu_papel || !ehAberta(reuniao)) return false
  const faltam = segundosParaAbrir(reuniao, recebidoEm, agora, minutosAntes)
  return faltam !== null && faltam <= 0
}

/** "quinta, 5 de nov · 14:00–15:00" */
export function quando(reuniao) {
  const inicio = horaDoEvento(reuniao?.inicio_ts)
  if (!inicio || Number.isNaN(inicio.getTime())) return "—"
  const fim = horaDoEvento(reuniao?.fim_ts)
  const dia = format(inicio, "EEE, d 'de' MMM", { locale: ptBR })
  const horas = fim ? `${format(inicio, "HH:mm")}–${format(fim, "HH:mm")}` : format(inicio, "HH:mm")
  return `${dia} · ${horas}`
}

/** Um instante UTC ("...Z") no fuso de quem le: "05/11/2026 14:03". */
export function instanteBR(iso) {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
}

/** "1 h 05 min", "12 min", "40 s". */
export function duracao(segundos) {
  if (segundos === null || segundos === undefined) return "—"
  const s = Math.max(0, Math.round(segundos))
  if (s < 60) return `${s} s`
  const min = Math.floor(s / 60)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  return `${h} h ${String(min % 60).padStart(2, "0")} min`
}

/** "em 2 h 10 min", "em 4 min", "em instantes". */
export function contagem(segundos) {
  if (segundos === null || segundos === undefined) return ""
  if (segundos <= 30) return "em instantes"
  return `em ${duracao(segundos)}`
}

/** Iniciais para o avatar de quem esta sem camera. */
export function iniciais(nome) {
  const partes = String(nome || "?").trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return "?"
  const primeira = partes[0][0]
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : ""
  return `${primeira}${ultima}`.toUpperCase()
}

/** Proximas primeiro pela mais cedo; historico pela mais recente. */
export function separarPorAba(reunioes) {
  const proximas = reunioes.filter(ehAberta).sort((a, b) => String(a.inicio_ts).localeCompare(String(b.inicio_ts)))
  const historico = reunioes.filter((r) => !ehAberta(r)).sort((a, b) => String(b.inicio_ts).localeCompare(String(a.inicio_ts)))
  return { proximas, historico }
}

/**
 * Os campos do formulario a partir de uma reuniao (edicao) ou dos padroes
 * (criacao: a proxima meia hora cheia, uma hora de duracao).
 */
export function formularioInicial(reuniao, agora = new Date()) {
  if (reuniao) {
    const inicio = horaDoEvento(reuniao.inicio_ts)
    const fim = horaDoEvento(reuniao.fim_ts)
    return {
      titulo: reuniao.titulo || "",
      categoria: reuniao.categoria || "REUNIAO",
      data: format(inicio, "yyyy-MM-dd"),
      horaInicio: format(inicio, "HH:mm"),
      horaFim: fim ? format(fim, "HH:mm") : "",
      idStartup: reuniao.id_startup || "",
      descricao: reuniao.descricao || "",
      participantes: (reuniao.participantes || []).filter((p) => p.papel !== "ANFITRIAO").map((p) => p.id_usuario),
      gravarAudio: reuniao.gravar_audio !== false,
    }
  }
  const inicio = new Date(agora)
  inicio.setSeconds(0, 0)
  inicio.setMinutes(inicio.getMinutes() < 30 ? 30 : 60)
  const fim = new Date(inicio.getTime() + 60 * 60000)
  return {
    titulo: "",
    categoria: "MENTORIA",
    data: format(inicio, "yyyy-MM-dd"),
    horaInicio: format(inicio, "HH:mm"),
    horaFim: format(fim, "HH:mm"),
    idStartup: "",
    descricao: "",
    participantes: [],
    gravarAudio: true,
  }
}

/**
 * O corpo do POST/PUT. O fim que fica antes do inicio e lido como "passa da
 * meia-noite": uma mentoria das 23:30 a 00:30 termina no dia seguinte.
 */
export function corpoDoFormulario(form, idTenant) {
  const inicio = `${form.data}T${form.horaInicio}:00`
  let fim = null
  if (form.horaFim) {
    // Igual ao inicio segue igual, e o servidor recusa ("o fim precisa ser
    // depois do inicio") — nao e uma reuniao de 24 horas.
    if (form.horaFim >= form.horaInicio) {
      fim = `${form.data}T${form.horaFim}:00`
    } else {
      const d = horaDoEvento(`${form.data}T00:00:00`)
      d.setDate(d.getDate() + 1)
      fim = `${format(d, "yyyy-MM-dd")}T${form.horaFim}:00`
    }
  }
  return {
    ...(idTenant ? { id_tenant: idTenant } : {}),
    titulo: form.titulo,
    categoria: form.categoria,
    inicio_ts: inicio,
    fim_ts: fim,
    id_startup: form.idStartup || null,
    descricao: form.descricao,
    participantes: form.participantes,
    gravar_audio: form.gravarAudio !== false,
  }
}

// ---------------------------------------------------------------------------
// GRAVACAO E TRANSCRICAO (Etapa 4)
// ---------------------------------------------------------------------------

/** Por que a reuniao nao grava, numa frase. */
export function motivoSemGravacao(gravacao) {
  switch (gravacao?.motivo) {
    case "DESLIGADA_NA_REUNIAO":
      return "O anfitrião desligou a gravação desta reunião."
    case "SEM_TRANSCRICAO":
      return "A incubadora não configurou a transcrição das reuniões."
    default:
      return "Esta reunião não é gravada."
  }
}

/** "logo depois da transcrição" / "2 dias depois da transcrição" */
function prazoDoAudio(dias) {
  if (!dias) return "logo depois da transcrição"
  return `${dias} ${dias === 1 ? "dia" : "dias"} depois da transcrição`
}

/**
 * O aviso antes de ligar o microfone (docs/reunioes.md, secao 7): o que e
 * gravado, quem transcreve, quem le, por quanto tempo fica, o dispositivo
 * compartilhado, e que da para retirar. Uma frase por item, para a tela
 * montar como lista.
 *
 * (O texto final precisa da validacao do juridico antes da producao. Quando o
 * relatorio por IA entrar — Etapa 5 —, ganha a frase sobre o resumo.)
 */
export function avisoDeGravacao(gravacao) {
  const r = gravacao?.retencao || { audio_dias: 0, transcricao_dias: 180 }
  return [
    "Só o seu microfone é gravado — nem vídeo, nem tela.",
    `À noite, a sua fala é transcrita por ${gravacao?.provedor_rotulo || "um provedor externo"}, contratado pela incubadora.`,
    "A transcrição é lida pelo anfitrião e pela coordenação da incubadora.",
    `O áudio é apagado ${prazoDoAudio(r.audio_dias)}; a transcrição fica guardada por ${r.transcricao_dias} dias.`,
    "Num computador ou celular compartilhado, tudo o que o microfone captar vai para a sua conta.",
    "Você pode retirar o consentimento a qualquer momento durante a reunião. Quem não aceita entra normalmente.",
  ]
}

/** "às 07:00" a partir de { fim: "07:00" }. */
const ateAs = (janela) => (janela?.fim ? `até as ${janela.fim}` : "na manhã seguinte")

/**
 * Onde esta a transcricao de uma reuniao encerrada, num rotulo so — a
 * continuacao da `situacao` (docs/reunioes.md, secao 6):
 *   Na fila da noite -> Transcrevendo -> Transcrita
 *   (ou) Falhou · Transcrita com lacunas · Sem gravacao · Gravacao desligada
 *
 * O ultimo processamento manda enquanto esta ativo ou quando falhou; depois
 * disso, o estado gravado na reuniao.
 *
 * @returns {{chave: string, rotulo: string, cor: string, detalhe: string|null}|null}
 */
export function situacaoTranscricao(reuniao) {
  if (reuniao?.status !== "ENCERRADA") return null
  const job = reuniao.processamento
  if (job?.status === "PROCESSANDO") return { chave: "TRANSCREVENDO", rotulo: "Transcrevendo", cor: "info", detalhe: null }
  if (job?.status === "PENDENTE") {
    return {
      chave: "NA_FILA",
      rotulo: "Na fila da noite",
      cor: "info",
      detalhe: job.erro_mensagem
        ? `A tentativa anterior não deu certo e será repetida: ${job.erro_mensagem}`
        : `A transcrição roda fora do horário de expediente e fica pronta ${ateAs(reuniao.janela_processamento)}.`,
    }
  }
  if (job?.status === "FALHOU") {
    return { chave: "FALHOU", rotulo: "A transcrição falhou", cor: "error", detalhe: job.erro_mensagem || null }
  }
  switch (reuniao.transcricao) {
    case "COMPLETA":
      return { chave: "COMPLETA", rotulo: "Transcrita", cor: "success", detalhe: null }
    case "INCOMPLETA":
      return { chave: "INCOMPLETA", rotulo: "Transcrita, com lacunas", cor: "warning", detalhe: reuniao.transcricao_obs || null }
    case "DESATIVADA":
      return { chave: "DESATIVADA", rotulo: "Gravação desligada", cor: "default", detalhe: null }
    default:
      if (job?.status === "CANCELADO") return { chave: "CANCELADA", rotulo: "Transcrição cancelada", cor: "default", detalhe: null }
      return { chave: "SEM_GRAVACAO", rotulo: "Sem gravação", cor: "default", detalhe: "Ninguém teve a fala gravada nesta reunião." }
  }
}

/** "14:03:27" de um instante UTC, no fuso de quem le. */
export function horaComSegundos(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleTimeString("pt-BR", { hour12: false })
}

/**
 * Junta os trechos seguidos da mesma pessoa num bloco so — e como a
 * transcricao se le melhor (uma "fala" por vez, e nao uma frase por linha).
 * Um silencio de mais de 30 s abre outro bloco, mesmo sendo a mesma pessoa.
 */
export function agruparTrechos(trechos, intervaloMs = 30000) {
  const blocos = []
  for (const t of trechos || []) {
    const ultimo = blocos[blocos.length - 1]
    const inicio = Date.parse(t.inicio_ts)
    if (ultimo && ultimo.id_usuario === t.id_usuario && inicio - ultimo.fimMs <= intervaloMs) {
      ultimo.textos.push(t.texto)
      ultimo.fimMs = Math.max(ultimo.fimMs, Date.parse(t.fim_ts))
    } else {
      blocos.push({ id_usuario: t.id_usuario, nome: t.nome, inicio_ts: t.inicio_ts, fimMs: Date.parse(t.fim_ts), textos: [t.texto], chave: t.id_trecho })
    }
  }
  return blocos
}

/** A transcricao em texto corrido, para copiar ou baixar. */
export function transcricaoEmTexto(reuniao, trechos) {
  const linhas = [`${reuniao?.titulo || "Reunião"} — ${quando(reuniao)}`, ""]
  for (const b of agruparTrechos(trechos)) {
    linhas.push(`[${horaComSegundos(b.inicio_ts)}] ${b.nome}: ${b.textos.join(" ")}`)
  }
  return linhas.join("\n")
}
