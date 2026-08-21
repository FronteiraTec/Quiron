-- ===========================================================================
-- 015 — Anexos de tarefa
--
-- CONTEXTO
-- A tarefa nasceu (migracao 014) com titulo, descricao e campos
-- personalizaveis. Na pratica falta o mais comum: "revisar o contrato da Acme"
-- pede O CONTRATO junto, e sem lugar para ele o arquivo circula por e-mail e a
-- tarefa vira um lembrete de procurar o anexo em outro lugar.
--
-- TABELA DE LIGACAO, e nao uma coluna `anexos` na tarefa. `evento.anexos` e
-- `entrega.anexos` sao JSONB/TEXT[] por razoes historicas, e a migracao 007
-- registra o preco disso: linhas antigas em tres formatos diferentes, nenhuma
-- apontando para arquivo que exista. Aqui a referencia e uma FK de verdade
-- para `arquivo`, o que garante que:
--
--   1. anexo listado numa tarefa E um arquivo que existe;
--   2. desanexar nao exige reescrever um documento inteiro;
--   3. da para responder "esta tarefa pode ver este arquivo?" numa consulta —
--      que e exatamente o que a rota de download precisa perguntar.
--
-- O ITEM 3 E O MOTIVO PRINCIPAL. `arquivoService.abrir` autoriza um arquivo
-- PRIVADO por dono-ou-chave-de-entregas, o que nao serve para tarefa: quem
-- precisa abrir o anexo e quem enxerga a tarefa. Com esta tabela, o modulo de
-- tarefas autoriza pela PROPRIA regra de visibilidade e so entao pede os bytes
-- — ver tarefaService.abrirAnexo.
--
-- ON DELETE CASCADE nos dois lados: a linha aqui e so o vinculo. Tarefa
-- excluida nao deixa vinculo orfao; arquivo removido tambem nao. Os BYTES do
-- arquivo continuam sendo assunto do arquivoService — desanexar nao apaga o
-- arquivo, que pode estar anexado em outro lugar.
-- ===========================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS tarefa_anexo (
    id_tarefa  INTEGER   NOT NULL,
    id_arquivo UUID      NOT NULL,
    -- Quem anexou. Nao e o mesmo que `arquivo.enviado_por`: um arquivo ja
    -- enviado pode ser anexado a uma tarefa por outra pessoa.
    anexado_por INTEGER,
    criado_ts  TIMESTAMP NOT NULL DEFAULT NOW(),

    -- O mesmo arquivo duas vezes na mesma tarefa seria a mesma linha na tela,
    -- duplicada, sem jeito de dizer qual remover.
    CONSTRAINT pk_tarefa_anexo PRIMARY KEY (id_tarefa, id_arquivo),

    CONSTRAINT fk_tarefa_anexo_tarefa
        FOREIGN KEY (id_tarefa) REFERENCES tarefa (id_tarefa) ON DELETE CASCADE,

    CONSTRAINT fk_tarefa_anexo_arquivo
        FOREIGN KEY (id_arquivo) REFERENCES arquivo (id_arquivo) ON DELETE CASCADE,

    CONSTRAINT fk_tarefa_anexo_usuario
        FOREIGN KEY (anexado_por) REFERENCES usuarios (id_usuario) ON DELETE SET NULL
);

-- "Os anexos desta tarefa" e a consulta que a tela faz; a PK ja a atende.
-- Este indice atende a outra direcao: "este arquivo esta anexado em alguma
-- tarefa?", que e o que a autorizacao de download pergunta.
CREATE INDEX IF NOT EXISTS ix_tarefa_anexo_arquivo ON tarefa_anexo (id_arquivo);

COMMIT;
