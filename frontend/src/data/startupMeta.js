/**
 * Metadados de exibicao do ESTADO DE CICLO de uma startup — o FALLBACK do chip
 * de status.
 *
 * Ate a migracao 010 este mapa era a unica fonte: o status era o enum
 * statusStartup, tres valores iguais para todas as incubadoras, e cada tela
 * traduzia a chave por aqui. Agora o status e vocabulario de cada incubadora
 * (startup_situacao), com rotulo e cor proprios, e quem desenha o chip e
 * components/startup/ChipSituacao.
 *
 * Estes tres continuam existindo porque o CICLO continua existindo: e o que
 * relatorios e agenda leem para saber quem ainda esta no programa, e o que o
 * chip mostra quando a startup nao tem situacao (cadastro anterior a migracao)
 * ou o store nao carregou.
 */
export const STATUS_ROTULO = { ATIVA: "Ativa", PAUSADA: "Pausada", ENCERRADA: "Concluída" }
export const STATUS_COR = { ATIVA: "success", PAUSADA: "warning", ENCERRADA: "default" }
