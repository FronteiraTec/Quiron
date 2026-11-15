/**
 * Pedacos de SQL que os repositorios do CRM compartilham.
 *
 * DATAS E INSTANTES SAEM COMO TEXTO, formatados pelo Postgres. O driver `pg`
 * converte DATE e TIMESTAMP em Date no fuso do processo Node: no container (UTC)
 * isso funciona, mas o mesmo codigo rodando num Node em outro fuso devolveria a
 * previsao de fechamento um dia antes e o prazo da tarefa tres horas fora. Como
 * texto, o que a API devolve nao depende de onde ela roda.
 *
 * Os TIMESTAMP do CRM guardam UTC (criado_ts nasce de NOW() numa sessao em UTC,
 * e o vencimento chega da API ja em UTC). Por isso o "Z" no fim.
 */

/** TIMESTAMP (UTC) -> "2026-11-05T17:00:00.000Z". */
const instante = (coluna, alias) =>
  `to_char(${coluna}, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS ${alias}`

/** DATE -> "2026-11-05". */
const dia = (coluna, alias) => `to_char(${coluna}, 'YYYY-MM-DD') AS ${alias}`

/** O agora em UTC, comparavel com os TIMESTAMP do CRM (vencimento das tarefas). */
const AGORA_UTC = `(NOW() AT TIME ZONE 'UTC')`

/** Os status em que a tarefa ainda pede trabalho. */
const TAREFA_ABERTA = `('PENDENTE', 'EM_ANDAMENTO')`

module.exports = { instante, dia, AGORA_UTC, TAREFA_ABERTA }
