/**
 * As pastas da biblioteca pessoal do mentor (migracao 025): a normalizacao do
 * que chega da tela e as regras da arvore.
 *
 * Funcoes puras, como mentores/material.js: nada aqui consulta o banco. O
 * repositorio carrega as pastas do dono (travadas, numa transacao) e entrega a
 * lista a `conferirMovimento`, que decide se o movimento pode acontecer. Assim
 * a regra que importa — uma pasta nao vai para dentro dela mesma — e testada
 * sem banco, e aplicada sobre o mesmo retrato que a transacao vai gravar.
 */
const { erroNegocio } = require("../utils/erros")

const MAX_NOME = 120
// Um movimento e um gesto da tela (arrastar a selecao). Mil itens de uma vez
// nao e gesto, e um laco de alguem — e cada id vira um parametro da consulta.
const MAX_ITENS_MOVIMENTO = 500

/** A forma de comparar nomes de pastas irmas: a mesma do indice unico. */
const chaveNome = (nome) => String(nome ?? "").toLowerCase()

/** O pai como numero (o pg devolve INTEGER como number, mas o teste pode nao). */
const paiDe = (pasta) =>
  pasta.id_pasta_pai === null || pasta.id_pasta_pai === undefined ? null : Number(pasta.id_pasta_pai)

/** Espacos repetidos viram um, como na categoria do material. */
function nomePasta(valor) {
  const limpo = String(valor ?? "").trim().replace(/\s+/g, " ")
  if (!limpo) throw erroNegocio(400, "Informe o nome da pasta.")
  if (limpo.length > MAX_NOME) {
    throw erroNegocio(400, `O nome da pasta pode ter no maximo ${MAX_NOME} caracteres.`)
  }
  return limpo
}

/** Uma pasta, ou a raiz: null, "" e ausente valem a raiz. */
function idPastaOuRaiz(valor) {
  if (valor === null || valor === undefined || valor === "") return null
  const numero = Number(valor)
  if (!Number.isInteger(numero) || numero <= 0) throw erroNegocio(400, "Pasta invalida.")
  return numero
}

function listaDeIds(valor, rotulo) {
  if (valor === undefined || valor === null) return []
  if (!Array.isArray(valor)) throw erroNegocio(400, `Envie ${rotulo} como lista.`)
  const ids = valor.map(Number)
  if (ids.some((n) => !Number.isInteger(n) || n <= 0)) throw erroNegocio(400, `Lista de ${rotulo} invalida.`)
  return [...new Set(ids)]
}

/**
 * O corpo de POST /espaco-mentor/mover: para onde, e o que vai.
 * @returns {{destino: number|null, pastas: number[], materiais: number[]}}
 */
function normalizarMovimento(corpo = {}) {
  const dados = {
    destino: idPastaOuRaiz(corpo.destino),
    pastas: listaDeIds(corpo.pastas, "as pastas"),
    materiais: listaDeIds(corpo.materiais, "os materiais"),
  }
  const total = dados.pastas.length + dados.materiais.length
  if (!total) throw erroNegocio(400, "Escolha o que mover.")
  if (total > MAX_ITENS_MOVIMENTO) {
    throw erroNegocio(400, `Mova no maximo ${MAX_ITENS_MOVIMENTO} itens de uma vez.`)
  }
  return dados
}

/**
 * O primeiro nome livre entre `existentes`: "Modelos", "Modelos (2)",
 * "Modelos (3)"... — o que o gerenciador de arquivos faz com "Nova pasta".
 * O sufixo cabe no teto da coluna: o nome encurta, o numero nao some.
 */
function nomeLivre(nome, existentes = []) {
  const usados = new Set(existentes.map(chaveNome))
  if (!usados.has(chaveNome(nome))) return nome
  for (let n = 2; ; n += 1) {
    const sufixo = ` (${n})`
    const candidato = `${nome.slice(0, MAX_NOME - sufixo.length)}${sufixo}`
    if (!usados.has(chaveNome(candidato))) return candidato
  }
}

/**
 * Confere um movimento sobre as pastas do dono.
 *
 *   - o destino e as pastas movidas sao dele (senao, 404 — como o material);
 *   - nenhuma pasta vai para dentro dela mesma, nem de uma descendente: subir
 *     do destino ate a raiz nao pode passar por nenhuma pasta movida;
 *   - nenhuma chega onde ja ha uma irma com o mesmo nome (o indice unico
 *     recusaria; aqui a mensagem diz qual).
 *
 * @param {Array<{id_pasta, id_pasta_pai, nome}>} pastasDoDono
 * @param {{destino: number|null, pastas: number[]}} movimento
 */
function conferirMovimento(pastasDoDono, { destino, pastas }) {
  const porId = new Map(pastasDoDono.map((p) => [Number(p.id_pasta), p]))

  if (destino !== null && !porId.has(destino)) {
    throw erroNegocio(404, "Pasta de destino nao encontrada.")
  }
  for (const id of pastas) {
    if (!porId.has(id)) throw erroNegocio(404, "Pasta nao encontrada.")
  }

  const movidas = new Set(pastas)
  const vistos = new Set()
  for (let atual = destino; atual !== null; ) {
    if (movidas.has(atual)) {
      throw erroNegocio(409, "Uma pasta nao pode ir para dentro dela mesma.")
    }
    // Um ciclo ja gravado nao deveria existir; se existir, nao trava o laco.
    if (vistos.has(atual)) break
    vistos.add(atual)
    const pasta = porId.get(atual)
    atual = pasta ? paiDe(pasta) : null
  }

  // As que ja estao no destino ficam — inclusive as movidas que ja estavam la.
  const nomeDestino = destino === null ? "na raiz da biblioteca" : `em "${porId.get(destino).nome}"`
  const ocupados = new Set(
    pastasDoDono
      .filter((p) => paiDe(p) === destino)
      .map((p) => chaveNome(p.nome))
  )
  for (const id of pastas) {
    const pasta = porId.get(id)
    if (paiDe(pasta) === destino) continue // ja esta la: nao conflita consigo mesma
    const chave = chaveNome(pasta.nome)
    if (ocupados.has(chave)) {
      throw erroNegocio(409, `Ja existe uma pasta "${pasta.nome}" ${nomeDestino}.`)
    }
    ocupados.add(chave)
  }
}

module.exports = {
  MAX_NOME,
  MAX_ITENS_MOVIMENTO,
  chaveNome,
  nomePasta,
  idPastaOuRaiz,
  normalizarMovimento,
  nomeLivre,
  conferirMovimento,
}
