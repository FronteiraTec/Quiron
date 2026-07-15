/**
 * Service de Entregas (regra de negocio).
 *
 * Alem da entrega simples (texto/arquivo), trata a entrega de QUESTIONARIO:
 * valida as respostas contra a estrutura do questionario (obrigatoriedade,
 * tipo da pergunta e pertencimento das alternativas) e persiste tudo.
 */
const entregaRepository = require("../repositories/entregaRepository")
const tarefaRepository = require("../repositories/tarefaRepository")
const questionarioRepository = require("../repositories/questionarioRepository")
const { erroNegocio } = require("../utils/erros")

const TIPOS_TEXTO = ["TEXTO_CURTO", "PARAGRAFO"]
const TIPOS_ESCOLHA = ["ESCOLHA_UNICA", "CAIXAS_SELECAO"]

/** Lista as entregas de uma startup. */
async function listar(idStartup) {
  if (!idStartup) throw erroNegocio(400, "Informe o id_startup.")
  return entregaRepository.listarPorStartup(idStartup)
}

/** Busca uma entrega pelo id, incluindo suas respostas. */
async function buscar(id) {
  const entrega = await entregaRepository.buscarPorId(id)
  if (!entrega) throw erroNegocio(404, "Entrega nao encontrada.")
  const respostas = await entregaRepository.listarRespostasPorEntrega(id)
  return { ...entrega, respostas }
}

/**
 * Cria uma entrega simples (texto/arquivo). O id_usuario vem do token.
 */
async function criar(dados) {
  const { idTarefa, idStartup, idUsuario } = dados
  if (!idTarefa || !idStartup || !idUsuario) {
    throw erroNegocio(400, "Informe id_tarefa e id_startup.")
  }
  return entregaRepository.criar(dados)
}

/**
 * Registra as respostas de uma tarefa do tipo QUESTIONARIO.
 *
 * @param {object} dados
 * @param {number} dados.idTarefa
 * @param {number} dados.idStartup
 * @param {number} dados.idUsuario - Autor (vem do token).
 * @param {Array<{idPergunta:number, texto?:string, alternativas?:number[]}>} dados.respostas
 * @returns {Promise<object>} A entrega criada.
 */
async function responderQuestionario({ idTarefa, idStartup, idUsuario, respostas }) {
  if (!idTarefa || !idStartup) {
    throw erroNegocio(400, "Informe id_tarefa e id_startup.")
  }

  const tarefa = await tarefaRepository.buscarPorId(idTarefa)
  if (!tarefa) throw erroNegocio(404, "Tarefa nao encontrada.")
  if (tarefa.tipo !== "QUESTIONARIO" || !tarefa.id_questionario) {
    throw erroNegocio(400, "Esta tarefa nao possui questionario.")
  }

  const questionario = await questionarioRepository.buscarPorIdComPerguntas(tarefa.id_questionario)
  if (!questionario) throw erroNegocio(404, "Questionario nao encontrado.")

  // Indexa as respostas recebidas por pergunta para consulta rapida.
  const respostasPorPergunta = new Map()
  for (const r of respostas || []) {
    respostasPorPergunta.set(Number(r.idPergunta), r)
  }

  // Valida cada pergunta e monta as linhas a persistir.
  const linhas = []
  for (const pergunta of questionario.perguntas) {
    const resposta = respostasPorPergunta.get(pergunta.id_pergunta)

    if (TIPOS_TEXTO.includes(pergunta.tipo)) {
      const texto = (resposta?.texto || "").trim()
      if (!texto) {
        if (pergunta.obrigatoria) {
          throw erroNegocio(400, `Responda a pergunta obrigatoria: "${pergunta.pergunta}".`)
        }
        continue // pergunta opcional sem resposta: ignora.
      }
      linhas.push({ idPergunta: pergunta.id_pergunta, textoResposta: texto })
      continue
    }

    if (TIPOS_ESCOLHA.includes(pergunta.tipo)) {
      const marcadas = (resposta?.alternativas || []).map(Number)
      // Escolha unica aceita no maximo uma alternativa marcada.
      if (pergunta.tipo === "ESCOLHA_UNICA" && marcadas.length > 1) {
        throw erroNegocio(400, `A pergunta "${pergunta.pergunta}" aceita apenas uma alternativa.`)
      }
      if (marcadas.length === 0) {
        if (pergunta.obrigatoria) {
          throw erroNegocio(400, `Responda a pergunta obrigatoria: "${pergunta.pergunta}".`)
        }
        continue
      }
      // Cada alternativa marcada precisa pertencer a esta pergunta.
      const idsValidos = new Set(pergunta.alternativas.map((a) => a.id_alternativa))
      for (const idAlt of marcadas) {
        if (!idsValidos.has(idAlt)) {
          throw erroNegocio(400, `Alternativa invalida na pergunta "${pergunta.pergunta}".`)
        }
        linhas.push({ idPergunta: pergunta.id_pergunta, idAlternativa: idAlt })
      }
    }
  }

  if (linhas.length === 0) {
    throw erroNegocio(400, "Nenhuma resposta informada.")
  }

  return entregaRepository.criarComRespostas({
    idTarefa,
    idStartup,
    idUsuario,
    respostas: linhas,
  })
}

module.exports = { listar, buscar, criar, responderQuestionario }
