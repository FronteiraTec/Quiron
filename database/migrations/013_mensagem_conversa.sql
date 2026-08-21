-- ===========================================================================
-- 013 — A mensagem vira conversa: o destinatario pode responder
--
-- CONTEXTO
-- A migracao 012 deu a incubadora um megafone: alguem com permissao escreve, N
-- pessoas recebem, e acabou. Quem recebia nao tinha para onde responder dentro
-- do sistema — a conversa continuava no WhatsApp, fora de qualquer registro.
--
-- O QUE MUDA (E O QUE NAO MUDA)
-- Nenhuma tabela nova. A conversa NAO e uma entidade guardada: ela e derivada
-- do par (remetente, destinatario) que as tabelas de 012 ja registram.
--
--   eu -> voce   : mensagem com destino USUARIO(voce)
--   voce -> eu   : mensagem com destino USUARIO(eu)
--   a conversa   : as duas listas, em ordem cronologica
--
-- POR QUE NAO CRIAR UMA TABELA `conversa`
-- Ela nao guardaria nada que ja nao esteja em `mensagem` + `mensagem_destinatario`,
-- e criaria uma segunda verdade para manter em dia: um aviso enviado a 30
-- pessoas teria de abrir (e atualizar) 30 linhas de conversa no mesmo INSERT,
-- e qualquer caminho que esquecesse esse passo produziria uma conversa que
-- existe nas mensagens mas nao na lista. Derivar nao pode dessincronizar.
--
-- O preco e conhecido: a lista de conversas sai de um GROUP BY sobre as
-- mensagens, em vez de um SELECT numa tabela pronta. Na escala de uma
-- incubadora (dezenas de pessoas, milhares de mensagens) isso e barato, e os
-- indices de 012 ja cobrem os dois lados da busca.
--
-- AS DUAS COLUNAS ABAIXO
--   1. `assunto` deixa de ser obrigatorio. Aviso tem assunto ("Pitch na
--      sexta"); resposta de chat nao tem — inventar um ("Re: Pitch na sexta")
--      seria encher a tela de um dado que ninguem escreveu. Com NULL, a
--      interface sabe a diferenca: com assunto e um aviso, sem assunto e uma
--      fala dentro da conversa.
--   2. `id_mensagem_pai` diz a que a resposta responde. ON DELETE SET NULL
--      porque apagar o aviso original nao pode apagar o que as pessoas
--      responderam depois — a conversa sobrevive ao que a comecou.
-- ===========================================================================

ALTER TABLE mensagem ALTER COLUMN assunto DROP NOT NULL;

ALTER TABLE mensagem
    ADD COLUMN IF NOT EXISTS id_mensagem_pai BIGINT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_mensagem_pai'
    ) THEN
        ALTER TABLE mensagem
            ADD CONSTRAINT fk_mensagem_pai
            FOREIGN KEY (id_mensagem_pai)
            REFERENCES mensagem (id_mensagem)
            ON DELETE SET NULL;
    END IF;
END
$$;

-- A consulta da conversa parte dos DOIS lados: "o que eu mandei para voce"
-- (id_remetente) e "o que voce mandou para mim" (mensagem_destinatario, ja
-- indexado em 012). Este indice cobre o primeiro lado.
CREATE INDEX IF NOT EXISTS ix_mensagem_remetente
    ON mensagem (id_remetente, criado_ts DESC);
