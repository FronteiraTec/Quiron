-- ===========================================================================
-- 013 — Google Agenda: os eventos do Quiron na agenda pessoal de quem vai
--
-- CONTEXTO
-- A agenda do Quiron so existia DENTRO do Quiron. Quem tinha uma mentoria as
-- 14h dependia de abrir a plataforma para lembrar, ou de anotar por fora — e
-- o email de "novo evento" (notificacaoService.eventoCriado) avisa uma vez e
-- some na caixa de entrada. O celular de todo mundo ja apita para a agenda do
-- Google; o que faltava era o evento chegar la.
--
-- O QUE ESTA MIGRACAO FAZ
-- Cria as duas tabelas da integracao OAuth (empurra Quiron -> Google):
--
--   google_conta  -> a conexao de UMA pessoa com a conta Google dela.
--   google_evento -> o espelho: qual evento do Quiron virou qual evento no
--                    Google, na agenda de qual pessoa.
--
-- POR QUE A CONEXAO E POR PESSOA, E NAO POR INCUBADORA
-- A conta Google e da pessoa, nao do tenant. Quem participa de duas
-- incubadoras tem uma agenda so e quer as duas ali — por isso google_conta e
-- chaveada por id_usuario, sem id_tenant. O recorte de QUAIS eventos vao
-- continua sendo o mesmo da tela da agenda (papel no tenant + startups a que
-- a pessoa esta ligada), calculado na hora do envio.
--
-- POR QUE google_evento E UMA TABELA, E NAO UMA COLUNA EM `evento`
-- O mesmo evento do Quiron vira N eventos no Google — um na agenda de cada
-- participante conectado, cada um com seu proprio id la. Nao ha "o id do
-- evento no Google": ha um por pessoa. Uma coluna em `evento` so caberia se a
-- integracao fosse de uma agenda compartilhada, que nao e o caso.
--
-- POR QUE O REFRESH TOKEN E GUARDADO CIFRADO
-- Ele nao expira: quem o tem escreve na agenda da pessoa ate ela revogar. Um
-- dump do banco (backup, replica, log de erro) nao pode entregar isso em
-- texto puro. A cifragem e AES-256-GCM em backend/src/utils/cripto.js; a
-- coluna guarda o pacote em base64.
--
-- POR QUE O ACCESS TOKEN FICA NO BANCO E NAO EM MEMORIA
-- Ele vale ~1h. Em memoria, cada restart do container (ou cada instancia atras
-- do balanceador) refaria o refresh de todo mundo de uma vez, contra a cota do
-- Google. No banco, o proximo processo aproveita o que ainda esta valido.
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- A conexao de uma pessoa com a agenda dela no Google.
-- Uma linha por usuario: desconectar APAGA a linha (nao ha "historico de
-- conexao" a preservar, e deixar o refresh token parado seria guardar uma
-- chave que ninguem mais usa).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS google_conta (
    id_usuario INTEGER NOT NULL,

    -- `sub` do Google: o identificador estavel da conta. O email pode mudar;
    -- o sub nao. Serve para detectar que a pessoa reconectou com OUTRA conta.
    google_sub VARCHAR(120) NOT NULL,
    -- Guardado so para MOSTRAR na tela ("conectado como fulano@gmail.com").
    google_email VARCHAR(255),

    -- Pacote AES-256-GCM em base64 (ver utils/cripto.js). Nunca em texto puro.
    refresh_token TEXT NOT NULL,
    -- O de curta duracao. Tambem cifrado: vaza a mesma agenda, so que por 1h.
    access_token TEXT,
    access_token_expira_ts TIMESTAMP,

    -- Escopos que a pessoa realmente concedeu. O Google permite desmarcar na
    -- tela de consentimento, entao o que pedimos nao e o que temos: sem isso,
    -- so descobririamos a falta no 403 do primeiro evento.
    escopos TEXT,

    -- A agenda secundaria "Quiron" criada na conta da pessoa. Fica separada da
    -- agenda principal de proposito: ela liga/desliga a camada inteira com um
    -- clique, e a desconexao apaga um calendario nosso em vez de garimpar
    -- eventos no meio dos compromissos pessoais dela.
    id_calendario VARCHAR(255),

    -- Interruptor sem desconectar: pausa o envio mantendo a autorizacao.
    sincronizar BOOLEAN NOT NULL DEFAULT TRUE,

    conectado_ts TIMESTAMP NOT NULL DEFAULT NOW(),
    ultimo_sync_ts TIMESTAMP,
    -- Ultima falha, para a tela poder dizer O QUE deu errado em vez de so
    -- parar de sincronizar em silencio.
    ultimo_erro TEXT,

    CONSTRAINT pk_google_conta PRIMARY KEY (id_usuario),

    -- Usuario removido leva a conexao junto: sem dono, o token e so risco.
    CONSTRAINT fk_google_conta_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuarios (id_usuario)
        ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- O espelho evento do Quiron <-> evento no Google, por pessoa.
--
-- Sem ele so haveria dois caminhos ruins: criar um evento novo no Google a
-- cada edicao (duplicando) ou derivar o id la a partir do nosso (o Google
-- desaconselha reusar id de evento apagado). A tabela e a resposta direta a
-- "este evento ja foi para a agenda desta pessoa? com que id?".
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS google_evento (
    id_evento INTEGER NOT NULL,
    id_usuario INTEGER NOT NULL,

    -- Id do evento DENTRO do Google (gerado por eles no insert).
    google_event_id VARCHAR(1024) NOT NULL,
    -- Em qual calendario ele foi criado. Repetido aqui de proposito: se a
    -- pessoa desconectar e reconectar, google_conta.id_calendario passa a
    -- apontar para um calendario NOVO, e as linhas antigas ainda sabem onde
    -- moravam.
    id_calendario VARCHAR(255) NOT NULL,

    enviado_ts TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_google_evento PRIMARY KEY (id_evento, id_usuario),

    -- Evento apagado de verdade (hard delete) limpa o espelho. A exclusao
    -- normal do Quiron e logica (ativo = FALSE) e passa pelo service, que
    -- apaga o evento no Google antes de remover a linha.
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

COMMIT;
