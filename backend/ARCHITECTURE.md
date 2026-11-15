# Arquitetura do Backend — Layered Architecture

O backend segue **arquitetura em camadas**. Cada requisição flui de cima para
baixo, e cada camada só conhece a camada imediatamente abaixo:

```
HTTP  →  Routes  →  Controllers  →  Services  →  Repositories  →  PostgreSQL
                       (HTTP)      (regra de     (acesso a
                                    negócio)      dados / SQL)
```

## Responsabilidade de cada camada

| Camada | Pasta | Responsabilidade |
|---|---|---|
| **Routes** | `src/routes/` | Define os endpoints e liga-os aos controllers/middlewares. |
| **Controllers** | `src/controllers/` | Fino: lê `req`, chama o service, devolve `res`. Sem regra de negócio. |
| **Services** | `src/services/` | Regra de negócio, validações e orquestração de repositórios. |
| **Repositories** | `src/repositories/` | Único lugar com SQL. Um por agregado do `schema.sql`. |
| **Middlewares** | `src/middlewares/` | Autenticação (Bearer Token) e tratamento central de erros. |
| **Config** | `src/config/` | Conexão com o banco (pool `pg`). |
| **Utils** | `src/utils/` | Ferramentas puras: SHA-256 (`senha.js`) e JWT (`jwt.js`). |

## Mapa: tabelas do `schema.sql` → repositórios

| Repositório | Tabelas cobertas |
|---|---|
| `usuarioRepository` | `usuarios` |
| `preferenciaRepository` | `usuario_preferencias` |
| `tenantRepository` | `tenant`, `tenant_usuarios` |
| `startupRepository` | `startup`, `startup_membros`, `mentor_startup`, `startup_fase` |
| `faseRepository` | `fase` |
| `moduloRepository` | `modulo` |
| `tarefaRepository` | `tarefa` |
| `questionarioRepository` | `questionarios`, `pergunta`, `alternativa` |
| `entregaRepository` | `entrega`, `resposta` |
| `avaliacaoRepository` | `avaliacao` |
| `eventoRepository` | `evento`, `evento_confirmacao`, `evento_presenca` |
| `auditLogRepository` | `audit_log` |
| `mentorMaterialRepository` | `mentor_material` (biblioteca pessoal do mentor, migração 020) |
| `mentorCompartilhamentoRepository` | `mentor_compartilhamento` (material → startup, trilha e etapa) |
| `materialIncubadoraRepository` | `mentor_material_incubadora` (o que a incubadora publica para os mentores, migração 021) |
| `beneficioRepository` | `startup_beneficio` (o que a incubadora concede a cada startup, migração 026) e o portão de acesso ao CRM |
| `crmEtapaRepository` | `crm_etapa` (as etapas abertas do funil de cada startup) |
| `crmClienteRepository` | `crm_cliente` |
| `crmOportunidadeRepository` | `crm_oportunidade` |
| `crmTarefaRepository` | `crm_tarefa` (tarefas comerciais da startup — não confundir com `tarefa`, a gestão interna da incubadora) |
| `crmEventoRepository` | `crm_evento` (o histórico: só insere e lê; o banco recusa UPDATE e DELETE) |
| `crmPainelRepository` | leituras agregadas do painel do CRM |
| `reuniaoRepository` | `reuniao`, `reuniao_participante`, `reuniao_sessao` (reuniões por vídeo, migração 027) |
| `reuniaoGravacaoRepository` | `reuniao_audio`, `reuniao_trecho`, o consentimento em `reuniao_participante` e `reuniao.transcricao` (migração 028) |
| `reuniaoProcessamentoRepository` | `reuniao_processamento` e `_log` — a fila do lote noturno, no Postgres |
| `iaConfigRepository` | `tenant_ia_config` (a chave de API, cifrada aqui) e a retenção das reuniões em `tenant` |

### Reuniões por vídeo (migração 027)

Desenho completo em `docs/reunioes.md`. Toda reunião **é um evento da Agenda**:
`reuniaoService.criar` cria os dois na mesma transação (o `eventoRepository`
aceita o `client` da transação em `criar`/`atualizar`/`excluir`), e título e
horário moram no evento. O **público** do evento de uma reunião são os
convidados, e não as startups — a regra mora em
`eventoRepository.sqlPublicoEventos` (presença, e-mail, relatório) e
`sqlUsuarioVeEvento` (Google Agenda).

O vídeo passa pelo LiveKit Cloud (`src/reunioes/livekit.js`). O webhook
(`POST /livekit/webhook`) é público e protegido pela assinatura do LiveKit; o
`app.js` monta um `express.raw` para esse caminho **antes** do `express.json`,
porque a assinatura confere os bytes exatos do corpo. Sem `LIVEKIT_URL`,
`LIVEKIT_API_KEY` e `LIVEKIT_API_SECRET`, o módulo fica invisível.

**Gravação e transcrição (migração 028).** O navegador de quem aceitou grava
o próprio microfone e manda um pedaço a cada 10 s
(`PUT /reunioes/:id/gravacoes/:idAudio/partes/:n`, corpo cru com
`express.raw` só nessa rota) para o volume `audio`. Nenhuma requisição
transcreve:
- encerrar a reunião cria o job na mesma transação
  (`reuniaoGravacaoService.aoEncerrar`);
- quem transcreve é o **lote noturno**, `src/reunioes/lote.js`, rodado pelo
  container `processamento` (perfil próprio na compose, disparado pelo cron
  via `scripts/processamento.sh`) só fora do expediente e com a máquina
  ociosa.

O lote recebe o `ffmpeg` (`audioConversor`), o disco e o provedor por
injeção, e é por isso que o teste roda sem nenhum deles. As regras de quem
alcança a reunião moram em `services/reuniaoAcesso.js`, usado pelos dois
services de reunião.

### Mini CRM (migração 026)

Toda rota do CRM leva a startup na URL (`/crm/:idStartup/...`) e nenhuma confia
nela: cada service começa por `crmAcessoService.exigirAcesso`, que confere no
banco que quem pede é **membro ativo** da startup e que o benefício CRM está
**ativo**. O histórico (`crm_evento`) é gravado pelo service na mesma transação
da escrita que o originou — o autor sai da sessão e a data do `NOW()` do banco.
As frases e as comparações de campo ficam em `src/crm/historico.js`, testadas
sem banco.

## Como adicionar uma nova feature (ex.: Startups)

1. **Repository** — já existe `startupRepository.js` (SQL).
2. **Service** — criar `services/startupService.js` (regra de negócio).
3. **Controller** — criar `controllers/startupController.js` (HTTP).
4. **Route** — criar `routes/startupRoutes.js` e registrar em `routes/index.js`.

A fatia de **auth** (`usuarioRepository` → `authService` → `authController` →
`authRoutes`) serve de referência completa do padrão.
