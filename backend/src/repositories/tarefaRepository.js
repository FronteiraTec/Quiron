/**
 * Repositorio de Tarefas (camada de acesso a dados).
 * Tabela relacionada: tarefa (schema.sql). Uma tarefa pertence a um modulo.
 * Tipos possiveis: TEXTO, ANEXO, VIDEO, QUESTIONARIO.
 */
const { query } = require("../config/db")

/** Lista as tarefas de um modulo, em ordem. */
async function listarPorModulo(idModulo) {
  const { rows } = await query(
    `SELECT t.id_tarefa, t.titulo, t.descricao, t.tipo, t.obrigatoria, t.ordem, t.ativo,
            t.anexo, t.id_questionario, q.titulo AS questionario_titulo
     FROM tarefa t
     LEFT JOIN questionarios q ON q.id_questionario = t.id_questionario
     WHERE t.id_modulo = $1
     ORDER BY t.ordem`,
    [idModulo]
  )
  return rows
}

/** Busca uma tarefa pelo id. */
async function buscarPorId(id) {
  const { rows } = await query(`SELECT * FROM tarefa WHERE id_tarefa = $1`, [id])
  return rows[0]
}

/** Cria uma nova tarefa. */
async function criar(dados) {
  const { idModulo, titulo, descricao, tipo, ordem, obrigatoria, anexo, idQuestionario } = dados
  const { rows } = await query(
    `INSERT INTO tarefa
       (id_modulo, titulo, descricao, tipo, ordem, obrigatoria, anexo, id_questionario)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id_tarefa, titulo, tipo, ordem, anexo, id_questionario`,
    [idModulo, titulo, descricao, tipo, ordem, obrigatoria ?? true, anexo ?? null, idQuestionario ?? null]
  )
  return rows[0]
}

module.exports = { listarPorModulo, buscarPorId, criar }
