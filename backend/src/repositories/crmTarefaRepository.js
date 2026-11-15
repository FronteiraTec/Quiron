/**
 * Repositorio das tarefas comerciais do CRM (migracao 026). Tabela: crm_tarefa.
 *
 * Toda consulta filtra por id_startup E pelo id da tarefa. Tarefa nao se
 * exclui: se cancela, e continua na lista e no historico.
 */
const { query } = require("../config/db")
const { instante, AGORA_UTC, TAREFA_ABERTA } = require("../crm/sql")

const SELECT = `
  SELECT t.id_tarefa, t.id_startup, t.titulo, t.descricao,
         t.id_responsavel, ur.nome AS responsavel_nome, ur.foto_url AS responsavel_foto,
         ${instante("t.vencimento_ts", "vencimento_ts")},
         t.prioridade, t.status,
         t.id_cliente, c.nome AS cliente_nome,
         t.id_oportunidade, o.titulo AS oportunidade_titulo, o.situacao AS oportunidade_situacao,
         (o.excluido_ts IS NOT NULL) AS oportunidade_excluida,
         ${instante("t.concluida_ts", "concluida_ts")},
         t.concluida_por, uco.nome AS concluida_por_nome,
         t.criado_por, ucr.nome AS criado_por_nome,
         ${instante("t.criado_ts", "criado_ts")},
         ${instante("t.atualizado_ts", "atualizado_ts")},
         (t.status IN ${TAREFA_ABERTA} AND t.vencimento_ts < ${AGORA_UTC}) AS atrasada
    FROM crm_tarefa t
    LEFT JOIN crm_cliente c ON c.id_startup = t.id_startup AND c.id_cliente = t.id_cliente
    LEFT JOIN crm_oportunidade o ON o.id_startup = t.id_startup AND o.id_oportunidade = t.id_oportunidade
    LEFT JOIN usuarios ur ON ur.id_usuario = t.id_responsavel
    LEFT JOIN usuarios uco ON uco.id_usuario = t.concluida_por
    LEFT JOIN usuarios ucr ON ucr.id_usuario = t.criado_por
`

// Abertas primeiro, e entre elas a que vence antes; sem prazo vai para o fim.
const ORDEM = `
  ORDER BY (t.status IN ${TAREFA_ABERTA}) DESC, t.vencimento_ts ASC NULLS LAST, t.id_tarefa DESC
`

/**
 * @param {number} idStartup
 * @param {{idOportunidade?: number, idCliente?: number}} [filtros]
 */
async function listar(idStartup, filtros = {}) {
  const condicoes = ["t.id_startup = $1"]
  const params = [idStartup]
  if (filtros.idOportunidade) {
    params.push(filtros.idOportunidade)
    condicoes.push(`t.id_oportunidade = $${params.length}`)
  }
  if (filtros.idCliente) {
    params.push(filtros.idCliente)
    condicoes.push(`t.id_cliente = $${params.length}`)
  }
  const { rows } = await query(`${SELECT} WHERE ${condicoes.join(" AND ")} ${ORDEM}`, params)
  return rows
}

async function buscar(idStartup, idTarefa, client) {
  const executor = client || { query }
  const { rows } = await executor.query(
    `${SELECT} WHERE t.id_startup = $1 AND t.id_tarefa = $2`,
    [idStartup, idTarefa]
  )
  return rows[0] || null
}

/** A linha crua, travada ate o fim da transacao (com o nome do responsavel de antes). */
async function travar(client, idStartup, idTarefa) {
  const { rows } = await client.query(
    `SELECT t.id_tarefa, t.id_startup, t.titulo, t.descricao, t.id_responsavel,
            ${instante("t.vencimento_ts", "vencimento_ts")},
            t.prioridade, t.status, t.id_cliente, t.id_oportunidade,
            (SELECT u.nome FROM usuarios u WHERE u.id_usuario = t.id_responsavel) AS responsavel_nome
       FROM crm_tarefa t
      WHERE t.id_startup = $1 AND t.id_tarefa = $2
      FOR UPDATE OF t`,
    [idStartup, idTarefa]
  )
  return rows[0] || null
}

/** @returns {Promise<number>} o id da tarefa criada. */
async function criar(client, idStartup, dados, idUsuario) {
  const { rows } = await client.query(
    `INSERT INTO crm_tarefa
       (id_startup, criado_por, titulo, descricao, id_responsavel, vencimento_ts,
        prioridade, status, id_cliente, id_oportunidade, concluida_ts, concluida_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
             CASE WHEN $8::crmTarefaStatus = 'CONCLUIDA' THEN NOW() END,
             CASE WHEN $8::crmTarefaStatus = 'CONCLUIDA' THEN $2::int END)
     RETURNING id_tarefa`,
    [
      idStartup,
      idUsuario,
      dados.titulo,
      dados.descricao ?? null,
      dados.id_responsavel ?? null,
      dados.vencimento_ts ?? null,
      dados.prioridade,
      dados.status,
      dados.id_cliente ?? null,
      dados.id_oportunidade ?? null,
    ]
  )
  return rows[0].id_tarefa
}

const COLUNAS_EDITAVEIS = ["titulo", "descricao", "id_responsavel", "vencimento_ts", "prioridade"]

/** Grava so as colunas presentes em `campos`. O status muda por mudarStatus. */
async function atualizar(client, idStartup, idTarefa, campos) {
  const colunas = COLUNAS_EDITAVEIS.filter((col) => col in campos)
  if (colunas.length === 0) return
  const sets = colunas.map((col, i) => `${col} = $${i + 3}`)
  await client.query(
    `UPDATE crm_tarefa
        SET ${sets.join(", ")}, atualizado_ts = NOW()
      WHERE id_startup = $1 AND id_tarefa = $2`,
    [idStartup, idTarefa, ...colunas.map((col) => campos[col] ?? null)]
  )
}

/** Troca o status; a conclusao ganha carimbo e autor, e os perde ao sair dela. */
async function mudarStatus(client, idStartup, idTarefa, status, idUsuario) {
  await client.query(
    `UPDATE crm_tarefa
        SET status = $3,
            concluida_ts = CASE WHEN $3::crmTarefaStatus = 'CONCLUIDA' THEN NOW() END,
            concluida_por = CASE WHEN $3::crmTarefaStatus = 'CONCLUIDA' THEN $4::int END,
            atualizado_ts = NOW()
      WHERE id_startup = $1 AND id_tarefa = $2`,
    [idStartup, idTarefa, status, idUsuario]
  )
}

/**
 * Cancela as tarefas ABERTAS de uma oportunidade ou de um cliente — o que
 * acontece quando ele sai das telas. Devolve as canceladas, para o service
 * registrar um evento por tarefa.
 */
async function cancelarAbertas(client, idStartup, { idOportunidade, idCliente }) {
  const coluna = idOportunidade ? "id_oportunidade" : "id_cliente"
  const { rows } = await client.query(
    `UPDATE crm_tarefa
        SET status = 'CANCELADA', atualizado_ts = NOW()
      WHERE id_startup = $1 AND ${coluna} = $2 AND status IN ${TAREFA_ABERTA}
      RETURNING id_tarefa, titulo, id_cliente, id_oportunidade, status`,
    [idStartup, idOportunidade || idCliente]
  )
  return rows
}

/** As tarefas de uma oportunidade passam a ser do cliente novo dela. */
async function trocarClienteDaOportunidade(client, idStartup, idOportunidade, idCliente) {
  await client.query(
    `UPDATE crm_tarefa SET id_cliente = $3, atualizado_ts = NOW()
      WHERE id_startup = $1 AND id_oportunidade = $2`,
    [idStartup, idOportunidade, idCliente]
  )
}

module.exports = {
  COLUNAS_EDITAVEIS,
  listar,
  buscar,
  travar,
  criar,
  atualizar,
  mudarStatus,
  cancelarAbertas,
  trocarClienteDaOportunidade,
}
