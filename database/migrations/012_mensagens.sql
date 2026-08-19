-- ===========================================================================
-- 012 — Mensagens internas: avisar gente especifica, dentro do sistema
--
-- CONTEXTO
-- Ate aqui o Quiron so sabia avisar por EMAIL, e so sobre fatos que ele
-- proprio produzia: entrega enviada, entrega avaliada, evento criado (ver
-- backend/src/services/notificacaoService.js). Nao havia como a incubadora
-- dizer qualquer outra coisa — "a mentoria de quinta mudou de sala", "faltam
-- dois dias para o pitch", "startup X, seu CNPJ esta vencido" — sem sair da
-- plataforma e abrir o WhatsApp.
--
-- O sino da Navbar tambem nao ajudava: ele lia /eventos e chamava de
-- notificacao o evento criado nos ultimos dias. Nao havia entidade
-- "notificacao" no banco, e o estado de LIDA morava no localStorage do
-- navegador — trocar de maquina "desmarcava" tudo.
--
-- O QUE ESTA MIGRACAO FAZ
-- Cria a mensagem como fato de dominio, em tres tabelas:
--
--   mensagem              -> o que foi dito, por quem, quando.
--   mensagem_destino      -> a QUEM foi enderecado, no vocabulario de quem
--                            escreveu ("a startup Acme", "os mentores", "a
--                            role Financeiro").
--   mensagem_destinatario -> quem de fato RECEBE, uma linha por pessoa, com o
--                            lida_ts de cada uma.
--
-- POR QUE DESTINO E DESTINATARIO SAO TABELAS DIFERENTES
-- Sao duas perguntas que divergem com o tempo. "Para quem esta mensagem foi
-- enderecada?" e historia da intencao e nunca muda; "quem tem esta mensagem na
-- caixa?" e a entrega, que precisa de uma linha por pessoa para carregar o
-- estado de leitura.
--
-- E, principalmente: a lista de pessoas e um INSTANTANEO tirado no envio. Se a
-- expansao fosse feita na leitura ("todos os membros da startup X, agora"),
-- quem entrasse na startup amanha veria o aviso de hoje como se tivesse sido
-- escrito para ele, e quem saiu perderia o que ja tinha lido. Notificacao e
-- carta, nao consulta: entrega-se a quem estava la quando foi postada.
--
-- POR QUE id_referencia NAO TEM FK
-- A coluna aponta para tabelas diferentes conforme o `tipo` (startup, role,
-- usuarios) — nao ha FK unica que cubra os tres. O que a garante e o service,
-- que so aceita uma referencia depois de conferir que ela pertence ao MESMO
-- tenant da mensagem (sem isso daria para enderecar uma mensagem a uma startup
-- de outra incubadora). O CHECK abaixo cobre o resto: qual tipo exige
-- referencia e qual proibe.
--
-- POR QUE O REMETENTE E ON DELETE SET NULL
-- A mensagem sobrevive a saida de quem escreveu: apagar o usuario nao pode
-- apagar o aviso que trinta pessoas ja leram. O destinatario, ao contrario, e
-- CASCADE — a caixa de entrada de quem nao existe mais nao interessa a
-- ninguem.
-- ===========================================================================

-- Como a mensagem foi enderecada. Lista fechada porque cada valor tem uma
-- consulta de expansao propria no repositorio (ver idsPorDestino) e uma chave
-- de permissao propria no catalogo RBAC: um tipo desconhecido nao viraria
-- destino nenhum, viraria mensagem sem destinatario.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mensagemdestinotipo') THEN
        CREATE TYPE mensagemDestinoTipo AS ENUM (
            'TENANT',    -- toda a incubadora
            'STARTUP',   -- os membros ativos de uma startup
            'MENTORES',  -- os mentores do tenant, ou os de uma startup
            'ROLE',      -- quem tem uma role RBAC
            'USUARIO'    -- uma pessoa especifica
        );
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS mensagem (
    id_mensagem BIGINT GENERATED ALWAYS AS IDENTITY,
    id_tenant INTEGER NOT NULL,
    -- Quem escreveu. NULL = autor removido do sistema (ver cabecalho).
    id_remetente INTEGER,
    assunto VARCHAR(150) NOT NULL,
    corpo TEXT NOT NULL,
    -- Destaque visual no sino e no email. Nao muda quem recebe.
    importante BOOLEAN NOT NULL DEFAULT FALSE,
    -- Rota do front para onde o clique na notificacao leva (ex.: "/entregas").
    -- Opcional: mensagem sem rota so abre o proprio texto.
    rota VARCHAR(255),
    criado_ts TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_mensagem PRIMARY KEY (id_mensagem),
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

-- O criterio escolhido por quem escreveu, preservado como foi dito.
CREATE TABLE IF NOT EXISTS mensagem_destino (
    id_destino BIGINT GENERATED ALWAYS AS IDENTITY,
    id_mensagem BIGINT NOT NULL,
    tipo mensagemDestinoTipo NOT NULL,
    -- id_startup, id_role ou id_usuario, conforme o tipo (ver cabecalho).
    id_referencia INTEGER,
    -- Rotulo de quem/o que foi escolhido, congelado no envio: a startup pode
    -- ser renomeada e a role excluida, e a mensagem antiga continua dizendo
    -- para quem foi.
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
