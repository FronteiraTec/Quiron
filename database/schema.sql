CREATE TYPE papelEnum AS ENUM ('admin', 'mentor', 'usuario');
CREATE TYPE statusStartup AS ENUM ('ATIVA', 'PAUSADA', 'ENCERRADA');
CREATE TYPE tarefaTipo AS ENUM('TEXTO', 'ANEXO', 'VIDEO', 'QUESTIONARIO');


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
    ROOT BOOLEAN DEFAULT FALSE,
    ultimo_login_ts TIMESTAMP,
    criado_ts TIMESTAMP NOT NULL DEFAULT NOW(),
    atualizado_ts TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_usuarios PRIMARY KEY (id_usuario),
    CONSTRAINT uk_usuarios_email UNIQUE (email)
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
	multipla_escolha BOOLEAN DEFAULT FALSE,
	
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

    local VARCHAR(150),
    inicio_ts TIMESTAMP NOT NULL,
    fim_ts TIMESTAMP,

    vagas INTEGER,
    obrigatorio BOOLEAN DEFAULT FALSE,
    ativo BOOLEAN DEFAULT TRUE,

    criado_por INTEGER NOT NULL,
    criado_ts TIMESTAMP DEFAULT NOW(),

    CONSTRAINT pk_evento PRIMARY KEY (id_evento)
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