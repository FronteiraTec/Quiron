/**
 * Validacao e normalizacao dos VALORES dos campos personalizaveis.
 *
 * Mora aqui, e nao dentro do startupService, porque e a metade "runtime" de um
 * par: startupConfigService valida a DEFINICAO do campo (o admin criando um
 * campo monetario), este arquivo valida o VALOR que chega no cadastro de cada
 * startup contra aquela definicao. Sao duas validacoes diferentes sobre a mesma
 * config, e juntar as duas num service so tornaria dificil dizer qual erro veio
 * de onde.
 *
 * O QUE ENTRA NO JSONB
 * Valor ja normalizado por tipo, nunca a string da tela:
 *
 *   TEXTO     -> string
 *   CATEGORIA -> string, e obrigatoriamente uma das opcoes cadastradas
 *   NUMERICO  -> number
 *   DOCUMENTO -> string SEM mascara (so os caracteres uteis). A mascara e
 *                exibicao, como o CNPJ e o celular ja fazem: guardar
 *                "123.456.789-00" faria "12345678900" nao encontrar nada numa
 *                busca futura, e mudar a mascara invalidaria o historico.
 *   MONETARIO -> number, em unidades inteiras da moeda (reais, nao centavos),
 *                arredondado a 2 casas. Number e nao string porque a pergunta
 *                que se faz de um campo monetario e "quanto" — somar, ordenar,
 *                comparar —, e string nao responde nenhuma delas.
 *
 * Campo vazio nao entra no documento: gravar `{ "faturamento": null }` faria
 * `campos_extras ? 'faturamento'` dizer que a startup preencheu quando ela nao
 * preencheu, e e essa a pergunta da contagem de uso antes de desativar um campo.
 */
const { erroNegocio } = require("../utils/erros")

/** Vazio para qualquer tipo: nao preenchido. */
function ehVazio(valor) {
  return valor === null || valor === undefined || (typeof valor === "string" && !valor.trim())
}

/** Remove tudo que nao for digito — o valor cru de um DOCUMENTO numerico. */
function somenteUteis(valor) {
  // Mantem letras e digitos: ha documento alfanumerico (inscricao estadual de
  // algumas UFs, placa, registro). O que sai sao os separadores da mascara.
  return String(valor).replace(/[^0-9A-Za-z]/g, "")
}

/**
 * Converte para numero aceitando os dois formatos que chegam da tela: o
 * numerico puro (12345.67) e o pt-BR ja formatado ("12.345,67").
 *
 * O front manda numero, mas um cadastro vindo de importacao ou de um cliente
 * antigo manda o texto — e ai "1.234" precisa virar 1234, nao 1.234.
 */
function paraNumero(valor) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null
  const texto = String(valor).trim()
  if (!texto) return null

  // Com virgula, o separador decimal e ela e o ponto e milhar (pt-BR).
  const normalizado = texto.includes(",")
    ? texto.replace(/\./g, "").replace(",", ".")
    : texto
  const numero = Number(normalizado)
  return Number.isFinite(numero) ? numero : null
}

/** Arredonda a N casas sem o erro de ponto flutuante do toFixed encadeado. */
function arredondar(numero, casas) {
  const fator = 10 ** casas
  return Math.round(numero * fator) / fator
}

/** Valida um valor contra a definicao do campo e devolve o valor normalizado. */
function normalizarValor(campo, valor) {
  const config = campo.config || {}

  switch (campo.tipo) {
    case "CATEGORIA": {
      const texto = String(valor).trim()
      const opcoes = Array.isArray(config.opcoes) ? config.opcoes : []
      if (!opcoes.some((o) => o.valor === texto)) {
        throw erroNegocio(400, `Opcao invalida em "${campo.rotulo}".`)
      }
      return texto
    }

    case "NUMERICO": {
      const numero = paraNumero(valor)
      if (numero === null) throw erroNegocio(400, `"${campo.rotulo}" precisa ser um numero.`)
      if (config.min !== undefined && config.min !== null && numero < Number(config.min)) {
        throw erroNegocio(400, `"${campo.rotulo}" nao pode ser menor que ${config.min}.`)
      }
      if (config.max !== undefined && config.max !== null && numero > Number(config.max)) {
        throw erroNegocio(400, `"${campo.rotulo}" nao pode ser maior que ${config.max}.`)
      }
      const casas = Number.isInteger(config.casas) ? config.casas : 0
      return arredondar(numero, casas)
    }

    case "MONETARIO": {
      const numero = paraNumero(valor)
      if (numero === null) throw erroNegocio(400, `"${campo.rotulo}" precisa ser um valor monetario.`)
      if (numero < 0) throw erroNegocio(400, `"${campo.rotulo}" nao pode ser negativo.`)
      return arredondar(numero, 2)
    }

    case "DOCUMENTO": {
      const cru = somenteUteis(valor)
      if (!cru) throw erroNegocio(400, `"${campo.rotulo}" nao tem nenhum caractere valido.`)
      // A mascara diz quantas posicoes o documento tem. Conferir o tamanho pega
      // o erro de digitacao ("1234567890" num CPF) antes de virar cadastro
      // errado — e o mesmo servico que cnpjValido presta no front.
      const mascara = typeof config.mascara === "string" ? config.mascara : ""
      const posicoes = (mascara.match(/[#A]/g) || []).length
      if (posicoes && cru.length !== posicoes) {
        throw erroNegocio(
          400,
          `"${campo.rotulo}" deve ter ${posicoes} caracteres (formato ${mascara}).`
        )
      }
      return cru
    }

    default: {
      // TEXTO, e o fallback de qualquer tipo que venha a existir.
      const texto = String(valor).trim()
      if (texto.length > 2000) {
        throw erroNegocio(400, `"${campo.rotulo}" excede o limite de 2000 caracteres.`)
      }
      return texto
    }
  }
}

/**
 * Monta o objeto que vai para `startup.campos_extras`.
 *
 * SO OS CAMPOS DEFINIDOS ENTRAM. O que o cliente mandar fora do catalogo e
 * descartado em silencio, e nao aceito nem recusado: aceitar deixaria qualquer
 * requisicao gravar chave arbitraria dentro do JSONB (o documento e livre por
 * natureza — nenhuma constraint do banco impede), e recusar quebraria o
 * formulario aberto no momento em que o admin desativa um campo.
 *
 * @param {Array} definicoes - campos ATIVOS do tenant (startup_campo).
 * @param {Object} valores - o que veio do formulario, { chave: valor }.
 * @returns {Object} documento normalizado, pronto para o JSONB.
 */
function montarCamposExtras(definicoes, valores) {
  const entrada = valores && typeof valores === "object" ? valores : {}
  const documento = {}

  for (const campo of definicoes) {
    const valor = entrada[campo.chave]

    if (ehVazio(valor)) {
      if (campo.obrigatorio) {
        throw erroNegocio(400, `Preencha o campo "${campo.rotulo}".`)
      }
      continue
    }

    documento[campo.chave] = normalizarValor(campo, valor)
  }

  return documento
}

module.exports = { montarCamposExtras, normalizarValor, paraNumero }
