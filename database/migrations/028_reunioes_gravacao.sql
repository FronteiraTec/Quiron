-- ===========================================================================
-- 028 — Gravacao e transcricao das reunioes (Etapa 4 de docs/reunioes.md)
--
-- CONTEXTO
-- Quem aceita ter a fala gravada tem o PROPRIO microfone gravado pelo proprio
-- navegador, que manda um pedaco a cada 10 s para a API. O audio fica no
-- volume `audio` da VPS (nao ha bucket) e e transcrito A NOITE, com a maquina
-- ociosa, pelo provedor de transcricao que a incubadora escolheu e paga.
-- Cada gravacao e a voz de UMA pessoa, com o login dela: quem falou nao
-- depende de reconhecimento de voz.
--
-- O QUE ENTRA
--   1. `tenant.reuniao_retencao_*` — por quanto tempo o audio e a transcricao
--      ficam guardados, por incubadora (como a configuracao de e-mail).
--   2. `reuniao_audio` — uma gravacao continua de uma pessoa. O caminho no
--      disco sai so dos ids; nada que o navegador mande vira caminho.
--   3. `reuniao_trecho` — o que foi dito, com o horario absoluto.
--   4. `reuniao_processamento` e `_log` — a FILA do lote noturno e o
--      historico de cada tentativa, no proprio Postgres (sem Redis).
--   5. `tenant_ia_config` — o provedor, o modelo e a chave de API da
--      incubadora, uma linha por finalidade. A chave e CIFRADA pelo backend
--      (AES-256-GCM, utils/cripto.js) com o contexto `ia:<id_tenant>:<finalidade>`:
--      copiada para outra linha, nao decifra.
--
-- O relatorio por IA (Etapa 5) usa a mesma fila e a mesma configuracao — por
-- isso RELATORIO ja esta nos enums. As tabelas do relatorio vem na 029.
--
-- ISOLAMENTO ENTRE INCUBADORAS PELO BANCO, como na 027: toda tabela filha
-- carrega `id_tenant`, com FK composta.
--
-- NAO-DESTRUTIVA: so cria colunas com padrao, tipos, tabelas e indices.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. RETENCAO, POR INCUBADORA
--
-- Audio: 0 = apaga logo depois de transcrever (o padrao). O teto e 30 dias
-- porque a faxina do lote apaga QUALQUER pasta de audio com mais de 30 dias,
-- de todo jeito (rede de seguranca contra falha no meio do caminho).
-- Transcricao: 180 dias por padrao.
-- ---------------------------------------------------------------------------
ALTER TABLE tenant ADD COLUMN IF NOT EXISTS reuniao_retencao_audio_dias INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tenant ADD COLUMN IF NOT EXISTS reuniao_retencao_transcricao_dias INTEGER NOT NULL DEFAULT 180;

DO $bloco$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_tenant_retencao_audio') THEN
        ALTER TABLE tenant ADD CONSTRAINT ck_tenant_retencao_audio
            CHECK (reuniao_retencao_audio_dias BETWEEN 0 AND 30);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_tenant_retencao_transcricao') THEN
        ALTER TABLE tenant ADD CONSTRAINT ck_tenant_retencao_transcricao
            CHECK (reuniao_retencao_transcricao_dias BETWEEN 1 AND 3650);
    END IF;
END
$bloco$;


-- ---------------------------------------------------------------------------
-- 2. ENUMS
-- ---------------------------------------------------------------------------
DO $bloco$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reuniaoaudiostatus') THEN
        CREATE TYPE reuniaoAudioStatus AS ENUM ('GRAVANDO', 'DISPONIVEL', 'TRANSCRITO', 'FALHOU', 'EXCLUIDO');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reuniaoproctipo') THEN
        CREATE TYPE reuniaoProcTipo AS ENUM ('TRANSCRICAO', 'RELATORIO');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reuniaoprocstatus') THEN
        CREATE TYPE reuniaoProcStatus AS ENUM ('PENDENTE', 'PROCESSANDO', 'CONCLUIDO', 'FALHOU', 'CANCELADO');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reuniaoprocevento') THEN
        CREATE TYPE reuniaoProcEvento AS ENUM ('INICIO', 'SUCESSO', 'ERRO', 'ADIADO');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'iafinalidade') THEN
        CREATE TYPE iaFinalidade AS ENUM ('TRANSCRICAO', 'RELATORIO');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'iaprovedor') THEN
        CREATE TYPE iaProvedor AS ENUM ('OPENAI', 'ANTHROPIC', 'GEMINI', 'OPENAI_COMPATIVEL', 'DEEPGRAM');
    END IF;
END
$bloco$;


-- ---------------------------------------------------------------------------
-- 3. REUNIAO_AUDIO — uma gravacao continua de UMA pessoa
--
-- Nasce GRAVANDO quando o navegador abre a gravacao; vira DISPONIVEL quando
-- fecha (ou quando o servidor fecha pelo ultimo pedaco recebido); TRANSCRITO
-- depois do lote; EXCLUIDO quando o audio sai do disco. FALHOU = o arquivo
-- nao pode ser lido (o motivo fica em `erro`).
--
-- `inicio_ts` vem do RELOGIO DO SERVIDOR, e nao do navegador: e o que poe as
-- falas de pessoas diferentes na mesma linha do tempo.
--
-- `partes`, `ultima_parte` e `tamanho_bytes` sao o placar do recebimento. Quem
-- manda e o disco: o lote conta os arquivos de novo antes de transcrever.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reuniao_audio (
    id_audio         BIGINT             GENERATED ALWAYS AS IDENTITY,
    id_tenant        INTEGER            NOT NULL,
    id_reuniao       INTEGER            NOT NULL,
    id_usuario       INTEGER            NOT NULL,
    status           reuniaoAudioStatus NOT NULL DEFAULT 'GRAVANDO',
    mime             VARCHAR(60)        NOT NULL,
    partes           INTEGER            NOT NULL DEFAULT 0,
    ultima_parte     INTEGER,
    tamanho_bytes    BIGINT             NOT NULL DEFAULT 0,
    inicio_ts        TIMESTAMP          NOT NULL DEFAULT NOW(),
    ultima_parte_ts  TIMESTAMP,
    fim_ts           TIMESTAMP,
    erro             TEXT,
    transcrito_ts    TIMESTAMP,
    excluido_ts      TIMESTAMP,

    CONSTRAINT pk_reuniao_audio PRIMARY KEY (id_audio),
    CONSTRAINT uq_reuniao_audio_dono UNIQUE (id_tenant, id_audio),

    CONSTRAINT fk_reuniao_audio_reuniao
        FOREIGN KEY (id_tenant, id_reuniao) REFERENCES reuniao (id_tenant, id_reuniao)
        ON DELETE CASCADE,
    -- A voz e da pessoa: se a conta for apagada, a gravacao vai junto.
    CONSTRAINT fk_reuniao_audio_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario) ON DELETE CASCADE,

    CONSTRAINT ck_reuniao_audio_mime
        CHECK (mime ~ '^audio/(webm|ogg|mp4)(;[ a-z0-9=.,"-]*)?$'),
    CONSTRAINT ck_reuniao_audio_partes CHECK (partes >= 0 AND tamanho_bytes >= 0),
    CONSTRAINT ck_reuniao_audio_periodo CHECK (fim_ts IS NULL OR fim_ts >= inicio_ts)
);

CREATE INDEX IF NOT EXISTS ix_reuniao_audio_reuniao ON reuniao_audio (id_reuniao, id_usuario);


-- ---------------------------------------------------------------------------
-- 4. REUNIAO_TRECHO — o que foi dito
--
-- `ordem` e a posicao do trecho dentro da gravacao: UNIQUE (id_audio, ordem)
-- faz o reprocessamento substituir em vez de duplicar. `inicio_ts`/`fim_ts`
-- sao absolutos (inicio da gravacao + deslocamento dentro do arquivo).
-- `origem` diz quem transcreveu, ex. 'OPENAI:whisper-1'.
--
-- ECO: quem fala sem fone pode ter a voz dos outros captada no proprio
-- microfone, e a mesma frase sai em duas gravacoes. O lote apaga a copia
-- (mesmo texto, mesmo momento, pessoas diferentes) e fica com a de maior
-- `confianca`.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reuniao_trecho (
    id_trecho      BIGINT       GENERATED ALWAYS AS IDENTITY,
    id_tenant      INTEGER      NOT NULL,
    id_reuniao     INTEGER      NOT NULL,
    id_audio       BIGINT       NOT NULL,
    id_usuario     INTEGER      NOT NULL,
    ordem          INTEGER      NOT NULL,
    texto          TEXT         NOT NULL,
    inicio_ts      TIMESTAMP    NOT NULL,
    fim_ts         TIMESTAMP    NOT NULL,
    origem         VARCHAR(80),
    -- 0 a 1, quando o provedor informa. E o desempate da deduplicacao do eco.
    confianca      REAL,
    persistido_ts  TIMESTAMP    NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_reuniao_trecho PRIMARY KEY (id_trecho),
    CONSTRAINT uq_reuniao_trecho_ordem UNIQUE (id_audio, ordem),

    CONSTRAINT fk_reuniao_trecho_reuniao
        FOREIGN KEY (id_tenant, id_reuniao) REFERENCES reuniao (id_tenant, id_reuniao)
        ON DELETE CASCADE,
    CONSTRAINT fk_reuniao_trecho_audio
        FOREIGN KEY (id_tenant, id_audio) REFERENCES reuniao_audio (id_tenant, id_audio)
        ON DELETE CASCADE,
    CONSTRAINT fk_reuniao_trecho_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario) ON DELETE CASCADE,

    CONSTRAINT ck_reuniao_trecho_periodo CHECK (fim_ts >= inicio_ts)
);

CREATE INDEX IF NOT EXISTS ix_reuniao_trecho_reuniao ON reuniao_trecho (id_reuniao, inicio_ts);


-- ---------------------------------------------------------------------------
-- 5. REUNIAO_PROCESSAMENTO — a fila E o historico
--
-- O worker reserva com `FOR UPDATE SKIP LOCKED`. `travado_ate` e o prazo dele:
-- vencido, o job volta a PENDENTE (o worker morreu no meio). O indice parcial
-- impede dois jobs ATIVOS do mesmo tipo para a mesma reuniao — reprocessar
-- com um ja na fila responde 409 em vez de duplicar.
--
-- `erro_mensagem` NUNCA leva segredo: passa por um filtro que corta o corpo
-- da resposta do provedor e qualquer sequencia com cara de chave.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reuniao_processamento (
    id_processamento      BIGINT            GENERATED ALWAYS AS IDENTITY,
    id_tenant             INTEGER           NOT NULL,
    id_reuniao            INTEGER           NOT NULL,
    tipo                  reuniaoProcTipo   NOT NULL,
    status                reuniaoProcStatus NOT NULL DEFAULT 'PENDENTE',
    tentativas            INTEGER           NOT NULL DEFAULT 0,
    max_tentativas        INTEGER           NOT NULL DEFAULT 5,
    proxima_tentativa_ts  TIMESTAMP         NOT NULL DEFAULT NOW(),
    travado_ate           TIMESTAMP,
    erro_codigo           VARCHAR(40),
    erro_mensagem         TEXT,
    provedor              VARCHAR(40),
    modelo                VARCHAR(100),
    tokens_entrada        INTEGER,
    tokens_saida          INTEGER,
    segundos_audio        INTEGER,
    duracao_ms            INTEGER,
    solicitado_por        INTEGER,
    criado_ts             TIMESTAMP         NOT NULL DEFAULT NOW(),
    iniciado_ts           TIMESTAMP,
    concluido_ts          TIMESTAMP,

    CONSTRAINT pk_reuniao_processamento PRIMARY KEY (id_processamento),

    CONSTRAINT fk_reuniao_processamento_reuniao
        FOREIGN KEY (id_tenant, id_reuniao) REFERENCES reuniao (id_tenant, id_reuniao)
        ON DELETE CASCADE,
    CONSTRAINT fk_reuniao_processamento_solicitante
        FOREIGN KEY (solicitado_por) REFERENCES usuarios (id_usuario) ON DELETE SET NULL,

    CONSTRAINT ck_reuniao_processamento_trava CHECK (status <> 'PROCESSANDO' OR travado_ate IS NOT NULL),
    CONSTRAINT ck_reuniao_processamento_tentativas CHECK (tentativas >= 0 AND max_tentativas >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_reuniao_processamento_ativo
    ON reuniao_processamento (id_reuniao, tipo)
    WHERE status IN ('PENDENTE', 'PROCESSANDO');

CREATE INDEX IF NOT EXISTS ix_reuniao_processamento_fila
    ON reuniao_processamento (status, proxima_tentativa_ts);

CREATE INDEX IF NOT EXISTS ix_reuniao_processamento_reuniao
    ON reuniao_processamento (id_reuniao, criado_ts);


-- Cada tentativa, so insere. `detalhe` nunca leva segredo (o mesmo filtro).
CREATE TABLE IF NOT EXISTS reuniao_processamento_log (
    id_log            BIGINT            GENERATED ALWAYS AS IDENTITY,
    id_processamento  BIGINT            NOT NULL,
    tentativa         INTEGER           NOT NULL,
    evento            reuniaoProcEvento NOT NULL,
    detalhe           JSONB,
    criado_ts         TIMESTAMP         NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_reuniao_processamento_log PRIMARY KEY (id_log),
    CONSTRAINT fk_reuniao_processamento_log_proc
        FOREIGN KEY (id_processamento) REFERENCES reuniao_processamento (id_processamento)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_reuniao_processamento_log_proc
    ON reuniao_processamento_log (id_processamento, id_log);


-- ---------------------------------------------------------------------------
-- 6. TENANT_IA_CONFIG — o provedor de IA de cada incubadora
--
-- Uma linha por finalidade. Cada finalidade aceita so os provedores que a
-- fazem (o CHECK abaixo). `chave_final` sao os ultimos 4 caracteres, para a
-- tela mostrar "termina em …abcd" sem nunca devolver a chave.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenant_ia_config (
    id_tenant              INTEGER       NOT NULL,
    finalidade             iaFinalidade  NOT NULL,
    provedor               iaProvedor    NOT NULL,
    modelo                 VARCHAR(100)  NOT NULL,
    url_base               VARCHAR(255),
    chave_cifrada          TEXT          NOT NULL,
    chave_final            VARCHAR(4),
    prompt_personalizado   TEXT,
    ativo                  BOOLEAN       NOT NULL DEFAULT TRUE,
    ultima_validacao_ts    TIMESTAMP,
    ultima_validacao_ok    BOOLEAN,
    ultima_validacao_erro  TEXT,
    atualizado_por         INTEGER,
    atualizado_ts          TIMESTAMP     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_tenant_ia_config PRIMARY KEY (id_tenant, finalidade),

    CONSTRAINT fk_tenant_ia_config_tenant
        FOREIGN KEY (id_tenant) REFERENCES tenant (id_tenant) ON DELETE CASCADE,
    CONSTRAINT fk_tenant_ia_config_autor
        FOREIGN KEY (atualizado_por) REFERENCES usuarios (id_usuario) ON DELETE SET NULL,

    CONSTRAINT ck_tenant_ia_config_provedor CHECK (
        (finalidade = 'TRANSCRICAO' AND provedor IN ('OPENAI', 'DEEPGRAM', 'OPENAI_COMPATIVEL'))
        OR (finalidade = 'RELATORIO' AND provedor IN ('OPENAI', 'ANTHROPIC', 'GEMINI', 'OPENAI_COMPATIVEL'))
    ),
    -- So o provedor compativel tem endereco proprio; os outros sao fixos no codigo.
    CONSTRAINT ck_tenant_ia_config_url CHECK (
        (provedor = 'OPENAI_COMPATIVEL') = (url_base IS NOT NULL)
    )
);
