/**
 * Sincroniza o catalogo de permissoes (codigo) com a tabela `permissao`.
 *
 * Idempotente: roda toda subida da API. Faz upsert por `chave` - nunca
 * remove permissoes antigas automaticamente (evita apagar vinculos de
 * role_permissao caso uma chave seja temporariamente removida do catalogo).
 */
const { query } = require("../config/db")
const { achatarCatalogo } = require("./catalogoPermissoes")

async function sincronizarCatalogo() {
  const permissoes = achatarCatalogo()

  for (const p of permissoes) {
    await query(
      `INSERT INTO permissao (chave, modulo, recurso, acao, rotulo_modulo, rotulo_recurso, rotulo_acao)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (chave) DO UPDATE
         SET modulo = EXCLUDED.modulo,
             recurso = EXCLUDED.recurso,
             acao = EXCLUDED.acao,
             rotulo_modulo = EXCLUDED.rotulo_modulo,
             rotulo_recurso = EXCLUDED.rotulo_recurso,
             rotulo_acao = EXCLUDED.rotulo_acao`,
      [p.chave, p.modulo, p.recurso, p.acao, p.rotulo_modulo, p.rotulo_recurso, p.rotulo_acao]
    )
  }

  console.log(`Catalogo de permissoes sincronizado (${permissoes.length} permissoes).`)
}

module.exports = { sincronizarCatalogo }
