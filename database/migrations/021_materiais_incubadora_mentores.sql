-- ===========================================================================
-- 021 — Materiais da incubadora para os mentores
--
-- CONTEXTO
-- O Espaco do Mentor (migracao 020) deu ao mentor uma biblioteca PESSOAL e um
-- jeito de entregar material as startups. Faltava o caminho no outro sentido:
-- a INCUBADORA entregando material AOS MENTORES — o guia do mentor, a rubrica
-- de avaliacao das entregas, o roteiro da primeira reuniao, o modelo de
-- relatorio de mentoria. Isso circulava por e-mail e se perdia a cada mentor
-- novo.
--
-- POR QUE UMA TABELA PROPRIA, e nao uma coluna "escopo" em mentor_material:
-- e o mesmo raciocinio de tarefa_campo x startup_campo (migracao 014). Sao o
-- mesmo recurso — um material com arquivo ou link — aplicado a outro dono. A
-- tabela compartilhada obrigaria TODA consulta da biblioteca pessoal a lembrar
-- de filtrar o escopo, e um filtro esquecido vazaria material de um lado para o
-- outro. Separadas, a biblioteca pessoal continua privada por construcao.
--
-- POR QUE NAO A BIBLIOTECA (`conteudo`): ela e o acervo PARA AS STARTUPS, e o
-- incubado enxerga a Biblioteca por padrao (programa.biblioteca.visualizar na
-- role Colaborador). Material de mentor — uma rubrica de avaliacao, por
-- exemplo — nao pode aparecer para quem e avaliado por ela.
--
-- QUEM VE: quem tem `mentoria.materiais_incubadora.visualizar` (a role Mentor
-- nasce com ela). QUEM MEXE: criar/editar/excluir, que ficam com o
-- Administrador. Arquivar tira o material da vista dos mentores sem apaga-lo.
--
-- O ARQUIVO segue o caminho de sempre (`arquivo`, volume de uploads) e so abre
-- pelo proprio material (GET /espaco-mentor/incubadora/:id/arquivo), como o da
-- biblioteca pessoal: a rota generica de arquivos recusa a quem nao o enviou.
--
-- NAO-DESTRUTIVA: so cria tabela e indices novos.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS mentor_material_incubadora (
    id_material    INTEGER GENERATED ALWAYS AS IDENTITY,
    id_tenant      INTEGER      NOT NULL,

    titulo         VARCHAR(200) NOT NULL,
    descricao      TEXT,
    -- Texto livre, como em mentor_material: agrupamento, sem codigo atras.
    categoria      VARCHAR(60),

    tipo           VARCHAR(10)  NOT NULL,
    id_arquivo     UUID,
    url            TEXT,

    -- Arquivado = fora da vista dos mentores. Quem gerencia continua vendo.
    arquivado_ts   TIMESTAMP,

    -- Quem publicou e quem mexeu por ultimo. SET NULL: o material e da
    -- incubadora, e sobrevive a conta de quem o cadastrou.
    criado_por     INTEGER,
    atualizado_por INTEGER,
    criado_ts      TIMESTAMP    NOT NULL DEFAULT NOW(),
    atualizado_ts  TIMESTAMP    NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_mentor_material_incubadora PRIMARY KEY (id_material),

    CONSTRAINT fk_mentor_material_incubadora_tenant
        FOREIGN KEY (id_tenant) REFERENCES tenant (id_tenant) ON DELETE CASCADE,

    -- Sem CASCADE, como em mentor_material: o arquivo em uso nao some por
    -- baixo do material. Quem remove os bytes e o service.
    CONSTRAINT fk_mentor_material_incubadora_arquivo
        FOREIGN KEY (id_arquivo) REFERENCES arquivo (id_arquivo),

    CONSTRAINT fk_mentor_material_incubadora_criado_por
        FOREIGN KEY (criado_por) REFERENCES usuarios (id_usuario) ON DELETE SET NULL,

    CONSTRAINT fk_mentor_material_incubadora_atualizado_por
        FOREIGN KEY (atualizado_por) REFERENCES usuarios (id_usuario) ON DELETE SET NULL,

    CONSTRAINT ck_mentor_material_incubadora_tipo
        CHECK (tipo IN ('ARQUIVO', 'LINK')),

    CONSTRAINT ck_mentor_material_incubadora_corpo CHECK (
        (tipo = 'ARQUIVO' AND id_arquivo IS NOT NULL AND url IS NULL)
        OR (tipo = 'LINK' AND id_arquivo IS NULL AND url IS NOT NULL AND url <> '')
    )
);

-- A lista e sempre "os materiais desta incubadora", os ativos primeiro.
CREATE INDEX IF NOT EXISTS ix_mentor_material_incubadora_tenant
    ON mentor_material_incubadora (id_tenant, arquivado_ts);

-- Um arquivo, um material — e a consulta da rota generica de arquivos.
CREATE UNIQUE INDEX IF NOT EXISTS uq_mentor_material_incubadora_arquivo
    ON mentor_material_incubadora (id_arquivo)
    WHERE id_arquivo IS NOT NULL;
