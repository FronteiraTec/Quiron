/**
 * O cadastro do mentor: o vocabulario fechado e a normalizacao do que chega do
 * formulario (migracao 016).
 *
 * FORMATO e SITUACAO sao listas FECHADAS — enums no banco — porque ha leitura
 * de sistema atras deles: o formato decide o que a coordenacao oferece a
 * startup, e a situacao alimenta o filtro e a acao em massa da listagem. Os
 * tres valores de cada um valem para toda incubadora.
 *
 * ESPECIALIDADES e DEMANDAS sao o oposto: texto livre. Nao ha codigo atras de
 * "Growth" ou "Juridico", sao rotulos para achar gente. O que este arquivo faz
 * com eles e so higiene — aparar espaco, jogar fora o vazio e remover repetido
 * ignorando maiuscula, para que "growth" e "Growth" nao virem dois filtros
 * diferentes na tela.
 */
const { erroNegocio } = require("../utils/erros")

const FORMATOS = ["PRESENCIAL", "ONLINE", "HIBRIDO"]
const SITUACOES = ["ATIVO", "INDISPONIVEL", "INATIVO"]

const FORMATO_PADRAO = "HIBRIDO"
const SITUACAO_PADRAO = "ATIVO"

/** Teto de horas/mes, igual ao CHECK do banco — ver migracao 016. */
const MAX_HORAS_MES = 500
/** Uma tag e um rotulo, nao um paragrafo; e uma lista, nao um curriculo. */
const MAX_TAGS = 20
const MAX_TAG = 60

/** Texto opcional: "" e "   " valem o mesmo que nao preencher. */
function texto(valor, max = null) {
  if (valor === null || valor === undefined) return null
  const limpo = String(valor).trim()
  if (!limpo) return null
  return max ? limpo.slice(0, max) : limpo
}

/**
 * A lista de tags como ela deve ser gravada.
 *
 * A DEDUPLICACAO IGNORA MAIUSCULA mas PRESERVA a grafia da primeira ocorrencia:
 * quem digitou "Growth" ve "Growth", e quem digitar "growth" depois nao cria um
 * segundo valor. Sem isso os filtros da tela — que sao montados a partir dos
 * valores em uso — listariam a mesma especialidade duas vezes.
 */
function normalizarTags(valor) {
  if (valor === null || valor === undefined) return []
  if (!Array.isArray(valor)) {
    throw erroNegocio(400, "Especialidades e demandas precisam ser listas.")
  }
  const vistas = new Set()
  const tags = []
  for (const item of valor) {
    const limpo = String(item ?? "").trim().replace(/\s+/g, " ")
    if (!limpo) continue
    const chave = limpo.toLowerCase()
    if (vistas.has(chave)) continue
    vistas.add(chave)
    tags.push(limpo.slice(0, MAX_TAG))
    if (tags.length === MAX_TAGS) break
  }
  return tags
}

/** Horas/mes: numero inteiro dentro do teto, ou nada. */
function normalizarHoras(valor) {
  if (valor === null || valor === undefined || valor === "") return null
  const numero = Number(valor)
  if (!Number.isFinite(numero) || numero < 0 || numero > MAX_HORAS_MES) {
    throw erroNegocio(400, `A disponibilidade precisa ser um numero entre 0 e ${MAX_HORAS_MES} horas por mes.`)
  }
  return Math.round(numero)
}

/** Um dos valores da lista fechada, ou o padrao quando o formulario nao manda. */
function normalizarEnum(valor, validos, padrao, rotulo) {
  if (valor === null || valor === undefined || valor === "") return padrao
  const limpo = String(valor).toUpperCase()
  if (!validos.includes(limpo)) {
    throw erroNegocio(400, `${rotulo} invalido. Use: ${validos.join(", ")}.`)
  }
  return limpo
}

/**
 * O corpo do formulario vira exatamente o que o repositorio grava.
 *
 * SUBSTITUI O PERFIL INTEIRO (e um PUT): campo ausente vira null, lista ausente
 * vira lista vazia. E o que o formulario espera — ele manda o cadastro
 * completo, e apagar um campo la tem que apagar aqui.
 */
function normalizarPerfil(corpo = {}) {
  return {
    vinculo: texto(corpo.vinculo, 120),
    area: texto(corpo.area, 120),
    especialidades: normalizarTags(corpo.especialidades),
    demandas: normalizarTags(corpo.demandas),
    horasMes: normalizarHoras(corpo.horas_mes),
    formato: normalizarEnum(corpo.formato, FORMATOS, FORMATO_PADRAO, "Formato"),
    situacao: normalizarEnum(corpo.situacao, SITUACOES, SITUACAO_PADRAO, "Status"),
    // Sem limite de tamanho: e o campo onde a coordenacao escreve o que nao
    // coube em lugar nenhum, e cortar em N caracteres so perderia o final.
    observacoes: texto(corpo.observacoes),
  }
}

/** A situacao sozinha — o que a acao em massa da listagem altera. */
function normalizarSituacao(valor) {
  if (valor === null || valor === undefined || valor === "") {
    throw erroNegocio(400, "Informe o status.")
  }
  return normalizarEnum(valor, SITUACOES, SITUACAO_PADRAO, "Status")
}

module.exports = {
  FORMATOS,
  SITUACOES,
  FORMATO_PADRAO,
  SITUACAO_PADRAO,
  MAX_HORAS_MES,
  normalizarPerfil,
  normalizarSituacao,
  normalizarTags,
}
