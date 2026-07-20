/**
 * Service de RBAC (regra de negocio).
 * Autorizacao: root ou admin do tenant (reaproveita tenantService.garantirAcessoTenant,
 * a mesma checagem ja usada pela tela de Configuracoes da incubadora).
 */
const rbacRepository = require("../repositories/rbacRepository")
const tenantRepository = require("../repositories/tenantRepository")
const tenantService = require("./tenantService")
const authService = require("./authService")
const { erroNegocio } = require("../utils/erros")

/** Catalogo completo de permissoes, agrupado por modulo/recurso (para a tela de RBAC). */
async function catalogo() {
  const permissoes = await rbacRepository.listarPermissoesCatalogo()

  const modulos = new Map()
  for (const p of permissoes) {
    if (!modulos.has(p.modulo)) {
      modulos.set(p.modulo, { modulo: p.modulo, rotulo: p.rotulo_modulo, recursos: new Map() })
    }
    const mod = modulos.get(p.modulo)
    if (!mod.recursos.has(p.recurso)) {
      mod.recursos.set(p.recurso, { recurso: p.recurso, rotulo: p.rotulo_recurso, acoes: [] })
    }
    mod.recursos.get(p.recurso).acoes.push({ chave: p.chave, acao: p.acao, rotulo: p.rotulo_acao })
  }

  return Array.from(modulos.values()).map((mod) => ({
    ...mod,
    recursos: Array.from(mod.recursos.values()),
  }))
}

/** Lista as roles de um tenant (root ou admin do tenant). */
async function listarRoles(idTenant, usuario) {
  await tenantService.garantirAcessoTenant(idTenant, usuario)
  return rbacRepository.listarRoles(idTenant)
}

/** Busca o detalhe de uma role: dados + chaves de permissao + usuarios vinculados. */
async function buscarRole(idTenant, idRole, usuario) {
  await tenantService.garantirAcessoTenant(idTenant, usuario)
  const role = await rbacRepository.buscarRole(idTenant, idRole)
  if (!role) throw erroNegocio(404, "Role nao encontrada.")

  const [permissoes, usuarios] = await Promise.all([
    rbacRepository.listarPermissoesDaRole(idRole),
    rbacRepository.listarUsuariosDaRole(idRole),
  ])
  return { ...role, permissoes, usuarios }
}

/** Cria uma role no tenant. */
async function criarRole(idTenant, usuario, { nome, descricao }) {
  await tenantService.garantirAcessoTenant(idTenant, usuario)
  if (!nome?.trim()) throw erroNegocio(400, "Informe o nome da role.")

  try {
    return await rbacRepository.criarRole(idTenant, { nome: nome.trim(), descricao })
  } catch (err) {
    if (err.code === "23505") throw erroNegocio(409, "Ja existe uma role com esse nome nesta incubadora.")
    throw err
  }
}

/** Atualiza nome/descricao de uma role. */
async function atualizarRole(idTenant, idRole, usuario, { nome, descricao }) {
  await tenantService.garantirAcessoTenant(idTenant, usuario)
  const role = await rbacRepository.buscarRole(idTenant, idRole)
  if (!role) throw erroNegocio(404, "Role nao encontrada.")
  if (!nome?.trim()) throw erroNegocio(400, "Informe o nome da role.")

  try {
    return await rbacRepository.atualizarRole(idRole, { nome: nome.trim(), descricao })
  } catch (err) {
    if (err.code === "23505") throw erroNegocio(409, "Ja existe uma role com esse nome nesta incubadora.")
    throw err
  }
}

/** Exclui uma role (bloqueia roles de sistema ou com usuarios vinculados). */
async function excluirRole(idTenant, idRole, usuario) {
  await tenantService.garantirAcessoTenant(idTenant, usuario)
  const role = await rbacRepository.buscarRole(idTenant, idRole)
  if (!role) throw erroNegocio(404, "Role nao encontrada.")
  if (role.sistema) throw erroNegocio(400, "Roles padrao do sistema nao podem ser excluidas.")

  const usuarios = await rbacRepository.listarUsuariosDaRole(idRole)
  if (usuarios.length > 0) {
    throw erroNegocio(400, "Desvincule os usuarios desta role antes de exclui-la.")
  }

  await rbacRepository.excluirRole(idRole)
}

/** Substitui o conjunto de permissoes de uma role. */
async function definirPermissoesDaRole(idTenant, idRole, usuario, chaves) {
  await tenantService.garantirAcessoTenant(idTenant, usuario)
  const role = await rbacRepository.buscarRole(idTenant, idRole)
  if (!role) throw erroNegocio(404, "Role nao encontrada.")
  if (!Array.isArray(chaves)) throw erroNegocio(400, "Informe a lista de permissoes.")

  const chavesUnicas = [...new Set(chaves)]
  const validas = await rbacRepository.contarPermissoesValidas(chavesUnicas)
  if (validas !== chavesUnicas.length) {
    throw erroNegocio(400, "Uma ou mais permissoes informadas nao existem no catalogo.")
  }

  await rbacRepository.definirPermissoesDaRole(idRole, chavesUnicas)
  return rbacRepository.listarPermissoesDaRole(idRole)
}

/** Lista os usuarios da incubadora com as roles que cada um possui. */
async function listarUsuariosComRoles(idTenant, usuario) {
  await tenantService.garantirAcessoTenant(idTenant, usuario)
  return rbacRepository.listarUsuariosComRoles(idTenant)
}

/** Vincula um usuario a uma role. */
async function vincularUsuario(idTenant, idRole, usuario, idUsuarioAlvo) {
  await tenantService.garantirAcessoTenant(idTenant, usuario)
  const role = await rbacRepository.buscarRole(idTenant, idRole)
  if (!role) throw erroNegocio(404, "Role nao encontrada.")
  if (!idUsuarioAlvo) throw erroNegocio(400, "Informe o usuario a vincular.")

  await rbacRepository.vincularUsuarioRole(idUsuarioAlvo, idRole)
  return rbacRepository.listarUsuariosDaRole(idRole)
}

/** Desvincula um usuario de uma role. */
async function desvincularUsuario(idTenant, idRole, usuario, idUsuarioAlvo) {
  await tenantService.garantirAcessoTenant(idTenant, usuario)
  const role = await rbacRepository.buscarRole(idTenant, idRole)
  if (!role) throw erroNegocio(404, "Role nao encontrada.")

  await rbacRepository.desvincularUsuarioRole(idUsuarioAlvo, idRole)
  return rbacRepository.listarUsuariosDaRole(idRole)
}

/**
 * Garante que o usuario possui a permissao (chave) informada dentro do
 * tenant, lancando 403 caso contrario. O usuario ROOT sempre passa.
 * @param {number} idTenant
 * @param {{id:number, root?:boolean}} usuario
 * @param {string} chave
 */
async function garantirPermissao(idTenant, usuario, chave) {
  if (usuario?.root) return
  const tem = await rbacRepository.usuarioTemPermissao(idTenant, usuario?.id, chave)
  if (!tem) {
    throw erroNegocio(403, "Voce nao tem permissao para realizar esta acao.")
  }
}

/**
 * Versao nao-lancante de garantirPermissao: responde true/false.
 *
 * Existe porque nem toda checagem e um portao de "pode ou nao entrar". Nas
 * regras compostas — onde a permissao RBAC e uma das varias formas de obter o
 * direito — quem decide o erro final e o service de dominio, que sabe dizer se
 * o problema foi falta de permissao ou falta de vinculo com a startup.
 * @param {number} idTenant
 * @param {{id:number, root?:boolean}} usuario
 * @param {string} chave
 * @returns {Promise<boolean>}
 */
async function temPermissao(idTenant, usuario, chave) {
  if (usuario?.root) return true
  return rbacRepository.usuarioTemPermissao(idTenant, usuario?.id, chave)
}

// `podeMentorar` foi removida em 20/07/2026. Ela existia para o modelo antigo,
// em que o papel autorizava e a permissao apenas estendia: respondia "e mentor
// OU tem a chave?". Com o RBAC autoritativo a pergunta virou so a chave, e as
// duas coisas que ela guardava passaram a ser checadas direto onde importam —
// avaliacoes.entregas.visualizar e avaliacoes.avaliacoes.avaliar, cruzadas com
// o vinculo `mentor_startup`, que continua sendo um eixo separado (o QUE x o
// PARA QUEM).

/** Lista as chaves de permissao que o usuario logado possui no tenant. */
async function minhasPermissoes(idTenant, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  return rbacRepository.listarPermissoesDoUsuario(idTenant, usuario.id)
}

/**
 * Dispara a redefinicao de senha de um usuario da incubadora (envia o email
 * com o link de reset), exigindo a permissao RBAC "usuarios.usuarios.redefinir_senha"
 * (root sempre passa).
 * @param {number} idTenant
 * @param {number} idUsuarioAlvo
 * @param {{id:number, root?:boolean}} usuario - Quem esta solicitando.
 */
async function redefinirSenhaUsuario(idTenant, idUsuarioAlvo, usuario) {
  await garantirPermissao(idTenant, usuario, "usuarios.usuarios.redefinir_senha")
  const vinculo = await tenantRepository.buscarUsuarioVinculado(idTenant, idUsuarioAlvo)
  if (!vinculo) throw erroNegocio(404, "Usuario nao vinculado a esta incubadora.")
  await authService.solicitarResetSenha(vinculo.email)
}

module.exports = {
  catalogo,
  listarRoles,
  buscarRole,
  criarRole,
  atualizarRole,
  excluirRole,
  definirPermissoesDaRole,
  listarUsuariosComRoles,
  vincularUsuario,
  desvincularUsuario,
  garantirPermissao,
  temPermissao,
  minhasPermissoes,
  redefinirSenhaUsuario,
}
