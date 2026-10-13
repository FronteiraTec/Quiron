/**
 * Horario de evento da agenda (evento.inicio_ts / fim_ts).
 *
 * As colunas sao TIMESTAMP sem fuso e guardam o HORARIO DE PAREDE da
 * incubadora: "14:00" quer dizer 14h no relogio de quem marcou. E assim que o
 * formulario grava e que o Google Agenda le (googleAgendaService.horaLocal,
 * com timeZone = TZ_AGENDA).
 *
 * O problema estava na volta: o driver `pg` transforma TIMESTAMP em Date no
 * fuso do Node (UTC no container), e o JSON sai "2026-10-13T14:00:00.000Z".
 * `new Date()` no navegador em Brasilia le isso como 11h — a atividade das
 * 14h aparecia as 11h depois de salvar.
 *
 * Por isso aqui a data e lida pelos NUMEROS (ano, mes, dia, hora, minuto),
 * ignorando o "Z" ou qualquer offset, e montada no fuso do navegador. Use
 * `horaDoEvento` em vez de `new Date()` para esses dois campos, e
 * `paraHoraDoEvento` para mandar um horario (inclusive filtros de periodo)
 * no mesmo formato de parede.
 *
 * NAO use para criado_ts/atualizado_ts: esses nascem de NOW() e sao UTC de
 * verdade.
 */
import { format } from "date-fns"

const PAREDE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/

/** Le um inicio_ts/fim_ts vindo da API como horario de parede. */
export function horaDoEvento(valor) {
  if (!valor) return null
  if (valor instanceof Date) return valor
  const m = String(valor).match(PAREDE)
  if (!m) return new Date(valor)
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0))
}

/** Formata uma Date local como horario de parede para a API ("AAAA-MM-DDTHH:mm:ss"). */
export function paraHoraDoEvento(data) {
  return format(data, "yyyy-MM-dd'T'HH:mm:ss")
}
