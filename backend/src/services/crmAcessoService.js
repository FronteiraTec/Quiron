/**
 * O portao do Mini CRM (migracao 026).
 *
 * Toda operacao do CRM comeca por `exigirAcesso`, no service, antes de ler ou
 * gravar qualquer coisa. Sao duas condicoes, e as duas sao conferidas no banco a
 * cada pedido — nada vem do token nem do front:
 *
 *   1. a pessoa e MEMBRO ATIVO da startup (e o vinculo dela com a incubadora
 *      esta ativo). O CRM e o trabalho comercial da startup: nem o admin nem o
 *      mentor entram nele por terem a chave da startup. Mesma regra das
 *      entregas (startupService.garantirMembro).
 *   2. a startup tem o beneficio CRM ATIVO. Revogado, o acesso fecha na hora —
 *      inclusive para quem estava com a tela aberta — e os dados ficam.
 *
 * A ordem importa: quem nao e membro recebe "sem vinculo" mesmo que o
 * beneficio esteja desligado, para a resposta nao contar a quem e de fora o
 * que a incubadora liberou para a startup.
 */
const beneficioRepository = require("../repositories/beneficioRepository")
const startupRepository = require("../repositories/startupRepository")
const crmEtapaRepository = require("../repositories/crmEtapaRepository")
const crmClienteRepository = require("../repositories/crmClienteRepository")
const { ORIGENS_SUGERIDAS } = require("../crm/padroes")
const { erroNegocio } = require("../utils/erros")

/**
 * @param {number|string} idStartup - o `:idStartup` da rota.
 * @param {{id: number}} usuario - o da sessao (req.usuario).
 * @returns {Promise<{idStartup: number, idTenant: number, nomeStartup: string,
 *   uuid: string, idUsuario: number, autorNome: string}>} o contexto que os
 *   services do CRM passam adiante (e de onde sai o autor de cada evento).
 */
async function exigirAcesso(idStartup, usuario) {
  const id = Number(idStartup)
  if (!Number.isInteger(id) || id <= 0) throw erroNegocio(404, "Startup não encontrada.")
  if (!usuario?.id) throw erroNegocio(403, "O CRM é da startup: só os membros dela têm acesso.", "SEM_VINCULO")

  const acesso = await beneficioRepository.acessoCrm(id, usuario.id)
  if (!acesso) throw erroNegocio(404, "Startup não encontrada.")
  if (!acesso.membro) {
    throw erroNegocio(403, "O CRM é da startup: só os membros dela têm acesso.", "SEM_VINCULO")
  }
  if (!acesso.beneficio_ativo) {
    throw erroNegocio(
      403,
      "O Mini CRM não está liberado para esta startup. Ele é um benefício concedido pela incubadora.",
      "BENEFICIO_INATIVO"
    )
  }

  return {
    idStartup: acesso.id_startup,
    idTenant: acesso.id_tenant,
    nomeStartup: acesso.nome,
    uuid: acesso.uuid,
    idUsuario: usuario.id,
    autorNome: acesso.autor_nome,
  }
}

/**
 * O que toda tela do CRM precisa antes de desenhar qualquer coisa: a startup,
 * quem pode ser responsavel (os membros ativos), as etapas do funil e as
 * origens a sugerir.
 */
async function contexto(idStartup, usuario) {
  const ctx = await exigirAcesso(idStartup, usuario)
  const [membros, etapas, origensEmUso] = await Promise.all([
    startupRepository.listarMembros(ctx.idStartup),
    crmEtapaRepository.listar(ctx.idStartup),
    crmClienteRepository.origensEmUso(ctx.idStartup),
  ])
  const origens = [...new Set([...ORIGENS_SUGERIDAS, ...origensEmUso])]
  return {
    startup: { id_startup: ctx.idStartup, nome: ctx.nomeStartup, uuid: ctx.uuid },
    membros: membros.map((m) => ({ id_usuario: m.id_usuario, nome: m.nome, foto_url: m.foto_url, lider: m.lider })),
    etapas,
    origens,
  }
}

/** O responsavel informado precisa ser membro ativo da startup. */
async function exigirMembro(ctx, idUsuario) {
  if (!idUsuario) return
  const membro = await startupRepository.ehMembroDe(ctx.idStartup, idUsuario)
  if (!membro) throw erroNegocio(400, "O responsável precisa ser membro da startup.")
}

module.exports = { exigirAcesso, contexto, exigirMembro }
