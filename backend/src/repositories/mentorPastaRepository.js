/**
 * Repositorio das PASTAS da biblioteca pessoal do mentor (migracao 025).
 * Tabelas relacionadas: mentor_pasta, mentor_material.
 *
 * Como o mentorMaterialRepository, nao decide quem enxerga o que — o recorte
 * "so o dono" e do service. O que mora aqui e a CONSISTENCIA da arvore: mover
 * e excluir travam as pastas do dono numa transacao, para que dois gestos ao
 * mesmo tempo (arrastar A para dentro de B numa aba, B para dentro de A na
 * outra) nao fechem um ciclo que nenhum dos dois, sozinho, fecharia.
 */
const { query, withTransaction } = require("../config/db")
const { nomeLivre } = require("../mentores/pastas")

const COLUNAS = `id_pasta, id_tenant, id_mentor, id_pasta_pai, nome, criado_ts, atualizado_ts`

/** As pastas de uma pessoa numa incubadora. A arvore e montada na tela. */
async function listarDoMentor(idTenant, idMentor) {
  const { rows } = await query(
    `SELECT ${COLUNAS}
       FROM mentor_pasta
      WHERE id_tenant = $1 AND id_mentor = $2
      ORDER BY lower(nome), id_pasta`,
    [idTenant, idMentor]
  )
  return rows
}

async function buscarPorId(idPasta) {
  const { rows } = await query(`SELECT ${COLUNAS} FROM mentor_pasta WHERE id_pasta = $1`, [idPasta])
  return rows[0]
}

async function criar({ idTenant, idMentor, idPastaPai, nome }) {
  const { rows } = await query(
    `INSERT INTO mentor_pasta (id_tenant, id_mentor, id_pasta_pai, nome)
     VALUES ($1, $2, $3, $4)
     RETURNING ${COLUNAS}`,
    [idTenant, idMentor, idPastaPai, nome]
  )
  return rows[0]
}

async function renomear(idPasta, nome) {
  const { rows } = await query(
    `UPDATE mentor_pasta SET nome = $2, atualizado_ts = NOW()
      WHERE id_pasta = $1
      RETURNING ${COLUNAS}`,
    [idPasta, nome]
  )
  return rows[0]
}

/** Trava e devolve as pastas do dono: o retrato sobre o qual a transacao decide. */
async function travarPastasDoDono(client, idTenant, idMentor) {
  const { rows } = await client.query(
    `SELECT id_pasta, id_pasta_pai, nome
       FROM mentor_pasta
      WHERE id_tenant = $1 AND id_mentor = $2
      ORDER BY id_pasta
        FOR UPDATE`,
    [idTenant, idMentor]
  )
  return rows
}

/**
 * Move pastas e materiais para `destino` (null = raiz), tudo ou nada.
 *
 * `conferir(pastasDoDono)` recebe as pastas JA TRAVADAS e lanca o erro de
 * negocio se o movimento nao pode acontecer (ver mentores/pastas.js) — a
 * decisao e tomada sobre o mesmo retrato que vai ser gravado.
 *
 * Mover nao muda `atualizado_ts` do material: a data diz quando o CONTEUDO
 * mudou, e e ela que a tela mostra como "Modificado em".
 *
 * @returns {Promise<{materiaisEncontrados: number}>} quantos materiais da lista
 *   sao mesmo do dono — o service compara com o que foi pedido.
 */
async function mover({ idTenant, idMentor, destino, pastas, materiais }, conferir) {
  return withTransaction(async (client) => {
    const pastasDoDono = await travarPastasDoDono(client, idTenant, idMentor)
    conferir(pastasDoDono)

    let materiaisEncontrados = 0
    if (materiais.length) {
      const { rows } = await client.query(
        `SELECT id_material FROM mentor_material
          WHERE id_material = ANY($1::int[]) AND id_tenant = $2 AND id_mentor = $3
            FOR UPDATE`,
        [materiais, idTenant, idMentor]
      )
      materiaisEncontrados = rows.length
      if (materiaisEncontrados !== materiais.length) return { materiaisEncontrados }

      await client.query(
        `UPDATE mentor_material SET id_pasta = $1 WHERE id_material = ANY($2::int[])`,
        [destino, materiais]
      )
    }

    if (pastas.length) {
      await client.query(
        `UPDATE mentor_pasta SET id_pasta_pai = $1, atualizado_ts = NOW()
          WHERE id_pasta = ANY($2::int[])
            AND id_pasta_pai IS DISTINCT FROM $1`,
        [destino, pastas]
      )
    }
    return { materiaisEncontrados }
  })
}

/**
 * Exclui a pasta e LEVA O CONTEUDO PARA A PASTA DE CIMA — nada do que estava
 * dentro e apagado.
 *
 * Uma subpasta que chegue onde ja ha uma irma com o mesmo nome ganha o sufixo
 * " (2)", como no gerenciador de arquivos: recusar deixaria a pessoa sem como
 * excluir a pasta. A propria pasta conta como ocupada ate o fim (ela so some no
 * DELETE), entao "Modelos/Modelos" sobe como "Modelos (2)" — o preco de nunca
 * esbarrar no indice unico no meio da transacao.
 *
 * @returns {Promise<{excluida: boolean, pastasMovidas?: number, materiaisMovidos?: number}>}
 */
async function excluir(idPasta) {
  return withTransaction(async (client) => {
    // O dono nao muda; a pasta-mae pode mudar ate a trava — por isso ela e lida
    // do retrato travado, e nao desta primeira consulta.
    const { rows: dono } = await client.query(
      `SELECT id_tenant, id_mentor FROM mentor_pasta WHERE id_pasta = $1`,
      [idPasta]
    )
    if (!dono[0]) return { excluida: false }

    const pastasDoDono = await travarPastasDoDono(client, dono[0].id_tenant, dono[0].id_mentor)
    const alvo = pastasDoDono.find((p) => p.id_pasta === Number(idPasta))
    if (!alvo) return { excluida: false }
    const destino = alvo.id_pasta_pai ?? null

    const ocupados = pastasDoDono
      .filter((p) => (p.id_pasta_pai ?? null) === destino)
      .map((p) => p.nome)
    const filhas = pastasDoDono.filter((p) => p.id_pasta_pai === alvo.id_pasta)

    for (const filha of filhas) {
      const nome = nomeLivre(filha.nome, ocupados)
      ocupados.push(nome)
      await client.query(
        `UPDATE mentor_pasta SET id_pasta_pai = $2, nome = $3, atualizado_ts = NOW()
          WHERE id_pasta = $1`,
        [filha.id_pasta, destino, nome]
      )
    }

    const { rowCount: materiaisMovidos } = await client.query(
      `UPDATE mentor_material SET id_pasta = $2 WHERE id_pasta = $1`,
      [idPasta, destino]
    )
    await client.query(`DELETE FROM mentor_pasta WHERE id_pasta = $1`, [idPasta])
    return { excluida: true, pastasMovidas: filhas.length, materiaisMovidos }
  })
}

module.exports = {
  listarDoMentor,
  buscarPorId,
  criar,
  renomear,
  mover,
  excluir,
}
