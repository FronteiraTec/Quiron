-- ===========================================================================
-- 016 — O mentor ganha cadastro, e a mentoria ganha dono
--
-- CONTEXTO
-- "Mentor" nunca foi uma entidade: e o papel 'mentor' em tenant_usuarios, e a
-- tela /mentores existia para UMA decisao — quais startups cada um acompanha.
-- Isso deixou a coordenacao sem resposta para as perguntas que ela realmente
-- faz antes de distribuir uma startup: de onde esse mentor vem, do que ele
-- entende, que tipo de demanda ele topa atender, quanto tempo tem no mes,
-- atende presencial ou online, e ha quanto tempo ele nao aparece.
--
-- O QUE MUDA
--   1. `mentor_perfil` — o cadastro, POR TENANT. A mesma pessoa pode mentorar
--      em duas incubadoras com disponibilidade e status diferentes em cada uma;
--      guardar isso em `usuarios` misturaria as duas.
--   2. `evento.id_usuario_mentor` — o responsavel pela atividade deixa de ser
--      so um nome digitado e passa a apontar para o usuario. E dai que saem as
--      duas colunas de historico da tela ("ultima mentoria" e "mentorias no
--      periodo"): sem o vinculo, "Ana Souza" e "ana souza" seriam dois mentores
--      diferentes e nenhuma contagem fecharia.
--
-- POR QUE O PERFIL E OPCIONAL (LEFT JOIN, e nao uma linha por mentor)
-- Criar linha vazia para todo mundo obrigaria a criar tambem no dia em que
-- alguem vira mentor em /usuarios — dois lugares gravando a mesma coisa, e um
-- deles esquecido mais cedo ou mais tarde. A listagem faz LEFT JOIN e aplica os
-- padroes (ATIVO / HIBRIDO); a linha nasce no primeiro salvamento.
--
-- POR QUE ESPECIALIDADES E DEMANDAS SAO TEXT[], E NAO TABELA DE VOCABULARIO
-- Diferente de startup_tipo/startup_situacao, aqui NAO HA CODIGO ATRAS do
-- valor: ninguem deriva estado do sistema de "Growth" ou "Juridico" — sao
-- rotulos para achar gente. Uma tabela por tenant custaria tela de
-- configuracao, CRUD e FK para entregar o mesmo filtro que o array entrega com
-- indice GIN, e obrigaria a coordenacao a cadastrar antes de conseguir
-- escrever. O front sugere o que ja existe na incubadora (autocomplete sobre os
-- valores em uso), que e o que faz o vocabulario convergir na pratica.
--
-- POR QUE `situacao` NAO E `tenant_usuarios.ativo`
-- Sao perguntas diferentes: `ativo` diz se a pessoa tem acesso a incubadora,
-- `situacao` diz o que a COORDENACAO sabe sobre ela — "indisponivel neste
-- semestre" nao pode tirar o acesso de ninguem, e desligar o acesso nao e
-- assunto desta tela (e de /usuarios). Manter os dois separados evita que um
-- filtro de listagem vire, sem querer, um botao de revogar login.
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. ENUMS — listas fechadas, ao contrario das especialidades.
--
-- Fechadas porque TEM codigo/leitura atras delas: o formato decide o que a
-- coordenacao oferece a startup, e o status alimenta o filtro e a acao em
-- massa. Tres valores cada, iguais para toda incubadora.
-- ---------------------------------------------------------------------------
DO $bloco$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mentorformato') THEN
        CREATE TYPE mentorFormato AS ENUM ('PRESENCIAL', 'ONLINE', 'HIBRIDO');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mentorsituacao') THEN
        CREATE TYPE mentorSituacao AS ENUM ('ATIVO', 'INDISPONIVEL', 'INATIVO');
    END IF;
END
$bloco$;

-- ---------------------------------------------------------------------------
-- 2. MENTOR_PERFIL — o cadastro do mentor dentro de uma incubadora.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mentor_perfil (
    id_tenant  INTEGER NOT NULL,
    id_usuario INTEGER NOT NULL,

    -- De onde ele vem: "Professor UFPE", "Voluntario", "Consultor externo",
    -- "Socio da Aceleradora X". Texto livre — nenhuma lista fechada daria
    -- conta da variedade, e o valor aqui e descritivo, nao operacional.
    vinculo VARCHAR(120),
    -- Area/departamento dentro desse vinculo: "Centro de Informatica",
    -- "Juridico", "Comercial".
    area    VARCHAR(120),

    -- Do que ele entende, e que tipo de demanda topa atender. Ver o cabecalho.
    especialidades TEXT[] NOT NULL DEFAULT '{}',
    demandas       TEXT[] NOT NULL DEFAULT '{}',

    -- Disponibilidade ESTIMADA, em horas por mes. Estimada mesmo: e o que o
    -- mentor declarou, nao o que o sistema mediu — quem mede e a coluna de
    -- mentorias no periodo, e ler as duas lado a lado e justamente o ponto.
    horas_mes SMALLINT,

    formato  mentorFormato  NOT NULL DEFAULT 'HIBRIDO',
    situacao mentorSituacao NOT NULL DEFAULT 'ATIVO',

    -- O que a coordenacao sabe e nao cabe em campo nenhum ("so atende as de
    -- healthtech", "avisar com 15 dias"). Fica na listagem, atras de uma
    -- coluna que nao abre por padrao.
    observacoes TEXT,

    atualizado_ts TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_mentor_perfil PRIMARY KEY (id_tenant, id_usuario),

    -- FK COMPOSTA para tenant_usuarios, e nao para usuarios: assim so existe
    -- perfil de quem esta na incubadora, e tirar a pessoa de la leva o
    -- cadastro junto.
    CONSTRAINT fk_mentor_perfil_vinculo
        FOREIGN KEY (id_tenant, id_usuario)
        REFERENCES tenant_usuarios (id_tenant, id_usuario)
        ON DELETE CASCADE,

    -- 500h/mes e mais do que existe em um mes de trabalho: o teto so barra
    -- digito trocado (o "40" que vira "400").
    CONSTRAINT ck_mentor_perfil_horas
        CHECK (horas_mes IS NULL OR (horas_mes >= 0 AND horas_mes <= 500))
);

-- Os dois arrays sao FILTRO na listagem ("quem atende Growth?"), e e para isso
-- que serve o GIN: sem ele o filtro vira varredura da tabela inteira.
CREATE INDEX IF NOT EXISTS ix_mentor_perfil_especialidades
    ON mentor_perfil USING GIN (especialidades);
CREATE INDEX IF NOT EXISTS ix_mentor_perfil_demandas
    ON mentor_perfil USING GIN (demandas);

-- ---------------------------------------------------------------------------
-- 3. EVENTO — o responsavel deixa de ser so um nome.
--
-- `mentor_nome` CONTINUA existindo e continua sendo gravado: nem todo
-- responsavel e usuario do sistema (convidado de fora, palestrante), e apagar
-- a coluna reescreveria o historico de quem ja foi digitado. O id e o caminho
-- novo; o texto e o fallback, exatamente como local/id_local na migracao 008.
-- ---------------------------------------------------------------------------
ALTER TABLE evento ADD COLUMN IF NOT EXISTS id_usuario_mentor INTEGER;

DO $bloco$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_evento_mentor'
    ) THEN
        -- SET NULL, e nao CASCADE: excluir um usuario nao pode apagar a
        -- atividade que aconteceu. Ela perde o dono, nao a existencia.
        ALTER TABLE evento
            ADD CONSTRAINT fk_evento_mentor
            FOREIGN KEY (id_usuario_mentor)
            REFERENCES usuarios (id_usuario)
            ON DELETE SET NULL;
    END IF;
END
$bloco$;

-- A consulta das duas colunas novas e sempre "as mentorias DESTE mentor, em
-- ordem de data" — e este o indice dela.
CREATE INDEX IF NOT EXISTS ix_evento_mentor
    ON evento (id_usuario_mentor, inicio_ts);

-- ---------------------------------------------------------------------------
-- 4. BACKFILL — casa o texto ja digitado com o mentor correspondente.
--
-- So quando o nome bate com UM mentor do mesmo tenant. Empate (dois "Ana
-- Silva") fica sem id: atribuir a atividade ao mentor errado inflaria a
-- contagem de um e esvaziaria a do outro, e ninguem teria como desconfiar. O
-- que nao casar continua valendo pelo texto, como sempre valeu.
-- ---------------------------------------------------------------------------
UPDATE evento e
   SET id_usuario_mentor = casado.id_usuario
  FROM (
        SELECT ev.id_evento,
               MIN(u.id_usuario) AS id_usuario
          FROM evento ev
          JOIN tenant_usuarios tu
            ON tu.id_tenant = ev.id_tenant
           AND tu.papel = 'mentor'
           AND tu.ativo = TRUE
          JOIN usuarios u
            ON u.id_usuario = tu.id_usuario
           AND lower(btrim(u.nome)) = lower(btrim(ev.mentor_nome))
         WHERE ev.mentor_nome IS NOT NULL
           AND btrim(ev.mentor_nome) <> ''
         GROUP BY ev.id_evento
        HAVING COUNT(*) = 1
       ) casado
 WHERE e.id_evento = casado.id_evento
   AND e.id_usuario_mentor IS NULL;

COMMIT;
