---
name: autorizacao-admin-por-tenant
description: Como restringir acoes ao admin da incubadora (o JWT nao carrega o papel)
metadata:
  type: project
---

O JWT (`utils/jwt.js`) carrega apenas `{ id, email, root }` — NAO carrega o papel
(admin/mentor/usuario), porque um usuario pode ter papeis diferentes em tenants
diferentes. Por isso o middleware `auth.js` so tem `somenteRoot`, nao `somenteAdmin`.

**Como aplicar:** para acoes restritas ao admin de um tenant, faca o guard no
service (nao no middleware), buscando o papel pelo `id_tenant` do payload:
`tenantRepository.buscarPapel(idTenant, usuario.id)` e exija `=== 'admin'` (root
passa direto). Referencia: `questionarioService.garantirAdmin`. O frontend
espelha isso com `usuario.papel === 'admin'` (vem de `anexarVinculoTenant`).

Related: [[sempre-rebuild-e-restart]]
