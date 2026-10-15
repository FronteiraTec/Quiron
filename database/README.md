# Banco de dados — como mudar

O histórico do banco é o diretório `migrations/`: um arquivo por mudança,
aplicado uma vez em cada ambiente, na ordem do número. A tabela
`schema_migracao` de cada banco registra o que já rodou nele (nome do arquivo,
checksum e data). Isso **é** o changelog do banco: para saber o que mudou e
quando, leia os arquivos; para saber o que um ambiente tem, consulte a tabela.

```sql
SELECT arquivo, aplicado_ts, baseline FROM schema_migracao ORDER BY arquivo;
```

## Os dois arquivos que andam juntos

| | Para quê | Quem lê |
|---|---|---|
| `migrations/NNN_*.sql` | evoluir um banco que **já existe** | o serviço `migracao`, a cada deploy |
| `schema.sql` | criar um banco **do zero**, já no estado final | o Postgres, só no primeiro boot de um volume vazio |

Toda mudança entra **nos dois**. A CI confere: monta um banco pelo caminho do
deploy (schema da base + migrações novas) e outro pelo `schema.sql` do PR, e
compara tabelas, colunas, constraints, índices, enums, funções, triggers e
views. Esqueceu um dos dois, o PR fica vermelho e mostra a diferença.

## Passo a passo

1. **Crie o arquivo** com o próximo número livre:

   ```
   database/migrations/019_o_que_muda.sql
   ```

   Minúsculas, dígitos e `_`. O número precisa ser **maior** que o da última
   migração da `dev`. Se outro PR usou o mesmo número antes, a CI acusa:
   atualize sua branch e renomeie.

2. **Escreva a mudança.** Comece com um cabeçalho dizendo o porquê — é o que
   alguém vai ler daqui a um ano. Não precisa de `BEGIN`/`COMMIT`: o runner já
   abre uma transação por arquivo.

   Prefira formas que não quebram se rodarem num banco que já tem a mudança:
   `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `DROP ... IF EXISTS`.

3. **Atualize o `schema.sql`** com a mesma mudança, no lugar onde faz sentido
   ler (a coluna nova junto das outras da tabela, não no fim do arquivo).

4. **Teste localmente**:

   ```bash
   docker compose run --rm migracao --conferir   # o que falta, sem escrever
   docker compose run --rm migracao              # aplica no seu banco local
   ```

   E, se tiver `psql` (ou num container), o mesmo ensaio da CI:

   ```bash
   PGHOST=localhost PGPORT=2060 PGUSER=quiron PGPASSWORD=... \
     scripts/ci/conferir-banco.sh origin/dev
   ```

5. **Abra o PR.** O resto é automático: a CI ensaia, o merge na `dev` aplica em
   dev, o merge na `main` aplica em produção — sempre com backup antes.

## As regras (e por que existem)

**Nunca edite nem apague uma migração que já está na `dev`.** Ela já rodou em
algum banco. O runner compara o checksum e **recusa o deploy** se o arquivo
mudou; a CI recusa antes, no PR. Errou? Escreva uma migração nova corrigindo.

**Mudança destrutiva vai em dois deploys.** O rollback do deploy volta a
*imagem*, não o banco. Se a versão nova apagou uma coluna que a anterior lê,
voltar a imagem não adianta. Então:

| Quer | Deploy 1 | Deploy 2 (depois de estável) |
|---|---|---|
| remover coluna | o código para de usar | `DROP COLUMN` |
| renomear coluna | cria a nova, código grava nas duas e lê da nova | remove a antiga |
| `NOT NULL` em coluna existente | preenche os nulos, código sempre grava | `SET NOT NULL` |

**Migração de dados grande** (backfill em milhares de linhas) trava a tabela
durante a transação. Em lotes, ou fora do horário de uso.

## Quando algo dá errado no deploy

O `scripts/deploy.sh` faz, nesta ordem: baixa as imagens → **backup** → aplica
migrações → troca os containers → confere. Se a migração falha, a versão
anterior **continua no ar** e nada foi trocado. As migrações que passaram antes
da que falhou ficam aplicadas (uma transação por arquivo).

O backup de antes de cada deploy fica em
`/opt/quiron/backups/<ambiente>/pre-deploy-*.dump` (os 10 mais recentes).
Para restaurar:

```bash
cd /opt/quiron/prod
docker compose exec -T postgres sh -c \
  'pg_restore --clean --if-exists -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  < /opt/quiron/backups/prod/pre-deploy-AAAAMMDD-HHMMSS-abc1234.dump
```

## Histórico

As duas `013_` são de antes desta regra: dois PRs criaram o mesmo número em
paralelo. Elas continuam valendo (a ordem é pelo nome completo) e não podem ser
renomeadas, porque o nome é a chave em `schema_migracao`. A CI impede que isso
se repita.
