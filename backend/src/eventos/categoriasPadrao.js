/**
 * As categorias de agenda que toda incubadora ganha ao nascer.
 *
 * FONTE CANONICA desta lista. Ate a migracao 008 estes oito valores eram o
 * enum `eventoCategoria` do Postgres — tipo de coluna, nao dado: acrescentar
 * "Demoday" para UMA incubadora exigia um ALTER TYPE que valia para todas.
 * Agora sao linhas em `evento_categoria`, por tenant, editaveis na tela de
 * Configuracoes.
 *
 * Continuam existindo como PADRAO, e nao como lista fixa, por dois motivos:
 * uma agenda vazia nao ensina o que a ferramenta faz, e a FK
 * (id_tenant, categoria) exige que exista ao menos uma categoria antes do
 * primeiro evento. A incubadora renomeia, recolore ou desativa o que nao usa.
 *
 * As cores e icones espelham frontend/src/components/calendar/categorias.js
 * (o mapa que era a unica fonte antes de 008, hoje so o fallback de exibicao).
 *
 * NOTA: database/seed.sql repete esta lista em SQL porque cria o tenant demo
 * direto no banco, sem passar pelo service. Mexeu aqui, veja la.
 */
const CATEGORIAS_PADRAO = [
  { chave: "MENTORIA", rotulo: "Mentoria", cor: "#6366f1", icone: "SupervisorAccount",  ordem: 1 },
  { chave: "WORKSHOP", rotulo: "Workshop", cor: "#0ea5e9", icone: "School",             ordem: 2 },
  { chave: "ENTREGA",  rotulo: "Entrega",  cor: "#10b981", icone: "AssignmentTurnedIn", ordem: 3 },
  { chave: "REUNIAO",  rotulo: "Reuniao",  cor: "#f59e0b", icone: "Groups",             ordem: 4 },
  { chave: "EVENTO",   rotulo: "Evento",   cor: "#8b5cf6", icone: "Event",              ordem: 5 },
  { chave: "PITCH",    rotulo: "Pitch",    cor: "#ef4444", icone: "Campaign",           ordem: 6 },
  { chave: "PRAZO",    rotulo: "Prazo",    cor: "#f43f5e", icone: "HourglassBottom",    ordem: 7 },
  { chave: "VISITA",   rotulo: "Visita",   cor: "#14b8a6", icone: "Place",              ordem: 8 },
]

/**
 * Chave usada quando o formulario nao manda categoria. Precisa existir entre os
 * padroes acima, senao a FK barra o evento.
 */
const CATEGORIA_FALLBACK = "EVENTO"

/**
 * Icones aceitos em `evento_categoria.icone`.
 *
 * Lista fechada porque icone e componente MUI importado, nao string livre: um
 * nome arbitrario nao vira icone nenhum. O front tem o mapa equivalente (ICONES
 * em categorias.js) e cai no fallback se receber algo fora daqui — a validacao
 * no backend existe para o valor invalido nunca chegar a ser gravado.
 */
const ICONES_VALIDOS = [
  "SupervisorAccount", "School", "AssignmentTurnedIn", "Groups", "Event",
  "Campaign", "HourglassBottom", "Place", "Handshake", "EmojiEvents",
  "Lightbulb", "Coffee", "VideoCall", "MenuBook", "Flag", "Star",
]

module.exports = { CATEGORIAS_PADRAO, CATEGORIA_FALLBACK, ICONES_VALIDOS }
