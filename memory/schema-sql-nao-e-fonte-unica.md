---
name: schema-sql-nao-e-fonte-unica
description: schema.sql esta defasado (falta a tabela arquivo) - recriar o volume pgdata do zero quebra os uploads
metadata:
  type: project
---

O `database/schema.sql` **nao** reflete o banco em producao local. A tabela `arquivo` existe so em `database/migrations/007_arquivos.sql` e nunca foi incorporada ao schema.sql.

**Why:** os scripts de init do Postgres (`01-schema.sql`, `02-seed.sql`) so rodam quando o volume `quiron_pgdata` esta vazio. Como as migrations 001-008 foram aplicadas a mao no banco vivo, o banco esta a frente do schema.sql. Um `docker compose down -v` recria tudo a partir do schema.sql e **perde a tabela `arquivo`** — os uploads param de funcionar (ver [[upload-de-arquivos-dois-regimes]]).

**How to apply:** para aplicar mudanca de banco, rode o DDL direto no banco vivo (`docker exec -i postgres_db psql -U admin -d incubadora`), nunca `down -v`. Se um reset do zero for mesmo necessario, primeiro reaplique as migrations 001-008 depois do init, ou folde a tabela `arquivo` no schema.sql. Vale conferir se ha outras divergencias comparando `information_schema.tables` com os `CREATE TABLE` do schema.sql.

Nota: o container `brokkpg_postgres` (postgres:18) **nao** e deste projeto — nao mexer nele.
