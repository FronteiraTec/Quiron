-- ===========================================================================
-- SEED DE EXEMPLO — uma trilha completa e um acervo para ver o sistema cheio.
--
-- O seed.sql cria o minimo para logar (tenant, usuarios, uma startup). Este
-- aqui povoa o CONTEUDO: a Biblioteca, a trilha de incubacao e o progresso de
-- uma startup, para as telas abrirem com algo dentro em vez de vazias.
--
-- O que cria:
--   Biblioteca -> 6 conteudos (2 aulas com blocos, 1 video, 1 material,
--                 1 template, 1 link)
--   Trilha     -> Programa > 3 fases > 5 modulos > 9 passos, com a moldura
--                 pedagogica preenchida (objetivo, porque, competencias, area)
--   Jornada    -> entregas da FlipTech em varios estados, para a Jornada
--                 mostrar cada situacao: aprovado, aguardando, ajuste e
--                 rascunho
--
-- PRE-REQUISITOS
--   schema.sql + seed.sql aplicados, e as migracoes 001 e 002 rodadas
--   (ou um banco novo, que ja nasce com o modelo atual).
--
-- COMO RODAR
--   docker exec -i postgres_db psql -U admin -d incubadora < database/seed_exemplo.sql
--
-- IDEMPOTENTE: limpa a trilha e o acervo do tenant 1 antes de recriar, entao
-- pode rodar quantas vezes quiser. Nao toca em usuarios, tenants ou startups.
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Limpa o que este seed cria (nao mexe em usuario/tenant/startup).
--    A ordem respeita as FKs: avaliacao -> entrega -> trilha_conteudo -> nos.
-- ---------------------------------------------------------------------------
DELETE FROM avaliacao WHERE id_entrega IN (
    SELECT e.id_entrega FROM entrega e
    JOIN trilha_no n ON n.id_no = e.id_no WHERE n.id_tenant = 1
);
DELETE FROM entrega WHERE id_no IN (SELECT id_no FROM trilha_no WHERE id_tenant = 1);
DELETE FROM startup_trilha WHERE id_no IN (SELECT id_no FROM trilha_no WHERE id_tenant = 1);
DELETE FROM trilha_conteudo WHERE id_no IN (SELECT id_no FROM trilha_no WHERE id_tenant = 1);
DELETE FROM trilha_no WHERE id_tenant = 1;
DELETE FROM conteudo WHERE id_tenant = 1;


-- ---------------------------------------------------------------------------
-- 1. Um mentor para a startup (a Jornada mostra quem acompanha).
--
-- O vinculo em si nasce no seed.sql, junto do usuario mentor@quiron.com. Aqui
-- so garantimos que ele existe, por email e nao por id fixo: quem rodar este
-- seed sobre um banco antigo (onde o mentor da FlipTech era o proprio admin)
-- continua com a Jornada preenchida.
-- ---------------------------------------------------------------------------
INSERT INTO mentor_startup (id_usuario_mentor, id_startup)
SELECT u.id_usuario, s.id_startup
  FROM usuarios u, startup s
 WHERE u.email = 'mentor@quiron.com'
   AND s.nome = 'FlipTech'
ON CONFLICT DO NOTHING;


-- ---------------------------------------------------------------------------
-- 2. BIBLIOTECA — o acervo do que a incubadora ensina.
-- ---------------------------------------------------------------------------
INSERT INTO conteudo (id_tenant, tipo, titulo, resumo, tags, url, nome_arquivo, duracao, criado_por)
VALUES
  (1, 'AULA',
   'Business Model Canvas na pratica',
   'Como preencher os 9 blocos do Canvas e transformar hipoteses em um modelo de negocio testavel.',
   ARRAY['Modelo de Negocio','Ideacao'], NULL, NULL, '8 min', 2),

  (1, 'AULA',
   'Estruturando seu primeiro pitch',
   'A sequencia de 10 slides que investidores esperam e como contar a historia da sua startup.',
   ARRAY['Pitch'], NULL, NULL, '10 min', 2),

  (1, 'VIDEO',
   'Como conduzir entrevistas de validacao',
   'Roteiro e boas praticas para entrevistar clientes sem enviesar as respostas (metodo Mom Test).',
   ARRAY['Validacao','Mercado'],
   'https://www.youtube.com/watch?v=6reLWfFNer0', NULL, '12 min', 2),

  (1, 'TEMPLATE',
   'Planilha de mercado (TAM / SAM / SOM)',
   'Modelo pronto para calcular o tamanho do mercado alcancavel da sua startup.',
   ARRAY['Mercado','Financeiro'], NULL, 'tam-sam-som.xlsx', NULL, 2),

  (1, 'ARQUIVO',
   'Guia de metricas para MVP',
   'PDF com as principais metricas de produto (North Star, ativacao, retencao) e quando usar cada uma.',
   ARRAY['Produto','MVP'], NULL, 'metricas-mvp.pdf', NULL, 2),

  (1, 'LINK',
   'Nielsen — 10 heuristicas de usabilidade',
   'Referencia classica para avaliar a usabilidade do seu MVP.',
   ARRAY['Produto','MVP'],
   'https://www.nngroup.com/articles/ten-usability-heuristics/', NULL, NULL, 2);


-- Blocos da aula do Canvas.
INSERT INTO conteudo_bloco (id_conteudo, tipo, ordem, texto, url, nome, variante)
SELECT c.id_conteudo, b.tipo::blocoTipo, b.ordem, b.texto, b.url, b.nome, b.variante
FROM conteudo c,
(VALUES
  ('h1',        1, 'Business Model Canvas', NULL, NULL, NULL),
  ('paragrafo', 2, 'O Canvas e um mapa de uma pagina que descreve como sua startup cria, entrega e captura valor. Ele substitui dezenas de paginas de plano de negocio.', NULL, NULL, NULL),
  ('callout',   3, 'Preencha primeiro a Proposta de Valor e os Segmentos de Cliente. O resto do Canvas se organiza em torno desses dois.', NULL, NULL, 'dica'),
  ('h2',        4, 'Os 9 blocos', NULL, NULL, NULL),
  ('lista',     5, 'Segmentos de Cliente — para quem voce cria valor', NULL, NULL, NULL),
  ('lista',     6, 'Proposta de Valor — que problema voce resolve', NULL, NULL, NULL),
  ('lista',     7, 'Canais — como voce entrega e se comunica', NULL, NULL, NULL),
  ('lista',     8, 'Fontes de Receita — como o dinheiro entra', NULL, NULL, NULL),
  ('video',     9, '', 'https://www.youtube.com/watch?v=QoAOzMTLP5s', 'Alex Osterwalder explica o Canvas (2 min)', NULL)
) AS b(tipo, ordem, texto, url, nome, variante)
WHERE c.id_tenant = 1 AND c.titulo = 'Business Model Canvas na pratica';


-- Blocos da aula de pitch.
INSERT INTO conteudo_bloco (id_conteudo, tipo, ordem, texto, url, nome, variante)
SELECT c.id_conteudo, b.tipo::blocoTipo, b.ordem, b.texto, b.url, b.nome, b.variante
FROM conteudo c,
(VALUES
  ('h1',        1, 'Seu primeiro pitch', NULL, NULL, NULL),
  ('paragrafo', 2, 'Um bom pitch nao lista funcionalidades — ele conta uma historia: problema, solucao, mercado, tracao e time.', NULL, NULL, NULL),
  ('callout',   3, 'Regra dos 10/20/30: 10 slides, 20 minutos, fonte 30pt.', NULL, NULL, 'atencao'),
  ('h2',        4, 'A sequencia que funciona', NULL, NULL, NULL),
  ('lista',     5, 'Problema — a dor, com evidencia', NULL, NULL, NULL),
  ('lista',     6, 'Solucao — como voce resolve, em uma frase', NULL, NULL, NULL),
  ('lista',     7, 'Mercado — quanto vale resolver isso', NULL, NULL, NULL),
  ('lista',     8, 'Tracao — o que ja aconteceu de real', NULL, NULL, NULL),
  ('divisor',   9, '', NULL, NULL, NULL),
  ('paragrafo',10, 'Termine sempre com um pedido claro: o que voce quer de quem esta ouvindo.', NULL, NULL, NULL)
) AS b(tipo, ordem, texto, url, nome, variante)
WHERE c.id_tenant = 1 AND c.titulo = 'Estruturando seu primeiro pitch';


-- ---------------------------------------------------------------------------
-- 3. TRILHA — Programa > Fases > Modulos > Passos.
--
-- Os ids sao gerados pelo banco, entao cada nivel e inserido a partir do
-- anterior, casando pelo nome dentro do pai (unico neste seed).
-- ---------------------------------------------------------------------------

-- 3a. Programa (raiz)
INSERT INTO trilha_no (id_tenant, id_pai, tipo, nome, descricao, ordem)
VALUES (1, NULL, 'PROGRAMA', 'Trilha de Incubacao 2026',
        'Programa completo: da ideacao ao produto validado no mercado.', 1);

-- 3b. Fases
INSERT INTO trilha_no (id_tenant, id_pai, tipo, nome, descricao, ordem, ativo)
SELECT 1, p.id_no, 'FASE', f.nome, f.descricao, f.ordem, f.ativo
FROM trilha_no p,
(VALUES
  ('Ideacao',   'Estruturar a ideia, o problema e as primeiras hipoteses.', 1, TRUE),
  ('Validacao', 'Testar hipoteses com clientes reais e medir tracao.',      2, TRUE),
  ('Tracao',    'Escalar o que funciona e preparar para investimento.',     3, TRUE)
) AS f(nome, descricao, ordem, ativo)
WHERE p.id_tenant = 1 AND p.tipo = 'PROGRAMA';

-- 3c. Modulos
INSERT INTO trilha_no (id_tenant, id_pai, tipo, nome, descricao, ordem)
SELECT 1, f.id_no, 'MODULO', m.nome, m.descricao, m.ordem
FROM trilha_no f,
(VALUES
  ('Ideacao',   'Problema',           'Entender a dor antes de pensar em solucao.', 1),
  ('Ideacao',   'Modelo de Negocio',  'Desenhar como a startup gera e captura valor.', 2),
  ('Validacao', 'Mercado',            'Dimensionar e testar o mercado alcancavel.', 1),
  ('Validacao', 'MVP',                'Construir a menor versao testavel do produto.', 2),
  ('Tracao',    'Investimento',       'Preparar a startup para captar.', 1)
) AS m(fase, nome, descricao, ordem)
WHERE f.id_tenant = 1 AND f.tipo = 'FASE' AND f.nome = m.fase;

-- 3d. Passos (com a moldura pedagogica que a Jornada mostra)
INSERT INTO trilha_no (
    id_tenant, id_pai, tipo, nome, descricao, ordem,
    tipo_passo, permite_entrega, obrigatoria,
    carga_horaria, entregavel, objetivo, porque, competencias, area
)
SELECT 1, m.id_no, 'PASSO', p.nome, p.descricao, p.ordem,
       p.tipo_passo::tarefaTipo, TRUE, TRUE,
       p.carga, p.entregavel, p.objetivo, p.porque, p.competencias, p.area
FROM trilha_no m
JOIN trilha_no f ON f.id_no = m.id_pai,
(VALUES
  ('Ideacao', 'Problema', 'Descoberta do problema', 'Entrevistar potenciais clientes para validar a dor.', 1,
   'TEXTO', '4h', 'Relato de 5 entrevistas',
   'Provar que existe um problema real e doloroso.',
   'Sem um problema validado, qualquer solucao e um chute caro.',
   ARRAY['Pesquisa','Entrevista'], 'Problema'),

  ('Ideacao', 'Problema', 'Persona do cliente', 'Mapear o cliente ideal e suas dores.', 2,
   'ANEXO', '2h', 'Ficha de persona',
   'Definir para quem voce resolve o problema.',
   'A persona orienta produto, canais e comunicacao.',
   ARRAY['Pesquisa'], 'Cliente'),

  ('Ideacao', 'Modelo de Negocio', 'Business Model Canvas', 'Preencher os 9 blocos do Canvas.', 1,
   'ANEXO', '3h', 'Canvas preenchido (PDF)',
   'Desenhar como a startup cria, entrega e captura valor.',
   'O Canvas revela em uma pagina onde o modelo ainda nao fecha.',
   ARRAY['Modelagem de negocio'], 'Modelo'),

  ('Ideacao', 'Modelo de Negocio', 'Proposta de valor', 'Definir a proposta de valor unica.', 2,
   'TEXTO', '2h', 'Value Proposition Canvas',
   'Dizer em uma frase por que escolher voce.',
   'Se a proposta nao cabe numa frase, o cliente nao vai entender.',
   ARRAY['Comunicacao','Modelagem de negocio'], 'Modelo'),

  ('Ideacao', 'Modelo de Negocio', 'Hipoteses de receita', 'Levantar como a startup vai cobrar.', 3,
   'TEXTO', '2h', 'Lista de hipoteses de precificacao',
   'Definir as apostas de como o dinheiro entra.',
   'Modelo de receita nao testado e a causa mais comum de startup sem caixa.',
   ARRAY['Modelagem de negocio','Financas'], 'Financas'),

  ('Validacao', 'Mercado', 'Definir o mercado (TAM/SAM/SOM)', 'Calcular o tamanho do mercado alcancavel.', 1,
   'ANEXO', '4h', 'Planilha TAM/SAM/SOM preenchida',
   'Dimensionar o mercado alcancavel da sua startup.',
   'Sem tamanho de mercado nao ha pitch nem tese de investimento.',
   ARRAY['Analise de mercado','Pesquisa'], 'Mercado'),

  ('Validacao', 'Mercado', 'Entrevistas com clientes', 'Rodar entrevistas seguindo o Mom Test.', 2,
   'TEXTO', '6h', 'Sintese das entrevistas',
   'Testar as hipoteses com quem tem o problema.',
   'Opiniao de amigo nao valida nada; comportamento valida.',
   ARRAY['Entrevista','Pesquisa'], 'Cliente'),

  ('Validacao', 'MVP', 'Landing page', 'Publicar uma landing para captar interesse.', 1,
   'TEXTO', '3h', 'URL da landing publicada',
   'Medir interesse real antes de construir o produto.',
   'Uma landing custa horas; um produto errado custa meses.',
   ARRAY['Produto','Design'], 'Produto'),

  ('Validacao', 'MVP', 'Teste de usabilidade', 'Avaliar o MVP com as heuristicas de Nielsen.', 2,
   'ANEXO', '3h', 'Relatorio de usabilidade',
   'Encontrar onde o usuario trava antes de escalar.',
   'Problema de usabilidade vira custo de suporte e churn.',
   ARRAY['Produto','Design'], 'Produto'),

  ('Tracao', 'Investimento', 'Primeiro pitch deck', 'Montar o deck de 10 slides.', 1,
   'ANEXO', '5h', 'Deck em PDF',
   'Contar a historia da startup para investidores.',
   'O deck e o que abre (ou fecha) a primeira reuniao.',
   ARRAY['Pitch','Comunicacao'], 'Financas')
) AS p(fase, modulo, nome, descricao, ordem, tipo_passo, carga, entregavel,
       objetivo, porque, competencias, area)
WHERE m.id_tenant = 1 AND m.tipo = 'MODULO'
  AND f.nome = p.fase AND m.nome = p.modulo;


-- ---------------------------------------------------------------------------
-- 4. Vinculo trilha <-> Biblioteca: o que cada passo ensina.
-- ---------------------------------------------------------------------------
INSERT INTO trilha_conteudo (id_no, id_conteudo, ordem)
SELECT n.id_no, c.id_conteudo, v.ordem
FROM trilha_no n, conteudo c,
(VALUES
  ('Descoberta do problema',        'Como conduzir entrevistas de validacao', 1),
  ('Entrevistas com clientes',      'Como conduzir entrevistas de validacao', 1),
  ('Business Model Canvas',         'Business Model Canvas na pratica',       1),
  ('Proposta de valor',             'Business Model Canvas na pratica',       1),
  ('Definir o mercado (TAM/SAM/SOM)','Planilha de mercado (TAM / SAM / SOM)',  1),
  ('Landing page',                  'Guia de metricas para MVP',              1),
  ('Teste de usabilidade',          'Nielsen — 10 heuristicas de usabilidade', 1),
  ('Primeiro pitch deck',           'Estruturando seu primeiro pitch',        1)
) AS v(passo, conteudo, ordem)
WHERE n.id_tenant = 1 AND n.tipo = 'PASSO' AND n.nome = v.passo
  AND c.id_tenant = 1 AND c.titulo = v.conteudo;


-- ---------------------------------------------------------------------------
-- 5. JORNADA — entregas da FlipTech em estados variados.
--
-- A ideia e a Jornada abrir mostrando cada situacao possivel de uma vez:
--   Descoberta do problema -> APROVADO   (entrega + avaliacao aprovada)
--   Persona do cliente     -> APROVADO
--   Business Model Canvas  -> AJUSTE     (avaliacao pedindo correcao)
--   Proposta de valor      -> AGUARDANDO (enviada, sem avaliacao)
--   Hipoteses de receita   -> RASCUNHO   (salva, nao enviada)
--   os demais              -> NAO_INICIADA
--
-- Todos os cinco estados ficam na fase Ideacao, que e a liberada: as fases
-- seguintes comecam bloqueadas, e nelas o incubado nem teria como salvar.
-- ---------------------------------------------------------------------------

-- Entregas enviadas (usuario 3 = Flavia, a incubada).
INSERT INTO entrega (id_no, id_startup, id_usuario, texto_resposta, anexos, status)
SELECT n.id_no, 1, 3, e.resposta, e.anexos, e.status::entregaStatus
FROM trilha_no n,
(VALUES
  ('Descoberta do problema',
   'Entrevistamos 7 gestores de pequenas lojas. Todos relataram perder vendas por falta de controle de estoque em tempo real. Cinco ja tentaram planilhas e abandonaram.',
   ARRAY['entrevistas-consolidado.pdf'], 'ENVIADA'),

  ('Persona do cliente',
   'Persona principal: Marcia, 38 anos, dona de duas lojas de roupa, 4 funcionarios, usa WhatsApp para tudo e nao tem sistema.',
   ARRAY['persona-marcia.pdf'], 'ENVIADA'),

  ('Business Model Canvas',
   'Canvas preenchido com foco em assinatura mensal para lojistas.',
   ARRAY['canvas-fliptech.pdf'], 'ENVIADA'),

  ('Proposta de valor',
   'Controle de estoque que funciona pelo WhatsApp, sem instalar nada e sem treinamento.',
   ARRAY[]::TEXT[], 'ENVIADA'),

  -- Rascunho fica na fase liberada: um rascunho em fase bloqueada seria um
  -- estado que o sistema nao produz (o incubado nem chega la para salvar).
  ('Hipoteses de receita',
   'Rascunho: assinatura mensal por loja parece o caminho, mas ainda estamos testando a faixa de preco.',
   ARRAY[]::TEXT[], 'RASCUNHO')
) AS e(passo, resposta, anexos, status)
WHERE n.id_tenant = 1 AND n.tipo = 'PASSO' AND n.nome = e.passo;


-- Avaliacoes do mentor (usuario 2 = Admin, mentor da FlipTech).
INSERT INTO avaliacao (id_entrega, id_avaliador, status, nota, comentario)
SELECT e.id_entrega, 2, a.status, a.nota, a.comentario
FROM entrega e
JOIN trilha_no n ON n.id_no = e.id_no,
(VALUES
  ('Descoberta do problema', 'APROVADO', 9.5,
   'Excelente. As 7 entrevistas mostram um padrao claro e voces evitaram perguntas enviesadas.'),
  ('Persona do cliente', 'APROVADO', 9.0,
   'Persona bem fundamentada nas entrevistas. Segue firme.'),
  ('Business Model Canvas', 'AJUSTE', NULL,
   'O bloco de Fontes de Receita esta generico. Detalhe o preco da assinatura e como chegou nele.')
) AS a(passo, status, nota, comentario)
WHERE e.id_startup = 1 AND n.nome = a.passo;


-- Progresso por fase: a Ideacao ainda nao fechou (o Canvas voltou para ajuste).
INSERT INTO startup_trilha (id_startup, id_no, status)
SELECT 1, n.id_no, 'EM_ANDAMENTO'
FROM trilha_no n
WHERE n.id_tenant = 1 AND n.tipo = 'FASE' AND n.nome = 'Ideacao';

COMMIT;

-- ===========================================================================
-- Resumo do que ficou (confira com):
--   SELECT tipo, COUNT(*) FROM trilha_no WHERE id_tenant=1 GROUP BY tipo;
--   SELECT COUNT(*) FROM conteudo WHERE id_tenant=1;
-- ===========================================================================
