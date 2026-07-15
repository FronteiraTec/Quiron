/**
 * Repositorio de Preferencias do usuario (camada de acesso a dados).
 *
 * Responsavel APENAS por falar com o banco (tabela "usuario_preferencias").
 * Relacao 1:1 com "usuarios". Nao contem regra de negocio.
 * Tabela relacionada: usuario_preferencias (schema.sql).
 */
const { query } = require("../config/db")

/**
 * Busca as preferencias de um usuario.
 * @param {number} idUsuario
 * @returns {Promise<object|undefined>} Linha de preferencias ou undefined.
 */
async function buscarPorUsuario(idUsuario) {
  const { rows } = await query(
    `SELECT id_usuario, tema, cor_primaria, cor_secundaria, densidade,
            borda_arredondada, sidebar_recolhida, atualizado_ts
     FROM usuario_preferencias
     WHERE id_usuario = $1`,
    [idUsuario]
  )
  return rows[0]
}

/**
 * Salva (cria ou atualiza) as preferencias do usuario via UPSERT.
 * @param {number} idUsuario
 * @param {{tema, corPrimaria, corSecundaria, densidade, bordaArredondada, sidebarRecolhida}} prefs
 * @returns {Promise<object>} Preferencias salvas.
 */
async function salvar(idUsuario, prefs) {
  const { rows } = await query(
    `INSERT INTO usuario_preferencias
       (id_usuario, tema, cor_primaria, cor_secundaria, densidade,
        borda_arredondada, sidebar_recolhida)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id_usuario) DO UPDATE SET
       tema = EXCLUDED.tema,
       cor_primaria = EXCLUDED.cor_primaria,
       cor_secundaria = EXCLUDED.cor_secundaria,
       densidade = EXCLUDED.densidade,
       borda_arredondada = EXCLUDED.borda_arredondada,
       sidebar_recolhida = EXCLUDED.sidebar_recolhida,
       atualizado_ts = NOW()
     RETURNING id_usuario, tema, cor_primaria, cor_secundaria, densidade,
               borda_arredondada, sidebar_recolhida, atualizado_ts`,
    [
      idUsuario,
      prefs.tema,
      prefs.corPrimaria,
      prefs.corSecundaria,
      prefs.densidade,
      prefs.bordaArredondada,
      prefs.sidebarRecolhida,
    ]
  )
  return rows[0]
}

module.exports = { buscarPorUsuario, salvar }
