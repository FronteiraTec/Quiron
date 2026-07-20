-- ===========================================================================
-- 001 — Biblioteca de Conteudo + Trilha unificada
--
-- CONTEXTO
-- Ate aqui a estrutura da incubadora vivia em tres tabelas irmas (fase ->
-- modulo -> tarefa), cada uma com seu CRUD, sua tela e seu repository. O
-- Construtor de Programa (front) ja tratava tudo como UMA arvore generica,
-- e a Biblioteca guardava o conteudo — mas so no mock, sem persistencia.
--
-- Esta migracao consolida os dois lados:
--
--   fase + modulo + tarefa  ->  trilha_no      (uma arvore auto-referenciada)
--   (mock da Biblioteca)    ->  conteudo       (+ conteudo_bloco)
--   (vinculo mockado)       ->  trilha_conteudo
--
-- SEPARACAO DE PAPEIS
--   conteudo   = O QUE se ensina. Reutilizavel, sem posicao, sem prazo.
--                Uma aula de Canvas existe uma vez e serve varios programas.
--   trilha_no  = ONDE/QUANDO se ensina. Ordem, prazo, entregavel, progresso.
--
-- Sao ciclos de vida diferentes: editar a aula nao mexe na trilha, e
-- reordenar a trilha nao mexe na aula. Por isso duas tabelas e uma juncao,
-- e nao um blob so.
--
-- NAO-DESTRUTIVA
-- Nenhum dado e perdido. As entregas, avaliacoes, respostas e o progresso
-- das startups sao REAPONTADOS para os nos equivalentes da nova arvore.
-- As tabelas antigas so caem no passo 9, ja vazias de dependentes, e o
-- passo 0 guarda um backup para rollback.
--
-- COMO RODAR
--   psql -d <base> -f database/migrations/001_biblioteca_trilha.sql
-- Roda inteira dentro de uma transacao: ou aplica tudo, ou nada.
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Backup das tabelas que serao removidas.
--    Ficam no schema `bkp_001` ate voce validar a migracao. Para descartar:
--      DROP SCHEMA bkp_001 CASCADE;
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS bkp_001;

CREATE TABLE bkp_001.fase         AS SELECT * FROM fase;
CREATE TABLE bkp_001.modulo       AS SELECT * FROM modulo;
CREATE TABLE bkp_001.tarefa       AS SELECT * FROM tarefa;
CREATE TABLE bkp_001.entrega      AS SELECT * FROM entrega;
CREATE TABLE bkp_001.startup_fase AS SELECT * FROM startup_fase;


-- ---------------------------------------------------------------------------
-- 1. Tipos novos.
-- ---------------------------------------------------------------------------

-- Niveis da arvore. PROGRAMA e a raiz (um por trilha do tenant); PASSO e a
-- folha — o que a startup efetivamente executa e entrega.
CREATE TYPE trilhaNoTipo AS ENUM ('PROGRAMA', 'FASE', 'MODULO', 'PASSO');

-- Tipos de conteudo da Biblioteca. Espelha TIPO_CONTEUDO no front
-- (frontend/src/data/bibliotecaMock.js).
CREATE TYPE conteudoTipo AS ENUM ('AULA', 'VIDEO', 'ARQUIVO', 'TEMPLATE', 'LINK');

-- Blocos de uma AULA (editor estilo Notion). Espelha BLOCOS_TIPOS no front.
CREATE TYPE blocoTipo AS ENUM (
    'h1', 'h2', 'paragrafo', 'lista', 'callout', 'video', 'arquivo', 'divisor'
);


-- ---------------------------------------------------------------------------
-- 2. BIBLIOTECA — o acervo reutilizavel.
-- ---------------------------------------------------------------------------
CREATE TABLE conteudo (
    id_conteudo  INTEGER GENERATED ALWAYS AS IDENTITY,
    id_tenant    INTEGER NOT NULL,

    tipo         conteudoTipo NOT NULL,
    titulo       VARCHAR(200) NOT NULL,
    resumo       TEXT,
    tags         TEXT[] NOT NULL DEFAULT '{}',

    -- Campos por tipo. Nem todos se aplicam a todos os tipos — a checagem
    -- ck_conteudo_corpo abaixo garante o minimo de cada um.
    url          TEXT,           -- VIDEO, LINK, ARQUIVO, TEMPLATE
    nome_arquivo VARCHAR(255),   -- ARQUIVO, TEMPLATE
    duracao      VARCHAR(20),    -- AULA, VIDEO (texto livre: "8 min")

    criado_por   INTEGER,
    criado_ts    TIMESTAMP NOT NULL DEFAULT NOW(),
    atualizado_ts TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_conteudo PRIMARY KEY (id_conteudo),

    CONSTRAINT fk_conteudo_tenant
        FOREIGN KEY (id_tenant)
        REFERENCES tenant (id_tenant)
        ON DELETE CASCADE,

    CONSTRAINT fk_conteudo_criado_por
        FOREIGN KEY (criado_por)
        REFERENCES usuarios (id_usuario),

    -- LINK e VIDEO sem url nao servem para nada; AULA guarda o corpo em
    -- conteudo_bloco, entao nao exige url.
    CONSTRAINT ck_conteudo_corpo CHECK (
        (tipo IN ('LINK', 'VIDEO') AND url IS NOT NULL AND url <> '')
        OR tipo IN ('AULA', 'ARQUIVO', 'TEMPLATE')
    )
);

CREATE INDEX ix_conteudo_tenant      ON conteudo (id_tenant);
CREATE INDEX ix_conteudo_tenant_tipo ON conteudo (id_tenant, tipo);
-- GIN para o filtro por tag (tags @> ARRAY['Pitch']).
CREATE INDEX ix_conteudo_tags        ON conteudo USING GIN (tags);


-- Corpo da AULA: lista ordenada de blocos.
CREATE TABLE conteudo_bloco (
    id_bloco    INTEGER GENERATED ALWAYS AS IDENTITY,
    id_conteudo INTEGER NOT NULL,

    tipo        blocoTipo NOT NULL,
    ordem       INTEGER NOT NULL,
    texto       TEXT,
    url         TEXT,           -- blocos video/arquivo
    nome        VARCHAR(255),   -- rotulo do embed/anexo
    variante    VARCHAR(20),    -- callout: dica | atencao | erro

    CONSTRAINT pk_conteudo_bloco PRIMARY KEY (id_bloco),

    CONSTRAINT fk_bloco_conteudo
        FOREIGN KEY (id_conteudo)
        REFERENCES conteudo (id_conteudo)
        ON DELETE CASCADE,

    -- DEFERRABLE: reordenar blocos reescreve ordem 1..n de uma vez; sem isso
    -- a constraint estoura no meio do UPDATE em lote.
    CONSTRAINT uk_bloco_ordem
        UNIQUE (id_conteudo, ordem)
        DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX ix_bloco_conteudo ON conteudo_bloco (id_conteudo, ordem);


-- ---------------------------------------------------------------------------
-- 3. TRILHA — a arvore que substitui fase + modulo + tarefa.
--
-- Auto-referenciada: PROGRAMA -> FASE -> MODULO -> PASSO, profundidade
-- garantida pelo trigger trg_trilha_no_hierarquia (passo 4).
-- ---------------------------------------------------------------------------
CREATE TABLE trilha_no (
    id_no      INTEGER GENERATED ALWAYS AS IDENTITY,
    id_tenant  INTEGER NOT NULL,
    id_pai     INTEGER,          -- NULL apenas para PROGRAMA (raiz)

    tipo       trilhaNoTipo NOT NULL,
    nome       VARCHAR(200) NOT NULL,
    descricao  TEXT,
    ordem      INTEGER NOT NULL DEFAULT 1,
    ativo      BOOLEAN NOT NULL DEFAULT TRUE,

    -- ---- Campos que so fazem sentido em PASSO (folha) --------------------
    -- Herdados da antiga tabela `tarefa`:
    tipo_passo      tarefaTipo,   -- TEXTO | ANEXO | VIDEO | QUESTIONARIO
    permite_entrega BOOLEAN NOT NULL DEFAULT FALSE,
    obrigatoria     BOOLEAN NOT NULL DEFAULT TRUE,
    id_questionario INTEGER,
    anexo           TEXT,
    -- Novos, que o Construtor ja editava no mock e nao tinham onde morar:
    prazo           DATE,
    carga_horaria   VARCHAR(20),
    entregavel      TEXT,

    criado_ts     TIMESTAMP NOT NULL DEFAULT NOW(),
    atualizado_ts TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_trilha_no PRIMARY KEY (id_no),

    CONSTRAINT fk_trilha_no_tenant
        FOREIGN KEY (id_tenant)
        REFERENCES tenant (id_tenant)
        ON DELETE CASCADE,

    -- Apagar um no leva a subarvore junto — mesma semantica que fase->modulo
    -- ->tarefa tinham antes.
    CONSTRAINT fk_trilha_no_pai
        FOREIGN KEY (id_pai)
        REFERENCES trilha_no (id_no)
        ON DELETE CASCADE,

    CONSTRAINT fk_trilha_no_questionario
        FOREIGN KEY (id_questionario)
        REFERENCES questionarios (id_questionario),

    -- So a raiz pode ser orfa.
    CONSTRAINT ck_trilha_no_raiz CHECK (
        (tipo = 'PROGRAMA' AND id_pai IS NULL)
        OR (tipo <> 'PROGRAMA' AND id_pai IS NOT NULL)
    ),

    -- Questionario so em passo do tipo QUESTIONARIO.
    CONSTRAINT ck_trilha_no_questionario CHECK (
        id_questionario IS NULL OR tipo_passo = 'QUESTIONARIO'
    ),

    -- DEFERRABLE resolve o problema do drag-and-drop: o Construtor reindexa
    -- ordem 1..n a cada arrasto, e sem isso o UPDATE em lote colide consigo
    -- mesmo no meio do caminho.
    CONSTRAINT uk_trilha_no_ordem
        UNIQUE (id_pai, ordem)
        DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX ix_trilha_no_pai    ON trilha_no (id_pai, ordem);
CREATE INDEX ix_trilha_no_tenant ON trilha_no (id_tenant, tipo);


-- Juncao: quais conteudos da Biblioteca um PASSO ensina.
-- E aqui que "reutilizar" acontece — o passo aponta, nao copia.
CREATE TABLE trilha_conteudo (
    id_no       INTEGER NOT NULL,
    id_conteudo INTEGER NOT NULL,
    ordem       INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT pk_trilha_conteudo PRIMARY KEY (id_no, id_conteudo),

    CONSTRAINT fk_tc_no
        FOREIGN KEY (id_no)
        REFERENCES trilha_no (id_no)
        ON DELETE CASCADE,

    -- RESTRICT de proposito: excluir da Biblioteca um conteudo em uso deve
    -- falhar e avisar, nao sumir silenciosamente da trilha. E o que alimenta
    -- o aviso "usado em N passos" do ConfirmDialog.
    CONSTRAINT fk_tc_conteudo
        FOREIGN KEY (id_conteudo)
        REFERENCES conteudo (id_conteudo)
        ON DELETE RESTRICT
);

CREATE INDEX ix_tc_conteudo ON trilha_conteudo (id_conteudo);


-- ---------------------------------------------------------------------------
-- 4. Trigger de hierarquia — garante PROGRAMA > FASE > MODULO > PASSO.
--    Um CHECK nao alcanca a linha do pai, entao a regra vive aqui.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_trilha_no_hierarquia()
RETURNS TRIGGER AS $$
DECLARE
    tipo_pai trilhaNoTipo;
    esperado trilhaNoTipo;
BEGIN
    IF NEW.id_pai IS NULL THEN
        RETURN NEW;  -- raiz: ck_trilha_no_raiz ja garante que e PROGRAMA
    END IF;

    SELECT tipo INTO tipo_pai FROM trilha_no WHERE id_no = NEW.id_pai;

    esperado := CASE tipo_pai
        WHEN 'PROGRAMA' THEN 'FASE'
        WHEN 'FASE'     THEN 'MODULO'
        WHEN 'MODULO'   THEN 'PASSO'
        ELSE NULL
    END;

    IF esperado IS NULL THEN
        RAISE EXCEPTION 'PASSO e folha: nao aceita filhos (no pai %)', NEW.id_pai;
    END IF;

    IF NEW.tipo <> esperado THEN
        RAISE EXCEPTION 'Filho de % deve ser %, recebido %',
            tipo_pai, esperado, NEW.tipo;
    END IF;

    -- Um no nunca troca de tenant ao mudar de pai.
    IF NEW.id_tenant <> (SELECT id_tenant FROM trilha_no WHERE id_no = NEW.id_pai) THEN
        RAISE EXCEPTION 'No e pai devem pertencer ao mesmo tenant';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_trilha_no_hierarquia
    BEFORE INSERT OR UPDATE OF id_pai, tipo ON trilha_no
    FOR EACH ROW EXECUTE FUNCTION fn_trilha_no_hierarquia();


-- ---------------------------------------------------------------------------
-- 5. Migracao dos dados: fase/modulo/tarefa -> trilha_no.
--
-- de_para guarda a correspondencia id antigo -> id novo, para reapontar
-- entrega e startup_fase nos passos 6 e 7.
-- ---------------------------------------------------------------------------
-- Coluna temporaria com o id de origem. E o que torna o mapeamento EXATO:
-- casar por nome falharia em bases com nomes repetidos sob o mesmo pai (o
-- schema antigo permitia — so `ordem` era unica).
ALTER TABLE trilha_no ADD COLUMN _legado VARCHAR(20);

-- 5a. Um PROGRAMA raiz por tenant que ja tenha fases.
INSERT INTO trilha_no (id_tenant, id_pai, tipo, nome, descricao, ordem, _legado)
SELECT DISTINCT f.id_tenant, NULL::INTEGER, 'PROGRAMA'::trilhaNoTipo, 'Trilha de Incubacao',
       'Programa migrado da estrutura anterior (fases, modulos e tarefas).', 1,
       'prog:' || f.id_tenant
FROM fase f;

-- 5b. fase -> FASE
INSERT INTO trilha_no (id_tenant, id_pai, tipo, nome, descricao, ordem, ativo, criado_ts, _legado)
SELECT f.id_tenant, p.id_no, 'FASE'::trilhaNoTipo, f.nome, f.descricao, f.ordem, f.ativa,
       f.criado_ts, 'fase:' || f.id_fase
FROM fase f
JOIN trilha_no p ON p._legado = 'prog:' || f.id_tenant;

-- 5c. modulo -> MODULO
INSERT INTO trilha_no (id_tenant, id_pai, tipo, nome, descricao, ordem, ativo, criado_ts, _legado)
SELECT f.id_tenant, pai.id_no, 'MODULO'::trilhaNoTipo, m.nome, m.descricao, m.ordem, m.ativo,
       m.criado_ts, 'modulo:' || m.id_modulo
FROM modulo m
JOIN fase f      ON f.id_fase = m.id_fase
JOIN trilha_no pai ON pai._legado = 'fase:' || m.id_fase;

-- 5d. tarefa -> PASSO (titulo vira nome; campos especificos preservados)
INSERT INTO trilha_no (
    id_tenant, id_pai, tipo, nome, descricao, ordem, ativo, criado_ts,
    tipo_passo, permite_entrega, obrigatoria, id_questionario, anexo, _legado
)
SELECT f.id_tenant, pai.id_no, 'PASSO'::trilhaNoTipo, t.titulo, t.descricao, t.ordem,
       t.ativo, t.criado_ts,
       t.tipo, t.permite_entrega, t.obrigatoria, t.id_questionario, t.anexo,
       'tarefa:' || t.id_tarefa
FROM tarefa t
JOIN modulo m      ON m.id_modulo = t.id_modulo
JOIN fase f        ON f.id_fase = m.id_fase
JOIN trilha_no pai ON pai._legado = 'modulo:' || t.id_modulo;

-- Visao de compatibilidade com o resto da migracao (passos 6, 7 e 8).
CREATE TEMP VIEW de_para AS
SELECT split_part(_legado, ':', 1) AS origem,
       split_part(_legado, ':', 2)::INTEGER AS id_velho,
       id_no AS id_novo
FROM trilha_no
WHERE _legado IS NOT NULL AND _legado NOT LIKE 'prog:%';

-- Rede de seguranca. Com o mapeamento por _legado isto nao deve mais falhar;
-- fica como conferencia de que nenhuma linha se perdeu no caminho.
DO $$
DECLARE
    n_fase INTEGER; n_mod INTEGER; n_tar INTEGER;
BEGIN
    SELECT COUNT(*) INTO n_fase FROM de_para WHERE origem = 'fase';
    SELECT COUNT(*) INTO n_mod  FROM de_para WHERE origem = 'modulo';
    SELECT COUNT(*) INTO n_tar  FROM de_para WHERE origem = 'tarefa';

    IF n_fase <> (SELECT COUNT(*) FROM fase) THEN
        RAISE EXCEPTION 'Mapeamento de fases inconsistente: % de %',
            n_fase, (SELECT COUNT(*) FROM fase);
    END IF;
    IF n_mod <> (SELECT COUNT(*) FROM modulo) THEN
        RAISE EXCEPTION 'Mapeamento de modulos inconsistente: % de %',
            n_mod, (SELECT COUNT(*) FROM modulo);
    END IF;
    IF n_tar <> (SELECT COUNT(*) FROM tarefa) THEN
        RAISE EXCEPTION 'Mapeamento de tarefas inconsistente: % de %',
            n_tar, (SELECT COUNT(*) FROM tarefa);
    END IF;
END $$;


-- ---------------------------------------------------------------------------
-- 6. entrega: id_tarefa -> id_no.
--    Avaliacao e resposta penduram em entrega, entao seguem junto de graca.
-- ---------------------------------------------------------------------------
ALTER TABLE entrega ADD COLUMN id_no INTEGER;

UPDATE entrega e
SET id_no = dp.id_novo
FROM de_para dp
WHERE dp.origem = 'tarefa' AND dp.id_velho = e.id_tarefa;

-- Nenhuma entrega pode ficar orfa.
DO $$
DECLARE orfas INTEGER;
BEGIN
    SELECT COUNT(*) INTO orfas FROM entrega WHERE id_no IS NULL;
    IF orfas > 0 THEN
        RAISE EXCEPTION '% entrega(s) sem no correspondente — abortando', orfas;
    END IF;
END $$;

ALTER TABLE entrega ALTER COLUMN id_no SET NOT NULL;
ALTER TABLE entrega DROP CONSTRAINT fk_entrega_tarefa;
ALTER TABLE entrega DROP COLUMN id_tarefa;
ALTER TABLE entrega ADD CONSTRAINT fk_entrega_no
    FOREIGN KEY (id_no) REFERENCES trilha_no (id_no) ON DELETE CASCADE;

CREATE INDEX ix_entrega_no ON entrega (id_no);


-- ---------------------------------------------------------------------------
-- 7. startup_fase: id_fase -> id_no.
-- ---------------------------------------------------------------------------
ALTER TABLE startup_fase ADD COLUMN id_no INTEGER;

UPDATE startup_fase sf
SET id_no = dp.id_novo
FROM de_para dp
WHERE dp.origem = 'fase' AND dp.id_velho = sf.id_fase;

DO $$
DECLARE orfas INTEGER;
BEGIN
    SELECT COUNT(*) INTO orfas FROM startup_fase WHERE id_no IS NULL;
    IF orfas > 0 THEN
        RAISE EXCEPTION '% startup_fase sem no correspondente — abortando', orfas;
    END IF;
END $$;

ALTER TABLE startup_fase ALTER COLUMN id_no SET NOT NULL;
ALTER TABLE startup_fase DROP CONSTRAINT fk_startup_fase_fase;
ALTER TABLE startup_fase DROP COLUMN id_fase;
ALTER TABLE startup_fase ADD CONSTRAINT fk_startup_fase_no
    FOREIGN KEY (id_no) REFERENCES trilha_no (id_no) ON DELETE CASCADE;

CREATE INDEX ix_startup_fase_no ON startup_fase (id_no);

-- A tabela agora rastreia progresso em qualquer no, nao so em fase.
ALTER TABLE startup_fase RENAME TO startup_trilha;


-- ---------------------------------------------------------------------------
-- 8. Extracao do conteudo embutido em tarefa.anexo.
--    Vira um ARQUIVO na Biblioteca, ja vinculado ao passo de origem. Assim
--    nada do que a incubadora ja tinha subido se perde na troca de modelo.
-- ---------------------------------------------------------------------------
WITH anexos AS (
    SELECT dp.id_novo AS id_no, f.id_tenant, t.titulo, t.anexo
    FROM tarefa t
    JOIN modulo m   ON m.id_modulo = t.id_modulo
    JOIN fase f     ON f.id_fase = m.id_fase
    JOIN de_para dp ON dp.origem = 'tarefa' AND dp.id_velho = t.id_tarefa
    WHERE t.anexo IS NOT NULL AND t.anexo <> ''
), criados AS (
    INSERT INTO conteudo (id_tenant, tipo, titulo, resumo, url)
    SELECT a.id_tenant, 'ARQUIVO',
           'Anexo — ' || a.titulo,
           'Migrado automaticamente do anexo da tarefa.',
           a.anexo
    FROM anexos a
    RETURNING id_conteudo, url
)
INSERT INTO trilha_conteudo (id_no, id_conteudo, ordem)
SELECT a.id_no, c.id_conteudo, 1
FROM anexos a
JOIN criados c ON c.url = a.anexo;


-- ---------------------------------------------------------------------------
-- 9. Queda das tabelas antigas.
--    A esta altura ja nao ha dependentes: entrega e startup_trilha apontam
--    para trilha_no, e o backup do passo 0 cobre qualquer arrependimento.
-- ---------------------------------------------------------------------------
DROP VIEW de_para;

DROP TABLE tarefa;
DROP TABLE modulo;
DROP TABLE fase;

-- A coluna de rastreio so servia durante a migracao.
ALTER TABLE trilha_no DROP COLUMN _legado;

-- tarefaTipo continua em uso por trilha_no.tipo_passo — nao cai.

COMMIT;

-- ===========================================================================
-- APOS VALIDAR:  DROP SCHEMA bkp_001 CASCADE;
-- ===========================================================================
