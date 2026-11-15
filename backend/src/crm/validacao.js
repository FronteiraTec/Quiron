/**
 * Validacao de entrada do CRM. Cada funcao devolve o valor ja na forma em que
 * se grava (texto aparado, so digitos, numero com duas casas, ISO em UTC) ou
 * lanca 400 com uma frase que a pessoa entende.
 *
 * `undefined` passa como `undefined` em todas: e o "nao mexi" das edicoes, e
 * quem decide se o campo era obrigatorio e o service.
 */
const { erroNegocio } = require("../utils/erros")

const FUSO = process.env.TZ_AGENDA || "America/Sao_Paulo"

/** Texto aparado; vazio vira null. */
function texto(valor, { rotulo, max, obrigatorio = false }) {
  if (valor === undefined) return undefined
  const t = valor === null ? "" : String(valor).trim()
  if (!t) {
    if (obrigatorio) throw erroNegocio(400, `Informe ${rotulo}.`)
    return null
  }
  if (max && t.length > max) {
    throw erroNegocio(400, `${capitalizar(rotulo)} deve ter no máximo ${max} caracteres.`)
  }
  return t
}

/** Um dos valores de uma lista fechada (os enums). */
function umDe(valor, lista, rotulo) {
  if (valor === undefined) return undefined
  if (!lista.includes(valor)) throw erroNegocio(400, `${capitalizar(rotulo)} inválido.`)
  return valor
}

/** Id inteiro positivo; vazio vira null. */
function id(valor, rotulo) {
  if (valor === undefined) return undefined
  if (valor === null || valor === "") return null
  const n = Number(valor)
  if (!Number.isInteger(n) || n <= 0) throw erroNegocio(400, `${capitalizar(rotulo)} inválido.`)
  return n
}

/** Dinheiro: numero >= 0, duas casas. Aceita "3500.5" e 3500.5; vazio vira null. */
function dinheiro(valor, rotulo) {
  if (valor === undefined) return undefined
  if (valor === null || valor === "") return null
  const n = Number(valor)
  if (!Number.isFinite(n) || n < 0) throw erroNegocio(400, `${capitalizar(rotulo)} inválido.`)
  if (n >= 1e12) throw erroNegocio(400, `${capitalizar(rotulo)} grande demais.`)
  return Math.round(n * 100) / 100
}

/** Inteiro num intervalo (a probabilidade); vazio vira null. */
function inteiroEntre(valor, min, max, rotulo) {
  if (valor === undefined) return undefined
  if (valor === null || valor === "") return null
  const n = Number(valor)
  if (!Number.isInteger(n) || n < min || n > max) {
    throw erroNegocio(400, `${capitalizar(rotulo)} deve ser um número entre ${min} e ${max}.`)
  }
  return n
}

/** Data "AAAA-MM-DD" que existe no calendario; vazio vira null. */
function data(valor, rotulo) {
  if (valor === undefined) return undefined
  if (valor === null || valor === "") return null
  const t = String(valor).slice(0, 10)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t)
  const d = m && new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  if (!d || d.getUTCDate() !== +m[3] || d.getUTCMonth() !== +m[2] - 1) {
    throw erroNegocio(400, `${capitalizar(rotulo)} inválida.`)
  }
  return t
}

/**
 * Instante (data e hora). Chega em ISO; sai em ISO UTC, como TEXTO — e o texto
 * que vai para o banco, e nao um Date: o driver converteria um Date para o fuso
 * do processo, e o TIMESTAMP sem fuso guardaria a hora errada.
 */
function instante(valor, rotulo) {
  if (valor === undefined) return undefined
  if (valor === null || valor === "") return null
  const ms = Date.parse(valor)
  if (Number.isNaN(ms)) throw erroNegocio(400, `${capitalizar(rotulo)} inválido.`)
  return new Date(ms).toISOString()
}

/** E-mail num formato plausivel; vazio vira null. */
function email(valor) {
  const t = texto(valor, { rotulo: "o e-mail", max: 150 })
  if (t && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) throw erroNegocio(400, "E-mail inválido.")
  return t === undefined ? undefined : t?.toLowerCase() ?? null
}

/** Telefone so com digitos: 10 ou 11 (DDD + numero), ate 13 com o 55. */
function telefone(valor, rotulo) {
  if (valor === undefined) return undefined
  const digitos = String(valor ?? "").replace(/\D/g, "")
  if (!digitos) return null
  if (digitos.length < 10 || digitos.length > 13) {
    throw erroNegocio(400, `${capitalizar(rotulo)} inválido. Informe o DDD e o número.`)
  }
  return digitos
}

/** CPF (PF) ou CNPJ (PJ), so digitos, com os digitos verificadores conferidos. */
function documento(valor, tipoPessoa) {
  if (valor === undefined) return undefined
  const digitos = String(valor ?? "").replace(/\D/g, "")
  if (!digitos) return null
  if (tipoPessoa === "PJ") {
    if (!cnpjValido(digitos)) throw erroNegocio(400, "CNPJ inválido.")
  } else if (!cpfValido(digitos)) {
    throw erroNegocio(400, "CPF inválido.")
  }
  return digitos
}

function cpfValido(d) {
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false
  const dv = (base) => {
    let soma = 0
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (base.length + 1 - i)
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }
  return dv(d.slice(0, 9)) === Number(d[9]) && dv(d.slice(0, 10)) === Number(d[10])
}

function cnpjValido(d) {
  if (!/^\d{14}$/.test(d) || /^(\d)\1{13}$/.test(d)) return false
  const dv = (base) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const soma = pesos.reduce((acc, p, i) => acc + p * Number(base[i]), 0)
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }
  return dv(d.slice(0, 12)) === Number(d[12]) && dv(d.slice(0, 13)) === Number(d[13])
}

/**
 * O id que veio na URL. Invalido responde 404, e nao 400: para quem pede,
 * "/clientes/abc" e um cliente que nao existe.
 */
function idRota(valor, mensagem) {
  const n = Number(valor)
  if (!Number.isInteger(n) || n <= 0) throw erroNegocio(404, mensagem)
  return n
}

/** So as chaves com valor definido: o "nao mexi" das edicoes fica de fora. */
function definidos(dados = {}) {
  return Object.fromEntries(Object.entries(dados).filter(([, valor]) => valor !== undefined))
}

/** Hoje ("AAAA-MM-DD") no fuso da incubadora — o padrao da data de fechamento. */
function hojeNoFuso() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(new Date())
}

function capitalizar(t) {
  const s = String(t).replace(/^(o|a|os|as) /, "")
  return s.charAt(0).toUpperCase() + s.slice(1)
}

module.exports = {
  texto,
  umDe,
  id,
  dinheiro,
  inteiroEntre,
  data,
  instante,
  email,
  telefone,
  documento,
  cpfValido,
  cnpjValido,
  idRota,
  definidos,
  hojeNoFuso,
}
