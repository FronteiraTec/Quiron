/**
 * O vocabulario de engajamento que toda incubadora ganha ao nascer: as ACOES
 * que pontuam e as duas escadas de NIVEL.
 *
 * FONTE CANONICA desta lista, no mesmo espirito de eventos/categoriasPadrao e
 * tarefas/padroes. Sao PADRAO, nao lista fixa: a incubadora reprecifica,
 * renomeia, cria acao nova ("Plantao de duvidas") e desativa o que nao usa.
 *
 * NOTA: database/migrations/017_engajamento.sql repete esta lista em SQL
 * porque semeia os tenants que JA existiam, sem passar pelo service. Mexeu
 * aqui, veja la.
 *
 * ---------------------------------------------------------------------------
 * O QUE PODE ENTRAR NESTA LISTA, E O QUE NAO PODE
 *
 * Pontua PARTICIPACAO: mentoria, evento, workshop, acao da INNE, coworking,
 * indicacao — presenca e relacionamento com a incubadora.
 *
 * NAO PONTUA, por decisao da coordenacao: experimento, entrevista, validacao
 * de hipotese, pivotagem por evidencia, conclusao de momento formativo,
 * aplicacao de orientacao, ajudar outro empreendedor, compartilhar
 * conhecimento e publicar conteudo sobre a experiencia.
 *
 * Isso nao e uma omissao a corrigir: e o desenho. Transformar o trabalho
 * empreendedor em pontos faz a pessoa fazer o trabalho PELO PONTO, e a
 * incubadora perde justamente o sinal que queria medir. Esses elementos sao
 * evidencia de evolucao, e o lugar deles e o SELO — que vale reconhecimento
 * publico e ZERO ponto.
 * ---------------------------------------------------------------------------
 */

/** As duas ligas. Mentor disputa com mentor, incubado com incubado. */
const LIGAS = ["INCUBADO", "MENTOR"]

/**
 * Os tres gatilhos — de onde o ponto pode nascer.
 *
 *   PRESENCA_EVENTO     -> check-in marcado em `evento_presenca` (nao o RSVP).
 *   MENTORIA_MINISTRADA -> o outro lado: o mentor dono do evento.
 *   MANUAL              -> lancamento da coordenacao (coworking, indicacao).
 *
 * Nao ha gatilho de trilha, entrega, avaliacao ou conteudo, e nao e para
 * haver: ver o cabecalho.
 */
const GATILHOS = ["PRESENCA_EVENTO", "MENTORIA_MINISTRADA", "MANUAL"]

/** Janelas de teto. */
const PERIODOS_TETO = ["MES", "TEMPORADA"]

/**
 * Icones aceitos em acao, nivel e selo.
 *
 * Lista fechada pelo mesmo motivo de categoriasPadrao.ICONES_VALIDOS: icone e
 * componente MUI importado, nao string livre.
 *
 * PRECISA CONTINUAR SENDO SUPERCONJUNTO da lista da agenda: a acao de presenca
 * nasce copiando o icone da `evento_categoria` correspondente, e um icone
 * aceito la e recusado aqui faria a acao semeada ser rejeitada na primeira
 * edicao.
 */
const ICONES_VALIDOS = [
  // Herdados da agenda (categoriasPadrao.ICONES_VALIDOS).
  "SupervisorAccount", "School", "AssignmentTurnedIn", "Groups", "Event",
  "Campaign", "HourglassBottom", "Place", "Handshake", "EmojiEvents",
  "Lightbulb", "Coffee", "VideoCall", "MenuBook", "Flag", "Star",
  // Proprios do engajamento.
  "MilitaryTech", "WorkspacePremium", "Bolt", "LocalFireDepartment",
  "Diversity3", "VolunteerActivism", "RocketLaunch", "TrendingUp", "Verified",
  "HowToReg", "Link", "Weekend", "Psychology", "Public", "Celebration",
  "Insights", "Favorite",
]

/**
 * Acoes de PRESENCA, por categoria da agenda.
 *
 * A chave da acao e derivada da categoria (`PRESENCA_<CHAVE>`), e o rotulo e o
 * icone saem da propria `evento_categoria`: a agenda ja e o vocabulario de
 * atividades da incubadora, e manter uma segunda lista aqui garantiria que as
 * duas divergissem no primeiro evento novo.
 *
 * ENTREGA e PRAZO ficam de fora de proposito — sao marcos da trilha, nao
 * participacao. Categoria sem acao vale zero, e o opt-in e explicito: nada
 * pontua por acidente so porque virou evento no calendario.
 */
const PONTOS_POR_CATEGORIA = [
  { categoria: "MENTORIA", pontos: 15, ordem: 1 },
  { categoria: "WORKSHOP", pontos: 10, ordem: 2 },
  { categoria: "PITCH", pontos: 12, ordem: 3 },
  { categoria: "EVENTO", pontos: 8, ordem: 4 },
  { categoria: "REUNIAO", pontos: 5, ordem: 5 },
  { categoria: "VISITA", pontos: 5, ordem: 6 },
]

/** Prefixo da chave das acoes de presenca. */
const PREFIXO_PRESENCA = "PRESENCA_"

/**
 * A acao do MENTOR — o outro lado da presenca.
 *
 * "Mentoria realizada" e evento com mentor dono e AO MENOS UM PRESENTE. Nao e
 * o mentor que declara: e a lista de chamada fechada pela coordenacao que
 * prova que a mentoria aconteceu. Vale so na liga MENTOR.
 */
const ACAO_MENTORIA = {
  chave: "MENTORIA_REALIZADA",
  rotulo: "Mentoria realizada",
  descricao:
    "Pontua o mentor responsável por uma atividade que teve ao menos um participante presente.",
  gatilho: "MENTORIA_MINISTRADA",
  liga: "MENTOR",
  pontos: 15,
  icone: "SupervisorAccount",
  cor: "#6366f1",
  ordem: 10,
}

/**
 * Acoes MANUAIS — o que a coordenacao registra a mao porque o sistema nao tem
 * como saber sozinho.
 *
 * O COWORKING NASCE COM TETO, e o teto e o ponto: a 3 pontos por dia sem
 * limite, o ranking premiaria quem mora no predio em vez de quem se relaciona
 * com a incubadora. 30/mes e o equivalente a dez dias — depois disso o uso
 * continua sendo registrado no extrato, valendo zero.
 */
const ACOES_MANUAIS = [
  {
    chave: "ACAO_INNE",
    rotulo: "Ação da INNE",
    descricao:
      "Participação em ação institucional da incubadora (feira, comitiva, representação).",
    gatilho: "MANUAL",
    pontos: 20,
    icone: "Campaign",
    cor: "#8b5cf6",
    ordem: 20,
  },
  {
    chave: "COWORKING",
    rotulo: "Uso do coworking",
    descricao:
      "Presença no espaço de coworking. Tem teto mensal: o espaço é para trabalhar, não para pontuar.",
    gatilho: "MANUAL",
    pontos: 3,
    teto_pontos: 30,
    teto_periodo: "MES",
    icone: "Weekend",
    cor: "#0ea5e9",
    ordem: 21,
  },
  {
    chave: "INDICACAO",
    rotulo: "Indicação",
    descricao: "Indicou uma startup, um mentor ou um parceiro que chegou até a incubadora.",
    gatilho: "MANUAL",
    pontos: 25,
    icone: "Handshake",
    cor: "#10b981",
    ordem: 22,
  },
]

/**
 * As duas escadas de nivel.
 *
 * POR LIGA porque os volumes sao diferentes: o mentor aparece em menos
 * atividades que o incubado, e uma escada unica deixaria a liga inteira dos
 * mentores parada no primeiro degrau.
 *
 * OS NOMES DESCREVEM COMPORTAMENTO ("Presente", "Protagonista"), e nao metal
 * ("Bronze", "Prata"). O nivel aparece no perfil e e o que a pessoa repete
 * quando fala de si: "sou Embaixador INNE" diz alguma coisa para quem esta de
 * fora; "sou Ouro" nao diz nada.
 *
 * O RANKING e relativo (so um e o primeiro, e quem esta em 14o desiste); o
 * NIVEL e absoluto (todo mundo pode chegar ao topo). E o nivel que mantem no
 * jogo quem nunca vai ganhar a viagem — por isso os dois existem.
 */
const NIVEIS_PADRAO = [
  { liga: "INCUBADO", ordem: 1, nome: "Conectado", pontos_min: 0, cor: "#94a3b8", icone: "Link" },
  { liga: "INCUBADO", ordem: 2, nome: "Presente", pontos_min: 100, cor: "#0ea5e9", icone: "HowToReg" },
  { liga: "INCUBADO", ordem: 3, nome: "Engajado", pontos_min: 250, cor: "#6366f1", icone: "LocalFireDepartment" },
  { liga: "INCUBADO", ordem: 4, nome: "Protagonista", pontos_min: 500, cor: "#8b5cf6", icone: "WorkspacePremium" },
  { liga: "INCUBADO", ordem: 5, nome: "Embaixador INNE", pontos_min: 1000, cor: "#f59e0b", icone: "EmojiEvents" },

  { liga: "MENTOR", ordem: 1, nome: "Conectado", pontos_min: 0, cor: "#94a3b8", icone: "Link" },
  { liga: "MENTOR", ordem: 2, nome: "Presente", pontos_min: 80, cor: "#0ea5e9", icone: "HowToReg" },
  { liga: "MENTOR", ordem: 3, nome: "Atuante", pontos_min: 200, cor: "#6366f1", icone: "LocalFireDepartment" },
  { liga: "MENTOR", ordem: 4, nome: "Referência", pontos_min: 400, cor: "#8b5cf6", icone: "WorkspacePremium" },
  { liga: "MENTOR", ordem: 5, nome: "Embaixador INNE", pontos_min: 800, cor: "#f59e0b", icone: "EmojiEvents" },
]

/**
 * O nome e o periodo da temporada corrente, no formato "AAAA.1" / "AAAA.2".
 *
 * SEMESTRAL porque a premiacao e semestral: temporada e periodo de premiacao
 * tem que ser a mesma janela, senao o ranking que decide o premio nao e o
 * ranking que a tela mostra.
 *
 * @param {Date} [hoje]
 */
function temporadaDoSemestre(hoje = new Date()) {
  const ano = hoje.getFullYear()
  const primeiroSemestre = hoje.getMonth() < 6
  return {
    nome: `${ano}.${primeiroSemestre ? 1 : 2}`,
    inicio_dt: primeiroSemestre ? `${ano}-01-01` : `${ano}-07-01`,
    fim_dt: primeiroSemestre ? `${ano}-06-30` : `${ano}-12-31`,
  }
}

/**
 * O texto que a tela exibe sobre o que NAO pontua.
 *
 * Mora no backend, e nao so no front, porque e POLITICA da coordenacao e nao
 * decoracao de tela: quem consumir a API por outro caminho tem que receber a
 * mesma regra. Sem isso, a primeira pessoa que entregar um passo da trilha e
 * nao vir ponto nenhum vai abrir chamado dizendo que o sistema quebrou.
 */
const NAO_PONTUAM = [
  "Experimentos, entrevistas e validação de hipótese",
  "Pivotagem baseada em evidências",
  "Conclusão de momento formativo da trilha",
  "Aplicação de orientação recebida",
  "Ajudar outro empreendedor",
  "Compartilhar conhecimento",
  "Publicar ou construir conteúdo sobre a experiência",
]

/**
 * Por que a lista acima nao pontua. Uma frase, porque a tela mostra uma frase.
 */
const MOTIVO_NAO_PONTUAM =
  "São evidências de evolução e protagonismo, não moeda de participação. " +
  "O reconhecimento delas vem por selo — que vale credencial pública e nenhum ponto."

module.exports = {
  LIGAS,
  GATILHOS,
  PERIODOS_TETO,
  ICONES_VALIDOS,
  PONTOS_POR_CATEGORIA,
  PREFIXO_PRESENCA,
  ACAO_MENTORIA,
  ACOES_MANUAIS,
  NIVEIS_PADRAO,
  temporadaDoSemestre,
  NAO_PONTUAM,
  MOTIVO_NAO_PONTUAM,
}
