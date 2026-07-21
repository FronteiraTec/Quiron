/**
 * Service de autenticacao (camada de regra de negocio).
 *
 * Orquestra repositorio (dados) + utils (senha/token). Lanca erros de
 * negocio com a propriedade "status" para o controller traduzir em HTTP.
 */
const usuarioRepository = require("../repositories/usuarioRepository")
const senhaResetRepository = require("../repositories/senhaResetRepository")
const tenantRepository = require("../repositories/tenantRepository")
const { gerarHash, verificarSenha, gerarTokenReset, hashToken } = require("../utils/senha")
const { gerarToken, revogarToken } = require("../utils/jwt")
const { enviarEmailReset } = require("../utils/email")
const { erroNegocio } = require("../utils/erros")

// URL base do frontend, usada para montar o link de redefinicao.
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost"
// Validade do token de reset em minutos.
const RESET_EXPIRA_MIN = 60

/**
 * Anexa a um usuario os dados do vinculo com sua incubadora: a lista de
 * tenants ativos e, por conveniencia, o tenant/papel "principal" (o primeiro
 * vinculo ativo). O frontend usa id_tenant para operar (ex.: criar fases) e
 * papel para montar o menu. Usuario root nao tem vinculo -> tenants: [].
 * @param {object} usuario - Usuario base (sem dados de vinculo).
 * @returns {Promise<object>} Usuario enriquecido.
 */
async function anexarVinculoTenant(usuario) {
  const tenants = await tenantRepository.listarVinculosPorUsuario(usuario.id_usuario ?? usuario.id)
  const principal = tenants[0] || null
  return {
    ...usuario,
    tenants,
    id_tenant: principal?.id_tenant ?? null,
    papel: principal?.papel ?? null,
  }
}

/**
 * Resolve o remetente do e-mail com base no tenant do usuario.
 * Regra: se o usuario pertence a exatamente UMA incubadora com remetente
 * configurado, usa o dela; caso contrario, usa o remetente padrao (fallback).
 * @param {number} idUsuario
 * @returns {Promise<{from?:string, replyTo?:string}>}
 */
async function resolverRemetente(idUsuario) {
  const tenants = await tenantRepository.listarConfigEmailPorUsuario(idUsuario)

  // So aplica o remetente do tenant se houver exatamente um configurado.
  if (tenants.length === 1 && tenants[0].email_remetente) {
    const t = tenants[0]
    const from = t.email_remetente_nome
      ? `${t.email_remetente_nome} <${t.email_remetente}>`
      : t.email_remetente
    return { from, replyTo: t.email_reply_to || undefined }
  }

  // Zero, multiplos ou sem config -> remetente padrao.
  return {}
}

/**
 * Registra um novo usuario (senha criptografada em SHA-256).
 * @param {{nome, email, celular, senha}} dados
 * @returns {Promise<object>} Usuario criado.
 */
async function registrar({ nome, email, celular, senha }) {
  if (!nome || !email || !celular || !senha) {
    throw erroNegocio(400, "Informe nome, email, celular e senha.")
  }

  try {
    const senhaHash = gerarHash(senha)
    return await usuarioRepository.criar({ nome, email, celular, senhaHash })
  } catch (err) {
    // 23505 = violacao de UNIQUE (email ja cadastrado).
    if (err.code === "23505") {
      throw erroNegocio(409, "Email ja cadastrado.")
    }
    throw err
  }
}

/**
 * Autentica o usuario e devolve o Bearer Token.
 * @param {{email, senha}} dados
 * @returns {Promise<{token:string, usuario:object}>}
 */
async function login({ email, senha }) {
  if (!email || !senha) {
    throw erroNegocio(400, "Informe email e senha.")
  }

  const usuario = await usuarioRepository.buscarPorEmail(email)

  // Mensagem generica para nao revelar se o email existe.
  if (!usuario || !verificarSenha(senha, usuario.senha_hash)) {
    throw erroNegocio(401, "Credenciais invalidas.")
  }

  await usuarioRepository.registrarLogin(usuario.id_usuario)

  const token = gerarToken({
    id: usuario.id_usuario,
    email: usuario.email,
    root: usuario.root,
  })

  const usuarioBase = {
    id: usuario.id_usuario,
    nome: usuario.nome,
    email: usuario.email,
    root: usuario.root,
    deve_redefinir_senha: usuario.deve_redefinir_senha,
  }

  return {
    token,
    usuario: await anexarVinculoTenant(usuarioBase),
  }
}

/**
 * Define a nova senha no primeiro acesso (usuario ja autenticado com a senha
 * provisoria). Limpa a flag deve_redefinir_senha.
 * @param {number} id - Id do usuario logado.
 * @param {string} novaSenha
 */
async function definirPrimeiraSenha(id, novaSenha) {
  if (!novaSenha || novaSenha.length < 6) {
    throw erroNegocio(400, "A nova senha deve ter ao menos 6 caracteres.")
  }
  const senhaHash = gerarHash(novaSenha)
  await usuarioRepository.atualizarSenha(id, senhaHash)
}

/**
 * Efetua logout revogando o token atual.
 * @param {string} token
 */
function logout(token) {
  revogarToken(token)
}

/**
 * Retorna os dados do usuario logado.
 * @param {number} id
 * @returns {Promise<object>}
 */
async function perfil(id) {
  const usuario = await usuarioRepository.buscarPorId(id)
  if (!usuario) {
    throw erroNegocio(404, "Usuario nao encontrado.")
  }
  return anexarVinculoTenant(usuario)
}

/**
 * Atualiza os dados de perfil (nome e celular) do usuario logado.
 * @param {number} id
 * @param {{nome, celular}} dados
 * @returns {Promise<object>} Usuario atualizado.
 */
async function atualizarPerfil(id, { nome, celular }) {
  if (!nome || !celular) {
    throw erroNegocio(400, "Informe nome e celular.")
  }

  const usuario = await usuarioRepository.atualizarPerfil(id, { nome, celular })
  if (!usuario) {
    throw erroNegocio(404, "Usuario nao encontrado.")
  }
  return usuario
}

// Tamanho maximo aceito para a foto de perfil (data URL base64), em bytes.
const FOTO_MAX_BYTES = 2 * 1024 * 1024 // 2MB

/**
 * Atualiza a foto/avatar do usuario logado.
 * @param {number} id
 * @param {string|null} fotoUrl - Data URL (ex.: "data:image/png;base64,...") ou null para remover.
 * @returns {Promise<object>} Usuario atualizado.
 */
async function atualizarFoto(id, fotoUrl) {
  if (fotoUrl) {
    if (!/^data:image\/(png|jpe?g|webp|gif);base64,/.test(fotoUrl)) {
      throw erroNegocio(400, "Formato de imagem invalido.")
    }
    if (fotoUrl.length > FOTO_MAX_BYTES) {
      throw erroNegocio(400, "A imagem deve ter no maximo 2MB.")
    }
  }

  const usuario = await usuarioRepository.atualizarFoto(id, fotoUrl || null)
  if (!usuario) {
    throw erroNegocio(404, "Usuario nao encontrado.")
  }
  return usuario
}

/**
 * Solicita a redefinicao de senha: gera token, salva o hash e envia o email.
 *
 * Por seguranca, NAO revela se o email existe (resposta sempre generica).
 * @param {string} email
 */
async function solicitarResetSenha(email) {
  if (!email) throw erroNegocio(400, "Informe o email.")

  const usuario = await usuarioRepository.buscarPorEmail(email)

  // So gera/envia se o usuario existir; o controller responde generico.
  if (usuario) {
    const { token, tokenHash } = gerarTokenReset()

    // Invalida pedidos anteriores e cria o novo. O prazo vai em MINUTOS: quem
    // calcula a data de expiracao e o banco, no mesmo relogio que depois a
    // compara (ver senhaResetRepository.criar).
    await senhaResetRepository.invalidarAnteriores(usuario.id_usuario)
    await senhaResetRepository.criar(usuario.id_usuario, tokenHash, RESET_EXPIRA_MIN)

    // Link que o usuario vai abrir no frontend.
    const link = `${FRONTEND_URL}/reset-password?token=${token}`

    // Remetente definido nas configuracoes da incubadora do usuario.
    const remetente = await resolverRemetente(usuario.id_usuario)
    await enviarEmailReset(usuario.email, link, remetente)
  }
}

/**
 * Redefine a senha a partir de um token valido recebido por email.
 * @param {string} token - Token puro (vindo do link).
 * @param {string} novaSenha
 */
async function redefinirSenha(token, novaSenha) {
  if (!token || !novaSenha) {
    throw erroNegocio(400, "Informe o token e a nova senha.")
  }

  // Compara pelo hash do token (nunca guardamos o token puro).
  const registro = await senhaResetRepository.buscarValidoPorHash(hashToken(token))
  if (!registro) {
    throw erroNegocio(400, "Token invalido ou expirado.")
  }

  // Salva a nova senha (SHA-256) e consome o token.
  const senhaHash = gerarHash(novaSenha)
  await usuarioRepository.atualizarSenha(registro.id_usuario, senhaHash)
  await senhaResetRepository.marcarUsado(registro.id_reset)
}

module.exports = {
  registrar,
  login,
  logout,
  perfil,
  atualizarPerfil,
  atualizarFoto,
  definirPrimeiraSenha,
  solicitarResetSenha,
  redefinirSenha,
}
