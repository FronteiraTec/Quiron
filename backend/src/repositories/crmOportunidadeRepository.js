/**
 * Repositorio das oportunidades do CRM (migracao 026). Tabela: crm_oportunidade.
 *
 * Toda consulta filtra por id_startup E pelo id da oportunidade. Excluida
 * (excluido_ts) nao aparece em leitura nenhuma daqui.
 *
 * A LEITURA JA VEM PRONTA PARA O CARTAO: cliente, etapa, responsavel, a
 * proxima tarefa em aberto, quantas estao atrasadas e quando foi a ultima
 * atividade. O quadro desenha dezenas de cartoes, e cada um perguntar isso a
 * parte seriam dezenas de idas ao banco.
 */
const { query } = require("../config/db")
const { instante, dia, AGORA_UTC, TAREFA_ABERTA } = require("../crm/sql")

const SELECT = `
  SELECT o.id_oportunidade, o.id_startup, o.id_cliente, o.id_etapa, o.titulo, o.descricao,
         o.valor_estimado::float8 AS valor_estimado, o.probabilidade,
         ${dia("o.previsao_fechamento", "previsao_fechamento")},
         o.origem, o.id_responsavel, o.observacoes, o.situacao,
         ${instante("o.etapa_ts", "etapa_ts")},
         o.valor_vendido::float8 AS valor_vendido,
         ${dia("o.fechamento_dt", "fechamento_dt")},
         o.motivo_perda,
         ${instante("o.encerrado_ts", "encerrado_ts")},
         o.encerrado_por, ue.nome AS encerrado_por_nome,
         o.criado_por, uc.nome AS criado_por_nome,
         ${instante("o.criado_ts", "criado_ts")},
         ${instante("o.atualizado_ts", "atualizado_ts")},

         c.nome AS cliente_nome, c.tipo_pessoa AS cliente_tipo_pessoa,
         c.empresa AS cliente_empresa, c.cargo AS cliente_cargo, c.email AS cliente_email,
         c.telefone AS cliente_telefone, c.whatsapp AS cliente_whatsapp,
         c.status AS cliente_status, c.documento AS cliente_documento,
         (c.excluido_ts IS NOT NULL) AS cliente_excluido,

         e.nome AS etapa_nome, e.cor AS etapa_cor, e.ordem AS etapa_ordem,

         ur.nome AS responsavel_nome, ur.foto_url AS responsavel_foto,

         pt.id_tarefa AS proxima_tarefa_id, pt.titulo AS proxima_tarefa_titulo,
         ${instante("pt.vencimento_ts", "proxima_tarefa_vencimento")},
         COALESCE(tc.abertas, 0)::int AS tarefas_abertas,
         COALESCE(tc.atrasadas, 0)::int AS tarefas_atrasadas,
         ${instante("ua.ultima", "ultima_atividade_ts")}
    FROM crm_oportunidade o
    JOIN crm_cliente c ON c.id_startup = o.id_startup AND c.id_cliente = o.id_cliente
    JOIN crm_etapa e ON e.id_startup = o.id_startup AND e.id_etapa = o.id_etapa
    LEFT JOIN usuarios ur ON ur.id_usuario = o.id_responsavel
    LEFT JOIN usuarios uc ON uc.id_usuario = o.criado_por
    LEFT JOIN usuarios ue ON ue.id_usuario = o.encerrado_por
    LEFT JOIN LATERAL (
      SELECT t.id_tarefa, t.titulo, t.vencimento_ts
        FROM crm_tarefa t
       WHERE t.id_startup = o.id_startup AND t.id_oportunidade = o.id_oportunidade
         AND t.status IN ${TAREFA_ABERTA}
       ORDER BY t.vencimento_ts ASC NULLS LAST, t.id_tarefa
       LIMIT 1
    ) pt ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS abertas,
             COUNT(*) FILTER (WHERE t.vencimento_ts < ${AGORA_UTC}) AS atrasadas
        FROM crm_tarefa t
       WHERE t.id_startup = o.id_startup AND t.id_oportunidade = o.id_oportunidade
         AND t.status IN ${TAREFA_ABERTA}
    ) tc ON TRUE
    LEFT JOIN LATERAL (
      SELECT MAX(ev.criado_ts) AS ultima
        FROM crm_evento ev
       WHERE ev.id_oportunidade = o.id_oportunidade
    ) ua ON TRUE
`

/**
 * @param {number} idStartup
 * @param {{situacao?: string, idCliente?: number}} [filtros]
 */
async function listar(idStartup, filtros = {}) {
  const condicoes = ["o.id_startup = $1", "o.excluido_ts IS NULL"]
  const params = [idStartup]
  if (filtros.situacao) {
    params.push(filtros.situacao)
    condicoes.push(`o.situacao = $${params.length}`)
  }
  if (filtros.idCliente) {
    params.push(filtros.idCliente)
    condicoes.push(`o.id_cliente = $${params.length}`)
  }
  const { rows } = await query(
    `${SELECT}
      WHERE ${condicoes.join(" AND ")}
      ORDER BY o.etapa_ts DESC, o.id_oportunidade DESC`,
    params
  )
  return rows
}

async function buscar(idStartup, idOportunidade, client) {
  const executor = client || { query }
  const { rows } = await executor.query(
    `${SELECT} WHERE o.id_startup = $1 AND o.id_oportunidade = $2 AND o.excluido_ts IS NULL`,
    [idStartup, idOportunidade]
  )
  return rows[0] || null
}

/**
 * A linha crua, travada ate o fim da transacao. E o "antes" de toda escrita:
 * duas pessoas mexendo na mesma oportunidade ao mesmo tempo esperam uma pela
 * outra, e o historico de cada uma compara contra o que a anterior gravou.
 *
 * Os nomes (cliente, etapa, responsavel) vem junto porque o historico escreve
 * o NOME de antes da troca, e depois da troca ele ja nao esta na linha.
 */
async function travar(client, idStartup, idOportunidade) {
  const { rows } = await client.query(
    `SELECT o.id_oportunidade, o.id_startup, o.id_cliente, o.id_etapa, o.titulo, o.descricao,
            o.valor_estimado::float8 AS valor_estimado, o.probabilidade,
            ${dia("o.previsao_fechamento", "previsao_fechamento")},
            o.origem, o.id_responsavel, o.observacoes, o.situacao,
            ${instante("o.etapa_ts", "etapa_ts")},
            o.valor_vendido::float8 AS valor_vendido,
            ${dia("o.fechamento_dt", "fechamento_dt")},
            o.motivo_perda,
            (SELECT c.nome FROM crm_cliente c
              WHERE c.id_startup = o.id_startup AND c.id_cliente = o.id_cliente) AS cliente_nome,
            (SELECT e.nome FROM crm_etapa e
              WHERE e.id_startup = o.id_startup AND e.id_etapa = o.id_etapa) AS etapa_nome,
            (SELECT u.nome FROM usuarios u WHERE u.id_usuario = o.id_responsavel) AS responsavel_nome
       FROM crm_oportunidade o
      WHERE o.id_startup = $1 AND o.id_oportunidade = $2 AND o.excluido_ts IS NULL
      FOR UPDATE OF o`,
    [idStartup, idOportunidade]
  )
  return rows[0] || null
}

/** Os campos que a edicao grava (etapa, responsavel e cliente inclusive). */
const COLUNAS_EDITAVEIS = [
  "titulo",
  "descricao",
  "valor_estimado",
  "probabilidade",
  "previsao_fechamento",
  "origem",
  "observacoes",
  "id_responsavel",
  "id_cliente",
]

/** @returns {Promise<number>} o id da oportunidade criada. */
async function criar(client, idStartup, dados, idUsuario) {
  const colunas = [...COLUNAS_EDITAVEIS, "id_etapa"]
  const valores = colunas.map((col) => dados[col] ?? null)
  const marcadores = colunas.map((_, i) => `$${i + 3}`)
  const { rows } = await client.query(
    `INSERT INTO crm_oportunidade (id_startup, criado_por, ${colunas.join(", ")})
     VALUES ($1, $2, ${marcadores.join(", ")})
     RETURNING id_oportunidade`,
    [idStartup, idUsuario, ...valores]
  )
  return rows[0].id_oportunidade
}

/** Grava so as colunas presentes em `campos` (todas de COLUNAS_EDITAVEIS). */
async function atualizar(client, idStartup, idOportunidade, campos) {
  const colunas = COLUNAS_EDITAVEIS.filter((col) => col in campos)
  if (colunas.length === 0) return
  const sets = colunas.map((col, i) => `${col} = $${i + 3}`)
  await client.query(
    `UPDATE crm_oportunidade
        SET ${sets.join(", ")}, atualizado_ts = NOW()
      WHERE id_startup = $1 AND id_oportunidade = $2`,
    [idStartup, idOportunidade, ...colunas.map((col) => campos[col] ?? null)]
  )
}

async function moverEtapa(client, idStartup, idOportunidade, idEtapa) {
  await client.query(
    `UPDATE crm_oportunidade
        SET id_etapa = $3, etapa_ts = NOW(), atualizado_ts = NOW()
      WHERE id_startup = $1 AND id_oportunidade = $2`,
    [idStartup, idOportunidade, idEtapa]
  )
}

/** Ganha ou perdida. O CHECK da tabela recusa a combinacao incoerente. */
async function encerrar(client, idStartup, idOportunidade, { situacao, valorVendido, fechamentoDt, motivoPerda, idUsuario }) {
  await client.query(
    `UPDATE crm_oportunidade
        SET situacao = $3, valor_vendido = $4, fechamento_dt = $5, motivo_perda = $6,
            encerrado_ts = NOW(), encerrado_por = $7, atualizado_ts = NOW()
      WHERE id_startup = $1 AND id_oportunidade = $2`,
    [idStartup, idOportunidade, situacao, valorVendido ?? null, fechamentoDt, motivoPerda ?? null, idUsuario]
  )
}

/** Volta ao funil, na etapa informada. O que era o encerramento fica no historico. */
async function reabrir(client, idStartup, idOportunidade, idEtapa) {
  await client.query(
    `UPDATE crm_oportunidade
        SET situacao = 'ABERTA', valor_vendido = NULL, fechamento_dt = NULL, motivo_perda = NULL,
            encerrado_ts = NULL, encerrado_por = NULL,
            etapa_ts = CASE WHEN id_etapa = $3 THEN etapa_ts ELSE NOW() END,
            id_etapa = $3, atualizado_ts = NOW()
      WHERE id_startup = $1 AND id_oportunidade = $2`,
    [idStartup, idOportunidade, idEtapa]
  )
}

/** Exclusao logica: some das telas, fica no banco com o historico. */
async function excluir(client, idStartup, idOportunidade, idUsuario) {
  await client.query(
    `UPDATE crm_oportunidade
        SET excluido_ts = NOW(), excluido_por = $3, atualizado_ts = NOW()
      WHERE id_startup = $1 AND id_oportunidade = $2 AND excluido_ts IS NULL`,
    [idStartup, idOportunidade, idUsuario]
  )
}

/** Quantas oportunidades ABERTAS estao em cada etapa (para desativar etapa com seguranca). */
async function contarAbertasNaEtapa(idStartup, idEtapa) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS total
       FROM crm_oportunidade
      WHERE id_startup = $1 AND id_etapa = $2 AND situacao = 'ABERTA' AND excluido_ts IS NULL`,
    [idStartup, idEtapa]
  )
  return rows[0].total
}

module.exports = {
  COLUNAS_EDITAVEIS,
  listar,
  buscar,
  travar,
  criar,
  atualizar,
  moverEtapa,
  encerrar,
  reabrir,
  excluir,
  contarAbertasNaEtapa,
}
