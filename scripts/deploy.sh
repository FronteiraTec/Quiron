#!/usr/bin/env bash
# ===========================================================================
# Poe UMA versao no ar num ambiente. Roda NO SERVIDOR.
#
# Quem chama e o deploy.yml, depois de copiar para o diretorio do ambiente os
# arquivos desta mesma versao (compose, nginx, database, scripts). Tambem
# serve a mao, para um rollback:
#
#   cd /opt/quiron/prod
#   scripts/deploy.sh ghcr.io/fronteiratec/quiron-backend:abc1234 \
#                     ghcr.io/fronteiratec/quiron-frontend:abc1234
#
# A ORDEM E O QUE PROTEGE O AMBIENTE
#
#   1. baixa as imagens novas          falhou -> nada mudou
#   2. backup do banco                 falhou -> nada mudou
#   3. aplica as migracoes             falhou -> a API ANTIGA continua no ar
#   4. troca os containers             falhou -> volta as imagens anteriores
#   5. confere a API por dentro        falhou -> volta as imagens anteriores
#
# O passo 3 nao tem volta automatica: migracao aplicada fica aplicada. Por
# isso o backup vem antes dele, e por isso migracao destrutiva (DROP COLUMN,
# rename) vai em duas etapas — ver database/README.md.
#
# O .env do ambiente e o unico arquivo do servidor que o deploy EDITA, e so nas
# duas linhas IMAGEM_*. Segredo nenhum passa por aqui.
# ===========================================================================
set -euo pipefail

NOVO_BACKEND="${1:?uso: $0 <imagem-backend> <imagem-frontend>}"
NOVO_FRONTEND="${2:?uso: $0 <imagem-backend> <imagem-frontend>}"

cd "$(dirname "$0")/.."
AMBIENTE="$(basename "$PWD")"

[ -f .env ] || { echo "ERRO: $PWD/.env nao existe."; exit 1; }

valor() { grep -E "^$1=" .env | head -1 | cut -d= -f2-; }

STACK="$(valor STACK)"
ANTERIOR_BACKEND="$(valor IMAGEM_BACKEND)"
ANTERIOR_FRONTEND="$(valor IMAGEM_FRONTEND)"
BACKUPS="${QUIRON_BACKUP_DIR:-/opt/quiron/backups}/$AMBIENTE"
MANTER_BACKUPS="${QUIRON_BACKUPS_PRE_DEPLOY:-10}"

etapa() { echo; echo "[deploy $AMBIENTE] $*"; }

usar_imagens() {
  sed -i -e "s|^IMAGEM_BACKEND=.*|IMAGEM_BACKEND=$1|" \
         -e "s|^IMAGEM_FRONTEND=.*|IMAGEM_FRONTEND=$2|" .env
}

voltar_imagens() {
  etapa "voltando para $ANTERIOR_BACKEND"
  usar_imagens "$ANTERIOR_BACKEND" "$ANTERIOR_FRONTEND"
}

etapa "$STACK: $ANTERIOR_BACKEND -> $NOVO_BACKEND"

# --- 1. imagens -------------------------------------------------------------
# So as imagens do Quiron. Um `pull` geral traria tambem um postgres:17 novo
# e recriaria o banco no meio do deploy.
usar_imagens "$NOVO_BACKEND" "$NOVO_FRONTEND"
etapa "baixando imagens"
if ! docker compose pull --quiet migracao backend frontend; then
  voltar_imagens
  echo "ERRO: nao consegui baixar as imagens. Nada foi alterado."
  exit 1
fi

# --- 2. backup ---------------------------------------------------------------
docker compose up -d --wait postgres

etapa "backup do banco antes das migracoes"
mkdir -p "$BACKUPS"
DUMP="$BACKUPS/pre-deploy-$(date +%Y%m%d-%H%M%S)-${NOVO_BACKEND##*:}.dump"
# Formato custom (-Fc): comprimido, e o pg_restore escolhe o que restaurar.
if ! docker compose exec -T postgres sh -c 'pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "$DUMP" \
   || [ ! -s "$DUMP" ]; then
  rm -f "$DUMP"
  voltar_imagens
  echo "ERRO: o backup falhou. Sem backup nao aplico migracao; nada foi alterado."
  exit 1
fi
echo "  $DUMP ($(du -h "$DUMP" | cut -f1))"
# Guarda os ultimos N; o backup diario (scripts/backup.sh) cuida do historico.
# shellcheck disable=SC2012  # nomes gerados acima, sem espaco: ls -t basta.
ls -1t "$BACKUPS"/pre-deploy-*.dump 2>/dev/null | tail -n +"$((MANTER_BACKUPS + 1))" | xargs -r rm -f

# --- 3. migracoes ------------------------------------------------------------
etapa "migracoes"
if ! docker compose run --rm migracao; then
  voltar_imagens
  echo "ERRO: migracao falhou. A versao anterior continua no ar."
  echo "      As migracoes rodam uma transacao por arquivo: as que passaram"
  echo "      antes da que falhou ficaram aplicadas. Backup: $DUMP"
  exit 1
fi

# --- 4 e 5. troca e conferencia ----------------------------------------------
etapa "subindo a versao nova"
if docker compose up -d --wait --wait-timeout 180 --remove-orphans \
   && docker compose exec -T backend wget -q -O /dev/null http://localhost:3000/health; then
  etapa "no ar: $NOVO_BACKEND"
else
  docker compose logs --tail=60 backend || true
  voltar_imagens
  docker compose up -d --wait --wait-timeout 180 || true
  echo "ERRO: a versao nova nao ficou saudavel; voltei para $ANTERIOR_BACKEND."
  echo "      Se ela aplicou migracao, o banco continua migrado. Backup: $DUMP"
  exit 1
fi

# Historico do que passou por aqui: data, imagem. `tail .deploys` responde
# "o que estava no ar ontem?" sem abrir o GitHub.
echo "$(date '+%F %T') $NOVO_BACKEND" >> .deploys

# --- limpeza -----------------------------------------------------------------
# So imagens do Quiron (o label vem do deploy.yml): este servidor hospeda
# outros projetos, e um `prune -a` geral apagaria as imagens de rollback
# deles. Uma semana de versoes fica, para rollback.
docker image prune -af --filter "label=br.com.fronteiratec.app=quiron" --filter "until=168h" > /dev/null
df -h / | tail -1 | awk '{print "  disco: " $3 " usados de " $2 " (" $5 ")"}'
