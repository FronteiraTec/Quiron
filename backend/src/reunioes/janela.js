/**
 * A JANELA do processamento pesado (docs/reunioes.md, decisao 2 e secao 3.4):
 * transcricao e relatorio so rodam fora do horario de servico E com a maquina
 * ociosa. A VPS e dividida por producao e desenvolvimento, e nao pode dividir
 * memoria com o lote durante o expediente.
 *
 * Abre quando as tres condicoes valem:
 *   - hora local (TZ_AGENDA) dentro de PROCESSAMENTO_JANELA (padrao
 *     19:00-07:00) — ou fim de semana, com PROCESSAMENTO_FIM_DE_SEMANA;
 *   - carga da CPU (load average de 1 min / numero de CPUs) abaixo de
 *     PROCESSAMENTO_CARGA_MAX (0,6);
 *   - memoria livre do host (MemAvailable) acima de PROCESSAMENTO_MEMORIA_MIN_MB
 *     (500).
 *
 * Dentro do container, `loadavg` e `/proc/meminfo` sao os do HOST — que e o
 * que interessa medir.
 *
 * Funcoes puras sobre o que recebem: o relogio, a carga e a memoria sao
 * injetados, e o teste nao depende da hora em que roda.
 */
const fs = require("fs")
const os = require("os")

function lerConfig(env = process.env) {
  const numero = (v, padrao) => (Number.isFinite(Number(v)) && String(v).trim() !== "" ? Number(v) : padrao)
  const m = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/.exec(String(env.PROCESSAMENTO_JANELA || "19:00-07:00").trim())
  const [inicio, fim] = m ? [Number(m[1]) * 60 + Number(m[2]), Number(m[3]) * 60 + Number(m[4])] : [19 * 60, 7 * 60]
  return {
    inicioMin: inicio,
    fimMin: fim,
    fimDeSemana: String(env.PROCESSAMENTO_FIM_DE_SEMANA ?? "true").toLowerCase() !== "false",
    cargaMax: numero(env.PROCESSAMENTO_CARGA_MAX, 0.6),
    memoriaMinMb: numero(env.PROCESSAMENTO_MEMORIA_MIN_MB, 500),
    fuso: env.TZ_AGENDA || "America/Sao_Paulo",
  }
}

/** Dia da semana (1 = segunda ... 7 = domingo) e minuto do dia, no fuso. */
function horaLocal(agora, fuso) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: fuso, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(agora)
      .map((x) => [x.type, x.value])
  )
  const dias = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }
  return { diaSemana: dias[p.weekday], minuto: Number(p.hour) * 60 + Number(p.minute) }
}

/** O horario esta na janela? (a janela pode atravessar a meia-noite) */
function dentroDoHorario(agora, config) {
  const { diaSemana, minuto } = horaLocal(agora, config.fuso)
  if (config.fimDeSemana && diaSemana >= 6) return true
  const { inicioMin: i, fimMin: f } = config
  return i <= f ? minuto >= i && minuto < f : minuto >= i || minuto < f
}

/** Carga de 1 minuto por CPU. */
function lerCarga() {
  return os.loadavg()[0] / Math.max(1, os.cpus().length)
}

/** Memoria disponivel do host, em MB (MemAvailable; fora do Linux, freemem). */
function lerMemoriaMb() {
  try {
    const m = /MemAvailable:\s+(\d+)\s+kB/.exec(fs.readFileSync("/proc/meminfo", "utf8"))
    if (m) return Number(m[1]) / 1024
  } catch {
    // fora do Linux
  }
  return os.freemem() / (1024 * 1024)
}

/**
 * Pode trabalhar agora?
 * @returns {{pode: boolean, motivo: 'FORA_DO_HORARIO'|'CARGA'|'MEMORIA'|null, carga: number, memoriaMb: number}}
 */
function avaliar({ agora = new Date(), config = lerConfig(), carga = lerCarga, memoria = lerMemoriaMb } = {}) {
  if (!dentroDoHorario(agora, config)) return { pode: false, motivo: "FORA_DO_HORARIO", carga: null, memoriaMb: null }
  const c = carga()
  const mem = memoria()
  if (c >= config.cargaMax) return { pode: false, motivo: "CARGA", carga: c, memoriaMb: mem }
  if (mem < config.memoriaMinMb) return { pode: false, motivo: "MEMORIA", carga: c, memoriaMb: mem }
  return { pode: true, motivo: null, carga: c, memoriaMb: mem }
}

/** O que a tela precisa para dizer "fica pronta ate as 07:00". */
function resumoParaTela(config = lerConfig()) {
  const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`
  return { inicio: hhmm(config.inicioMin), fim: hhmm(config.fimMin), fim_de_semana: config.fimDeSemana }
}

module.exports = { lerConfig, horaLocal, dentroDoHorario, lerCarga, lerMemoriaMb, avaliar, resumoParaTela }
