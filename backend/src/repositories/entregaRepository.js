/**
 * Repositorio de Entregas (camada de acesso a dados).
 * Tabelas relacionadas: entrega, resposta (schema.sql).
 * Uma entrega e a submissao de uma startup para um PASSO da trilha. Quando o
 * passo e do tipo QUESTIONARIO, a entrega carrega varias respostas (uma por
 * pergunta; caixas de selecao geram uma resposta por alternativa marcada).
 */
const { query, withTransaction } = require("../config/db")

/** Lista as entregas de uma startup, com o nome do passo respondido. */
async function listarPorStartup(idStartup) {
  const { rows } = await query(
    `SELECT e.id_entrega, e.id_no, n.nome AS passo, e.id_usuario,
            e.texto_resposta, e.arquivo_url, e.criado_ts
       FROM entrega e
       JOIN trilha_no n ON n.id_no = e.id_no
      WHERE e.id_startup = $1
      ORDER BY e.criado_ts DESC`,
    [idStartup]
  )
  return rows
}

/** Busca uma entrega pelo id. */
async function buscarPorId(id) {
  const { rows } = await query(`SELECT * FROM entrega WHERE id_entrega = $1`, [id])
  return rows[0]
}

/**
 * Colunas comuns a fila e detalhe: a entrega com o passo, sua posicao na
 * trilha (fase > modulo), a startup, quem entregou e a ULTIMA avaliacao.
 *
 * A avaliacao vem por LATERAL igual a Jornada faz: o mentor pode pedir ajuste
 * e depois aprovar, e o estado do passo e sempre o da ultima palavra. Como o
 * reenvio apaga as avaliacoes anteriores (jornadaRepository.reenviar), uma
 * entrega ENVIADA sem avaliacao e exatamente o que esta na fila do mentor.
 */
const SELECT_ENTREGA_DETALHADA = `
  SELECT e.id_entrega, e.id_no, e.id_startup, e.status,
         e.texto_resposta, e.arquivo_url, e.anexos,
         e.criado_ts, e.atualizado_ts,

         n.nome AS passo, n.tipo_passo, n.prazo, n.entregavel,
         n.objetivo, n.id_questionario,
         modulo.nome AS modulo, fase.nome AS fase,

         s.nome AS startup,
         u.nome AS autor,

         a.id_avaliacao, a.status AS avaliacao_status, a.nota,
         a.comentario, a.criado_ts AS avaliacao_ts, av.nome AS avaliador

    FROM entrega e
    JOIN trilha_no n      ON n.id_no = e.id_no
    LEFT JOIN trilha_no modulo ON modulo.id_no = n.id_pai
    LEFT JOIN trilha_no fase   ON fase.id_no = modulo.id_pai
    JOIN startup s        ON s.id_startup = e.id_startup
    LEFT JOIN usuarios u  ON u.id_usuario = e.id_usuario

    LEFT JOIN LATERAL (
      SELECT id_avaliacao, status, nota, comentario, criado_ts, id_avaliador
        FROM avaliacao
       WHERE id_entrega = e.id_entrega
       ORDER BY criado_ts DESC, id_avaliacao DESC
       LIMIT 1
    ) a ON TRUE

    LEFT JOIN usuarios av ON av.id_usuario = a.id_avaliador
`

/**
 * Fila de avaliacao: as entregas ENVIADAS das startups do tenant.
 *
 * Rascunho fica de fora — ainda nao foi ao mentor. A ordenacao poe o que
 * ainda nao foi avaliado no topo e, dentro disso, o mais antigo primeiro:
 * a entrega parada ha mais tempo e a que trava a startup.
 *
 * @param {number} idTenant
 * @param {number[]|null} idsPermitidos - null = todas (admin); lista = recorte
 *   das startups que o mentor acompanha.
 */
async function listarFila(idTenant, idsPermitidos) {
  const { rows } = await query(
    `${SELECT_ENTREGA_DETALHADA}
      WHERE s.id_tenant = $1
        AND e.status = 'ENVIADA'
        AND ($2::int[] IS NULL OR e.id_startup = ANY ($2))
      ORDER BY (a.id_avaliacao IS NULL) DESC, e.atualizado_ts ASC`,
    [idTenant, idsPermitidos]
  )
  return rows
}

/** Uma entrega da fila, com todo o contexto do painel de avaliacao. */
async function buscarDetalhe(id) {
  const { rows } = await query(
    `${SELECT_ENTREGA_DETALHADA} WHERE e.id_entrega = $1`,
    [id]
  )
  return rows[0]
}

/** Cria uma nova entrega. */
async function criar(dados) {
  const { idNo, idStartup, idUsuario, textoResposta, arquivoUrl } = dados
  const { rows } = await query(
    `INSERT INTO entrega (id_no, id_startup, id_usuario, texto_resposta, arquivo_url)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id_entrega, id_no, criado_ts`,
    [idNo, idStartup, idUsuario, textoResposta, arquivoUrl]
  )
  return rows[0]
}

/**
 * Cria uma entrega de questionario (entrega + respostas) em uma unica
 * transacao. Cada item de "respostas" vira uma linha na tabela resposta.
 *
 * @param {{idNo:number, idStartup:number, idUsuario:number,
 *          respostas:Array<{idPergunta:number, textoResposta?:string,
 *          idAlternativa?:number}>}} dados
 * @returns {Promise<object>} A entrega criada.
 */
async function criarComRespostas({ idNo, idStartup, idUsuario, respostas }) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO entrega (id_no, id_startup, id_usuario)
       VALUES ($1, $2, $3)
       RETURNING id_entrega, id_no, criado_ts`,
      [idNo, idStartup, idUsuario]
    )
    const entrega = rows[0]

    for (const r of respostas) {
      await client.query(
        `INSERT INTO resposta (id_pergunta, id_entrega, id_usuario, texto_resposta, id_alternativa)
         VALUES ($1, $2, $3, $4, $5)`,
        [r.idPergunta, entrega.id_entrega, idUsuario, r.textoResposta ?? null, r.idAlternativa ?? null]
      )
    }

    return entrega
  })
}

/** Lista as respostas de uma entrega (com o enunciado da pergunta). */
async function listarRespostasPorEntrega(idEntrega) {
  const { rows } = await query(
    `SELECT r.id_resposta, r.id_pergunta, p.pergunta, p.tipo,
            r.texto_resposta, r.id_alternativa, a.descricao AS alternativa_descricao
       FROM resposta r
       JOIN pergunta p ON p.id_pergunta = r.id_pergunta
       LEFT JOIN alternativa a ON a.id_alternativa = r.id_alternativa
      WHERE r.id_entrega = $1
      ORDER BY p.ordem, r.id_resposta`,
    [idEntrega]
  )
  return rows
}

module.exports = {
  listarPorStartup,
  listarFila,
  buscarPorId,
  buscarDetalhe,
  criar,
  criarComRespostas,
  listarRespostasPorEntrega,
}
