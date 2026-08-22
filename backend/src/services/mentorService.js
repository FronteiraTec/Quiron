/**
 * Service de Mentores (regra de negocio).
 *
 * Duas coisas moram aqui, e elas sao independentes:
 *
 *   O VINCULO mentor <-> startup, que decide o que cada mentor enxerga: a fila
 *   de avaliacao (entregaService.listarFila) e o direito de avaliar
 *   (avaliacaoService.garantirPodeAvaliar) saem dele.
 *
 *   O CADASTRO do mentor (migracao 016) — vinculo institucional, area,
 *   especialidades, demandas, disponibilidade, formato, status e as
 *   observacoes da coordenacao. Isto e dado descritivo: nada no sistema muda
 *   de comportamento por causa dele. Em especial, mentor com status
 *   "Indisponivel" ou "Inativo" CONTINUA avaliando o que ja e dele — tirar
 *   acesso e assunto de /usuarios, e um filtro de listagem nao pode virar, sem
 *   querer, um botao de revogar login.
 */
const mentorRepository = require("../repositories/mentorRepository")
const startupRepository = require("../repositories/startupRepository")
const tenantRepository = require("../repositories/tenantRepository")
const tenantService = require("./tenantService")
const rbacService = require("./rbacService")
const { normalizarPerfil, normalizarSituacao } = require("../mentores/perfil")
const { erroNegocio } = require("../utils/erros")

/**
 * A janela de "mentorias no periodo", em dias.
 *
 * Existe faixa porque a pergunta muda com a incubadora: um programa trimestral
 * le 90 dias, um anual le 365. O padrao e 90 — um trimestre e o horizonte em
 * que "esse mentor sumiu" ainda e uma informacao acionavel.
 */
const DIAS_PADRAO = 90
const DIAS_MIN = 7
const DIAS_MAX = 730

/** Lista os mentores do tenant: cadastro, carga e historico de mentorias. */
async function listar(idTenant, usuario, dias) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, "startups.mentores.visualizar")

  // O periodo vem da tela (um seletor na barra da tabela). Limitado em vez de
  // recusado: valor fora da faixa e query malformada, nao pedido invalido — e
  // devolver 400 esconderia a lista inteira por causa de um numero.
  const numero = Number(dias)
  const janela = Number.isFinite(numero)
    ? Math.min(DIAS_MAX, Math.max(DIAS_MIN, Math.round(numero)))
    : DIAS_PADRAO

  const mentores = await mentorRepository.listarPorTenant(idTenant, janela)
  // Devolvido junto porque o rotulo da coluna ("Mentorias (90 dias)") tem que
  // dizer a janela que de fato foi usada, e nao a que a tela pediu.
  return { mentores, dias: janela }
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

/**
 * Cria um mentor: a PESSOA e o cadastro dela, numa chamada so.
 *
 * "Mentor" continua sendo o papel 'mentor' em tenant_usuarios — nao ha tabela
 * de mentor onde inserir. Entao cadastrar um mentor e cadastrar um usuario com
 * esse papel, e quem sabe fazer isso e o tenantService: senha provisoria,
 * e-mail unico, vinculo com o tenant e role padrao, tudo na MESMA transacao.
 * Reaproveitar de la, em vez de repetir aqui, e o que impede esta tela de
 * criar mentor sem a role Mentor — que apareceria na listagem, veria o menu de
 * mentor e tomaria 403 em tudo.
 *
 * O PERFIL VAI DEPOIS, fora da transacao, e de proposito: ele e opcional (ver
 * migracao 016). Se falhar, o mentor existe e o cadastro se completa pelo
 * lapis da listagem; o contrario — desfazer a pessoa porque uma observacao nao
 * coube — jogaria fora a senha provisoria ja combinada com ela.
 */
async function criar(idTenant, corpo, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, "startups.mentores.criar")

  // Normaliza o cadastro ANTES de criar a pessoa: um campo invalido tem que
  // barrar tudo, e nao deixar um usuario novo orfao para tras.
  const perfil = normalizarPerfil(corpo)

  const { nome, email, celular, senha } = corpo
  const novo = await tenantService.criarUsuario(
    idTenant,
    { nome, email, celular, senha, papel: "mentor" },
    usuario
  )
  await mentorRepository.salvarPerfil(idTenant, novo.id_usuario, perfil)
  return novo
}

/**
 * Grava o cadastro do mentor.
 *
 * Exige `garantirMentorDoTenant` pelo mesmo motivo do vinculo: sem a checagem,
 * daria para criar perfil de mentor para um incubado — e ele apareceria na
 * listagem de mentores da incubadora sem nunca ter recebido o papel.
 */
async function salvarPerfil(idTenant, idUsuario, corpo, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, "startups.mentores.editar")
  await garantirMentorDoTenant(idTenant, idUsuario)

  return mentorRepository.salvarPerfil(idTenant, idUsuario, normalizarPerfil(corpo))
}

/** So o status — o que a acao em massa da listagem altera. */
async function alterarSituacao(idTenant, idUsuario, situacao, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, "startups.mentores.editar")
  await garantirMentorDoTenant(idTenant, idUsuario)

  return mentorRepository.atualizarSituacao(idTenant, idUsuario, normalizarSituacao(situacao))
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

module.exports = {
  listar,
  criar,
  salvarPerfil,
  alterarSituacao,
  detalhar,
  vincular,
  desvincular,
  listarPorStartup,
}
