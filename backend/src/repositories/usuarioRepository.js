/**
 * Repositorio de Usuarios (camada de acesso a dados).
 *
 * Responsavel APENAS por falar com o banco (tabela "usuarios").
 * Nao contem regra de negocio - isso fica na camada de service.
 * Tabela relacionada: usuarios (schema.sql).
 */
const { query } = require("../config/db")

/**
 * Busca um usuario pelo email (usado no login).
 * @param {string} email
 * @returns {Promise<object|undefined>} Linha do usuario ou undefined.
 */
async function buscarPorEmail(email) {
  const { rows } = await query(
    `SELECT id_usuario, nome, email, celular, senha_hash, root,
            deve_redefinir_senha, ultimo_login_ts
     FROM usuarios
     WHERE email = $1`,
    [email]
  )
  return rows[0]
}

/**
 * Busca um usuario pelo id (dados publicos, sem a senha).
 * @param {number} id
 * @returns {Promise<object|undefined>}
 */
async function buscarPorId(id) {
  const { rows } = await query(
    `SELECT id_usuario, nome, email, celular, foto_url, root,
            deve_redefinir_senha, ultimo_login_ts, criado_ts
     FROM usuarios
     WHERE id_usuario = $1`,
    [id]
  )
  return rows[0]
}

/**
 * Cria um novo usuario.
 *
 * @param {{nome:string, email:string, celular:string, senhaHash:string,
 *          deveRedefinir?:boolean}} dados
 * @param {import('pg').PoolClient} [client] - Client de transacao opcional;
 *        se omitido, usa o pool padrao.
 * @returns {Promise<object>} Usuario criado (sem a senha).
 */
async function criar({ nome, email, celular, senhaHash, deveRedefinir = false }, client) {
  const executor = client || { query }
  const { rows } = await executor.query(
    `INSERT INTO usuarios (nome, email, celular, senha_hash, deve_redefinir_senha)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id_usuario, nome, email, celular, deve_redefinir_senha, criado_ts`,
    [nome, email, celular, senhaHash, deveRedefinir]
  )
  return rows[0]
}

/**
 * Atualiza o timestamp do ultimo login.
 * @param {number} id
 */
async function registrarLogin(id) {
  await query(
    `UPDATE usuarios SET ultimo_login_ts = NOW() WHERE id_usuario = $1`,
    [id]
  )
}

/**
 * Atualiza a senha (hash) de um usuario e limpa a flag de redefinicao
 * obrigatoria (a senha deixou de ser provisoria).
 * @param {number} id
 * @param {string} senhaHash - Novo hash no formato "salt:hash".
 */
async function atualizarSenha(id, senhaHash) {
  await query(
    `UPDATE usuarios
        SET senha_hash = $1, deve_redefinir_senha = FALSE, atualizado_ts = NOW()
      WHERE id_usuario = $2`,
    [senhaHash, id]
  )
}

/**
 * Atualiza os dados de perfil (nome e celular) de um usuario.
 * @param {number} id
 * @param {{nome:string, celular:string}} dados
 * @returns {Promise<object>} Usuario atualizado (sem a senha).
 */
async function atualizarPerfil(id, { nome, celular }) {
  const { rows } = await query(
    `UPDATE usuarios
     SET nome = $1, celular = $2, atualizado_ts = NOW()
     WHERE id_usuario = $3
     RETURNING id_usuario, nome, email, celular, foto_url, root, ultimo_login_ts, criado_ts`,
    [nome, celular, id]
  )
  return rows[0]
}

/**
 * Atualiza a foto/avatar do usuario logado.
 * @param {number} id
 * @param {string|null} fotoUrl - Data URL (base64) da imagem, ou null para remover.
 * @returns {Promise<object>} Usuario atualizado (sem a senha).
 */
async function atualizarFoto(id, fotoUrl) {
  const { rows } = await query(
    `UPDATE usuarios
     SET foto_url = $1, atualizado_ts = NOW()
     WHERE id_usuario = $2
     RETURNING id_usuario, nome, email, celular, foto_url, root, ultimo_login_ts, criado_ts`,
    [fotoUrl, id]
  )
  return rows[0]
}

module.exports = {
  buscarPorEmail,
  buscarPorId,
  criar,
  registrarLogin,
  atualizarSenha,
  atualizarPerfil,
  atualizarFoto,
}
