---
name: rbac-papel-e-baseline-permissao-estende
description: Como o RBAC funciona — em 20/07/2026 virou autoritativo (permissão decide), com o papel reduzido a salvaguarda; migração 005
metadata:
  type: project
---

**ATENCAO — o modelo MUDOU em 20/07/2026.** O que este arquivo descreve abaixo
como "papel e baseline, permissao so estende" e o modelo ANTIGO. A partir da
migracao `005_rbac_funcional.sql`, a permissao decide sozinha nos modulos ja
convertidos, e o papel ficou com tres usos so: travar a gestao de permissoes
(para ninguem se auto-trancar), definir a role inicial de um usuario novo, e
escolher o menu base. Decisao do usuario, com o sistema ainda so local.

**Conversao CONCLUIDA em 20/07/2026.** Todos os modulos passaram a exigir chave
(trilha, biblioteca, questionarios, startups + membros + canvas/gut/5w2h,
mentores, eventos + presenca, entregas, avaliacoes, relatorios), e o menu e
podado por permissao (`store/permissaoStore.js` + `filtrarPorPermissao` em
`useSidebar.js`; grupo que fica sem filho some inteiro). Provado ponta a ponta:
o admin remove a chave da role Mentor e o mentor passa de 200 a 403 na hora.

**O que NAO passa por RBAC, de proposito:** dado do proprio usuario — `/jornada`
(`?id_startup=`, nao `id_tenant`), `/startups/minha`, Perfil — e a tela de
Configuracoes, para a gestao de permissoes seguir alcancavel se o admin errar a
mao nas roles. `usuarios.usuarios.*` e `configuracoes.*` ainda nao tem
enforcement no service (so no menu).

**Chaves ainda sem enforcement no backend:** `usuarios.usuarios.*` (exceto
redefinir_senha), `configuracoes.*`, e as acoes `exportar` (a exportacao de CSV
roda no cliente, `utils/csv.js`, sobre dado ja carregado — nao ha request para
barrar). Se forem cobrar essas, lembre que exportar so vira chave de verdade se
a exportacao passar a ser server-side.

**Onde moram as pecas:** `rbac/rolesPadrao.js` (conjuntos das 3 roles padrao;
Administrador recebe o catalogo inteiro por calculo, nao por lista, para nao
envelhecer), `rbacRepository.criarRolesPadrao` (agora popula `role_permissao` —
antes criava roles VAZIAS e `sistema=TRUE`, portanto nem excluiveis), e a
migracao 005 (limpeza de 14 chaves orfas + backfill de roles e usuarios).

**Padrao de enforcement num service** (ver `trilhaService`): as escritas
recebem so o id da entidade, entao o tenant sai da PROPRIA entidade, nunca de
um `id_tenant` vindo do cliente — senao alguem checa permissao contra a
incubadora onde tem acesso e escreve na de outra. Separe a primitiva interna
(`buscarNo`, sem checagem) do endpoint publico (`buscar`, que exige
`visualizar`), senao toda escrita faz duas checagens e a primeira com a chave
errada.

---

A maquinaria de RBAC existe inteira e sempre existiu — `rbacRepository.usuarioTemPermissao`
/ `listarPermissoesDoUsuario` e `rbacService.garantirPermissao` (root passa
direto). O que quase nao existia era USO. **Nao confie em grep case-sensitive
para concluir que "nao ha enforcement"** — foi assim que conclui errado uma vez.

**Levantamento de 20/07/2026 — 5 chaves de 68 tem qualquer codigo atras:**
`eventos.agenda.criar` (portao duro, `garantirPermissao`),
`usuarios.usuarios.redefinir_senha` (portao duro, dentro do proprio rbacService),
e tres que apenas ESTENDEM: `avaliacoes.avaliacoes.avaliar`,
`avaliacoes.entregas.visualizar`, `startups.mentoria.mentorar`. As outras 63 sao
decorativas: o admin marca e desmarca na tela de Permissoes e nada muda no
backend. **A tela promete um controle que nao existe** — esse e o pior traco do
estado atual, porque um admin pode acreditar que revogou um acesso.

**`criarRolesPadrao` cria roles VAZIAS.** Ela insere Administrador/Mentor/
Colaborador com `sistema = TRUE` mas nunca escreve em `role_permissao`. Entao
mesmo um tenant criado certo (via `tenantService.criar`) nasce com tres roles que
nao concedem nada — e que, por serem `sistema`, nem podem ser excluidas.

**Estado do banco (tenant 1):** nenhuma role padrao (ele nasceu do seed por
INSERT direto). Existe uma role manual "Teste" com 59 permissoes, vinculada ao
usuario Admin — que ja e `papel = 'admin'`, entao o vinculo nao muda nada.

**O frontend quase nao consome permissao:** so `pages/Eventos.jsx` e
`pages/Usuarios.jsx` chamam `/permissoes/minhas`. O menu (`menuConfig.jsx`) e
montado so pelo papel.

**O modelo aplicado na mentoria** (`rbacService.podeMentorar`): o papel em
`tenant_usuarios` e o baseline — admin e mentor podem por definicao — e a
permissao RBAC apenas ESTENDE o direito a quem nao tem o papel. Motivo: as
roles padrao (`criarRolesPadrao`) nunca foram criadas para o tenant 1, porque
ele nasceu do seed via INSERT direto e nao pelo `tenantService.criar`. Exigir a
chave deixaria todo mentor sem acesso.

**Consequencia a lembrar:** nao da para REVOGAR mentoria de um papel 'mentor'
desmarcando a permissao. Para o RBAC valer sozinho (deny-by-default) seria
preciso criar as roles padrao nos tenants existentes, dar permissoes a elas e
vincular os usuarios — migracao ainda nao feita.

**Dois eixos independentes, ambos exigidos** para avaliar/ver uma entrega:
a permissao diz O QUE a pessoa pode fazer; `mentor_startup` diz PARA QUEM.
Ter so um dos dois da 403.

Related: [[telas-do-mentor-entregas-e-feedback]], [[autorizacao-admin-por-tenant]]
