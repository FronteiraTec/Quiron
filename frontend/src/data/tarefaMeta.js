/**
 * Metadados de exibicao da GESTAO DE TAREFAS: a escala de PRIORIDADE e as
 * perguntas de prazo que varias telas fazem.
 *
 * A prioridade nao e vocabulario da incubadora (o status e — ver
 * tarefaConfigStore): e uma escala fixa de quatro degraus, espelho do enum
 * tarefaPrioridade do banco. Por isso ela mora num arquivo de dados do front,
 * como STATUS_ROTULO em startupMeta, e nao vem da API a cada carga.
 *
 * O PESO e o que ordena. Sem ele a ordenacao alfabetica poria "Alta" antes de
 * "Urgente" e "Baixa" antes de "Média", que e o contrario do que a palavra
 * significa — e a coluna "Prioridade" da tabela ficaria inutil justamente para
 * a pergunta que se faz dela.
 */

/** As quatro prioridades, do menos para o mais urgente. */
export const PRIORIDADES = [
  { chave: "BAIXA",   rotulo: "Baixa",   peso: 1, cor: "#64748b" },
  { chave: "MEDIA",   rotulo: "Média",   peso: 2, cor: "#0ea5e9" },
  { chave: "ALTA",    rotulo: "Alta",    peso: 3, cor: "#f59e0b" },
  { chave: "URGENTE", rotulo: "Urgente", peso: 4, cor: "#ef4444" },
]

const PORCHAVE = Object.fromEntries(PRIORIDADES.map((p) => [p.chave, p]))

/** A prioridade completa, com um fallback que nunca quebra a tela. */
export const prioridade = (chave) =>
  PORCHAVE[chave] || { chave, rotulo: chave || "—", peso: 0, cor: "#94a3b8" }

/**
 * A data que chega da API ("2026-08-19" ou o ISO completo) no formato BR.
 *
 * Corta os dez primeiros caracteres em vez de passar por `new Date`: o prazo e
 * um DIA, e `new Date("2026-08-19")` e interpretado como meia-noite UTC — em
 * Brasilia isso e 18/08 as 21h, e o prazo apareceria um dia mais cedo na tela.
 */
export const prazoBR = (valor) =>
  valor ? String(valor).slice(0, 10).split("-").reverse().join("/") : ""

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]

/**
 * O prazo curto do cartao: "12 mar", e "12 mar 2027" quando o ano nao e o
 * corrente. Pelo mesmo corte de texto do prazoBR, e pelo mesmo motivo.
 */
export function prazoCurto(valor) {
  if (!valor) return ""
  const [ano, mes, dia] = String(valor).slice(0, 10).split("-")
  const nomeMes = MESES[Number(mes) - 1]
  if (!nomeMes || !dia) return prazoBR(valor)
  const curto = `${Number(dia)} ${nomeMes}`
  return ano === String(new Date().getFullYear()) ? curto : `${curto} ${ano}`
}

/** Hoje como "YYYY-MM-DD", no fuso de quem esta olhando. */
function hojeISO() {
  const agora = new Date()
  const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

/**
 * Quantos dias faltam para o prazo (negativo = venceu, 0 = hoje).
 *
 * Compara textos "YYYY-MM-DD" convertidos a UTC, e nao objetos Date locais: e o
 * unico jeito de "vence hoje" significar a mesma coisa as 23h e as 6h.
 *
 * @returns {number|null} `null` quando nao ha prazo.
 */
export function diasAtePrazo(prazo) {
  if (!prazo) return null
  const dia = String(prazo).slice(0, 10)
  const alvo = Date.parse(`${dia}T00:00:00Z`)
  if (Number.isNaN(alvo)) return null
  return Math.round((alvo - Date.parse(`${hojeISO()}T00:00:00Z`)) / 86400000)
}

/**
 * O estado do prazo de uma tarefa, ja cruzado com a conclusao.
 *
 * A CONCLUSAO VEM PRIMEIRO: uma tarefa entregue com uma semana de atraso nao
 * esta atrasada — ela foi entregue. Pintar de vermelho o que ja foi feito
 * ensina a equipe a ignorar o vermelho.
 *
 * @param {object} tarefa - com `prazo` e `status_categoria`.
 * @returns {{tipo: 'sem-prazo'|'concluida'|'atrasada'|'hoje'|'proxima'|'futura',
 *            dias: number|null, rotulo: string, cor: string}}
 */
export function situacaoPrazo(tarefa) {
  const dias = diasAtePrazo(tarefa?.prazo)
  if (dias === null) return { tipo: "sem-prazo", dias: null, rotulo: "", cor: "text.secondary" }

  if (tarefa?.status_categoria === "CONCLUIDA") {
    return { tipo: "concluida", dias, rotulo: prazoBR(tarefa.prazo), cor: "text.secondary" }
  }
  if (dias < 0) {
    const atraso = Math.abs(dias)
    return {
      tipo: "atrasada",
      dias,
      rotulo: `Atrasada ${atraso} dia${atraso > 1 ? "s" : ""}`,
      cor: "error.main",
    }
  }
  if (dias === 0) return { tipo: "hoje", dias, rotulo: "Vence hoje", cor: "warning.main" }
  if (dias <= 3) {
    return { tipo: "proxima", dias, rotulo: `Em ${dias} dia${dias > 1 ? "s" : ""}`, cor: "warning.main" }
  }
  return { tipo: "futura", dias, rotulo: prazoBR(tarefa.prazo), cor: "text.secondary" }
}

/** Atalho: a tarefa esta aberta e o prazo ja passou? */
export const estaAtrasada = (tarefa) => situacaoPrazo(tarefa).tipo === "atrasada"
