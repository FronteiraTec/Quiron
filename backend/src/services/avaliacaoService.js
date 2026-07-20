/**
 * Service de Avaliacoes (regra de negocio).
 */
const avaliacaoRepository = require("../repositories/avaliacaoRepository")
const entregaRepository = require("../repositories/entregaRepository")
const startupRepository = require("../repositories/startupRepository")
const tenantRepository = require("../repositories/tenantRepository")
const rbacService = require("./rbacService")
const { erroNegocio } = require("../utils/erros")

const STATUS_VALIDOS = ["APROVADO", "REPROVADO", "AJUSTE"]

/** Lista as avaliacoes de uma entrega. */
async function listar(idEntrega) {
  if (!idEntrega) throw erroNegocio(400, "Informe o id_entrega.")
  return avaliacaoRepository.listarPorEntrega(idEntrega)
}

/**
 * Historico de devolutivas do usuario logado (tela "Feedback" do mentor).
 * @param {number} idTenant
 * @param {number} idUsuario
 */
async function listarMinhas(idTenant, idUsuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  return avaliacaoRepository.listarPorAvaliador(idTenant, idUsuario)
}

/**
 * Todas as devolutivas do tenant (tela "Avaliacoes" do admin).
 *
 * Exige avaliacoes.avaliacoes.visualizar: e a visao sobre o trabalho dos
 * mentores, nao sobre o proprio. O mentor tem /feedback, que so traz o que ele
 * respondeu (listarMinhas) e nao pede chave nenhuma.
 */
async function listarDoTenant(idTenant, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, "avaliacoes.avaliacoes.visualizar")
  return avaliacaoRepository.listarPorTenant(idTenant)
}

/**
 * Garante que o usuario pode avaliar esta entrega.
 *
 * O JWT nao carrega o papel (ver auth.js / utils/jwt.js), entao o guard mora
 * aqui. Sao duas perguntas independentes, e as duas precisam ser sim:
 *
 *   1. Pode responder entregas?  a chave "avaliacoes.avaliacoes.avaliar".
 *   2. Pode responder ESTA?      precisa acompanhar a startup (mentor_startup).
 *
 * Separar as duas importa: a permissao diz o QUE a pessoa faz, o vinculo diz
 * PARA QUEM. Ser MEMBRO da startup nunca vale — seria o time aprovando a
 * propria entrega.
 *
 * @param {object} entrega - linha da tabela entrega (id_startup).
 * @param {{id:number, root?:boolean}} usuario - autenticado.
 */
async function garantirPodeAvaliar(entrega, usuario) {
  if (usuario.root) return

  const startup = await startupRepository.buscarPorId(entrega.id_startup)
  if (!startup) throw erroNegocio(404, "Startup da entrega nao encontrada.")

  const idTenant = startup.id_tenant

  // 1. Pode responder entregas?
  //
  // Ate a migracao 005 esta pergunta tinha tres respostas possiveis (papel
  // admin, papel mentor, ou a chave RBAC) porque a permissao apenas ESTENDIA o
  // papel. Agora e uma so: a chave. Quem administra a incubadora continua
  // passando porque a role Administrador tem todas as chaves — nao por ser
  // admin.
  await rbacService.garantirPermissao(idTenant, usuario, "avaliacoes.avaliacoes.avaliar")

  // 2. Pode responder ESTA?
  //
  // Eixo independente do primeiro, e por isso nao virou chave: a permissao diz
  // O QUE a pessoa faz, `mentor_startup` diz PARA QUEM. Sem esta segunda
  // pergunta, quem tem a chave avaliaria a startup de qualquer colega.
  //
  // O admin passa direto: ele responde pela incubadora inteira e nao esta em
  // mentor_startup de ninguem — exigir o vinculo dele travaria a fila que a
  // propria tela de Entregas mostra a ele.
  const papel = await tenantRepository.buscarPapel(idTenant, usuario.id)
  if (papel === "admin") return

  const ehMentor = await startupRepository.ehMentorDe(entrega.id_startup, usuario.id)
  if (!ehMentor) throw erroNegocio(403, "Voce nao acompanha esta startup.")
}

/**
 * Cria uma avaliacao. O avaliador vem do token (usuario autenticado).
 * @param {{idEntrega, status, nota, comentario}} dados
 * @param {{id:number, root?:boolean}} usuario - autenticado.
 */
async function criar(dados, usuario) {
  const { idEntrega, status, nota, comentario } = dados
  if (!idEntrega) throw erroNegocio(400, "Informe o id_entrega.")
  if (!STATUS_VALIDOS.includes(status)) {
    throw erroNegocio(400, `Status invalido. Use: ${STATUS_VALIDOS.join(", ")}.`)
  }

  const entrega = await entregaRepository.buscarPorId(idEntrega)
  if (!entrega) throw erroNegocio(404, "Entrega nao encontrada.")
  // Rascunho ainda nao foi submetido: nao ha o que avaliar.
  if (entrega.status !== "ENVIADA") {
    throw erroNegocio(400, "Esta entrega ainda nao foi enviada.")
  }

  await garantirPodeAvaliar(entrega, usuario)

  // Pedir ajuste sem dizer o que ajustar devolve a startup ao ponto de partida.
  if (status === "AJUSTE" && !(comentario || "").trim()) {
    throw erroNegocio(400, "Explique no comentario o que precisa ser ajustado.")
  }

  return avaliacaoRepository.criar({
    idEntrega,
    idAvaliador: usuario.id,
    status,
    nota,
    comentario,
  })
}

module.exports = { listar, listarMinhas, listarDoTenant, criar }
