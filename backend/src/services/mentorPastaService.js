/**
 * Service das PASTAS da biblioteca pessoal do mentor (migracao 025).
 *
 * A regra de acesso e a mesma do material (mentorMaterialService): a pasta e
 * do dono, e para qualquer outra pessoa — inclusive o admin — uma pasta alheia
 * responde 404. A chave `mentoria.materiais.gerenciar` diz quem tem biblioteca;
 * nao ha chave que abra a de outra pessoa.
 *
 * Pasta e so organizacao: criar, renomear, mover e excluir nao mudam o que uma
 * startup ve. Por isso excluir uma pasta nunca apaga material — o que estava
 * dentro sobe para a pasta de cima (mentorPastaRepository.excluir).
 */
const mentorPastaRepository = require("../repositories/mentorPastaRepository")
const tenantRepository = require("../repositories/tenantRepository")
const rbacService = require("./rbacService")
const auditLogService = require("./auditLogService")
const { GERENCIAR } = require("./mentorMaterialService")
const {
  nomePasta,
  idPastaOuRaiz,
  normalizarMovimento,
  conferirMovimento,
} = require("../mentores/pastas")
const { erroNegocio } = require("../utils/erros")

const NOME_REPETIDO = "Ja existe uma pasta com esse nome aqui."

/** Carrega a pasta e exige que ela seja de quem pede (o tenant sai da pasta). */
async function carregarDoDono(idPasta, usuario) {
  const id = Number(idPasta)
  const pasta = Number.isInteger(id) && id > 0 ? await mentorPastaRepository.buscarPorId(id) : null
  if (!pasta || Number(pasta.id_mentor) !== Number(usuario?.id)) {
    throw erroNegocio(404, "Pasta nao encontrada.")
  }
  await rbacService.garantirPermissao(pasta.id_tenant, usuario, GERENCIAR)
  return pasta
}

/** Uma pasta-mae informada tem de ser do mesmo dono, na mesma incubadora. */
async function exigirPastaDoDono(idPasta, idTenant, usuario) {
  if (idPasta === null) return null
  const pasta = await mentorPastaRepository.buscarPorId(idPasta)
  if (!pasta || Number(pasta.id_mentor) !== Number(usuario.id) || Number(pasta.id_tenant) !== Number(idTenant)) {
    throw erroNegocio(404, "Pasta nao encontrada.")
  }
  return pasta
}

/** POST /espaco-mentor/pastas — body: id_tenant, nome, id_pasta_pai */
async function criar(idTenant, corpo = {}, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, GERENCIAR)

  // Como no material: o root passa em toda chave, mas nao tem vinculo — nem
  // biblioteca onde criar a pasta.
  const papel = await tenantRepository.buscarPapel(idTenant, usuario.id)
  if (!papel) throw erroNegocio(403, "Voce nao pertence a esta incubadora.")

  const nome = nomePasta(corpo.nome)
  const idPastaPai = idPastaOuRaiz(corpo.id_pasta_pai)
  await exigirPastaDoDono(idPastaPai, idTenant, usuario)

  let pasta
  try {
    pasta = await mentorPastaRepository.criar({ idTenant, idMentor: usuario.id, idPastaPai, nome })
  } catch (err) {
    if (err.code === "23505") throw erroNegocio(409, NOME_REPETIDO)
    if (err.code === "23503" && err.constraint === "fk_mentor_pasta_pai") {
      throw erroNegocio(404, "Pasta nao encontrada.")
    }
    throw err
  }

  await auditLogService.registrar({
    idTenant: Number(idTenant),
    idUsuario: usuario.id,
    acao: "CRIAR",
    entidade: "mentor_pasta",
    entidadeId: String(pasta.id_pasta),
    descricao: `Criou a pasta "${pasta.nome}" na biblioteca pessoal.`,
    dadosDepois: pasta,
  })
  return pasta
}

/** PATCH /espaco-mentor/pastas/:id — body: nome. Mover e por POST /mover. */
async function renomear(idPasta, corpo = {}, usuario) {
  const atual = await carregarDoDono(idPasta, usuario)
  const nome = nomePasta(corpo.nome)
  if (nome === atual.nome) return atual

  let pasta
  try {
    pasta = await mentorPastaRepository.renomear(atual.id_pasta, nome)
  } catch (err) {
    if (err.code === "23505") throw erroNegocio(409, NOME_REPETIDO)
    throw err
  }

  await auditLogService.registrar({
    idTenant: atual.id_tenant,
    idUsuario: usuario.id,
    acao: "EDITAR",
    entidade: "mentor_pasta",
    entidadeId: String(atual.id_pasta),
    descricao: `Renomeou a pasta "${atual.nome}" para "${pasta.nome}" na biblioteca pessoal.`,
    dadosAntes: atual,
    dadosDepois: pasta,
  })
  return pasta
}

/** DELETE /espaco-mentor/pastas/:id — o conteudo sobe para a pasta de cima. */
async function excluir(idPasta, usuario) {
  const pasta = await carregarDoDono(idPasta, usuario)
  const resultado = await mentorPastaRepository.excluir(pasta.id_pasta)
  if (!resultado.excluida) throw erroNegocio(404, "Pasta nao encontrada.")

  await auditLogService.registrar({
    idTenant: pasta.id_tenant,
    idUsuario: usuario.id,
    acao: "EXCLUIR",
    entidade: "mentor_pasta",
    entidadeId: String(pasta.id_pasta),
    descricao:
      `Excluiu a pasta "${pasta.nome}" da biblioteca pessoal ` +
      `(${resultado.materiaisMovidos} material(is) e ${resultado.pastasMovidas} pasta(s) foram para a pasta de cima).`,
    dadosAntes: pasta,
  })
  return resultado
}

/**
 * POST /espaco-mentor/mover — body: id_tenant, destino (null = raiz), pastas[], materiais[].
 *
 * Tudo ou nada: arrastar a selecao para uma pasta e UM gesto, e metade dela
 * movida seria pior do que nenhuma. Um id que nao e do dono derruba o
 * movimento inteiro com 404, sem dizer qual — como o material alheio.
 */
async function mover(idTenant, corpo = {}, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, GERENCIAR)

  const movimento = normalizarMovimento(corpo)
  const { materiaisEncontrados } = await mentorPastaRepository.mover(
    { idTenant: Number(idTenant), idMentor: usuario.id, ...movimento },
    (pastasDoDono) => conferirMovimento(pastasDoDono, movimento)
  )
  if (materiaisEncontrados !== movimento.materiais.length) {
    throw erroNegocio(404, "Material nao encontrado.")
  }

  await auditLogService.registrar({
    idTenant: Number(idTenant),
    idUsuario: usuario.id,
    acao: "MOVER",
    entidade: "mentor_pasta",
    entidadeId: movimento.destino === null ? null : String(movimento.destino),
    descricao:
      `Moveu ${movimento.materiais.length} material(is) e ${movimento.pastas.length} pasta(s) ` +
      `${movimento.destino === null ? "para a raiz" : "de pasta"} na biblioteca pessoal.`,
    dadosDepois: movimento,
  })
  return { movido: true, ...movimento }
}

module.exports = { criar, renomear, excluir, mover }
