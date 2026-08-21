-- ===========================================================================
-- 014 — Gestao de tarefas da incubadora
--
-- CONTEXTO
-- Tudo que o sistema registrava ate aqui era o trabalho da STARTUP: a entrega
-- que ela sobe, a avaliacao que o mentor devolve, o evento que ela frequenta.
-- O trabalho da propria INCUBADORA — "cobrar o contrato da Acme", "montar o
-- edital de selecao", "revisar o material da fase 2" — nao tinha onde morar, e
-- acabava em planilha, grupo de WhatsApp ou na cabeca de alguem.
--
-- Esta migracao cria esse lugar. E gestao INTERNA: quem enxerga e quem trabalha
-- nela sao as pessoas da equipe, e o recorte de quem entra e o RBAC
-- (modulo `tarefas` no catalogo de permissoes), nao o papel.
--
-- O QUE ENTRA
--   1. `tarefa_status` — as colunas do quadro, vocabulario de cada incubadora.
--      Mesmo desenho de startup_situacao (migracao 010): chave estavel + rotulo
--      editavel + uma CATEGORIA que diz o que o status significa para o codigo.
--   2. `tarefa_campo` + `tarefa.campos_extras` — os campos personalizaveis,
--      identicos aos do cadastro de startup, reusando o enum campoTipo. A
--      incubadora que precisa de "Centro de custo" ou "Contrato" na tarefa
--      cria o campo e o formulario se redesenha.
--   3. `tarefa` — a tarefa em si.
--
-- POR QUE O STATUS TEM UMA `categoria`
-- Pelo mesmo motivo que a situacao da startup tem um `ciclo`: o rotulo e livre
-- ("Em revisao", "Aguardando terceiros", "Arquivada") mas HA CODIGO ATRAS DELE.
-- O sistema precisa responder tres perguntas sem entender o vocabulario de cada
-- incubadora — a tarefa esta aberta? esta atrasada? quando foi concluida? —, e
-- e a categoria (PENDENTE / EM_ANDAMENTO / CONCLUIDA) que responde. Sem ela,
-- "Arquivada" contaria como pendencia atrasada para sempre.
--
-- POR QUE `ordem` E INTEIRO POR COLUNA
-- O kanban tem ordem manual: arrastar um cartao para o topo e uma decisao de
-- prioridade, nao um efeito colateral de ordenacao. `ordem` e a posicao dentro
-- da coluna (status), renumerada pelo repositorio a cada movimento — ver
-- tarefaRepository.mover. A tabela nao tenta impor unicidade nisso: duas
-- tarefas empatadas em `ordem` desempatam por prioridade e prazo, e uma
-- constraint aqui so faria o arrasto falhar no meio.
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. OS ENUMS COM CODIGO ATRAS DELES.
-- ---------------------------------------------------------------------------
DO $bloco$
BEGIN
    -- O que um status SIGNIFICA para o sistema, por tras do rotulo livre.
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tarefacategoria') THEN
        CREATE TYPE tarefaCategoria AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA');
    END IF;

    -- A prioridade e enum, e nao vocabulario por tenant como o status: ela nao
    -- e um estagio do fluxo (que varia de incubadora para incubadora), e uma
    -- escala ordenada de quatro degraus que o quadro usa para desempatar e
    -- para colorir. Texto livre aqui faria "Alta" e "alta" competirem na
    -- ordenacao sem que ninguem entendesse por que.
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tarefaprioridade') THEN
        CREATE TYPE tarefaPrioridade AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'URGENTE');
    END IF;
END
$bloco$;

-- ---------------------------------------------------------------------------
-- 2. STATUS — as colunas do quadro, uma lista por incubadora.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tarefa_status (
    id_tenant INTEGER         NOT NULL,
    -- Identificador estavel, gravado em tarefa.status. Nao muda depois de
    -- criado; quem muda e o rotulo.
    chave     VARCHAR(40)     NOT NULL,
    rotulo    VARCHAR(60)     NOT NULL,
    cor       CHAR(7)         NOT NULL DEFAULT '#6366f1',
    categoria tarefaCategoria NOT NULL DEFAULT 'PENDENTE',
    ordem     SMALLINT        NOT NULL DEFAULT 0,
    ativo     BOOLEAN         NOT NULL DEFAULT TRUE,
    criado_ts TIMESTAMP       NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_tarefa_status PRIMARY KEY (id_tenant, chave),

    CONSTRAINT fk_tarefa_status_tenant
        FOREIGN KEY (id_tenant) REFERENCES tenant (id_tenant) ON DELETE CASCADE,

    CONSTRAINT ck_tarefa_status_cor CHECK (cor ~ '^#[0-9a-fA-F]{6}$')
);

-- Duas colunas com o mesmo nome no quadro nao dariam para distinguir.
CREATE UNIQUE INDEX IF NOT EXISTS uq_tarefa_status_rotulo
    ON tarefa_status (id_tenant, lower(rotulo));

-- ---------------------------------------------------------------------------
-- 3. CAMPOS PERSONALIZAVEIS — a DEFINICAO (o valor vai em tarefa.campos_extras)
--
--    Copia estrutural de startup_campo, e de proposito: sao o mesmo recurso
--    aplicado a outra entidade, e o backend valida os dois com o mesmo codigo
--    (backend/src/campos). Uma tabela unica "campo" com uma coluna "entidade"
--    foi considerada e descartada: a FK do valor, os indices de unicidade e a
--    contagem de uso sao por entidade, e a tabela compartilhada trocaria duas
--    definicoes claras por uma cheia de "se for tarefa, entao...".
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tarefa_campo (
    id_campo    INTEGER GENERATED ALWAYS AS IDENTITY,
    id_tenant   INTEGER      NOT NULL,
    -- Nome da propriedade dentro de tarefa.campos_extras. Imutavel: ela esta
    -- gravada no JSONB de cada tarefa, e troca-la orfanaria os valores.
    chave       VARCHAR(40)  NOT NULL,
    rotulo      VARCHAR(80)  NOT NULL,
    tipo        campoTipo    NOT NULL,
    descricao   VARCHAR(200),
    obrigatorio BOOLEAN      NOT NULL DEFAULT FALSE,
    ordem       SMALLINT     NOT NULL DEFAULT 0,
    ativo       BOOLEAN      NOT NULL DEFAULT TRUE,
    -- O que muda de tipo para tipo (opcoes, mascara, min/max, moeda). Ver o
    -- comentario em startup_campo.
    config      JSONB        NOT NULL DEFAULT '{}',
    criado_ts   TIMESTAMP    NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_tarefa_campo PRIMARY KEY (id_campo),

    CONSTRAINT fk_tarefa_campo_tenant
        FOREIGN KEY (id_tenant) REFERENCES tenant (id_tenant) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tarefa_campo_chave
    ON tarefa_campo (id_tenant, chave);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tarefa_campo_rotulo
    ON tarefa_campo (id_tenant, lower(rotulo));

-- ---------------------------------------------------------------------------
-- 4. SEMEADURA DO VOCABULARIO — antes da tabela `tarefa`, porque a FK do
--    status exige que a coluna exista antes da primeira tarefa.
-- ---------------------------------------------------------------------------
INSERT INTO tarefa_status (id_tenant, chave, rotulo, cor, categoria, ordem)
SELECT t.id_tenant, v.chave, v.rotulo, v.cor, v.categoria, v.ordem
  FROM tenant t
  CROSS JOIN (VALUES
      ('A_FAZER',      'A fazer',      '#64748b'::CHAR(7), 'PENDENTE'::tarefaCategoria,     1::SMALLINT),
      ('EM_ANDAMENTO', 'Em andamento', '#6366f1',          'EM_ANDAMENTO'::tarefaCategoria, 2),
      ('EM_REVISAO',   'Em revisão',   '#f59e0b',          'EM_ANDAMENTO'::tarefaCategoria, 3),
      ('CONCLUIDA',    'Concluída',    '#10b981',          'CONCLUIDA'::tarefaCategoria,    4)
  ) AS v(chave, rotulo, cor, categoria, ordem)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. A TAREFA.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tarefa (
    id_tarefa      INTEGER GENERATED ALWAYS AS IDENTITY,
    id_tenant      INTEGER          NOT NULL,

    titulo         VARCHAR(160)     NOT NULL,
    descricao      TEXT,

    -- A coluna do quadro. Ver tarefa_status.
    status         VARCHAR(40)      NOT NULL,
    prioridade     tarefaPrioridade NOT NULL DEFAULT 'MEDIA',

    -- QUEM FAZ. NULL e um estado legitimo e comum: a tarefa nasce na coluna "A
    -- fazer" sem dono e ganha um quando alguem a puxa. SET NULL ao desligar a
    -- pessoa da plataforma, e nao CASCADE: a tarefa continua existindo depois
    -- que o responsavel sai — e justamente ela que precisa de um novo dono.
    id_responsavel INTEGER,

    -- SOBRE QUEM E. Opcional: "revisar o contrato da Acme" e uma tarefa da
    -- incubadora que fala de uma startup; "montar o edital" nao fala de
    -- nenhuma. Com ela preenchida, o quadro filtra por startup e a ficha da
    -- startup tem por onde puxar o que esta pendente sobre ela.
    id_startup     INTEGER,

    -- DATE e nao TIMESTAMP: prazo de tarefa e um dia, e guardar hora faria
    -- "vence hoje" depender do fuso de quem consulta.
    prazo          DATE,

    -- Posicao dentro da coluna, no quadro. Ver o cabecalho.
    ordem          INTEGER          NOT NULL DEFAULT 0,

    -- Preenchido pelo backend quando a tarefa entra num status de categoria
    -- CONCLUIDA, e limpo quando ela volta. Coluna, e nao "olhe o audit_log":
    -- e o dado que responde "o que a equipe fechou este mes" numa consulta so.
    concluida_ts   TIMESTAMP,

    -- Os VALORES dos campos personalizaveis, { "chave": valor }.
    campos_extras  JSONB            NOT NULL DEFAULT '{}',

    criado_por     INTEGER,
    criado_ts      TIMESTAMP        NOT NULL DEFAULT NOW(),
    atualizado_ts  TIMESTAMP        NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_tarefa PRIMARY KEY (id_tarefa),

    CONSTRAINT fk_tarefa_tenant
        FOREIGN KEY (id_tenant) REFERENCES tenant (id_tenant) ON DELETE CASCADE,

    -- COMPOSTA, como as de startup: sem o id_tenant, uma tarefa poderia
    -- apontar para a coluna de outra incubadora.
    CONSTRAINT fk_tarefa_status
        FOREIGN KEY (id_tenant, status)
        REFERENCES tarefa_status (id_tenant, chave)
        ON UPDATE CASCADE,

    CONSTRAINT fk_tarefa_responsavel
        FOREIGN KEY (id_responsavel) REFERENCES usuarios (id_usuario) ON DELETE SET NULL,

    CONSTRAINT fk_tarefa_startup
        FOREIGN KEY (id_startup) REFERENCES startup (id_startup) ON DELETE SET NULL,

    CONSTRAINT fk_tarefa_criado_por
        FOREIGN KEY (criado_por) REFERENCES usuarios (id_usuario) ON DELETE SET NULL
);

-- O quadro le sempre "as tarefas deste tenant, agrupadas por coluna, na ordem".
CREATE INDEX IF NOT EXISTS ix_tarefa_tenant_status
    ON tarefa (id_tenant, status, ordem);

-- "O que e meu" e a pergunta mais frequente depois do quadro inteiro.
CREATE INDEX IF NOT EXISTS ix_tarefa_responsavel
    ON tarefa (id_responsavel) WHERE id_responsavel IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_tarefa_startup
    ON tarefa (id_startup) WHERE id_startup IS NOT NULL;

-- Torna o JSONB pesquisavel sem varrer a tabela, como em startup.
CREATE INDEX IF NOT EXISTS ix_tarefa_campos_extras
    ON tarefa USING GIN (campos_extras);

COMMIT;
