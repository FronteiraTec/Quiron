/**
 * Repositorio de Avaliacoes (camada de acesso a dados).
 * Tabela relacionada: avaliacao (schema.sql).
 * O mentor/avaliador avalia uma entrega (APROVADO / REPROVADO / AJUSTE).
 */
const { query } = require("../config/db")

/** Lista as avaliacoes de uma entrega. */
async function listarPorEntrega(idEntrega) {
  const { rows } = await query(
    `SELECT id_avaliacao, id_avaliador, status, nota, comentario, criado_ts
     FROM avaliacao
     WHERE id_entrega = $1
     ORDER BY criado_ts DESC`,
    [idEntrega]
  )
  return rows
}

/**
 * Historico de devolutivas dadas por um avaliador, dentro de um tenant.
 *
 * Alimenta a tela "Feedback" do mentor: o que ele ja respondeu, para qual
 * startup e em que passo. Traz tambem o status ATUAL da entrega avaliada —
 * se o incubado reenviou, a avaliacao antiga e apagada
 * (jornadaRepository.reenviar), entao o que sobra aqui e sempre a palavra
 * que ainda vale.
 *
 * @param {number} idTenant
 * @param {number} idAvaliador
 */
async function listarPorAvaliador(idTenant, idAvaliador) {
  const { rows } = await query(
    `SELECT a.id_avaliacao, a.id_entrega, a.status, a.nota, a.comentario,
            a.criado_ts,
            e.id_no, e.id_startup, e.texto_resposta, e.anexos,
            n.nome AS passo, modulo.nome AS modulo, fase.nome AS fase,
            s.nome AS startup
       FROM avaliacao a
       JOIN entrega e   ON e.id_entrega = a.id_entrega
       JOIN startup s   ON s.id_startup = e.id_startup
       JOIN trilha_no n ON n.id_no = e.id_no
       LEFT JOIN trilha_no modulo ON modulo.id_no = n.id_pai
       LEFT JOIN trilha_no fase   ON fase.id_no = modulo.id_pai
      WHERE s.id_tenant = $1 AND a.id_avaliador = $2
      ORDER BY a.criado_ts DESC, a.id_avaliacao DESC`,
    [idTenant, idAvaliador]
  )
  return rows
}

/**
 * Todas as devolutivas do tenant, de todos os avaliadores.
 *
 * A visao do admin sobre a mentoria — o equivalente da tela "Feedback" do
 * mentor, mas sem o recorte por avaliador.
 *
 * `dias_resposta` e o tempo que a devolutiva levou: da ultima vez que a entrega
 * foi enviada (`e.atualizado_ts`, que o reenvio atualiza) ate a avaliacao. E o
 * numero que responde "meus mentores estao respondendo rapido?" — o mesmo dado
 * que a fila mostra como espera, so que depois de resolvido.
 *
 * So sobrevive aqui a palavra que ainda vale: o reenvio APAGA as avaliacoes
 * anteriores (jornadaRepository.reenviar), entao nao ha historico de versoes.
 */
async function listarPorTenant(idTenant) {
  const { rows } = await query(
    `SELECT a.id_avaliacao, a.id_entrega, a.status, a.comentario, a.criado_ts,
            -- ::float nos numeric: o pg entrega NUMERIC como string, e a tela
            -- precisa somar (media das notas) e comparar (resposta mais lenta).
            a.nota::float AS nota,
            av.id_usuario AS id_avaliador, av.nome AS avaliador,
            av.foto_url AS avaliador_foto,
            s.id_startup, s.nome AS startup,
            n.nome AS passo, modulo.nome AS modulo, fase.nome AS fase,
            e.atualizado_ts AS enviada_ts,
            ROUND(
              (EXTRACT(EPOCH FROM (a.criado_ts - e.atualizado_ts)) / 86400)::numeric, 1
            )::float AS dias_resposta
       FROM avaliacao a
       JOIN entrega e   ON e.id_entrega = a.id_entrega
       JOIN startup s   ON s.id_startup = e.id_startup
       JOIN usuarios av ON av.id_usuario = a.id_avaliador
       JOIN trilha_no n ON n.id_no = e.id_no
       LEFT JOIN trilha_no modulo ON modulo.id_no = n.id_pai
       LEFT JOIN trilha_no fase   ON fase.id_no = modulo.id_pai
      WHERE s.id_tenant = $1
      ORDER BY a.criado_ts DESC, a.id_avaliacao DESC`,
    [idTenant]
  )
  return rows
}

/** Cria uma nova avaliacao. */
async function criar(dados) {
  const { idEntrega, idAvaliador, status, nota, comentario } = dados
  const { rows } = await query(
    `INSERT INTO avaliacao (id_entrega, id_avaliador, status, nota, comentario)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id_avaliacao, status, nota, criado_ts`,
    [idEntrega, idAvaliador, status, nota, comentario]
  )
  return rows[0]
}

module.exports = { listarPorEntrega, listarPorAvaliador, listarPorTenant, criar }
