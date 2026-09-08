-- ===========================================================================
-- 017 — Engajamento: pontos, temporadas, niveis e selos
--
-- CONTEXTO
-- A coordenacao quer estimular RELACIONAMENTO COM A INNE, PARTICIPACAO e
-- PROTAGONISMO — e foi explicita sobre o que isso NAO pode virar: uma fazenda
-- de pontos em cima do trabalho empreendedor.
--
-- A REGRA DE OURO DESTE MODULO — DUAS MOEDAS QUE NUNCA SE CONVERTEM
--
--   PONTO  mede PARTICIPACAO (esteve, compareceu, se relacionou). Nasce de fato
--          registrado por OUTRA pessoa, alimenta ranking, nivel e a premiacao
--          semestral.
--   SELO   mede EVOLUCAO e PROTAGONISMO. Nasce de julgamento humano da
--          coordenacao, vale reconhecimento publico (credencial + LinkedIn) e
--          **VALE ZERO PONTO, SEMPRE**.
--
-- O QUE NAO PONTUA, POR DECISAO DA COORDENACAO: experimento, entrevista,
-- validacao de hipotese, pivotagem por evidencia, conclusao de momento
-- formativo, aplicacao de orientacao, ajudar outro empreendedor, compartilhar
-- conhecimento e publicar conteudo sobre a experiencia. Isso e EVIDENCIA DE
-- EVOLUCAO, e o lugar disso e o SELO.
--
-- Por isso o selo nao tem coluna de pontos, e nao existe caminho no codigo que
-- transforme um no outro. Se um dia alguem acrescentar "selo X vale N pontos",
-- a lista vetada acima volta pela porta dos fundos: bastaria criar o selo
-- "Fez um experimento" para o ranking passar a premiar exatamente o que a
-- coordenacao decidiu nao premiar.
--
-- PONTO SO NASCE DE FATO VERIFICADO POR TERCEIRO. Nao existe "declarei que
-- participei": presenca e o CHECK-IN marcado pelo admin (`evento_presenca`),
-- nao o RSVP (`evento_confirmacao`); mentoria realizada e evento com mentor
-- dono e ao menos um presente; coworking e indicacao sao lancamento da
-- coordenacao, com estorno.
--
-- DUAS LIGAS QUE NAO SE MISTURAM: mentor disputa com mentor, incubado com
-- incubado. Volumes e naturezas de participacao diferentes num placar so
-- fariam um dos dois grupos nunca ganhar.
--
-- O ADMIN NAO PONTUA. A coordenacao nao disputa premio com quem ela avalia, e
-- e ela quem marca a presenca que vira ponto.
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. ENUMS
--
-- Fechados porque HA CODIGO ATRAS de cada valor: a liga escolhe o placar e a
-- escada de niveis, o gatilho escolhe QUAL funcao do motor grava o ponto, e o
-- periodo escolhe a janela do teto. Um valor desconhecido nao viraria
-- pontuacao nenhuma, viraria ponto perdido em silencio.
-- ---------------------------------------------------------------------------
DO $bloco$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'engajamentoliga') THEN
        CREATE TYPE engajamentoLiga AS ENUM ('INCUBADO', 'MENTOR');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'engajamentogatilho') THEN
        CREATE TYPE engajamentoGatilho AS ENUM ('PRESENCA_EVENTO', 'MENTORIA_MINISTRADA', 'MANUAL');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'engajamentoperiodo') THEN
        CREATE TYPE engajamentoPeriodo AS ENUM ('MES', 'TEMPORADA');
    END IF;
END
$bloco$;


-- ---------------------------------------------------------------------------
-- 2. TEMPORADA — o semestre que se disputa.
--
-- Ranking e nivel sao SEMPRE dentro de uma temporada. O total historico
-- continua no extrato da pessoa, mas nao disputa: sem zerar, quem entrou no
-- programa ha dois anos seria intocavel e o incubado novo nao teria por que
-- tentar.
--
-- SEM EXCLUSION CONSTRAINT de sobreposicao (que exigiria a extensao
-- btree_gist, e portanto superusuario no deploy): quem barra duas temporadas
-- sobrepostas e o service, que tambem e quem consegue dizer COM QUAL delas o
-- periodo colide. A data do fato tem que cair numa temporada so — e disso que
-- depende o `id_temporada` do ponto.
--
-- `premiacao` e texto livre de proposito: "viagem para o South Summit",
-- "imersao de 3 dias", "a definir" — a viabilidade institucional muda a cada
-- semestre, e um cadastro estruturado de premio seria um formulario que
-- ninguem preencheria duas vezes igual.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS engajamento_temporada (
    id_temporada INTEGER GENERATED ALWAYS AS IDENTITY,
    id_tenant    INTEGER     NOT NULL,

    nome         VARCHAR(80) NOT NULL,   -- "2026.2", "Ciclo Verao"
    inicio_dt    DATE        NOT NULL,
    fim_dt       DATE        NOT NULL,

    premiacao    TEXT,
    -- Encerrada = fechada para novos pontos e com o resultado congelado. Nao e
    -- o mesmo que "acabou a data": a coordenacao ainda pode lancar no dia
    -- seguinte a participacao da ultima semana.
    encerrada    BOOLEAN     NOT NULL DEFAULT FALSE,
    criado_ts    TIMESTAMP   NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_engajamento_temporada PRIMARY KEY (id_temporada),

    CONSTRAINT fk_engajamento_temporada_tenant
        FOREIGN KEY (id_tenant) REFERENCES tenant (id_tenant) ON DELETE CASCADE,

    CONSTRAINT ck_engajamento_temporada_periodo CHECK (fim_dt >= inicio_dt)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_engajamento_temporada_nome
    ON engajamento_temporada (id_tenant, lower(nome));
CREATE INDEX IF NOT EXISTS ix_engajamento_temporada_periodo
    ON engajamento_temporada (id_tenant, inicio_dt, fim_dt);


-- ---------------------------------------------------------------------------
-- 3. ACAO — o catalogo do que pontua, POR INCUBADORA.
--
-- Mesmo desenho de tarefa_status e evento_categoria: e vocabulario da
-- incubadora, nao enum. Cada uma decide o que vale e quanto vale, e a lista
-- cresce sem migracao ("Programa de embaixadores", "Plantao de duvidas").
--
-- POR QUE A PRESENCA PONTUA PELA CATEGORIA DO EVENTO
-- A agenda ja tem `evento_categoria` por tenant (migracao 008) — Mentoria,
-- Workshop, Pitch. Criar aqui uma segunda lista de "tipos de participacao"
-- seria manter dois vocabularios dizendo a mesma coisa, que divergiriam no
-- primeiro evento novo. Entao a acao de presenca APONTA para a categoria.
--
-- CATEGORIA SEM LINHA AQUI VALE ZERO. O opt-in e explicito: "Prazo" e
-- "Entrega" sao marcos da trilha, nao participacao, e nada pontua por
-- acidente so porque virou evento no calendario.
--
-- OS DOIS INDICES PARCIAIS UNICOS ABAIXO SAO O QUE TORNA O MOTOR
-- DETERMINISTICO: "qual acao pontua esta presenca?" precisa ter UMA resposta.
-- Duas acoes na mesma categoria fariam a mesma presenca valer dois pontos
-- diferentes dependendo da ordem da consulta.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS engajamento_acao (
    id_tenant        INTEGER            NOT NULL,
    chave            VARCHAR(40)        NOT NULL,
    rotulo           VARCHAR(60)        NOT NULL,
    descricao        VARCHAR(200),

    gatilho          engajamentoGatilho NOT NULL DEFAULT 'MANUAL',
    -- So para gatilho PRESENCA_EVENTO. FK COMPOSTA com id_tenant, senao uma
    -- incubadora pontuaria pela categoria de outra.
    categoria_evento VARCHAR(40),
    -- NULL = vale para as duas ligas (um mentor que assiste ao workshop
    -- participou tanto quanto o incubado que assistiu). Preenchida, restringe.
    liga             engajamentoLiga,

    pontos           SMALLINT           NOT NULL DEFAULT 0,

    -- O TETO e o que impede a acao repetivel de virar fazenda: coworking a 3
    -- pontos sem teto premiaria quem mora no predio, nao quem se relaciona com
    -- a incubadora. Os dois campos andam juntos — teto sem periodo nao diz
    -- nada.
    teto_pontos      SMALLINT,
    teto_periodo     engajamentoPeriodo,

    icone            VARCHAR(40)        NOT NULL DEFAULT 'EmojiEvents',
    cor              CHAR(7)            NOT NULL DEFAULT '#6366f1',
    ordem            SMALLINT           NOT NULL DEFAULT 0,
    ativo            BOOLEAN            NOT NULL DEFAULT TRUE,
    criado_ts        TIMESTAMP          NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_engajamento_acao PRIMARY KEY (id_tenant, chave),

    CONSTRAINT fk_engajamento_acao_tenant
        FOREIGN KEY (id_tenant) REFERENCES tenant (id_tenant) ON DELETE CASCADE,

    CONSTRAINT fk_engajamento_acao_categoria
        FOREIGN KEY (id_tenant, categoria_evento)
        REFERENCES evento_categoria (id_tenant, chave)
        ON DELETE CASCADE,

    -- Teto de 1000 pela mesma razao do teto de horas do mentor: nao existe
    -- participacao unica que valha mais que isso, e o limite so barra digito
    -- trocado (o "10" que vira "100").
    CONSTRAINT ck_engajamento_acao_pontos
        CHECK (pontos >= 0 AND pontos <= 1000),

    -- Os dois ou nenhum.
    CONSTRAINT ck_engajamento_acao_teto
        CHECK ((teto_pontos IS NULL) = (teto_periodo IS NULL)
               AND (teto_pontos IS NULL OR teto_pontos > 0)),

    -- Presenca precisa saber de QUE categoria; manual e mentoria nao tem
    -- categoria nenhuma (a mentoria pontua o dono do evento, seja qual for).
    CONSTRAINT ck_engajamento_acao_categoria_coerente
        CHECK ((gatilho = 'PRESENCA_EVENTO') = (categoria_evento IS NOT NULL)),

    CONSTRAINT ck_engajamento_acao_cor CHECK (cor ~ '^#[0-9a-fA-F]{6}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_engajamento_acao_rotulo
    ON engajamento_acao (id_tenant, lower(rotulo));

-- Uma categoria de evento pontua por UMA acao so.
CREATE UNIQUE INDEX IF NOT EXISTS uq_engajamento_acao_categoria
    ON engajamento_acao (id_tenant, categoria_evento)
    WHERE categoria_evento IS NOT NULL;

-- E o mentor recebe por UMA acao so quando a mentoria acontece.
CREATE UNIQUE INDEX IF NOT EXISTS uq_engajamento_acao_mentoria
    ON engajamento_acao (id_tenant)
    WHERE gatilho = 'MENTORIA_MINISTRADA';


-- ---------------------------------------------------------------------------
-- 4. NIVEL — a escada de cada liga.
--
-- POR LIGA porque os volumes sao diferentes: o mentor aparece em menos
-- atividades que o incubado, e uma escada unica deixaria a liga dos mentores
-- inteira parada no primeiro degrau.
--
-- A coordenacao pediu premiacao "preferencialmente por niveis/ranking", e sao
-- coisas complementares: o RANKING e relativo (so um e o primeiro, e quem esta
-- em 14o desiste), o NIVEL e absoluto (todo mundo pode chegar a Embaixador).
-- O nivel e o que mantem no jogo quem nunca vai ganhar a viagem.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS engajamento_nivel (
    id_tenant  INTEGER         NOT NULL,
    liga       engajamentoLiga NOT NULL,
    ordem      SMALLINT        NOT NULL,
    nome       VARCHAR(60)     NOT NULL,
    -- Pontos NA TEMPORADA para alcancar o degrau. O primeiro nivel e sempre 0.
    pontos_min INTEGER         NOT NULL,
    cor        CHAR(7)         NOT NULL DEFAULT '#6366f1',
    icone      VARCHAR(40)     NOT NULL DEFAULT 'EmojiEvents',

    CONSTRAINT pk_engajamento_nivel PRIMARY KEY (id_tenant, liga, ordem),

    CONSTRAINT fk_engajamento_nivel_tenant
        FOREIGN KEY (id_tenant) REFERENCES tenant (id_tenant) ON DELETE CASCADE,

    CONSTRAINT ck_engajamento_nivel_pontos CHECK (pontos_min >= 0),
    CONSTRAINT ck_engajamento_nivel_cor CHECK (cor ~ '^#[0-9a-fA-F]{6}$')
);

-- Dois degraus no mesmo ponto de corte nao dariam para desempatar.
CREATE UNIQUE INDEX IF NOT EXISTS uq_engajamento_nivel_corte
    ON engajamento_nivel (id_tenant, liga, pontos_min);


-- ---------------------------------------------------------------------------
-- 5. PONTO — o extrato, uma linha por fato.
--
-- Nao ha coluna de "saldo" em lugar nenhum: o total e sempre SUM() desta
-- tabela. Saldo materializado precisaria ser corrigido a cada estorno, a cada
-- presenca desmarcada e a cada mudanca de pontuacao — e a primeira divergencia
-- entre saldo e extrato transformaria o ranking em algo que ninguem consegue
-- explicar para quem perdeu.
--
-- IDEMPOTENCIA (uq_engajamento_ponto_origem): a chave natural do ponto e
-- (quem, por que acao, por causa de qual fato). Marcar a mesma presenca duas
-- vezes nao pontua duas vezes; desmarcar apaga a linha. Sem isso, cada
-- correcao de lista de chamada inflaria o ranking.
--
-- MANUAL fica FORA do indice unico de proposito: dois lancamentos iguais no
-- mesmo dia sao legitimos (a pessoa usou o coworking de manha e a tarde). O
-- controle la e o teto e o estorno.
--
-- `liga` e SNAPSHOT do momento do fato: um incubado que vira mentor no meio do
-- semestre nao leva o passado para a liga nova, nem o perde.
--
-- `ocorrido_dt` e a data do FATO, nao do registro. E ela que escolhe a
-- temporada — marcar hoje a presenca de um evento do mes passado tem que
-- pontuar no mes passado.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS engajamento_ponto (
    id_ponto          BIGINT          GENERATED ALWAYS AS IDENTITY,
    id_tenant         INTEGER         NOT NULL,
    -- NULL = fato fora de qualquer temporada cadastrada. Fica no historico e
    -- no extrato, mas nao disputa nada.
    id_temporada      INTEGER,
    id_usuario        INTEGER         NOT NULL,
    liga              engajamentoLiga NOT NULL,
    chave_acao        VARCHAR(40)     NOT NULL,

    pontos            SMALLINT        NOT NULL,
    -- TRUE quando o teto zerou (ou cortou) este lancamento. A linha continua
    -- existindo com o valor que sobrou: "voce esteve la, mas o teto do mes ja
    -- foi atingido" e uma resposta; a participacao sumir do extrato nao e.
    limitado_por_teto BOOLEAN         NOT NULL DEFAULT FALSE,

    origem_tipo       VARCHAR(10)     NOT NULL,  -- EVENTO | MANUAL
    origem_id         INTEGER,                   -- id_evento, quando EVENTO

    lancado_por       INTEGER,                   -- quem lancou (MANUAL)
    observacao        VARCHAR(300),
    ocorrido_dt       DATE            NOT NULL,
    criado_ts         TIMESTAMP       NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_engajamento_ponto PRIMARY KEY (id_ponto),

    CONSTRAINT fk_engajamento_ponto_tenant
        FOREIGN KEY (id_tenant) REFERENCES tenant (id_tenant) ON DELETE CASCADE,

    -- SET NULL: apagar uma temporada nao pode apagar o historico de
    -- participacao de ninguem — o fato aconteceu.
    CONSTRAINT fk_engajamento_ponto_temporada
        FOREIGN KEY (id_temporada)
        REFERENCES engajamento_temporada (id_temporada) ON DELETE SET NULL,

    CONSTRAINT fk_engajamento_ponto_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario) ON DELETE CASCADE,

    -- Impede apagar uma acao que ja pontuou alguem: a tela so DESATIVA
    -- (ativo = FALSE), como em tarefa_status, e o extrato continua legivel.
    CONSTRAINT fk_engajamento_ponto_acao
        FOREIGN KEY (id_tenant, chave_acao)
        REFERENCES engajamento_acao (id_tenant, chave),

    CONSTRAINT fk_engajamento_ponto_lancador
        FOREIGN KEY (lancado_por) REFERENCES usuarios (id_usuario) ON DELETE SET NULL,

    CONSTRAINT ck_engajamento_ponto_pontos CHECK (pontos >= 0),
    CONSTRAINT ck_engajamento_ponto_origem
        CHECK (origem_tipo IN ('EVENTO', 'MANUAL')
               AND (origem_tipo = 'MANUAL') = (origem_id IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_engajamento_ponto_origem
    ON engajamento_ponto (id_tenant, id_usuario, chave_acao, origem_tipo, origem_id)
    WHERE origem_tipo <> 'MANUAL';

-- O ranking le sempre "pontos desta temporada, desta liga, deste tenant".
CREATE INDEX IF NOT EXISTS ix_engajamento_ponto_ranking
    ON engajamento_ponto (id_tenant, id_temporada, liga);
-- O extrato le sempre "os lancamentos DESTA pessoa, do mais novo ao mais velho".
CREATE INDEX IF NOT EXISTS ix_engajamento_ponto_extrato
    ON engajamento_ponto (id_usuario, id_tenant, ocorrido_dt DESC);


-- ---------------------------------------------------------------------------
-- 6. SELO — o reconhecimento que cada incubadora inventa.
--
-- NAO TEM COLUNA DE PONTOS, e isso e a regra de ouro deste modulo, nao um
-- esquecimento. Ver o cabecalho.
--
-- `criterio` e o que aparece na credencial publica, e e o que faz o selo valer
-- alguma coisa fora daqui: um distintivo sem criterio escrito e enfeite; com
-- criterio, e uma declaracao verificavel de que a incubadora reconheceu
-- aquilo naquela pessoa.
--
-- `categoria` e TEXTO LIVRE, e nao enum nem tabela de vocabulario, pela mesma
-- razao de mentor_perfil.especialidades: nao ha codigo atras do valor, e so
-- agrupamento do mural. O front sugere as que ja estao em uso.
--
-- `imagem_url` em vez de FK para `arquivo`: e o mesmo desenho de tenant.logo e
-- usuarios.foto_url, e a imagem do selo precisa sair SEM token (regime PUBLICO
-- do arquivoService) para aparecer na credencial de quem nem tem login.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS selo (
    id_selo         INTEGER      GENERATED ALWAYS AS IDENTITY,
    id_tenant       INTEGER      NOT NULL,

    nome            VARCHAR(80)  NOT NULL,
    descricao       VARCHAR(300),
    criterio        TEXT,
    categoria       VARCHAR(40),

    cor             CHAR(7)      NOT NULL DEFAULT '#7c3aed',
    icone           VARCHAR(40)  NOT NULL DEFAULT 'MilitaryTech',
    imagem_url      TEXT,

    -- Alguns selos sao unicos na vida ("Primeira mentoria"), outros se repetem
    -- ("Destaque do mes"). Quem barra a repeticao e o service, que sabe ler
    -- esta coluna; um indice unico nao consegue (a condicao mora em outra
    -- tabela).
    permite_repetir BOOLEAN      NOT NULL DEFAULT FALSE,

    ativo           BOOLEAN      NOT NULL DEFAULT TRUE,
    criado_por      INTEGER,
    criado_ts       TIMESTAMP    NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_selo PRIMARY KEY (id_selo),

    CONSTRAINT fk_selo_tenant
        FOREIGN KEY (id_tenant) REFERENCES tenant (id_tenant) ON DELETE CASCADE,

    CONSTRAINT fk_selo_criador
        FOREIGN KEY (criado_por) REFERENCES usuarios (id_usuario) ON DELETE SET NULL,

    CONSTRAINT ck_selo_cor CHECK (cor ~ '^#[0-9a-fA-F]{6}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_selo_nome
    ON selo (id_tenant, lower(nome));


-- ---------------------------------------------------------------------------
-- 7. CONCESSAO — "fulano recebeu este selo, por isto, nesta data".
--
-- `publico` NASCE FALSE, e essa e uma decisao de privacidade, nao de UX: a
-- credencial e uma pagina ABERTA com o nome da pessoa, e quem decide expor o
-- proprio nome e ela, nao a coordenacao que concedeu.
--
-- `codigo` e ALEATORIO (crypto.randomBytes no service), nao sequencial: id
-- incremental na URL deixaria qualquer um varrer as credenciais de toda a
-- incubadora trocando um numero.
--
-- REVOGACAO E ESTADO, NAO DELETE. Um selo concedido por engano precisa poder
-- ser desfeito COM MOTIVO — e a credencial que ja circula no LinkedIn passa a
-- dizer "revogada" em vez de simplesmente sumir, que e o que da credibilidade
-- ao selo de todo mundo.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS selo_concessao (
    id_concessao     INTEGER      GENERATED ALWAYS AS IDENTITY,
    id_tenant        INTEGER      NOT NULL,
    id_selo          INTEGER      NOT NULL,
    id_usuario       INTEGER      NOT NULL,
    -- A startup de contexto, quando faz sentido ("pela virada da Acme").
    -- Opcional: mentor nao tem startup, e nem todo selo e sobre uma.
    id_startup       INTEGER,

    justificativa    VARCHAR(500),
    evidencia_url    VARCHAR(400),

    codigo           VARCHAR(24)  NOT NULL,
    publico          BOOLEAN      NOT NULL DEFAULT FALSE,

    concedido_por    INTEGER,
    concedido_ts     TIMESTAMP    NOT NULL DEFAULT NOW(),
    revogado_ts      TIMESTAMP,
    revogado_por     INTEGER,
    motivo_revogacao VARCHAR(300),

    CONSTRAINT pk_selo_concessao PRIMARY KEY (id_concessao),

    CONSTRAINT fk_selo_concessao_tenant
        FOREIGN KEY (id_tenant) REFERENCES tenant (id_tenant) ON DELETE CASCADE,

    -- SEM CASCADE: um selo que ja foi concedido nao pode ser apagado por
    -- engano levando junto a credencial que alguem publicou. A tela desativa;
    -- excluir so vale para selo que nunca saiu (o service devolve 409).
    CONSTRAINT fk_selo_concessao_selo
        FOREIGN KEY (id_selo) REFERENCES selo (id_selo) ON DELETE RESTRICT,

    CONSTRAINT fk_selo_concessao_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario) ON DELETE CASCADE,

    CONSTRAINT fk_selo_concessao_startup
        FOREIGN KEY (id_startup) REFERENCES startup (id_startup) ON DELETE SET NULL,

    CONSTRAINT fk_selo_concessao_concedente
        FOREIGN KEY (concedido_por) REFERENCES usuarios (id_usuario) ON DELETE SET NULL,

    CONSTRAINT fk_selo_concessao_revogador
        FOREIGN KEY (revogado_por) REFERENCES usuarios (id_usuario) ON DELETE SET NULL,

    CONSTRAINT uk_selo_concessao_codigo UNIQUE (codigo),

    -- Revogar exige carimbo E autor: "revogada por ninguem" nao se sustenta
    -- numa credencial publica.
    CONSTRAINT ck_selo_concessao_revogacao
        CHECK ((revogado_ts IS NULL) = (revogado_por IS NULL))
);

CREATE INDEX IF NOT EXISTS ix_selo_concessao_usuario
    ON selo_concessao (id_usuario, id_tenant, concedido_ts DESC);
CREATE INDEX IF NOT EXISTS ix_selo_concessao_selo
    ON selo_concessao (id_selo);


-- ---------------------------------------------------------------------------
-- 8. O ID DA INCUBADORA NO LINKEDIN.
--
-- Opcional. Com ele, o botao "Adicionar ao perfil" da credencial liga a
-- certificacao a PAGINA REAL da incubadora no LinkedIn (organizationId); sem
-- ele, o LinkedIn so escreve o nome como texto e a certificacao fica solta.
-- ---------------------------------------------------------------------------
ALTER TABLE tenant ADD COLUMN IF NOT EXISTS linkedin_org_id VARCHAR(20);


-- ---------------------------------------------------------------------------
-- 9. SEMEADURA DOS TENANTS QUE JA EXISTEM
--
-- Espelha backend/src/engajamento/padroes.js, que e a FONTE CANONICA (o mesmo
-- arranjo de tarefas/padroes.js e da migracao 014). Mexeu la, veja aqui.
-- ---------------------------------------------------------------------------

-- 9.1 A temporada do semestre corrente.
INSERT INTO engajamento_temporada (id_tenant, nome, inicio_dt, fim_dt)
SELECT t.id_tenant,
       EXTRACT(YEAR FROM CURRENT_DATE)::TEXT
         || CASE WHEN EXTRACT(MONTH FROM CURRENT_DATE) <= 6 THEN '.1' ELSE '.2' END,
       make_date(EXTRACT(YEAR FROM CURRENT_DATE)::INT,
                 CASE WHEN EXTRACT(MONTH FROM CURRENT_DATE) <= 6 THEN 1 ELSE 7 END, 1),
       CASE WHEN EXTRACT(MONTH FROM CURRENT_DATE) <= 6
            THEN make_date(EXTRACT(YEAR FROM CURRENT_DATE)::INT, 6, 30)
            ELSE make_date(EXTRACT(YEAR FROM CURRENT_DATE)::INT, 12, 31) END
  FROM tenant t
ON CONFLICT DO NOTHING;

-- 9.2 Acoes de PRESENCA, uma por categoria de agenda que faz sentido pontuar.
--
--     O JOIN com evento_categoria e o que faz a semeadura se adaptar a quem ja
--     renomeou ou desativou categoria: quem nao tem "PITCH" simplesmente nao
--     ganha a acao, e a FK nunca quebra. "ENTREGA" e "PRAZO" ficam de fora de
--     proposito — sao marcos da trilha, nao participacao.
INSERT INTO engajamento_acao
    (id_tenant, chave, rotulo, descricao, gatilho, categoria_evento, pontos, icone, cor, ordem)
SELECT c.id_tenant,
       'PRESENCA_' || c.chave,
       'Presença em ' || c.rotulo,
       'Pontua quem teve presença confirmada em atividades da categoria "' || c.rotulo || '".',
       'PRESENCA_EVENTO'::engajamentoGatilho,
       c.chave,
       v.pontos,
       c.icone,
       c.cor,
       v.ordem
  FROM evento_categoria c
  JOIN (VALUES
      ('MENTORIA', 15::SMALLINT, 1::SMALLINT),
      ('WORKSHOP', 10, 2),
      ('PITCH',    12, 3),
      ('EVENTO',    8, 4),
      ('REUNIAO',   5, 5),
      ('VISITA',    5, 6)
  ) AS v(cat, pontos, ordem) ON v.cat = c.chave
ON CONFLICT DO NOTHING;

-- 9.3 A acao do MENTOR: ministrar a mentoria (o outro lado da 9.2).
INSERT INTO engajamento_acao
    (id_tenant, chave, rotulo, descricao, gatilho, liga, pontos, icone, cor, ordem)
SELECT t.id_tenant,
       'MENTORIA_REALIZADA',
       'Mentoria realizada',
       'Pontua o mentor responsável por uma atividade que teve ao menos um participante presente.',
       'MENTORIA_MINISTRADA'::engajamentoGatilho,
       'MENTOR'::engajamentoLiga,
       15::SMALLINT,
       'SupervisorAccount',
       '#6366f1'::CHAR(7),
       10::SMALLINT
  FROM tenant t
ON CONFLICT DO NOTHING;

-- 9.4 Acoes MANUAIS — o que a coordenacao registra a mao porque o sistema nao
--     tem como saber sozinho. E aqui que entram coworking e indicacao, que a
--     coordenacao pediu e que nao existem como modulo.
INSERT INTO engajamento_acao
    (id_tenant, chave, rotulo, descricao, gatilho, pontos, teto_pontos, teto_periodo, icone, cor, ordem)
SELECT t.id_tenant, v.chave, v.rotulo, v.descricao, 'MANUAL'::engajamentoGatilho,
       v.pontos, v.teto_pontos, v.teto_periodo, v.icone, v.cor, v.ordem
  FROM tenant t
  CROSS JOIN (VALUES
      ('ACAO_INNE',  'Ação da INNE',
       'Participação em ação institucional da incubadora (feira, comitiva, representação).',
       20::SMALLINT, NULL::SMALLINT, NULL::engajamentoPeriodo, 'Campaign',  '#8b5cf6'::CHAR(7), 20::SMALLINT),
      ('COWORKING',  'Uso do coworking',
       'Presença no espaço de coworking. Tem teto mensal: o espaço é para trabalhar, não para pontuar.',
       3, 30::SMALLINT, 'MES'::engajamentoPeriodo, 'Weekend',  '#0ea5e9', 21),
      ('INDICACAO',  'Indicação',
       'Indicou uma startup, um mentor ou um parceiro que chegou até a incubadora.',
       25, NULL, NULL, 'Handshake', '#10b981', 22)
  ) AS v(chave, rotulo, descricao, pontos, teto_pontos, teto_periodo, icone, cor, ordem)
ON CONFLICT DO NOTHING;

-- 9.5 As duas escadas de nivel.
--
--     Os nomes descrevem COMPORTAMENTO ("Presente", "Protagonista"), e nao
--     fantasia ("Bronze", "Prata"): o nivel aparece no perfil e e o que a
--     pessoa repete quando fala de si — "sou Embaixador INNE" diz alguma
--     coisa, "sou Ouro" nao diz nada para quem esta de fora.
INSERT INTO engajamento_nivel (id_tenant, liga, ordem, nome, pontos_min, cor, icone)
SELECT t.id_tenant, v.liga, v.ordem, v.nome, v.pontos_min, v.cor, v.icone
  FROM tenant t
  CROSS JOIN (VALUES
      ('INCUBADO'::engajamentoLiga, 1::SMALLINT, 'Conectado',      0,    '#94a3b8'::CHAR(7), 'Link'),
      ('INCUBADO', 2, 'Presente',       100,  '#0ea5e9', 'HowToReg'),
      ('INCUBADO', 3, 'Engajado',       250,  '#6366f1', 'LocalFireDepartment'),
      ('INCUBADO', 4, 'Protagonista',   500,  '#8b5cf6', 'WorkspacePremium'),
      ('INCUBADO', 5, 'Embaixador INNE',1000, '#f59e0b', 'EmojiEvents'),
      ('MENTOR',   1, 'Conectado',      0,    '#94a3b8', 'Link'),
      ('MENTOR',   2, 'Presente',       80,   '#0ea5e9', 'HowToReg'),
      ('MENTOR',   3, 'Atuante',        200,  '#6366f1', 'LocalFireDepartment'),
      ('MENTOR',   4, 'Referência',     400,  '#8b5cf6', 'WorkspacePremium'),
      ('MENTOR',   5, 'Embaixador INNE',800,  '#f59e0b', 'EmojiEvents')
  ) AS v(liga, ordem, nome, pontos_min, cor, icone)
ON CONFLICT DO NOTHING;

COMMIT;
