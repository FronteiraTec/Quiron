/**
 * Repositorio do historico do CRM (migracao 026). Tabela: crm_evento.
 *
 * SO INSERE E LE. Nao ha update nem delete aqui, e o trigger do banco recusa
 * os dois: o historico conta o que aconteceu, e o que aconteceu nao muda.
 *
 * `registrar` exige o client da transacao: o evento e gravado junto com a
 * escrita que o originou, ou nenhum dos dois.
 */
const { query } = require("../config/db")
const { instante } = require("../crm/sql")

/**
 * @param {import('pg').PoolClient} client
 * @param {{idStartup: number, idOportunidade?: number, idCliente?: number,
 *   idTarefa?: number, tipo: string, descricao: string, antes?: object,
 *   depois?: object, metadados?: object, idUsuario: number, autorNome?: string}} e
 */
async function registrar(client, e) {
  const { rows } = await client.query(
    `INSERT INTO crm_evento
       (id_startup, id_oportunidade, id_cliente, id_tarefa, tipo, descricao,
        dados_anteriores, dados_novos, metadados, id_usuario, autor_nome)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id_evento`,
    [
      e.idStartup,
      e.idOportunidade ?? null,
      e.idCliente ?? null,
      e.idTarefa ?? null,
      e.tipo,
      e.descricao,
      e.antes ? JSON.stringify(e.antes) : null,
      e.depois ? JSON.stringify(e.depois) : null,
      JSON.stringify(e.metadados || {}),
      e.idUsuario ?? null,
      e.autorNome ?? null,
    ]
  )
  return rows[0].id_evento
}

const SELECT = `
  SELECT ev.id_evento, ev.id_oportunidade, ev.id_cliente, ev.id_tarefa, ev.tipo, ev.descricao,
         ev.dados_anteriores, ev.dados_novos, ev.metadados,
         ev.id_usuario, COALESCE(u.nome, ev.autor_nome) AS autor_nome, u.foto_url AS autor_foto,
         ${instante("ev.criado_ts", "criado_ts")},
         o.titulo AS oportunidade_titulo, (o.excluido_ts IS NOT NULL) AS oportunidade_excluida,
         c.nome AS cliente_nome
    FROM crm_evento ev
    LEFT JOIN usuarios u ON u.id_usuario = ev.id_usuario
    LEFT JOIN crm_oportunidade o ON o.id_startup = ev.id_startup AND o.id_oportunidade = ev.id_oportunidade
    LEFT JOIN crm_cliente c ON c.id_startup = ev.id_startup AND c.id_cliente = ev.id_cliente
`

/**
 * Uma pagina da linha do tempo, do mais recente para o mais antigo.
 *
 * `antes` e o id do ultimo evento ja exibido: a pagina seguinte comeca depois
 * dele na ordem (criado_ts, id_evento) — o par, e nao so a data, porque varios
 * eventos da mesma transacao nascem com o mesmo NOW().
 *
 * Pede um a mais do que o limite para saber se ha mais paginas sem contar.
 *
 * @param {number} idStartup
 * @param {{idOportunidade?: number, idCliente?: number}} alvo - um dos dois, ou nenhum (a startup inteira).
 * @param {{antes?: number, limite?: number}} [pagina]
 * @returns {Promise<{eventos: object[], temMais: boolean}>}
 */
async function listar(idStartup, alvo, { antes = null, limite = 30 } = {}) {
  const condicoes = ["ev.id_startup = $1"]
  const params = [idStartup]
  if (alvo.idOportunidade) {
    params.push(alvo.idOportunidade)
    condicoes.push(`ev.id_oportunidade = $${params.length}`)
  } else if (alvo.idCliente) {
    params.push(alvo.idCliente)
    condicoes.push(`ev.id_cliente = $${params.length}`)
  }
  if (antes) {
    params.push(antes)
    condicoes.push(
      `(ev.criado_ts, ev.id_evento) < (
         SELECT x.criado_ts, x.id_evento FROM crm_evento x
          WHERE x.id_evento = $${params.length} AND x.id_startup = $1)`
    )
  }
  params.push(limite + 1)
  const { rows } = await query(
    `${SELECT}
      WHERE ${condicoes.join(" AND ")}
      ORDER BY ev.criado_ts DESC, ev.id_evento DESC
      LIMIT $${params.length}`,
    params
  )
  return { eventos: rows.slice(0, limite), temMais: rows.length > limite }
}

module.exports = { registrar, listar }
