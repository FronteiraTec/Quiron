#!/usr/bin/env bash
# ===========================================================================
# O GATILHO do lote noturno das reunioes (docs/reunioes.md, secao 3.4).
#
# O cron do usuario `deploy` chama este script a cada 30 minutos, uma linha
# por ambiente:
#
#   */30 * * * * bash /opt/quiron/<amb>/scripts/processamento.sh >> /opt/quiron/<amb>/processamento.log 2>&1
#
# (`bash` na frente: o deploy copia o arquivo sem garantir o bit de execucao.)
#
# O cron so bate na porta; quem decide e este script. Ele NAO sobe container
# nenhum fora da janela nem com a maquina carregada — o processamento pesado
# (ffmpeg, chamadas ao provedor) nao divide memoria com o expediente. Dentro
# da janela, roda `docker compose run --rm processamento`, com `flock` para
# nunca haver dois ao mesmo tempo. O worker confere a janela de novo antes de
# cada item e sai sozinho.
#
# As variaveis vem do .env do ambiente (as mesmas do worker):
#   PROCESSAMENTO_JANELA (19:00-07:00), PROCESSAMENTO_FIM_DE_SEMANA (true),
#   PROCESSAMENTO_CARGA_MAX (0.6), PROCESSAMENTO_MEMORIA_MIN_MB (500),
#   TZ_AGENDA (America/Sao_Paulo), STACK.
# ===========================================================================
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

# Le uma variavel do .env sem executar o arquivo (ele pode ter valores com espaco).
ler() {
  local valor
  valor="$(grep -E "^$1=" .env 2>/dev/null | tail -n 1 | cut -d= -f2- || true)"
  valor="${valor%\"}"; valor="${valor#\"}"; valor="${valor%\'}"; valor="${valor#\'}"
  printf '%s' "${valor:-$2}"
}

STACK="$(ler STACK quiron)"
JANELA="$(ler PROCESSAMENTO_JANELA 19:00-07:00)"
FIM_DE_SEMANA="$(ler PROCESSAMENTO_FIM_DE_SEMANA true)"
CARGA_MAX="$(ler PROCESSAMENTO_CARGA_MAX 0.6)"
MEMORIA_MIN_MB="$(ler PROCESSAMENTO_MEMORIA_MIN_MB 500)"
FUSO="$(ler TZ_AGENDA America/Sao_Paulo)"

agora() { echo "$(date '+%Y-%m-%d %H:%M:%S') [$STACK]"; }

# --- horario --------------------------------------------------------------
minuto_do_dia() { local h="${1%%:*}" m="${1##*:}"; echo $((10#$h * 60 + 10#$m)); }
INICIO="$(minuto_do_dia "${JANELA%%-*}")"
FIM="$(minuto_do_dia "${JANELA##*-}")"
AGORA="$(minuto_do_dia "$(TZ="$FUSO" date +%H:%M)")"
DIA="$(TZ="$FUSO" date +%u)" # 1 = segunda ... 7 = domingo

dentro=0
if [ "$FIM_DE_SEMANA" != "false" ] && [ "$DIA" -ge 6 ]; then
  dentro=1
elif [ "$INICIO" -le "$FIM" ]; then
  { [ "$AGORA" -ge "$INICIO" ] && [ "$AGORA" -lt "$FIM" ]; } && dentro=1
else
  { [ "$AGORA" -ge "$INICIO" ] || [ "$AGORA" -lt "$FIM" ]; } && dentro=1
fi
[ "$dentro" -eq 1 ] || exit 0 # fora da janela: silencio, sem log

# --- maquina ociosa ---------------------------------------------------------
CARGA_POR_CPU="$(awk -v n="$(nproc)" '{ printf "%.2f", $1 / n }' /proc/loadavg)"
if awk -v c="$CARGA_POR_CPU" -v m="$CARGA_MAX" 'BEGIN { exit !(c >= m) }'; then
  echo "$(agora) maquina ocupada (carga $CARGA_POR_CPU por CPU); fica para a proxima."
  exit 0
fi
MEMORIA_MB="$(awk '/MemAvailable/ { printf "%d", $2 / 1024 }' /proc/meminfo)"
if [ "$MEMORIA_MB" -lt "$MEMORIA_MIN_MB" ]; then
  echo "$(agora) pouca memoria livre (${MEMORIA_MB} MB); fica para a proxima."
  exit 0
fi

# --- um por vez -------------------------------------------------------------
TRAVA="/tmp/quiron-processamento-${STACK}.lock"
exec 9>"$TRAVA"
if ! flock -n 9; then
  echo "$(agora) o lote anterior ainda esta rodando."
  exit 0
fi

echo "$(agora) iniciando o lote (carga $CARGA_POR_CPU, ${MEMORIA_MB} MB livres)."
docker compose run --rm --no-deps processamento
