CREATE TYPE papelEnum AS ENUM ('admin', 'mentor', 'usuario');
CREATE TYPE statusStartup AS ENUM ('ATIVA', 'PAUSADA', 'ENCERRADA');
-- Tipo de um PASSO da trilha (trilha_no.tipo_passo). Mantem o nome historico
-- porque descreve a natureza da atividade, nao a tabela.
CREATE TYPE tarefaTipo AS ENUM('TEXTO', 'ANEXO', 'VIDEO', 'QUESTIONARIO');
-- Niveis da arvore da trilha (trilha_no.tipo). PROGRAMA e a raiz; PASSO e a
-- folha — o que a startup executa e entrega.
CREATE TYPE trilhaNoTipo AS ENUM ('PROGRAMA', 'FASE', 'MODULO', 'PASSO');
-- Tipos de conteudo da Biblioteca (conteudo.tipo).
CREATE TYPE conteudoTipo AS ENUM ('AULA', 'VIDEO', 'ARQUIVO', 'TEMPLATE', 'LINK');
-- Blocos de uma AULA (conteudo_bloco.tipo), editor estilo Notion.
CREATE TYPE blocoTipo AS ENUM (
    'h1', 'h2', 'paragrafo', 'lista', 'callout', 'video', 'arquivo', 'divisor'
);
-- Estagio de uma submissao (entrega.status). Os demais estados do passo
-- (AGUARDANDO, AJUSTE, APROVADO) sao derivados da tabela avaliacao.
CREATE TYPE entregaStatus AS ENUM ('RASCUNHO', 'ENVIADA');
-- Tipos de pergunta (estilo Google Forms):
--   TEXTO_CURTO    -> resposta curta de uma linha (sem alternativas)
--   PARAGRAFO      -> resposta longa / descritiva (sem alternativas)
--   ESCOLHA_UNICA  -> multipla escolha com UMA resposta (radio, tem alternativas)
--   CAIXAS_SELECAO -> assinalar VARIAS respostas (checkbox, tem alternativas)
CREATE TYPE perguntaTipo AS ENUM('TEXTO_CURTO', 'PARAGRAFO', 'ESCOLHA_UNICA', 'CAIXAS_SELECAO');
-- NOTA: a categoria de evento ERA o enum `eventoCategoria`, com oito valores
-- fixos. Virou dado por incubadora na tabela `evento_categoria` (migracao 008),
-- porque enum e tipo de coluna: acrescentar uma categoria para UMA incubadora
-- exigia um ALTER TYPE que valia para todas.


CREATE TABLE IF NOT EXISTS tenant (
    id_tenant INTEGER GENERATED ALWAYS AS IDENTITY,
    nome VARCHAR(150) NOT NULL,
	celular VARCHAR(15) NOT NULL,
	email VARCHAR(100) NOT NULL,
	pais VARCHAR(50) NOT NULL,
	estado VARCHAR(50) NOT NULL,
	cidade VARCHAR(50) NOT NULL,
	rua VARCHAR(100) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
	qtd_usuarios INTEGER DEFAULT 5,
	qtd_startups INTEGER DEFAULT 10,
	logo VARCHAR(255),
	-- Configuracao de e-mail da incubadora (remetente exibido + reply-to).
	-- O envio em si usa o SMTP compartilhado (variaveis de ambiente).
	email_remetente_nome VARCHAR(100),
	email_remetente VARCHAR(150),
	email_reply_to VARCHAR(150),
    criado_ts TIMESTAMP NOT NULL DEFAULT NOW(),
    atualizado_ts TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_tenant PRIMARY KEY (id_tenant)
);


CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario INTEGER GENERATED ALWAYS AS IDENTITY,

    nome VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL,
	celular VARCHAR(15) NOT NULL,
    senha_hash TEXT NOT NULL,
    -- Foto/avatar do usuario (data URL base64 ou link), exibida no Perfil e,
    -- na ausencia de logo de startup, no cabecalho da Sidebar.
    foto_url TEXT,
    ROOT BOOLEAN DEFAULT FALSE,
    -- Quando TRUE, o usuario e obrigado a trocar a senha no proximo login
    -- (usado para senhas provisorias criadas pelo root/admin).
    deve_redefinir_senha BOOLEAN NOT NULL DEFAULT FALSE,
    ultimo_login_ts TIMESTAMP,
    criado_ts TIMESTAMP NOT NULL DEFAULT NOW(),
    atualizado_ts TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_usuarios PRIMARY KEY (id_usuario),
    CONSTRAINT uk_usuarios_email UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS senha_reset (
    id_reset INTEGER GENERATED ALWAYS AS IDENTITY,
    id_usuario INTEGER NOT NULL,
    token_hash TEXT NOT NULL,
    expira_ts TIMESTAMP NOT NULL,
    usado BOOLEAN NOT NULL DEFAULT FALSE,
    criado_ts TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_senha_reset PRIMARY KEY (id_reset),

    CONSTRAINT fk_senha_reset_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuarios (id_usuario)
        ON DELETE CASCADE
);

CREATE TABLE  IF NOT EXISTS tenant_usuarios (
    id_tenant INTEGER NOT NULL,
    id_usuario INTEGER NOT NULL,
    papel papelEnum NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_ts TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_tenant_usuarios
        PRIMARY KEY (id_tenant, id_usuario),

    CONSTRAINT fk_tenant_usuarios_tenant
        FOREIGN KEY (id_tenant)
        REFERENCES tenant (id_tenant)
        ON DELETE CASCADE,

    CONSTRAINT fk_tenant_usuarios_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuarios (id_usuario)
        ON DELETE CASCADE


);

CREATE TABLE IF NOT EXISTS startup (
    id_startup INTEGER GENERATED ALWAYS AS IDENTITY,
    id_tenant INTEGER NOT NULL,
    nome VARCHAR(150) NOT NULL,
    cnpj CHAR(14),
	logo VARCHAR(255),
    status statusStartup DEFAULT 'ATIVA',
    criado_ts TIMESTAMP NOT NULL DEFAULT NOW(),
    atualizado_ts TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_startup PRIMARY KEY (id_startup),

    CONSTRAINT fk_startup_tenant
        FOREIGN KEY (id_tenant)
        REFERENCES tenant (id_tenant)
        ON DELETE CASCADE

);


CREATE TABLE IF NOT EXISTS startup_membros (
    id_startup INTEGER NOT NULL,
    id_usuario INTEGER NOT NULL,
    lider BOOLEAN NOT NULL DEFAULT FALSE,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    entrada_dt DATE NOT NULL DEFAULT NOW(),
    saida_dt DATE,

    CONSTRAINT pk_startup_membros
        PRIMARY KEY (id_startup, id_usuario),

    CONSTRAINT fk_startup_membros_startup
        FOREIGN KEY (id_startup)
        REFERENCES startup (id_startup)
        ON DELETE CASCADE,

    CONSTRAINT fk_startup_membros_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuarios (id_usuario)
        ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS mentor_startup (
    id_usuario_mentor INTEGER NOT NULL,
    id_startup INTEGER NOT NULL,

    CONSTRAINT pk_mentor_startup
        PRIMARY KEY (id_usuario_mentor, id_startup),

    CONSTRAINT fk_mentor_startup_usuario
        FOREIGN KEY (id_usuario_mentor)
        REFERENCES usuarios (id_usuario)
        ON DELETE CASCADE,

    CONSTRAINT fk_mentor_startup_startup
        FOREIGN KEY (id_startup)
        REFERENCES startup (id_startup)
        ON DELETE CASCADE
);


-- ---------------------------------------------------------------------------
-- TRILHA — a estrutura do programa de incubacao.
--
-- Uma arvore auto-referenciada de 4 niveis, garantidos pelo trigger
-- trg_trilha_no_hierarquia:
--
--   PROGRAMA (raiz, id_pai NULL)
--     └── FASE
--           └── MODULO
--                 └── PASSO   (folha: o que a startup executa e entrega)
--
-- Substitui as antigas tabelas fase/modulo/tarefa (ver
-- database/migrations/001_biblioteca_trilha.sql). Uma tabela so, porque os
-- tres niveis compartilham os mesmos campos e as mesmas operacoes — criar,
-- reordenar, ativar, mover. Os campos exclusivos de PASSO ficam anulaveis.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trilha_no (
    id_no      INTEGER GENERATED ALWAYS AS IDENTITY,
    id_tenant  INTEGER NOT NULL,
    id_pai     INTEGER,          -- NULL apenas para PROGRAMA (raiz)

    tipo       trilhaNoTipo NOT NULL,
    nome       VARCHAR(200) NOT NULL,
    descricao  TEXT,
    ordem      INTEGER NOT NULL DEFAULT 1,
    ativo      BOOLEAN NOT NULL DEFAULT TRUE,

    -- ---- Campos que so fazem sentido em PASSO (folha) --------------------
    tipo_passo      tarefaTipo,   -- TEXTO | ANEXO | VIDEO | QUESTIONARIO
    permite_entrega BOOLEAN NOT NULL DEFAULT FALSE,
    obrigatoria     BOOLEAN NOT NULL DEFAULT TRUE,
    id_questionario INTEGER,
    anexo           TEXT,
    prazo           DATE,
    carga_horaria   VARCHAR(20),
    entregavel      TEXT,

    -- Moldura pedagogica: a Jornada nao mostra so "faca isto", mostra o
    -- objetivo, o porque, o que treina e que AREA da empresa o passo constroi
    -- (eixo do blueprint em "Minha Empresa").
    objetivo        TEXT,
    porque          TEXT,
    competencias    TEXT[] NOT NULL DEFAULT '{}',
    area            VARCHAR(40),

    criado_ts     TIMESTAMP NOT NULL DEFAULT NOW(),
    atualizado_ts TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_trilha_no PRIMARY KEY (id_no),

    CONSTRAINT fk_trilha_no_tenant
        FOREIGN KEY (id_tenant)
        REFERENCES tenant (id_tenant)
        ON DELETE CASCADE,

    -- Apagar um no leva a subarvore junto.
    CONSTRAINT fk_trilha_no_pai
        FOREIGN KEY (id_pai)
        REFERENCES trilha_no (id_no)
        ON DELETE CASCADE,

    -- fk_trilha_no_questionario e adicionada via ALTER logo apos a criacao da
    -- tabela questionarios, que vem mais abaixo neste arquivo.

    -- So a raiz pode ser orfa.
    CONSTRAINT ck_trilha_no_raiz CHECK (
        (tipo = 'PROGRAMA' AND id_pai IS NULL)
        OR (tipo <> 'PROGRAMA' AND id_pai IS NOT NULL)
    ),

    CONSTRAINT ck_trilha_no_questionario CHECK (
        id_questionario IS NULL OR tipo_passo = 'QUESTIONARIO'
    ),

    -- Area so faz sentido num PASSO — e o que liga a trilha ao blueprint.
    CONSTRAINT ck_trilha_no_area CHECK (
        area IS NULL OR tipo = 'PASSO'
    ),

    -- DEFERRABLE: o Construtor reindexa ordem 1..n a cada drag-and-drop; sem
    -- isso o UPDATE em lote colide consigo mesmo no meio do caminho.
    CONSTRAINT uk_trilha_no_ordem
        UNIQUE (id_pai, ordem)
        DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS ix_trilha_no_pai    ON trilha_no (id_pai, ordem);
CREATE INDEX IF NOT EXISTS ix_trilha_no_tenant ON trilha_no (id_tenant, tipo);


-- Garante PROGRAMA > FASE > MODULO > PASSO. Um CHECK nao alcanca a linha do
-- pai, entao a regra vive num trigger.
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

    IF NEW.id_tenant <> (SELECT id_tenant FROM trilha_no WHERE id_no = NEW.id_pai) THEN
        RAISE EXCEPTION 'No e pai devem pertencer ao mesmo tenant';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_trilha_no_hierarquia ON trilha_no;
CREATE TRIGGER trg_trilha_no_hierarquia
    BEFORE INSERT OR UPDATE OF id_pai, tipo ON trilha_no
    FOR EACH ROW EXECUTE FUNCTION fn_trilha_no_hierarquia();


-- ---------------------------------------------------------------------------
-- BIBLIOTECA — o acervo reutilizavel do que a incubadora ensina.
--
-- Separada da trilha de proposito: um conteudo nao tem posicao nem prazo, e
-- pode ser referenciado por varios passos, de varios programas. Editar a aula
-- nao mexe na trilha; reordenar a trilha nao mexe na aula.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conteudo (
    id_conteudo  INTEGER GENERATED ALWAYS AS IDENTITY,
    id_tenant    INTEGER NOT NULL,

    tipo         conteudoTipo NOT NULL,
    titulo       VARCHAR(200) NOT NULL,
    resumo       TEXT,
    tags         TEXT[] NOT NULL DEFAULT '{}',

    -- Campos por tipo; ck_conteudo_corpo garante o minimo de cada um.
    url          TEXT,           -- VIDEO, LINK, ARQUIVO, TEMPLATE
    nome_arquivo VARCHAR(255),   -- ARQUIVO, TEMPLATE
    duracao      VARCHAR(20),    -- AULA, VIDEO (texto livre: "8 min")

    -- Marca do conteudo no acervo (data URL base64 ou link http). Opcional:
    -- sem ela o card usa o icone do tipo. Ver migrations/003_conteudo_logo.sql.
    logo_url     TEXT,

    criado_por    INTEGER,
    criado_ts     TIMESTAMP NOT NULL DEFAULT NOW(),
    atualizado_ts TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_conteudo PRIMARY KEY (id_conteudo),

    CONSTRAINT fk_conteudo_tenant
        FOREIGN KEY (id_tenant)
        REFERENCES tenant (id_tenant)
        ON DELETE CASCADE,

    CONSTRAINT fk_conteudo_criado_por
        FOREIGN KEY (criado_por)
        REFERENCES usuarios (id_usuario),

    -- AULA guarda o corpo em conteudo_bloco, entao nao exige url.
    CONSTRAINT ck_conteudo_corpo CHECK (
        (tipo IN ('LINK', 'VIDEO') AND url IS NOT NULL AND url <> '')
        OR tipo IN ('AULA', 'ARQUIVO', 'TEMPLATE')
    )
);

CREATE INDEX IF NOT EXISTS ix_conteudo_tenant      ON conteudo (id_tenant);
CREATE INDEX IF NOT EXISTS ix_conteudo_tenant_tipo ON conteudo (id_tenant, tipo);
CREATE INDEX IF NOT EXISTS ix_conteudo_tags        ON conteudo USING GIN (tags);


-- Corpo da AULA: lista ordenada de blocos (editor estilo Notion).
CREATE TABLE IF NOT EXISTS conteudo_bloco (
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

    CONSTRAINT uk_bloco_ordem
        UNIQUE (id_conteudo, ordem)
        DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS ix_bloco_conteudo ON conteudo_bloco (id_conteudo, ordem);


-- Juncao: quais conteudos da Biblioteca um PASSO ensina.
-- E aqui que "reutilizar" acontece — o passo aponta, nao copia.
CREATE TABLE IF NOT EXISTS trilha_conteudo (
    id_no       INTEGER NOT NULL,
    id_conteudo INTEGER NOT NULL,
    ordem       INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT pk_trilha_conteudo PRIMARY KEY (id_no, id_conteudo),

    CONSTRAINT fk_tc_no
        FOREIGN KEY (id_no)
        REFERENCES trilha_no (id_no)
        ON DELETE CASCADE,

    -- RESTRICT de proposito: excluir da Biblioteca um conteudo em uso deve
    -- falhar e avisar, nao sumir silenciosamente da trilha.
    CONSTRAINT fk_tc_conteudo
        FOREIGN KEY (id_conteudo)
        REFERENCES conteudo (id_conteudo)
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS ix_tc_conteudo ON trilha_conteudo (id_conteudo);


-- Progresso de uma startup em um no da trilha. Antes so rastreava fases
-- (startup_fase); agora aceita qualquer no, embora na pratica o uso continue
-- sendo em FASE.
CREATE TABLE IF NOT EXISTS startup_trilha (
    id_startup_trilha INTEGER GENERATED ALWAYS AS IDENTITY,
    id_startup INTEGER NOT NULL,
    id_no INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'EM_ANDAMENTO',
    inicio_ts TIMESTAMP NOT NULL DEFAULT NOW(),
    fim_ts TIMESTAMP,
    aprovado_por INTEGER,

    CONSTRAINT pk_startup_trilha PRIMARY KEY (id_startup_trilha),

    CONSTRAINT fk_startup_trilha_startup
        FOREIGN KEY (id_startup)
        REFERENCES startup (id_startup)
        ON DELETE CASCADE,

    CONSTRAINT fk_startup_trilha_no
        FOREIGN KEY (id_no)
        REFERENCES trilha_no (id_no)
        ON DELETE CASCADE,

    CONSTRAINT fk_startup_trilha_aprovado_por
        FOREIGN KEY (aprovado_por)
        REFERENCES usuarios (id_usuario),

    CONSTRAINT ck_startup_trilha_status
        CHECK (status IN (
            'EM_ANDAMENTO',
            'AGUARDANDO_APROVACAO',
            'APROVADA',
            'REPROVADA'
        ))
);

CREATE INDEX IF NOT EXISTS ix_startup_trilha_no ON startup_trilha (id_no);


CREATE TABLE IF NOT EXISTS startup_canvas (
    id_startup INTEGER NOT NULL,
    bloco VARCHAR(30) NOT NULL,
    conteudo TEXT NOT NULL DEFAULT '',
    atualizado_ts TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_startup_canvas PRIMARY KEY (id_startup, bloco),

    CONSTRAINT fk_startup_canvas_startup
        FOREIGN KEY (id_startup)
        REFERENCES startup (id_startup)
        ON DELETE CASCADE,

    CONSTRAINT ck_startup_canvas_bloco
        CHECK (bloco IN (
            'parcerias_chave',
            'atividades_chave',
            'recursos_chave',
            'proposta_valor',
            'relacionamento_clientes',
            'canais',
            'segmentos_clientes',
            'estrutura_custos',
            'fontes_receita'
        ))
);


CREATE TABLE IF NOT EXISTS startup_gut (
    id_gut INTEGER GENERATED ALWAYS AS IDENTITY,
    id_startup INTEGER NOT NULL,
    problema VARCHAR(255) NOT NULL,
    gravidade SMALLINT NOT NULL,
    urgencia SMALLINT NOT NULL,
    tendencia SMALLINT NOT NULL,
    criado_ts TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_startup_gut PRIMARY KEY (id_gut),

    CONSTRAINT fk_startup_gut_startup
        FOREIGN KEY (id_startup)
        REFERENCES startup (id_startup)
        ON DELETE CASCADE,

    CONSTRAINT ck_startup_gut_gravidade CHECK (gravidade BETWEEN 1 AND 5),
    CONSTRAINT ck_startup_gut_urgencia CHECK (urgencia BETWEEN 1 AND 5),
    CONSTRAINT ck_startup_gut_tendencia CHECK (tendencia BETWEEN 1 AND 5)
);


CREATE TABLE IF NOT EXISTS startup_5w2h (
    id_5w2h INTEGER GENERATED ALWAYS AS IDENTITY,
    id_startup INTEGER NOT NULL,
    o_que TEXT NOT NULL,
    por_que TEXT,
    onde TEXT,
    quando TEXT,
    quem TEXT,
    como TEXT,
    quanto_custa TEXT,
    criado_ts TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_startup_5w2h PRIMARY KEY (id_5w2h),

    CONSTRAINT fk_startup_5w2h_startup
        FOREIGN KEY (id_startup)
        REFERENCES startup (id_startup)
        ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS questionarios (
	id_questionario INTEGER GENERATED ALWAYS AS IDENTITY,
	id_tenant INTEGER,
	
	titulo VARCHAR(100) NOT NULL,
	descricao TEXT NOT NULL,
	ativo BOOLEAN DEFAULT TRUE,
	
	 CONSTRAINT pk_questionario PRIMARY KEY (id_questionario),
	 CONSTRAINT fk_tenant_questionarios_tenant
        FOREIGN KEY (id_tenant)
        REFERENCES tenant (id_tenant)
        ON DELETE CASCADE

);

-- Fecha o ciclo trilha_no -> questionarios. Fica aqui, e nao no CREATE TABLE
-- de trilha_no, porque aquela tabela e declarada antes desta.
ALTER TABLE trilha_no DROP CONSTRAINT IF EXISTS fk_trilha_no_questionario;
ALTER TABLE trilha_no ADD CONSTRAINT fk_trilha_no_questionario
    FOREIGN KEY (id_questionario) REFERENCES questionarios (id_questionario);

CREATE TABLE IF NOT EXISTS pergunta (
	id_pergunta INTEGER GENERATED ALWAYS AS IDENTITY,
	id_questionario INTEGER,
	pergunta TEXT NOT NULL,
	obrigatoria BOOLEAN DEFAULT FALSE,
	-- Tipo da pergunta (ver enum perguntaTipo). Substitui o antigo booleano
	-- multipla_escolha: agora distingue texto/paragrafo/escolha-unica/caixas.
	tipo perguntaTipo NOT NULL DEFAULT 'TEXTO_CURTO',
	-- Posicao da pergunta dentro do questionario (1, 2, 3...).
	ordem INTEGER NOT NULL DEFAULT 1,

	CONSTRAINT pk_pergunta PRIMARY KEY (id_pergunta),
	 CONSTRAINT fk_questionarios_perguntas_questionario
        FOREIGN KEY (id_questionario)
        REFERENCES questionarios (id_questionario)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS alternativa (
    id_alternativa INTEGER GENERATED ALWAYS AS IDENTITY,
    id_pergunta INTEGER NOT NULL,

    descricao VARCHAR(250) NOT NULL,
    ordem INTEGER NOT NULL,

    ativa BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT pk_alternativa PRIMARY KEY (id_alternativa),

    CONSTRAINT fk_alternativa_pergunta
        FOREIGN KEY (id_pergunta)
        REFERENCES pergunta(id_pergunta)
        ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS entrega (
    id_entrega INTEGER GENERATED ALWAYS AS IDENTITY,

    -- O PASSO da trilha ao qual esta submissao responde.
    id_no INTEGER NOT NULL,
    id_startup INTEGER NOT NULL,
    id_usuario INTEGER NOT NULL,
    texto_resposta TEXT,
    arquivo_url TEXT,
    anexos TEXT[] NOT NULL DEFAULT '{}',

    -- RASCUNHO: salvo pelo incubado, ainda nao foi ao mentor.
    -- ENVIADA:  submetida, aguardando avaliacao.
    -- Os demais estados do passo sao derivados da tabela avaliacao.
    status entregaStatus NOT NULL DEFAULT 'ENVIADA',

    criado_ts TIMESTAMP NOT NULL DEFAULT NOW(),
    atualizado_ts TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_entrega PRIMARY KEY (id_entrega),

    CONSTRAINT fk_entrega_no
        FOREIGN KEY (id_no)
        REFERENCES trilha_no (id_no)
        ON DELETE CASCADE,

    CONSTRAINT fk_entrega_startup
        FOREIGN KEY (id_startup)
        REFERENCES startup (id_startup)
        ON DELETE CASCADE,

    CONSTRAINT fk_entrega_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuarios (id_usuario)
);

-- Uma startup tem UMA entrega por passo, reescrita a cada rascunho/reenvio.
-- Sem isto, salvar o rascunho duas vezes criaria duas linhas e o estado do
-- passo dependeria de qual delas a consulta pegasse primeiro.
CREATE UNIQUE INDEX IF NOT EXISTS uk_entrega_passo_startup
    ON entrega (id_no, id_startup);

CREATE INDEX IF NOT EXISTS ix_entrega_startup ON entrega (id_startup);

CREATE TABLE IF NOT EXISTS resposta (
    id_resposta INTEGER GENERATED ALWAYS AS IDENTITY,

    id_pergunta INTEGER NOT NULL,
    id_entrega INTEGER NOT NULL,
    id_usuario INTEGER NOT NULL,

    texto_resposta TEXT,
    id_alternativa INTEGER,

    criado_ts TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_resposta PRIMARY KEY (id_resposta),

    CONSTRAINT fk_resposta_pergunta
        FOREIGN KEY (id_pergunta)
        REFERENCES pergunta(id_pergunta)
        ON DELETE CASCADE,

    CONSTRAINT fk_resposta_entrega
        FOREIGN KEY (id_entrega)
        REFERENCES entrega(id_entrega)
        ON DELETE CASCADE,

    CONSTRAINT fk_resposta_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario),

    CONSTRAINT fk_resposta_alternativa
        FOREIGN KEY (id_alternativa)
        REFERENCES alternativa(id_alternativa)
);





CREATE TABLE IF NOT EXISTS avaliacao (
    id_avaliacao INTEGER GENERATED ALWAYS AS IDENTITY,

    id_entrega INTEGER NOT NULL,
    id_avaliador INTEGER NOT NULL,

    status VARCHAR(20) NOT NULL,
    nota NUMERIC(5,2),
    comentario TEXT,

    criado_ts TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_avaliacao PRIMARY KEY (id_avaliacao),

    CONSTRAINT fk_avaliacao_entrega
        FOREIGN KEY (id_entrega)
        REFERENCES entrega (id_entrega)
        ON DELETE CASCADE,

    CONSTRAINT fk_avaliacao_avaliador
        FOREIGN KEY (id_avaliador)
        REFERENCES usuarios (id_usuario),

    CONSTRAINT ck_avaliacao_status
        CHECK (status IN ('APROVADO', 'REPROVADO', 'AJUSTE'))
);

-- ---------------------------------------------------------------------------
-- Vocabulario da agenda de CADA incubadora: as categorias que aparecem no
-- seletor do calendario, com cor e icone. Substitui o antigo enum
-- eventoCategoria (ver migracao 008).
--
-- A `chave` e o que fica gravado em evento.categoria e nao muda depois de
-- criada; o `rotulo` e editavel, e renomea-lo reetiqueta todo o historico sem
-- tocar em evento nenhum. Excluir e `ativo = FALSE`: apagar de verdade ou seria
-- barrado pela FK ou deixaria o relatorio de engajamento sem rotulo.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS evento_categoria (
    id_tenant INTEGER      NOT NULL,
    chave     VARCHAR(40)  NOT NULL,
    rotulo    VARCHAR(60)  NOT NULL,
    -- Hex de 6 digitos: o front usa direto em CSS.
    cor       CHAR(7)      NOT NULL DEFAULT '#8b5cf6',
    -- Nome do icone MUI, de uma lista fechada resolvida no front (ICONES em
    -- categorias.js). Valor desconhecido cai no fallback, nao quebra a tela.
    icone     VARCHAR(40)  NOT NULL DEFAULT 'Event',
    ordem     SMALLINT     NOT NULL DEFAULT 0,
    ativo     BOOLEAN      NOT NULL DEFAULT TRUE,
    criado_ts TIMESTAMP    NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_evento_categoria PRIMARY KEY (id_tenant, chave),

    CONSTRAINT fk_evento_categoria_tenant
        FOREIGN KEY (id_tenant) REFERENCES tenant (id_tenant) ON DELETE CASCADE,

    CONSTRAINT ck_evento_categoria_cor CHECK (cor ~ '^#[0-9a-fA-F]{6}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_evento_categoria_rotulo
    ON evento_categoria (id_tenant, lower(rotulo));

-- ---------------------------------------------------------------------------
-- Salas/espacos cadastrados pela incubadora. Nao substitui `evento.local`
-- (texto livre): o formulario aceita os dois, cadastro para a sala recorrente
-- e texto avulso para o "auditorio emprestado uma vez".
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS evento_local (
    id_local   INTEGER      GENERATED ALWAYS AS IDENTITY,
    id_tenant  INTEGER      NOT NULL,
    nome       VARCHAR(120) NOT NULL,
    endereco   VARCHAR(200),
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

CREATE TABLE IF NOT EXISTS evento (
    id_evento INTEGER GENERATED ALWAYS AS IDENTITY,
    id_tenant INTEGER NOT NULL,

    titulo VARCHAR(150) NOT NULL,
    descricao TEXT,
    -- Chave em evento_categoria (cor/icone/rotulo vem de la). A FK e COMPOSTA
    -- com id_tenant: sem isso um evento poderia apontar para a categoria de
    -- outra incubadora.
    categoria VARCHAR(40) NOT NULL DEFAULT 'EVENTO',

    -- Local em duas formas, e as duas valem: `id_local` quando escolhido do
    -- cadastro, `local` (texto) quando digitado avulso. A exibicao prefere o
    -- cadastro e cai no texto — que tambem guarda o legado anterior a 008.
    id_local INTEGER,
    local VARCHAR(150),
    inicio_ts TIMESTAMP NOT NULL,
    fim_ts TIMESTAMP,

    -- Nome do mentor responsavel (texto livre; nao ha selecao de usuario aqui).
    mentor_nome VARCHAR(150),
    -- Lista de anexos [{ nome, url }] em formato JSON.
    anexos JSONB NOT NULL DEFAULT '[]',

    vagas INTEGER,
    obrigatorio BOOLEAN DEFAULT FALSE,
    ativo BOOLEAN DEFAULT TRUE,

    criado_por INTEGER NOT NULL,
    criado_ts TIMESTAMP DEFAULT NOW(),
    atualizado_ts TIMESTAMP DEFAULT NOW(),

    CONSTRAINT pk_evento PRIMARY KEY (id_evento),

    CONSTRAINT fk_evento_categoria
        FOREIGN KEY (id_tenant, categoria)
        REFERENCES evento_categoria (id_tenant, chave),

    -- Sem ON DELETE CASCADE: apagar uma sala nao pode apagar o evento que
    -- aconteceu nela.
    CONSTRAINT fk_evento_local
        FOREIGN KEY (id_local)
        REFERENCES evento_local (id_local)
);

-- ---------------------------------------------------------------------------
-- Direcionamento do evento: quais startups o enxergam.
-- Sem nenhuma linha para um id_evento -> evento GERAL (visivel a todas as
-- startups incubadas do tenant). Com linhas -> visivel apenas as listadas.
-- Admin/mentor sempre veem todos os eventos do tenant, independente disso.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS evento_startups (
    id_evento INTEGER NOT NULL,
    id_startup INTEGER NOT NULL,

    CONSTRAINT pk_evento_startups PRIMARY KEY (id_evento, id_startup),

    CONSTRAINT fk_evento_startups_evento
        FOREIGN KEY (id_evento)
        REFERENCES evento (id_evento)
        ON DELETE CASCADE,

    CONSTRAINT fk_evento_startups_startup
        FOREIGN KEY (id_startup)
        REFERENCES startup (id_startup)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS evento_confirmacao (
    id_evento INTEGER NOT NULL,
    id_usuario INTEGER NOT NULL,

    status VARCHAR(20) NOT NULL, -- CONFIRMADO / RECUSADO / TALVEZ
    confirmado_ts TIMESTAMP DEFAULT NOW(),

    PRIMARY KEY (id_evento, id_usuario)
);

CREATE TABLE evento_presenca (
    id_evento INTEGER NOT NULL,
    id_usuario INTEGER NOT NULL,
    presente BOOLEAN NOT NULL DEFAULT TRUE,
    checkin_ts TIMESTAMP DEFAULT NOW(),
    marcado_por INTEGER NOT NULL,

    PRIMARY KEY (id_evento, id_usuario)
);

CREATE TABLE IF NOT EXISTS audit_log (
    id_log BIGINT GENERATED ALWAYS AS IDENTITY,
    id_tenant INTEGER,
    id_usuario INTEGER,
    acao VARCHAR(50) NOT NULL,
    entidade VARCHAR(50) NOT NULL,
    entidade_id VARCHAR(50),
    descricao TEXT,
    dados_antes JSONB,
    dados_depois JSONB,
    criado_ts TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_audit_log PRIMARY KEY (id_log)
);

-- ---------------------------------------------------------------------------
-- Preferencias visuais do usuario (perfil / cor do painel / personalizacoes).
-- Relacao 1:1 com "usuarios": cada usuario tem no maximo uma linha de
-- preferencias. Guarda o tema, as cores do painel e opcoes de layout.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuario_preferencias (
    id_usuario INTEGER NOT NULL,

    tema VARCHAR(10) NOT NULL DEFAULT 'claro',       -- claro / escuro
    cor_primaria VARCHAR(7) NOT NULL DEFAULT '#4f46e5',
    cor_secundaria VARCHAR(7) NOT NULL DEFAULT '#0ea5e9',
    densidade VARCHAR(12) NOT NULL DEFAULT 'confortavel', -- confortavel / compacta
    borda_arredondada INTEGER NOT NULL DEFAULT 12,   -- raio das bordas (px)
    sidebar_recolhida BOOLEAN NOT NULL DEFAULT FALSE,
    atualizado_ts TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_usuario_preferencias PRIMARY KEY (id_usuario),
    CONSTRAINT fk_usuario_preferencias_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuarios (id_usuario)
        ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- Feedback enviado pelo usuario sobre a plataforma (item "Enviar Feedback"
-- do UserPanel). Registro simples, sem fluxo de resposta - fica guardado
-- para o time da FronteiraTec/INNE ler depois.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feedback (
    id_feedback BIGINT GENERATED ALWAYS AS IDENTITY,
    id_usuario INTEGER NOT NULL,
    id_tenant INTEGER,
    mensagem TEXT NOT NULL,
    criado_ts TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_feedback PRIMARY KEY (id_feedback),
    CONSTRAINT fk_feedback_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuarios (id_usuario)
        ON DELETE CASCADE,
    CONSTRAINT fk_feedback_tenant
        FOREIGN KEY (id_tenant)
        REFERENCES tenant (id_tenant)
        ON DELETE SET NULL
);

-- ---------------------------------------------------------------------------
-- RBAC (Roles e Permissoes).
--
-- O catalogo de permissoes NAO e cadastrado manualmente: e sincronizado a
-- partir de backend/src/rbac/catalogoPermissoes.js toda subida da API (ver
-- backend/src/rbac/sincronizarCatalogo.js). As telas/rotas continuam usando
-- o modelo atual (tenant_usuarios.papel / usuarios.root) - este RBAC roda em
-- paralelo, como camada administrativa, sem substituir as checagens atuais.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS permissao (
    id_permissao INTEGER GENERATED ALWAYS AS IDENTITY,
    chave VARCHAR(150) NOT NULL,
    modulo VARCHAR(60) NOT NULL,
    recurso VARCHAR(60) NOT NULL,
    acao VARCHAR(60) NOT NULL,
    rotulo_modulo VARCHAR(100) NOT NULL,
    rotulo_recurso VARCHAR(100) NOT NULL,
    rotulo_acao VARCHAR(100) NOT NULL,
    criado_ts TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_permissao PRIMARY KEY (id_permissao),
    CONSTRAINT uq_permissao_chave UNIQUE (chave)
);

CREATE TABLE IF NOT EXISTS role (
    id_role INTEGER GENERATED ALWAYS AS IDENTITY,
    id_tenant INTEGER NOT NULL,
    nome VARCHAR(100) NOT NULL,
    descricao VARCHAR(255),
    -- Roles padrao criadas junto com o tenant (nao podem ser excluidas).
    sistema BOOLEAN NOT NULL DEFAULT FALSE,
    criado_ts TIMESTAMP NOT NULL DEFAULT NOW(),
    atualizado_ts TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_role PRIMARY KEY (id_role),
    CONSTRAINT fk_role_tenant
        FOREIGN KEY (id_tenant)
        REFERENCES tenant (id_tenant)
        ON DELETE CASCADE,
    CONSTRAINT uq_role_tenant_nome UNIQUE (id_tenant, nome)
);

CREATE TABLE IF NOT EXISTS role_permissao (
    id_role INTEGER NOT NULL,
    id_permissao INTEGER NOT NULL,

    CONSTRAINT pk_role_permissao PRIMARY KEY (id_role, id_permissao),
    CONSTRAINT fk_rp_role
        FOREIGN KEY (id_role)
        REFERENCES role (id_role)
        ON DELETE CASCADE,
    CONSTRAINT fk_rp_permissao
        FOREIGN KEY (id_permissao)
        REFERENCES permissao (id_permissao)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS usuario_role (
    id_usuario INTEGER NOT NULL,
    id_role INTEGER NOT NULL,
    criado_ts TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_usuario_role PRIMARY KEY (id_usuario, id_role),
    CONSTRAINT fk_ur_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuarios (id_usuario)
        ON DELETE CASCADE,
    CONSTRAINT fk_ur_role
        FOREIGN KEY (id_role)
        REFERENCES role (id_role)
        ON DELETE CASCADE
);