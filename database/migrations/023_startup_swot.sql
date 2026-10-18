-- ===========================================================================
-- 023 — Analise SWOT da startup
--
-- CONTEXTO
-- A aba Modelos tinha o Business Model Canvas (o negocio), a Matriz GUT (o
-- que atacar primeiro) e o 5W2H (o plano de acao). Faltava o diagnostico que
-- costuma vir antes dos dois ultimos: Forcas e Fraquezas (internas), e
-- Oportunidades e Ameacas (externas).
--
-- POR QUE O MESMO FORMATO DO CANVAS (uma linha por quadrante, upsert), e nao
-- itens soltos como a GUT: cada quadrante e um texto livre que o incubado
-- reescreve com o mentor, salvo enquanto digita. Nao ha nada a ordenar nem a
-- pontuar por item.
--
-- POR QUE UMA TABELA PROPRIA, e nao mais quatro blocos em startup_canvas: o
-- Canvas tem chave RBAC propria (startups.canvas.*), e a SWOT ganha a dela
-- (startups.swot.*). Na mesma tabela, uma consulta do Canvas que esquecesse de
-- filtrar o bloco entregaria a SWOT a quem so pode ver o Canvas.
--
-- NAO-DESTRUTIVA: so cria a tabela.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS startup_swot (
    id_startup INTEGER NOT NULL,
    quadrante VARCHAR(20) NOT NULL,
    conteudo TEXT NOT NULL DEFAULT '',
    atualizado_ts TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_startup_swot PRIMARY KEY (id_startup, quadrante),

    CONSTRAINT fk_startup_swot_startup
        FOREIGN KEY (id_startup)
        REFERENCES startup (id_startup)
        ON DELETE CASCADE,

    CONSTRAINT ck_startup_swot_quadrante
        CHECK (quadrante IN ('forcas', 'fraquezas', 'oportunidades', 'ameacas'))
);
