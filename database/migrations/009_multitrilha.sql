-- ===========================================================================
-- 009 — Varias trilhas por incubadora + matricula da startup
--
-- CONTEXTO
-- A migracao 001 ja modelou a trilha como uma arvore auto-referenciada cujo
-- no raiz e um PROGRAMA, e `arvorePorTenant` sempre devolveu uma LISTA de
-- raizes. Ou seja: o banco nunca proibiu mais de uma trilha por tenant. Quem
-- limitava era o front, em `usePrograma` — `const raiz = data.trilha[0]`.
--
-- So que "varias trilhas" nao e so deixar de pegar o [0]. Faltavam tres
-- coisas que nao tinham onde morar:
--
--   1. QUEM faz QUAL trilha. Ate aqui a Jornada carregava todos os nos ativos
--      do tenant (jornadaRepository.carregar filtra so por id_tenant). Com
--      duas trilhas, toda startup passaria a ver as duas fundidas numa arvore
--      so — por isso a matricula precisa existir ANTES de a segunda trilha
--      ser criavel pela interface.
--   2. Qual trilha e a PADRAO, para o cadastro de startup ja vir preenchido.
--   3. O historico: uma startup que terminou a trilha de Ideacao e entrou na
--      de Aceleracao precisa continuar vendo a primeira como concluida.
--
-- O QUE NAO MUDA
-- A Biblioteca. `trilha_conteudo` liga conteudo a PASSO, e passos de trilhas
-- diferentes sao linhas diferentes — o mesmo conteudo ja podia ser apontado
-- por N passos, e agora esses passos podem estar em N trilhas. Reaproveitar
-- material entre trilhas funciona sem tocar em nada aqui. O `ON DELETE
-- RESTRICT` continua protegendo: excluir da Biblioteca um conteudo usado em
-- qualquer trilha segue falhando com o aviso de "usado em N passos".
--
-- POR QUE UMA TABELA NOVA E NAO REUSAR startup_trilha
-- `startup_trilha` (ex-`startup_fase`) guarda PROGRESSO por no — na pratica,
-- por FASE, com status EM_ANDAMENTO/APROVADA e `aprovado_por`. E um registro
-- de avanco dentro de uma trilha. Matricula e outra coisa: diz que a startup
-- PERTENCE aquela trilha, existe antes de qualquer progresso e continua
-- existindo depois que a trilha acaba. Misturar as duas faria "startup sem
-- progresso nenhum" e "startup nao matriculada" virarem a mesma linha
-- ausente, e a Jornada nao teria como distinguir "ainda nao comecou" de "nao
-- e desta trilha".
--
-- NAO-DESTRUTIVA
-- Nenhuma linha e removida. O passo 4 matricula toda startup existente na
-- trilha que o tenant dela ja tinha e marca essa trilha como padrao, de modo
-- que o estado depois da migracao e igual ao de antes aos olhos do usuario.
--
-- COMO RODAR
--   psql -d <base> -f database/migrations/009_multitrilha.sql
-- Roda inteira dentro de uma transacao: ou aplica tudo, ou nada.
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. A trilha padrao do tenant.
--
--    Fica em `trilha_no` mesmo, e nao numa coluna de `tenant`, porque o dono
--    natural da informacao e a trilha ("esta e a padrao"), e porque assim o
--    indice parcial abaixo garante a unicidade sem trigger nenhum.
-- ---------------------------------------------------------------------------
ALTER TABLE trilha_no
    ADD COLUMN IF NOT EXISTS padrao BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN trilha_no.padrao IS
    'Trilha sugerida no cadastro de startup. So em PROGRAMA, uma por tenant.';

-- Marcar uma FASE como padrao nao significa nada.
ALTER TABLE trilha_no DROP CONSTRAINT IF EXISTS ck_trilha_no_padrao;
ALTER TABLE trilha_no ADD CONSTRAINT ck_trilha_no_padrao CHECK (
    padrao = FALSE OR tipo = 'PROGRAMA'
);

-- Uma padrao por incubadora. Indice PARCIAL: as N trilhas nao-padrao do
-- tenant nao colidem entre si, so a marcada colide com outra marcada.
DROP INDEX IF EXISTS uk_trilha_no_padrao;
CREATE UNIQUE INDEX uk_trilha_no_padrao
    ON trilha_no (id_tenant)
    WHERE padrao AND tipo = 'PROGRAMA';


-- ---------------------------------------------------------------------------
-- 2. Matricula: quais startups fazem qual trilha.
--
--    N:N de proposito. Uma startup pode estar em duas trilhas ao mesmo tempo
--    (a de incubacao e uma de capacitacao pontual) e mantem as concluidas na
--    lista, que e o que a tela "Minha Jornada" mostra como historico.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS startup_programa (
    id_startup INTEGER NOT NULL,
    id_no      INTEGER NOT NULL,   -- sempre um PROGRAMA (raiz), ver trigger

    -- EM_ANDAMENTO -> aparece como trilha atual
    -- CONCLUIDA    -> aparece no historico, somente leitura
    status     VARCHAR(20) NOT NULL DEFAULT 'EM_ANDAMENTO',

    inicio_ts  TIMESTAMP NOT NULL DEFAULT NOW(),
    fim_ts     TIMESTAMP,

    CONSTRAINT pk_startup_programa PRIMARY KEY (id_startup, id_no),

    CONSTRAINT fk_sp_startup
        FOREIGN KEY (id_startup)
        REFERENCES startup (id_startup)
        ON DELETE CASCADE,

    -- CASCADE: excluir a trilha inteira no Construtor tira as matriculas
    -- junto. As ENTREGAS nao somem por isso — elas apontam para os PASSOS,
    -- e a subarvore so cai se o admin confirmar o aviso de exclusao.
    CONSTRAINT fk_sp_no
        FOREIGN KEY (id_no)
        REFERENCES trilha_no (id_no)
        ON DELETE CASCADE,

    CONSTRAINT ck_sp_status
        CHECK (status IN ('EM_ANDAMENTO', 'CONCLUIDA')),

    -- Concluida sem data de fim deixaria o historico sem quando.
    CONSTRAINT ck_sp_fim
        CHECK (status <> 'CONCLUIDA' OR fim_ts IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS ix_sp_no ON startup_programa (id_no);

COMMENT ON TABLE startup_programa IS
    'Matricula da startup numa trilha (PROGRAMA). Progresso fica em startup_trilha.';


-- ---------------------------------------------------------------------------
-- 3. Trigger: a matricula so aceita a RAIZ de uma trilha.
--
--    Um CHECK nao alcanca a linha referenciada, entao a regra vive aqui —
--    mesmo motivo (e mesmo padrao) de fn_trilha_no_hierarquia na 001.
--    Sem isto, matricular a startup numa FASE compilaria e so quebraria na
--    Jornada, longe da causa.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_startup_programa_raiz()
RETURNS TRIGGER AS $$
DECLARE
    tipo_no       trilhaNoTipo;
    tenant_no     INTEGER;
    tenant_start  INTEGER;
BEGIN
    SELECT tipo, id_tenant INTO tipo_no, tenant_no
      FROM trilha_no WHERE id_no = NEW.id_no;

    IF tipo_no IS DISTINCT FROM 'PROGRAMA' THEN
        RAISE EXCEPTION
            'Matricula exige a raiz da trilha (PROGRAMA), recebido % (no %)',
            COALESCE(tipo_no::TEXT, 'inexistente'), NEW.id_no;
    END IF;

    SELECT id_tenant INTO tenant_start
      FROM startup WHERE id_startup = NEW.id_startup;

    -- Matricular a startup de uma incubadora na trilha de outra vazaria
    -- conteudo entre tenants.
    IF tenant_start <> tenant_no THEN
        RAISE EXCEPTION 'Startup e trilha pertencem a incubadoras diferentes';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_startup_programa_raiz ON startup_programa;
CREATE TRIGGER trg_startup_programa_raiz
    BEFORE INSERT OR UPDATE OF id_no, id_startup ON startup_programa
    FOR EACH ROW EXECUTE FUNCTION fn_startup_programa_raiz();


-- ---------------------------------------------------------------------------
-- 4. Backfill — o depois tem que ser igual ao antes.
--
--    Cada tenant tinha no maximo uma trilha, e toda startup dele a enxergava.
--    Reproduzimos isso explicitamente: a trilha existente vira a padrao e
--    todas as startups sao matriculadas nela.
-- ---------------------------------------------------------------------------

-- 4a. A trilha mais antiga de cada tenant vira a padrao (na pratica, a unica).
WITH primeira AS (
    SELECT DISTINCT ON (id_tenant) id_no
      FROM trilha_no
     WHERE tipo = 'PROGRAMA'
     ORDER BY id_tenant, id_no
)
UPDATE trilha_no SET padrao = TRUE
 WHERE id_no IN (SELECT id_no FROM primeira);

-- 4b. Toda startup entra na trilha do proprio tenant.
INSERT INTO startup_programa (id_startup, id_no, status)
SELECT s.id_startup, n.id_no, 'EM_ANDAMENTO'
  FROM startup s
  JOIN trilha_no n
    ON n.id_tenant = s.id_tenant
   AND n.tipo = 'PROGRAMA'
ON CONFLICT (id_startup, id_no) DO NOTHING;

COMMIT;
