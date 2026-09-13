-- ===========================================================================
-- 018 — Documento da AULA (editor de blocos BlockNote)
--
-- CONTEXTO
-- Ate aqui o corpo de uma AULA vivia em `conteudo_bloco`: uma linha por
-- bloco, com um enum de oito tipos (h1, h2, paragrafo, lista, callout,
-- video, arquivo, divisor) e um TEXT plano por bloco. O formato dava conta
-- do editor antigo, em que um bloco era um campo de texto e nada mais.
--
-- O editor novo e baseado no BlockNote, e um bloco passa a ter ESTRUTURA:
-- texto com negrito/italico/codigo/link no meio da frase, listas aninhadas,
-- checklist, citacao, bloco de codigo com linguagem, tabela, imagem. Nada
-- disso cabe em "uma linha com um TEXT" sem inventar um formato de
-- serializacao proprio — que e exatamente o que uma coluna JSONB evita.
--
-- FORMATO
-- O documento do BlockNote e uma lista de blocos, cada um com tipo, props,
-- conteudo inline e filhos. E a FONTE DE VERDADE: o HTML e so uma
-- renderizacao, gerada na leitura, nunca gravada. Guardar HTML aqui
-- significaria nao conseguir mais editar de volta sem parsear marcacao.
--
-- JSONB e nao JSON: o banco normaliza e guarda em forma binaria, o que
-- torna o documento inspecionavel por SQL se um dia precisarmos migrar um
-- tipo de bloco em massa. Nao ha indice porque nada consulta DENTRO do
-- documento — a busca do acervo olha titulo, resumo e tags.
--
-- COMPATIBILIDADE (o ponto importante)
-- A coluna nasce NULA e `conteudo_bloco` NAO e apagada. Aula antiga
-- continua com documento NULL e os blocos no lugar; a API converte o
-- formato antigo para documento na LEITURA (bibliotecaRepository e
-- jornadaService, via services/documentoAula.js), entao editor e leitor
-- recebem sempre o formato novo sem que nada tenha sido reescrito aqui.
--
-- A conversao so vira gravacao quando o autor salva a aula pela primeira
-- vez no editor novo: ai o documento e gravado nesta coluna e as linhas de
-- `conteudo_bloco` daquele conteudo sao removidas, para nao restarem duas
-- versoes do mesmo corpo divergindo em silencio.
--
-- Nao ha backfill em massa de proposito: converter tudo de uma vez
-- significaria reescrever todo o acervo de todas as incubadoras numa
-- transacao, sem ninguem conferir o resultado. Convertendo na leitura, o
-- autor VE a aula convertida no editor antes de salvar.
--
-- NAO-DESTRUTIVA: so adiciona uma coluna anulavel.
--
-- COMO RODAR
--   psql -d <base> -f database/migrations/018_conteudo_documento.sql
-- ===========================================================================

BEGIN;

ALTER TABLE conteudo
    ADD COLUMN IF NOT EXISTS documento JSONB;

COMMENT ON COLUMN conteudo.documento IS
    'Corpo da AULA no formato BlockNote (lista de blocos). Fonte de verdade. '
    'NULL = aula ainda no formato antigo, em conteudo_bloco; a API converte na leitura.';

COMMIT;
