-- ===========================================================================
-- 003 — Logo do conteudo da Biblioteca
--
-- CONTEXTO
-- No acervo todo conteudo do mesmo tipo aparecia com o mesmo icone generico
-- (o icone do tipo). Numa grade com dezenas de cards, o olho nao acha nada:
-- "Aula" ao lado de "Aula" ao lado de "Aula". Catalogos de curso resolvem
-- isso com uma marca por item — o simbolo da tecnologia/tema — e e o que
-- esta coluna guarda.
--
-- FORMATO
-- Data URL base64, no mesmo padrao ja usado por usuarios.foto_url: a imagem
-- viaja e vive junto do registro, sem depender de storage externo nem de
-- rota estatica. O front reduz para 256px antes de enviar, entao na pratica
-- sao dezenas de KB; o teto e validado no bibliotecaService.
-- Tambem aceita URL http(s), para quem preferir apontar uma imagem hospedada.
--
-- Quando a coluna e NULL o card cai no icone do tipo, como antes — o logo e
-- opcional e nenhum conteudo existente precisa mudar.
--
-- NAO-DESTRUTIVA: so adiciona uma coluna anulavel.
--
-- COMO RODAR
--   psql -d <base> -f database/migrations/003_conteudo_logo.sql
-- ===========================================================================

BEGIN;

ALTER TABLE conteudo
    ADD COLUMN IF NOT EXISTS logo_url TEXT;

COMMENT ON COLUMN conteudo.logo_url IS
    'Marca do conteudo no acervo: data URL base64 ou link http(s). NULL = usa o icone do tipo.';

COMMIT;
