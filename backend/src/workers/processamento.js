#!/usr/bin/env node
/**
 * O container `processamento`: roda o lote noturno das reunioes e sai.
 *
 * Quem o inicia e o cron do servidor, pelo scripts/processamento.sh, que so
 * sobe o container dentro da janela e com a maquina ociosa — e o lote confere
 * de novo antes de cada item (ver src/reunioes/lote.js).
 *
 * USO
 *   node src/workers/processamento.js                  # respeita a janela
 *   node src/workers/processamento.js --ignorar-janela # dev/local: roda agora
 *
 * `--ignorar-janela` e RECUSADO com NODE_ENV=production: no servidor, a regra
 * de nao processar durante o expediente nao tem atalho.
 */
const { pool } = require("../config/db")
const lote = require("../reunioes/lote")

async function principal() {
  const ignorarJanela = process.argv.includes("--ignorar-janela")
  if (ignorarJanela && process.env.NODE_ENV === "production") {
    console.error("[lote] --ignorar-janela nao e permitido em producao.")
    process.exitCode = 2
    return
  }

  const inicio = Date.now()
  const r = await lote.rodar({ ignorarJanela })
  const segundos = Math.round((Date.now() - inicio) / 1000)
  if (r.motivo === "FORA_DA_JANELA") {
    console.log("[lote] fora da janela de processamento; nada a fazer.")
  } else {
    console.log(
      `[lote] fim em ${segundos}s: ${r.concluidos} concluido(s), ${r.adiados} adiado(s), ${r.falhos} falho(s), ` +
        `${r.recuperados} recuperado(s), ${r.encerradas} reuniao(oes) esquecida(s) encerrada(s), ` +
        `${r.audiosApagados} audio(s) e ${r.transcricoesApagadas} transcricao(oes) apagados.`
    )
  }
}

principal()
  .catch((err) => {
    console.error("[lote] erro fatal:", err)
    process.exitCode = 1
  })
  .finally(() => pool.end())
