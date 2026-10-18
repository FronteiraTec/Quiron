/**
 * Service de Questionarios (regra de negocio).
 *
 * Regras principais:
 *  - Quem cria/altera questionario e quem tem as chaves
 *    programa.questionarios.criar / .editar; ler exige .visualizar. Root passa
 *    sempre. (Ate 20/07/2026 era "apenas admin do tenant".)
 *  - Um questionario segue a ideia do Google Forms: tem perguntas de tipos
 *    variados (texto curto, paragrafo, escolha unica, caixas de selecao).
 *    Perguntas de escolha exigem ao menos 2 alternativas.
 *  - Um questionario pode ser PROVA (migracao 024): so perguntas de escolha,
 *    cada uma com o gabarito marcado. O gabarito so sai para quem cria/edita
 *    questionarios; quem responde recebe as alternativas sem ele.
 */
const questionarioRepository = require("../repositories/questionarioRepository")
const rbacService = require("./rbacService")
const prova = require("../questionarios/prova")
const { erroNegocio } = require("../utils/erros")

// Tipos de pergunta aceitos e quais deles possuem alternativas.
const TIPOS_PERGUNTA = ["TEXTO_CURTO", "PARAGRAFO", "ESCOLHA_UNICA", "CAIXAS_SELECAO"]
const TIPOS_COM_ALTERNATIVAS = ["ESCOLHA_UNICA", "CAIXAS_SELECAO"]

// O guard de "apenas admin" que ficava aqui foi substituido pelas chaves
// programa.questionarios.* — quem pode gerenciar questionario passou a ser uma
// decisao da role, nao do papel. Ler segue aberto a quem tem "visualizar",
// porque o incubado precisa abrir o questionario para responde-lo (a chave
// esta no conjunto do Colaborador).

/**
 * Valida e normaliza a lista de perguntas recebida do cliente.
 * Devolve as perguntas prontas para persistir (sem campos irrelevantes).
 * Em prova, confere tambem o gabarito; fora dela, `correta` sai sempre FALSE.
 */
function normalizarPerguntas(perguntas, ehProva) {
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
      if (ehProva) prova.validarGabarito(base, numero) // recusa: prova nao tem texto livre
      return { ...base, alternativas: [] }
    }

    // Perguntas de escolha exigem ao menos 2 alternativas com descricao.
    const alternativas = (p.alternativas || [])
      .map((a) => ({ descricao: (a.descricao || "").trim(), correta: ehProva && !!a.correta }))
      .filter((a) => a.descricao)
    if (alternativas.length < 2) {
      throw erroNegocio(400, `A pergunta ${numero} precisa de ao menos 2 alternativas.`)
    }
    const normalizada = { ...base, alternativas }
    if (ehProva) prova.validarGabarito(normalizada, numero)
    return normalizada
  })
}

/**
 * Quem pode ver o gabarito: quem cria ou edita questionarios. O incubado tem
 * so "visualizar" — precisa abrir a prova para faze-la, nao a resposta.
 */
async function podeVerGabarito(idTenant, usuario) {
  return (
    (await rbacService.temPermissao(idTenant, usuario, "programa.questionarios.editar")) ||
    (await rbacService.temPermissao(idTenant, usuario, "programa.questionarios.criar"))
  )
}

/** Lista os questionarios de um tenant. */
async function listar(idTenant, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, "programa.questionarios.visualizar")
  return questionarioRepository.listarPorTenant(idTenant)
}

/**
 * Busca um questionario com suas perguntas e alternativas. Numa prova, o
 * gabarito (alternativa.correta) so vem para quem pode ve-lo.
 */
async function buscar(id, usuario) {
  const questionario = await questionarioRepository.buscarPorIdComPerguntas(id)
  if (!questionario) throw erroNegocio(404, "Questionario nao encontrado.")
  await rbacService.garantirPermissao(
    questionario.id_tenant,
    usuario,
    "programa.questionarios.visualizar"
  )
  if (questionario.prova && !(await podeVerGabarito(questionario.id_tenant, usuario))) {
    return prova.semGabarito(questionario)
  }
  return questionario
}

/**
 * Cria um questionario completo. Exige programa.questionarios.criar.
 * @param {object} dados - { idTenant, titulo, descricao, prova, perguntas }
 * @param {object} usuario - Payload do token (req.usuario).
 */
async function criar(dados, usuario) {
  const { idTenant, titulo, descricao, perguntas } = dados
  if (!idTenant || !titulo || !descricao) {
    throw erroNegocio(400, "Informe id_tenant, titulo e descricao.")
  }
  await rbacService.garantirPermissao(idTenant, usuario, "programa.questionarios.criar")

  const ehProva = !!dados.prova
  const perguntasNormalizadas = normalizarPerguntas(perguntas, ehProva)
  return questionarioRepository.criarCompleto({
    idTenant,
    titulo: titulo.trim(),
    descricao: descricao.trim(),
    prova: ehProva,
    perguntas: perguntasNormalizadas,
  })
}

/**
 * Ativa/desativa um questionario. Exige programa.questionarios.editar.
 * @param {number} id
 * @param {boolean} ativo
 * @param {object} usuario - Payload do token (req.usuario).
 */
async function alternarAtivo(id, ativo, usuario) {
  const questionario = await questionarioRepository.buscarPorIdComPerguntas(id)
  if (!questionario) throw erroNegocio(404, "Questionario nao encontrado.")
  await rbacService.garantirPermissao(
    questionario.id_tenant,
    usuario,
    "programa.questionarios.editar"
  )
  return questionarioRepository.alternarAtivo(id, ativo)
}

module.exports = { listar, buscar, criar, alternarAtivo }
