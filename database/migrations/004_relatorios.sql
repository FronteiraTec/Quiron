-- ===========================================================================
-- 004 — Relatorios de gestao no lugar de Logs/Auditoria
--
-- CONTEXTO
-- O menu "Relatorios" tinha dois itens que nao eram relatorio: "Logs" e
-- "Auditoria". Ambos eram registro tecnico — o que o sistema fez — e nenhum
-- respondia as perguntas que a incubadora faz ao abrir aquele menu: quem esta
-- avancando, o que esta parado, onde o programa trava, quem sumiu.
--
-- No lugar deles entraram quatro relatorios, todos SOMENTE LEITURA sobre o que
-- os outros modulos ja registram (nao ha tabela nova):
--
--   /relatorios/progresso    -> avanco de cada startup na trilha
--   /relatorios/entregas     -> funil, fila de avaliacao e SLA dos mentores
--   /relatorios/gargalos     -> os passos que mais seguram startups
--   /relatorios/engajamento  -> presenca em eventos, por evento e por startup
--
-- A auditoria nao foi descartada: virou aba em Configuracoes
-- (/configuracoes/auditoria), que e onde o registro de conformidade pertence.
-- O endpoint GET /auditlogs continua o mesmo.
--
-- ESTA MIGRACAO
-- Nao ha mudanca de estrutura — os relatorios leem as tabelas existentes.
-- O unico ajuste e no catalogo de permissoes: sincronizarCatalogo.js faz
-- upsert e NUNCA remove (para nao apagar vinculos de role_permissao por
-- engano), entao as duas chaves das telas extintas continuariam listadas na
-- tela de RBAC, oferecendo permissao para rotas que nao existem mais.
--
-- As chaves novas (relatorios.progresso.*, relatorios.entregas.*,
-- relatorios.gargalos.*, relatorios.engajamento.* e
-- configuracoes.auditoria.visualizar) sao criadas sozinhas na proxima subida
-- da API; aqui so limpamos as obsoletas.
--
-- DESTRUTIVA APENAS PARA AS DUAS CHAVES ABAIXO.
-- ===========================================================================

BEGIN;

-- Quem tinha "Relatorios > Auditoria" passa a ter o equivalente em
-- Configuracoes, para nenhuma role perder acesso que ja possuia. A permissao
-- de destino precisa existir: se a API ainda nao subiu com o catalogo novo,
-- o INSERT abaixo a cria, e o sincronizador so completara os rotulos depois.
INSERT INTO permissao (chave, modulo, recurso, acao, rotulo_modulo, rotulo_recurso, rotulo_acao)
VALUES ('configuracoes.auditoria.visualizar', 'configuracoes', 'auditoria', 'visualizar',
        'Configuracoes', 'Auditoria', 'Visualizar')
ON CONFLICT (chave) DO NOTHING;

INSERT INTO role_permissao (id_role, id_permissao)
SELECT rp.id_role, nova.id_permissao
  FROM role_permissao rp
  JOIN permissao antiga ON antiga.id_permissao = rp.id_permissao
                       AND antiga.chave = 'relatorios.auditoria.visualizar'
  CROSS JOIN permissao nova
 WHERE nova.chave = 'configuracoes.auditoria.visualizar'
ON CONFLICT DO NOTHING;

-- Agora as chaves das telas extintas saem do catalogo. O ON DELETE CASCADE de
-- role_permissao leva junto os vinculos que apontavam para elas.
DELETE FROM permissao
 WHERE chave IN ('relatorios.logs.visualizar', 'relatorios.auditoria.visualizar');

COMMIT;
