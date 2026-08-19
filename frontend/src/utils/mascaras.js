/**
 * Mascaras dos campos de contato e documento (pt-BR): celular e CNPJ.
 *
 * O banco guarda os dois campos SEM formatacao: `startup.cnpj` e CHAR(14) e
 * nao comporta a mascara (18 caracteres), e `celular` e VARCHAR(15) — que a
 * mascara de celular ocupa inteiro, sem folga. Entao a mascara e so de tela:
 * o formulario mostra formatado, envia ao backend so os digitos, e a leitura
 * passa por `formatarCelular` / `formatarCnpj`.
 *
 * As funcoes de mascara reconstroem o texto a partir dos digitos a cada
 * tecla. E isso que faz o backspace funcionar: apagar um separador apaga o
 * digito que vem antes dele, em vez de deixar o cursor preso no separador.
 */

/** Remove tudo que nao for digito. */
export function somenteDigitos(valor) {
  return String(valor ?? "").replace(/\D/g, "")
}

/** Tamanho do texto ja mascarado — vira o `maxLength` do campo. */
export const MAX_CELULAR = 15 // (11) 98765-4321
export const MAX_CNPJ = 18 // 12.345.678/0001-95

/**
 * Mascara de celular: "(11) 98765-4321". Aceita tambem o fixo de 8 digitos,
 * "(11) 3456-7890". Digitos alem do 11o sao descartados, o que limita o
 * campo mesmo quando o valor chega colado.
 */
export function mascararCelular(valor) {
  let digitos = somenteDigitos(valor)

  // Numero colado com o codigo do pais ("+55 11 98765-4321"): o 55 da frente
  // so e descartado quando sobra numero demais — 55 tambem e DDD (RS).
  if (digitos.length > 11 && digitos.startsWith("55")) digitos = digitos.slice(2)

  digitos = digitos.slice(0, 11)
  if (digitos.length <= 2) return digitos ? `(${digitos}` : ""

  // O hifen cai depois de 4 digitos no fixo e de 5 no celular.
  const corte = digitos.length <= 10 ? 6 : 7
  if (digitos.length <= corte) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, corte)}-${digitos.slice(corte)}`
}

/** Mascara de CNPJ: "12.345.678/0001-95". Descarta digitos alem do 14o. */
export function mascararCnpj(valor) {
  const digitos = somenteDigitos(valor).slice(0, 14)

  let saida = digitos.slice(0, 2)
  if (digitos.length > 2) saida += `.${digitos.slice(2, 5)}`
  if (digitos.length > 5) saida += `.${digitos.slice(5, 8)}`
  if (digitos.length > 8) saida += `/${digitos.slice(8, 12)}`
  if (digitos.length > 12) saida += `-${digitos.slice(12)}`
  return saida
}

/** True quando o celular tem DDD + 8 (fixo) ou 9 (movel) digitos. */
export function celularValido(valor) {
  const digitos = somenteDigitos(valor)
  return (digitos.length === 10 || digitos.length === 11) && Number(digitos.slice(0, 2)) >= 11
}

/**
 * Valida o CNPJ pelos dois digitos verificadores (modulo 11).
 *
 * So o tamanho nao basta: o par de digitos verificadores e barato de
 * conferir aqui e pega o erro de digitacao antes de virar cadastro errado.
 */
export function cnpjValido(valor) {
  const digitos = somenteDigitos(valor)
  if (digitos.length !== 14) return false

  // Sequencias repetidas ("00000000000000") passam no modulo 11, mas nao existem.
  if (/^(\d)\1{13}$/.test(digitos)) return false

  // Pesos 2..9 ciclicos, da direita para a esquerda.
  const verificador = (base) => {
    let soma = 0
    let peso = 2
    for (let i = base.length - 1; i >= 0; i--) {
      soma += Number(base[i]) * peso
      peso = peso === 9 ? 2 : peso + 1
    }
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }

  return (
    verificador(digitos.slice(0, 12)) === Number(digitos[12]) &&
    verificador(digitos.slice(0, 13)) === Number(digitos[13])
  )
}

/**
 * Formata um celular vindo do banco para leitura.
 *
 * Cadastros antigos foram gravados como texto livre — o que nao tiver 10 ou
 * 11 digitos volta como esta, em vez de virar uma mascara torta.
 */
export function formatarCelular(valor) {
  if (!valor) return ""
  const digitos = somenteDigitos(valor)
  if (digitos.length !== 10 && digitos.length !== 11) return String(valor).trim()
  return mascararCelular(digitos)
}

/** Formata um CNPJ vindo do banco para leitura (CHAR(14) vem com padding). */
export function formatarCnpj(valor) {
  if (!valor) return ""
  const digitos = somenteDigitos(valor)
  if (digitos.length !== 14) return String(valor).trim()
  return mascararCnpj(digitos)
}

// ---------------------------------------------------------------------------
// CEP
// ---------------------------------------------------------------------------

/** Tamanho do CEP ja mascarado — vira o `maxLength` do campo. */
export const MAX_CEP = 9 // 01310-100

/** Mascara de CEP: "01310-100". Descarta digitos alem do 8o. */
export function mascararCep(valor) {
  const d = somenteDigitos(valor).slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

/** True quando o CEP tem os 8 digitos — o gatilho da consulta ao ViaCEP. */
export function cepValido(valor) {
  return somenteDigitos(valor).length === 8
}

/** Formata um CEP vindo do banco para leitura (CHAR(8) vem com padding). */
export function formatarCep(valor) {
  if (!valor) return ""
  const d = somenteDigitos(valor)
  return d.length === 8 ? mascararCep(d) : String(valor).trim()
}

// ---------------------------------------------------------------------------
// MASCARA GENERICA — a dos campos personalizaveis do tipo DOCUMENTO
// ---------------------------------------------------------------------------

/**
 * Aplica uma mascara escrita pela propria incubadora.
 *
 * Vocabulario minimo de proposito: `#` aceita digito, `A` aceita letra ou
 * digito, e qualquer outro caractere e separador literal. Duas regras cabem na
 * dica de um campo de texto ("Ex.: ###.###.###-##"); um mini-DSL com quantifi-
 * cadores nao caberia, e quem cadastra o campo nao e programador.
 *
 * Reconstroi a saida a partir dos caracteres uteis a cada tecla, como as demais
 * mascaras deste arquivo — e o que faz o backspace apagar o digito antes do
 * separador em vez de prender o cursor nele.
 */
export function aplicarMascara(valor, mascara) {
  const cru = String(valor ?? "").replace(/[^0-9A-Za-z]/g, "")
  if (!mascara) return cru

  let saida = ""
  let i = 0

  for (const simbolo of mascara) {
    if (i >= cru.length) break

    if (simbolo === "#") {
      // Letra digitada numa posicao de digito e descartada, nao empurrada para
      // a proxima: em "###.###" o que se espera de "12a3" e "123", nao "12a".
      while (i < cru.length && !/\d/.test(cru[i])) i += 1
      if (i >= cru.length) break
      saida += cru[i]
      i += 1
    } else if (simbolo === "A") {
      saida += cru[i]
      i += 1
    } else {
      saida += simbolo
    }
  }

  return saida
}

/** Quantas posicoes preenchiveis a mascara tem — o `maxLength` sai do total. */
export function posicoesDaMascara(mascara) {
  return (String(mascara ?? "").match(/[#A]/g) || []).length
}

/** Tira a mascara: so o que o banco guarda. */
export function desmascarar(valor) {
  return String(valor ?? "").replace(/[^0-9A-Za-z]/g, "")
}

// ---------------------------------------------------------------------------
// MONETARIO — os campos personalizaveis do tipo MONETARIO
// ---------------------------------------------------------------------------

/**
 * Mascara de digitacao de dinheiro: os digitos entram pela DIREITA, como numa
 * calculadora ("1" -> 0,01; "12" -> 0,12; "123" -> 1,23).
 *
 * E o unico jeito que nao exige do usuario acertar a virgula: com entrada livre
 * ele digita "1500" querendo mil e quinhentos e grava quinze reais, e o erro so
 * aparece no relatorio.
 */
export function mascararMoeda(valor) {
  const d = somenteDigitos(valor).slice(0, 15)
  if (!d) return ""
  const centavos = Number(d)
  return (centavos / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** O numero por tras do texto mascarado — o que vai para o banco. */
export function moedaParaNumero(valor) {
  if (typeof valor === "number") return valor
  const d = somenteDigitos(valor)
  return d ? Number(d) / 100 : null
}

/** O caminho inverso: o numero do banco vira o texto do campo. */
export function numeroParaMoeda(numero) {
  if (numero === null || numero === undefined || numero === "") return ""
  return Number(numero).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Formata para leitura, com o simbolo da moeda configurada no campo. */
export function formatarMoeda(numero, moeda = "BRL") {
  if (numero === null || numero === undefined || numero === "") return ""
  try {
    return Number(numero).toLocaleString("pt-BR", { style: "currency", currency: moeda })
  } catch {
    // Codigo de moeda que o Intl nao conhece: melhor o numero sem simbolo do
    // que a tela quebrada.
    return `${moeda} ${numeroParaMoeda(numero)}`
  }
}
