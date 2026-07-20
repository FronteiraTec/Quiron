-- ===========================================================================
-- 002 — Jornada do incubado: moldura pedagogica e rascunho de entrega
--
-- CONTEXTO
-- A Jornada (visao da startup) era inteiramente mockada. Ao pluga-la no banco
-- faltaram duas coisas:
--
--   1. A MOLDURA PEDAGOGICA do passo. A Jornada nao mostra so "faca isto":
--      mostra o objetivo, o porque aquilo importa, que competencias treina e
--      que AREA da empresa aquele passo constroi. Sem esses campos, a pagina
--      "Minha Empresa" (blueprint + radar de maturidade) fica sem eixo.
--
--   2. O RASCUNHO. A tabela entrega so registrava submissoes ja enviadas —
--      existir era sinonimo de "entregue". A Jornada precisa distinguir o
--      rascunho salvo (em obra) do que foi enviado ao mentor.
--
-- Os demais estados do passo continuam DERIVADOS, sem coluna propria:
--   sem entrega                  -> NAO_INICIADA
--   entrega RASCUNHO             -> RASCUNHO
--   entrega ENVIADA sem avaliar  -> AGUARDANDO
--   ultima avaliacao AJUSTE      -> AJUSTE
--   ultima avaliacao APROVADO    -> APROVADO
--
-- NAO-DESTRUTIVA: so adiciona colunas, todas anulaveis ou com default.
--
-- COMO RODAR
--   psql -d <base> -f database/migrations/002_jornada.sql
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Moldura pedagogica do PASSO.
--    Anulaveis: fase e modulo nao usam, e passos antigos ficam sem ate serem
--    preenchidos no Construtor.
-- ---------------------------------------------------------------------------
ALTER TABLE trilha_no
    ADD COLUMN IF NOT EXISTS objetivo     TEXT,
    ADD COLUMN IF NOT EXISTS porque       TEXT,
    ADD COLUMN IF NOT EXISTS competencias TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS area         VARCHAR(40);

COMMENT ON COLUMN trilha_no.objetivo IS
    'O que o incubado deve alcancar neste passo (mostrado na Jornada).';
COMMENT ON COLUMN trilha_no.porque IS
    'Por que este passo importa — a justificativa pedagogica.';
COMMENT ON COLUMN trilha_no.competencias IS
    'Competencias que o passo desenvolve.';
COMMENT ON COLUMN trilha_no.area IS
    'Area da empresa que este passo constroi (eixo do blueprint em Minha Empresa).';

-- Area so faz sentido num PASSO — e o que liga a trilha ao blueprint.
ALTER TABLE trilha_no DROP CONSTRAINT IF EXISTS ck_trilha_no_area;
ALTER TABLE trilha_no ADD CONSTRAINT ck_trilha_no_area CHECK (
    area IS NULL OR tipo = 'PASSO'
);


-- ---------------------------------------------------------------------------
-- 2. Rascunho de entrega.
--    RASCUNHO  -> salvo pelo incubado, ainda nao foi ao mentor
--    ENVIADA   -> submetida, aguardando avaliacao
--    As entregas que ja existiam foram todas submetidas — por isso o default.
-- ---------------------------------------------------------------------------
CREATE TYPE entregaStatus AS ENUM ('RASCUNHO', 'ENVIADA');

ALTER TABLE entrega
    ADD COLUMN IF NOT EXISTS status entregaStatus NOT NULL DEFAULT 'ENVIADA',
    ADD COLUMN IF NOT EXISTS atualizado_ts TIMESTAMP NOT NULL DEFAULT NOW();

-- Uma startup tem UMA entrega por passo, reescrita a cada rascunho/reenvio.
-- Sem isto, salvar o rascunho duas vezes criaria duas linhas e o estado do
-- passo passaria a depender de qual delas a consulta pegasse primeiro.
CREATE UNIQUE INDEX IF NOT EXISTS uk_entrega_passo_startup
    ON entrega (id_no, id_startup);

CREATE INDEX IF NOT EXISTS ix_entrega_startup ON entrega (id_startup);


-- ---------------------------------------------------------------------------
-- 3. Anexos da entrega.
--    O mock guardava uma lista de anexos por entrega; a coluna arquivo_url
--    comportava so um. Um array evita criar tabela para algo que e sempre
--    lido junto da entrega.
-- ---------------------------------------------------------------------------
ALTER TABLE entrega
    ADD COLUMN IF NOT EXISTS anexos TEXT[] NOT NULL DEFAULT '{}';

COMMIT;
