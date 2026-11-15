-- ===========================================================================
-- 026 — Mini CRM da startup, liberado como BENEFICIO pela incubadora
--
-- CONTEXTO
-- A incubadora quer oferecer as startups uma ferramenta simples de gestao
-- comercial: clientes, oportunidades num funil e as tarefas de cada venda.
-- Nao e para todas: e um BENEFICIO que a coordenacao concede startup a startup.
--
-- O QUE ENTRA
--   1. `startup_beneficio` — o que a incubadora liberou para cada startup. O
--      unico beneficio hoje e o CRM; o enum cresce quando houver outro com
--      codigo atras dele. REVOGAR SO DESLIGA A FLAG: os dados comerciais ficam
--      intactos e voltam a aparecer na proxima concessao. O historico de quem
--      concedeu e revogou vai para o audit_log, como os demais atos da
--      coordenacao.
--   2. `crm_etapa` — as etapas ABERTAS do funil, por startup. Ganho e Perdido
--      nao sao etapas: sao a `situacao` da oportunidade, um estado final. A
--      oportunidade encerrada guarda a etapa em que estava, e e isso que diz
--      "perdemos na proposta" num relatorio.
--   3. `crm_cliente`, `crm_oportunidade`, `crm_tarefa` — os dados da startup.
--   4. `crm_evento` — o historico. Uma linha por fato (criou, mudou de etapa,
--      alterou o valor, concluiu a tarefa, anotou). Sempre escrito pelo backend,
--      na MESMA transacao da escrita que o originou.
--
-- ISOLAMENTO ENTRE STARTUPS, GARANTIDO PELO BANCO
-- Toda tabela do CRM carrega `id_startup`, e as FKs entre elas sao COMPOSTAS
-- com ele: uma oportunidade nao aponta para o cliente de outra startup, nem
-- uma tarefa para a oportunidade alheia, mesmo que o service falhe em
-- conferir. Os UNIQUE (id_startup, id_*) existem para servir de alvo a essas
-- FKs.
--
-- EXCLUSAO LOGICA (`excluido_ts`) em cliente e oportunidade: some das telas,
-- continua no banco com o historico. Tarefa nao se exclui — se cancela.
--
-- O HISTORICO E IMUTAVEL. O trigger abaixo recusa UPDATE e DELETE diretos em
-- `crm_evento`. So passa o que chega por integridade referencial (a startup
-- ou a incubadora saindo do sistema, um usuario apagado), que roda um nivel
-- abaixo, dentro da trigger da FK.
--
-- NAO-DESTRUTIVA: so cria tipos, tabelas, indices, funcao e trigger.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. ENUMS — fechados porque ha codigo atras de cada valor.
-- ---------------------------------------------------------------------------
DO $bloco$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'beneficiotipo') THEN
        CREATE TYPE beneficioTipo AS ENUM ('CRM');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crmtipopessoa') THEN
        CREATE TYPE crmTipoPessoa AS ENUM ('PF', 'PJ');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crmclientestatus') THEN
        CREATE TYPE crmClienteStatus AS ENUM ('LEAD', 'ATIVO', 'INATIVO');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crmsituacao') THEN
        CREATE TYPE crmSituacao AS ENUM ('ABERTA', 'GANHA', 'PERDIDA');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crmprioridade') THEN
        CREATE TYPE crmPrioridade AS ENUM ('BAIXA', 'MEDIA', 'ALTA');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crmtarefastatus') THEN
        CREATE TYPE crmTarefaStatus AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crmeventotipo') THEN
        CREATE TYPE crmEventoTipo AS ENUM (
            'CLIENTE_CRIADO', 'CLIENTE_ALTERADO', 'CLIENTE_EXCLUIDO',
            'OPORTUNIDADE_CRIADA', 'OPORTUNIDADE_ALTERADA', 'RESPONSAVEL_ALTERADO',
            'CLIENTE_ASSOCIADO', 'ETAPA_ALTERADA',
            'OPORTUNIDADE_GANHA', 'OPORTUNIDADE_PERDIDA', 'OPORTUNIDADE_REABERTA',
            'OPORTUNIDADE_EXCLUIDA',
            'TAREFA_CRIADA', 'TAREFA_EDITADA', 'TAREFA_INICIADA', 'TAREFA_CONCLUIDA',
            'TAREFA_REABERTA', 'TAREFA_CANCELADA',
            'ANOTACAO', 'CONTATO', 'REUNIAO'
        );
    END IF;
END
$bloco$;


-- ---------------------------------------------------------------------------
-- 2. BENEFICIOS DA STARTUP
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS startup_beneficio (
    id_startup    INTEGER       NOT NULL,
    beneficio     beneficioTipo NOT NULL,
    ativo         BOOLEAN       NOT NULL DEFAULT TRUE,
    concedido_por INTEGER,
    concedido_ts  TIMESTAMP     NOT NULL DEFAULT NOW(),
    revogado_por  INTEGER,
    revogado_ts   TIMESTAMP,

    CONSTRAINT pk_startup_beneficio PRIMARY KEY (id_startup, beneficio),

    CONSTRAINT fk_startup_beneficio_startup
        FOREIGN KEY (id_startup) REFERENCES startup (id_startup) ON DELETE CASCADE,
    CONSTRAINT fk_startup_beneficio_concedente
        FOREIGN KEY (concedido_por) REFERENCES usuarios (id_usuario) ON DELETE SET NULL,
    CONSTRAINT fk_startup_beneficio_revogador
        FOREIGN KEY (revogado_por) REFERENCES usuarios (id_usuario) ON DELETE SET NULL,

    -- Ativo nao tem data de revogacao; revogado tem.
    CONSTRAINT ck_startup_beneficio_revogacao CHECK (ativo = (revogado_ts IS NULL))
);


-- ---------------------------------------------------------------------------
-- 3. ETAPAS DO FUNIL — as abertas. Semeadas pelo backend na primeira
--    concessao do CRM (ver crm/padroes.js).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_etapa (
    id_etapa   INTEGER     GENERATED ALWAYS AS IDENTITY,
    id_startup INTEGER     NOT NULL,
    nome       VARCHAR(60) NOT NULL,
    cor        CHAR(7)     NOT NULL DEFAULT '#64748b',
    ordem      SMALLINT    NOT NULL DEFAULT 0,
    ativo      BOOLEAN     NOT NULL DEFAULT TRUE,
    criado_ts  TIMESTAMP   NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_crm_etapa PRIMARY KEY (id_etapa),
    CONSTRAINT uq_crm_etapa_dono UNIQUE (id_startup, id_etapa),

    CONSTRAINT fk_crm_etapa_startup
        FOREIGN KEY (id_startup) REFERENCES startup (id_startup) ON DELETE CASCADE,

    CONSTRAINT ck_crm_etapa_cor CHECK (cor ~ '^#[0-9a-fA-F]{6}$')
);

CREATE INDEX IF NOT EXISTS ix_crm_etapa_startup ON crm_etapa (id_startup, ordem);


-- ---------------------------------------------------------------------------
-- 4. CLIENTES
--
-- `documento` so com digitos: 11 para CPF (PF), 14 para CNPJ (PJ). Unico por
-- startup entre os clientes nao excluidos — dois cadastros com o mesmo CPF sao
-- o mesmo cliente duplicado.
--
-- `origem` e texto livre, como as especialidades do mentor: nao ha codigo atras
-- do valor, e a tela sugere as origens que a startup ja usa.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_cliente (
    id_cliente    INTEGER          GENERATED ALWAYS AS IDENTITY,
    id_startup    INTEGER          NOT NULL,
    tipo_pessoa   crmTipoPessoa    NOT NULL DEFAULT 'PF',
    nome          VARCHAR(150)     NOT NULL,
    documento     VARCHAR(14),
    email         VARCHAR(150),
    telefone      VARCHAR(15),
    whatsapp      VARCHAR(15),
    empresa       VARCHAR(150),
    cargo         VARCHAR(100),
    origem        VARCHAR(60),
    status        crmClienteStatus NOT NULL DEFAULT 'LEAD',
    observacoes   TEXT,
    criado_por    INTEGER,
    criado_ts     TIMESTAMP        NOT NULL DEFAULT NOW(),
    atualizado_ts TIMESTAMP        NOT NULL DEFAULT NOW(),
    excluido_ts   TIMESTAMP,
    excluido_por  INTEGER,

    CONSTRAINT pk_crm_cliente PRIMARY KEY (id_cliente),
    CONSTRAINT uq_crm_cliente_dono UNIQUE (id_startup, id_cliente),

    CONSTRAINT fk_crm_cliente_startup
        FOREIGN KEY (id_startup) REFERENCES startup (id_startup) ON DELETE CASCADE,
    CONSTRAINT fk_crm_cliente_criado_por
        FOREIGN KEY (criado_por) REFERENCES usuarios (id_usuario) ON DELETE SET NULL,
    CONSTRAINT fk_crm_cliente_excluido_por
        FOREIGN KEY (excluido_por) REFERENCES usuarios (id_usuario) ON DELETE SET NULL,

    CONSTRAINT ck_crm_cliente_documento CHECK (
        documento IS NULL
        OR (tipo_pessoa = 'PF' AND documento ~ '^[0-9]{11}$')
        OR (tipo_pessoa = 'PJ' AND documento ~ '^[0-9]{14}$')
    )
);

CREATE INDEX IF NOT EXISTS ix_crm_cliente_startup
    ON crm_cliente (id_startup, lower(nome)) WHERE excluido_ts IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_cliente_documento
    ON crm_cliente (id_startup, documento)
    WHERE documento IS NOT NULL AND excluido_ts IS NULL;


-- ---------------------------------------------------------------------------
-- 5. OPORTUNIDADES
--
-- `etapa_ts` e quando ela entrou na etapa atual: e o que o cartao usa para
-- dizer "parada ha 12 dias".
--
-- ENCERRAMENTO COERENTE: aberta nao tem data de encerramento; ganha tem valor
-- vendido e data de fechamento; perdida tem motivo e data. Reabrir limpa os
-- tres — o que eles eram continua no historico.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_oportunidade (
    id_oportunidade     INTEGER       GENERATED ALWAYS AS IDENTITY,
    id_startup          INTEGER       NOT NULL,
    id_cliente          INTEGER       NOT NULL,
    id_etapa            INTEGER       NOT NULL,
    titulo              VARCHAR(150)  NOT NULL,
    descricao           TEXT,
    valor_estimado      NUMERIC(14,2),
    probabilidade       SMALLINT,
    previsao_fechamento DATE,
    origem              VARCHAR(60),
    id_responsavel      INTEGER,
    observacoes         TEXT,

    situacao            crmSituacao   NOT NULL DEFAULT 'ABERTA',
    etapa_ts            TIMESTAMP     NOT NULL DEFAULT NOW(),
    valor_vendido       NUMERIC(14,2),
    fechamento_dt       DATE,
    motivo_perda        VARCHAR(500),
    encerrado_ts        TIMESTAMP,
    encerrado_por       INTEGER,

    criado_por          INTEGER,
    criado_ts           TIMESTAMP     NOT NULL DEFAULT NOW(),
    atualizado_ts       TIMESTAMP     NOT NULL DEFAULT NOW(),
    excluido_ts         TIMESTAMP,
    excluido_por        INTEGER,

    CONSTRAINT pk_crm_oportunidade PRIMARY KEY (id_oportunidade),
    CONSTRAINT uq_crm_oportunidade_dono UNIQUE (id_startup, id_oportunidade),

    CONSTRAINT fk_crm_oportunidade_startup
        FOREIGN KEY (id_startup) REFERENCES startup (id_startup) ON DELETE CASCADE,
    CONSTRAINT fk_crm_oportunidade_cliente
        FOREIGN KEY (id_startup, id_cliente) REFERENCES crm_cliente (id_startup, id_cliente),
    CONSTRAINT fk_crm_oportunidade_etapa
        FOREIGN KEY (id_startup, id_etapa) REFERENCES crm_etapa (id_startup, id_etapa),
    CONSTRAINT fk_crm_oportunidade_responsavel
        FOREIGN KEY (id_responsavel) REFERENCES usuarios (id_usuario) ON DELETE SET NULL,
    CONSTRAINT fk_crm_oportunidade_encerrado_por
        FOREIGN KEY (encerrado_por) REFERENCES usuarios (id_usuario) ON DELETE SET NULL,
    CONSTRAINT fk_crm_oportunidade_criado_por
        FOREIGN KEY (criado_por) REFERENCES usuarios (id_usuario) ON DELETE SET NULL,
    CONSTRAINT fk_crm_oportunidade_excluido_por
        FOREIGN KEY (excluido_por) REFERENCES usuarios (id_usuario) ON DELETE SET NULL,

    CONSTRAINT ck_crm_oportunidade_valores CHECK (
        (valor_estimado IS NULL OR valor_estimado >= 0)
        AND (valor_vendido IS NULL OR valor_vendido >= 0)
    ),
    CONSTRAINT ck_crm_oportunidade_probabilidade
        CHECK (probabilidade IS NULL OR probabilidade BETWEEN 0 AND 100),
    CONSTRAINT ck_crm_oportunidade_encerramento CHECK (
        (situacao = 'ABERTA') = (encerrado_ts IS NULL)
        AND (situacao = 'ABERTA') = (fechamento_dt IS NULL)
        AND (situacao = 'GANHA') = (valor_vendido IS NOT NULL)
        AND (situacao = 'PERDIDA') = (motivo_perda IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS ix_crm_oportunidade_etapa
    ON crm_oportunidade (id_startup, situacao, id_etapa) WHERE excluido_ts IS NULL;
CREATE INDEX IF NOT EXISTS ix_crm_oportunidade_atualizado
    ON crm_oportunidade (id_startup, atualizado_ts DESC) WHERE excluido_ts IS NULL;
CREATE INDEX IF NOT EXISTS ix_crm_oportunidade_cliente
    ON crm_oportunidade (id_cliente);


-- ---------------------------------------------------------------------------
-- 6. TAREFAS COMERCIAIS
--
-- Separadas de `tarefa` (migracao 014) de proposito: aquela e a gestao INTERNA
-- da incubadora, com o vocabulario de status de cada tenant e a visibilidade
-- da equipe dela. Estas sao da startup, e quem as ve sao os membros dela.
--
-- `vencimento_ts` e um instante (UTC, como criado_ts). Cliente e oportunidade
-- sao opcionais; com oportunidade, o cliente e o dela (o service preenche).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_tarefa (
    id_tarefa       INTEGER         GENERATED ALWAYS AS IDENTITY,
    id_startup      INTEGER         NOT NULL,
    titulo          VARCHAR(150)    NOT NULL,
    descricao       TEXT,
    id_responsavel  INTEGER,
    vencimento_ts   TIMESTAMP,
    prioridade      crmPrioridade   NOT NULL DEFAULT 'MEDIA',
    status          crmTarefaStatus NOT NULL DEFAULT 'PENDENTE',
    id_cliente      INTEGER,
    id_oportunidade INTEGER,
    concluida_ts    TIMESTAMP,
    concluida_por   INTEGER,
    criado_por      INTEGER,
    criado_ts       TIMESTAMP       NOT NULL DEFAULT NOW(),
    atualizado_ts   TIMESTAMP       NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_crm_tarefa PRIMARY KEY (id_tarefa),
    CONSTRAINT uq_crm_tarefa_dono UNIQUE (id_startup, id_tarefa),

    CONSTRAINT fk_crm_tarefa_startup
        FOREIGN KEY (id_startup) REFERENCES startup (id_startup) ON DELETE CASCADE,
    CONSTRAINT fk_crm_tarefa_cliente
        FOREIGN KEY (id_startup, id_cliente) REFERENCES crm_cliente (id_startup, id_cliente),
    CONSTRAINT fk_crm_tarefa_oportunidade
        FOREIGN KEY (id_startup, id_oportunidade)
        REFERENCES crm_oportunidade (id_startup, id_oportunidade),
    CONSTRAINT fk_crm_tarefa_responsavel
        FOREIGN KEY (id_responsavel) REFERENCES usuarios (id_usuario) ON DELETE SET NULL,
    CONSTRAINT fk_crm_tarefa_concluida_por
        FOREIGN KEY (concluida_por) REFERENCES usuarios (id_usuario) ON DELETE SET NULL,
    CONSTRAINT fk_crm_tarefa_criado_por
        FOREIGN KEY (criado_por) REFERENCES usuarios (id_usuario) ON DELETE SET NULL,

    CONSTRAINT ck_crm_tarefa_conclusao
        CHECK ((status = 'CONCLUIDA') = (concluida_ts IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS ix_crm_tarefa_responsavel
    ON crm_tarefa (id_startup, id_responsavel, status);
CREATE INDEX IF NOT EXISTS ix_crm_tarefa_vencimento
    ON crm_tarefa (id_startup, vencimento_ts)
    WHERE status IN ('PENDENTE', 'EM_ANDAMENTO');
CREATE INDEX IF NOT EXISTS ix_crm_tarefa_oportunidade
    ON crm_tarefa (id_oportunidade) WHERE id_oportunidade IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_crm_tarefa_cliente
    ON crm_tarefa (id_cliente) WHERE id_cliente IS NOT NULL;


-- ---------------------------------------------------------------------------
-- 7. HISTORICO
--
-- `descricao` e a frase pronta, escrita pelo servidor no momento do fato
-- ("alterou o valor estimado de R$ 2.000,00 para R$ 3.500,00"). Os JSONB guardam
-- o estado de antes e de depois e o contexto (o campo, a tarefa, o canal do
-- contato), para a tela e para quem auditar.
--
-- `autor_nome` e uma copia do nome de quem fez: se a conta for apagada, o
-- `id_usuario` vira NULL, mas a linha do tempo continua dizendo quem foi.
--
-- `id_cliente` e o cliente no momento do evento: e o que monta o "historico de
-- interacoes" na tela do cliente. Trocar o cliente de uma oportunidade nao
-- reescreve o passado.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_evento (
    id_evento        BIGINT        GENERATED ALWAYS AS IDENTITY,
    id_startup       INTEGER       NOT NULL,
    id_oportunidade  INTEGER,
    id_cliente       INTEGER,
    id_tarefa        INTEGER,
    tipo             crmEventoTipo NOT NULL,
    descricao        TEXT          NOT NULL,
    dados_anteriores JSONB,
    dados_novos      JSONB,
    metadados        JSONB         NOT NULL DEFAULT '{}',
    id_usuario       INTEGER,
    autor_nome       VARCHAR(150),
    criado_ts        TIMESTAMP     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_crm_evento PRIMARY KEY (id_evento),

    CONSTRAINT fk_crm_evento_startup
        FOREIGN KEY (id_startup) REFERENCES startup (id_startup) ON DELETE CASCADE,
    CONSTRAINT fk_crm_evento_oportunidade
        FOREIGN KEY (id_startup, id_oportunidade)
        REFERENCES crm_oportunidade (id_startup, id_oportunidade),
    CONSTRAINT fk_crm_evento_cliente
        FOREIGN KEY (id_startup, id_cliente) REFERENCES crm_cliente (id_startup, id_cliente),
    CONSTRAINT fk_crm_evento_tarefa
        FOREIGN KEY (id_startup, id_tarefa) REFERENCES crm_tarefa (id_startup, id_tarefa),
    CONSTRAINT fk_crm_evento_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario) ON DELETE SET NULL,

    -- Todo evento e de uma oportunidade, de um cliente, ou dos dois.
    CONSTRAINT ck_crm_evento_alvo CHECK (id_oportunidade IS NOT NULL OR id_cliente IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS ix_crm_evento_oportunidade
    ON crm_evento (id_oportunidade, criado_ts DESC, id_evento DESC)
    WHERE id_oportunidade IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_crm_evento_cliente
    ON crm_evento (id_cliente, criado_ts DESC, id_evento DESC)
    WHERE id_cliente IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_crm_evento_startup
    ON crm_evento (id_startup, criado_ts DESC, id_evento DESC);


-- O historico nao se edita nem se apaga. Exclusao e SET NULL vindos de uma FK
-- rodam dentro da trigger de integridade referencial (profundidade > 1) e
-- passam: sao a startup, a incubadora ou uma conta saindo do sistema.
CREATE OR REPLACE FUNCTION fn_crm_evento_imutavel()
RETURNS TRIGGER AS $$
BEGIN
    IF pg_trigger_depth() > 1 THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        END IF;
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'O historico do CRM nao pode ser alterado nem apagado (evento %)', OLD.id_evento
        USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_crm_evento_imutavel ON crm_evento;
CREATE TRIGGER trg_crm_evento_imutavel
    BEFORE UPDATE OR DELETE ON crm_evento
    FOR EACH ROW EXECUTE FUNCTION fn_crm_evento_imutavel();
