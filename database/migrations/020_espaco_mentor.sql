-- ===========================================================================
-- 020 — Espaco do Mentor: biblioteca pessoal e compartilhamento por etapa
--
-- CONTEXTO
-- A Biblioteca (`conteudo`) e o acervo da INCUBADORA: o que ela ensina, igual
-- para todas as startups, pendurado nos passos da trilha. O mentor nao tinha
-- onde guardar o PROPRIO material de trabalho — o modelo de entrevista que ele
-- usa ha anos, a planilha de unit economics que ele prefere — nem como entregar
-- um documento a UMA startup, no ponto da trilha em que ela esta, dizendo por
-- que ela o recebeu. Isso acontecia por e-mail e WhatsApp, fora do Quiron.
--
-- O QUE MUDA
--   1. `mentor_material` — a biblioteca PESSOAL do mentor, POR TENANT (como
--      mentor_perfil: a mesma pessoa pode mentorar em duas incubadoras). E
--      privada: so o dono le, edita e exclui. O arquivo continua em `arquivo`
--      (volume de uploads) — esta tabela guarda o registro e aponta para ele.
--   2. `mentor_compartilhamento` — o VINCULO entre um material e uma startup,
--      dentro de uma trilha em que ela esta matriculada, opcionalmente numa
--      etapa dela (FASE ou PASSO), com a orientacao do mentor.
--
-- COMPARTILHAR E APONTAR, NAO COPIAR. A origem e um material pessoal OU um
-- conteudo da Biblioteca institucional — exatamente um dos dois. Nenhum byte e
-- duplicado: corrigir o material corrige o que a startup ve, e a origem e os
-- metadados ficam onde sempre estiveram.
--
-- POR QUE A ETAPA E FASE OU PASSO (e nunca MODULO): sao os dois niveis que a
-- Jornada do incubado mostra como lugar — a fase e o estagio, o passo e a
-- atividade. NULL e a trilha inteira.
--
-- REFERENCIA x ATIVIDADE. `finalidade` distingue o material de consulta do
-- material de apoio a uma atividade. A atividade e um PASSO que ja existe na
-- trilha: este modulo NAO cria passo nem tarefa — a trilha e a mesma para todas
-- as startups matriculadas, e criar um passo para uma delas criaria para todas.
-- O tipo do no (PASSO) e conferido pelo service; o CHECK garante o minimo que
-- da para garantir aqui: atividade sem etapa nao existe.
--
-- INTEGRIDADE DOS VINCULOS
--   - Material pessoal: o service recusa (409) excluir material compartilhado;
--     o CASCADE abaixo so age quando a pessoa sai da incubadora junto com tudo
--     o que era dela.
--   - Conteudo institucional: CASCADE. O acervo e da incubadora, e quem o
--     exclui na Biblioteca e avisado de quantos compartilhamentos vao junto —
--     o vinculo some com a origem, nunca fica apontando para o nada.
--   - Etapa/trilha/startup excluidas: CASCADE, o mesmo destino de `entrega` e
--     `trilha_conteudo` quando o no some no Construtor.
--   - Arquivo: sem CASCADE. Um arquivo em uso por um material nao pode sumir
--     por baixo dele; quem remove os bytes e o service, junto com o material.
--
-- A unicidade e por (startup, trilha, etapa, origem): o mesmo material duas
-- vezes no mesmo lugar seria a mesma linha repetida na tela da startup,
-- mesmo que tenham sido dois mentores a compartilha-lo.
--
-- NAO-DESTRUTIVA: so cria tabelas e indices novos.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS mentor_material (
    id_material   INTEGER GENERATED ALWAYS AS IDENTITY,
    id_tenant     INTEGER      NOT NULL,
    -- O dono. Biblioteca pessoal: nenhuma chave RBAC da acesso ao material de
    -- outra pessoa (ver mentorMaterialService).
    id_mentor     INTEGER      NOT NULL,

    titulo        VARCHAR(200) NOT NULL,
    descricao     TEXT,
    -- Texto livre, como mentor_perfil.especialidades: nao ha codigo atras do
    -- valor, e so agrupamento. O front sugere as que o mentor ja usa.
    categoria     VARCHAR(60),

    -- ARQUIVO: os bytes moram no volume de uploads, via `arquivo`.
    -- LINK: um endereco externo (um Google Doc, um video).
    tipo          VARCHAR(10)  NOT NULL,
    id_arquivo    UUID,
    url           TEXT,

    -- Arquivar tira o material da biblioteca de trabalho sem desfazer o que ja
    -- foi entregue: os compartilhamentos continuam valendo.
    arquivado_ts  TIMESTAMP,

    criado_ts     TIMESTAMP    NOT NULL DEFAULT NOW(),
    atualizado_ts TIMESTAMP    NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_mentor_material PRIMARY KEY (id_material),

    -- FK COMPOSTA para tenant_usuarios, como mentor_perfil: so existe
    -- biblioteca de quem esta na incubadora.
    CONSTRAINT fk_mentor_material_vinculo
        FOREIGN KEY (id_tenant, id_mentor)
        REFERENCES tenant_usuarios (id_tenant, id_usuario)
        ON DELETE CASCADE,

    -- Sem CASCADE de proposito (ver o cabecalho).
    CONSTRAINT fk_mentor_material_arquivo
        FOREIGN KEY (id_arquivo)
        REFERENCES arquivo (id_arquivo),

    CONSTRAINT ck_mentor_material_tipo
        CHECK (tipo IN ('ARQUIVO', 'LINK')),

    CONSTRAINT ck_mentor_material_corpo CHECK (
        (tipo = 'ARQUIVO' AND id_arquivo IS NOT NULL AND url IS NULL)
        OR (tipo = 'LINK' AND id_arquivo IS NULL AND url IS NOT NULL AND url <> '')
    )
);

-- A biblioteca e sempre lida como "os materiais DESTA pessoa NESTA incubadora".
CREATE INDEX IF NOT EXISTS ix_mentor_material_dono
    ON mentor_material (id_tenant, id_mentor);

-- Um arquivo, um material. E tambem a consulta que a rota generica de download
-- faz para saber que este arquivo so abre pelo material (arquivoService.abrir).
CREATE UNIQUE INDEX IF NOT EXISTS uq_mentor_material_arquivo
    ON mentor_material (id_arquivo)
    WHERE id_arquivo IS NOT NULL;


CREATE TABLE IF NOT EXISTS mentor_compartilhamento (
    id_compartilhamento INTEGER GENERATED ALWAYS AS IDENTITY,
    id_tenant      INTEGER     NOT NULL,
    id_startup     INTEGER     NOT NULL,
    -- A trilha (a raiz PROGRAMA) em que a startup esta matriculada.
    id_programa    INTEGER     NOT NULL,
    -- A etapa dentro dela: FASE ou PASSO. NULL = a trilha inteira.
    id_no          INTEGER,

    -- A ORIGEM, exatamente uma das duas.
    id_material    INTEGER,
    id_conteudo    INTEGER,

    finalidade     VARCHAR(12) NOT NULL DEFAULT 'REFERENCIA',
    -- Por que a startup recebeu isto. E o que transforma um anexo solto num
    -- encaminhamento de mentoria.
    orientacao     TEXT,

    -- SET NULL: o material entregue sobrevive a conta de quem o entregou.
    compartilhado_por INTEGER,
    criado_ts      TIMESTAMP   NOT NULL DEFAULT NOW(),
    atualizado_ts  TIMESTAMP   NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_mentor_compartilhamento PRIMARY KEY (id_compartilhamento),

    CONSTRAINT fk_mentor_compartilhamento_tenant
        FOREIGN KEY (id_tenant) REFERENCES tenant (id_tenant) ON DELETE CASCADE,

    CONSTRAINT fk_mentor_compartilhamento_startup
        FOREIGN KEY (id_startup) REFERENCES startup (id_startup) ON DELETE CASCADE,

    CONSTRAINT fk_mentor_compartilhamento_programa
        FOREIGN KEY (id_programa) REFERENCES trilha_no (id_no) ON DELETE CASCADE,

    CONSTRAINT fk_mentor_compartilhamento_no
        FOREIGN KEY (id_no) REFERENCES trilha_no (id_no) ON DELETE CASCADE,

    CONSTRAINT fk_mentor_compartilhamento_material
        FOREIGN KEY (id_material) REFERENCES mentor_material (id_material) ON DELETE CASCADE,

    CONSTRAINT fk_mentor_compartilhamento_conteudo
        FOREIGN KEY (id_conteudo) REFERENCES conteudo (id_conteudo) ON DELETE CASCADE,

    CONSTRAINT fk_mentor_compartilhamento_autor
        FOREIGN KEY (compartilhado_por) REFERENCES usuarios (id_usuario) ON DELETE SET NULL,

    CONSTRAINT ck_mentor_compartilhamento_origem
        CHECK ((id_material IS NULL) <> (id_conteudo IS NULL)),

    CONSTRAINT ck_mentor_compartilhamento_finalidade
        CHECK (finalidade IN ('REFERENCIA', 'ATIVIDADE')),

    CONSTRAINT ck_mentor_compartilhamento_atividade
        CHECK (finalidade = 'REFERENCIA' OR id_no IS NOT NULL)
);

-- O que a Jornada le: "o que esta startup recebeu nesta trilha".
CREATE INDEX IF NOT EXISTS ix_mentor_compartilhamento_startup
    ON mentor_compartilhamento (id_startup, id_programa);

-- O que o mentor le: "o que eu compartilhei", do mais novo ao mais velho.
CREATE INDEX IF NOT EXISTS ix_mentor_compartilhamento_autor
    ON mentor_compartilhamento (compartilhado_por, criado_ts DESC);

-- As outras tres direcoes de FK: contar os usos de um material ou conteudo, e
-- o CASCADE de quando a etapa some no Construtor.
CREATE INDEX IF NOT EXISTS ix_mentor_compartilhamento_material
    ON mentor_compartilhamento (id_material)
    WHERE id_material IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_mentor_compartilhamento_conteudo
    ON mentor_compartilhamento (id_conteudo)
    WHERE id_conteudo IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_mentor_compartilhamento_no
    ON mentor_compartilhamento (id_no)
    WHERE id_no IS NOT NULL;

-- O mesmo material no mesmo lugar da mesma startup, uma vez so. COALESCE porque
-- NULL (a trilha inteira) nunca e igual a NULL num indice unico.
CREATE UNIQUE INDEX IF NOT EXISTS uq_mentor_compartilhamento_material
    ON mentor_compartilhamento (id_startup, id_programa, COALESCE(id_no, 0), id_material)
    WHERE id_material IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_mentor_compartilhamento_conteudo
    ON mentor_compartilhamento (id_startup, id_programa, COALESCE(id_no, 0), id_conteudo)
    WHERE id_conteudo IS NOT NULL;
