/**
 * Vocabulario do engajamento no front: icones, ligas, gatilhos e os rotulos
 * que aparecem em mais de uma tela.
 *
 * ICONE E IMPORT, NAO STRING: o banco guarda "WorkspacePremium" e so este
 * arquivo sabe transformar isso num componente renderizavel. A lista e fechada
 * e espelha ICONES_VALIDOS em backend/src/engajamento/padroes.js, que rejeita
 * qualquer outro valor antes de gravar — mesmo arranjo de calendar/categorias.
 *
 * Ela PRECISA continuar contendo os icones da agenda: a acao de presenca nasce
 * copiando o icone da `evento_categoria` correspondente.
 */
import {
  // Herdados da agenda (categoriasPadrao.ICONES_VALIDOS).
  SupervisorAccount,
  School,
  AssignmentTurnedIn,
  Groups,
  Event,
  Campaign,
  HourglassBottom,
  Place,
  Handshake,
  EmojiEvents,
  Lightbulb,
  Coffee,
  VideoCall,
  MenuBook,
  Flag,
  Star,
  // Proprios do engajamento.
  MilitaryTech,
  WorkspacePremium,
  Bolt,
  LocalFireDepartment,
  Diversity3,
  VolunteerActivism,
  RocketLaunch,
  TrendingUp,
  Verified,
  HowToReg,
  Link,
  Weekend,
  Psychology,
  Public,
  Celebration,
  Insights,
  Favorite,
} from "@mui/icons-material"

export const ICONES = {
  SupervisorAccount,
  School,
  AssignmentTurnedIn,
  Groups,
  Event,
  Campaign,
  HourglassBottom,
  Place,
  Handshake,
  EmojiEvents,
  Lightbulb,
  Coffee,
  VideoCall,
  MenuBook,
  Flag,
  Star,
  MilitaryTech,
  WorkspacePremium,
  Bolt,
  LocalFireDepartment,
  Diversity3,
  VolunteerActivism,
  RocketLaunch,
  TrendingUp,
  Verified,
  HowToReg,
  Link,
  Weekend,
  Psychology,
  Public,
  Celebration,
  Insights,
  Favorite,
}

export const LISTA_ICONES = Object.keys(ICONES)

/** Resolve o nome guardado no banco. Nome desconhecido nao quebra a tela. */
export function iconeDe(nome, padrao = EmojiEvents) {
  return ICONES[nome] || padrao
}

/**
 * As duas ligas. Mentor disputa com mentor, incubado com incubado — e os
 * rotulos dizem isso na tela, para ninguem procurar o proprio nome na aba
 * errada.
 */
export const LIGAS = [
  { valor: "INCUBADO", rotulo: "Incubados", singular: "Incubado" },
  { valor: "MENTOR", rotulo: "Mentores", singular: "Mentor" },
]

export const rotuloLiga = (valor) =>
  LIGAS.find((l) => l.valor === valor)?.singular || "Sem liga"

/**
 * De onde o ponto nasce. O rotulo e explicativo de proposito: na tela de
 * configuracao, escolher o gatilho e a decisao mais importante da acao, e
 * "PRESENCA_EVENTO" nao explica nada sozinho.
 */
export const GATILHOS = [
  {
    valor: "PRESENCA_EVENTO",
    rotulo: "Presença em atividade da agenda",
    ajuda:
      "Pontua automaticamente quem for marcado como presente na lista de chamada de uma atividade da categoria escolhida.",
  },
  {
    valor: "MENTORIA_MINISTRADA",
    rotulo: "Mentoria realizada (mentor responsável)",
    ajuda:
      "Pontua o mentor responsável pela atividade, quando ela teve ao menos um participante presente. Só pode existir uma ação assim.",
  },
  {
    valor: "MANUAL",
    rotulo: "Lançamento da coordenação",
    ajuda:
      "Não é automática: alguém da coordenação registra a participação (coworking, indicação, ação institucional).",
  },
]

export const rotuloGatilho = (valor) =>
  GATILHOS.find((g) => g.valor === valor)?.rotulo || valor

export const PERIODOS_TETO = [
  { valor: "MES", rotulo: "por mês" },
  { valor: "TEMPORADA", rotulo: "por temporada" },
]

export const rotuloTeto = (acao) => {
  if (!acao?.teto_pontos) return "sem teto"
  const periodo = PERIODOS_TETO.find((p) => p.valor === acao.teto_periodo)?.rotulo || ""
  return `até ${acao.teto_pontos} ${periodo}`
}

/**
 * "22/08/2026" para colunas TIMESTAMP — instantes reais, formatados no fuso de
 * quem le (concedido_ts, revogado_ts).
 */
export const dataBR = (valor) => (valor ? new Date(valor).toLocaleDateString("pt-BR") : "")

/**
 * "22/08/2026" para colunas DATE (inicio_dt, fim_dt, ocorrido_dt).
 *
 * PRECISA SER DIFERENTE DE `dataBR`, e o motivo custa um bug de um dia: uma
 * coluna DATE nao tem hora nem fuso, mas chega aqui como "2026-07-01T00:00:00Z"
 * — meia-noite UTC. Formatada no fuso local (UTC-3), vira 30/06. A temporada
 * que comeca em 1o de julho aparecia comecando em 30 de junho.
 *
 * A leitura tem de ser pelos componentes UTC, ou pelo texto ISO direto: sao os
 * unicos que devolvem o dia que foi gravado.
 */
export function dataDiaBR(valor) {
  if (!valor) return ""
  const texto = typeof valor === "string" ? valor : new Date(valor).toISOString()
  const [ano, mes, dia] = texto.slice(0, 10).split("-")
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : ""
}

/** "12 pts" / "1 pt" — o plural que aparece em toda tela do modulo. */
export const pts = (n) => `${n} ${Number(n) === 1 ? "pt" : "pts"}`

/**
 * Quantos dias faltam para a temporada acabar. Negativo = ja acabou.
 * Usa so a data (sem hora): a temporada termina no fim do dia `fim_dt`.
 */
export function diasRestantes(temporada) {
  if (!temporada?.fim_dt) return null
  const fim = new Date(temporada.fim_dt)
  const hoje = new Date()
  const dias = Math.ceil(
    (Date.UTC(fim.getUTCFullYear(), fim.getUTCMonth(), fim.getUTCDate()) -
      Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())) /
      86400000
  )
  return dias
}
