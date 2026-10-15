/**
 * Repositorio de RBAC (camada de acesso a dados).
 * Tabelas relacionadas: permissao, role, role_permissao, usuario_role.
 */
const { query } = require("../config/db")
const { ROLES_PADRAO, permissoesDaRole, ROLE_POR_PAPEL } = require("../rbac/rolesPadrao")

/** Lista o catalogo completo de permissoes (sincronizado a partir do codigo). */
async function listarPermissoesCatalogo() {
  const { rows } = await query(
    `SELECT id_permissao, chave, modulo, recurso, acao, rotulo_modulo, rotulo_recurso, rotulo_acao
       FROM permissao
      ORDER BY modulo, recurso, acao`
  )
  return rows
}

/** Lista as roles de um tenant, com contagem de usuarios e permissoes vinculados. */
async function listarRoles(idTenant) {
  const { rows } = await query(
    `SELECT r.id_role, r.nome, r.descricao, r.sistema, r.criado_ts,
            (SELECT COUNT(*) FROM usuario_role ur WHERE ur.id_role = r.id_role)::int AS total_usuarios,
            (SELECT COUNT(*) FROM role_permissao rp WHERE rp.id_role = r.id_role)::int AS total_permissoes
       FROM role r
      WHERE r.id_tenant = $1
      ORDER BY r.nome`,
    [idTenant]
  )
  return rows
}

/** Busca uma role pelo id, restrita ao tenant informado. */
async function buscarRole(idTenant, idRole) {
  const { rows } = await query(
    `SELECT id_role, id_tenant, nome, descricao, sistema, criado_ts
       FROM role
      WHERE id_tenant = $1 AND id_role = $2`,
    [idTenant, idRole]
  )
  return rows[0]
}

/** Cria uma role para o tenant. */
async function criarRole(idTenant, { nome, descricao, sistema = false }) {
  const { rows } = await query(
    `INSERT INTO role (id_tenant, nome, descricao, sistema)
     VALUES ($1, $2, $3, $4)
     RETURNING id_role, id_tenant, nome, descricao, sistema, criado_ts`,
    [idTenant, nome, descricao ?? null, sistema]
  )
  return rows[0]
}

/** Cria as roles padrao (sistema) de um tenant recem-criado. */
async function criarRolesPadrao(idTenant, client) {
  const executor = client || { query }

  for (const r of ROLES_PADRAO) {
    await executor.query(
      `INSERT INTO role (id_tenant, nome, descricao, sistema)
       VALUES ($1, $2, $3, TRUE)
       ON CONFLICT (id_tenant, nome) DO NOTHING`,
      [idTenant, r.nome, r.descricao]
    )

    // Buscamos o id em vez de usar RETURNING: com ON CONFLICT DO NOTHING a
    // linha nao volta quando a role ja existia, e esta funcao precisa ser
    // idempotente (roda na criacao do tenant e de novo na migracao).
    const { rows } = await executor.query(
      `SELECT id_role FROM role WHERE id_tenant = $1 AND nome = $2`,
      [idTenant, r.nome]
    )
    if (!rows[0]) continue

    // Sem este bloco as roles nasciam vazias — criadas, visiveis na tela,
    // marcadas como `sistema` (portanto nao excluiveis) e concedendo nada.
    const chaves = permissoesDaRole(r.nome)
    if (chaves.length === 0) continue

    await executor.query(
      `INSERT INTO role_permissao (id_role, id_permissao)
       SELECT $1, p.id_permissao
         FROM permissao p
        WHERE p.chave = ANY($2::text[])
       ON CONFLICT (id_role, id_permissao) DO NOTHING`,
      [rows[0].id_role, chaves]
    )
  }
}

/** Atualiza nome/descricao de uma role. */
async function atualizarRole(idRole, { nome, descricao }) {
  const { rows } = await query(
    `UPDATE role
        SET nome = $2, descricao = $3, atualizado_ts = NOW()
      WHERE id_role = $1
      RETURNING id_role, id_tenant, nome, descricao, sistema`,
    [idRole, nome, descricao ?? null]
  )
  return rows[0]
}

/** Exclui uma role. */
async function excluirRole(idRole) {
  await query(`DELETE FROM role WHERE id_role = $1`, [idRole])
}

/** Lista as chaves de permissao vinculadas a uma role. */
async function listarPermissoesDaRole(idRole) {
  const { rows } = await query(
    `SELECT p.chave
       FROM role_permissao rp
       JOIN permissao p ON p.id_permissao = rp.id_permissao
      WHERE rp.id_role = $1`,
    [idRole]
  )
  return rows.map((r) => r.chave)
}

/**
 * Substitui o conjunto de permissoes de uma role pelas chaves informadas.
 * @param {number} idRole
 * @param {string[]} chaves
 */
async function definirPermissoesDaRole(idRole, chaves) {
  const { withTransaction } = require("../config/db")
  return withTransaction(async (client) => {
    await client.query(`DELETE FROM role_permissao WHERE id_role = $1`, [idRole])
    if (chaves.length === 0) return

    await client.query(
      `INSERT INTO role_permissao (id_role, id_permissao)
       SELECT $1, id_permissao FROM permissao WHERE chave = ANY($2::text[])`,
      [idRole, chaves]
    )
  })
}

/** Lista os usuarios vinculados a uma role. */
async function listarUsuariosDaRole(idRole) {
  const { rows } = await query(
    `SELECT u.id_usuario, u.nome, u.email
       FROM usuario_role ur
       JOIN usuarios u ON u.id_usuario = ur.id_usuario
      WHERE ur.id_role = $1
      ORDER BY u.nome`,
    [idRole]
  )
  return rows
}

/**
 * Lista os usuarios ativos da incubadora com as roles (deste tenant) que
 * cada um possui. Usado na tela de atribuicao de usuarios aos grupos/roles.
 * @param {number} idTenant
 */
async function listarUsuariosComRoles(idTenant) {
  const { rows } = await query(
    `SELECT u.id_usuario, u.nome, u.email,
            COALESCE(
              json_agg(json_build_object('id_role', r.id_role, 'nome', r.nome))
                FILTER (WHERE r.id_role IS NOT NULL),
              '[]'
            ) AS roles
       FROM tenant_usuarios tu
       JOIN usuarios u ON u.id_usuario = tu.id_usuario
       LEFT JOIN usuario_role ur ON ur.id_usuario = u.id_usuario
       LEFT JOIN role r ON r.id_role = ur.id_role AND r.id_tenant = tu.id_tenant
      WHERE tu.id_tenant = $1 AND tu.ativo = TRUE
      GROUP BY u.id_usuario, u.nome, u.email
      ORDER BY u.nome`,
    [idTenant]
  )
  return rows
}

/** Conta quantas chaves (dentre as informadas) realmente existem no catalogo. */
async function contarPermissoesValidas(chaves) {
  if (chaves.length === 0) return 0
  const { rows } = await query(`SELECT COUNT(*)::int AS total FROM permissao WHERE chave = ANY($1::text[])`, [
    chaves,
  ])
  return rows[0].total
}

async function vincularUsuarioRole(idUsuario, idRole) {
  const { rows } = await query(
    `INSERT INTO usuario_role (id_usuario, id_role)
     VALUES ($1, $2)
     ON CONFLICT (id_usuario, id_role) DO NOTHING
     RETURNING id_usuario, id_role`,
    [idUsuario, idRole]
  )
  return rows[0]
}

async function desvincularUsuarioRole(idUsuario, idRole) {
  await query(`DELETE FROM usuario_role WHERE id_usuario = $1 AND id_role = $2`, [idUsuario, idRole])
}

/**
 * Aloca um usuario na role padrao (sistema) equivalente ao papel que acabou
 * de receber em `tenant_usuarios` — o ponto de partida do RBAC para quem
 * esta sendo vinculado agora. Nao mexe em quem ja estiver em alguma role: so
 * roda no momento do vinculo (criarUsuario/vincularUsuario), nunca em
 * atualizacao de papel, para nao sobrescrever uma customizacao que o admin
 * ja tenha feito na tela de Permissoes.
 * @param {number} idTenant
 * @param {number} idUsuario
 * @param {string} papel - admin, mentor ou usuario.
 */
async function alocarRolePadrao(idTenant, idUsuario, papel, client) {
  const executor = client || { query }
  const nomeRole = ROLE_POR_PAPEL[papel]
  if (!nomeRole) return

  const { rows } = await executor.query(
    `SELECT id_role FROM role WHERE id_tenant = $1 AND nome = $2 AND sistema = TRUE`,
    [idTenant, nomeRole]
  )
  if (!rows[0]) return

  await executor.query(
    `INSERT INTO usuario_role (id_usuario, id_role)
     VALUES ($1, $2)
     ON CONFLICT (id_usuario, id_role) DO NOTHING`,
    [idUsuario, rows[0].id_role]
  )
}

/**
 * Verifica se um usuario possui uma permissao (chave) dentro de um tenant,
 * via alguma role (do tenant) a qual ele esteja vinculado.
 *
 * O vinculo ATIVO com o tenant e condicao, nao detalhe (QRN-07): desativar um
 * usuario so mexe em `tenant_usuarios.ativo`, e as linhas de `usuario_role`
 * ficam onde estavam para o caso de ele ser reativado. Sem o JOIN abaixo, o
 * desligado continuava passando em toda chave das roles que tinha.
 * @param {number} idTenant
 * @param {number} idUsuario
 * @param {string} chave
 * @returns {Promise<boolean>}
 */
async function usuarioTemPermissao(idTenant, idUsuario, chave) {
  const { rows } = await query(
    `SELECT EXISTS (
       SELECT 1
         FROM usuario_role ur
         JOIN role r ON r.id_role = ur.id_role
         JOIN tenant_usuarios tu ON tu.id_usuario = ur.id_usuario
                                AND tu.id_tenant = r.id_tenant
                                AND tu.ativo = TRUE
         JOIN role_permissao rp ON rp.id_role = ur.id_role
         JOIN permissao p ON p.id_permissao = rp.id_permissao
        WHERE ur.id_usuario = $1 AND r.id_tenant = $2 AND p.chave = $3
     ) AS tem`,
    [idUsuario, idTenant, chave]
  )
  return rows[0].tem
}

/**
 * Lista as chaves de permissao que um usuario possui num tenant (uniao das
 * permissoes de todas as roles as quais ele esta vinculado nesse tenant).
 * @param {number} idTenant
 * @param {number} idUsuario
 * @returns {Promise<string[]>}
 */
async function listarPermissoesDoUsuario(idTenant, idUsuario) {
  const { rows } = await query(
    `SELECT DISTINCT p.chave
       FROM usuario_role ur
       JOIN role r ON r.id_role = ur.id_role
       -- Mesmo recorte de usuarioTemPermissao: desligado nao tem chave.
       JOIN tenant_usuarios tu ON tu.id_usuario = ur.id_usuario
                              AND tu.id_tenant = r.id_tenant
                              AND tu.ativo = TRUE
       JOIN role_permissao rp ON rp.id_role = ur.id_role
       JOIN permissao p ON p.id_permissao = rp.id_permissao
      WHERE ur.id_usuario = $1 AND r.id_tenant = $2`,
    [idUsuario, idTenant]
  )
  return rows.map((r) => r.chave)
}

module.exports = {
  listarPermissoesCatalogo,
  listarRoles,
  buscarRole,
  criarRole,
  criarRolesPadrao,
  atualizarRole,
  excluirRole,
  listarPermissoesDaRole,
  definirPermissoesDaRole,
  listarUsuariosDaRole,
  listarUsuariosComRoles,
  contarPermissoesValidas,
  vincularUsuarioRole,
  desvincularUsuarioRole,
  alocarRolePadrao,
  usuarioTemPermissao,
  listarPermissoesDoUsuario,
}
