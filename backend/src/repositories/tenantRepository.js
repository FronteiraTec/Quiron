/**
 * Repositorio de Tenants (camada de acesso a dados).
 * Tabelas relacionadas: tenant, tenant_usuarios (schema.sql).
 * Multi-tenant: cada tenant e uma incubadora isolada.
 */
const { query } = require("../config/db")

/**
 * Lista todos os tenants (incubadoras) com a contagem atual de usuarios e
 * startups vinculados. Usado na tela de gestao do root.
 */
async function listar() {
  const { rows } = await query(
    `SELECT t.id_tenant, t.nome, t.email, t.celular, t.pais, t.estado, t.cidade,
            t.rua, t.ativo, t.qtd_usuarios, t.qtd_startups, t.logo, t.criado_ts,
            (SELECT COUNT(*) FROM tenant_usuarios tu
              WHERE tu.id_tenant = t.id_tenant AND tu.ativo)::int AS total_usuarios,
            (SELECT COUNT(*) FROM startup s
              WHERE s.id_tenant = t.id_tenant)::int AS total_startups
       FROM tenant t
      ORDER BY t.nome`
  )
  return rows
}

/** Busca um tenant pelo id. */
async function buscarPorId(id) {
  const { rows } = await query(`SELECT * FROM tenant WHERE id_tenant = $1`, [id])
  return rows[0]
}

/** Cria um novo tenant. Limites (qtd_usuarios/qtd_startups) sao opcionais. */
async function criar(dados) {
  const { nome, celular, email, pais, estado, cidade, rua, qtd_usuarios, qtd_startups, logo } = dados
  const { rows } = await query(
    `INSERT INTO tenant
       (nome, celular, email, pais, estado, cidade, rua, qtd_usuarios, qtd_startups, logo)
     VALUES ($1, $2, $3, $4, $5, $6, $7,
             COALESCE($8, 5), COALESCE($9, 10), $10)
     RETURNING id_tenant, nome, email, ativo, criado_ts`,
    [nome, celular, email, pais, estado, cidade, rua, qtd_usuarios ?? null, qtd_startups ?? null, logo ?? null]
  )
  return rows[0]
}

/**
 * Atualiza os dados cadastrais de um tenant.
 * @param {number} id
 * @param {object} dados - nome, celular, email, pais, estado, cidade, rua,
 *                         qtd_usuarios, qtd_startups, logo.
 */
async function atualizar(id, dados) {
  const { nome, celular, email, pais, estado, cidade, rua, qtd_usuarios, qtd_startups, logo } = dados
  const { rows } = await query(
    `UPDATE tenant
        SET nome = $2, celular = $3, email = $4, pais = $5, estado = $6,
            cidade = $7, rua = $8, qtd_usuarios = $9, qtd_startups = $10,
            logo = $11, atualizado_ts = NOW()
      WHERE id_tenant = $1
      RETURNING id_tenant, nome, email, ativo`,
    [id, nome, celular, email, pais, estado, cidade, rua, qtd_usuarios, qtd_startups, logo ?? null]
  )
  return rows[0]
}

/** Ativa ou desativa um tenant (ativo = TRUE/FALSE). */
async function alterarStatus(id, ativo) {
  const { rows } = await query(
    `UPDATE tenant
        SET ativo = $2, atualizado_ts = NOW()
      WHERE id_tenant = $1
      RETURNING id_tenant, nome, ativo`,
    [id, ativo]
  )
  return rows[0]
}

/**
 * Vincula um usuario a um tenant com um papel (admin/mentor/usuario).
 * @param {import('pg').PoolClient} [client] - Client de transacao opcional.
 */
async function vincularUsuario(idTenant, idUsuario, papel, client) {
  const executor = client || { query }
  const { rows } = await executor.query(
    `INSERT INTO tenant_usuarios (id_tenant, id_usuario, papel)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [idTenant, idUsuario, papel]
  )
  return rows[0]
}

/**
 * Lista os usuarios vinculados a um tenant (com papel e status do vinculo).
 * @param {number} idTenant
 */
async function listarUsuarios(idTenant) {
  const { rows } = await query(
    `SELECT u.id_usuario, u.nome, u.email, u.celular, u.deve_redefinir_senha,
            u.ultimo_login_ts, tu.papel, tu.ativo, tu.criado_ts
       FROM tenant_usuarios tu
       JOIN usuarios u ON u.id_usuario = tu.id_usuario
      WHERE tu.id_tenant = $1
      ORDER BY u.nome`,
    [idTenant]
  )
  return rows
}

/**
 * Lista os vinculos (tenant + papel) de um usuario, considerando apenas
 * vinculos e tenants ativos. Usado para resolver o tenant/papel do usuario
 * logado (ex.: qual incubadora a tela de fases opera).
 * @param {number} idUsuario
 * @returns {Promise<Array<{id_tenant:number, nome:string, papel:string}>>}
 */
async function listarVinculosPorUsuario(idUsuario) {
  const { rows } = await query(
    `SELECT t.id_tenant, t.nome, tu.papel
       FROM tenant t
       JOIN tenant_usuarios tu ON tu.id_tenant = t.id_tenant
      WHERE tu.id_usuario = $1
        AND tu.ativo = TRUE
        AND t.ativo = TRUE
      ORDER BY tu.criado_ts`,
    [idUsuario]
  )
  return rows
}

/**
 * Atualiza o papel (admin/mentor/usuario) de um usuario dentro de um tenant.
 * @param {number} idTenant
 * @param {number} idUsuario
 * @param {string} papel
 * @returns {Promise<object|undefined>} Vinculo atualizado, ou undefined se nao existir.
 */
async function atualizarPapel(idTenant, idUsuario, papel) {
  const { rows } = await query(
    `UPDATE tenant_usuarios
        SET papel = $3
      WHERE id_tenant = $1 AND id_usuario = $2
      RETURNING *`,
    [idTenant, idUsuario, papel]
  )
  return rows[0]
}

/**
 * Ativa ou desativa o vinculo de um usuario com o tenant.
 * @param {number} idTenant
 * @param {number} idUsuario
 * @param {boolean} ativo
 * @returns {Promise<object|undefined>} Vinculo atualizado, ou undefined se nao existir.
 */
async function atualizarStatusUsuario(idTenant, idUsuario, ativo) {
  const { rows } = await query(
    `UPDATE tenant_usuarios
        SET ativo = $3
      WHERE id_tenant = $1 AND id_usuario = $2
      RETURNING *`,
    [idTenant, idUsuario, ativo]
  )
  return rows[0]
}

/**
 * Retorna o papel (admin/mentor/usuario) de um usuario dentro de um tenant,
 * considerando apenas vinculos ativos. Retorna undefined se nao houver vinculo.
 * Usado para autorizar acoes restritas ao admin da incubadora.
 * @param {number} idTenant
 * @param {number} idUsuario
 * @returns {Promise<string|undefined>}
 */
async function buscarPapel(idTenant, idUsuario) {
  const { rows } = await query(
    `SELECT papel
       FROM tenant_usuarios
      WHERE id_tenant = $1 AND id_usuario = $2 AND ativo = TRUE`,
    [idTenant, idUsuario]
  )
  return rows[0]?.papel
}

/**
 * Busca um usuario vinculado a um tenant (id/nome/email), para acoes
 * administrativas (ex.: redefinicao de senha) que precisam do email.
 * @param {number} idTenant
 * @param {number} idUsuario
 * @returns {Promise<object|undefined>}
 */
async function buscarUsuarioVinculado(idTenant, idUsuario) {
  const { rows } = await query(
    // foto_url e papel entraram para o cabecalho da conversa (migracao 013):
    // e a mesma pessoa, vista de outra tela.
    `SELECT u.id_usuario, u.nome, u.email, u.foto_url, tu.papel, tu.ativo
       FROM tenant_usuarios tu
       JOIN usuarios u ON u.id_usuario = tu.id_usuario
      WHERE tu.id_tenant = $1 AND tu.id_usuario = $2`,
    [idTenant, idUsuario]
  )
  return rows[0]
}

/**
 * Atualiza a configuracao de e-mail (remetente/reply-to) de um tenant.
 * @param {number} idTenant
 * @param {{nome:string, remetente:string, replyTo:string}} config
 */
async function atualizarConfigEmail(idTenant, { nome, remetente, replyTo }) {
  const { rows } = await query(
    `UPDATE tenant
        SET email_remetente_nome = $2,
            email_remetente = $3,
            email_reply_to = $4,
            atualizado_ts = NOW()
      WHERE id_tenant = $1
      RETURNING id_tenant, email_remetente_nome, email_remetente, email_reply_to`,
    [idTenant, nome, remetente, replyTo]
  )
  return rows[0]
}

/**
 * O id da pagina da incubadora no LinkedIn (migracao 017).
 *
 * Usado so pela credencial publica de selo: com ele, o "Adicionar ao perfil"
 * liga a certificacao a organizacao REAL (com logo e link); sem ele, o
 * LinkedIn guarda apenas o nome como texto. Por isso e opcional, e por isso a
 * tela que o edita e a de engajamento, e nao a de dados cadastrais.
 */
async function atualizarLinkedin(idTenant, orgId) {
  const { rows } = await query(
    `UPDATE tenant SET linkedin_org_id = $2, atualizado_ts = NOW()
      WHERE id_tenant = $1
      RETURNING id_tenant, linkedin_org_id`,
    [idTenant, orgId || null]
  )
  return rows[0]
}

/**
 * Lista as configuracoes de e-mail dos tenants ATIVOS aos quais o usuario
 * pertence (vinculo ativo). Usado para resolver o remetente na recuperacao
 * de senha: se houver exatamente um, usamos o dele.
 * @param {number} idUsuario
 */
async function listarConfigEmailPorUsuario(idUsuario) {
  const { rows } = await query(
    `SELECT t.id_tenant, t.email_remetente_nome, t.email_remetente, t.email_reply_to
       FROM tenant t
       JOIN tenant_usuarios tu ON tu.id_tenant = t.id_tenant
      WHERE tu.id_usuario = $1
        AND tu.ativo = TRUE
        AND t.ativo = TRUE`,
    [idUsuario]
  )
  return rows
}

module.exports = {
  listar,
  buscarPorId,
  criar,
  atualizar,
  alterarStatus,
  vincularUsuario,
  listarUsuarios,
  atualizarPapel,
  atualizarStatusUsuario,
  listarVinculosPorUsuario,
  buscarPapel,
  buscarUsuarioVinculado,
  atualizarConfigEmail,
  atualizarLinkedin,
  listarConfigEmailPorUsuario,
}
