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

module.exports = { criar, buscarPorId, excluir }
