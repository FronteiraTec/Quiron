/**
 * Service de Questionarios (regra de negocio).
 *
 * Regras principais:
 *  - Apenas ADMIN da incubadora (ou o usuario ROOT) pode criar/alterar
 *    questionarios. A leitura e liberada a qualquer usuario autenticado.
 *  - Um questionario segue a ideia do Google Forms: tem perguntas de tipos
 *    variados (texto curto, paragrafo, escolha unica, caixas de selecao).
 *    Perguntas de escolha exigem ao menos 2 alternativas.
 */
const questionarioRepository = require("../repositories/questionarioRepository")
const tenantRepository = require("../repositories/tenantRepository")
const { erroNegocio } = require("../utils/erros")

// Tipos de pergunta aceitos e quais deles possuem alternativas.
const TIPOS_PERGUNTA = ["TEXTO_CURTO", "PARAGRAFO", "ESCOLHA_UNICA", "CAIXAS_SELECAO"]
const TIPOS_COM_ALTERNATIVAS = ["ESCOLHA_UNICA", "CAIXAS_SELECAO"]

/**
 * Garante que o usuario e admin do tenant (ou root). Lanca 403 caso contrario.
 * @param {number} idTenant
 * @param {{id:number, root?:boolean}} usuario - Payload do token autenticado.
 */
async function garantirAdmin(idTenant, usuario) {
  if (usuario?.root) return // root e super-admin: passa direto.
  const papel = await tenantRepository.buscarPapel(idTenant, usuario?.id)
  if (papel !== "admin") {
    throw erroNegocio(403, "Apenas administradores podem gerenciar questionarios.")
  }
}

/**
 * Valida e normaliza a lista de perguntas recebida do cliente.
 * Devolve as perguntas prontas para persistir (sem campos irrelevantes).
 */
function normalizarPerguntas(perguntas) {
  if (!Array.isArray(perguntas) || perguntas.length === 0) {
    throw erroNegocio(400, "Inclua ao menos uma pergunta no questionario.")
  }

  return perguntas.map((p, indice) => {
    const numero = indice + 1
    const texto = (p.pergunta || "").trim()
    if (!texto) {
      throw erroNegocio(400, `Informe o enunciado da pergunta ${numero}.`)
    }
    if (!TIPOS_PERGUNTA.includes(p.tipo)) {
      throw erroNegocio(400, `Tipo invalido na pergunta ${numero}. Use: ${TIPOS_PERGUNTA.join(", ")}.`)
    }

    const base = { pergunta: texto, tipo: p.tipo, obrigatoria: !!p.obrigatoria }

    // Perguntas de texto nao tem alternativas.
    if (!TIPOS_COM_ALTERNATIVAS.includes(p.tipo)) {
      return { ...base, alternativas: [] }
    }

    // Perguntas de escolha exigem ao menos 2 alternativas com descricao.
    const alternativas = (p.alternativas || [])
      .map((a) => ({ descricao: (a.descricao || "").trim() }))
      .filter((a) => a.descricao)
    if (alternativas.length < 2) {
      throw erroNegocio(400, `A pergunta ${numero} precisa de ao menos 2 alternativas.`)
    }
    return { ...base, alternativas }
  })
}

/** Lista os questionarios de um tenant. */
async function listar(idTenant) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  return questionarioRepository.listarPorTenant(idTenant)
}

/** Busca um questionario com suas perguntas e alternativas. */
async function buscar(id) {
  const questionario = await questionarioRepository.buscarPorIdComPerguntas(id)
  if (!questionario) throw erroNegocio(404, "Questionario nao encontrado.")
  return questionario
}

/**
 * Cria um questionario completo. Exige admin do tenant (ou root).
 * @param {object} dados - { idTenant, titulo, descricao, perguntas }
 * @param {object} usuario - Payload do token (req.usuario).
 */
async function criar(dados, usuario) {
  const { idTenant, titulo, descricao, perguntas } = dados
  if (!idTenant || !titulo || !descricao) {
    throw erroNegocio(400, "Informe id_tenant, titulo e descricao.")
  }
  await garantirAdmin(idTenant, usuario)

  const perguntasNormalizadas = normalizarPerguntas(perguntas)
  return questionarioRepository.criarCompleto({
    idTenant,
    titulo: titulo.trim(),
    descricao: descricao.trim(),
    perguntas: perguntasNormalizadas,
  })
}

/**
 * Ativa/desativa um questionario. Exige admin do tenant do questionario.
 * @param {number} id
 * @param {boolean} ativo
 * @param {object} usuario - Payload do token (req.usuario).
 */
async function alternarAtivo(id, ativo, usuario) {
  const questionario = await questionarioRepository.buscarPorIdComPerguntas(id)
  if (!questionario) throw erroNegocio(404, "Questionario nao encontrado.")
  await garantirAdmin(questionario.id_tenant, usuario)
  return questionarioRepository.alternarAtivo(id, ativo)
}

module.exports = { listar, buscar, criar, alternarAtivo }
