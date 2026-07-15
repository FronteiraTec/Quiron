CREATE TYPE papelEnum AS ENUM ('admin', 'mentor', 'usuario');
CREATE TYPE statusStartup AS ENUM ('ATIVA', 'PAUSADA', 'ENCERRADA');
CREATE TYPE tarefaTipo AS ENUM('TEXTO', 'ANEXO', 'VIDEO', 'QUESTIONARIO');
-- Tipos de pergunta (estilo Google Forms):
--   TEXTO_CURTO    -> resposta curta de uma linha (sem alternativas)
--   PARAGRAFO      -> resposta longa / descritiva (sem alternativas)
--   ESCOLHA_UNICA  -> multipla escolha com UMA resposta (radio, tem alternativas)
--   CAIXAS_SELECAO -> assinalar VARIAS respostas (checkbox, tem alternativas)
CREATE TYPE perguntaTipo AS ENUM('TEXTO_CURTO', 'PARAGRAFO', 'ESCOLHA_UNICA', 'CAIXAS_SELECAO');
-- Categoria de um evento do calendario da incubacao (evento.categoria).
CREATE TYPE eventoCategoria AS ENUM (
    'MENTORIA', 'WORKSHOP', 'ENTREGA', 'REUNIAO', 'EVENTO', 'PITCH', 'PRAZO', 'VISITA'
);


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


CREATE TABLE IF NOT EXISTS fase (
    id_fase INTEGER GENERATED ALWAYS AS IDENTITY,
    id_tenant INTEGER NOT NULL,
    nome VARCHAR(120) NOT NULL,
	descricao TEXT NOT NULL,
    ordem INTEGER NOT NULL,
    ativa BOOLEAN NOT NULL DEFAULT TRUE,
    criado_ts TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_fase PRIMARY KEY (id_fase),

    CONSTRAINT fk_fase_tenant
        FOREIGN KEY (id_tenant)
        REFERENCES tenant (id_tenant)
        ON DELETE CASCADE,

    CONSTRAINT uk_fase_tenant_ordem
        UNIQUE (id_tenant, ordem)
);


CREATE TABLE IF NOT EXISTS modulo (
    id_modulo INTEGER GENERATED ALWAYS AS IDENTITY,
    id_fase INTEGER NOT NULL,
    nome VARCHAR(120) NOT NULL,
	descricao TEXT NOT NULL,
    ordem INTEGER NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_ts TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_modulo PRIMARY KEY (id_modulo),

    CONSTRAINT fk_modulo_fase
        FOREIGN KEY (id_fase)
        REFERENCES fase (id_fase)
        ON DELETE CASCADE,

    CONSTRAINT uk_modulo_fase_ordem
        UNIQUE (id_fase, ordem)
);

CREATE TABLE IF NOT EXISTS tarefa (
    id_tarefa INTEGER GENERATED ALWAYS AS IDENTITY,
    id_modulo INTEGER NOT NULL,
	id_questionario INTEGER,
    titulo VARCHAR(150) NOT NULL,
    descricao TEXT,
    tipo tarefaTipo NOT NULL,
    permite_entrega BOOLEAN NOT NULL DEFAULT FALSE,
    obrigatoria BOOLEAN NOT NULL DEFAULT TRUE,
    ordem INTEGER NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_ts TIMESTAMP NOT NULL DEFAULT NOW(),
	anexo TEXT,

    CONSTRAINT pk_tarefa PRIMARY KEY (id_tarefa),

    CONSTRAINT fk_tarefa_modulo
        FOREIGN KEY (id_modulo)
        REFERENCES modulo (id_modulo)
        ON DELETE CASCADE,

    CONSTRAINT uk_tarefa_modulo_ordem
        UNIQUE (id_modulo, ordem)

);


CREATE TABLE IF NOT EXISTS startup_fase (
    id_startup_fase INTEGER GENERATED ALWAYS AS IDENTITY,
    id_startup INTEGER NOT NULL,
    id_fase INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'EM_ANDAMENTO',
    inicio_ts TIMESTAMP NOT NULL DEFAULT NOW(),
    fim_ts TIMESTAMP,
    aprovado_por INTEGER,

    CONSTRAINT pk_startup_fase PRIMARY KEY (id_startup_fase),

    CONSTRAINT fk_startup_fase_startup
        FOREIGN KEY (id_startup)
        REFERENCES startup (id_startup)
        ON DELETE CASCADE,

    CONSTRAINT fk_startup_fase_fase
        FOREIGN KEY (id_fase)
        REFERENCES fase (id_fase)
        ON DELETE CASCADE,

    CONSTRAINT fk_startup_fase_aprovado_por
        FOREIGN KEY (aprovado_por)
        REFERENCES usuarios (id_usuario),

    CONSTRAINT ck_startup_fase_status
        CHECK (status IN (
            'EM_ANDAMENTO',
            'AGUARDANDO_APROVACAO',
            'APROVADA',
            'REPROVADA'
        ))
);


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

    id_tarefa INTEGER NOT NULL,
    id_startup INTEGER NOT NULL,
    id_usuario INTEGER NOT NULL,
    texto_resposta TEXT,
    arquivo_url TEXT,

    criado_ts TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_entrega PRIMARY KEY (id_entrega),

    CONSTRAINT fk_entrega_tarefa
        FOREIGN KEY (id_tarefa)
        REFERENCES tarefa (id_tarefa)
        ON DELETE CASCADE,

    CONSTRAINT fk_entrega_startup
        FOREIGN KEY (id_startup)
        REFERENCES startup (id_startup)
        ON DELETE CASCADE,

    CONSTRAINT fk_entrega_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuarios (id_usuario)
);

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

CREATE TABLE IF NOT EXISTS evento (
    id_evento INTEGER GENERATED ALWAYS AS IDENTITY,
    id_tenant INTEGER NOT NULL,

    titulo VARCHAR(150) NOT NULL,
    descricao TEXT,
    -- Categoria exibida no calendario (cor/icone); ver enum eventoCategoria.
    categoria eventoCategoria NOT NULL DEFAULT 'EVENTO',

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

    CONSTRAINT pk_evento PRIMARY KEY (id_evento)
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