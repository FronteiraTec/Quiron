/**
 * Metadados de exibicao da STARTUP — como cada status aparece na interface.
 *
 * Mora aqui, e nao dentro de cada tela, porque o mesmo status e desenhado em
 * varios lugares (lista de startups, detalhe, painel do mentor) e todos
 * precisam concordar: ENCERRADA e sempre "Concluída", nunca "Encerrada" numa
 * tela e outra coisa na seguinte.
 */
export const STATUS_ROTULO = { ATIVA: "Ativa", PAUSADA: "Pausada", ENCERRADA: "Concluída" }
export const STATUS_COR = { ATIVA: "success", PAUSADA: "warning", ENCERRADA: "default" }
