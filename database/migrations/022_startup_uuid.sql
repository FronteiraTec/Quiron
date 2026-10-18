-- ===========================================================================
-- 022 — UUID da startup, para a URL
--
-- CONTEXTO
-- A tela de detalhe abria em /startups/42: o id sequencial na barra de
-- endereco diz quantas startups a incubadora tem, em que ordem entraram, e
-- convida a trocar 42 por 43. O acesso ja e barrado pelo vinculo (QRN-08), mas
-- a URL vai parar em print, e-mail e conversa — e nao deveria contar nada.
--
-- O QUE MUDA: cada startup ganha um `uuid`, que e o que a URL carrega. O
-- `id_startup` continua sendo a chave: as FKs, as consultas e o resto da API
-- seguem nele. A rota /startups/:id aceita os dois (ver startupRoutes).
--
-- AS STARTUPS QUE JA EXISTEM: o DEFAULT e volatil (gen_random_uuid), e o
-- Postgres o avalia LINHA A LINHA no ADD COLUMN — cada startup cadastrada sai
-- daqui com o seu UUID, sem UPDATE a parte. O preco e reescrever a tabela, que
-- e pequena.
--
-- NAO-DESTRUTIVA: so acrescenta coluna e indice.
-- ===========================================================================

ALTER TABLE startup
    ADD COLUMN IF NOT EXISTS uuid UUID NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS uq_startup_uuid ON startup (uuid);
