/**
 * Service de Mentores (regra de negocio).
 *
 * Gestao do vinculo mentor <-> startup pelo admin da incubadora. E este
 * vinculo que decide o que cada mentor enxerga: a fila de avaliacao
 * (entregaService.listarFila) e o direito de avaliar
 * (avaliacaoService.garantirPodeAvaliar) saem daqui.
 */
const mentorRepository = require("../repositories/mentorRepository")
const startupRepository = require("../repositories/startupRepository")
const tenantRepository = require("../repositories/tenantRepository")
const rbacService = require("./rbacService")
const { erroNegocio } = require("../utils/erros")

/** Lista os mentores do tenant com a carga de cada um. */
async function listar(idTenant, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, "startups.mentores.visualizar")
  return mentorRepository.listarPorTenant(idTenant)
}

/**
 * Garante que o usuario alvo e mesmo um mentor DESTE tenant.
 *
 * Sem esta checagem daria para vincular qualquer usuario a uma startup — um
 * incubado, por exemplo — e ele passaria a avaliar as entregas do proprio
 * time, que e exatamente o que o guard de avaliacao existe para impedir.
 */
async function garantirMentorDoTenant(idTenant, idUsuario) {
  const papel = await tenantRepository.buscarPapel(idTenant, idUsuario)
  if (!papel) {
    throw erroNegocio(404, "Usuario nao encontrado nesta incubadora.")
  }
  if (papel !== "mentor") {
    throw erroNegocio(400, "Este usuario nao tem o papel de mentor na incubadora.")
  }
}

/**
 * Garante que a startup existe e pertence ao tenant.
 *
 * O id da startup vem do corpo da requisicao: sem esta checagem, o admin de
 * uma incubadora conseguiria vincular um mentor seu a uma startup de outra.
 */
async function garantirStartupDoTenant(idTenant, idStartup) {
  if (!idStartup) throw erroNegocio(400, "Informe o id_startup.")
  const startup = await startupRepository.buscarPorId(idStartup)
  if (!startup) throw erroNegocio(404, "Startup nao encontrada.")
  if (Number(startup.id_tenant) !== Number(idTenant)) {
    throw erroNegocio(403, "Esta startup e de outra incubadora.")
  }
  return startup
}

/** Startups que o mentor acompanha + as que ainda pode acompanhar. */
async function detalhar(idTenant, idUsuario, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, "startups.mentores.visualizar")
  await garantirMentorDoTenant(idTenant, idUsuario)

  const [startups, disponiveis] = await Promise.all([
    mentorRepository.listarStartupsDoMentor(idTenant, idUsuario),
    mentorRepository.listarStartupsDisponiveis(idTenant, idUsuario),
  ])
  return { startups, disponiveis }
}

/** Vincula um mentor a uma startup. */
async function vincular(idTenant, idUsuario, idStartup, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, "startups.mentores.vincular")
  await garantirMentorDoTenant(idTenant, idUsuario)
  await garantirStartupDoTenant(idTenant, idStartup)

  try {
    return await mentorRepository.vincular(idUsuario, idStartup)
  } catch (err) {
    // 23505 = violacao de PK (o vinculo ja existe).
    if (err.code === "23505") {
      throw erroNegocio(409, "Este mentor ja acompanha esta startup.")
    }
    throw err
  }
}

/**
 * Desvincula um mentor de uma startup.
 *
 * De proposito NAO exige que o usuario ainda tenha papel de mentor: se alguem
 * deixou de ser mentor sem que os vinculos fossem limpos, o admin precisa
 * conseguir remove-los justamente por isso. Exigir o papel aqui prenderia o
 * vinculo que mais interessa desfazer.
 */
async function desvincular(idTenant, idUsuario, idStartup, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, "startups.mentores.desvincular")
  await garantirStartupDoTenant(idTenant, idStartup)

  const vinculo = await mentorRepository.desvincular(idUsuario, idStartup)
  if (!vinculo) throw erroNegocio(404, "Este mentor nao acompanha esta startup.")
  return vinculo
}

/** Mentores de uma startup (visao pela startup). */
async function listarPorStartup(idStartup) {
  const startup = await startupRepository.buscarPorId(idStartup)
  if (!startup) throw erroNegocio(404, "Startup nao encontrada.")
  return mentorRepository.listarPorStartup(idStartup)
}

module.exports = { listar, detalhar, vincular, desvincular, listarPorStartup }
