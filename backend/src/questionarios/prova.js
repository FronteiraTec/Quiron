/**
 * Questionario no modo PROVA: o gabarito e a correcao (migracao 024).
 *
 * Prova e questionario de assinalar. Cada pergunta e de escolha (unica ou
 * caixas de selecao) e marca quais alternativas estao certas; a entrega da
 * startup e corrigida sozinha contra esse gabarito.
 *
 * REGRA DE PONTUACAO: cada pergunta vale um ponto, e o ponto e tudo ou nada.
 * Nas caixas de selecao, acerta quem marca EXATAMENTE as corretas — marcar uma
 * a mais ou deixar uma de fora erra a pergunta inteira. Sem isso, marcar todas
 * as caixas garantiria o ponto. Pergunta deixada em branco conta como erro.
 *
 * Funcoes puras: nada aqui consulta o banco.
 */
const { erroNegocio } = require("../utils/erros")

/** Tipos de pergunta que uma prova aceita — os que tem alternativas. */
const TIPOS_PROVA = ["ESCOLHA_UNICA", "CAIXAS_SELECAO"]

/**
 * Confere o gabarito de uma pergunta de prova ja normalizada (alternativas com
 * `correta` booleano). Escolha unica pede exatamente uma correta; caixas de
 * selecao, ao menos uma.
 * @param {{tipo:string, alternativas:Array<{correta:boolean}>}} pergunta
 * @param {number} numero - Posicao da pergunta, para a mensagem de erro.
 */
function validarGabarito(pergunta, numero) {
  if (!TIPOS_PROVA.includes(pergunta.tipo)) {
    throw erroNegocio(
      400,
      `Em uma prova, a pergunta ${numero} precisa ser de escolha unica ou caixas de selecao.`
    )
  }
  const corretas = pergunta.alternativas.filter((a) => a.correta).length
  if (pergunta.tipo === "ESCOLHA_UNICA" && corretas !== 1) {
    throw erroNegocio(400, `Marque uma unica alternativa correta na pergunta ${numero}.`)
  }
  if (pergunta.tipo === "CAIXAS_SELECAO" && corretas === 0) {
    throw erroNegocio(400, `Marque ao menos uma alternativa correta na pergunta ${numero}.`)
  }
}

/**
 * Corrige uma entrega contra o gabarito.
 *
 * @param {Array<{id_pergunta:number, pergunta:string,
 *          alternativas:Array<{id_alternativa:number, descricao:string, correta:boolean}>}>} perguntas
 *   As perguntas da prova, COM o gabarito (questionarioRepository.buscarPorIdComPerguntas).
 * @param {Map<number, number[]>} marcadasPorPergunta - id_pergunta -> ids das alternativas marcadas.
 * @returns {{acertos:number, total:number, perguntas:Array<{id_pergunta:number,
 *          pergunta:string, acertou:boolean, corretas:number[], gabarito:string[]}>}}
 *   `corretas` e `gabarito` entregam a resposta certa: so vao para quem avalia
 *   (ver `resumoParaQuemResponde`).
 */
function corrigir(perguntas, marcadasPorPergunta) {
  const porPergunta = perguntas.map((p) => {
    const certas = p.alternativas.filter((a) => a.correta)
    const marcadas = new Set(marcadasPorPergunta.get(p.id_pergunta) || [])
    const acertou =
      certas.length > 0 &&
      marcadas.size === certas.length &&
      certas.every((a) => marcadas.has(a.id_alternativa))
    return {
      id_pergunta: p.id_pergunta,
      pergunta: p.pergunta,
      acertou,
      corretas: certas.map((a) => a.id_alternativa),
      gabarito: certas.map((a) => a.descricao),
    }
  })

  return {
    acertos: porPergunta.filter((p) => p.acertou).length,
    total: porPergunta.length,
    perguntas: porPergunta,
  }
}

/**
 * O resultado como a startup pode ve-lo: quantas acertou e quais perguntas
 * errou, sem dizer qual era a alternativa certa. O gabarito fica com quem
 * avalia — outra startup da mesma incubadora ainda vai fazer esta prova.
 */
function resumoParaQuemResponde(resultado) {
  return {
    acertos: resultado.acertos,
    total: resultado.total,
    perguntas: resultado.perguntas.map(({ id_pergunta, acertou }) => ({ id_pergunta, acertou })),
  }
}

/** O questionario sem o gabarito, para quem vai responder. */
function semGabarito(questionario) {
  return {
    ...questionario,
    perguntas: questionario.perguntas.map((p) => ({
      ...p,
      alternativas: p.alternativas.map(({ correta, ...resto }) => resto),
    })),
  }
}

module.exports = { TIPOS_PROVA, validarGabarito, corrigir, resumoParaQuemResponde, semGabarito }
