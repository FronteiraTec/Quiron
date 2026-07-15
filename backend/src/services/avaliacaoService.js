/**
 * Service de Avaliacoes (regra de negocio).
 */
const avaliacaoRepository = require("../repositories/avaliacaoRepository")
const { erroNegocio } = require("../utils/erros")

const STATUS_VALIDOS = ["APROVADO", "REPROVADO", "AJUSTE"]

/** Lista as avaliacoes de uma entrega. */
async function listar(idEntrega) {
  if (!idEntrega) throw erroNegocio(400, "Informe o id_entrega.")
  return avaliacaoRepository.listarPorEntrega(idEntrega)
}

/**
 * Cria uma avaliacao. O id_avaliador vem do token (usuario autenticado).
 */
async function criar(dados) {
  const { idEntrega, idAvaliador, status } = dados
  if (!idEntrega || !idAvaliador) {
    throw erroNegocio(400, "Informe o id_entrega.")
  }
  if (!STATUS_VALIDOS.includes(status)) {
    throw erroNegocio(400, `Status invalido. Use: ${STATUS_VALIDOS.join(", ")}.`)
  }
  return avaliacaoRepository.criar(dados)
}

module.exports = { listar, criar }
