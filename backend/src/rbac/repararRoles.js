/**
 * Repara tenants e usuarios que ficaram fora do RBAC.
 *
 * Dois jeitos de isso acontecer, ambos fora do caminho normal
 * (tenantService.criar / criarUsuario, que ja saem com roles e alocacao):
 *
 *   1. Uma tenant nasceu por INSERT direto em SQL, sem passar por
 *      `tenantService.criar` — o caso do seed.sql, que cria a "Incubadora
 *      Demo" assim. `criarRolesPadrao` nunca rodou pra ela, entao a tenant
 *      nao tem roles nenhuma.
 *   2. Um usuario foi vinculado a uma tenant (tenant_usuarios) antes desta
 *      alocacao existir, ou por um caminho que ainda nao a chama. Fica com
 *      papel mas sem `usuario_role` — sem role, nenhuma permissao RBAC bate,
 *      e o front esconde tudo que depende de `minhasPermissoes`.
 *
 * Idempotente: roda toda subida da API, depois de sincronizarCatalogo (o
 * Administrador recebe o catalogo inteiro, entao precisa dele ja em dia).
 * So ACRESCENTA — nunca mexe em quem ja esta em alguma role nessa tenant,
 * para nao sobrescrever uma customizacao feita na tela de Permissoes.
 */
const { query } = require("../config/db")
const rbacRepository = require("../repositories/rbacRepository")

async function repararRolesTenants() {
  const { rows: tenants } = await query(`SELECT id_tenant FROM tenant`)
  for (const t of tenants) {
    await rbacRepository.criarRolesPadrao(t.id_tenant)
  }

  const { rows: orfaos } = await query(
    `SELECT tu.id_usuario, tu.id_tenant, tu.papel
       FROM tenant_usuarios tu
      WHERE tu.ativo = TRUE
        AND NOT EXISTS (
          SELECT 1
            FROM usuario_role ur
            JOIN role r ON r.id_role = ur.id_role
           WHERE ur.id_usuario = tu.id_usuario AND r.id_tenant = tu.id_tenant
        )`
  )

  for (const o of orfaos) {
    await rbacRepository.alocarRolePadrao(o.id_tenant, o.id_usuario, o.papel)
  }

  if (orfaos.length > 0) {
    console.log(
      `[RBAC] ${orfaos.length} usuario(s) sem role alocado(s) na role padrao equivalente ao papel.`
    )
  }
}

module.exports = { repararRolesTenants }
