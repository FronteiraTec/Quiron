/**
 * Repositorio de Feedback (camada de acesso a dados).
 *
 * Guarda o que o usuario escreve no "Enviar Feedback" do UserPanel. Sem
 * regra de negocio aqui - so a escrita.
 * Tabela: feedback (schema.sql).
 */
const { query } = require("../config/db")

/**
 * Registra um feedback enviado por um usuario.
 * @param {{idUsuario:number, idTenant?:number, mensagem:string}} dados
 * @returns {Promise<object>} Linha criada.
 */
async function criar({ idUsuario, idTenant, mensagem }) {
  const { rows } = await query(
    `INSERT INTO feedback (id_usuario, id_tenant, mensagem)
     VALUES ($1, $2, $3)
     RETURNING id_feedback, id_usuario, id_tenant, mensagem, criado_ts`,
    [idUsuario, idTenant || null, mensagem]
  )
  return rows[0]
}

module.exports = { criar }
