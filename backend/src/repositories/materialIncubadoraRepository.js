/**
 * Repositorio dos materiais que a INCUBADORA publica para os MENTORES (camada
 * de acesso a dados). Tabelas relacionadas: mentor_material_incubadora,
 * arquivo, usuarios (migracao 021).
 *
 * O recorte de quem ve o que (a chave, o arquivado) e do
 * materialIncubadoraService; aqui so ha consulta.
 */
const { query } = require("../config/db")

// O registro do arquivo e os nomes de quem publicou e de quem mexeu vem
// juntos: e o que a lista mostra, sem uma ida ao banco por linha.
const COLUNAS = `
  m.id_material, m.id_tenant, m.titulo, m.descricao, m.categoria,
  m.tipo, m.id_arquivo, m.url, m.arquivado_ts,
  m.criado_por, cp.nome AS criado_por_nome,
  m.atualizado_por, ap.nome AS atualizado_por_nome,
  m.criado_ts, m.atualizado_ts,
  a.nome_original AS arquivo_nome, a.mime AS arquivo_mime,
  a.tamanho::int AS arquivo_tamanho
`

const DE = `
  FROM mentor_material_incubadora m
  LEFT JOIN arquivo a   ON a.id_arquivo = m.id_arquivo
  LEFT JOIN usuarios cp ON cp.id_usuario = m.criado_por
  LEFT JOIN usuarios ap ON ap.id_usuario = m.atualizado_por
`

/**
 * Os materiais de uma incubadora. Os arquivados so vem para quem os pediu —
 * quem gerencia —, e por ultimo.
 */
async function listarPorTenant(idTenant, { comArquivados = false } = {}) {
  const { rows } = await query(
    `SELECT ${COLUNAS} ${DE}
      WHERE m.id_tenant = $1 AND ($2::boolean OR m.arquivado_ts IS NULL)
      ORDER BY m.arquivado_ts IS NOT NULL, m.atualizado_ts DESC, m.id_material DESC`,
    [idTenant, comArquivados]
  )
  return rows
}

/** As categorias em uso — as sugestoes do formulario e os itens do filtro. */
async function categorias(idTenant, { comArquivados = false } = {}) {
  const { rows } = await query(
    `SELECT DISTINCT categoria
       FROM mentor_material_incubadora
      WHERE id_tenant = $1 AND categoria IS NOT NULL
        AND ($2::boolean OR arquivado_ts IS NULL)
      ORDER BY categoria`,
    [idTenant, comArquivados]
  )
  return rows.map((r) => r.categoria)
}

async function buscarPorId(idMaterial) {
  const { rows } = await query(`SELECT ${COLUNAS} ${DE} WHERE m.id_material = $1`, [idMaterial])
  return rows[0]
}

async function criar({ idTenant, titulo, descricao, categoria, tipo, idArquivo, url, criadoPor }) {
  const { rows } = await query(
    `INSERT INTO mentor_material_incubadora
       (id_tenant, titulo, descricao, categoria, tipo, id_arquivo, url, criado_por, atualizado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
     RETURNING id_material`,
    [idTenant, titulo, descricao, categoria, tipo, idArquivo, url, criadoPor]
  )
  return buscarPorId(rows[0].id_material)
}

/**
 * Grava o estado final (o service ja fez o merge do patch). `arquivado`:
 * undefined nao mexe, true arquiva agora (sem reescrever a data de quem ja
 * estava arquivado), false desarquiva — como em mentor_material.
 */
async function atualizar(
  idMaterial,
  { titulo, descricao, categoria, tipo, idArquivo, url, arquivado, atualizadoPor }
) {
  const arquivamento =
    arquivado === undefined
      ? "arquivado_ts"
      : arquivado
        ? "COALESCE(arquivado_ts, NOW())"
        : "NULL"

  await query(
    `UPDATE mentor_material_incubadora
        SET titulo = $2, descricao = $3, categoria = $4, tipo = $5,
            id_arquivo = $6, url = $7, atualizado_por = $8,
            arquivado_ts = ${arquivamento},
            atualizado_ts = NOW()
      WHERE id_material = $1`,
    [idMaterial, titulo, descricao, categoria, tipo, idArquivo, url, atualizadoPor]
  )
  return buscarPorId(idMaterial)
}

/** Apaga o registro e devolve o arquivo que ficou solto (o service o remove). */
async function excluir(idMaterial) {
  const { rows } = await query(
    `DELETE FROM mentor_material_incubadora WHERE id_material = $1 RETURNING id_arquivo`,
    [idMaterial]
  )
  return rows[0]
}

module.exports = { listarPorTenant, categorias, buscarPorId, criar, atualizar, excluir }
