-- ===========================================================================
-- 011 — Tempo por etapa: quanto tempo a startup passa em cada fase, e de quem
--       e a demora
--
-- CONTEXTO
-- A pergunta que motivou esta migracao: "quanto tempo um incubado esta em cada
-- etapa da trilha?" — sabendo que ele pode estar parado nao por culpa propria,
-- mas porque o mentor ainda nao corrigiu a entrega. Sem separar as duas coisas
-- a metrica acusa a startup por uma fila que e da incubadora.
--
-- POR QUE O BANCO AINDA NAO RESPONDIA ISSO
-- Tres apagamentos no caminho:
--
--   1. `entrega` e upsert (uk_entrega_passo_startup): uma linha por passo,
--      reescrita a cada rascunho e a cada reenvio. `atualizado_ts` guarda o
--      ULTIMO save; o penultimo envio nao existe mais.
--   2. `jornadaRepository.reenviar` faz DELETE nas avaliacoes anteriores para
--      o passo voltar a "aguardando". Cada ida e volta com o mentor some — e
--      e exatamente onde o tempo se perde. O proprio relatorio de Gargalos ja
--      registra essa limitacao em comentario.
--   3. `startup_trilha` tem `inicio_ts`/`fim_ts` por fase, mas NENHUM caminho
--      da aplicacao escreve nela (so o seed). Nao ha "quando esta startup
--      entrou na Validacao".
--
-- Resultado: o estado ATUAL era recuperavel, a HISTORIA nao. E duracao e
-- historia.
--
-- O QUE ESTA MIGRACAO FAZ
-- Cria `passo_evento`, um livro-caixa append-only: uma linha para cada troca
-- de mao de um passo — a startup enviou, o mentor respondeu. Nada e alterado
-- nem removido depois de gravado.
--
-- Com isso a linha do tempo de um passo vira uma sequencia alternada:
--
--   ENVIADA --(bola com o MENTOR)--> AJUSTE --(bola com o INCUBADO)--> ENVIADA
--   --(bola com o MENTOR)--> APROVADO
--
-- e a duracao de cada trecho tem dono. O tempo entre a entrada na fase e o
-- primeiro ENVIADA tambem e do incubado; o que sobra depois de um ENVIADA sem
-- resposta e do mentor, e cresce sozinho enquanto ninguem corrige.
--
-- POR QUE TRIGGER, E NAO CHAMADA NO SERVICE
-- O envio nasce em tres caminhos distintos (`salvarEntrega` com status
-- ENVIADA, `reenviar`, e o INSERT do primeiro envio) e a avaliacao em um
-- quarto. Uma chamada esquecida em qualquer um deles produziria um relatorio
-- silenciosamente errado — pior que relatorio nenhum, porque ninguem
-- desconfia de um numero. No trigger a regra e uma so e nao tem como escapar,
-- no mesmo espirito de fn_trilha_no_hierarquia (001) e fn_startup_programa_raiz
-- (009).
--
-- O QUE NAO MUDA
-- Nada do comportamento atual. `reenviar` continua apagando as avaliacoes — a
-- Jornada depende disso para o passo voltar a "aguardando" — so que agora o
-- fato ja foi registrado aqui antes de sumir de la. Nenhuma tela existente le
-- esta tabela; ela e escrita por trigger e lida pelo relatorio novo.
--
-- NAO-DESTRUTIVA
-- Nenhuma linha e removida de nada. O passo 4 reconstroi do estado atual o
-- pouco de historia que sobrou (o envio vivo de cada entrega e as avaliacoes
-- que ainda existem), para o relatorio nao nascer vazio. Os ciclos ja
-- apagados nao voltam: para eles a serie comeca hoje.
--
-- COMO RODAR
--   psql -d <base> -f database/migrations/011_tempo_etapa.sql
-- Roda inteira dentro de uma transacao: ou aplica tudo, ou nada.
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. O tipo do evento.
--
--    Sao os quatro fatos que trocam a bola de lado. RASCUNHO nao entra: salvar
--    rascunho nao entrega nada a ninguem, a bola continua com o incubado — e
--    registrar isso so encheria a tabela de ruido sem mudar duracao nenhuma.
-- ---------------------------------------------------------------------------
DO $bloco$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'passoeventotipo') THEN
        CREATE TYPE passoEventoTipo AS ENUM (
            'ENVIADA',    -- o incubado submeteu (primeiro envio ou reenvio)
            'APROVADO',   -- o mentor aceitou: o passo termina aqui
            'AJUSTE',     -- o mentor devolveu para correcao
            'REPROVADO'   -- o mentor recusou (mesma acao do incubado: refazer)
        );
    END IF;
END
$bloco$;


-- ---------------------------------------------------------------------------
-- 2. O livro-caixa.
--
--    Append-only de proposito: nao ha UPDATE nem DELETE em lugar nenhum do
--    codigo sobre esta tabela. E o unico lugar do sistema onde a historia
--    sobrevive ao upsert de `entrega` e ao DELETE de `avaliacao`.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS passo_evento (
    id_evento  BIGINT GENERATED ALWAYS AS IDENTITY,

    id_startup INTEGER NOT NULL,
    id_no      INTEGER NOT NULL,   -- sempre um PASSO (folha da trilha)

    tipo       passoEventoTipo NOT NULL,

    -- Quem causou: o membro que enviou, ou o mentor que respondeu. Anulavel
    -- porque o backfill do passo 4 reconstroi eventos cujo autor pode nao
    -- constar mais na entrega.
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

-- A leitura do relatorio e sempre "a linha do tempo deste passo desta startup,
-- em ordem": o indice cobre a particao e a ordenacao do LEAD().
CREATE INDEX IF NOT EXISTS ix_passo_evento_linha
    ON passo_evento (id_startup, id_no, ts, id_evento);

-- Recorte por passo, para o ranking "onde o tempo se perde no programa".
CREATE INDEX IF NOT EXISTS ix_passo_evento_no
    ON passo_evento (id_no, ts);

COMMENT ON TABLE passo_evento IS
    'Livro-caixa append-only das trocas de mao de um passo. Escrito por trigger, lido pelo relatorio de tempo por etapa.';


-- ---------------------------------------------------------------------------
-- 3. Os triggers que alimentam o livro-caixa.
-- ---------------------------------------------------------------------------

-- 3a. ENVIO — dispara em qualquer escrita de `entrega` que a deixe ENVIADA.
--
--     Nao basta olhar a MUDANCA de status: o reenvio apos ajuste vai de
--     ENVIADA para ENVIADA (jornadaRepository.reenviar) e seria perdido por
--     uma condicao do tipo `OLD.status <> NEW.status`.
--
--     A guarda e outra: se o ultimo evento do passo JA e ENVIADA, a bola ja
--     esta com o mentor e um save repetido nao e um novo envio. Isso mantem a
--     serie estritamente alternada, que e o que faz cada trecho ter um dono
--     so.
CREATE OR REPLACE FUNCTION fn_passo_evento_entrega()
RETURNS TRIGGER AS $fn$
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

    -- NOW() e nao NEW.atualizado_ts: o evento e quando aconteceu, e nao
    -- depende de a coluna ter sido tocada pelo caminho que chamou. Dentro da
    -- transacao os dois sao o mesmo instante na pratica, mas NOW() nunca anda
    -- para tras — e uma serie fora de ordem inverteria a conta de duracao.
    INSERT INTO passo_evento (id_startup, id_no, tipo, id_usuario)
    VALUES (NEW.id_startup, NEW.id_no, 'ENVIADA', NEW.id_usuario);

    RETURN NULL;  -- AFTER trigger: o retorno e ignorado
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_passo_evento_entrega ON entrega;
CREATE TRIGGER trg_passo_evento_entrega
    AFTER INSERT OR UPDATE ON entrega
    FOR EACH ROW EXECUTE FUNCTION fn_passo_evento_entrega();


-- 3b. DEVOLUTIVA — dispara a cada avaliacao criada.
--
--     Registra ANTES de o reenvio apagar a linha de `avaliacao`: o evento e
--     gravado no instante em que a devolutiva nasce, dias antes do DELETE que
--     `reenviar` executa. E dai que sai a duracao dos ciclos que hoje
--     desaparecem sem deixar rastro.
CREATE OR REPLACE FUNCTION fn_passo_evento_avaliacao()
RETURNS TRIGGER AS $fn$
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
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_passo_evento_avaliacao ON avaliacao;
CREATE TRIGGER trg_passo_evento_avaliacao
    AFTER INSERT ON avaliacao
    FOR EACH ROW EXECUTE FUNCTION fn_passo_evento_avaliacao();


-- ---------------------------------------------------------------------------
-- 4. Backfill — reconstroi o que ainda da para reconstruir.
--
--    So o presente sobreviveu aos apagamentos: o envio VIVO de cada entrega e
--    as avaliacoes que ainda existem. Os ciclos ja descartados por reenvios
--    passados nao voltam, e nao ha de onde tira-los. Para o relatorio isso
--    significa que as duracoes de hoje sao um PISO — o tempo real foi igual ou
--    maior. Daqui para a frente a serie e completa.
--
--    Idempotente pelo NOT EXISTS: rodar a migracao duas vezes nao duplica.
-- ---------------------------------------------------------------------------

-- 4a. O envio vivo de cada entrega ja submetida.
--
--     O instante e o menor entre `atualizado_ts` e a primeira avaliacao
--     daquela entrega: um save posterior a aprovacao (a tela nao oferece, mas
--     o banco nao proibe) jogaria `atualizado_ts` para depois da resposta do
--     mentor e produziria um trecho de duracao negativa.
INSERT INTO passo_evento (id_startup, id_no, tipo, id_usuario, ts)
SELECT e.id_startup, e.id_no, 'ENVIADA', e.id_usuario,
       LEAST(e.atualizado_ts, COALESCE(a.primeira, e.atualizado_ts))
  FROM entrega e
  LEFT JOIN LATERAL (
    SELECT MIN(criado_ts) AS primeira
      FROM avaliacao WHERE id_entrega = e.id_entrega
  ) a ON TRUE
 WHERE e.status = 'ENVIADA'
   AND NOT EXISTS (
     SELECT 1 FROM passo_evento pe
      WHERE pe.id_startup = e.id_startup AND pe.id_no = e.id_no
        AND pe.tipo = 'ENVIADA'
   );

-- 4b. As devolutivas que sobreviveram.
INSERT INTO passo_evento (id_startup, id_no, tipo, id_usuario, ts)
SELECT e.id_startup, e.id_no, av.status::passoEventoTipo, av.id_avaliador,
       av.criado_ts
  FROM avaliacao av
  JOIN entrega e ON e.id_entrega = av.id_entrega
 WHERE NOT EXISTS (
   SELECT 1 FROM passo_evento pe
    WHERE pe.id_startup = e.id_startup
      AND pe.id_no = e.id_no
      AND pe.tipo <> 'ENVIADA'
 );

COMMIT;
