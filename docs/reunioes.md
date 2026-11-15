# Reuniões por vídeo, transcrição e relatório por IA

Mentores e startups fazem a reunião dentro do Quíron. O áudio de cada
participante que aceitou é gravado e, **fora do horário de serviço**, é
transcrito e resumido num relatório estruturado pela IA que a própria
incubadora configurou. O mentor revisa e aprova o relatório antes de ele
valer.

> **Estado:** desenho aprovado em 04/11/2026 (Etapas 1 e 2). **Etapa 3
> (videoconferência) implementada em 04/11/2026** e **Etapa 4 (gravação e
> transcrição) implementada em 14/11/2026**, ainda sem commit: migrações 027 e
> 028, API, webhook, lote noturno, telas e testes automatizados verdes. O
> projeto de dev do LiveKit Cloud foi criado e testado na máquina local em
> 14/11. Falta o que só se faz no servidor e com gente de verdade: a CSP, o
> cron do lote, a chave de transcrição e uma reunião real transcrita à noite
> (seções 13.3 e 14.3). As decisões tomadas na implementação estão nas seções
> 13.2 e 14.2. As migrações começam na **027** — a 026 é o Mini CRM.
>
> **Revisão de 04/11/2026:** não há bucket externo disponível. O áudio fica
> **na própria VPS**, num volume Docker, e é gravado pelo navegador de cada
> participante (decisões 3 e 4).

---

## 1. Decisões

| # | Decisão | Alternativa descartada | Por quê |
|---|---|---|---|
| 1 | **LiveKit Cloud** cuida do vídeo e do áudio da sala (não grava nada) | LiveKit próprio na VPS | A VPS tem 2 GB e dois ambientes, o Caddy ocupa a 443 e o TURN precisaria de outra porta. Rede de universidade bloqueia UDP com frequência. Trocar depois é só trocar `LIVEKIT_URL` e as chaves. |
| 2 | **Todo processamento pesado roda numa janela fora do horário de serviço, e só com a máquina ociosa** | Agente de transcrição ao vivo durante a reunião | Decisão do responsável pelo servidor: a VPS não pode dividir memória com um agente durante o expediente. **Consequência aceita:** não há transcrição ao vivo na sala, e o relatório fica pronto na manhã seguinte. |
| 3 | **O navegador de cada participante grava o próprio microfone** (`MediaRecorder`, Opus a ~24 kbps) e manda um pedaço a cada 10 s para a API. Transcrição em lote depois | Gravação pelo LiveKit (Track Egress) num bucket: não há bucket. Track Egress por WebSocket direto para o backend: áudio sem compressão (centenas de MB por hora por pessoa), conexão viva que cai a cada deploy, WebSocket atravessando Caddy e nginx, e gravação cobrada por minuto. LiveKit Agents: processo vivo durante a reunião | Cada arquivo continua sendo a voz de **uma** pessoa, com o login dela: quem falou não depende de reconhecimento de voz. A VPS só recebe ~30 KB a cada 10 s por pessoa e grava em disco; nada é processado durante o dia. Se o backend reinicia no meio da reunião, o navegador reenvia o pedaço e nada se perde. **Custo aceito:** se a aba fecha de repente, perde-se no máximo o último pedaço (até 10 s). |
| 4 | Áudio **na própria VPS**, num volume Docker só dele (`audio`), no padrão do volume `uploads` | Bucket externo (indisponível); MinIO ou Garage na VPS servindo de bucket | Um servidor S3 local ficaria ligado o dia inteiro e exposto na internet, o que a decisão 2 proíbe. O volume já é o padrão do projeto para arquivos, não traz serviço novo, e o áudio vive pouco: é apagado depois de transcrito. Volume separado para não misturar com os uploads e para o `processamento` montar só ele. |
| 5 | **Fila no PostgreSQL** (`reuniao_processamento` + `FOR UPDATE SKIP LOCKED`) | BullMQ + Redis | O job nasce na mesma transação que consolida a transcrição (sem gravar no banco e perder na fila). O histórico de processamento já precisa estar no Postgres, o backup de antes do deploy já cobre, e não entra serviço novo em dois ambientes. |
| 6 | **A chave de API é da incubadora**, em dois slots: Transcrição e Relatório | Chave da plataforma | O briefing põe o custo de IA na incubadora. Sem o slot de Transcrição, a reunião funciona, mas não é gravada. |
| 7 | **Só usuários do Quíron** entram na sala na primeira versão | Link para convidado externo | O link anônimo abre um caminho sem login e exige um consentimento à parte. Fica para depois. |
| 8 | **Toda reunião é um evento da Agenda** (`reuniao.id_evento`) | Agendamento próprio | Título, horário, startups, Google Agenda, e-mail e presença já existem no `evento`. Duplicar seria manter dois calendários. |
| 9 | Ações do relatório viram **tarefa do quadro interno** (`tarefa`), sempre por um clique humano; a startup leva para o **próprio** CRM | Mentor criando atividade no CRM da startup | Pela regra do Mini CRM, só membros da startup entram nele (`crmAcessoService`). |
| 10 | **Dispositivo compartilhado:** a fala vai para o dono do login, e o aviso da sala diz isso | Diarização por voz | Aceito em 04/11/2026. Diarização erra mais e atribuiria fala a quem não disse. |
| 11 | JavaScript com JSDoc, provedores de IA e STT via `fetch`, sem SDK | TypeScript; SDKs oficiais | É o padrão do projeto (o cliente do Google também é `fetch` puro). |
| 12 | `ajv` valida o relatório contra **o mesmo** JSON Schema que é enviado aos provedores | Validador escrito à mão | Um schema só. Um validador manual seria um segundo espelho que diverge com o tempo. |

---

## 2. Componentes

```
DURANTE O EXPEDIENTE — nada pesado na VPS

  Navegador ── WebRTC ──► LiveKit Cloud (vídeo e áudio da sala)
     │                         └── webhooks ──► backend
     └── /api ──► backend (Express) ──► PostgreSQL
                    │ token da sala, webhooks,
                    └ pedaços de áudio de quem consentiu ──► volume `audio`

FORA DO EXPEDIENTE, COM A MÁQUINA OCIOSA

  timer do servidor ──► container `processamento` (sobe, trabalha, sai)
     1. junta os pedaços e transcreve cada gravação (STT da incubadora) ──► reuniao_trecho
     2. consolida a reunião e, na mesma transação, cria o job do relatório
     3. gera o relatório (IA da incubadora), valida e grava RASCUNHO v1
     4. notifica, apaga o áudio transcrito e aplica a retenção
```

| Componente | Onde | O que faz |
|---|---|---|
| Backend | o de hoje | CRUD de reuniões, token do LiveKit, webhook, recebimento dos pedaços de áudio, configuração de IA, relatórios. |
| LiveKit Cloud | externo | Só a mídia da sala (SFU + TURN). Não grava e não guarda nada. |
| Volume `audio` | VPS, montado em `/app/audio` | Os pedaços em `<id_tenant>/<id_reuniao>/<id_audio>/<n>.parte`. Montado só no backend e no `processamento`; nenhuma rota serve esses arquivos. |
| `processamento` | container novo, **mesma imagem do backend**, outro comando (como a `migracao`) | O lote noturno. Não fica de pé: o timer o inicia e ele sai sozinho. |
| Provedores de STT e de IA | externos, escolhidos pela incubadora | Chamados só pelo `processamento` e pelo teste de conexão. É o único caminho pelo qual o áudio sai do servidor. |

A imagem do backend ganha o `ffmpeg` (apk), usado para juntar, converter e
fatiar o áudio. Custa algumas dezenas de MB na imagem e evita uma terceira
imagem no deploy.

**Disco:** a ~24 kbps, uma hora de fala ocupa ~11 MB por pessoa. Uma mentoria
de 1 h com 4 pessoas fica em ~45 MB até a manhã seguinte. Abaixo de
`AUDIO_DISCO_MIN_MB` livres, a API para de aceitar pedaços: a reunião segue,
e a transcrição sai `INCOMPLETA` com o motivo.

---

## 3. Fluxos

### 3.1. Criar e entrar

1. Quem tem `reunioes.reunioes.criar` cria a reunião. O service cria o
   `evento` (categoria `REUNIAO` ou `MENTORIA`) e a `reuniao` na mesma
   transação, e grava os convidados em `reuniao_participante`. O e-mail e o
   Google Agenda saem pelo caminho que o evento já tem.
2. Na hora, o convidado abre `/reunioes/:id/sala`. O front pede
   `POST /reunioes/:id/token`, e o backend só emite se:
   - a pessoa é convidada (ou anfitriã);
   - a reunião não foi encerrada nem cancelada;
   - faltam no máximo 15 minutos para o início.
3. **Antes de ligar câmera e microfone**, a tela mostra o aviso de gravação
   (seção 7) e a pessoa escolhe: aceitar ou entrar sem ter a fala gravada. A
   escolha vai para `POST /reunioes/:id/consentimento`.

Token do LiveKit:
- identidade `u-<id_usuario>`, nome de exibição, metadados `{ id_usuario, papel }`;
- vale só para a sala da reunião, por 10 minutos (o LiveKit renova a sessão
  sozinho depois de conectada).

### 3.2. Durante a reunião

| Webhook do LiveKit | O que o backend faz |
|---|---|
| `room_started` | `reuniao.status = EM_ANDAMENTO`, `iniciada_ts`. |
| `participant_joined` / `participant_left` | Abre e fecha uma linha em `reuniao_sessao`. É daí que sai a sugestão de presença. |
| `room_finished` | Garante `ENCERRADA` mesmo que ninguém tenha clicado em encerrar. |

O webhook é público e vem assinado pelo LiveKit. O backend confere a
assinatura com o corpo cru: o tipo é `application/webhook+json`, que o
`express.json()` não consome. Cada evento é idempotente pelo id que o
LiveKit manda, então reenvio não duplica nada.

**Gravação, no navegador de cada um.** Quem consentiu, numa reunião com
`gravar_audio` e com o slot de Transcrição ativo na incubadora:

1. **Abre uma gravação:** `POST /reunioes/:id/gravacoes` cria uma linha em
   `reuniao_audio` (`GRAVANDO`). O `inicio_ts` vem do **relógio do servidor**,
   para as falas de pessoas diferentes ficarem na mesma linha do tempo. Só
   então o navegador liga o `MediaRecorder` sobre a mesma faixa de microfone
   que publicou no LiveKit, que já sai com o cancelamento de eco.
2. **Manda um pedaço a cada 10 s:** `PUT .../gravacoes/:idAudio/partes/:n`,
   com o áudio cru no corpo. O backend grava `<n>.parte` com criação
   exclusiva: um reenvio do mesmo pedaço responde 200 sem duplicar. Pedaço que
   falhou fica numa fila em memória e é reenviado com espera crescente.
3. **Fecha a gravação:** `POST .../gravacoes/:idAudio/fechar` ao sair, ao
   encerrar ou ao retirar o consentimento (`DISPONIVEL`).

Silenciar o microfone **não** abre outra gravação: o LiveKit desativa a faixa
sem destruí-la, e o gravador registra silêncio, então a linha do tempo segue
certa. Abre-se uma gravação nova quando a faixa muda de fato: reconexão,
recarregar a página ou trocar de microfone. Se o navegador some sem fechar, o
servidor fecha a gravação pelo último pedaço recebido (seção 3.3).

Quem retira o consentimento no meio da reunião tem a gravação parada na hora.
O navegador desliga o gravador, e o backend recusa qualquer pedaço que chegue
depois de `consentimento_revogado_ts`.

### 3.3. Encerrar

`POST /reunioes/:id/encerrar` (anfitrião):
1. marca `ENCERRADA` e fecha a sala no LiveKit (`deleteRoom`);
2. responde **202** na hora.

Nada de transcrição ou relatório dentro dessa requisição.

**Consolidação da gravação:** a mesma transação que marca `ENCERRADA` (pelo
botão ou pelo `room_finished`) cria o job `TRANSCRICAO` (`PENDENTE`), se a
reunião tem alguma gravação. Os navegadores ainda têm **10 minutos** para
mandar os últimos pedaços. Depois disso, o backend recusa novos pedaços.

O lote só pega reunião encerrada há mais de 10 minutos. Antes de transcrever,
fecha as gravações que ficaram em `GRAVANDO`, com `fim_ts` igual ao último
pedaço recebido. Reunião que nunca foi encerrada (todos fecharam a aba e o
`room_finished` se perdeu) é encerrada pelo lote quando não chega pedaço há
mais de uma hora.

### 3.4. A janela noturna

**Quando roda.** O timer do servidor chama `scripts/processamento.sh` a cada
30 minutos. O script não sobe container nenhum fora da janela nem com a
máquina carregada. Dentro da janela, executa
`docker compose run --rm processamento` com `flock`, para nunca haver dois
ao mesmo tempo.

A janela abre quando as três condições valem:

| Condição | Padrão | Variável |
|---|---|---|
| Hora local dentro da janela | 19:00 às 07:00; sábado e domingo, o dia todo | `PROCESSAMENTO_JANELA`, `PROCESSAMENTO_FIM_DE_SEMANA` |
| CPU ociosa: load average de 1 minuto ÷ nº de CPUs | abaixo de 0,6 | `PROCESSAMENTO_CARGA_MAX` |
| Memória livre do host (`MemAvailable` de `/proc/meminfo`) | acima de 500 MB | `PROCESSAMENTO_MEMORIA_MIN_MB` |

Dentro do container o `loadavg` e o `/proc/meminfo` são os do host, que é o
que interessa medir. O worker repete a checagem **antes de cada item**:
- se a máquina ficou ocupada, espera 5 minutos e confere de novo;
- se a janela fechou, termina o item em curso (cada um tem timeout) e sai.

Todo trabalho é retomável, então parar no meio não perde nada.

**O que roda, em ordem:**
1. **Recuperação:** jobs `PROCESSANDO` com `travado_ate` vencido (o worker
   anterior morreu) voltam a `PENDENTE`.
2. **Transcrição** (job `TRANSCRICAO`):
   1. Para cada `reuniao_audio` em `DISPONIVEL`, junta os pedaços em ordem.
      O `ffmpeg` converte o resultado num OGG/Opus mono e preenche com
      silêncio o buraco de um pedaço que não chegou, para não deslocar o resto.
      Depois chama o STT da incubadora.
   2. Grava os trechos e marca a gravação `TRANSCRITO`.
   3. Quando todas as gravações terminam, **numa transação**:
      - grava `reuniao.transcricao` como `COMPLETA`, ou `INCOMPLETA` com o
        motivo (ex.: "faltam 40 s da gravação de Ana", "disco cheio às 15h10");
      - cria o job `RELATORIO`.
3. **Relatório** (job `RELATORIO`): começa **logo depois** da consolidação,
   no mesmo lote, sem espera artificial. O detalhe está na seção 6.
4. **Limpeza:**
   - apaga do volume o áudio já transcrito (`EXCLUIDO`), salvo se a
     incubadora configurou retenção de áudio;
   - apaga qualquer pasta de áudio com mais de 30 dias, mesmo que o banco
     não saiba dela (rede de segurança contra falha no meio do caminho);
   - aplica a retenção das transcrições.

Em dev e na máquina local, `node src/workers/processamento.js --ignorar-janela`
roda na hora. A flag é recusada com `NODE_ENV=production`.

---

## 4. Modelo de dados (migração 027 em diante)

Convenções do projeto mantidas:
- nomes no singular;
- `*_ts TIMESTAMP`;
- enum só onde há código atrás do valor;
- **FK composta com `id_tenant`** em toda tabela filha, para o banco recusar
  uma linha que aponte para a reunião de outra incubadora, mesmo que o
  service falhe em conferir (o desenho do Mini CRM).

Em `evento`, entra `CONSTRAINT uq_evento_dono UNIQUE (id_tenant, id_evento)`,
o alvo da FK composta. A mudança é não destrutiva, porque `id_evento` já é
único.

```
reuniao
  id_reuniao         INTEGER IDENTITY  PK
  id_tenant          INTEGER  NOT NULL → tenant
  id_evento          INTEGER  NOT NULL UNIQUE
                     FK (id_tenant, id_evento) → evento   ON DELETE RESTRICT
  id_startup         INTEGER  NULL     FK (id_tenant, id_startup) → startup
  sala               VARCHAR(64) NOT NULL UNIQUE   -- 'q-' + uuid, sem dado pessoal
  status             reuniaoStatus  AGENDADA | EM_ANDAMENTO | ENCERRADA | CANCELADA
  gravar_audio       BOOLEAN NOT NULL DEFAULT TRUE -- o anfitrião pode desligar
  transcricao        reuniaoTranscricao  PENDENTE | COMPLETA | INCOMPLETA | DESATIVADA
  transcricao_obs    TEXT     -- por que ficou incompleta
  id_anfitriao       INTEGER  NOT NULL → usuarios
  iniciada_ts, encerrada_ts, encerrada_por, criado_por, criado_ts, atualizado_ts
  UNIQUE (id_tenant, id_reuniao)              -- alvo das FKs compostas

reuniao_participante
  id_tenant, id_reuniao   FK (id_tenant, id_reuniao) → reuniao  ON DELETE CASCADE
  id_usuario              → usuarios
  papel                   reuniaoPapel  ANFITRIAO | PARTICIPANTE
  consentiu_ts            TIMESTAMP NULL    -- NULL = não grava a fala dela
  consentimento_revogado_ts TIMESTAMP NULL
  convidado_por, convidado_ts
  PK (id_reuniao, id_usuario)

reuniao_sessao                              -- entradas e saídas (webhook)
  id_sessao BIGINT IDENTITY, id_tenant, id_reuniao, id_usuario NULL,
  identidade_livekit, sid_participante UNIQUE, entrou_ts, saiu_ts

reuniao_audio                               -- uma gravação contínua de UMA pessoa
  id_audio BIGINT IDENTITY, id_tenant, id_reuniao,
  id_usuario NOT NULL → usuarios              -- quem enviou (o login)
  status reuniaoAudioStatus  GRAVANDO | DISPONIVEL | TRANSCRITO | FALHOU | EXCLUIDO
  mime VARCHAR(60) NOT NULL                   -- audio/webm, audio/ogg, audio/mp4
  partes INTEGER DEFAULT 0, ultima_parte INTEGER NULL, tamanho_bytes BIGINT DEFAULT 0
  inicio_ts NOT NULL (relógio do servidor), ultima_parte_ts, fim_ts,
  erro, transcrito_ts, excluido_ts
  UNIQUE (id_tenant, id_audio)
  -- o caminho no disco sai só dos ids; nada que o cliente mande vira caminho

reuniao_trecho                              -- o que foi dito
  id_trecho BIGINT IDENTITY, id_tenant, id_reuniao,
  id_audio  FK (id_tenant, id_audio) → reuniao_audio
  id_usuario NOT NULL                       -- copiado da gravação
  ordem     INTEGER   UNIQUE (id_audio, ordem)   -- reprocessar não duplica
  texto     TEXT NOT NULL
  inicio_ts, fim_ts   TIMESTAMP NOT NULL         -- absolutos
  origem    VARCHAR(80)                          -- 'OPENAI:whisper-1'
  persistido_ts DEFAULT NOW()
  INDEX (id_reuniao, inicio_ts)

reuniao_processamento                       -- a fila E o histórico
  id_processamento BIGINT IDENTITY, id_tenant, id_reuniao,
  tipo    reuniaoProcTipo    TRANSCRICAO | RELATORIO
  status  reuniaoProcStatus  PENDENTE | PROCESSANDO | CONCLUIDO | FALHOU | CANCELADO
  tentativas, max_tentativas DEFAULT 5, proxima_tentativa_ts DEFAULT NOW(),
  travado_ate,                               -- prazo do worker (recuperação)
  erro_codigo, erro_mensagem,                -- sem segredo (seção 7)
  provedor, modelo, tokens_entrada, tokens_saida, segundos_audio, duracao_ms,
  solicitado_por NULL,                       -- preenchido no reprocessamento manual
  criado_ts, iniciado_ts, concluido_ts
  UNIQUE INDEX (id_reuniao, tipo) WHERE status IN ('PENDENTE','PROCESSANDO')
  CHECK (status <> 'PROCESSANDO' OR travado_ate IS NOT NULL)

reuniao_processamento_log                   -- cada tentativa; só insere
  id_processamento, tentativa, evento (INICIO|SUCESSO|ERRO|ADIADO), detalhe JSONB, criado_ts

reuniao_relatorio
  id_relatorio IDENTITY, id_tenant, id_reuniao UNIQUE,
  status  reuniaoRelatorioStatus  RASCUNHO | APROVADO
  versao_atual INTEGER NOT NULL
  compartilhado_participantes BOOLEAN NOT NULL DEFAULT FALSE
  aprovado_por, aprovado_ts, atualizado_ts

reuniao_relatorio_versao                    -- imutável (trigger, como crm_evento)
  id_relatorio, versao, conteudo JSONB NOT NULL,
  verificacao JSONB,                         -- resultado da checagem de evidências
  origem  IA | EDICAO,  id_processamento NULL,  autor NULL (= IA),
  resumo_alteracao TEXT, criado_ts
  PK (id_relatorio, versao)

tenant_ia_config
  id_tenant  → tenant ON DELETE CASCADE
  finalidade iaFinalidade  TRANSCRICAO | RELATORIO
  provedor   iaProvedor    OPENAI | ANTHROPIC | GEMINI | OPENAI_COMPATIVEL | DEEPGRAM
  CHECK (finalidade = 'TRANSCRICAO' AND provedor IN ('OPENAI','DEEPGRAM','OPENAI_COMPATIVEL')
      OR finalidade = 'RELATORIO'   AND provedor IN ('OPENAI','ANTHROPIC','GEMINI','OPENAI_COMPATIVEL'))
  modelo VARCHAR(100) NOT NULL, url_base VARCHAR(255) NULL,
  chave_cifrada TEXT NOT NULL, chave_final VARCHAR(4),
  prompt_personalizado TEXT NULL, ativo BOOLEAN,
  ultima_validacao_ts, ultima_validacao_ok, ultima_validacao_erro,
  atualizado_por, atualizado_ts
  PK (id_tenant, finalidade)
```

Retenção, por incubadora, em colunas de `tenant` (como a configuração de
e-mail):
- `reuniao_retencao_audio_dias`: padrão 0, apaga logo depois de transcrever;
- `reuniao_retencao_transcricao_dias`: padrão 180.

O relatório aprovado fica até alguém excluí-lo: é documento de trabalho.

Em `reuniao_relatorio`, só a versão atual é apontada. O conteúdo mora apenas
em `reuniao_relatorio_versao`, sem cópia.

---

## 5. Contratos

### 5.1. API

| Método e rota | Quem | Observação |
|---|---|---|
| `GET /reunioes?id_tenant=&de=&ate=&status=` | todos | O convidado vê as suas; `reunioes.reunioes.visualizar` vê todas. |
| `POST /reunioes` | `reunioes.reunioes.criar` | Cria o evento junto. |
| `GET` / `PUT` / `DELETE /reunioes/:id` | anfitrião ou chave | `DELETE` só em `AGENDADA`; depois disso, cancelar. |
| `POST /reunioes/:id/cancelar` | anfitrião ou chave | |
| `PUT /reunioes/:id/participantes` | anfitrião ou chave | Só convidados que pertencem à incubadora. |
| `POST /reunioes/:id/token` | convidado | `{ token, url }`. |
| `POST /reunioes/:id/consentimento` | convidado | `{ aceito }`. Libera ou corta a gravação da própria fala. |
| `POST /reunioes/:id/gravacoes` | convidado que consentiu | `{ mime }` → `{ id_audio, segundos_por_parte }`. 409 sem consentimento, sem slot de Transcrição, com `gravar_audio` desligado ou com o disco abaixo do mínimo. |
| `PUT /reunioes/:id/gravacoes/:idAudio/partes/:n` | a dona da gravação | Corpo cru `audio/*`, até 512 KB (`express.raw` só nesta rota). Idempotente por `n`. Aceito só com a reunião em andamento ou até 10 min depois de encerrada. |
| `POST /reunioes/:id/gravacoes/:idAudio/fechar` | a dona da gravação | `DISPONIVEL`. |
| `POST /reunioes/:id/encerrar` | anfitrião | 202. |
| `GET /reunioes/:id/transcricao` | anfitrião ou `reunioes.transcricoes.visualizar` | Grava a leitura no `audit_log`. |
| `GET /reunioes/:id/processamentos` | anfitrião ou chave | Histórico, com as tentativas. |
| `POST /reunioes/:id/processamentos` | `reunioes.relatorios.reprocessar` | `{ tipo }`. 409 se já há job ativo. Roda na próxima janela. |
| `POST /reunioes/processamentos/:id/cancelar` | idem | Só `PENDENTE`. |
| `GET /reunioes/:id/relatorio` e `/versoes` | ver a seção 8 | |
| `PUT /reunioes/:id/relatorio` | revisor | `{ conteudo, versao_base, resumo_alteracao }`. 409 se `versao_base` não é a atual. |
| `POST /reunioes/:id/relatorio/aprovar` | revisor | `{ compartilhar_participantes }`. |
| `POST /reunioes/:id/relatorio/reabrir` | revisor | Volta a `RASCUNHO`. |
| `GET /ia-config?id_tenant=` | `configuracoes.ia.visualizar` | **Nunca** devolve a chave, só `chave_final`. |
| `PUT /ia-config/:finalidade` | `configuracoes.ia.editar` | Chave omitida = mantém a atual. |
| `POST /ia-config/:finalidade/testar` | `configuracoes.ia.editar` | Grava `ultima_validacao_*`. |
| `POST /livekit/webhook` | LiveKit (assinado) | Público. |

### 5.2. Provedores

Os dois contratos ficam em `backend/src/reunioes/stt/` e `backend/src/reunioes/ia/`.
Trocar de provedor é trocar a linha em `tenant_ia_config`; nenhum código de
reunião sabe qual provedor está atrás.

```js
/** Transcrição. Implementações: openai, deepgram, compativel. */
class ProvedorSTT {
  /** @returns {{ devolveTempos: boolean, limiteBytes: number }} */
  capacidades() {}
  /** @returns {Promise<Array<{ texto: string, inicioMs: number, fimMs: number }>>} */
  async transcrever({ audio, mime, idioma, sinal }) {}
  async testar({ sinal }) {}
}

/** Relatório. Implementações: openai, anthropic, gemini, compativel. */
class ProvedorIA {
  /** Saída estruturada nativa de cada provedor, contra `schema`. */
  async gerarJson({ instrucoes, conteudo, schema, maxTokens, sinal }) {}
  //   → { dados, uso: { entrada, saida }, modelo }
  async testar({ sinal }) {}
}
```

**Tempo dos trechos.** Nem todo modelo devolve o tempo de cada trecho (o
`whisper-1` e o Deepgram devolvem; os `gpt-4o-*-transcribe` respondem só
texto). Quando `devolveTempos` é falso, ou o arquivo passa de `limiteBytes`,
o lote fatia o áudio nos silêncios com o `ffmpeg` (`silencedetect`) e
transcreve cada pedaço. O tempo vem do deslocamento do pedaço dentro do
arquivo. Em qualquer caso, o tempo absoluto é `reuniao_audio.inicio_ts` mais
o deslocamento. O formato que o navegador gravou não chega ao provedor: o
`ffmpeg` sempre entrega OGG/Opus mono (ou MP3, para o provedor que não aceita
OGG).

**Erros.** Todo provedor traduz a própria falha num `ErroProvedor` com um
`tipo`. A fila decide pelo tipo, nunca pelo código HTTP do fornecedor:

| `tipo` | Quando | A fila faz |
|---|---|---|
| `CHAVE_INVALIDA` | 401 / 403 | `FALHOU` sem nova tentativa; avisa quem tem `configuracoes.ia.editar`. |
| `LIMITE` | 429 | Adia respeitando o `Retry-After`. |
| `TEMPORARIA` | 5xx, timeout, rede | Adia: 1 min, 5 min, 30 min, 2 h. |
| `RESPOSTA_INVALIDA` | JSON fora do schema | Uma tentativa de reparo e depois `FALHOU`. |
| `SEM_CONFIGURACAO` | slot inativo ou ausente | `FALHOU`; reprocessar depois de configurar. |

**Concorrência.** A reserva pega um job por vez com `SKIP LOCKED`, e no
máximo **um por incubadora** ao mesmo tempo (trava consultiva por
`id_tenant`). Assim o limite de uma incubadora não atrasa as outras. Cada
chamada tem timeout (`AbortSignal`).

### 5.3. O relatório (JSONB)

```jsonc
{
  "titulo": "string",
  "resumo_executivo": "string",
  "objetivos": [Item],
  "assuntos": [Item],
  "problemas_relatados": [Item],      // o que os participantes disseram
  "decisoes": [Item],                 // só o que foi efetivamente decidido
  "sugestoes_nao_decididas": [Item],  // proposto, mas ninguém aprovou
  "plano_de_acao": [Acao],
  "proximos_passos": [Item],
  "pontos_inconclusivos": [Item],
  "recomendacoes_da_ia": [{ "descricao": "string" }],  // sempre rotuladas como da IA
  "informacoes_ausentes": ["string"]  // ex.: "nenhum prazo foi definido"
}
// Item  = { id, descricao, evidencias: [{ id_trecho, citacao }] }
// Acao  = Item + { responsavel: { nome_citado|null, id_usuario|null },
//                  prazo: { texto_citado|null, data: "AAAA-MM-DD"|null },
//                  status: "PENDENTE" }
// decisoes e plano_de_acao exigem ao menos uma evidência (minItems 1).
```

A transcrição chega à IA linha a linha, com o id de cada trecho
(`[t1234 00:01:12 Gustavo] ...`), entre delimitadores e marcada como **dado,
não instrução**. As regras do briefing (não inventar decisão, responsável nem
prazo, não transformar sugestão em decisão etc.) são o prompt fixo. O prompt
da incubadora entra depois, como "orientações da incubadora", e não as
substitui.

**Verificação no backend, antes de gravar:**
1. JSON Schema estrito (`ajv`).
2. Cada `id_trecho` precisa ser desta reunião, e a `citacao` precisa aparecer
   nele (texto normalizado). Evidência que não confere **não é apagada**: fica
   marcada em `verificacao` e aparece em destaque para o revisor.
3. `responsavel.id_usuario` precisa ser participante; senão vira `null`,
   mantendo o `nome_citado`.
4. Prazo sem `texto_citado` não pode ter `data`: ninguém disse, ninguém inventa.
5. O `id` de cada item é gerado pelo backend. É ele que liga o item à tarefa
   que o mentor criar a partir dele (Etapa 6).

**Reunião longa:** se a transcrição passa do orçamento de contexto do modelo,
o relatório sai em duas passadas. Primeiro, um extrato por bloco de cerca de
30 minutos; depois, a consolidação, preservando as evidências.

---

## 6. O que o usuário vê

O status da listagem é um rótulo só, derivado de reunião + gravação + jobs +
relatório:

```
Agendada → Em andamento → Encerrada → Na fila da noite → Transcrevendo
         → Gerando relatório → Rascunho para revisão → Aprovado
                         (ou)  Falhou · Incompleta · Sem gravação
```

"Na fila da noite" mostra a estimativa, por exemplo "pronto até 7h de
amanhã". A tela de detalhe consulta o status a cada 30 segundos enquanto
está visível, no padrão de `useSondagem`.

Quando o relatório fica pronto ou falha de vez, sai um e-mail pelo
`notificacaoService`. Se o aviso entra no sino como aba nova ou como
mensagem do sistema, decide-se na Etapa 5.

| Tela | Rota |
|---|---|
| Lista e histórico (abas Próximas e Histórico, `components/tabela`, `chaveStorage: "reunioes"`) | `/reunioes` |
| Detalhe: dados, convidados, linha de status, transcrição, processamentos | `/reunioes/:id` |
| Sala (tela cheia, fora do `AppLayout`) | `/reunioes/:id/sala` |
| Relatório: ler, editar, aprovar, versões, imprimir / PDF | `/reunioes/:id/relatorio` |
| Integrações de IA (aba nova de Configurações) | `/configuracoes/ia` |

**Menu e Agenda:**
- **Menu:** item "Reuniões" (ícone `VideoCall`) no grupo Eventos, sem chave:
  o convidado sempre vê as suas.
- **Agenda:** o `EventDrawer` ganha "Entrar na reunião" quando o evento tem
  reunião.

**Sala:**
- `livekit-client` e os hooks de `@livekit/components-react` (`useTracks`,
  `ParticipantTile`, `TrackToggle`, qualidade de conexão), desenhados com MUI
  e os tokens de `theme.js`. Não usamos o `VideoConference` pronto.
- Controles: microfone, câmera, compartilhar tela, sair e encerrar
  (anfitrião).
- O painel lateral recolhível lista os participantes com o selo "gravando"
  ou "fala não gravada", e traz a opção de mudar o próprio consentimento.
- Se os pedaços da própria pessoa não chegam ao servidor por mais de 1
  minuto, ela vê o aviso "sua fala não está sendo gravada". A reunião não
  para por isso.

**PDF:** página de impressão do relatório ("Salvar como PDF" do navegador).
O sistema não gera PDF hoje, e uma biblioteca só para isso não se paga agora.

---

## 7. Segurança e LGPD

- **Aviso antes de ligar o microfone:** a fala de quem aceitar será gravada,
  transcrita por um provedor externo escolhido pela incubadora e resumida por
  IA. Diz quem lê o resultado, por quanto tempo fica guardado e que **num
  dispositivo compartilhado a fala de todos vai para o dono do login**. Quem
  não aceita entra sem ter a fala gravada. O aceite tem data e pode ser
  retirado durante a reunião.
- **Minimização:**
  - só áudio de microfone (sem vídeo, sem tela);
  - áudio apagado depois de transcrito;
  - transcrição com retenção configurável;
  - o áudio não sai da VPS, exceto para o provedor de transcrição da
    incubadora; o LiveKit Cloud só repassa a mídia e não grava;
  - a faxina do lote apaga qualquer pasta de áudio com mais de 30 dias.
- **Volume `audio`:** montado só no backend e no `processamento`, nenhuma
  rota serve os arquivos, e o caminho no disco sai só dos ids (nada que o
  cliente mande vira caminho). Os pedaços **não são cifrados em disco**: a
  chave mestra mora no mesmo servidor, então a cifra só protegeria uma cópia
  do volume. Se o jurídico pedir, cifrar cada pedaço com AES-GCM custa pouco.
- **Envio dos pedaços:** só a dona da gravação, com consentimento ativo, na
  janela da reunião, até 512 KB por pedaço, tipo `audio/webm`, `audio/ogg`
  ou `audio/mp4`, e com os primeiros bytes conferidos. Como o conteúdo vem do
  navegador, o `ffmpeg` lê com lista fechada de formatos e protocolo só
  `file`.
- **Chave de API da incubadora:**
  - cifrada com AES-256-GCM (`utils/cripto.js`, `SECRET_KEY`), com o contexto
    `ia:<id_tenant>:<finalidade>` como dado autenticado. Copiar a chave
    cifrada de uma incubadora para outra faz a decifragem falhar;
  - nunca volta ao front;
  - nunca vai para log: `erro_mensagem` passa por um filtro que corta o
    corpo da resposta do provedor e qualquer sequência com cara de chave.
- **`url_base` do provedor compatível:** só `https`, e o host não pode
  resolver para rede privada nem para o próprio stack (`postgres`,
  `backend`). Sem isso, um admin apontaria a URL para dentro do servidor. Um
  Whisper local entra por `IA_URL_BASE_PERMITIDAS`.
- **Webhook:** sem assinatura válida, 401.
- **Token da sala:** curto e de uma sala só.
- **Auditoria:** entram no `audit_log`:
  - toda leitura de transcrição ou de relatório;
  - edição e aprovação de relatório;
  - reprocessamento;
  - mudança de configuração de IA (só `chave_final`, nunca a chave);
  - exclusão por retenção.
- **Papéis na LGPD:** a incubadora controla os dados das reuniões dela; a
  plataforma (que hospeda o áudio), o LiveKit e os provedores de IA operam. **Validar
  com o jurídico** o texto do aviso e o registro dos operadores antes de ir
  para produção.

---

## 8. Permissões

Entram no catálogo (`rbac/catalogoPermissoes.js`):

| Chave | Rótulo |
|---|---|
| `reunioes.reunioes.visualizar` | Ver as reuniões de toda a incubadora |
| `reunioes.reunioes.criar` | Criar reuniões |
| `reunioes.reunioes.editar` / `excluir` | Editar / excluir reuniões de outras pessoas |
| `reunioes.transcricoes.visualizar` | Ler a transcrição de qualquer reunião |
| `reunioes.relatorios.visualizar` | Ler os relatórios aprovados de toda a incubadora |
| `reunioes.relatorios.revisar` | Editar e aprovar o relatório de qualquer reunião |
| `reunioes.relatorios.reprocessar` | Pedir nova transcrição ou novo relatório |
| `configuracoes.ia.visualizar` / `editar` | Integrações de Inteligência Artificial |

O desenho segue o de Tarefas: **o anfitrião sempre** edita a própria reunião,
lê a transcrição dela e revisa o relatório, com chave ou sem. As chaves são o
degrau acima, sobre as reuniões dos outros. O Mentor nasce com
`reunioes.reunioes.criar`, o Colaborador sem nenhuma, e o Administrador
recebe o catálogo inteiro, como sempre.

| | Transcrição | Rascunho | Aprovado |
|---|---|---|---|
| Anfitrião | lê | edita e aprova | lê e reabre |
| `relatorios.revisar` | com `transcricoes.visualizar` | edita e aprova | lê e reabre |
| `relatorios.visualizar` | — | — | lê |
| Demais convidados | — | — | lê **só se** o revisor marcou "compartilhar com os participantes" |

---

## 9. Configuração

Variáveis novas, a documentar no `.env.exemplo`:

```bash
# LiveKit Cloud — um projeto POR AMBIENTE (o webhook de cada um aponta para
# o seu domínio: https://<dominio>/api/livekit/webhook)
LIVEKIT_URL=wss://<projeto>.livekit.cloud
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=

# Áudio das reuniões, no volume `audio` da própria VPS (AUDIO_DIR é fixo na
# compose, /app/audio, como o UPLOAD_DIR). Abaixo deste espaço livre no disco,
# a API para de aceitar gravação.
AUDIO_DISCO_MIN_MB=5120

# Janela do processamento (fuso: TZ_AGENDA)
PROCESSAMENTO_JANELA=19:00-07:00
PROCESSAMENTO_FIM_DE_SEMANA=true
PROCESSAMENTO_CARGA_MAX=0.6
PROCESSAMENTO_MEMORIA_MIN_MB=500
LIMITE_PROCESSAMENTO=256m

# Exceção ao bloqueio de rede privada para provedor compatível (ex.: Whisper local)
IA_URL_BASE_PERMITIDAS=
```

Sem `LIVEKIT_URL`, o módulo fica invisível, como o Google Agenda sem
`GOOGLE_CLIENT_ID`.

Serviço novo na compose, **sem subir no `up`**. O perfil o deixa fora, e o
deploy não precisa mudar:

```yaml
processamento:
  image: ${IMAGEM_BACKEND:?}
  command: ["node", "src/workers/processamento.js"]
  restart: "no"
  profiles: ["processamento"]
  deploy: { resources: { limits: { memory: ${LIMITE_PROCESSAMENTO:-256m} } } }
  environment: { AUDIO_DIR: /app/audio }
  volumes: [audio:/app/audio]
  networks: [interna]
```

O volume `audio` também entra:
- no `backend` (`AUDIO_DIR: /app/audio` e `audio:/app/audio`);
- no serviço `permissoes`, que passa a fazer o `chown` de `/app/uploads` e
  de `/app/audio`;
- no `Dockerfile`, no `mkdir` que já cria `/app/uploads`;
- na lista `volumes:` do fim da compose.

Cada ambiente tem o seu volume, porque a compose prefixa o nome pelo
projeto. O `client_max_body_size 16m` do nginx já cobre os pedaços.

**Passos manuais no servidor** (o deploy não toca nisso):
1. **Timer:** no crontab do usuário `deploy`, uma linha por ambiente:
   ```
   */30 * * * * bash /opt/quiron/<amb>/scripts/processamento.sh >> /opt/quiron/<amb>/processamento.log 2>&1
   ```
   O script decide se é janela; o cron só bate na porta. O `bash` na frente é
   porque o deploy copia o arquivo sem garantir o bit de execução.
2. **CSP do Caddy:** acrescentar o LiveKit ao `connect-src` e `blob:` ao
   `media-src` (o teste de gravação toca o áudio da memória do navegador):
   ```
   connect-src 'self' wss://*.livekit.cloud https://*.livekit.cloud
   media-src 'self' blob:
   ```
   O resto da política fica igual. O retrato em `proxy/Caddyfile` já está
   assim; falta aplicar no servidor e recarregar o Caddy. Validar no
   navegador na Etapa 3.

**Dependências novas:**
- backend: `livekit-server-sdk` (token, salas, webhook) e `ajv`;
- frontend: `livekit-client` e `@livekit/components-react`. A gravação usa o
  `MediaRecorder` do próprio navegador, sem biblioteca;
- imagem: `ffmpeg`.

Não entram Redis, BullMQ, MinIO, SDK de nuvem nem SDK de IA.

---

## 10. Testes planejados

| Cenário do briefing | Como |
|---|---|
| 2+ participantes, entrada e saída, queda e reconexão | Etapa 3: três contas em navegadores diferentes (Chrome, Firefox e Safari, um deles no celular), contra o projeto de dev do LiveKit Cloud. Conferir `reuniao_sessao` e `reuniao_audio`. |
| Falha na gravação, transcrição incompleta, encerramento inesperado | Teste do service com pedaços falsos no disco: pedaço repetido, pedaço que falta, pedaço depois do consentimento retirado, gravação nunca fechada, disco abaixo do mínimo, `room_finished` sem encerrar. |
| Envio de áudio indevido | Pedaço na gravação de outra pessoa, de outra incubadora, sem consentimento, acima de 512 KB ou com tipo falso: recusado, nada gravado no disco. |
| Falha da IA, chave inválida, 429, JSON inválido | Servidor HTTP falso local imitando cada provedor; um caso por `tipo` de erro. |
| Reprocessamento, jobs duplicados, concorrência | Dois workers em paralelo contra o banco de teste: o índice parcial recusa o segundo job; `SKIP LOCKED` não entrega o mesmo duas vezes; o prazo vencido devolve à fila. |
| Isolamento entre incubadoras, acesso não autorizado | `cenario.js` (A e B), em `test/reunioes.test.js`: cada rota com o recurso de B pedido por alguém de A. |
| Reunião longa | Áudio sintético de 2 h: fatiamento, limite de bytes, relatório em duas passadas. |
| Concorrência entre reuniões | Várias reuniões na fila, de duas incubadoras, com uma delas devolvendo 429. |
| Janela e ociosidade | Relógio, carga e memória injetados (`agora()`, `lerCarga()`): não começa fora da janela e para quando ela fecha. |
| Evidência inventada | IA falsa citando um trecho inexistente: item marcado, não apagado. |

A suíte roda com o SMTP falso local (ver `docs/testes.md`).

---

## 11. Etapas

| Etapa | Entrega | Pronto quando |
|---|---|---|
| 3 — Videoconferência | Migração 027 (`reuniao`, `reuniao_participante`, `reuniao_sessao`), permissões, token, webhook, sala, CSP. **Validação da gravação** (seção 12, item 1) | Três pessoas numa sala de dev, entrando, saindo e reconectando, com sessões gravadas. |
| 4 — Gravação e transcrição | `reuniao_audio`, `reuniao_trecho`, consentimento na sala, gravação no navegador e envio dos pedaços, volume `audio`, container `processamento`, janela, provedores de STT, tela de transcrição | Uma reunião real de dev transcrita à noite, com cada fala no nome certo. |
| 5 — Relatórios | `tenant_ia_config` e a aba, os quatro provedores de IA, schema e verificação, job `RELATORIO`, histórico de processamento, reprocessamento, notificação | Relatório gerado por dois provedores diferentes sem trocar código, e os testes de falha verdes. |
| 6 — Revisão | Edição, aprovação, versões, compartilhamento, impressão, item → tarefa do quadro, retenção, sugestão de presença, isolamento completo | Ciclo inteiro em dev; PR para a `dev`. |

---

## 12. A validar e riscos conhecidos

1. **Gravação no navegador.** Confirmar, antes de escrever a transcrição
   (Etapa 3), cinco coisas:
   - Chrome, Edge, Firefox e Safari gravam e os pedaços se juntam num
     arquivo válido. O Safari pode gravar em MP4/AAC em vez de WebM/Opus; o
     `ffmpeg` normaliza, mas a junção precisa ser testada;
   - silenciar o microfone grava silêncio, sem comprimir o tempo;
   - um pedaço perdido vira silêncio sem deslocar o resto;
   - a gravação continua com a aba em segundo plano;
   - no celular, com a tela bloqueada, a gravação continua ou para de forma
     limpa.

   Navegador que falhar entra na sala com "fala não gravada" e o motivo, até
   ter correção.
2. **Custo do LiveKit Cloud:** sem gravação, é só o participante-minuto, e é
   da plataforma, não da incubadora. Medir em dev antes de produção.
3. **Eco:** quem fala sem fone pode ter a voz dos outros captada no próprio
   microfone, gerando o mesmo texto em duas gravações. Deduplicação por texto e
   tempo na Etapa 4.
4. **Memória do lote:** a estimativa é de 100 a 200 MB (Node, `ffmpeg` e o
   arquivo em memória). Medir na Etapa 4; o teto de 256 MB é o limite.
5. **Disco da VPS:** ~11 MB por hora por pessoa, apagados na manhã seguinte.
   O mínimo livre (`AUDIO_DISCO_MIN_MB`) protege o Postgres de um disco cheio.
   Uma noite em que o lote não roda acumula um dia a mais. Medir o uso real
   nas primeiras semanas.
6. **Node 20** está sem suporte desde abril de 2026. Não bloqueia este
   módulo, mas a atualização deve entrar em breve, em PR próprio.
7. **Branch:** o módulo nasce em `feat/reunioes` a partir da `dev`, depois
   que o Mini CRM estiver integrado.

---

## 13. Etapa 3 — o que foi feito

### 13.1. Entregue

| Parte | Onde |
|---|---|
| Migração 027 (`reuniao`, `reuniao_participante`, `reuniao_sessao`, `uq_evento_dono`, `uq_startup_dono`) e o mesmo no `schema.sql` | `database/` |
| LiveKit: token, criar e fechar sala, assinatura do webhook | `backend/src/reunioes/livekit.js` |
| Regras (quem vê, cria, edita, entra, encerra) | `services/reuniaoService.js` |
| Webhook | `services/reuniaoWebhookService.js`, `POST /livekit/webhook` |
| Permissões `reunioes.reunioes.*`; o Mentor nasce com `criar` | `rbac/` |
| E-mail de convite | `notificacaoService.reuniaoConvite` |
| Lista, detalhe e sala | `pages/Reunioes.jsx`, `ReuniaoDetalhe.jsx`, `ReuniaoSala.jsx`, `components/reunioes/` |
| Teste de gravação no navegador (seção 12, item 1) | `/reunioes/diagnostico` |
| "Entrar na reunião" na Agenda | `EventDrawer.jsx` |
| Testes | `backend/test/reunioes.test.js`, `frontend/src/components/reunioes/telasReunioes.test.jsx`, `frontend/src/data/reuniaoMeta.test.js` |

### 13.2. Decisões tomadas na implementação

O desenho não cobria estes pontos. O que foi decidido, e por quê:

1. **O público do evento de uma reunião são os convidados.** Antes, o público
   de um evento era "todas as startups" ou "as startups marcadas", e uma
   mentoria a três apareceria na Agenda e no e-mail da incubadora inteira. A
   regra de público agora mora num lugar só (`eventoRepository.sqlPublicoEventos`),
   usado pela lista de presença, pelo resumo de presença e pelo relatório de
   engajamento. Antes eram três cópias do mesmo critério.
   - **Agenda (tela):** o admin continua vendo todas as reuniões (é a visão
     da coordenação). Mentor e incubado veem só as reuniões para as quais
     foram convidados.
   - **Google Agenda:** só os convidados recebem a reunião (`sqlUsuarioVeEvento`).
     Nem o admin recebe a mentoria dos outros.
   - **`GET /eventos/:id`:** o evento de uma reunião abre só para o admin e
     para os convidados. Para os demais responde 404.
2. **O evento de uma reunião não se edita nem se exclui pela Agenda** (409
   `EVENTO_DE_REUNIAO`). Pela Agenda daria para trocar as startups do evento
   sem trocar as da reunião, ou desativar o evento com a reunião ainda viva. O
   `EventDrawer` mostra "Entrar na reunião" e "Ver a reunião" no lugar de
   Editar e Excluir.
3. **Idempotência do webhook pelo estado, e não pelo id do evento.** O
   `sid_participante` é UNIQUE, e o status só anda para a frente. Assim, um
   reenvio não duplica nada, e um `participant_left` que chegue antes do
   `joined` cria a sessão já fechada. Uma tabela de ids já vistos não cobriria
   a ordem trocada.
4. **A sala espera 10 minutos depois que o último sai** (`departureTimeout`).
   O padrão do LiveKit são 20 segundos. Como o fechamento da sala encerra a
   reunião (`room_finished`), o mentor que entrou cedo e saiu um instante
   voltaria para uma reunião encerrada. A sala é criada com esse prazo quando
   o primeiro token é emitido.
5. **A sala que reabre depois de encerrada é fechada de novo.** O token vale
   10 minutos. Quem ainda tiver um token válido e entrar recria a sala, e o
   `room_started` de uma reunião encerrada dispara outro `deleteRoom`.
6. **Encerrar, além do anfitrião, a chave `reunioes.reunioes.editar` também
   pode** (rótulo: "Editar, cancelar e encerrar reuniões de outras pessoas").
   É para a coordenação fechar uma sala que ficou aberta.
7. **Só as chaves da Etapa 3 entraram no catálogo** (`reunioes.reunioes.*`).
   As de transcrição, relatório e IA entram com as Etapas 4 e 5: uma chave sem
   nada atrás confundiria a tela de roles.
8. **Duas rotas a mais:**
   - `GET /reunioes/disponibilidade`, que o menu usa para sumir sem LiveKit;
   - `GET /reunioes/convidaveis`, que dá a equipe da incubadora com a startup
     de cada um, para o formulário. Exige `criar`, como `/tarefas/equipe`
     exige vínculo com a incubadora.
9. **Cancelar desativa o evento:** a reunião sai da Agenda e do Google e fica
   no histórico como Cancelada. **Excluir** apaga a reunião (só se ainda
   estiver `AGENDADA`).
10. **O consentimento ficou para a Etapa 4.** As colunas `consentiu_ts` e
    `consentimento_revogado_ts` já existem, mas a rota e o aviso só entram
    junto com a gravação. Até lá, a sala e o detalhe dizem "Esta reunião não é
    gravada".
11. **No menu de mentor e incubado, "Reuniões" fica ao lado de "Eventos", e
    não dentro dele.** Ali Eventos é item simples; virar grupo mudaria o menu
    (e os favoritos) de todos. No admin, fica dentro do grupo Eventos.
12. **Numa Mentoria, o anfitrião mentor ou da coordenação é o responsável do
    evento** (`id_usuario_mentor`). É daí que sai o histórico do mentor em
    `/mentores`.

### 13.3. Para fechar a Etapa 3

1. Criar o projeto de **dev** no LiveKit Cloud e pôr `LIVEKIT_URL`,
   `LIVEKIT_API_KEY` e `LIVEKIT_API_SECRET` no `.env` do dev.
2. No painel do projeto, apontar o webhook para
   `https://<dominio-dev>/api/livekit/webhook`.
3. Aplicar a CSP no Caddy do servidor (seção 9, passo 2).
4. Teste com três contas (seção 10, primeira linha): entrar, sair, cair e
   voltar, compartilhar a tela, e encerrar. Conferir `reuniao_sessao`.
5. Rodar `/reunioes/diagnostico` em Chrome, Edge, Firefox, Safari e num
   celular. Guardar o "Copiar relatório" de cada um e, com o `ffmpeg`, juntar
   os arquivos baixados (inclusive o "sem o pedaço N"). Isso responde a
   seção 12, item 1, antes da Etapa 4.


---

## 14. Etapa 4 — o que foi feito

### 14.1. Entregue

| Parte | Onde |
|---|---|
| Migração 028 (`reuniao_audio`, `reuniao_trecho`, `reuniao_processamento` e `_log`, `tenant_ia_config`, a retenção em `tenant`) e o mesmo no `schema.sql` | `database/` |
| Consentimento, gravações, pedaços, transcrição, reprocessar | `services/reuniaoGravacaoService.js`, rotas em `reuniaoRoutes.js` |
| Quem alcança a reunião (tirado do `reuniaoService`, que agora o divide com a gravação) | `services/reuniaoAcesso.js` |
| Configuração de IA da incubadora e retenção | `services/iaConfigService.js`, `/ia-config` |
| Provedores de transcrição (OpenAI, Deepgram, compatível com a OpenAI) | `src/reunioes/stt/`, `src/reunioes/provedores.js` |
| Conferência da `url_base` (nada de rede interna) | `src/reunioes/urlBase.js` |
| Disco (`AUDIO_DIR`) e `ffmpeg` | `src/reunioes/audioDisco.js`, `audioConversor.js` |
| Transcrição de uma reunião, eco, janela, lote | `src/reunioes/transcricao.js`, `eco.js`, `janela.js`, `lote.js` |
| Container `processamento` e o gatilho do cron | `src/workers/processamento.js`, `scripts/processamento.sh`, `docker-compose.yml` (perfil `processamento`) |
| `ffmpeg` na imagem e o volume `audio` | `backend/Dockerfile`, `docker-compose.yml` |
| Permissões novas | `reunioes.transcricoes.visualizar`, `reunioes.relatorios.reprocessar`, `configuracoes.ia.visualizar` e `editar` |
| E-mails | `notificacaoService.transcricaoPronta` e `transcricaoFalhou` |
| Gravação no navegador | `components/reunioes/sala/gravacao.js` e `useGravacao.js` |
| Aviso e escolha antes de entrar; selo e consentimento dentro da sala | `PreEntrada.jsx`, `SalaConectada.jsx` |
| Transcrição no detalhe (ler, copiar, baixar, histórico, transcrever de novo) | `components/reunioes/TranscricaoReuniao.jsx` |
| "Gravar e transcrever" no formulário | `DialogReuniao.jsx` |
| Configurações > Inteligência artificial | `pages/ConfiguracaoIA.jsx` |
| Testes | `backend/test/reunioesGravacao.test.js`, `reunioesUnidade.test.js`, `audioFfmpeg.test.js`; `frontend/src/components/reunioes/sala/gravacao.test.js`, `reuniaoMeta.test.js` |

### 14.2. Decisões tomadas na implementação

1. **O buraco no envio é tratado por "corridas".** O desenho dizia que o
   `ffmpeg` preenche com silêncio o pedaço que não chegou. Testado em
   14/11/2026 com áudio sintético: só o WebM atravessa o buraco. O Ogg perde
   o compasso e encurta o tempo, e o MP4 para de ler ali. Agora a gravação é
   dividida em corridas de pedaços consecutivos, e cada uma é convertida
   separada. A corrida que não começa no pedaço 0 recebe na frente o
   cabeçalho do pedaço 0, e o `ffmpeg` lê com `-copyts` e
   `aresample=async=1:first_pts=0`. Assim, toda corrida sai na linha do tempo
   da gravação inteira (`test/audioFfmpeg.test.js`).
2. **Ao provedor só vai fala.** O lote acha os silêncios e manda pedaços de
   no máximo 10 minutos, pulando silêncio longo (não se paga transcrição de
   silêncio). Com os modelos que não devolvem o tempo de cada frase
   (`gpt-4o-*-transcribe`), os pedaços têm no máximo 1 minuto, e cada um vira
   um trecho com horário útil.
3. **A configuração de IA e a retenção vieram na Etapa 4, e não na 5.** A
   reunião só grava com o slot de Transcrição ativo (decisão 6), então não dava
   para gravar sem a tela de configurá-lo. Só o slot de Transcrição funciona;
   o de Relatório responde 400 até a Etapa 5. A tabela já aceita os dois.
4. **Dois detalhes nos erros do provedor:**
   - um tipo a mais, `RECUSADA` (400, 404, 413, 415, 422): o pedido em si foi
     recusado, por exemplo com um modelo que não existe. Repetir não adianta,
     e a culpa é da configuração;
   - o 429 de **conta sem crédito** (`insufficient_quota`) vira
     `CHAVE_INVALIDA`, e não `LIMITE`, porque esperar não resolve.
5. **O limite de uso (429) adia sem gastar tentativa.** Senão, cinco 429
   seguidos derrubariam a transcrição de uma reunião que só precisava esperar.
6. **O consentimento:**
   - só muda com a reunião aberta;
   - "recusou" fica registrado: a data de retirada preenchida sem a de
     aceite, e assim a tela não pergunta de novo;
   - dá para mudar antes de entrar, dentro da sala (painel) e no detalhe;
   - cada mudança vai para a auditoria (`CONSENTIR` e `RECUSAR`).
7. **Quem retira o consentimento no meio da reunião tem a gravação parada na
   hora, mas o que já tinha sido gravado antes é transcrito.** É o que o
   desenho diz ("parada na hora"). **Validar com o jurídico:** a retirada
   talvez precise apagar também o que veio antes.
8. **O selo de quem tem a fala gravada é um atributo do LiveKit**
   (`gravacao: "sim"`). Só o servidor o escreve: vai no token e é trocado
   pelo `updateParticipant` quando a pessoa muda de ideia dentro da sala.
9. **O eco sai por um critério conservador.** Só conta como eco a mesma
   frase (80% das palavras), no mesmo momento, com 4 palavras ou mais, de
   pessoas diferentes. Fica o trecho de maior confiança do provedor, por isso
   a coluna `reuniao_trecho.confianca`.
10. **Os dois e-mails a mais:**
    - "transcrição pronta", para o anfitrião, enquanto o relatório não existe;
    - "transcrição falhou", para o anfitrião. Quando a culpa é da
      configuração, vai também para quem tem `configuracoes.ia.editar`.
11. **Só se transcreve de novo enquanto o áudio está no disco.** Com a
    retenção padrão (0 dias), isso quase nunca vale depois de uma transcrição
    bem-sucedida. Vale depois de uma falha, porque o áudio só sai depois de
    transcrito.
12. **Gravação sem nenhum pedaço:**
    - fechada pelo próprio navegador, é descartada em silêncio (o gravador
      nem chegou a começar);
    - abandonada (fechada pelo servidor ou pelo lote), vira `FALHOU` com "nenhum
      pedaço chegou", e a transcrição sai `INCOMPLETA`.
13. **O aviso ainda não fala do resumo por IA.** Ele entra com a Etapa 5.
    Prometer agora o que ainda não existe deixaria o consentimento impreciso.
    O texto final precisa do jurídico antes da produção (seção 7).
14. **Quem lê a transcrição:** o anfitrião e quem tem
    `reunioes.transcricoes.visualizar`. O Administrador recebe a chave; o
    Mentor, não, a menos que seja o anfitrião. Os demais convidados não leem
    (seção 8).
15. **O teste do `ffmpeg` só roda onde ele existe.** O
    `test/audioFfmpeg.test.js` aparece como pulado na máquina sem `ffmpeg` e na
    CI. Roda dentro da imagem:
    `docker compose run --rm --no-deps -v ./backend/test:/app/test:ro backend node --test test/audioFfmpeg.test.js`.

### 14.3. Para fechar a Etapa 4

1. **Chave de transcrição:** em Configurações > Inteligência artificial,
   cadastrar a do dev e usar "Testar conexão". Três opções:
   - OpenAI, `whisper-1`;
   - Groq, pelo "compatível com a OpenAI", em `https://api.groq.com/openai/v1`;
   - Deepgram, `nova-2`.
2. **Cron no servidor** (seção 9, passo manual 1), uma linha para o dev.
3. **Uma reunião real em dev:**
   - duas ou três pessoas aceitando a gravação, uma recusando;
   - encerrar e esperar a noite. Para não esperar, ponha
     `PROCESSAMENTO_JANELA=00:00-23:59` no `.env` do dev e rode o
     `scripts/processamento.sh`. O `--ignorar-janela` é recusado com
     `NODE_ENV=production`;
   - conferir que cada fala saiu no nome certo e que o áudio foi apagado.
4. **Navegadores** (seção 12, item 1): rodar `/reunioes/diagnostico` em
   Chrome, Edge, Firefox, Safari e num celular. Continua pendente.
5. **Jurídico:** o texto do aviso (`avisoDeGravacao`, em
   `frontend/src/data/reuniaoMeta.js`) e a decisão 7 acima.

