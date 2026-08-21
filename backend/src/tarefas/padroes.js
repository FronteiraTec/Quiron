/**
 * O vocabulario de tarefas que toda incubadora ganha ao nascer: os STATUS (as
 * colunas do quadro) e a escala de PRIORIDADE.
 *
 * FONTE CANONICA dos status, no mesmo espirito de startups/padroes: sao PADRAO,
 * nao lista fixa. A incubadora renomeia, recolore, acrescenta ("Aguardando
 * terceiros") e desativa o que nao usa — o quadro se remonta a partir disso.
 *
 * POR QUE O STATUS TEM UMA `categoria`
 * `tarefa.status` e texto livre por incubadora, mas HA CODIGO ATRAS DELE: o
 * sistema precisa responder "esta aberta?", "esta atrasada?" e "quando foi
 * concluida?" sem entender o vocabulario de ninguem. A categoria e o que
 * responde. Uma incubadora pode chamar a ultima coluna de "Entregue",
 * "Fechada" ou "Arquivada"; enquanto ela declarar categoria CONCLUIDA, o
 * `concluida_ts` e preenchido e a tarefa para de aparecer como pendencia.
 *
 * E o mesmo desenho do `ciclo` de startup_situacao, e vale pelo mesmo motivo:
 * sem ele, a unica saida seria travar o vocabulario ou aceitar que o sistema
 * nao sabe mais o que esta em aberto.
 *
 * POR QUE A PRIORIDADE **NAO** E CONFIGURAVEL
 * Ela nao e um estagio do fluxo — e uma escala ordenada. Quatro degraus com
 * peso, que o quadro usa para desempatar cartoes e para colorir a borda.
 * Deixar a incubadora inventar prioridades daria "Alta", "Altissima" e
 * "Urgente!!" competindo numa ordenacao que ninguem entenderia.
 */

/**
 * Status padrao — as quatro colunas com que o quadro nasce.
 *
 * "Em revisao" entra de saida porque e onde o trabalho de uma incubadora
 * costuma parar: alguem fez, e falta um segundo par de olhos. Sem essa coluna,
 * ela vira um "Em andamento" que nao anda, e ninguem sabe de quem e a bola.
 */
const STATUS_PADRAO = [
  { chave: "A_FAZER",      rotulo: "A fazer",      cor: "#64748b", categoria: "PENDENTE",     ordem: 1 },
  { chave: "EM_ANDAMENTO", rotulo: "Em andamento", cor: "#6366f1", categoria: "EM_ANDAMENTO", ordem: 2 },
  { chave: "EM_REVISAO",   rotulo: "Em revisão",   cor: "#f59e0b", categoria: "EM_ANDAMENTO", ordem: 3 },
  { chave: "CONCLUIDA",    rotulo: "Concluída",    cor: "#10b981", categoria: "CONCLUIDA",    ordem: 4 },
]

/** As tres categorias — o enum tarefaCategoria do banco. */
const CATEGORIAS_VALIDAS = ["PENDENTE", "EM_ANDAMENTO", "CONCLUIDA"]

/**
 * A escala de prioridade — o enum tarefaPrioridade do banco.
 *
 * O `peso` e o que ordena: sem ele a ordenacao alfabetica poria "ALTA" antes de
 * "URGENTE" e "BAIXA" antes de "MEDIA", que e exatamente ao contrario do que a
 * palavra significa.
 */
const PRIORIDADES = [
  { chave: "BAIXA",   rotulo: "Baixa",   peso: 1 },
  { chave: "MEDIA",   rotulo: "Média",   peso: 2 },
  { chave: "ALTA",    rotulo: "Alta",    peso: 3 },
  { chave: "URGENTE", rotulo: "Urgente", peso: 4 },
]

const PRIORIDADES_VALIDAS = PRIORIDADES.map((p) => p.chave)

/** Prioridade de quem nao escolheu nenhuma: o meio da escala. */
const PRIORIDADE_PADRAO = "MEDIA"

module.exports = {
  STATUS_PADRAO,
  CATEGORIAS_VALIDAS,
  PRIORIDADES,
  PRIORIDADES_VALIDAS,
  PRIORIDADE_PADRAO,
}
