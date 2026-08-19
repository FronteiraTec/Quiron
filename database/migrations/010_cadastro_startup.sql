-- ===========================================================================
-- 010 — O cadastro de startup vira um cadastro de verdade
--
-- CONTEXTO
-- A tabela `startup` tinha quatro campos uteis: nome, cnpj, logo e status. Na
-- pratica isso nao e o cadastro de uma empresa — e um rotulo. Nao havia onde
-- guardar quem falar (contato), como cobrar (inscricao estadual), para onde
-- mandar (endereco), o que a incubadora acha dela (observacoes), nem o
-- vocabulario que cada incubadora usa para classificar as suas.
--
-- O QUE MUDA
--   1. Colunas novas em `startup`: inscricao estadual, e-mail, observacoes e o
--      endereco completo (o CEP alimenta o resto via ViaCEP, no front).
--   2. `startup_contato` — a lista de contatos. Tabela, e nao JSONB: a lista
--      cresce e encolhe por linha, e cada contato tem identidade propria.
--      JSONB aqui obrigaria a reescrever o array inteiro para trocar um
--      telefone, e nao daria como achar "quem e o contato principal" sem
--      abrir o documento de cada startup.
--   3. `startup_tipo` e `startup_situacao` — o vocabulario de cada incubadora,
--      no mesmo desenho da migracao 008 (chave estavel + rotulo editavel).
--   4. `startup_campo` + `startup.campos_extras` JSONB — o modulo de campos
--      personalizaveis: a incubadora DEFINE os campos (em tabela) e cada
--      startup guarda os VALORES (em JSONB).
--
-- POR QUE A SITUACAO NAO SUBSTITUI O `status`
-- `startup.status` e o enum statusStartup e HA CODIGO ATRAS DELE: relatorios e
-- agenda tiram do programa quem esta ENCERRADA (`s.status <> 'ENCERRADA'`).
-- Trocar o enum por texto livre por tenant faria "Graduada" nao significar
-- nada para essas consultas, e a startup graduada voltaria a contar como
-- incubada ativa em todo relatorio.
--
-- Entao a situacao e o rotulo LIVRE, e cada uma declara a qual dos tres
-- estados de ciclo equivale (`ciclo`). A incubadora cria "Em tracao",
-- "Aceleracao", "Desligada"; o `status` continua sendo derivado do ciclo da
-- situacao escolhida, e nenhuma consulta existente precisa saber disso.
--
-- POR QUE OS CAMPOS PERSONALIZAVEIS SAO JSONB, E NAO TABELA CHAVE-VALOR
-- O modelo EAV (uma linha por valor) e a alternativa classica e custa caro:
-- ler uma startup com 12 campos extras vira 12 JOINs, e ninguem consulta esses
-- campos isoladamente — eles sao lidos junto com a startup, sempre. JSONB
-- entrega isso em uma coluna, com indice GIN quando precisar filtrar. A
-- DEFINICAO dos campos continua relacional (`startup_campo`), que e o que
-- precisa de integridade: tipo, mascara, opcoes e ordem.
--
-- EXCLUSAO E `ativo = FALSE`, NUNCA DELETE — mesmo motivo da 008: tipo apagado
-- com 40 startups apontando para ele seria barrado pela FK, e campo apagado
-- deixaria valor orfao dentro do JSONB de cada startup.
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. TIPO DE STARTUP — vocabulario livre de cada incubadora.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS startup_tipo (
    id_tenant INTEGER     NOT NULL,
    -- Identificador estavel, gravado em startup.tipo. Nao muda depois de
    -- criado; quem muda e o rotulo (mesmo desenho de evento_categoria).
    chave     VARCHAR(40) NOT NULL,
    rotulo    VARCHAR(60) NOT NULL,
    cor       CHAR(7)     NOT NULL DEFAULT '#6366f1',
    ordem     SMALLINT    NOT NULL DEFAULT 0,
    ativo     BOOLEAN     NOT NULL DEFAULT TRUE,
    criado_ts TIMESTAMP   NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_startup_tipo PRIMARY KEY (id_tenant, chave),

    CONSTRAINT fk_startup_tipo_tenant
        FOREIGN KEY (id_tenant) REFERENCES tenant (id_tenant) ON DELETE CASCADE,

    CONSTRAINT ck_startup_tipo_cor CHECK (cor ~ '^#[0-9a-fA-F]{6}$')
);

-- Dois tipos com o mesmo nome no seletor nao dariam para distinguir.
CREATE UNIQUE INDEX IF NOT EXISTS uq_startup_tipo_rotulo
    ON startup_tipo (id_tenant, lower(rotulo));

-- ---------------------------------------------------------------------------
-- 2. SITUACAO — o "status" que a incubadora ve, com o ciclo por tras.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS startup_situacao (
    id_tenant INTEGER       NOT NULL,
    chave     VARCHAR(40)   NOT NULL,
    rotulo    VARCHAR(60)   NOT NULL,
    cor       CHAR(7)       NOT NULL DEFAULT '#10b981',
    -- A qual dos tres estados do programa esta situacao equivale. E o que
    -- mantem relatorios e agenda funcionando com rotulos inventados: uma
    -- situacao "Graduada" com ciclo ENCERRADA sai das contagens do programa
    -- exatamente como a ENCERRADA saia antes.
    ciclo     statusStartup NOT NULL DEFAULT 'ATIVA',
    ordem     SMALLINT      NOT NULL DEFAULT 0,
    ativo     BOOLEAN       NOT NULL DEFAULT TRUE,
    criado_ts TIMESTAMP     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_startup_situacao PRIMARY KEY (id_tenant, chave),

    CONSTRAINT fk_startup_situacao_tenant
        FOREIGN KEY (id_tenant) REFERENCES tenant (id_tenant) ON DELETE CASCADE,

    CONSTRAINT ck_startup_situacao_cor CHECK (cor ~ '^#[0-9a-fA-F]{6}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_startup_situacao_rotulo
    ON startup_situacao (id_tenant, lower(rotulo));

-- ---------------------------------------------------------------------------
-- 3. CAMPOS PERSONALIZAVEIS — a DEFINICAO (o valor vai em startup.campos_extras)
-- ---------------------------------------------------------------------------
DO $bloco$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'campotipo') THEN
        CREATE TYPE campoTipo AS ENUM ('TEXTO', 'CATEGORIA', 'NUMERICO', 'DOCUMENTO', 'MONETARIO');
    END IF;
END
$bloco$;

CREATE TABLE IF NOT EXISTS startup_campo (
    id_campo    INTEGER GENERATED ALWAYS AS IDENTITY,
    id_tenant   INTEGER      NOT NULL,
    -- A chave e o nome da propriedade dentro de startup.campos_extras. Imutavel
    -- pelo mesmo motivo da categoria: ela esta gravada no JSONB de cada
    -- startup, e troca-la orfanaria todos os valores ja preenchidos.
    chave       VARCHAR(40)  NOT NULL,
    rotulo      VARCHAR(80)  NOT NULL,
    tipo        campoTipo    NOT NULL,
    -- Texto de ajuda sob o campo no formulario.
    descricao   VARCHAR(200),
    obrigatorio BOOLEAN      NOT NULL DEFAULT FALSE,
    ordem       SMALLINT     NOT NULL DEFAULT 0,
    ativo       BOOLEAN      NOT NULL DEFAULT TRUE,
    -- O que muda de tipo para tipo, e so faz sentido dentro dele:
    --   CATEGORIA -> { "opcoes": [{ "valor": "A", "rotulo": "Opcao A" }] }
    --   DOCUMENTO -> { "mascara": "###.###.###-##" }
    --   NUMERICO  -> { "min": 0, "max": 100, "casas": 2, "sufixo": "%" }
    --   MONETARIO -> { "moeda": "BRL" }
    -- Colunas dedicadas para cada uma dessas seriam cinco colunas nulas em
    -- quatro quintos das linhas.
    config      JSONB        NOT NULL DEFAULT '{}',
    criado_ts   TIMESTAMP    NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_startup_campo PRIMARY KEY (id_campo),

    CONSTRAINT fk_startup_campo_tenant
        FOREIGN KEY (id_tenant) REFERENCES tenant (id_tenant) ON DELETE CASCADE
);

-- A chave identifica o campo dentro do JSONB: duas iguais no mesmo tenant
-- fariam uma sobrescrever a outra silenciosamente.
CREATE UNIQUE INDEX IF NOT EXISTS uq_startup_campo_chave
    ON startup_campo (id_tenant, chave);
CREATE UNIQUE INDEX IF NOT EXISTS uq_startup_campo_rotulo
    ON startup_campo (id_tenant, lower(rotulo));

-- ---------------------------------------------------------------------------
-- 4. COLUNAS NOVAS EM startup
-- ---------------------------------------------------------------------------
ALTER TABLE startup
    ADD COLUMN IF NOT EXISTS inscricao_estadual VARCHAR(20),
    ADD COLUMN IF NOT EXISTS email              VARCHAR(150),
    ADD COLUMN IF NOT EXISTS tipo               VARCHAR(40),
    ADD COLUMN IF NOT EXISTS situacao           VARCHAR(40),
    ADD COLUMN IF NOT EXISTS observacoes        TEXT,
    -- Endereco. Sem mascara, como o CNPJ: o CEP e CHAR(8) e o front formata.
    ADD COLUMN IF NOT EXISTS cep                CHAR(8),
    ADD COLUMN IF NOT EXISTS uf                 CHAR(2),
    ADD COLUMN IF NOT EXISTS cidade             VARCHAR(100),
    ADD COLUMN IF NOT EXISTS bairro             VARCHAR(100),
    ADD COLUMN IF NOT EXISTS rua                VARCHAR(150),
    -- O ViaCEP nao devolve numero nem complemento — sem eles o endereco nao
    -- chega em lugar nenhum.
    ADD COLUMN IF NOT EXISTS numero             VARCHAR(20),
    ADD COLUMN IF NOT EXISTS complemento        VARCHAR(100),
    -- Os VALORES dos campos personalizaveis, { "chave": valor }.
    ADD COLUMN IF NOT EXISTS campos_extras      JSONB NOT NULL DEFAULT '{}';

-- Indice GIN: e o que torna o JSONB pesquisavel ("startups cujo campo
-- 'setor' e 'AgriTech'") sem varrer a tabela inteira.
CREATE INDEX IF NOT EXISTS ix_startup_campos_extras
    ON startup USING GIN (campos_extras);

-- ---------------------------------------------------------------------------
-- 5. CONTATOS — a lista de quem falar em cada startup.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS startup_contato (
    id_contato INTEGER GENERATED ALWAYS AS IDENTITY,
    id_startup INTEGER      NOT NULL,
    nome       VARCHAR(150) NOT NULL,
    cargo      VARCHAR(100),
    email      VARCHAR(150),
    -- Sem mascara, como usuarios.celular: o front formata na exibicao.
    telefone   VARCHAR(15),
    -- O contato que aparece primeiro na lista e no card da startup.
    principal  BOOLEAN      NOT NULL DEFAULT FALSE,
    ordem      SMALLINT     NOT NULL DEFAULT 0,
    criado_ts  TIMESTAMP    NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_startup_contato PRIMARY KEY (id_contato),

    -- CASCADE de verdade aqui, ao contrario de tipo/situacao: contato nao e
    -- vocabulario compartilhado, e dado da startup. Sem ela, nao existe.
    CONSTRAINT fk_startup_contato_startup
        FOREIGN KEY (id_startup) REFERENCES startup (id_startup) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_startup_contato_startup
    ON startup_contato (id_startup);

-- Um principal por startup, no maximo. Indice parcial, e nao CHECK: e a unica
-- forma de dizer "unico entre os que sao TRUE" no Postgres.
CREATE UNIQUE INDEX IF NOT EXISTS uq_startup_contato_principal
    ON startup_contato (id_startup) WHERE principal;

-- ---------------------------------------------------------------------------
-- 6. BACKFILL — o depois tem que ser igual ao antes.
--
--    Toda incubadora ganha o vocabulario padrao, e cada startup existente
--    recebe a situacao equivalente ao status que ja tinha. Nenhuma tela muda
--    de conteudo no dia da virada.
--
--    Vem ANTES das FKs de proposito: com as startups ainda sem tipo/situacao,
--    a constraint nasceria apontando para linhas que so existem depois daqui.
-- ---------------------------------------------------------------------------

-- 6a. Tipos padrao para todo tenant existente.
INSERT INTO startup_tipo (id_tenant, chave, rotulo, cor, ordem)
SELECT t.id_tenant, v.chave, v.rotulo, v.cor, v.ordem
  FROM tenant t
  CROSS JOIN (VALUES
      ('INCUBADA',  'Incubada',  '#6366f1'::CHAR(7), 1::SMALLINT),
      ('RESIDENTE', 'Residente', '#0ea5e9',          2),
      ('ASSOCIADA', 'Associada', '#10b981',          3),
      ('GRADUADA',  'Graduada',  '#f59e0b',          4)
  ) AS v(chave, rotulo, cor, ordem)
ON CONFLICT DO NOTHING;

-- 6b. Situacoes padrao. Rotulos e cores sao os de data/startupMeta.js.
INSERT INTO startup_situacao (id_tenant, chave, rotulo, cor, ciclo, ordem)
SELECT t.id_tenant, v.chave, v.rotulo, v.cor, v.ciclo, v.ordem
  FROM tenant t
  CROSS JOIN (VALUES
      ('ATIVA',     'Ativa',     '#10b981'::CHAR(7), 'ATIVA'::statusStartup,     1::SMALLINT),
      ('PAUSADA',   'Pausada',   '#f59e0b',          'PAUSADA'::statusStartup,   2),
      ('ENCERRADA', 'Concluida', '#64748b',          'ENCERRADA'::statusStartup, 3)
  ) AS v(chave, rotulo, cor, ciclo, ordem)
ON CONFLICT DO NOTHING;

-- 6c. Cada startup recebe a situacao de mesmo nome do status que ja tinha —
--     as chaves padrao sao os proprios valores do enum, entao a correspondencia
--     e direta.
UPDATE startup
   SET situacao = status::TEXT
 WHERE situacao IS NULL;

-- 6d. Tipo: as ja ENCERRADAS entram como "Graduada", o resto como "Incubada".
--     E a leitura mais fiel do que o status significava ate aqui.
UPDATE startup
   SET tipo = CASE WHEN status = 'ENCERRADA' THEN 'GRADUADA' ELSE 'INCUBADA' END
 WHERE tipo IS NULL;

-- ---------------------------------------------------------------------------
-- 7. AS FKs COMPOSTAS, agora que ha para onde apontar.
--
--    Compostas de proposito: sem o id_tenant nelas, uma startup poderia
--    apontar para o tipo de outra incubadora. Igual a fk_evento_categoria
--    da 008.
-- ---------------------------------------------------------------------------
ALTER TABLE startup DROP CONSTRAINT IF EXISTS fk_startup_tipo;
ALTER TABLE startup
    ADD CONSTRAINT fk_startup_tipo
        FOREIGN KEY (id_tenant, tipo)
        REFERENCES startup_tipo (id_tenant, chave)
        ON UPDATE CASCADE;

ALTER TABLE startup DROP CONSTRAINT IF EXISTS fk_startup_situacao;
ALTER TABLE startup
    ADD CONSTRAINT fk_startup_situacao
        FOREIGN KEY (id_tenant, situacao)
        REFERENCES startup_situacao (id_tenant, chave)
        ON UPDATE CASCADE;

COMMIT;
