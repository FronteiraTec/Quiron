-- ===========================================================================
-- 027 — Reunioes por video (Etapa 3 de docs/reunioes.md)
--
-- CONTEXTO
-- Mentores e startups passam a fazer a reuniao dentro do Quiron. O video e o
-- audio da sala passam pelo LiveKit Cloud, que NAO grava nada. Esta migracao
-- cria so o que a videoconferencia precisa: a reuniao, quem foi convidado e
-- quem de fato entrou. Gravacao, transcricao e relatorio vem nas migracoes
-- seguintes (Etapas 4 a 6).
--
-- O QUE ENTRA
--   1. `uq_evento_dono` e `uq_startup_dono` — UNIQUE (id_tenant, id_*), alvos
--      das FKs compostas abaixo. Nao destrutivo: os ids ja sao unicos sozinhos.
--   2. `reuniao` — toda reuniao E um evento da Agenda (`id_evento`). Titulo,
--      horario, startups, e-mail e Google Agenda continuam morando no evento;
--      aqui fica so o que e da sala.
--   3. `reuniao_participante` — os convidados, com o papel de cada um. As
--      colunas de consentimento nascem agora, vazias: a gravacao (Etapa 4) e
--      quem as preenche.
--   4. `reuniao_sessao` — cada entrada e saida da sala, gravada pelos webhooks
--      do LiveKit. E dai que sai a sugestao de presenca (Etapa 6).
--
-- O PUBLICO DO EVENTO DE UMA REUNIAO SAO OS CONVIDADOS, e nao as startups do
-- evento: uma mentoria marcada com tres pessoas nao vai para a agenda nem
-- para o e-mail da incubadora inteira. Quem aplica isso e o eventoRepository
-- (`sqlPublicoEventos` e `sqlUsuarioVeEvento`), que agora pergunta se o evento
-- tem reuniao.
--
-- ISOLAMENTO ENTRE INCUBADORAS, GARANTIDO PELO BANCO
-- Toda tabela filha carrega `id_tenant`, e as FKs sao COMPOSTAS com ele: uma
-- reuniao nao aponta para o evento de outra incubadora, nem um convidado para
-- a reuniao alheia, mesmo que o service falhe em conferir (o desenho do Mini
-- CRM, migracao 026).
--
-- HORARIOS: os `*_ts` daqui sao instantes em UTC (NOW() numa sessao em UTC,
-- e os webhooks convertidos de epoch). O horario MARCADO da reuniao continua
-- sendo `evento.inicio_ts`, que guarda o horario de parede da incubadora.
--
-- NAO-DESTRUTIVA: so cria tipos, constraints UNIQUE, tabelas e indices.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. ALVOS DAS FKS COMPOSTAS
-- ---------------------------------------------------------------------------
DO $bloco$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_evento_dono') THEN
        ALTER TABLE evento ADD CONSTRAINT uq_evento_dono UNIQUE (id_tenant, id_evento);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_startup_dono') THEN
        ALTER TABLE startup ADD CONSTRAINT uq_startup_dono UNIQUE (id_tenant, id_startup);
    END IF;
END
$bloco$;


-- ---------------------------------------------------------------------------
-- 2. ENUMS — fechados porque ha codigo atras de cada valor.
-- ---------------------------------------------------------------------------
DO $bloco$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reuniaostatus') THEN
        CREATE TYPE reuniaoStatus AS ENUM ('AGENDADA', 'EM_ANDAMENTO', 'ENCERRADA', 'CANCELADA');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reuniaotranscricao') THEN
        CREATE TYPE reuniaoTranscricao AS ENUM ('PENDENTE', 'COMPLETA', 'INCOMPLETA', 'DESATIVADA');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reuniaopapel') THEN
        CREATE TYPE reuniaoPapel AS ENUM ('ANFITRIAO', 'PARTICIPANTE');
    END IF;
END
$bloco$;


-- ---------------------------------------------------------------------------
-- 3. REUNIAO
--
-- `sala` e o nome da sala no LiveKit: 'q-' + uuid, sem dado pessoal nenhum —
-- o nome aparece no painel do LiveKit e nos logs dele.
--
-- `transcricao` fica NULL ate a reuniao ser encerrada: so ai se sabe se houve
-- gravacao (Etapa 4).
--
-- A FK para `evento` nao tem ON DELETE: o evento de uma reuniao nao se apaga
-- (ele e desativado, `ativo = FALSE`). E NO ACTION, e nao RESTRICT, para que
-- a saida de uma incubadora inteira (cascata a partir de `tenant`) apague os
-- dois na mesma instrucao.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reuniao (
    id_reuniao      INTEGER            GENERATED ALWAYS AS IDENTITY,
    id_tenant       INTEGER            NOT NULL,
    id_evento       INTEGER            NOT NULL,
    id_startup      INTEGER,
    sala            VARCHAR(64)        NOT NULL DEFAULT ('q-' || gen_random_uuid()::text),
    status          reuniaoStatus      NOT NULL DEFAULT 'AGENDADA',
    -- O anfitriao pode desligar a gravacao da reuniao inteira (Etapa 4).
    gravar_audio    BOOLEAN            NOT NULL DEFAULT TRUE,
    transcricao     reuniaoTranscricao,
    transcricao_obs TEXT,
    id_anfitriao    INTEGER            NOT NULL,
    iniciada_ts     TIMESTAMP,
    encerrada_ts    TIMESTAMP,
    -- NULL com `encerrada_ts` preenchido = a sala fechou sozinha (todos sairam).
    encerrada_por   INTEGER,
    criado_por      INTEGER,
    criado_ts       TIMESTAMP          NOT NULL DEFAULT NOW(),
    atualizado_ts   TIMESTAMP          NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_reuniao PRIMARY KEY (id_reuniao),
    CONSTRAINT uq_reuniao_dono UNIQUE (id_tenant, id_reuniao),
    CONSTRAINT uq_reuniao_evento UNIQUE (id_evento),
    CONSTRAINT uq_reuniao_sala UNIQUE (sala),

    CONSTRAINT fk_reuniao_tenant
        FOREIGN KEY (id_tenant) REFERENCES tenant (id_tenant) ON DELETE CASCADE,
    CONSTRAINT fk_reuniao_evento
        FOREIGN KEY (id_tenant, id_evento) REFERENCES evento (id_tenant, id_evento),
    -- So a startup sai: a reuniao continua no historico, sem a startup.
    CONSTRAINT fk_reuniao_startup
        FOREIGN KEY (id_tenant, id_startup) REFERENCES startup (id_tenant, id_startup)
        ON DELETE SET NULL (id_startup),
    CONSTRAINT fk_reuniao_anfitriao
        FOREIGN KEY (id_anfitriao) REFERENCES usuarios (id_usuario),
    CONSTRAINT fk_reuniao_encerrada_por
        FOREIGN KEY (encerrada_por) REFERENCES usuarios (id_usuario) ON DELETE SET NULL,
    CONSTRAINT fk_reuniao_criado_por
        FOREIGN KEY (criado_por) REFERENCES usuarios (id_usuario) ON DELETE SET NULL,

    CONSTRAINT ck_reuniao_sala CHECK (sala ~ '^q-[0-9a-f-]{36}$'),
    -- Encerrada sempre diz quando.
    CONSTRAINT ck_reuniao_encerramento
        CHECK (status <> 'ENCERRADA' OR encerrada_ts IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS ix_reuniao_tenant_status ON reuniao (id_tenant, status);
CREATE INDEX IF NOT EXISTS ix_reuniao_startup ON reuniao (id_startup) WHERE id_startup IS NOT NULL;


-- ---------------------------------------------------------------------------
-- 4. CONVIDADOS
--
-- Um ANFITRIAO por reuniao (o indice parcial abaixo), e ele e o mesmo de
-- `reuniao.id_anfitriao` — o service grava os dois juntos.
--
-- `consentiu_ts` NULL = a fala desta pessoa nao e gravada. Preenchido pela
-- tela da sala a partir da Etapa 4.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reuniao_participante (
    id_tenant                 INTEGER      NOT NULL,
    id_reuniao                INTEGER      NOT NULL,
    id_usuario                INTEGER      NOT NULL,
    papel                     reuniaoPapel NOT NULL DEFAULT 'PARTICIPANTE',
    consentiu_ts              TIMESTAMP,
    consentimento_revogado_ts TIMESTAMP,
    convidado_por             INTEGER,
    convidado_ts              TIMESTAMP    NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_reuniao_participante PRIMARY KEY (id_reuniao, id_usuario),

    CONSTRAINT fk_reuniao_participante_reuniao
        FOREIGN KEY (id_tenant, id_reuniao) REFERENCES reuniao (id_tenant, id_reuniao)
        ON DELETE CASCADE,
    CONSTRAINT fk_reuniao_participante_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario) ON DELETE CASCADE,
    CONSTRAINT fk_reuniao_participante_convidado_por
        FOREIGN KEY (convidado_por) REFERENCES usuarios (id_usuario) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_reuniao_participante_anfitriao
    ON reuniao_participante (id_reuniao) WHERE papel = 'ANFITRIAO';
-- "As minhas reunioes" e a pergunta da listagem de quem nao tem a chave.
CREATE INDEX IF NOT EXISTS ix_reuniao_participante_usuario
    ON reuniao_participante (id_usuario, id_reuniao);


-- ---------------------------------------------------------------------------
-- 5. ENTRADAS E SAIDAS DA SALA
--
-- Uma linha por conexao do LiveKit (`sid_participante`): quem caiu e voltou
-- tem duas. O UNIQUE e o que torna o webhook idempotente — o reenvio do mesmo
-- `participant_joined` nao duplica nada, e um `participant_left` que chegue
-- antes do `joined` cria a linha ja fechada.
--
-- `id_usuario` vem da identidade do token (`u-<id_usuario>`). Fica NULL se a
-- identidade nao for de ninguem desta reuniao — o que nao deveria acontecer,
-- porque o token so e emitido para convidados.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reuniao_sessao (
    id_sessao          BIGINT       GENERATED ALWAYS AS IDENTITY,
    id_tenant          INTEGER      NOT NULL,
    id_reuniao         INTEGER      NOT NULL,
    id_usuario         INTEGER,
    identidade_livekit VARCHAR(128) NOT NULL,
    sid_participante   VARCHAR(64)  NOT NULL,
    entrou_ts          TIMESTAMP    NOT NULL,
    saiu_ts            TIMESTAMP,

    CONSTRAINT pk_reuniao_sessao PRIMARY KEY (id_sessao),
    CONSTRAINT uq_reuniao_sessao_sid UNIQUE (sid_participante),

    CONSTRAINT fk_reuniao_sessao_reuniao
        FOREIGN KEY (id_tenant, id_reuniao) REFERENCES reuniao (id_tenant, id_reuniao)
        ON DELETE CASCADE,
    CONSTRAINT fk_reuniao_sessao_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario) ON DELETE SET NULL,

    CONSTRAINT ck_reuniao_sessao_periodo CHECK (saiu_ts IS NULL OR saiu_ts >= entrou_ts)
);

CREATE INDEX IF NOT EXISTS ix_reuniao_sessao_reuniao ON reuniao_sessao (id_reuniao, entrou_ts);
