#!/usr/bin/env bash
# ===========================================================================
# Backup de um ambiente: o banco e os arquivos enviados.
#
# Sao as duas coisas do servidor que NAO existem em outro lugar. O codigo esta
# no git, as imagens estao no GHCR, o .env voce consegue reescrever — mas a
# entrega que uma startup subiu ontem existe uma vez so.
#
# USO
#   ./scripts/backup.sh prod
#   ./scripts/backup.sh dev
#
# NO CRON (todo dia as 3h, guardando o log):
#   0 3 * * * /opt/quiron/prod/scripts/backup.sh prod >> /opt/quiron/backups/backup.log 2>&1
#
# RESTAURAR (o passo que ninguem testa e todo mundo precisa um dia):
#   gunzip -c banco-AAAA-MM-DD.sql.gz | docker compose exec -T postgres psql -U quiron -d quiron
#   docker run --rm -v quiron-prod_uploads:/destino -v "$PWD":/origem alpine \
#     tar xzf /origem/uploads-AAAA-MM-DD.tar.gz -C /destino
# ===========================================================================
set -euo pipefail

AMBIENTE="${1:?uso: $0 prod|dev}"
RAIZ="/opt/quiron/$AMBIENTE"
DESTINO="${QUIRON_BACKUP_DIR:-/opt/quiron/backups}/$AMBIENTE"
MANTER_DIAS="${QUIRON_BACKUP_DIAS:-14}"

DATA=$(date +%Y-%m-%d-%H%M)

cd "$RAIZ"
mkdir -p "$DESTINO"

# As credenciais saem do .env do proprio ambiente — nao ficam escritas aqui.
set -a
# shellcheck disable=SC1091
source .env
set +a

echo "[$(date '+%F %T')] backup de $AMBIENTE iniciado"

# --- Banco -----------------------------------------------------------------
# `pg_dump` de dentro do container: o Postgres nao publica porta no host, e e
# assim que deve continuar (achado QRN-03 da auditoria).
docker compose exec -T postgres \
  pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists \
  | gzip > "$DESTINO/banco-$DATA.sql.gz"

# Um dump que falhou no meio tambem gera arquivo — pequeno, e inutil no dia em
# que for preciso. Conferir o tamanho aqui e mais barato que descobrir depois.
TAMANHO=$(stat -c%s "$DESTINO/banco-$DATA.sql.gz")
if [ "$TAMANHO" -lt 10000 ]; then
  echo "ERRO: o dump saiu com $TAMANHO bytes — pequeno demais para estar certo."
  exit 1
fi

# --- Arquivos enviados -----------------------------------------------------
VOLUME="${STACK}_uploads"
docker run --rm \
  -v "$VOLUME":/dados:ro \
  -v "$DESTINO":/backup \
  alpine tar czf "/backup/uploads-$DATA.tar.gz" -C /dados .

# --- Rotacao ---------------------------------------------------------------
find "$DESTINO" -name 'banco-*.sql.gz'    -mtime +"$MANTER_DIAS" -delete
find "$DESTINO" -name 'uploads-*.tar.gz'  -mtime +"$MANTER_DIAS" -delete

echo "[$(date '+%F %T')] backup de $AMBIENTE concluido:"
echo "  banco:   $(du -h "$DESTINO/banco-$DATA.sql.gz" | cut -f1)"
echo "  uploads: $(du -h "$DESTINO/uploads-$DATA.tar.gz" | cut -f1)"
echo
echo "  LEMBRETE: backup que so existe no mesmo servidor nao e backup."
echo "  Configure uma copia para fora (rclone, scp, S3) deste diretorio."
