/**
 * Repositorio de Arquivos (camada de acesso a dados).
 * Tabela relacionada: arquivo (migrations/007_arquivos.sql).
 *
 * Aqui so vive o REGISTRO do arquivo. Os bytes moram no disco (volume
 * `uploads`), e quem fala com o disco e o arquivoService — assim trocar o
 * armazenamento por S3 um dia mexe num arquivo so.
 */
const { query } = require("../config/db")

/** Registra um arquivo recem-gravado no disco. */
async function criar({ idTenant, enviadoPor, nomeOriginal, nomeArmazenado, mime, tamanho, visibilidade }) {
  const { rows } = await query(
    `INSERT INTO arquivo
       (id_tenant, enviado_por, nome_original, nome_armazenado, mime, tamanho, visibilidade)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id_arquivo, nome_original, mime, tamanho::int, visibilidade, criado_ts`,
    [idTenant, enviadoPor, nomeOriginal, nomeArmazenado, mime, tamanho, visibilidade]
  )
  return rows[0]
}

/** Busca um arquivo pelo id (UUID). */
async function buscarPorId(idArquivo) {
  const { rows } = await query(
    `SELECT id_arquivo, id_tenant, enviado_por, nome_original, nome_armazenado,
            mime, tamanho::int, visibilidade, criado_ts
       FROM arquivo
      WHERE id_arquivo = $1`,
    [idArquivo]
  )
  return rows[0]
}

/** Remove o registro. Quem apaga os bytes e o service. */
async function excluir(idArquivo) {
  const { rows } = await query(
    `DELETE FROM arquivo WHERE id_arquivo = $1 RETURNING nome_armazenado`,
    [idArquivo]
  )
  return rows[0]
}

/**
 * Quantos vinculos com FK apontam para este arquivo: anexos de tarefa e os
 * materiais do Espaco do Mentor (o da biblioteca pessoal e o que a incubadora
 * publica para os mentores). E o que decide se ainda da para apagar os bytes
 * (ver arquivoService.remover) e se o arquivo esta livre para virar o corpo de
 * um material novo.
 */
async function contarReferencias(idArquivo) {
  const { rows } = await query(
    `SELECT (SELECT COUNT(*) FROM tarefa_anexo WHERE id_arquivo = $1)
          + (SELECT COUNT(*) FROM mentor_material WHERE id_arquivo = $1)
          + (SELECT COUNT(*) FROM mentor_material_incubadora WHERE id_arquivo = $1) AS total`,
    [idArquivo]
  )
  return Number(rows[0].total)
}

/**
 * O arquivo e o corpo de um material do Espaco do Mentor (migracoes 020 e
 * 021)? Esses so abrem pelo proprio material, que sabe quem pode le-lo — ver
 * arquivoService.abrir.
 */
async function ehDoEspacoMentor(idArquivo) {
  const { rows } = await query(
    `SELECT 1 FROM mentor_material WHERE id_arquivo = $1
     UNION ALL
     SELECT 1 FROM mentor_material_incubadora WHERE id_arquivo = $1
     LIMIT 1`,
    [idArquivo]
  )
  return rows.length > 0
}

module.exports = { criar, buscarPorId, excluir, contarReferencias, ehDoEspacoMentor }
