/**
 * Validacao e normalizacao da DEFINICAO de um campo personalizavel — a metade
 * "admin" do par cujo runtime e campos/valores.js.
 *
 * GENERICO DE PROPOSITO, pelo mesmo motivo do outro arquivo: a incubadora
 * define campos no cadastro de startup (startup_campo) e na gestao de tarefas
 * (tarefa_campo), e as duas coisas sao o mesmo problema — "que tipos existem, o
 * que a config de cada um precisa ter, e como se deriva uma chave estavel a
 * partir do nome que a pessoa digitou". Este arquivo nasceu de dentro do
 * startupConfigService, no dia em que o segundo modulo precisou das mesmas
 * respostas: uma copia garantiria que uma correcao entrasse em uma e faltasse
 * na outra.
 *
 * O QUE ELE NAO FAZ: falar com o banco. `chaveDisponivel` recebe a funcao de
 * busca de quem chama, porque a tabela e que muda de modulo para modulo.
 */
const { erroNegocio } = require("../utils/erros")

/**
 * Os tipos de campo personalizavel que o sistema aceita.
 *
 * Lista fechada porque cada tipo tem renderizacao propria no front e validacao
 * propria no back — um tipo desconhecido nao viraria campo nenhum, viraria
 * tela quebrada.
 *
 *   TEXTO     -> texto livre (uma linha ou varias, conforme config.multilinha)
 *   CATEGORIA -> escolha entre as opcoes cadastradas (config.opcoes)
 *   NUMERICO  -> numero, com config.min / config.max / config.casas opcionais
 *   DOCUMENTO -> texto com MASCARA definida pela incubadora (config.mascara)
 *   MONETARIO -> valor em dinheiro, guardado como numero (config.moeda)
 *
 * E o enum campoTipo do banco, compartilhado pelas duas tabelas de definicao.
 */
const TIPOS_CAMPO = ["TEXTO", "CATEGORIA", "NUMERICO", "DOCUMENTO", "MONETARIO"]

const HEX = /^#[0-9a-fA-F]{6}$/
const CHAVE_VALIDA = /^[A-Z0-9_]{1,40}$/

/**
 * Deriva a chave a partir do rotulo: "Em tracao" -> "EM_TRACAO".
 *
 * A chave e o que fica gravado em cada registro e nunca muda; o rotulo e o que
 * a incubadora ve e reescreve a vontade. Gerar uma da outra poupa quem cadastra
 * de entender essa distincao — ele so digita o nome.
 */
function gerarChave(rotulo) {
  return rotulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40)
}

/**
 * Uma chave livre no tenant. Se "PARCEIRA" ja existe (mesmo desativada, porque
 * a PK nao liga para o `ativo`), tenta PARCEIRA_2, _3...
 *
 * @param {number} idTenant
 * @param {string} base - a chave derivada do rotulo.
 * @param {(idTenant:number, chave:string) => Promise<any>} buscar - a consulta
 *   do modulo que chama; e ela que sabe em que tabela procurar.
 */
async function chaveDisponivel(idTenant, base, buscar) {
  let candidata = base
  let n = 2
  while (await buscar(idTenant, candidata)) {
    const sufixo = "_" + n
    candidata = base.slice(0, 40 - sufixo.length) + sufixo
    n += 1
  }
  return candidata
}

/** O rotulo precisa existir, caber na coluna e gerar uma chave utilizavel. */
function validarRotulo(rotulo, limite, oQue) {
  if (!rotulo || !rotulo.trim()) throw erroNegocio(400, `Informe o nome ${oQue}.`)
  if (rotulo.trim().length > limite) {
    throw erroNegocio(400, `O nome ${oQue} deve ter no maximo ${limite} caracteres.`)
  }
}

function validarCor(cor) {
  if (cor && !HEX.test(cor)) throw erroNegocio(400, "Cor invalida. Use hexadecimal, como #6366f1.")
}

/**
 * A chave derivada de um rotulo, ja conferida.
 *
 * Rotulo so de simbolos ("###") gera chave vazia, que a PK aceitaria como
 * string vazia e o resto do sistema trataria como item sem nome.
 *
 * @param {string} rotulo - ja aparado.
 * @param {string} oQue - como o erro se refere ao item ("do tipo", "do campo").
 */
function chaveDoRotulo(rotulo, oQue) {
  const base = gerarChave(rotulo)
  if (!CHAVE_VALIDA.test(base)) {
    throw erroNegocio(400, `O nome ${oQue} precisa ter ao menos uma letra ou numero.`)
  }
  return base
}

/** O tipo informado existe? */
function validarTipoCampo(tipo) {
  if (!TIPOS_CAMPO.includes(tipo)) {
    throw erroNegocio(400, `Tipo de campo invalido. Use: ${TIPOS_CAMPO.join(", ")}.`)
  }
}

/**
 * Valida a `config` de um campo contra o seu tipo, e devolve so o que aquele
 * tipo usa.
 *
 * FILTRAR, e nao so validar: sem isso a config de um campo que ja foi
 * CATEGORIA e virou outra coisa carregaria `opcoes` para sempre, e a proxima
 * pessoa a ler o JSON nao saberia dizer o que vale.
 */
function normalizarConfig(tipo, config) {
  const entrada = config && typeof config === "object" ? config : {}

  if (tipo === "CATEGORIA") {
    const opcoes = Array.isArray(entrada.opcoes) ? entrada.opcoes : []
    const limpas = opcoes
      .map((o) => ({
        valor: String(o?.valor ?? o?.rotulo ?? "").trim(),
        rotulo: String(o?.rotulo ?? o?.valor ?? "").trim(),
      }))
      .filter((o) => o.valor && o.rotulo)

    if (limpas.length === 0) {
      throw erroNegocio(400, "Um campo de categoria precisa de ao menos uma opcao.")
    }
    // Opcoes com o mesmo valor sao indistinguiveis na hora de gravar: as duas
    // gravariam a mesma string e uma delas nunca poderia ser selecionada de
    // volta ao abrir o cadastro.
    const vistos = new Set()
    for (const o of limpas) {
      if (vistos.has(o.valor)) {
        throw erroNegocio(400, `A opcao "${o.valor}" esta repetida.`)
      }
      vistos.add(o.valor)
    }
    return { opcoes: limpas }
  }

  if (tipo === "DOCUMENTO") {
    const mascara = String(entrada.mascara ?? "").trim()
    if (!mascara) {
      throw erroNegocio(400, "Um campo de documento precisa de uma mascara. Ex.: ###.###.###-##")
    }
    if (mascara.length > 40) {
      throw erroNegocio(400, "A mascara deve ter no maximo 40 caracteres.")
    }
    // '#' = digito, 'A' = letra ou digito. Sem nenhum dos dois a "mascara" e
    // texto fixo e o campo nao aceitaria nada.
    if (!/[#A]/.test(mascara)) {
      throw erroNegocio(400, "Use # para digito e A para letra ou digito. Ex.: ###.###.###-##")
    }
    return { mascara }
  }

  if (tipo === "NUMERICO") {
    const saida = {}
    if (entrada.min !== undefined && entrada.min !== null && entrada.min !== "") {
      saida.min = Number(entrada.min)
    }
    if (entrada.max !== undefined && entrada.max !== null && entrada.max !== "") {
      saida.max = Number(entrada.max)
    }
    if (saida.min !== undefined && !Number.isFinite(saida.min)) {
      throw erroNegocio(400, "O minimo precisa ser um numero.")
    }
    if (saida.max !== undefined && !Number.isFinite(saida.max)) {
      throw erroNegocio(400, "O maximo precisa ser um numero.")
    }
    if (saida.min !== undefined && saida.max !== undefined && saida.min > saida.max) {
      throw erroNegocio(400, "O minimo nao pode ser maior que o maximo.")
    }
    const casas = Number(entrada.casas ?? 0)
    if (!Number.isInteger(casas) || casas < 0 || casas > 6) {
      throw erroNegocio(400, "As casas decimais devem ser um inteiro entre 0 e 6.")
    }
    saida.casas = casas
    const sufixo = String(entrada.sufixo ?? "").trim()
    if (sufixo) saida.sufixo = sufixo.slice(0, 10)
    return saida
  }

  if (tipo === "MONETARIO") {
    const moeda = String(entrada.moeda ?? "BRL").trim().toUpperCase()
    if (!/^[A-Z]{3}$/.test(moeda)) {
      throw erroNegocio(400, "A moeda deve ser o codigo de tres letras, como BRL ou USD.")
    }
    return { moeda }
  }

  // TEXTO.
  return entrada.multilinha ? { multilinha: true } : {}
}

module.exports = {
  TIPOS_CAMPO,
  HEX,
  CHAVE_VALIDA,
  gerarChave,
  chaveDisponivel,
  chaveDoRotulo,
  validarRotulo,
  validarCor,
  validarTipoCampo,
  normalizarConfig,
}
