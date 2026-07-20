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

**Backend de `/mentores` existe** (mentorRepository/Service/Controller/Routes):
`GET /mentores?id_tenant=`, `GET|POST /mentores/:idUsuario/startups`,
`DELETE /mentores/:idUsuario/startups/:idStartup`, e `GET /startups/:id/mentores`.
Autorizacao: admin do tenant ou root, via `tenantService.garantirAcessoTenant`
— o catalogo RBAC preve acoes granulares (visualizar/vincular/desvincular) mas,
como no resto do sistema, o que vale no service e admin-ou-root.

**A tela `/mentores` foi feita em 19/07/2026** (`pages/Mentores.jsx` +
`components/mentores/` + `hooks/useMentores.js`), mestre-detalhe no mesmo molde
de `/entregas`. Ela existe para UMA decisao — distribuir startups entre
mentores — por isso a lista mostra carga (startups + entregas paradas) e nao
dado cadastral; cadastro de pessoa e `/usuarios`. O estado destacado em laranja
e "mentor sem nenhuma startup": ele entra no sistema e ve a fila vazia sem
nenhuma pista de que falta alguem liga-lo a uma startup.

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
