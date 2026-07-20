/**
 * Sincroniza o catalogo de permissoes (codigo) com a tabela `permissao`.
 *
 * Idempotente: roda toda subida da API. Faz upsert por `chave` e NAO remove
 * permissoes automaticamente — apagar uma chave levaria junto os vinculos em
 * role_permissao, e uma chave sumir do catalogo por engano (um branch a menos,
 * um merge malfeito) revogaria acesso sem ninguem pedir.
 *
 * O preco desse cuidado e que chave orfa se acumula calada: as de
 * `programa.fases/modulos/tarefas` sobreviveram meses a remocao dos modulos
 * que elas governavam, aparecendo marcaveis na tela de Permissoes. Por isso
 * agora AVISA — remover continua sendo decisao humana, via migracao, mas deixou
 * de ser silencioso.
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

  // Chaves que existem no banco mas nao no codigo: modulo removido, chave
  // renomeada ou erro de digitacao. Qualquer uma das tres aparece na tela de
  // Permissoes como se governasse alguma coisa.
  const { rows: orfas } = await query(
    `SELECT p.chave, COUNT(rp.id_role)::int AS roles
       FROM permissao p
       LEFT JOIN role_permissao rp ON rp.id_permissao = p.id_permissao
      WHERE NOT (p.chave = ANY($1::text[]))
      GROUP BY p.chave
      ORDER BY p.chave`,
    [permissoes.map((p) => p.chave)]
  )

  if (orfas.length > 0) {
    console.warn(
      `[RBAC] ${orfas.length} permissao(oes) no banco fora do catalogo — ` +
        `aparecem na tela mas nao governam nada. Remova por migracao:`
    )
    for (const o of orfas) {
      console.warn(`[RBAC]   ${o.chave}${o.roles > 0 ? ` (${o.roles} role(s) usam)` : ""}`)
    }
  }
}

module.exports = { sincronizarCatalogo }
