/**
 * Repositorio da biblioteca PESSOAL do mentor (camada de acesso a dados).
 * Tabelas relacionadas: mentor_material, arquivo, mentor_compartilhamento
 * (migracao 020).
 *
 * Aqui nao se decide quem enxerga o que: toda funcao recebe ids e devolve
 * linhas. O recorte "so o dono" e do mentorMaterialService — este arquivo nao
 * sabe quem esta pedindo.
 */
const { query, withTransaction } = require("../config/db")

// O registro do arquivo vem junto (nome, tipo, tamanho): e o que a tela mostra
// e o que o filtro por formato le, sem uma segunda ida ao banco por linha.
const COLUNAS = `
  m.id_material, m.id_tenant, m.id_mentor, m.titulo, m.descricao, m.categoria,
  m.tipo, m.id_arquivo, m.url, m.arquivado_ts, m.criado_ts, m.atualizado_ts,
  m.id_pasta,
  a.nome_original AS arquivo_nome, a.mime AS arquivo_mime,
  a.tamanho::int AS arquivo_tamanho
`

const DE_MATERIAL = `
  FROM mentor_material m
  LEFT JOIN arquivo a ON a.id_arquivo = m.id_arquivo
`

/**
 * A biblioteca de uma pessoa numa incubadora, com o que ja foi compartilhado.
 *
 * `startups_compartilhadas` e a lista DISTINTA de startups que receberam o
 * material (o mesmo material em duas etapas da mesma startup conta uma vez
 * ali), e `total_compartilhamentos` conta os vinculos. A tela usa os dois: a
 * coluna "Compartilhado com" e o aviso antes de excluir.
 *
 * Arquivados por ultimo: a biblioteca de trabalho e a dos ativos.
 */
async function listarDoMentor(idTenant, idMentor) {
  const { rows } = await query(
    `SELECT ${COLUNAS},
            COALESCE(c.total, 0)::int AS total_compartilhamentos,
            COALESCE(c.startups, '[]'::jsonb) AS startups_compartilhadas
       ${DE_MATERIAL}
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS total,
                jsonb_agg(DISTINCT jsonb_build_object('id_startup', s.id_startup, 'nome', s.nome)) AS startups
           FROM mentor_compartilhamento mc
           JOIN startup s ON s.id_startup = mc.id_startup
          WHERE mc.id_material = m.id_material
       ) c ON TRUE
      WHERE m.id_tenant = $1 AND m.id_mentor = $2
      ORDER BY m.arquivado_ts IS NOT NULL, m.atualizado_ts DESC, m.id_material DESC`,
    [idTenant, idMentor]
  )
  return rows
}

/** Um material pelo id, sem recorte de dono (quem confere e o service). */
async function buscarPorId(idMaterial) {
  const { rows } = await query(
    `SELECT ${COLUNAS} ${DE_MATERIAL} WHERE m.id_material = $1`,
    [idMaterial]
  )
  return rows[0]
}

/** As categorias que esta pessoa ja usa — as sugestoes do formulario. */
async function categoriasDoMentor(idTenant, idMentor) {
  const { rows } = await query(
    `SELECT DISTINCT categoria
       FROM mentor_material
      WHERE id_tenant = $1 AND id_mentor = $2 AND categoria IS NOT NULL
      ORDER BY categoria`,
    [idTenant, idMentor]
  )
  return rows.map((r) => r.categoria)
}

async function criar({ idTenant, idMentor, titulo, descricao, categoria, tipo, idArquivo, url, idPasta }) {
  const { rows } = await query(
    `INSERT INTO mentor_material
       (id_tenant, id_mentor, titulo, descricao, categoria, tipo, id_arquivo, url, id_pasta)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id_material`,
    [idTenant, idMentor, titulo, descricao, categoria, tipo, idArquivo, url, idPasta ?? null]
  )
  return buscarPorId(rows[0].id_material)
}

/**
 * Grava o estado final do material (o service ja fez o merge do patch).
 *
 * `arquivado` e tres estados: undefined nao mexe, true arquiva AGORA, false
 * desarquiva. Arquivar de novo um arquivado nao reescreve a data — ela diz
 * quando o material saiu da biblioteca de trabalho, e isso foi uma vez so.
 */
async function atualizar(idMaterial, { titulo, descricao, categoria, tipo, idArquivo, url, arquivado }) {
  const arquivamento =
    arquivado === undefined
      ? "arquivado_ts"
      : arquivado
        ? "COALESCE(arquivado_ts, NOW())"
        : "NULL"

  await query(
    `UPDATE mentor_material
        SET titulo = $2, descricao = $3, categoria = $4, tipo = $5,
            id_arquivo = $6, url = $7,
            arquivado_ts = ${arquivamento},
            atualizado_ts = NOW()
      WHERE id_material = $1`,
    [idMaterial, titulo, descricao, categoria, tipo, idArquivo, url]
  )
  return buscarPorId(idMaterial)
}

/**
 * Exclui o material SE ele nao tiver sido compartilhado.
 *
 * Numa transacao, com o material travado: a contagem e a exclusao precisam
 * ver o mesmo mundo. Sem a trava, um compartilhamento criado entre as duas
 * seria levado em silencio pelo CASCADE — exatamente o que a regra existe para
 * impedir. O INSERT do compartilhamento espera esta trava (a FK trava a linha
 * do material para leitura), e depois dela encontra o material ja apagado.
 *
 * @returns {Promise<{excluido: boolean, compartilhamentos: number, idArquivo?: string}>}
 */
async function excluirSeLivre(idMaterial) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id_arquivo FROM mentor_material WHERE id_material = $1 FOR UPDATE`,
      [idMaterial]
    )
    if (!rows[0]) return { excluido: false, compartilhamentos: 0 }

    const { rows: uso } = await client.query(
      `SELECT COUNT(*)::int AS total FROM mentor_compartilhamento WHERE id_material = $1`,
      [idMaterial]
    )
    if (uso[0].total > 0) return { excluido: false, compartilhamentos: uso[0].total }

    await client.query(`DELETE FROM mentor_material WHERE id_material = $1`, [idMaterial])
    return { excluido: true, compartilhamentos: 0, idArquivo: rows[0].id_arquivo }
  })
}

/** Os vinculos de um material, com o caminho legivel de cada um. */
async function compartilhamentosDoMaterial(idMaterial) {
  const { rows } = await query(
    `SELECT mc.id_compartilhamento, mc.id_startup, s.nome AS startup_nome,
            mc.id_programa, pr.nome AS programa_nome,
            mc.id_no, etp.tipo AS etapa_tipo, etp.nome AS etapa_nome,
            mc.finalidade, mc.orientacao, mc.criado_ts
       FROM mentor_compartilhamento mc
       JOIN startup s ON s.id_startup = mc.id_startup
       JOIN trilha_no pr ON pr.id_no = mc.id_programa
       LEFT JOIN trilha_no etp ON etp.id_no = mc.id_no
      WHERE mc.id_material = $1
      ORDER BY mc.criado_ts DESC`,
    [idMaterial]
  )
  return rows
}

module.exports = {
  listarDoMentor,
  buscarPorId,
  categoriasDoMentor,
  criar,
  atualizar,
  excluirSeLivre,
  compartilhamentosDoMaterial,
}
