-- ===========================================================================
-- 024 — Questionario no modo PROVA (questoes de assinalar com gabarito)
--
-- CONTEXTO
-- O questionario era so formulario, no estilo Google Forms: a startup responde
-- e o mentor le. Nao havia resposta certa. A incubadora quer tambem aplicar
-- prova de assinalar — perguntas de escolha com alternativas certas e erradas,
-- corrigidas sozinhas na entrega.
--
-- O QUE MUDA
--   questionarios.prova  -> TRUE marca o questionario como prova. Prova so tem
--                           perguntas de escolha (quem garante e o service: o
--                           tipo mora na pergunta, e um CHECK nao alcanca a
--                           linha do pai).
--   alternativa.correta  -> o gabarito. Fora de prova fica sempre FALSE.
--
-- POR QUE NAO GUARDAR A NOTA NA ENTREGA: a nota sai das respostas cruzadas com
-- o gabarito, e questionario nao se edita depois de criado (so ativa/desativa).
-- Guardar seria uma segunda copia do mesmo fato, livre para divergir.
--
-- OS QUESTIONARIOS QUE JA EXISTEM continuam formularios (DEFAULT FALSE nas
-- duas colunas).
--
-- NAO-DESTRUTIVA: so acrescenta colunas.
-- ===========================================================================

ALTER TABLE questionarios
    ADD COLUMN IF NOT EXISTS prova BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE alternativa
    ADD COLUMN IF NOT EXISTS correta BOOLEAN NOT NULL DEFAULT FALSE;
