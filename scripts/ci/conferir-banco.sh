#!/usr/bin/env bash
# ===========================================================================
# Ensaio do deploy do banco, contra um Postgres descartavel.
#
# Responde, ANTES do merge, as tres perguntas que hoje so o servidor
# respondia:
#
#   1. As migracoes novas aplicam num banco no estado da base?
#      Monta `pelo_deploy` com o schema.sql da BASE, carimba as migracoes da
#      base (como num ambiente que ja esta no ar) e aplica as deste PR — o
#      mesmo caminho do `migracao` no deploy.
#
#   2. Um ambiente NOVO nasce certo?
#      Monta `pelo_schema` com o schema.sql deste PR e os seeds de dev.
#
#   3. Os dois sao o mesmo banco?
#      Se nao forem, o schema.sql ficou para tras (ou a migracao faltou).
#
# USO
#   scripts/ci/conferir-banco.sh <ref-base>
#
# Precisa de psql, node (com `npm ci` feito em backend/) e das variaveis
# PGHOST, PGPORT, PGUSER e PGPASSWORD apontando para um Postgres onde se possa
# criar e apagar bancos. NUNCA aponte para um banco de verdade: os dois bancos
# acima sao recriados do zero a cada execucao.
# ===========================================================================
set -euo pipefail

BASE="${1:?uso: $0 <ref-base>}"
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$RAIZ"

: "${PGHOST:?defina PGHOST}" "${PGUSER:?defina PGUSER}" "${PGPASSWORD:?defina PGPASSWORD}"
export PGPORT="${PGPORT:-5432}"
# Os NOTICE do schema.sql ("trigger ... does not exist, skipping") so poluem o log.
export PGOPTIONS="-c client_min_messages=warning"

# O migrar.js e o conferirBanco.js leem DB_*; o psql le PG*. Uma fonte so.
export DB_HOST="$PGHOST" DB_PORT="$PGPORT" DB_USER="$PGUSER" DB_PASSWORD="$PGPASSWORD"

psql_em() { local banco="$1"; shift; psql -X -q -v ON_ERROR_STOP=1 -d "$banco" "$@"; }

recriar() {
  psql_em postgres -c "DROP DATABASE IF EXISTS $1" -c "CREATE DATABASE $1"
}

etapa() { echo; echo "=== $*"; }

# --- 0. regras de nome e edicao -------------------------------------------
etapa "regras das migracoes (contra $BASE)"
node backend/scripts/conferirBanco.js nomes "$BASE"

# A base inteira num diretorio a parte: schema.sql e migracoes como estavam.
BASE_DIR="$(mktemp -d)"
trap 'rm -rf "$BASE_DIR"' EXIT
git archive "$BASE" database | tar -x -C "$BASE_DIR"

# --- 1. o caminho do deploy -----------------------------------------------
etapa "pelo_deploy: schema.sql da base + migracoes deste PR"
recriar pelo_deploy
psql_em pelo_deploy -f "$BASE_DIR/database/schema.sql" > /dev/null

# O ambiente no ar: tudo da base ja aplicado.
DB_NAME=pelo_deploy MIGRACOES_DIR="$BASE_DIR/database/migrations" \
  MIGRACAO_PRIMEIRA_VEZ=baseline node backend/scripts/migrar.js

# O deploy: aplica so o que este PR trouxe.
DB_NAME=pelo_deploy MIGRACOES_DIR="$RAIZ/database/migrations" \
  node backend/scripts/migrar.js

# --- 2. o caminho do ambiente novo ----------------------------------------
etapa "pelo_schema: schema.sql deste PR + seeds de dev"
recriar pelo_schema
psql_em pelo_schema -f database/schema.sql > /dev/null
# Os seeds rodam no primeiro boot do dev; quebrar aqui e quebrar o dev novo.
psql_em pelo_schema -f database/seed.sql > /dev/null
psql_em pelo_schema -f database/seed_exemplo.sql > /dev/null

DB_NAME=pelo_schema MIGRACOES_DIR="$RAIZ/database/migrations" \
  MIGRACAO_PRIMEIRA_VEZ=baseline node backend/scripts/migrar.js

# --- 3. os dois sao o mesmo banco? ----------------------------------------
etapa "pelo_deploy x pelo_schema"
node backend/scripts/conferirBanco.js comparar pelo_deploy pelo_schema

echo
echo "banco conferido."
