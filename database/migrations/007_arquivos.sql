-- ===========================================================================
-- 007 — Upload de arquivos
--
-- CONTEXTO
-- Nao existia upload no sistema. O incubado anexava um PDF na entrega e o
-- front gravava `URL.createObjectURL(f)` — uma `blob:` URL que so vale na aba
-- de quem enviou. Resultado: o MENTOR, que e exatamente quem precisa abrir o
-- anexo para avaliar, recebia um link morto. O laco central do produto
-- (startup entrega -> mentor avalia) estava quebrado no meio.
--
-- ESTA MIGRACAO cria o registro dos arquivos. Os bytes NAO ficam no banco:
-- moram no volume `uploads` do container (ver docker-compose.yml). A tabela
-- guarda o necessario para autorizar, servir e auditar.
--
-- VISIBILIDADE — o campo que decide como o arquivo e servido:
--
--   PRIVADO  anexo de entrega. Trabalho confidencial de uma startup. So sai
--            pela API, com token e permissao (avaliacoes.entregas.baixar).
--   PUBLICO  imagem de interface (logo, avatar). Sai sem token, porque uma tag
--            <img src> do navegador NAO envia cabecalho Authorization — exigir
--            token deixaria toda imagem quebrada. A protecao aqui e o nome
--            armazenado ser aleatorio e nao adivinhavel; vazar um logo nao e
--            incidente, vazar o plano de negocio de uma startup e.
--
-- `nome_armazenado` e o nome no disco (aleatorio); `nome_original` e o que o
-- usuario ve. Separar os dois evita colisao entre dois "contrato.pdf" e impede
-- que o nome enviado pelo cliente vire caminho (../../etc/passwd).
-- ===========================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS arquivo (
    id_arquivo      UUID NOT NULL DEFAULT gen_random_uuid(),

    -- Dono. O tenant e quem autoriza: um arquivo privado so e servido a quem
    -- tem permissao NAQUELA incubadora.
    id_tenant       INTEGER NOT NULL,
    enviado_por     INTEGER NOT NULL,

    nome_original   TEXT NOT NULL,
    nome_armazenado TEXT NOT NULL,
    mime            VARCHAR(120) NOT NULL,
    tamanho         BIGINT NOT NULL,

    visibilidade    VARCHAR(10) NOT NULL DEFAULT 'PRIVADO',

    criado_ts       TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_arquivo PRIMARY KEY (id_arquivo),
    CONSTRAINT uq_arquivo_nome_armazenado UNIQUE (nome_armazenado),
    CONSTRAINT ck_arquivo_visibilidade CHECK (visibilidade IN ('PUBLICO', 'PRIVADO')),
    CONSTRAINT ck_arquivo_tamanho CHECK (tamanho > 0),

    CONSTRAINT fk_arquivo_tenant FOREIGN KEY (id_tenant)
      REFERENCES tenant (id_tenant) ON DELETE CASCADE,
    CONSTRAINT fk_arquivo_usuario FOREIGN KEY (enviado_por)
      REFERENCES usuarios (id_usuario)
);

-- A listagem util e "os arquivos desta incubadora, mais recentes primeiro".
CREATE INDEX IF NOT EXISTS ix_arquivo_tenant ON arquivo (id_tenant, criado_ts DESC);

COMMIT;

-- ===========================================================================
-- NOTA SOBRE OS ANEXOS ANTIGOS
--
-- `entrega.anexos` (TEXT[]) tem linhas legadas em dois formatos: JSON com
-- `blob:` URL (o front antigo) e nome puro de arquivo (o seed). Nenhum dos dois
-- aponta para arquivo que exista — nao ha o que migrar, os bytes nunca
-- chegaram ao servidor. Ficam como estao; `anexoAcessivel()` no front ja os
-- exibe como indisponiveis, e os anexos novos passam a trazer `id_arquivo`.
-- ===========================================================================
