-- ===========================================================================
-- 025 — Pastas na biblioteca pessoal do mentor
--
-- CONTEXTO
-- A biblioteca pessoal (migracao 020) era uma lista plana. Com trinta, quarenta
-- materiais o mentor quer organiza-los como organiza no computador: uma pasta
-- por tema, por programa, por startup — e pastas dentro de pastas.
--
-- O QUE MUDA
--   1. `mentor_pasta` — as pastas da biblioteca, POR DONO E POR TENANT (como o
--      material). Arvore por `id_pasta_pai`; NULL e a raiz da biblioteca.
--   2. `mentor_material.id_pasta` — onde o material esta. NULL e a raiz.
--
-- A PASTA E SO ORGANIZACAO. Nao muda quem ve o material nem o que ja foi
-- compartilhado: a startup aponta para o MATERIAL, e mover o material de pasta
-- nao mexe em vinculo nenhum.
--
-- O DONO E O MESMO, GARANTIDO PELO BANCO. As duas FKs da arvore (a pasta-mae e
-- a pasta do material) sao COMPOSTAS com (id_tenant, id_mentor): um material
-- nao entra na pasta de outra pessoa nem de outra incubadora, mesmo que o
-- service falhe em conferir. `uq_mentor_pasta_dono` existe para servir de alvo
-- a essas FKs.
--
-- EXCLUIR UMA PASTA NAO APAGA O QUE ESTA DENTRO. O service move o conteudo para
-- a pasta de cima antes de apagar (ver mentorPastaRepository.excluir). O
-- `SET NULL (coluna)` abaixo e a rede de seguranca: se alguma pasta sumir por
-- outro caminho, o que estava nela cai na raiz — nunca vai junto. So a coluna
-- da pasta e anulada; id_tenant e id_mentor ficam (sem a lista de colunas o
-- SET NULL anularia as tres, e o NOT NULL do dono recusaria).
--
-- Nome de pasta e unico entre irmas, sem diferenca de maiuscula, como no
-- gerenciador de arquivos: duas "Modelos" lado a lado nao se distinguem.
-- Material nao tem essa regra — o titulo nunca foi unico, e a biblioteca ja
-- tem materiais com o mesmo titulo.
--
-- NAO-DESTRUTIVA: tabela, coluna anulavel e indices novos. Todo material que
-- ja existe fica na raiz.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS mentor_pasta (
    id_pasta      INTEGER GENERATED ALWAYS AS IDENTITY,
    id_tenant     INTEGER      NOT NULL,
    id_mentor     INTEGER      NOT NULL,
    -- NULL = a raiz da biblioteca.
    id_pasta_pai  INTEGER,
    nome          VARCHAR(120) NOT NULL,
    criado_ts     TIMESTAMP    NOT NULL DEFAULT NOW(),
    atualizado_ts TIMESTAMP    NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_mentor_pasta PRIMARY KEY (id_pasta),
    CONSTRAINT uq_mentor_pasta_dono UNIQUE (id_pasta, id_tenant, id_mentor),

    CONSTRAINT fk_mentor_pasta_vinculo
        FOREIGN KEY (id_tenant, id_mentor)
        REFERENCES tenant_usuarios (id_tenant, id_usuario)
        ON DELETE CASCADE,

    CONSTRAINT fk_mentor_pasta_pai
        FOREIGN KEY (id_pasta_pai, id_tenant, id_mentor)
        REFERENCES mentor_pasta (id_pasta, id_tenant, id_mentor)
        ON DELETE SET NULL (id_pasta_pai),

    CONSTRAINT ck_mentor_pasta_nome CHECK (btrim(nome) <> ''),
    CONSTRAINT ck_mentor_pasta_pai CHECK (id_pasta_pai IS NULL OR id_pasta_pai <> id_pasta)
);

-- A biblioteca e lida inteira de uma vez ("as pastas DESTA pessoa NESTA
-- incubadora"), e a arvore e montada na tela.
CREATE INDEX IF NOT EXISTS ix_mentor_pasta_dono
    ON mentor_pasta (id_tenant, id_mentor);

-- Irmas com o mesmo nome, nao. COALESCE porque NULL (a raiz) nunca e igual a
-- NULL num indice unico.
CREATE UNIQUE INDEX IF NOT EXISTS uq_mentor_pasta_nome
    ON mentor_pasta (id_tenant, id_mentor, COALESCE(id_pasta_pai, 0), lower(nome));

ALTER TABLE mentor_material ADD COLUMN IF NOT EXISTS id_pasta INTEGER;

ALTER TABLE mentor_material DROP CONSTRAINT IF EXISTS fk_mentor_material_pasta;
ALTER TABLE mentor_material
    ADD CONSTRAINT fk_mentor_material_pasta
        FOREIGN KEY (id_pasta, id_tenant, id_mentor)
        REFERENCES mentor_pasta (id_pasta, id_tenant, id_mentor)
        ON DELETE SET NULL (id_pasta);

-- O lado de FK: o que esta numa pasta, e o SET NULL quando ela some.
CREATE INDEX IF NOT EXISTS ix_mentor_material_pasta
    ON mentor_material (id_pasta)
    WHERE id_pasta IS NOT NULL;
