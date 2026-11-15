/**
 * Quem alcanca uma reuniao — as regras que o reuniaoService (a sala) e o
 * reuniaoGravacaoService (gravacao e transcricao) compartilham.
 *
 * Moram aqui, e nao num dos dois, porque um service exigiria o outro e o
 * outro o primeiro (o detalhe da reuniao mostra a gravacao; a gravacao
 * confere a reuniao).
 *
 * Ver o cabecalho do reuniaoService: o convidado sempre ve a propria reuniao;
 * as chaves sao o degrau acima, sobre as reunioes dos outros; e quem nao
 * alcanca recebe 404, nao 403.
 */
const reuniaoRepository = require("../repositories/reuniaoRepository")
const tenantRepository = require("../repositories/tenantRepository")
const rbacService = require("./rbacService")
const { erroNegocio } = require("../utils/erros")

const CHAVES = Object.freeze({
  VISUALIZAR: "reunioes.reunioes.visualizar",
  CRIAR: "reunioes.reunioes.criar",
  EDITAR: "reunioes.reunioes.editar",
  EXCLUIR: "reunioes.reunioes.excluir",
  TRANSCRICOES: "reunioes.transcricoes.visualizar",
  REPROCESSAR: "reunioes.relatorios.reprocessar",
})

/** Quem nao pertence a incubadora nao entra, com chave ou sem. */
async function garantirMembro(idTenant, usuario) {
  if (usuario?.root) return
  const papel = await tenantRepository.buscarPapel(idTenant, usuario?.id)
  if (!papel) throw erroNegocio(403, "Você não pertence a esta incubadora.")
}

async function enxergaTodas(idTenant, usuario) {
  if (usuario?.root) return true
  return rbacService.temPermissao(idTenant, usuario, CHAVES.VISUALIZAR)
}

const ehAnfitriao = (reuniao, usuario) => Number(reuniao.id_anfitriao) === Number(usuario?.id)

/** Anfitriao, ou a chave sobre as reunioes dos outros. */
async function podeComChave(reuniao, usuario, chave) {
  if (ehAnfitriao(reuniao, usuario)) return true
  return rbacService.temPermissao(reuniao.id_tenant, usuario, chave)
}

/**
 * Carrega a reuniao que esta pessoa alcanca, ou 404.
 *
 * O TENANT VEM DA REUNIAO, e nao do pedido: assim nao da para passar o id de
 * uma incubadora onde se tem a chave para abrir a reuniao de outra.
 */
async function carregarVisivel(idReuniao, usuario) {
  const id = Number(idReuniao)
  if (!Number.isInteger(id) || id <= 0) throw erroNegocio(404, "Reunião não encontrada.")

  const reuniao = await reuniaoRepository.buscarPorId(id)
  if (!reuniao) throw erroNegocio(404, "Reunião não encontrada.")

  if (!usuario?.root) {
    const papel = await tenantRepository.buscarPapel(reuniao.id_tenant, usuario?.id)
    if (!papel) throw erroNegocio(404, "Reunião não encontrada.")
  }

  const participante = await reuniaoRepository.buscarParticipante(id, usuario?.id)
  if (!participante && !(await enxergaTodas(reuniao.id_tenant, usuario))) {
    throw erroNegocio(404, "Reunião não encontrada.")
  }
  return { reuniao, participante }
}

module.exports = { CHAVES, garantirMembro, enxergaTodas, ehAnfitriao, podeComChave, carregarVisivel }
