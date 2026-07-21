-- ===========================================================================
-- 008 — Categorias e locais de evento como configuracao da incubadora
--
-- CONTEXTO
-- A categoria de um evento era o enum `eventoCategoria`, com oito valores
-- fixos. Enum e TIPO DE COLUNA, nao dado: acrescentar "Demoday" para UMA
-- incubadora exigiria um ALTER TYPE que passa a valer para TODAS as outras.
-- Na pratica, a agenda vinha com o vocabulario de quem escreveu o schema, e
-- nenhuma incubadora conseguia usar o proprio.
--
-- O local tinha o problema oposto: `evento.local` e VARCHAR livre, entao cada
-- pessoa digitava "Auditorio", "auditorio" e "Aud. principal" para a mesma
-- sala — sem cadastro, nao ha como agrupar nem reaproveitar.
--
-- O QUE MUDA
-- Duas tabelas por tenant (evento_categoria, evento_local) e a categoria deixa
-- de ser enum.
--
-- POR QUE A CHAVE E TEXTO, E NAO id_categoria
-- `evento.categoria` continua guardando a CHAVE ('MENTORIA'), agora com FK
-- composta (id_tenant, categoria). Duas consequencias que motivam a escolha:
--
--   1. O ROTULO fica editavel sem tocar em evento nenhum. A incubadora renomeia
--      "Mentoria" para "Sessao de mentoria" e os 200 eventos historicos passam
--      a exibir o nome novo, porque o que esta gravado neles e a chave.
--   2. O relatorio de engajamento agrupa por `categoria` string
--      (relatorioRepository.engajamentoEventos). Com id numerico, todo esse SQL
--      — e o front que le `ev.categoria` — precisaria ser reescrito. Nao ha
--      ganho que pague isso.
--
-- A FK e COMPOSTA de proposito: sem o id_tenant nela, um evento poderia
-- apontar para a categoria de outra incubadora.
--
-- EXCLUSAO E `ativo = FALSE`, NUNCA DELETE
-- Apagar "MENTORIA" com 40 eventos historicos ou seria barrado pela FK ou
-- deixaria o relatorio sem rotulo. Desativar tira do seletor de eventos novos
-- e preserva o historico legivel — mesmo padrao de `evento.ativo` e
-- `startup_membros.ativo`.
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- CATEGORIAS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS evento_categoria (
    id_tenant INTEGER      NOT NULL,
    -- Identificador estavel, gravado em evento.categoria. Nao muda depois de
    -- criado; quem muda e o rotulo.
    chave     VARCHAR(40)  NOT NULL,
    rotulo    VARCHAR(60)  NOT NULL,
    -- Cor do chip/borda no calendario. Hex de 6 digitos: o front usa direto em
    -- CSS, entao aceitar formato livre aqui viraria estilo quebrado la.
    cor       CHAR(7)      NOT NULL DEFAULT '#8b5cf6',
    -- Nome do icone MUI. Lista fechada, resolvida no front (ICONES em
    -- categorias.js): icone e componente importado, nao string arbitraria, e
    -- um valor desconhecido cai no fallback em vez de quebrar a tela.
    icone     VARCHAR(40)  NOT NULL DEFAULT 'Event',
    ordem     SMALLINT     NOT NULL DEFAULT 0,
    ativo     BOOLEAN      NOT NULL DEFAULT TRUE,
    criado_ts TIMESTAMP    NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_evento_categoria PRIMARY KEY (id_tenant, chave),

    CONSTRAINT fk_evento_categoria_tenant
        FOREIGN KEY (id_tenant) REFERENCES tenant (id_tenant) ON DELETE CASCADE,

    CONSTRAINT ck_evento_categoria_cor CHECK (cor ~ '^#[0-9a-fA-F]{6}$')
);

-- Duas incubadoras podem ter rotulos iguais; dentro de uma, nao. Senao o
-- seletor mostra "Mentoria" duas vezes e nao ha como distinguir.
CREATE UNIQUE INDEX IF NOT EXISTS uq_evento_categoria_rotulo
    ON evento_categoria (id_tenant, lower(rotulo));

-- As oito categorias que eram o enum, agora como dado de cada incubadora.
-- Chaves, cores e icones sao exatamente os de frontend/src/components/calendar/
-- categorias.js — no dia da virada nada muda de aparencia; a incubadora edita
-- a partir dai.
INSERT INTO evento_categoria (id_tenant, chave, rotulo, cor, icone, ordem)
SELECT t.id_tenant, d.chave, d.rotulo, d.cor, d.icone, d.ordem
  FROM tenant t
 CROSS JOIN (VALUES
        ('MENTORIA', 'Mentoria', '#6366f1', 'SupervisorAccount',  1),
        ('WORKSHOP', 'Workshop', '#0ea5e9', 'School',             2),
        ('ENTREGA',  'Entrega',  '#10b981', 'AssignmentTurnedIn', 3),
        ('REUNIAO',  'Reuniao',  '#f59e0b', 'Groups',             4),
        ('EVENTO',   'Evento',   '#8b5cf6', 'Event',              5),
        ('PITCH',    'Pitch',    '#ef4444', 'Campaign',           6),
        ('PRAZO',    'Prazo',    '#f43f5e', 'HourglassBottom',    7),
        ('VISITA',   'Visita',   '#14b8a6', 'Place',              8)
      ) AS d(chave, rotulo, cor, icone, ordem)
    ON CONFLICT DO NOTHING;

-- Enum -> texto. O USING converte os valores existentes; como o enum so
-- permitia as oito chaves acima, e todas foram semeadas para todo tenant, a FK
-- logo abaixo entra sem violacao.
ALTER TABLE evento ALTER COLUMN categoria DROP DEFAULT;
ALTER TABLE evento ALTER COLUMN categoria TYPE VARCHAR(40) USING categoria::text;
ALTER TABLE evento ALTER COLUMN categoria SET DEFAULT 'EVENTO';

ALTER TABLE evento
    ADD CONSTRAINT fk_evento_categoria
    FOREIGN KEY (id_tenant, categoria)
    REFERENCES evento_categoria (id_tenant, chave);

-- O tipo so existia para esta coluna.
DROP TYPE IF EXISTS eventoCategoria;

-- ---------------------------------------------------------------------------
-- LOCAIS
--
-- `evento.local` (texto livre) CONTINUA existindo e nao foi migrado. Duas
-- razoes: os valores historicos sao texto arbitrario que nao da para casar com
-- cadastro nenhum sem adivinhacao, e o caso "sala emprestada, uma vez so" e
-- legitimo — obrigar cadastro para ele poluiria a lista permanente com evento
-- pontual. O formulario grava id_local quando a pessoa escolhe do cadastro, e
-- `local` quando digita avulso; a exibicao prefere o cadastro e cai no texto.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS evento_local (
    id_local   INTEGER      GENERATED ALWAYS AS IDENTITY,
    id_tenant  INTEGER      NOT NULL,
    nome       VARCHAR(120) NOT NULL,
    endereco   VARCHAR(200),
    -- Quantas pessoas cabem. Informativo por ora (o formulario ja tem `vagas`);
    -- serve para o admin escolher a sala ao marcar um evento grande.
    capacidade INTEGER,
    ativo      BOOLEAN      NOT NULL DEFAULT TRUE,
    criado_ts  TIMESTAMP    NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_evento_local PRIMARY KEY (id_local),

    CONSTRAINT fk_evento_local_tenant
        FOREIGN KEY (id_tenant) REFERENCES tenant (id_tenant) ON DELETE CASCADE,

    CONSTRAINT ck_evento_local_capacidade CHECK (capacidade IS NULL OR capacidade > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_evento_local_nome
    ON evento_local (id_tenant, lower(nome));

-- Nao ha semeadura: a incubadora cadastra as proprias salas. Ate cadastrar, o
-- campo de local segue funcionando como texto livre, exatamente como antes.

-- Sem ON DELETE CASCADE de proposito: apagar uma sala nao pode apagar o evento
-- que aconteceu nela. A tela desativa (ativo = FALSE) em vez de excluir.
ALTER TABLE evento
    ADD COLUMN IF NOT EXISTS id_local INTEGER
    REFERENCES evento_local (id_local);

-- ---------------------------------------------------------------------------
-- PERMISSAO DA TELA NOVA
--
-- `garantirPermissao` e RBAC puro: nao ha atalho para o papel 'admin' (ver
-- rbacService). E o sincronizador do catalogo cria a chave em `permissao` mas
-- NAO a concede a ninguem. Sem o bloco abaixo, o admin de toda incubadora ja
-- existente abriria a tela de categorias e tomaria 403 — a mesma armadilha que
-- a migracao 005 desarmou no passo 4.
--
-- So a ESCRITA precisa de chave nova. LER as categorias exige
-- `eventos.agenda.visualizar`, que todas as roles padrao ja tem.
-- ---------------------------------------------------------------------------
INSERT INTO permissao (chave, modulo, recurso, acao, rotulo_modulo, rotulo_recurso, rotulo_acao)
VALUES ('configuracoes.agenda.gerenciar', 'configuracoes', 'agenda', 'gerenciar',
        'Configuracoes', 'Categorias e locais da agenda', 'Gerenciar categorias e locais')
ON CONFLICT (chave) DO NOTHING;

-- Por join, e nao por lista de tenants: pega toda incubadora existente.
INSERT INTO role_permissao (id_role, id_permissao)
SELECT r.id_role, p.id_permissao
  FROM role r
  CROSS JOIN permissao p
 WHERE r.sistema = TRUE
   AND r.nome = 'Administrador'
   AND p.chave = 'configuracoes.agenda.gerenciar'
ON CONFLICT (id_role, id_permissao) DO NOTHING;

COMMIT;

-- ===========================================================================
-- CONFERENCIA (rode depois; nenhuma deve acusar problema)
--
--   -- todo tenant ficou com as 8 categorias?
--   SELECT t.id_tenant, t.nome, COUNT(c.chave) AS categorias
--     FROM tenant t LEFT JOIN evento_categoria c ON c.id_tenant = t.id_tenant
--    GROUP BY 1,2 HAVING COUNT(c.chave) < 8;
--
--   -- algum evento aponta para categoria que nao existe? (deve vir vazio —
--   -- a FK garante, mas confirma que o USING converteu certo)
--   SELECT e.id_evento, e.id_tenant, e.categoria
--     FROM evento e LEFT JOIN evento_categoria c
--       ON c.id_tenant = e.id_tenant AND c.chave = e.categoria
--    WHERE c.chave IS NULL;
--
--   -- todo admin enxerga a tela nova?
--   SELECT r.id_tenant FROM role r
--    WHERE r.sistema AND r.nome = 'Administrador'
--      AND NOT EXISTS (
--        SELECT 1 FROM role_permissao rp JOIN permissao p ON p.id_permissao = rp.id_permissao
--         WHERE rp.id_role = r.id_role AND p.chave = 'configuracoes.agenda.gerenciar');
-- ===========================================================================
