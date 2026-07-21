/**
 * Service de Tenants (regra de negocio).
 * Orquestra o tenantRepository. Todas as queries usam prepared statements.
 */
const tenantRepository = require("../repositories/tenantRepository")
const usuarioRepository = require("../repositories/usuarioRepository")
const rbacRepository = require("../repositories/rbacRepository")
const agendaConfigRepository = require("../repositories/agendaConfigRepository")
const { gerarHash } = require("../utils/senha")
const { withTransaction } = require("../config/db")
const { erroNegocio } = require("../utils/erros")

const PAPEIS_VALIDOS = ["admin", "mentor", "usuario"]

/** Lista todos os tenants. */
async function listar() {
  return tenantRepository.listar()
}

/** Busca um tenant pelo id. */
async function buscar(id) {
  const tenant = await tenantRepository.buscarPorId(id)
  if (!tenant) throw erroNegocio(404, "Tenant nao encontrado.")
  return tenant
}

/**
 * Garante que o usuario pode acessar/gerenciar as configuracoes do tenant:
 * root acessa qualquer um, os demais somente se forem admin DAQUELE tenant.
 * @param {number} idTenant
 * @param {{id:number, root?:boolean}} usuario
 */
async function garantirAcessoTenant(idTenant, usuario) {
  if (usuario?.root) return
  const papel = await tenantRepository.buscarPapel(idTenant, usuario?.id)
  if (papel !== "admin") {
    throw erroNegocio(403, "Apenas o administrador da incubadora ou o root podem acessar.")
  }
}

/** Busca um tenant pelo id, restrito ao admin daquele tenant ou ao root. */
async function buscarComPermissao(id, usuario) {
  await garantirAcessoTenant(id, usuario)
  return buscar(id)
}

/** Cria um tenant, validando os campos obrigatorios. */
async function criar(dados) {
  const { nome, celular, email, pais, estado, cidade, rua } = dados
  if (!nome || !celular || !email || !pais || !estado || !cidade || !rua) {
    throw erroNegocio(400, "Preencha todos os campos obrigatorios do tenant.")
  }
  const tenant = await tenantRepository.criar(dados)
  // Roles padrao (sistema) para a incubadora recem-criada.
  await rbacRepository.criarRolesPadrao(tenant.id_tenant)
  // Categorias padrao da agenda. Nao e cosmetico: a FK (id_tenant, categoria)
  // exige que exista ao menos uma categoria antes do primeiro evento, entao uma
  // incubadora sem esta linha nasceria com o calendario travado.
  await agendaConfigRepository.semearCategoriasPadrao(tenant.id_tenant)
  return tenant
}

/** Atualiza os dados cadastrais de um tenant existente. */
async function atualizar(id, dados) {
  await buscar(id) // garante que existe (lanca 404 se nao)

  const { nome, celular, email, pais, estado, cidade, rua } = dados
  if (!nome || !celular || !email || !pais || !estado || !cidade || !rua) {
    throw erroNegocio(400, "Preencha todos os campos obrigatorios do tenant.")
  }
  return tenantRepository.atualizar(id, dados)
}

/** Ativa ou desativa um tenant. */
async function alterarStatus(id, ativo) {
  if (typeof ativo !== "boolean") {
    throw erroNegocio(400, "Informe 'ativo' como true ou false.")
  }
  const tenant = await tenantRepository.alterarStatus(id, ativo)
  if (!tenant) throw erroNegocio(404, "Tenant nao encontrado.")
  return tenant
}

/** Vincula um usuario ao tenant com um papel (admin/mentor/usuario). */
async function vincularUsuario(idTenant, idUsuario, papel) {
  if (!idUsuario || !PAPEIS_VALIDOS.includes(papel)) {
    throw erroNegocio(400, "Informe id_usuario e um papel valido.")
  }
  return tenantRepository.vincularUsuario(idTenant, idUsuario, papel)
}

/** Lista os usuarios vinculados a um tenant (root ou admin daquele tenant). */
async function listarUsuarios(idTenant, usuario) {
  await garantirAcessoTenant(idTenant, usuario)
  await buscar(idTenant) // garante que o tenant existe (404 se nao)
  return tenantRepository.listarUsuarios(idTenant)
}

/**
 * Cria um novo usuario ja vinculado a uma incubadora, com senha PROVISORIA
 * (o usuario sera obrigado a redefini-la no primeiro login).
 *
 * A criacao do usuario e o vinculo ao tenant ocorrem numa unica transacao
 * (ou ambos, ou nenhum).
 *
 * @param {number} idTenant
 * @param {{nome, email, celular, senha, papel}} dados
 * @param {{id:number, root?:boolean}} usuario - Quem esta criando (root ou admin do tenant).
 * @returns {Promise<object>} Usuario criado (sem a senha).
 */
async function criarUsuario(idTenant, { nome, email, celular, senha, papel }, usuario) {
  await garantirAcessoTenant(idTenant, usuario)
  await buscar(idTenant) // garante que o tenant existe (404 se nao)

  if (!nome || !email || !celular || !senha) {
    throw erroNegocio(400, "Informe nome, email, celular e senha provisoria.")
  }
  if (!PAPEIS_VALIDOS.includes(papel)) {
    throw erroNegocio(400, "Informe um papel valido (admin, mentor ou usuario).")
  }
  if (senha.length < 6) {
    throw erroNegocio(400, "A senha provisoria deve ter ao menos 6 caracteres.")
  }

  const senhaHash = gerarHash(senha)

  try {
    return await withTransaction(async (client) => {
      const usuario = await usuarioRepository.criar(
        { nome, email, celular, senhaHash, deveRedefinir: true },
        client
      )
      await tenantRepository.vincularUsuario(idTenant, usuario.id_usuario, papel, client)
      return { ...usuario, papel }
    })
  } catch (err) {
    // 23505 = violacao de UNIQUE (email ja cadastrado).
    if (err.code === "23505") {
      throw erroNegocio(409, "Email ja cadastrado.")
    }
    throw err
  }
}

/**
 * Atualiza o nome/celular/papel de um usuario vinculado ao tenant.
 * @param {number} idTenant
 * @param {number} idUsuario
 * @param {{nome, celular, papel}} dados
 * @param {{id:number, root?:boolean}} usuario - Quem esta editando (root ou admin do tenant).
 */
async function atualizarUsuario(idTenant, idUsuario, { nome, celular, papel }, usuario) {
  await garantirAcessoTenant(idTenant, usuario)
  if (!nome || !celular) {
    throw erroNegocio(400, "Informe nome e celular.")
  }
  if (!PAPEIS_VALIDOS.includes(papel)) {
    throw erroNegocio(400, "Informe um papel valido (admin, mentor ou usuario).")
  }
  await usuarioRepository.atualizarPerfil(idUsuario, { nome, celular })
  const vinculo = await tenantRepository.atualizarPapel(idTenant, idUsuario, papel)
  if (!vinculo) throw erroNegocio(404, "Usuario nao vinculado a esta incubadora.")
  return vinculo
}

/**
 * Ativa ou desativa o vinculo de um usuario com o tenant.
 * @param {number} idTenant
 * @param {number} idUsuario
 * @param {boolean} ativo
 * @param {{id:number, root?:boolean}} usuario - Quem esta alterando (root ou admin do tenant).
 */
async function alterarStatusUsuario(idTenant, idUsuario, ativo, usuario) {
  await garantirAcessoTenant(idTenant, usuario)
  if (typeof ativo !== "boolean") {
    throw erroNegocio(400, "Informe 'ativo' como true ou false.")
  }
  const vinculo = await tenantRepository.atualizarStatusUsuario(idTenant, idUsuario, ativo)
  if (!vinculo) throw erroNegocio(404, "Usuario nao vinculado a esta incubadora.")
  return vinculo
}

/**
 * Atualiza a configuracao de e-mail (remetente/reply-to) da incubadora.
 * @param {number} idTenant
 * @param {{nome, remetente, replyTo}} config
 */
async function atualizarConfigEmail(idTenant, { nome, remetente, replyTo }, usuario) {
  await garantirAcessoTenant(idTenant, usuario)
  // Garante que o tenant existe.
  await buscar(idTenant)

  // Validacao simples de formato de e-mail.
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (remetente && !emailRegex.test(remetente)) {
    throw erroNegocio(400, "E-mail remetente invalido.")
  }
  if (replyTo && !emailRegex.test(replyTo)) {
    throw erroNegocio(400, "E-mail de reply-to invalido.")
  }

  return tenantRepository.atualizarConfigEmail(idTenant, { nome, remetente, replyTo })
}

module.exports = {
  listar,
  buscar,
  buscarComPermissao,
  garantirAcessoTenant,
  criar,
  atualizar,
  alterarStatus,
  vincularUsuario,
  listarUsuarios,
  criarUsuario,
  atualizarUsuario,
  alterarStatusUsuario,
  atualizarConfigEmail,
}
