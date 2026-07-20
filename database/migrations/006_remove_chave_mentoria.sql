-- ===========================================================================
-- 006 — Remove startups.mentoria.mentorar
--
-- CONTEXTO
-- Esta chave respondia "pode ATUAR como mentor?" no modelo antigo, em que o
-- papel autorizava e a permissao apenas estendia: `rbacService.podeMentorar`
-- perguntava "e mentor OU tem a chave?".
--
-- Com o RBAC autoritativo (migracao 005) a pergunta deixou de existir. O que
-- ela protegia passou a ser checado direto onde importa:
--
--   ver a fila de entregas   -> avaliacoes.entregas.visualizar
--   responder uma entrega    -> avaliacoes.avaliacoes.avaliar
--   de QUAIS startups        -> o vinculo mentor_startup (eixo separado, nao
--                               e permissao)
--
-- O proprio catalogo ja dizia, no comentario do recurso, que ver e responder
-- entregas NAO entravam nele para nao criar duas fontes decidindo a mesma
-- coisa. Sem `podeMentorar`, sobrou uma chave sem nenhuma fonte — exatamente a
-- "chave decorativa" que a 005 existiu para eliminar.
--
-- O ON DELETE CASCADE de role_permissao leva junto os vinculos (a role Mentor
-- a tinha).
-- ===========================================================================

BEGIN;

DELETE FROM permissao WHERE chave = 'startups.mentoria.mentorar';

COMMIT;
