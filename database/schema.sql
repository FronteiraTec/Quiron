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
-- Troca de mao de um passo (passo_evento.tipo, migracao 011). Sao os quatro
-- fatos que mudam de lado o dono do relogio: o incubado enviou, o mentor
-- respondeu. RASCUNHO nao entra — salvar rascunho nao entrega nada a ninguem.
CREATE TYPE passoEventoTipo AS ENUM ('ENVIADA', 'APROVADO', 'AJUSTE', 'REPROVADO');
-- Tipos de pergunta (estilo Google Forms):
--   TEXTO_CURTO    -> resposta curta de uma linha (sem alternativas)
--   PARAGRAFO      -> resposta longa / descritiva (sem alternativas)
--   ESCOLHA_UNICA  -> multipla escolha com UMA resposta (radio, tem alternativas)
--   CAIXAS_SELECAO -> assinalar VARIAS respostas (checkbox, tem alternativas)
CREATE TYPE perguntaTipo AS ENUM('TEXTO_CURTO', 'PARAGRAFO', 'ESCOLHA_UNICA', 'CAIXAS_SELECAO');
-- Tipos de campo personalizavel (startup_campo.tipo e tarefa_campo.tipo).
-- Lista fechada porque cada tipo tem renderizacao propria no front e validacao
-- propria no back: um tipo desconhecido nao viraria campo nenhum, viraria tela
-- quebrada. Compartilhado pelos dois modulos que oferecem campos proprios — o
-- cadastro de startup (migracao 010) e a gestao de tarefas (migracao 014) —,
-- que o backend valida com o mesmo codigo (backend/src/campos).
CREATE TYPE campoTipo AS ENUM ('TEXTO', 'CATEGORIA', 'NUMERICO', 'DOCUMENTO', 'MONETARIO');
-- Gestao de tarefas (migracao 014). O que um status do quadro SIGNIFICA para o
-- sistema, por tras do rotulo livre que cada incubadora escolhe: e o mesmo
-- desenho do `ciclo` de startup_situacao, e serve para as tres perguntas que o
-- codigo faz sem entender vocabulario alheio — a tarefa esta aberta? esta
-- atrasada? quando foi concluida?
CREATE TYPE tarefaCategoria AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA');
-- A prioridade e enum, e nao vocabulario por tenant como o status: nao e um
-- estagio do fluxo (que varia de incubadora para incubadora), e uma escala
-- ordenada de quatro degraus que o quadro usa para desempatar e para colorir.
CREATE TYPE tarefaPrioridade AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'URGENTE');
-- Como uma mensagem interna foi enderecada (mensagem_destino.tipo, migracao
-- 012). Lista fechada porque cada valor tem uma consulta de expansao propria
-- (mensagemRepository.idsPorDestino) e uma chave de permissao propria no
-- catalogo RBAC: um tipo desconhecido nao viraria destino nenhum, viraria
-- mensagem sem destinatario.
CREATE TYPE mensagemDestinoTipo AS ENUM ('TENANT', 'STARTUP', 'MENTORES', 'ROLE', 'USUARIO');
-- O cadastro do mentor (migracao 016). Estes dois SAO enum — ao contrario das
-- especialidades, que sao texto livre — porque ha leitura de sistema atras
-- deles: o formato decide o que a coordenacao oferece a startup, e a situacao
-- alimenta o filtro e a acao em massa da listagem de mentores.
CREATE TYPE mentorFormato AS ENUM ('PRESENCIAL', 'ONLINE', 'HIBRIDO');
CREATE TYPE mentorSituacao AS ENUM ('ATIVO', 'INDISPONIVEL', 'INATIVO');
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

-- ---------------------------------------------------------------------------
-- O VOCABULARIO DE CADASTRO DE CADA INCUBADORA (migracao 010)
--
-- TIPO e SITUACAO sao dado por tenant, nao enum, pelo mesmo motivo que levou a
-- categoria de evento a sair do enum na 008: acrescentar um valor para UMA
-- incubadora exigiria um ALTER TYPE valendo para todas. Cada incubadora tem os
-- tipos que quiser.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS startup_tipo (
    id_tenant INTEGER     NOT NULL,
    -- Identificador estavel, gravado em startup.tipo. Nao muda depois de
    -- criado; quem muda e o rotulo.
    chave     VARCHAR(40) NOT NULL,
    rotulo    VARCHAR(60) NOT NULL,
    cor       CHAR(7)     NOT NULL DEFAULT '#6366f1',
    ordem     SMALLINT    NOT NULL DEFAULT 0,
    ativo     BOOLEAN     NOT NULL DEFAULT TRUE,
    criado_ts TIMESTAMP   NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_startup_tipo PRIMARY KEY (id_tenant, chave),

    CONSTRAINT fk_startup_tipo_tenant
        FOREIGN KEY (id_tenant) REFERENCES tenant (id_tenant) ON DELETE CASCADE,

    CONSTRAINT ck_startup_tipo_cor CHECK (cor ~ '^#[0-9a-fA-F]{6}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_startup_tipo_rotulo
    ON startup_tipo (id_tenant, lower(rotulo));


-- A SITUACAO e o "status" que a incubadora ve e edita. O enum statusStartup
-- continua existindo em startup.status porque HA CODIGO ATRAS DELE (relatorios
-- e agenda tiram do programa quem esta ENCERRADA); cada situacao declara em
-- `ciclo` a qual dos tres estados equivale, e o status e derivado dai. Assim a
-- incubadora inventa "Em tracao" ou "Desligada" sem que nenhuma consulta perca
-- o sentido.
CREATE TABLE IF NOT EXISTS startup_situacao (
    id_tenant INTEGER       NOT NULL,
    chave     VARCHAR(40)   NOT NULL,
    rotulo    VARCHAR(60)   NOT NULL,
    cor       CHAR(7)       NOT NULL DEFAULT '#10b981',
    ciclo     statusStartup NOT NULL DEFAULT 'ATIVA',
    ordem     SMALLINT      NOT NULL DEFAULT 0,
    ativo     BOOLEAN       NOT NULL DEFAULT TRUE,
    criado_ts TIMESTAMP     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_startup_situacao PRIMARY KEY (id_tenant, chave),

    CONSTRAINT fk_startup_situacao_tenant
        FOREIGN KEY (id_tenant) REFERENCES tenant (id_tenant) ON DELETE CASCADE,

    CONSTRAINT ck_startup_situacao_cor CHECK (cor ~ '^#[0-9a-fA-F]{6}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_startup_situacao_rotulo
    ON startup_situacao (id_tenant, lower(rotulo));


-- A DEFINICAO dos campos personalizaveis do cadastro. Os VALORES ficam em
-- startup.campos_extras (JSONB), um documento por startup.
--
-- Definicao relacional + valor em JSONB, e nao EAV (uma linha por valor): ler
-- uma startup com 12 campos extras viraria 12 JOINs, e esses campos nunca sao
-- consultados isoladamente — sao lidos junto com a startup, sempre. O que
-- precisa de integridade e a definicao (tipo, mascara, opcoes, ordem), e ela
-- continua aqui.
CREATE TABLE IF NOT EXISTS startup_campo (
    id_campo    INTEGER GENERATED ALWAYS AS IDENTITY,
    id_tenant   INTEGER      NOT NULL,
    -- Nome da propriedade dentro de startup.campos_extras. Imutavel: esta
    -- gravado no JSONB de cada startup, e troca-la orfanaria os valores.
    chave       VARCHAR(40)  NOT NULL,
    rotulo      VARCHAR(80)  NOT NULL,
    tipo        campoTipo    NOT NULL,
    descricao   VARCHAR(200),
    obrigatorio BOOLEAN      NOT NULL DEFAULT FALSE,
    ordem       SMALLINT     NOT NULL DEFAULT 0,
    ativo       BOOLEAN      NOT NULL DEFAULT TRUE,
    -- O que muda de tipo para tipo, e so faz sentido dentro dele:
    --   CATEGORIA -> { "opcoes": [{ "valor": "A", "rotulo": "Opcao A" }] }
    --   DOCUMENTO -> { "mascara": "###.###.###-##" }
    --   NUMERICO  -> { "min": 0, "max": 100, "casas": 2, "sufixo": "%" }
    --   MONETARIO -> { "moeda": "BRL" }
    config      JSONB        NOT NULL DEFAULT '{}',
    criado_ts   TIMESTAMP    NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_startup_campo PRIMARY KEY (id_campo),

    CONSTRAINT fk_startup_campo_tenant
        FOREIGN KEY (id_tenant) REFERENCES tenant (id_tenant) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_startup_campo_chave
    ON startup_campo (id_tenant, chave);
CREATE UNIQUE INDEX IF NOT EXISTS uq_startup_campo_rotulo
    ON startup_campo (id_tenant, lower(rotulo));


CREATE TABLE IF NOT EXISTS startup (
    id_startup INTEGER GENERATED ALWAYS AS IDENTITY,
    id_tenant INTEGER NOT NULL,
    nome VARCHAR(150) NOT NULL,
    cnpj CHAR(14),
    -- Sem mascara, como o CNPJ: cada UF tem o proprio formato de IE, entao a
    -- coluna guarda so os digitos e a tela formata.
    inscricao_estadual VARCHAR(20),
    -- E-mail institucional da startup (contato@...), distinto dos e-mails
    -- pessoais dos contatos em startup_contato.
    email VARCHAR(150),
	logo VARCHAR(255),

    -- Classificacao no vocabulario da incubadora (startup_tipo/startup_situacao).
    tipo VARCHAR(40),
    situacao VARCHAR(40),
    -- Estado do CICLO, derivado de startup_situacao.ciclo. E o que relatorios e
    -- agenda leem para saber quem ainda esta no programa.
    status statusStartup DEFAULT 'ATIVA',

    observacoes TEXT,

    -- Endereco. O CEP alimenta cidade/uf/bairro/rua via ViaCEP, no front; sem
    -- mascara, como o CNPJ. Numero e complemento o ViaCEP nao devolve, e sem
    -- eles o endereco nao chega em lugar nenhum.
    cep CHAR(8),
    uf CHAR(2),
    cidade VARCHAR(100),
    bairro VARCHAR(100),
    rua VARCHAR(150),
    numero VARCHAR(20),
    complemento VARCHAR(100),

    -- Os VALORES dos campos personalizaveis, { "chave": valor }. A definicao
    -- de cada chave esta em startup_campo.
    campos_extras JSONB NOT NULL DEFAULT '{}',

    criado_ts TIMESTAMP NOT NULL DEFAULT NOW(),
    atualizado_ts TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_startup PRIMARY KEY (id_startup),

    CONSTRAINT fk_startup_tenant
        FOREIGN KEY (id_tenant)
        REFERENCES tenant (id_tenant)
        ON DELETE CASCADE,

    -- FKs COMPOSTAS: sem o id_tenant nelas, uma startup poderia apontar para o
    -- tipo de outra incubadora.
    CONSTRAINT fk_startup_tipo
        FOREIGN KEY (id_tenant, tipo)
        REFERENCES startup_tipo (id_tenant, chave)
        ON UPDATE CASCADE,

    CONSTRAINT fk_startup_situacao
        FOREIGN KEY (id_tenant, situacao)
        REFERENCES startup_situacao (id_tenant, chave)
        ON UPDATE CASCADE

);

-- Torna o JSONB pesquisavel ("startups cujo campo 'setor' e 'AgriTech'") sem
-- varrer a tabela inteira.
CREATE INDEX IF NOT EXISTS ix_startup_campos_extras
    ON startup USING GIN (campos_extras);


-- A lista de contatos da startup. Tabela, e nao JSONB como campos_extras: a
-- lista cresce e encolhe por linha, e o contato principal precisa ser
-- consultavel sem abrir o documento de cada startup.
CREATE TABLE IF NOT EXISTS startup_contato (
    id_contato INTEGER GENERATED ALWAYS AS IDENTITY,
    id_startup INTEGER      NOT NULL,
    nome       VARCHAR(150) NOT NULL,
    cargo      VARCHAR(100),
    email      VARCHAR(150),
    -- Sem mascara, como usuarios.celular: o front formata na exibicao.
    telefone   VARCHAR(15),
    principal  BOOLEAN      NOT NULL DEFAULT FALSE,
    ordem      SMALLINT     NOT NULL DEFAULT 0,
    criado_ts  TIMESTAMP    NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_startup_contato PRIMARY KEY (id_contato),

    -- CASCADE de verdade aqui, ao contrario de tipo/situacao: contato nao e
    -- vocabulario compartilhado, e dado da startup. Sem ela, nao existe.
    CONSTRAINT fk_startup_contato_startup
        FOREIGN KEY (id_startup) REFERENCES startup (id_startup) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_startup_contato_startup
    ON startup_contato (id_startup);

-- Um principal por startup, no maximo. Indice parcial, e nao CHECK: e a unica
-- forma de dizer "unico entre os que sao TRUE" no Postgres.
CREATE UNIQUE INDEX IF NOT EXISTS uq_startup_contato_principal
    ON startup_contato (id_startup) WHERE principal;


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
-- O CADASTRO DO MENTOR (migracao 016).
--
-- "Mentor" continua sendo o papel 'mentor' em tenant_usuarios; esta tabela e
-- so o que a coordenacao sabe sobre ele. E POR TENANT porque a mesma pessoa
-- pode mentorar em duas incubadoras com disponibilidade e status diferentes em
-- cada uma.
--
-- OPCIONAL DE PROPOSITO: a listagem faz LEFT JOIN e aplica os padroes
-- (ATIVO / HIBRIDO), e a linha nasce no primeiro salvamento. Criar uma linha
-- vazia para todo mentor obrigaria a criar tambem no dia em que alguem vira
-- mentor em /usuarios — dois lugares gravando a mesma coisa.
--
-- ESPECIALIDADES E DEMANDAS SAO TEXT[], e nao vocabulario por tenant como
-- startup_tipo: nao ha codigo atras do valor, ninguem deriva estado do sistema
-- de "Growth" ou "Juridico". Sao rotulos para achar gente, e o front sugere os
-- que ja estao em uso na incubadora. O GIN e o que faz o filtro valer.
--
-- `situacao` NAO E `tenant_usuarios.ativo`: `ativo` diz se a pessoa tem acesso,
-- `situacao` diz o que a coordenacao sabe dela. "Indisponivel neste semestre"
-- nao pode tirar o login de ninguem.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mentor_perfil (
    id_tenant  INTEGER NOT NULL,
    id_usuario INTEGER NOT NULL,

    -- De onde ele vem ("Professor UFPE", "Consultor externo") e a area dentro
    -- desse vinculo ("Centro de Informatica", "Juridico").
    vinculo VARCHAR(120),
    area    VARCHAR(120),

    especialidades TEXT[] NOT NULL DEFAULT '{}',
    demandas       TEXT[] NOT NULL DEFAULT '{}',

    -- Disponibilidade ESTIMADA, em horas por mes: e o que o mentor declarou.
    -- Quem mede e a contagem de mentorias no periodo, e ler as duas lado a
    -- lado e o ponto da tela.
    horas_mes SMALLINT,

    formato  mentorFormato  NOT NULL DEFAULT 'HIBRIDO',
    situacao mentorSituacao NOT NULL DEFAULT 'ATIVO',

    -- O que nao cabe em campo nenhum ("so atende healthtech", "avisar com 15
    -- dias"). Vira coluna da listagem, fechada por padrao.
    observacoes TEXT,

    atualizado_ts TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_mentor_perfil PRIMARY KEY (id_tenant, id_usuario),

    -- FK COMPOSTA para tenant_usuarios, e nao para usuarios: so existe perfil
    -- de quem esta na incubadora, e tirar a pessoa de la leva o cadastro junto.
    CONSTRAINT fk_mentor_perfil_vinculo
        FOREIGN KEY (id_tenant, id_usuario)
        REFERENCES tenant_usuarios (id_tenant, id_usuario)
        ON DELETE CASCADE,

    -- 500h/mes e mais do que existe num mes de trabalho: o teto so barra
    -- digito trocado (o "40" que vira "400").
    CONSTRAINT ck_mentor_perfil_horas
        CHECK (horas_mes IS NULL OR (horas_mes >= 0 AND horas_mes <= 500))
);

CREATE INDEX IF NOT EXISTS ix_mentor_perfil_especialidades
    ON mentor_perfil USING GIN (especialidades);
CREATE INDEX IF NOT EXISTS ix_mentor_perfil_demandas
    ON mentor_perfil USING GIN (demandas);


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

    -- A incubadora pode ter varias trilhas (varios PROGRAMA). Esta e a
    -- sugerida no cadastro de startup — uma por tenant, ver o indice parcial
    -- uk_trilha_no_padrao abaixo.
    padrao          BOOLEAN NOT NULL DEFAULT FALSE,

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

    -- Marcar uma FASE como padrao nao significa nada.
    CONSTRAINT ck_trilha_no_padrao CHECK (
        padrao = FALSE OR tipo = 'PROGRAMA'
    ),

    -- DEFERRABLE: o Construtor reindexa ordem 1..n a cada drag-and-drop; sem
    -- isso o UPDATE em lote colide consigo mesmo no meio do caminho.
    CONSTRAINT uk_trilha_no_ordem
        UNIQUE (id_pai, ordem)
        DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS ix_trilha_no_pai    ON trilha_no (id_pai, ordem);
CREATE INDEX IF NOT EXISTS ix_trilha_no_tenant ON trilha_no (id_tenant, tipo);

-- Uma trilha padrao por incubadora. PARCIAL: as N trilhas nao-padrao do mesmo
-- tenant nao colidem entre si, so a marcada colide com outra marcada.
CREATE UNIQUE INDEX IF NOT EXISTS uk_trilha_no_padrao
    ON trilha_no (id_tenant)
    WHERE padrao AND tipo = 'PROGRAMA';


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


-- Matricula: quais startups fazem qual trilha.
--
-- N:N de proposito. Uma startup pode estar em duas trilhas ao mesmo tempo e
-- mantem as concluidas na lista, que e o historico exibido em "Minha Jornada".
--
-- E diferente de `startup_trilha` (logo abaixo): la fica o PROGRESSO dentro de
-- uma trilha; aqui fica o PERTENCIMENTO a ela, que existe antes de qualquer
-- progresso e continua depois que a trilha acaba.
CREATE TABLE IF NOT EXISTS startup_programa (
    id_startup INTEGER NOT NULL,
    id_no      INTEGER NOT NULL,   -- sempre um PROGRAMA (ver o trigger)

    status     VARCHAR(20) NOT NULL DEFAULT 'EM_ANDAMENTO',
    inicio_ts  TIMESTAMP NOT NULL DEFAULT NOW(),
    fim_ts     TIMESTAMP,

    CONSTRAINT pk_startup_programa PRIMARY KEY (id_startup, id_no),

    CONSTRAINT fk_sp_startup
        FOREIGN KEY (id_startup)
        REFERENCES startup (id_startup)
        ON DELETE CASCADE,

    CONSTRAINT fk_sp_no
        FOREIGN KEY (id_no)
        REFERENCES trilha_no (id_no)
        ON DELETE CASCADE,

    CONSTRAINT ck_sp_status
        CHECK (status IN ('EM_ANDAMENTO', 'CONCLUIDA')),

    CONSTRAINT ck_sp_fim
        CHECK (status <> 'CONCLUIDA' OR fim_ts IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS ix_sp_no ON startup_programa (id_no);


-- A matricula so aceita a RAIZ de uma trilha, e do mesmo tenant da startup.
-- Um CHECK nao alcanca a linha referenciada, entao a regra vive num trigger.
CREATE OR REPLACE FUNCTION fn_startup_programa_raiz()
RETURNS TRIGGER AS $$
DECLARE
    tipo_no      trilhaNoTipo;
    tenant_no    INTEGER;
    tenant_start INTEGER;
BEGIN
    SELECT tipo, id_tenant INTO tipo_no, tenant_no
      FROM trilha_no WHERE id_no = NEW.id_no;

    IF tipo_no IS DISTINCT FROM 'PROGRAMA' THEN
        RAISE EXCEPTION
            'Matricula exige a raiz da trilha (PROGRAMA), recebido % (no %)',
            COALESCE(tipo_no::TEXT, 'inexistente'), NEW.id_no;
    END IF;

    SELECT id_tenant INTO tenant_start
      FROM startup WHERE id_startup = NEW.id_startup;

    IF tenant_start <> tenant_no THEN
        RAISE EXCEPTION 'Startup e trilha pertencem a incubadoras diferentes';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_startup_programa_raiz ON startup_programa;
CREATE TRIGGER trg_startup_programa_raiz
    BEFORE INSERT OR UPDATE OF id_no, id_startup ON startup_programa
    FOR EACH ROW EXECUTE FUNCTION fn_startup_programa_raiz();


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
-- LIVRO-CAIXA DO TEMPO — cada troca de mao de um passo (ver migracao 011).
--
-- Existe porque duracao e historia, e o resto do modelo so guarda o presente:
-- `entrega` e upsert (uma linha por passo, reescrita a cada save) e o reenvio
-- APAGA as avaliacoes anteriores para o passo voltar a "aguardando". Sem esta
-- tabela nao ha como responder ha quanto tempo a startup esta numa fase, nem
-- quanto desse tempo foi ela produzindo e quanto foi fila de correcao parada
-- na mao do mentor.
--
-- Append-only: nenhum caminho do codigo faz UPDATE ou DELETE aqui. A serie de
-- um passo alterna ENVIADA -> (APROVADO|AJUSTE|REPROVADO) -> ENVIADA..., e o
-- trecho entre dois eventos tem um dono so — depois de ENVIADA a bola e do
-- mentor, depois de um ajuste volta a ser do incubado, APROVADO encerra.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS passo_evento (
    id_evento  BIGINT GENERATED ALWAYS AS IDENTITY,

    id_startup INTEGER NOT NULL,
    id_no      INTEGER NOT NULL,   -- sempre um PASSO (folha da trilha)

    tipo       passoEventoTipo NOT NULL,

    -- Quem causou: o membro que enviou, ou o mentor que respondeu.
    id_usuario INTEGER,

    ts         TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_passo_evento PRIMARY KEY (id_evento),

    CONSTRAINT fk_passo_evento_startup
        FOREIGN KEY (id_startup)
        REFERENCES startup (id_startup)
        ON DELETE CASCADE,

    -- CASCADE igual ao de `entrega`: excluir o passo no Construtor leva junto
    -- as submissoes e, com elas, o historico de tempo daquele passo.
    CONSTRAINT fk_passo_evento_no
        FOREIGN KEY (id_no)
        REFERENCES trilha_no (id_no)
        ON DELETE CASCADE,

    CONSTRAINT fk_passo_evento_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuarios (id_usuario)
);

-- A leitura e sempre "a linha do tempo deste passo desta startup, em ordem":
-- o indice cobre a particao e a ordenacao do LEAD() do relatorio.
CREATE INDEX IF NOT EXISTS ix_passo_evento_linha
    ON passo_evento (id_startup, id_no, ts, id_evento);

CREATE INDEX IF NOT EXISTS ix_passo_evento_no
    ON passo_evento (id_no, ts);


-- Envio: dispara em qualquer escrita de `entrega` que a deixe ENVIADA.
--
-- Nao basta olhar a MUDANCA de status — o reenvio apos ajuste vai de ENVIADA
-- para ENVIADA e escaparia. A guarda e outra: se o ultimo evento do passo JA e
-- ENVIADA, a bola ja esta com o mentor e um save repetido nao e novo envio.
-- Isso mantem a serie alternada, que e o que da um dono unico a cada trecho.
CREATE OR REPLACE FUNCTION fn_passo_evento_entrega()
RETURNS TRIGGER AS $$
DECLARE
    ultimo passoEventoTipo;
BEGIN
    IF NEW.status <> 'ENVIADA' THEN
        RETURN NULL;  -- rascunho: a bola nao saiu da mao do incubado
    END IF;

    SELECT tipo INTO ultimo
      FROM passo_evento
     WHERE id_startup = NEW.id_startup AND id_no = NEW.id_no
     ORDER BY ts DESC, id_evento DESC
     LIMIT 1;

    IF ultimo = 'ENVIADA' THEN
        RETURN NULL;  -- ja esta na fila do mentor
    END IF;

    -- NOW() e nao NEW.atualizado_ts: o evento e quando aconteceu, e NOW() nunca
    -- anda para tras — uma serie fora de ordem inverteria a conta de duracao.
    INSERT INTO passo_evento (id_startup, id_no, tipo, id_usuario)
    VALUES (NEW.id_startup, NEW.id_no, 'ENVIADA', NEW.id_usuario);

    RETURN NULL;  -- AFTER trigger: o retorno e ignorado
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_passo_evento_entrega ON entrega;
CREATE TRIGGER trg_passo_evento_entrega
    AFTER INSERT OR UPDATE ON entrega
    FOR EACH ROW EXECUTE FUNCTION fn_passo_evento_entrega();


-- Devolutiva: registra a resposta do mentor no instante em que ela nasce —
-- dias antes de o reenvio apagar a linha de `avaliacao`. E dai que sai a
-- duracao dos ciclos de ajuste, que sem isto desapareceriam sem rastro.
CREATE OR REPLACE FUNCTION fn_passo_evento_avaliacao()
RETURNS TRIGGER AS $$
DECLARE
    origem RECORD;
BEGIN
    SELECT id_startup, id_no INTO origem
      FROM entrega WHERE id_entrega = NEW.id_entrega;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    INSERT INTO passo_evento (id_startup, id_no, tipo, id_usuario)
    VALUES (origem.id_startup, origem.id_no,
            NEW.status::passoEventoTipo, NEW.id_avaliador);

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_passo_evento_avaliacao ON avaliacao;
CREATE TRIGGER trg_passo_evento_avaliacao
    AFTER INSERT ON avaliacao
    FOR EACH ROW EXECUTE FUNCTION fn_passo_evento_avaliacao();


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

    -- O responsavel pela atividade, em duas formas — e as duas valem, no mesmo
    -- desenho de local/id_local: `id_usuario_mentor` quando e um mentor da
    -- incubadora, `mentor_nome` (texto) quando e um convidado de fora, ou o
    -- legado anterior a migracao 016.
    --
    -- E o id que da historico ao mentor: "ultima mentoria" e "mentorias no
    -- periodo" na tela /mentores saem daqui. Por texto, "Ana Souza" e "ana
    -- souza" seriam dois mentores e nenhuma contagem fecharia.
    id_usuario_mentor INTEGER,
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
        REFERENCES evento_local (id_local),

    -- SET NULL pelo mesmo motivo: excluir o usuario nao apaga a atividade que
    -- aconteceu. Ela perde o dono, nao a existencia — e o `mentor_nome` fica
    -- dizendo quem foi.
    CONSTRAINT fk_evento_mentor
        FOREIGN KEY (id_usuario_mentor)
        REFERENCES usuarios (id_usuario)
        ON DELETE SET NULL
);

-- A consulta do historico de um mentor e sempre "as mentorias DELE, em ordem
-- de data" (ver mentorRepository.listarPorTenant).
CREATE INDEX IF NOT EXISTS ix_evento_mentor
    ON evento (id_usuario_mentor, inicio_ts);

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

-- ---------------------------------------------------------------------------
-- Mensagens internas (migracao 012).
--
-- O canal proprio da incubadora: quem tem a permissao RBAC de comunicacao
-- escreve para uma startup inteira, para os mentores, para uma role ou para
-- pessoas especificas, e o aviso aparece no sino de quem recebeu.
--
-- Tres tabelas porque sao tres coisas distintas: o TEXTO (mensagem), o
-- CRITERIO escolhido por quem escreveu (mensagem_destino) e a ENTREGA a cada
-- pessoa, com o estado de leitura dela (mensagem_destinatario).
--
-- A lista de pessoas e um INSTANTANEO tirado no envio, nao uma consulta
-- refeita na leitura: quem entrar na startup amanha nao recebe o aviso de
-- hoje, e quem sair nao perde o que ja tinha. Ver o cabecalho da migracao 012
-- para o raciocinio completo.
--
-- CONVERSA (migracao 013) nao tem tabela: e o par (remetente, destinatario)
-- lido dos dois lados. Responder e mandar uma mensagem de volta com destino
-- USUARIO; a thread e a uniao das duas direcoes em ordem cronologica.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mensagem (
    id_mensagem BIGINT GENERATED ALWAYS AS IDENTITY,
    id_tenant INTEGER NOT NULL,
    -- NULL = o autor saiu do sistema. A mensagem sobrevive a ele: apagar o
    -- usuario nao pode apagar o aviso que trinta pessoas ja leram.
    id_remetente INTEGER,
    -- Opcional (migracao 013): aviso tem assunto ("Pitch na sexta"), fala de
    -- conversa nao tem. NULL e o que distingue os dois na interface.
    assunto VARCHAR(150),
    corpo TEXT NOT NULL,
    -- Destaque visual no sino e no email. Nao muda quem recebe.
    importante BOOLEAN NOT NULL DEFAULT FALSE,
    -- Rota do front para onde o clique na notificacao leva (ex.: "/entregas").
    rota VARCHAR(255),
    -- A que esta mensagem responde (migracao 013). SET NULL porque apagar o
    -- aviso original nao pode apagar o que as pessoas responderam depois.
    id_mensagem_pai BIGINT,
    criado_ts TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_mensagem PRIMARY KEY (id_mensagem),
    CONSTRAINT fk_mensagem_pai
        FOREIGN KEY (id_mensagem_pai)
        REFERENCES mensagem (id_mensagem)
        ON DELETE SET NULL,
    CONSTRAINT fk_mensagem_tenant
        FOREIGN KEY (id_tenant)
        REFERENCES tenant (id_tenant)
        ON DELETE CASCADE,
    CONSTRAINT fk_mensagem_remetente
        FOREIGN KEY (id_remetente)
        REFERENCES usuarios (id_usuario)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_mensagem_tenant ON mensagem (id_tenant, criado_ts DESC);
-- A conversa e derivada do par (remetente, destinatario): este indice cobre o
-- lado "o que eu mandei"; ix_mensagem_destinatario_caixa cobre o outro.
CREATE INDEX IF NOT EXISTS ix_mensagem_remetente ON mensagem (id_remetente, criado_ts DESC);

-- O criterio escolhido, preservado como foi dito ("a startup Acme", "os
-- mentores", "a role Financeiro"). id_referencia aponta para tabelas
-- diferentes conforme o tipo, entao NAO tem FK: quem garante o vinculo e o
-- service, que confere se a referencia pertence ao mesmo tenant da mensagem.
CREATE TABLE IF NOT EXISTS mensagem_destino (
    id_destino BIGINT GENERATED ALWAYS AS IDENTITY,
    id_mensagem BIGINT NOT NULL,
    tipo mensagemDestinoTipo NOT NULL,
    id_referencia INTEGER,          -- id_startup, id_role ou id_usuario
    -- Rotulo congelado no envio: a startup pode ser renomeada e a role
    -- excluida, e a mensagem antiga continua dizendo para quem foi.
    rotulo VARCHAR(150),

    CONSTRAINT pk_mensagem_destino PRIMARY KEY (id_destino),
    CONSTRAINT fk_mensagem_destino_mensagem
        FOREIGN KEY (id_mensagem)
        REFERENCES mensagem (id_mensagem)
        ON DELETE CASCADE,
    CONSTRAINT ck_mensagem_destino_referencia CHECK (
        (tipo = 'TENANT'  AND id_referencia IS NULL)
        -- MENTORES aceita os dois: sem referencia sao os mentores da
        -- incubadora; com id_startup, so os que acompanham aquela startup.
        OR tipo = 'MENTORES'
        OR (tipo IN ('STARTUP', 'ROLE', 'USUARIO') AND id_referencia IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS ix_mensagem_destino_mensagem ON mensagem_destino (id_mensagem);

-- A entrega: uma linha por pessoa que recebeu, com o estado de leitura DELA.
CREATE TABLE IF NOT EXISTS mensagem_destinatario (
    id_mensagem BIGINT NOT NULL,
    id_usuario INTEGER NOT NULL,
    lida_ts TIMESTAMP,

    CONSTRAINT pk_mensagem_destinatario PRIMARY KEY (id_mensagem, id_usuario),
    CONSTRAINT fk_mensagem_dest_mensagem
        FOREIGN KEY (id_mensagem)
        REFERENCES mensagem (id_mensagem)
        ON DELETE CASCADE,
    CONSTRAINT fk_mensagem_dest_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuarios (id_usuario)
        ON DELETE CASCADE
);

-- O indice que o sino usa: "as nao lidas desta pessoa", a cada carga de tela.
CREATE INDEX IF NOT EXISTS ix_mensagem_destinatario_caixa
    ON mensagem_destinatario (id_usuario, lida_ts);

-- ---------------------------------------------------------------------------
-- GOOGLE AGENDA (migracao 013)
--
-- A conexao e por PESSOA, nao por incubadora: a conta Google e dela, e quem
-- participa de duas incubadoras quer as duas na mesma agenda. Quais eventos
-- vao continua sendo decidido na hora do envio, pela mesma regra da tela da
-- agenda (papel no tenant + startups a que a pessoa esta ligada).
--
-- Os tokens ficam cifrados (AES-256-GCM, backend/src/utils/cripto.js): o
-- refresh token nao expira, entao um dump do banco nao pode entrega-lo em
-- texto puro.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS google_conta (
    id_usuario INTEGER NOT NULL,

    -- `sub` do Google: identificador estavel da conta (o email pode mudar).
    google_sub VARCHAR(120) NOT NULL,
    google_email VARCHAR(255),

    -- Pacotes AES-256-GCM em base64 — nunca em texto puro.
    refresh_token TEXT NOT NULL,
    access_token TEXT,
    access_token_expira_ts TIMESTAMP,

    -- O que a pessoa REALMENTE concedeu (o Google deixa desmarcar escopo).
    escopos TEXT,

    -- Agenda secundaria "Quiron" criada na conta dela. Separada da principal
    -- de proposito: liga/desliga a camada inteira num clique, e desconectar
    -- apaga um calendario nosso em vez de garimpar eventos entre os pessoais.
    id_calendario VARCHAR(255),

    -- Pausa o envio sem revogar a autorizacao.
    sincronizar BOOLEAN NOT NULL DEFAULT TRUE,

    conectado_ts TIMESTAMP NOT NULL DEFAULT NOW(),
    ultimo_sync_ts TIMESTAMP,
    ultimo_erro TEXT,

    CONSTRAINT pk_google_conta PRIMARY KEY (id_usuario),

    CONSTRAINT fk_google_conta_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuarios (id_usuario)
        ON DELETE CASCADE
);

-- O espelho: um evento do Quiron vira N eventos no Google, um na agenda de
-- cada participante conectado. Por isso e tabela, e nao coluna em `evento`:
-- nao existe "o id do evento no Google", existe um por pessoa.
CREATE TABLE IF NOT EXISTS google_evento (
    id_evento INTEGER NOT NULL,
    id_usuario INTEGER NOT NULL,

    google_event_id VARCHAR(1024) NOT NULL,
    -- Repetido aqui (e nao so em google_conta) para as linhas antigas ainda
    -- saberem onde moravam depois de uma reconexao criar outro calendario.
    id_calendario VARCHAR(255) NOT NULL,

    enviado_ts TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_google_evento PRIMARY KEY (id_evento, id_usuario),

    CONSTRAINT fk_google_evento_evento
        FOREIGN KEY (id_evento)
        REFERENCES evento (id_evento)
        ON DELETE CASCADE,

    CONSTRAINT fk_google_evento_conta
        FOREIGN KEY (id_usuario)
        REFERENCES google_conta (id_usuario)
        ON DELETE CASCADE
);

-- "O que ja mandei para esta pessoa?" — a varredura da sincronizacao manual.
CREATE INDEX IF NOT EXISTS ix_google_evento_usuario
    ON google_evento (id_usuario, enviado_ts);


-- ===========================================================================
-- GESTAO DE TAREFAS DA INCUBADORA (migracao 014)
--
-- Tudo que o sistema registra nas tabelas acima e o trabalho da STARTUP: a
-- entrega que ela sobe, a avaliacao que recebe, o evento que frequenta. O
-- trabalho da propria INCUBADORA — cobrar um contrato, montar um edital,
-- revisar o material de uma fase — nao tinha onde morar e acabava em planilha.
--
-- E gestao INTERNA: quem entra e definido pelo RBAC (modulo `tarefas` do
-- catalogo de permissoes), nao pelo papel.
-- ===========================================================================

-- As COLUNAS DO QUADRO, vocabulario de cada incubadora. Mesmo desenho de
-- startup_situacao: chave estavel + rotulo editavel + uma CATEGORIA que diz o
-- que o status significa para o codigo. Sem a categoria, um status "Arquivada"
-- contaria como pendencia atrasada para sempre.
CREATE TABLE IF NOT EXISTS tarefa_status (
    id_tenant INTEGER         NOT NULL,
    chave     VARCHAR(40)     NOT NULL,
    rotulo    VARCHAR(60)     NOT NULL,
    cor       CHAR(7)         NOT NULL DEFAULT '#6366f1',
    categoria tarefaCategoria NOT NULL DEFAULT 'PENDENTE',
    ordem     SMALLINT        NOT NULL DEFAULT 0,
    ativo     BOOLEAN         NOT NULL DEFAULT TRUE,
    criado_ts TIMESTAMP       NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_tarefa_status PRIMARY KEY (id_tenant, chave),

    CONSTRAINT fk_tarefa_status_tenant
        FOREIGN KEY (id_tenant)
        REFERENCES tenant (id_tenant)
        ON DELETE CASCADE,

    CONSTRAINT ck_tarefa_status_cor CHECK (cor ~ '^#[0-9a-fA-F]{6}$')
);

-- Duas colunas com o mesmo nome no quadro nao dariam para distinguir.
CREATE UNIQUE INDEX IF NOT EXISTS uq_tarefa_status_rotulo
    ON tarefa_status (id_tenant, lower(rotulo));


-- CAMPOS PERSONALIZAVEIS da tarefa: a DEFINICAO (o valor vai no JSONB de cada
-- tarefa). Copia estrutural de startup_campo, e de proposito: sao o mesmo
-- recurso aplicado a outra entidade, e o backend valida os dois com o mesmo
-- codigo (backend/src/campos). Uma tabela unica com uma coluna "entidade" foi
-- descartada: a contagem de uso e os indices de unicidade sao por entidade, e a
-- tabela compartilhada trocaria duas definicoes claras por uma cheia de "se for
-- tarefa, entao...".
CREATE TABLE IF NOT EXISTS tarefa_campo (
    id_campo    INTEGER GENERATED ALWAYS AS IDENTITY,
    id_tenant   INTEGER      NOT NULL,
    -- Nome da propriedade dentro de tarefa.campos_extras. Imutavel: esta
    -- gravada no JSONB de cada tarefa, e troca-la orfanaria os valores.
    chave       VARCHAR(40)  NOT NULL,
    rotulo      VARCHAR(80)  NOT NULL,
    tipo        campoTipo    NOT NULL,
    descricao   VARCHAR(200),
    obrigatorio BOOLEAN      NOT NULL DEFAULT FALSE,
    ordem       SMALLINT     NOT NULL DEFAULT 0,
    ativo       BOOLEAN      NOT NULL DEFAULT TRUE,
    config      JSONB        NOT NULL DEFAULT '{}',
    criado_ts   TIMESTAMP    NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_tarefa_campo PRIMARY KEY (id_campo),

    CONSTRAINT fk_tarefa_campo_tenant
        FOREIGN KEY (id_tenant)
        REFERENCES tenant (id_tenant)
        ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tarefa_campo_chave
    ON tarefa_campo (id_tenant, chave);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tarefa_campo_rotulo
    ON tarefa_campo (id_tenant, lower(rotulo));


-- A TAREFA.
--
-- `ordem` e a posicao dentro da coluna do quadro, renumerada pelo repositorio a
-- cada arrasto (ver tarefaRepository.mover): no kanban, subir um cartao e uma
-- decisao de prioridade, nao um efeito colateral de ordenacao. Nao ha
-- unicidade nela de proposito — duas tarefas empatadas desempatam por
-- prioridade e prazo, e uma constraint faria o arrasto falhar no meio.
CREATE TABLE IF NOT EXISTS tarefa (
    id_tarefa      INTEGER GENERATED ALWAYS AS IDENTITY,
    id_tenant      INTEGER          NOT NULL,

    titulo         VARCHAR(160)     NOT NULL,
    descricao      TEXT,

    status         VARCHAR(40)      NOT NULL,
    prioridade     tarefaPrioridade NOT NULL DEFAULT 'MEDIA',

    -- QUEM FAZ. NULL e estado legitimo: a tarefa nasce sem dono e ganha um
    -- quando alguem a puxa. SET NULL ao remover a pessoa, e nao CASCADE — a
    -- tarefa continua existindo depois que o responsavel sai, e e justamente
    -- ela que precisa de um novo dono.
    id_responsavel INTEGER,

    -- SOBRE QUEM E. Opcional: "revisar o contrato da Acme" fala de uma startup;
    -- "montar o edital" nao fala de nenhuma.
    id_startup     INTEGER,

    -- DATE e nao TIMESTAMP: prazo de tarefa e um dia, e guardar hora faria
    -- "vence hoje" depender do fuso de quem consulta.
    prazo          DATE,

    ordem          INTEGER          NOT NULL DEFAULT 0,

    -- Preenchido pelo backend quando a tarefa entra num status de categoria
    -- CONCLUIDA, e limpo quando ela volta. Coluna, e nao "olhe o audit_log":
    -- e o dado que responde "o que a equipe fechou este mes" numa consulta so.
    concluida_ts   TIMESTAMP,

    -- Os VALORES dos campos personalizaveis, { "chave": valor }. A definicao
    -- de cada chave esta em tarefa_campo.
    campos_extras  JSONB            NOT NULL DEFAULT '{}',

    criado_por     INTEGER,
    criado_ts      TIMESTAMP        NOT NULL DEFAULT NOW(),
    atualizado_ts  TIMESTAMP        NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_tarefa PRIMARY KEY (id_tarefa),

    CONSTRAINT fk_tarefa_tenant
        FOREIGN KEY (id_tenant)
        REFERENCES tenant (id_tenant)
        ON DELETE CASCADE,

    -- COMPOSTA, como as de startup: sem o id_tenant, uma tarefa poderia
    -- apontar para a coluna de outra incubadora.
    CONSTRAINT fk_tarefa_status
        FOREIGN KEY (id_tenant, status)
        REFERENCES tarefa_status (id_tenant, chave)
        ON UPDATE CASCADE,

    CONSTRAINT fk_tarefa_responsavel
        FOREIGN KEY (id_responsavel)
        REFERENCES usuarios (id_usuario)
        ON DELETE SET NULL,

    CONSTRAINT fk_tarefa_startup
        FOREIGN KEY (id_startup)
        REFERENCES startup (id_startup)
        ON DELETE SET NULL,

    CONSTRAINT fk_tarefa_criado_por
        FOREIGN KEY (criado_por)
        REFERENCES usuarios (id_usuario)
        ON DELETE SET NULL
);

-- O quadro le sempre "as tarefas deste tenant, agrupadas por coluna, na ordem".
CREATE INDEX IF NOT EXISTS ix_tarefa_tenant_status
    ON tarefa (id_tenant, status, ordem);

-- "O que e meu" e a pergunta mais frequente depois do quadro inteiro.
CREATE INDEX IF NOT EXISTS ix_tarefa_responsavel
    ON tarefa (id_responsavel) WHERE id_responsavel IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_tarefa_startup
    ON tarefa (id_startup) WHERE id_startup IS NOT NULL;

-- Torna o JSONB pesquisavel sem varrer a tabela, como em startup.
CREATE INDEX IF NOT EXISTS ix_tarefa_campos_extras
    ON tarefa USING GIN (campos_extras);


-- Anexos de uma tarefa (migracao 015).
--
-- TABELA DE LIGACAO, e nao uma coluna `anexos` na tarefa. `evento.anexos` e
-- `entrega.anexos` sao JSONB/TEXT[] por razoes historicas, e a migracao 007
-- registra o preco: linhas antigas em tres formatos, nenhuma apontando para
-- arquivo que exista. Aqui a referencia e FK de verdade, o que garante que o
-- anexo listado existe, que desanexar nao reescreve documento nenhum e —
-- principal — que da para responder "esta tarefa pode ver este arquivo?" numa
-- consulta. E o que a rota de download pergunta: `arquivoService.abrir`
-- autoriza PRIVADO por dono-ou-chave-de-entregas, regra que nao serve para
-- tarefa, onde quem abre o anexo e quem enxerga a tarefa.
--
-- Desanexar NAO apaga o arquivo: a linha aqui e so o vinculo, e o mesmo arquivo
-- pode estar anexado em outro lugar.
CREATE TABLE IF NOT EXISTS tarefa_anexo (
    id_tarefa   INTEGER   NOT NULL,
    id_arquivo  UUID      NOT NULL,
    -- Quem anexou. Distinto de `arquivo.enviado_por`: um arquivo ja enviado
    -- pode ser anexado a uma tarefa por outra pessoa.
    anexado_por INTEGER,
    criado_ts   TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_tarefa_anexo PRIMARY KEY (id_tarefa, id_arquivo),

    CONSTRAINT fk_tarefa_anexo_tarefa
        FOREIGN KEY (id_tarefa)
        REFERENCES tarefa (id_tarefa)
        ON DELETE CASCADE,

    CONSTRAINT fk_tarefa_anexo_arquivo
        FOREIGN KEY (id_arquivo)
        REFERENCES arquivo (id_arquivo)
        ON DELETE CASCADE,

    CONSTRAINT fk_tarefa_anexo_usuario
        FOREIGN KEY (anexado_por)
        REFERENCES usuarios (id_usuario)
        ON DELETE SET NULL
);

-- A PK ja atende "os anexos desta tarefa". Este indice atende a outra direcao:
-- "este arquivo esta anexado em alguma tarefa?", que e a pergunta da
-- autorizacao de download.
CREATE INDEX IF NOT EXISTS ix_tarefa_anexo_arquivo ON tarefa_anexo (id_arquivo);
