/**
 * Repositorio de Entregas (camada de acesso a dados).
 * Tabelas relacionadas: entrega, resposta (schema.sql).
 * Uma entrega e a submissao de uma startup para uma tarefa. Quando a tarefa
 * e do tipo QUESTIONARIO, a entrega carrega varias respostas (uma por pergunta;
 * perguntas de caixas de selecao geram uma resposta por alternativa marcada).
 */
const { query, withTransaction } = require("../config/db")

/** Lista as entregas de uma startup. */
async function listarPorStartup(idStartup) {
  const { rows } = await query(
    `SELECT id_entrega, id_tarefa, id_usuario, texto_resposta, arquivo_url, criado_ts
     FROM entrega
     WHERE id_startup = $1
     ORDER BY criado_ts DESC`,
    [idStartup]
  )
  return rows
}

/** Busca uma entrega pelo id. */
async function buscarPorId(id) {
  const { rows } = await query(`SELECT * FROM entrega WHERE id_entrega = $1`, [id])
  return rows[0]
}

/** Cria uma nova entrega. */
async function criar(dados) {
  const { idTarefa, idStartup, idUsuario, textoResposta, arquivoUrl } = dados
  const { rows } = await query(
    `INSERT INTO entrega (id_tarefa, id_startup, id_usuario, texto_resposta, arquivo_url)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id_entrega, id_tarefa, criado_ts`,
    [idTarefa, idStartup, idUsuario, textoResposta, arquivoUrl]
  )
  return rows[0]
}

/**
 * Cria uma entrega de questionario (entrega + respostas) em uma unica
 * transacao. Cada item de "respostas" vira uma linha na tabela resposta.
 *
 * @param {{idTarefa:number, idStartup:number, idUsuario:number,
 *          respostas:Array<{idPergunta:number, textoResposta?:string,
 *          idAlternativa?:number}>}} dados
 * @returns {Promise<object>} A entrega criada.
 */
async function criarComRespostas({ idTarefa, idStartup, idUsuario, respostas }) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO entrega (id_tarefa, id_startup, id_usuario)
       VALUES ($1, $2, $3)
       RETURNING id_entrega, id_tarefa, criado_ts`,
      [idTarefa, idStartup, idUsuario]
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
  buscarPorId,
  criar,
  criarComRespostas,
  listarRespostasPorEntrega,
}
