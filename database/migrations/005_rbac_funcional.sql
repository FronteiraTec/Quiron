-- ===========================================================================
-- 005 — RBAC que de fato autoriza
--
-- CONTEXTO
-- A maquinaria de RBAC existia inteira (roles, catalogo, tela, checagem), mas
-- so 5 das 68 chaves tinham codigo atras. As outras 63 eram decorativas: o
-- admin marcava e desmarcava e nada mudava. Pior que inutil — a tela prometia
-- um controle que nao existia, e quem desmarcasse algo acreditaria ter
-- revogado um acesso que continuava valendo.
--
-- Duas coisas impediam o RBAC de valer:
--
--   1. `criarRolesPadrao` criava Administrador/Mentor/Colaborador SEM
--      permissao nenhuma. Roles vazias, marcadas `sistema = TRUE` (logo, nem
--      excluiveis). E o tenant 1 nunca as recebeu: nasceu do seed por INSERT
--      direto, sem passar por `tenantService.criar`.
--
--   2. Ninguem estava vinculado a role alguma. Ligar o enforcement neste
--      estado trancaria todo mundo para fora no mesmo instante.
--
-- ESTA MIGRACAO prepara o terreno para o enforcement: limpa o catalogo, cria
-- as roles padrao JA COM permissoes em todo tenant existente, e aloca cada
-- usuario na role equivalente ao papel que ele ja tem.
--
-- PRINCIPIO: ninguem ganha nem perde acesso hoje. Cada role reproduz o que
-- aquele papel ja conseguia fazer. Se alguem perder acesso quando o
-- enforcement entrar, o conjunto de chaves e que esta errado.
--
-- As listas de chaves abaixo espelham backend/src/rbac/rolesPadrao.js. Como
-- toda migracao, este arquivo e um retrato congelado: quem mandar dali para a
-- frente e o codigo, e mexer nas listas de la NAO altera o que ja foi aplicado
-- aqui (nem deve — a partir da aplicacao, os conjuntos passam a ser editaveis
-- pelo admin na tela de Permissoes, e reescreve-los por migracao apagaria
-- justamente a customizacao que o RBAC existe para permitir).
--
-- DESTRUTIVA para as 14 chaves obsoletas listadas no passo 1.
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Catalogo: fora o que nao existe mais
--
-- programa.fases.*, programa.modulos.* e programa.tarefas.* governavam os tres
-- CRUDs que a refatoracao da trilha substituiu por um recurso so (/trilha).
-- avaliacoes.avaliacoes.reabrir nunca existiu e nao pode existir: o reenvio
-- APAGA as avaliacoes anteriores, entao nao ha o que reabrir.
--
-- As chaves novas (programa.trilha.*, programa.biblioteca.*) nascem sozinhas
-- na proxima subida da API, via sincronizarCatalogo. O ON DELETE CASCADE de
-- role_permissao leva junto os vinculos das que saem.
-- ---------------------------------------------------------------------------
DELETE FROM permissao
 WHERE chave LIKE 'programa.fases.%'
    OR chave LIKE 'programa.modulos.%'
    OR chave LIKE 'programa.tarefas.%'
    OR chave = 'avaliacoes.avaliacoes.reabrir';

-- ---------------------------------------------------------------------------
-- 2. As chaves novas, antes das roles que vao usa-las
--
-- Normalmente o sincronizador as criaria na subida da API, mas esta migracao
-- precisa delas AGORA para montar os conjuntos abaixo. Criamos com os rotulos
-- corretos; o sincronizador confirma no proximo boot.
-- ---------------------------------------------------------------------------
INSERT INTO permissao (chave, modulo, recurso, acao, rotulo_modulo, rotulo_recurso, rotulo_acao)
VALUES
  ('programa.trilha.visualizar', 'programa', 'trilha', 'visualizar', 'Programa', 'Trilha do programa', 'Visualizar'),
  ('programa.trilha.criar',      'programa', 'trilha', 'criar',      'Programa', 'Trilha do programa', 'Criar'),
  ('programa.trilha.editar',     'programa', 'trilha', 'editar',     'Programa', 'Trilha do programa', 'Editar'),
  ('programa.trilha.excluir',    'programa', 'trilha', 'excluir',    'Programa', 'Trilha do programa', 'Excluir'),
  ('programa.biblioteca.visualizar', 'programa', 'biblioteca', 'visualizar', 'Programa', 'Biblioteca de conteudos', 'Visualizar'),
  ('programa.biblioteca.criar',      'programa', 'biblioteca', 'criar',      'Programa', 'Biblioteca de conteudos', 'Criar'),
  ('programa.biblioteca.editar',     'programa', 'biblioteca', 'editar',     'Programa', 'Biblioteca de conteudos', 'Editar'),
  ('programa.biblioteca.excluir',    'programa', 'biblioteca', 'excluir',    'Programa', 'Biblioteca de conteudos', 'Excluir')
ON CONFLICT (chave) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. As tres roles padrao em TODO tenant que ainda nao as tenha
-- ---------------------------------------------------------------------------
INSERT INTO role (id_tenant, nome, descricao, sistema)
SELECT t.id_tenant, r.nome, r.descricao, TRUE
  FROM tenant t
  CROSS JOIN (VALUES
    ('Administrador', 'Acesso total a incubadora.'),
    ('Mentor',        'Acompanha e avalia as startups do programa.'),
    ('Colaborador',   'Acesso operacional basico.')
  ) AS r(nome, descricao)
ON CONFLICT (id_tenant, nome) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. As permissoes de cada role padrao
-- ---------------------------------------------------------------------------

-- Administrador recebe o catalogo INTEIRO, calculado por join e nao por lista:
-- assim nenhuma chave nova nasce deixando o dono da incubadora de fora.
INSERT INTO role_permissao (id_role, id_permissao)
SELECT r.id_role, p.id_permissao
  FROM role r
  CROSS JOIN permissao p
 WHERE r.sistema = TRUE AND r.nome = 'Administrador'
ON CONFLICT (id_role, id_permissao) DO NOTHING;

-- Mentor: o que o papel 'mentor' ja conseguia fazer. Inclui editar a trilha e
-- a biblioteca porque o menu dele tem o Construtor e nada impedia — frouxidao
-- herdada do modelo antigo, que agora tem onde ser corrigida.
INSERT INTO role_permissao (id_role, id_permissao)
SELECT r.id_role, p.id_permissao
  FROM role r
  JOIN permissao p ON p.chave IN (
    'startups.startups.visualizar',
    'startups.membros.visualizar',
    'startups.mentoria.mentorar',
    'startups.canvas.visualizar',
    'startups.gut.visualizar',
    'startups.cinco_w2h.visualizar',
    'avaliacoes.entregas.visualizar',
    'avaliacoes.entregas.baixar',
    'avaliacoes.avaliacoes.visualizar',
    'avaliacoes.avaliacoes.avaliar',
    'programa.trilha.visualizar',
    'programa.trilha.editar',
    'programa.biblioteca.visualizar',
    'programa.biblioteca.editar',
    'programa.questionarios.visualizar',
    'eventos.agenda.visualizar'
  )
 WHERE r.sistema = TRUE AND r.nome = 'Mentor'
ON CONFLICT (id_role, id_permissao) DO NOTHING;

-- Colaborador (incubado): os modelos de gestao da propria startup, os
-- questionarios e a agenda. A Jornada nao entra porque nao esta no catalogo —
-- exigir chave para a pessoa ver o proprio progresso so criaria um jeito novo
-- de trava-la fora do sistema.
INSERT INTO role_permissao (id_role, id_permissao)
SELECT r.id_role, p.id_permissao
  FROM role r
  JOIN permissao p ON p.chave IN (
    'startups.startups.visualizar',
    'startups.membros.visualizar',
    'startups.canvas.visualizar',
    'startups.canvas.editar',
    'startups.gut.visualizar',
    'startups.gut.criar',
    'startups.gut.excluir',
    'startups.cinco_w2h.visualizar',
    'startups.cinco_w2h.criar',
    'startups.cinco_w2h.excluir',
    'programa.questionarios.visualizar',
    'programa.biblioteca.visualizar',
    'eventos.agenda.visualizar'
  )
 WHERE r.sistema = TRUE AND r.nome = 'Colaborador'
ON CONFLICT (id_role, id_permissao) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. Cada usuario na role equivalente ao papel que ja tem
--
-- Este e o passo que evita a tranca coletiva: sem ele, ligar o enforcement
-- deixaria todo mundo sem permissao nenhuma no primeiro request.
--
-- So vale para vinculos ATIVOS, e so acrescenta: quem ja estiver em alguma
-- role (a "Teste" criada a mao, por exemplo) mantem o que tem.
-- ---------------------------------------------------------------------------
INSERT INTO usuario_role (id_usuario, id_role)
SELECT tu.id_usuario, r.id_role
  FROM tenant_usuarios tu
  JOIN role r
    ON r.id_tenant = tu.id_tenant
   AND r.sistema = TRUE
   AND r.nome = CASE tu.papel
                  WHEN 'admin'   THEN 'Administrador'
                  WHEN 'mentor'  THEN 'Mentor'
                  WHEN 'usuario' THEN 'Colaborador'
                END
 WHERE tu.ativo = TRUE
ON CONFLICT (id_usuario, id_role) DO NOTHING;

COMMIT;

-- ===========================================================================
-- CONFERENCIA (rode depois; nenhuma linha deve voltar vazia)
--
--   -- toda role padrao tem permissao?
--   SELECT r.id_tenant, r.nome, COUNT(rp.id_permissao) AS permissoes
--     FROM role r LEFT JOIN role_permissao rp ON rp.id_role = r.id_role
--    WHERE r.sistema GROUP BY 1,2 ORDER BY 1,2;
--
--   -- todo usuario ativo caiu em alguma role?
--   SELECT u.nome, tu.papel, string_agg(r.nome, ', ') AS roles
--     FROM tenant_usuarios tu
--     JOIN usuarios u ON u.id_usuario = tu.id_usuario
--     LEFT JOIN usuario_role ur ON ur.id_usuario = tu.id_usuario
--     LEFT JOIN role r ON r.id_role = ur.id_role AND r.id_tenant = tu.id_tenant
--    WHERE tu.ativo GROUP BY 1,2 ORDER BY 2;
-- ===========================================================================
