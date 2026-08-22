---
name: telas-do-mentor-entregas-e-feedback
description: Como o papel mentor enxerga o sistema — recorte por mentor_startup, e o que ainda falta nas telas dele
metadata:
  type: project
---

O papel `mentor` tem menu proprio (`MENU_MENTOR` em `menuConfig.jsx`). Em
19/07/2026 as telas `/entregas` (fila de avaliacao) e `/feedback` (historico de
devolutivas) sairam do Placeholder e viraram telas reais.

**O recorte do mentor** vem de `mentor_startup`, e NAO de `startup_membros`.
`startupRepository.listarIdsPorUsuario` soma os dois vinculos (serve para
visibilidade geral); para avaliar existe `listarIdsPorMentor` / `ehMentorDe`,
que so olham mentoria — senao um membro da startup aprovaria a propria entrega.
O guard fica no service (`avaliacaoService.garantirPodeAvaliar`), pelo motivo
de sempre: o JWT nao carrega papel (ver [[autorizacao-admin-por-tenant]]).

**Estado da entrega para quem avalia:** `ENVIADA` sem avaliacao = esperando o
mentor. Nao existe flag de "reenviada" — `jornadaRepository.reenviar` APAGA as
avaliacoes anteriores, entao a entrega volta sozinha para a fila.
`RASCUNHO` nunca aparece para o mentor.

**Backend de `/mentores`** (mentorRepository/Service/Controller/Routes):
`GET /mentores?id_tenant=&dias=`, `PUT /mentores/:idUsuario/perfil`,
`PATCH /mentores/:idUsuario/situacao`, `GET|POST /mentores/:idUsuario/startups`,
`DELETE /mentores/:idUsuario/startups/:idStartup`, e `GET /startups/:id/mentores`.
As chaves RBAC do recurso sao visualizar / editar / vincular / desvincular /
exportar, e o service exige a chave (`rbacService.garantirPermissao`).

**A tela `/mentores` virou TABELA em 22/08/2026** (migracao 016). Era
mestre-detalhe e existia para uma decisao so — distribuir startups —, mas isso
deixava a coordenacao sem as perguntas que ela faz ANTES de distribuir. Agora e
`TabelaDados` no mesmo molde de `/startups` (colunas escolhiveis e guardadas no
navegador, `PainelFiltros`, acao em massa de status, export CSV), e o vinculo
mora no `DrawerMentor` — clicar na linha abre na aba "Startups", o lapis abre na
aba "Cadastro". `MentorLista.jsx` foi apagado; `MentorPainel.jsx` perdeu o
cabecalho e virou a aba de startups.

**"Novo Mentor" cria a PESSOA** (`POST /mentores` -> `mentorService.criar`).
Como mentor e o papel 'mentor' em `tenant_usuarios` e nao uma tabela, criar um
mentor e criar um usuario com esse papel — entao o service DELEGA a
`tenantService.criarUsuario`, que ja faz senha provisoria, e-mail unico, vinculo
e **alocacao da role padrao Mentor** na mesma transacao. Repetir isso no
mentorService criaria mentor sem a role, que veria o menu de mentor e tomaria
403 em tudo. O cadastro (`mentor_perfil`) e gravado logo depois, fora da
transacao, porque e opcional; a validacao dele roda ANTES, para campo invalido
nao deixar usuario orfao. O mesmo `DrawerMentor` serve para cadastrar e editar
(a secao "Quem e" so aparece no novo).

**Nao ha caminho para PROMOVER quem ja esta na incubadora** a partir de
`/mentores`, de proposito: `tenantService.atualizarUsuario` troca o papel mas
**nao chama `alocarRolePadrao`** — quem vira mentor por /usuarios fica com a
role antiga e sem as chaves de mentor. E um buraco pre-existente de /usuarios;
oferecer o atalho aqui so multiplicaria o sintoma.

**Tres origens na mesma linha da tabela, nao confundir:** CADASTRO
(`mentor_perfil`, digitado pela coordenacao — vinculo institucional, area,
especialidades, demandas, disponibilidade em h/mes, formato, status,
observacoes); CARGA (startups + entregas paradas); HISTORICO ("ultima mentoria"
e "mentorias no periodo"), que **sai da AGENDA** — eventos de categoria
`MENTORIA` ja ocorridos com `evento.id_usuario_mentor` apontando para ele.
Ninguem digita o historico em `/mentores`: quem o preenche e quem marca as
atividades no calendario. A janela (`?dias=`) e escolhida na barra da tabela.

**`evento.id_usuario_mentor` e novo (016)** e convive com `mentor_nome`, no
mesmo desenho de `id_local`/`local`: um ou outro, nunca os dois, e o
`SELECT_EVENTO` resolve com `COALESCE` — por isso as telas que exibem
`mentor_nome` nao mudaram. Convidado de fora continua entrando como texto. O
backfill da migracao so casa nome que bate com UM mentor do tenant.

**`mentor_perfil.situacao` (ATIVO/INDISPONIVEL/INATIVO) NAO e
`tenant_usuarios.ativo`**: e o que a coordenacao sabe, nao o acesso. Marcar
"Inativo" ali nao tira login nem fila de ninguem — isso e `/usuarios`.
Especialidades e demandas sao `TEXT[]`, e nao vocabulario por tenant como
`startup_tipo`: nao ha codigo atras do valor, e o autocomplete sugere o que ja
esta em uso — os filtros de vinculo/area/especialidade/demanda sao montados a
partir dos dados, como o filtro de UF em `/startups`.

O estado destacado em laranja continua sendo "mentor sem nenhuma startup": ele
entra no sistema e ve a fila vazia sem nenhuma pista de que falta alguem
liga-lo a uma startup.

**Nao ha mais nenhuma tela em Placeholder.** As quatro que faltavam sairam em
19/07/2026: `/mentores`, `/eventos/presenca` (ver
[[presenca-vs-confirmacao-em-eventos]]), `/startups/membros` e `/avaliacoes`.
`ROTAS_PLACEHOLDER` deixou de existir em `App.jsx`; `pages/Placeholder.jsx`
ficou orfao mas nao foi apagado.

**Tres telas olham para a avaliacao — nao confundir:**
`/entregas` = o que FALTA responder (fila, recorte por `mentor_startup`);
`/feedback` = o que EU respondi (`listarPorAvaliador`, mentor);
`/avaliacoes` = o que TODOS responderam (`listarPorTenant`, admin-ou-root).
A ultima existe para vigiar a QUALIDADE da mentoria, nao a decisao: destaca a
devolutiva sem comentario (decisao seca, que nao ensina nada a quem recebeu) e
o tempo de resposta. Note que `dias_resposta` usa `entrega.atualizado_ts`, que o
reenvio atualiza — entao ele mede a rodada atual, nao a espera desde o primeiro
envio.

**`/startups/membros`** existe pelo mesmo motivo do "mentor sem startups": achar
o incubado que nao esta em NENHUMA startup (`startupRepository.listarSemStartup`).
Sem vinculo ele nao tem jornada nem entrega e nada na tela dele explica o porque.
O filtro `papel = 'usuario'` na query e essencial: admin e mentor tambem nao
pertencem a startup alguma, e sem ele os dois apareceriam como problema.

Related: [[anexos-nao-sao-enviados-ao-servidor]]
