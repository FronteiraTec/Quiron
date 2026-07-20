/**
 * Repositorio da Jornada (camada de acesso a dados).
 * Tabelas relacionadas: trilha_no, entrega, avaliacao, trilha_conteudo,
 * conteudo, startup_trilha (schema.sql).
 *
 * A Jornada e a MESMA trilha que o admin monta no Construtor, vista pelo lado
 * da startup: so o que esta ativo, com o estado da entrega de cada passo.
 * Nao existe "arvore da jornada" separada — o que muda e o recorte.
 */
const { query, withTransaction } = require("../config/db")

/**
 * Carrega a trilha ativa do tenant com o estado de cada passo para a startup.
 *
 * Uma query so, com LEFT JOINs: a entrega daquela startup naquele passo e a
 * avaliacao mais recente daquela entrega. Buscar passo a passo seria N+1 num
 * lugar que a startup abre a todo momento.
 *
 * @param {number} idTenant
 * @param {number} idStartup
 */
async function carregar(idTenant, idStartup) {
  const { rows } = await query(
    `SELECT n.id_no, n.id_pai, n.tipo, n.nome, n.descricao, n.ordem,
            n.tipo_passo, n.permite_entrega, n.obrigatoria, n.id_questionario,
            n.prazo, n.carga_horaria, n.entregavel,
            n.objetivo, n.porque, n.competencias, n.area,

            e.id_entrega, e.status AS entrega_status, e.texto_resposta,
            e.anexos, e.criado_ts AS entrega_criado_ts,
            e.atualizado_ts AS entrega_atualizado_ts,

            a.status AS avaliacao_status, a.nota, a.comentario,
            a.criado_ts AS avaliacao_ts, av.nome AS avaliador

       FROM trilha_no n

       LEFT JOIN entrega e
              ON e.id_no = n.id_no AND e.id_startup = $2

       -- Apenas a avaliacao mais recente: o mentor pode pedir ajuste e depois
       -- aprovar, e o estado do passo e sempre o da ultima palavra.
       LEFT JOIN LATERAL (
         SELECT status, nota, comentario, criado_ts, id_avaliador
           FROM avaliacao
          WHERE id_entrega = e.id_entrega
          ORDER BY criado_ts DESC, id_avaliacao DESC
          LIMIT 1
       ) a ON TRUE

       LEFT JOIN usuarios av ON av.id_usuario = a.id_avaliador

      WHERE n.id_tenant = $1 AND n.ativo = TRUE
      ORDER BY n.ordem, n.id_no`,
    [idTenant, idStartup]
  )
  return rows
}

/** Conteudos da Biblioteca ensinados por cada passo da trilha do tenant. */
async function conteudosPorPasso(idTenant) {
  const { rows } = await query(
    `SELECT tc.id_no,
            c.id_conteudo, c.tipo, c.titulo, c.resumo, c.tags,
            c.url, c.nome_arquivo, c.duracao
       FROM trilha_conteudo tc
       JOIN trilha_no n ON n.id_no = tc.id_no AND n.id_tenant = $1
       JOIN conteudo c  ON c.id_conteudo = tc.id_conteudo
      ORDER BY tc.id_no, tc.ordem, c.titulo`,
    [idTenant]
  )
  return rows
}

/** Blocos das aulas referenciadas — para o incubado ler sem outra chamada. */
async function blocosDosConteudos(idTenant) {
  const { rows } = await query(
    `SELECT b.id_conteudo, b.id_bloco, b.tipo, b.ordem, b.texto, b.url,
            b.nome, b.variante
       FROM conteudo_bloco b
      WHERE b.id_conteudo IN (
        SELECT DISTINCT tc.id_conteudo
          FROM trilha_conteudo tc
          JOIN trilha_no n ON n.id_no = tc.id_no AND n.id_tenant = $1
      )
      ORDER BY b.id_conteudo, b.ordem`,
    [idTenant]
  )
  return rows
}

/**
 * Equipe da startup. A jornada e da equipe, nao do usuario: a tela mostra
 * quem mais ve e edita o mesmo progresso.
 */
async function equipe(idStartup) {
  const { rows } = await query(
    `SELECT u.id_usuario, u.nome, sm.lider
       FROM startup_membros sm
       JOIN usuarios u ON u.id_usuario = sm.id_usuario
      WHERE sm.id_startup = $1 AND sm.ativo = TRUE
      ORDER BY sm.lider DESC, u.nome`,
    [idStartup]
  )
  return rows
}

/** Mentor(es) que acompanham a startup. */
async function mentores(idStartup) {
  const { rows } = await query(
    `SELECT u.id_usuario, u.nome
       FROM mentor_startup ms
       JOIN usuarios u ON u.id_usuario = ms.id_usuario_mentor
      WHERE ms.id_startup = $1
      ORDER BY u.nome`,
    [idStartup]
  )
  return rows
}

/** Historico de avaliacoes de uma startup (alimenta a linha do tempo). */
async function historicoPorStartup(idStartup) {
  const { rows } = await query(
    `SELECT e.id_no, a.status, a.criado_ts, a.comentario,
            u.nome AS avaliador
       FROM avaliacao a
       JOIN entrega e   ON e.id_entrega = a.id_entrega
       LEFT JOIN usuarios u ON u.id_usuario = a.id_avaliador
      WHERE e.id_startup = $1
      ORDER BY a.criado_ts DESC`,
    [idStartup]
  )
  return rows
}

/**
 * Grava a entrega de um passo (rascunho ou envio).
 *
 * Upsert: uma startup tem uma entrega por passo, reescrita a cada save. Sem
 * isso, salvar o rascunho tres vezes deixaria tres linhas e o estado do passo
 * passaria a depender de qual delas a consulta pegasse.
 *
 * @param {{idNo, idStartup, idUsuario, textoResposta, anexos, status}} dados
 */
async function salvarEntrega(dados) {
  const {
    idNo, idStartup, idUsuario,
    textoResposta = null, anexos = [], status = "RASCUNHO",
  } = dados

  const { rows } = await query(
    `INSERT INTO entrega (
       id_no, id_startup, id_usuario, texto_resposta, anexos, status
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id_no, id_startup) DO UPDATE
       SET texto_resposta = EXCLUDED.texto_resposta,
           anexos         = EXCLUDED.anexos,
           status         = EXCLUDED.status,
           id_usuario     = EXCLUDED.id_usuario,
           atualizado_ts  = NOW()
     RETURNING id_entrega, id_no, status, texto_resposta, anexos,
               criado_ts, atualizado_ts`,
    [idNo, idStartup, idUsuario, textoResposta, anexos, status]
  )
  return rows[0]
}

/**
 * Reenvio apos pedido de ajuste: regrava a entrega e limpa as avaliacoes
 * anteriores, para o passo voltar a AGUARDANDO em vez de continuar exibindo
 * o "precisa de ajuste" que ja foi atendido.
 */
async function reenviar(dados) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE entrega
          SET texto_resposta = $3, anexos = $4, status = 'ENVIADA',
              id_usuario = $5, atualizado_ts = NOW()
        WHERE id_no = $1 AND id_startup = $2
        RETURNING id_entrega, id_no, status, texto_resposta, anexos,
                  criado_ts, atualizado_ts`,
      [dados.idNo, dados.idStartup, dados.textoResposta ?? null,
       dados.anexos ?? [], dados.idUsuario]
    )
    const entrega = rows[0]
    if (!entrega) return undefined

    await client.query(`DELETE FROM avaliacao WHERE id_entrega = $1`, [
      entrega.id_entrega,
    ])

    return entrega
  })
}

/** Progresso da startup por fase (startup_trilha), para saber o que liberou. */
async function progressoPorFase(idStartup) {
  const { rows } = await query(
    `SELECT id_no, status FROM startup_trilha WHERE id_startup = $1`,
    [idStartup]
  )
  return rows
}

module.exports = {
  carregar,
  conteudosPorPasso,
  blocosDosConteudos,
  equipe,
  mentores,
  historicoPorStartup,
  salvarEntrega,
  reenviar,
  progressoPorFase,
}
