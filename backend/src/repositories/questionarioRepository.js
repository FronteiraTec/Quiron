/**
 * Repositorio de Questionarios (camada de acesso a dados).
 * Tabelas relacionadas: questionarios, pergunta, alternativa (schema.sql).
 *
 * Um questionario (estilo Google Forms) tem varias perguntas; cada pergunta
 * tem um tipo (perguntaTipo). Perguntas de escolha (ESCOLHA_UNICA/CAIXAS_SELECAO)
 * possuem alternativas; perguntas de texto (TEXTO_CURTO/PARAGRAFO) nao.
 *
 * Questionario com prova = TRUE e uma prova de assinalar: as alternativas
 * carregam o gabarito (alternativa.correta). Este repositorio devolve o
 * gabarito sempre — esconde-lo de quem responde e do service.
 */
const { query, withTransaction } = require("../config/db")

/** Tipos de pergunta que possuem alternativas. */
const TIPOS_COM_ALTERNATIVAS = ["ESCOLHA_UNICA", "CAIXAS_SELECAO"]

/**
 * Lista os questionarios de um tenant, com a contagem de perguntas de cada um.
 */
async function listarPorTenant(idTenant) {
  const { rows } = await query(
    `SELECT q.id_questionario, q.titulo, q.descricao, q.ativo, q.prova,
            (SELECT COUNT(*) FROM pergunta p
              WHERE p.id_questionario = q.id_questionario)::int AS total_perguntas,
            EXISTS (SELECT 1 FROM resposta r
                      JOIN pergunta p ON p.id_pergunta = r.id_pergunta
                     WHERE p.id_questionario = q.id_questionario) AS respondido
       FROM questionarios q
      WHERE q.id_tenant = $1
      ORDER BY q.titulo`,
    [idTenant]
  )
  return rows
}

/**
 * Busca um questionario com suas perguntas e, em cada pergunta de escolha,
 * as respectivas alternativas (em ordem).
 */
async function buscarPorIdComPerguntas(id) {
  const questionario = await query(
    `SELECT q.id_questionario, q.id_tenant, q.titulo, q.descricao, q.ativo, q.prova,
            EXISTS (SELECT 1 FROM resposta r
                      JOIN pergunta p ON p.id_pergunta = r.id_pergunta
                     WHERE p.id_questionario = q.id_questionario) AS respondido
       FROM questionarios q WHERE q.id_questionario = $1`,
    [id]
  )
  if (questionario.rows.length === 0) return undefined

  const perguntas = await query(
    `SELECT id_pergunta, pergunta, obrigatoria, tipo, ordem
       FROM pergunta
      WHERE id_questionario = $1
      ORDER BY ordem, id_pergunta`,
    [id]
  )

  // Busca todas as alternativas das perguntas em uma unica query e agrupa.
  const idsPerguntas = perguntas.rows.map((p) => p.id_pergunta)
  let alternativasPorPergunta = {}
  if (idsPerguntas.length) {
    const alternativas = await query(
      `SELECT id_alternativa, id_pergunta, descricao, ordem, correta
         FROM alternativa
        WHERE id_pergunta = ANY($1) AND ativa = TRUE
        ORDER BY ordem, id_alternativa`,
      [idsPerguntas]
    )
    alternativasPorPergunta = alternativas.rows.reduce((acc, alt) => {
      ;(acc[alt.id_pergunta] ||= []).push(alt)
      return acc
    }, {})
  }

  return {
    ...questionario.rows[0],
    perguntas: perguntas.rows.map((p) => ({
      ...p,
      alternativas: alternativasPorPergunta[p.id_pergunta] || [],
    })),
  }
}

/** Insere as perguntas (e alternativas) de um questionario, em ordem. */
async function inserirPerguntas(client, idQuestionario, perguntas) {
  for (let i = 0; i < perguntas.length; i++) {
    const p = perguntas[i]
    const { rows: pRows } = await client.query(
      `INSERT INTO pergunta (id_questionario, pergunta, obrigatoria, tipo, ordem)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id_pergunta`,
      [idQuestionario, p.pergunta, !!p.obrigatoria, p.tipo, i + 1]
    )
    const idPergunta = pRows[0].id_pergunta

    if (TIPOS_COM_ALTERNATIVAS.includes(p.tipo)) {
      for (let j = 0; j < p.alternativas.length; j++) {
        await client.query(
          `INSERT INTO alternativa (id_pergunta, descricao, ordem, correta)
           VALUES ($1, $2, $3, $4)`,
          [idPergunta, p.alternativas[j].descricao, j + 1, !!p.alternativas[j].correta]
        )
      }
    }
  }
}

/**
 * Cria um questionario completo (com perguntas e alternativas) em uma
 * unica transacao. Se qualquer insercao falhar, tudo e desfeito.
 *
 * @param {{idTenant:number, titulo:string, descricao:string, prova:boolean,
 *          perguntas:Array<{pergunta:string, tipo:string, obrigatoria:boolean,
 *          alternativas?:Array<{descricao:string, correta:boolean}>}>}} dados
 * @returns {Promise<object>} O questionario recem-criado (sem aninhar).
 */
async function criarCompleto({ idTenant, titulo, descricao, prova, perguntas }) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO questionarios (id_tenant, titulo, descricao, prova)
       VALUES ($1, $2, $3, $4)
       RETURNING id_questionario, titulo, descricao, ativo, prova`,
      [idTenant, titulo, descricao, !!prova]
    )
    const questionario = rows[0]

    await inserirPerguntas(client, questionario.id_questionario, perguntas)
    return questionario
  })
}

/**
 * Atualiza um questionario em uma unica transacao.
 *
 * Titulo e descricao mudam sempre. Com `perguntas`, o conjunto de perguntas e
 * TROCADO inteiro (apaga e reinsere) — o que so e seguro enquanto ninguem
 * respondeu: resposta aponta para pergunta com ON DELETE CASCADE, e a nota da
 * prova sai do gabarito na hora. Por isso a checagem de respostas roda aqui,
 * na mesma transacao do DELETE, e nao so no service.
 *
 * @param {{id:number, titulo:string, descricao:string, prova?:boolean,
 *          perguntas?:Array}} dados - sem `perguntas`, so o cabecalho muda.
 * @returns {Promise<object|null>} O questionario, ou null se ja foi respondido
 *   e a chamada tentou trocar as perguntas.
 */
async function atualizar({ id, titulo, descricao, prova, perguntas }) {
  return withTransaction(async (client) => {
    if (perguntas) {
      const { rows: resp } = await client.query(
        `SELECT 1 FROM resposta r
           JOIN pergunta p ON p.id_pergunta = r.id_pergunta
          WHERE p.id_questionario = $1
          LIMIT 1`,
        [id]
      )
      if (resp.length) return null

      await client.query(`DELETE FROM pergunta WHERE id_questionario = $1`, [id])
      await inserirPerguntas(client, id, perguntas)
    }

    const { rows } = await client.query(
      `UPDATE questionarios
          SET titulo = $2, descricao = $3, prova = COALESCE($4, prova)
        WHERE id_questionario = $1
        RETURNING id_questionario, titulo, descricao, ativo, prova`,
      [id, titulo, descricao, perguntas ? !!prova : null]
    )
    return rows[0]
  })
}

/** Ativa ou desativa um questionario (ativo = TRUE/FALSE). */
async function alternarAtivo(id, ativo) {
  const { rows } = await query(
    `UPDATE questionarios SET ativo = $2
      WHERE id_questionario = $1
      RETURNING id_questionario, titulo, ativo`,
    [id, ativo]
  )
  return rows[0]
}

module.exports = {
  listarPorTenant,
  buscarPorIdComPerguntas,
  criarCompleto,
  atualizar,
  alternarAtivo,
}
