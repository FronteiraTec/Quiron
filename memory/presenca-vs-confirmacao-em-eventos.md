---
name: presenca-vs-confirmacao-em-eventos
description: evento_confirmacao (RSVP) e evento_presenca (check-in) sao coisas diferentes — e nada nunca escreve na segunda
metadata:
  type: project
---

Sao DUAS tabelas com nomes parecidos e significados diferentes:

- `evento_confirmacao` — o RSVP, "pretendo ir". Status em `STATUS_CONFIRMACAO`.
  Escrita por `POST /eventos/:id/confirmar` (o proprio usuario).
- `evento_presenca` — o check-in, "esteve la". Tem `presente`, `checkin_ts` e
  `marcado_por` (alguem marca por voce — e ato do admin, nao do participante).

**A armadilha:** `eventoRepository.confirmarPresenca` e
`eventoService.confirmarPresenca` tem "presenca" no nome mas gravam em
`evento_confirmacao`. O nome mente; nao conclua pelo nome que existe check-in.

**O buraco, fechado em 19/07/2026:** `evento_presenca` era LIDA pelo relatorio
de engajamento mas nada nunca escrevia nela — a taxa de presenca ficava em 0%
para sempre. A tela `/eventos/presenca` (`pages/PresencaEventos.jsx`) e a UNICA
escrita nessa tabela: `POST /eventos/:id/presenca` com `{id_usuarios, presente}`,
que serve tanto uma pessoa quanto o lote.

**A regra do publico esta DUPLICADA e precisa continuar igual:**
`eventoRepository.listarPublico` (uma pessoa por linha, um evento) e
`SQL_PUBLICO_EVENTOS` em `relatorioRepository` (um par evento-pessoa por linha,
periodo inteiro). Formas diferentes, mesmo criterio: membros ativos
(`startup_membros.ativo`) de startups nao encerradas do tenant, respeitando o
direcionamento. Divergir faz a tela marcar quem o relatorio nao conta. Ha
comentario cruzado nos dois arquivos.

**Tres estados, nao dois:** `presente=true` (esteve la), `presente=false`
(faltou, foi conferido) e SEM LINHA (nao conferido). "Faltou" e "ainda nao
conferi" sao coisas distintas — por isso o resumo tem `marcados` (tem linha,
qualquer valor) alem de `presentes`. O mentor NAO entra no publico: o vinculo
dele e `mentor_startup`, e publico sai de `startup_membros`.

Related: [[telas-do-mentor-entregas-e-feedback]]
