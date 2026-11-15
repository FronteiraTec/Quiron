/**
 * A FILA do lote noturno, no Postgres (migracao 028, decisao 5 de
 * docs/reunioes.md): `reuniao_processamento` e a fila E o historico;
 * `reuniao_processamento_log`, cada tentativa.
 *
 * RESERVA: `FOR UPDATE SKIP LOCKED`, um job por vez, e no maximo UM POR
 * INCUBADORA ao mesmo tempo — a trava consultiva por `id_tenant` cobre os dois
 * workers que olham a fila no mesmo instante, e o NOT EXISTS cobre o job da
 * incubadora que ja esta rodando. Assim o limite de uso de uma incubadora no
 * provedor nao atrasa as outras.
 *
 * `travado_ate` e o prazo do worker: vencido, `recuperarVencidos` devolve o
 * job a fila (o worker morreu no meio — o trabalho e retomavel).
 */
const { query, withTransaction } = require("../config/db")
const { instante } = require("../crm/sql")

const executor = (client) => client || { query }

/** Chave fixa da trava consultiva da fila (o segundo numero e o tenant). */
const TRAVA_FILA = 28028

const SELECT_JOB = `
  SELECT p.id_processamento, p.id_tenant, p.id_reuniao, p.tipo, p.status, p.tentativas, p.max_tentativas,
         ${instante("p.proxima_tentativa_ts", "proxima_tentativa_ts")},
         ${instante("p.travado_ate", "travado_ate")},
         p.erro_codigo, p.erro_mensagem, p.provedor, p.modelo, p.tokens_entrada, p.tokens_saida,
         p.segundos_audio, p.duracao_ms, p.solicitado_por, sol.nome AS solicitado_por_nome,
         ${instante("p.criado_ts", "criado_ts")},
         ${instante("p.iniciado_ts", "iniciado_ts")},
         ${instante("p.concluido_ts", "concluido_ts")}
    FROM reuniao_processamento p
    LEFT JOIN usuarios sol ON sol.id_usuario = p.solicitado_por
`

/**
 * Enfileira. Se ja ha um job ATIVO do mesmo tipo para a reuniao, nao cria
 * outro (o indice parcial) e devolve null.
 * @param {{idTenant: number, idReuniao: number, tipo: string, esperaS?: number, solicitadoPor?: number|null}} dados
 */
async function enfileirar({ idTenant, idReuniao, tipo, esperaS = 0, solicitadoPor = null }, client) {
  const { rows } = await executor(client).query(
    `INSERT INTO reuniao_processamento (id_tenant, id_reuniao, tipo, proxima_tentativa_ts, solicitado_por)
     VALUES ($1, $2, $3::reuniaoProcTipo, NOW() + make_interval(secs => $4), $5)
     ON CONFLICT (id_reuniao, tipo) WHERE status IN ('PENDENTE', 'PROCESSANDO') DO NOTHING
     RETURNING id_processamento`,
    [idTenant, idReuniao, tipo, esperaS, solicitadoPor]
  )
  return rows[0]?.id_processamento ?? null
}

/**
 * Pega o proximo job pronto, dos tipos que este worker sabe fazer, e o marca
 * PROCESSANDO com prazo. Devolve null se nao ha nada.
 * @param {{tipos: string[], travaMinutos?: number}} opcoes
 */
async function reservar({ tipos, travaMinutos = 30 }) {
  return withTransaction(async (client) => {
    const { rows: candidatos } = await client.query(
      `SELECT p.id_processamento, p.id_tenant
         FROM reuniao_processamento p
        WHERE p.status = 'PENDENTE'
          AND p.tipo = ANY($1::reuniaoProcTipo[])
          AND p.proxima_tentativa_ts <= NOW()
          AND NOT EXISTS (
                SELECT 1 FROM reuniao_processamento x
                 WHERE x.id_tenant = p.id_tenant AND x.status = 'PROCESSANDO' AND x.travado_ate > NOW()
              )
        ORDER BY p.proxima_tentativa_ts, p.id_processamento
        LIMIT 10
        FOR UPDATE SKIP LOCKED`,
      [tipos]
    )
    for (const c of candidatos) {
      const { rows: trava } = await client.query(`SELECT pg_try_advisory_xact_lock($1, $2) AS ok`, [TRAVA_FILA, c.id_tenant])
      if (!trava[0].ok) continue
      await client.query(
        `UPDATE reuniao_processamento
            SET status = 'PROCESSANDO', tentativas = tentativas + 1,
                travado_ate = NOW() + make_interval(mins => $2),
                iniciado_ts = NOW(), erro_codigo = NULL, erro_mensagem = NULL
          WHERE id_processamento = $1`,
        [c.id_processamento, travaMinutos]
      )
      const { rows } = await client.query(`${SELECT_JOB} WHERE p.id_processamento = $1`, [c.id_processamento])
      return rows[0]
    }
    return null
  })
}

/** Estende o prazo do worker (chamado entre uma gravacao e outra). */
async function renovarTrava(idProcessamento, travaMinutos = 30) {
  await query(
    `UPDATE reuniao_processamento SET travado_ate = NOW() + make_interval(mins => $2)
      WHERE id_processamento = $1 AND status = 'PROCESSANDO'`,
    [idProcessamento, travaMinutos]
  )
}

async function concluir(idProcessamento, { provedor, modelo, segundosAudio, tokensEntrada, tokensSaida, duracaoMs }, client) {
  await executor(client).query(
    `UPDATE reuniao_processamento
        SET status = 'CONCLUIDO', travado_ate = NULL, concluido_ts = NOW(),
            provedor = $2, modelo = $3, segundos_audio = $4, tokens_entrada = $5, tokens_saida = $6, duracao_ms = $7
      WHERE id_processamento = $1`,
    [idProcessamento, provedor ?? null, modelo ?? null, segundosAudio ?? null, tokensEntrada ?? null, tokensSaida ?? null, duracaoMs ?? null]
  )
}

/**
 * Devolve a fila para tentar depois.
 * @param {{esperaS: number, codigo: string, mensagem: string, devolverTentativa?: boolean}} p
 *   devolverTentativa: o adiamento nao conta como tentativa (limite de uso).
 */
async function adiar(idProcessamento, { esperaS, codigo, mensagem, devolverTentativa = false }) {
  await query(
    `UPDATE reuniao_processamento
        SET status = 'PENDENTE', travado_ate = NULL,
            proxima_tentativa_ts = NOW() + make_interval(secs => $2),
            erro_codigo = $3, erro_mensagem = $4,
            tentativas = CASE WHEN $5 THEN GREATEST(tentativas - 1, 0) ELSE tentativas END
      WHERE id_processamento = $1`,
    [idProcessamento, esperaS, codigo, mensagem, devolverTentativa]
  )
}

async function falhar(idProcessamento, { codigo, mensagem }) {
  await query(
    `UPDATE reuniao_processamento
        SET status = 'FALHOU', travado_ate = NULL, concluido_ts = NOW(), erro_codigo = $2, erro_mensagem = $3
      WHERE id_processamento = $1`,
    [idProcessamento, codigo, mensagem]
  )
}

async function registrarLog(idProcessamento, tentativa, evento, detalhe = null) {
  await query(
    `INSERT INTO reuniao_processamento_log (id_processamento, tentativa, evento, detalhe)
     VALUES ($1, $2, $3::reuniaoProcEvento, $4)`,
    [idProcessamento, tentativa, evento, detalhe ? JSON.stringify(detalhe) : null]
  )
}

/**
 * Jobs PROCESSANDO com o prazo vencido voltam a PENDENTE: o worker que os
 * pegou morreu (OOM, deploy, maquina reiniciada).
 * @returns {Promise<Array<{id_processamento: number, tentativas: number}>>}
 */
async function recuperarVencidos() {
  const { rows } = await query(
    `UPDATE reuniao_processamento
        SET status = 'PENDENTE', travado_ate = NULL, proxima_tentativa_ts = NOW(),
            erro_codigo = 'INTERROMPIDO', erro_mensagem = 'O processamento anterior parou no meio; retomado.'
      WHERE status = 'PROCESSANDO' AND travado_ate < NOW()
      RETURNING id_processamento, tentativas`
  )
  return rows
}

/** O historico de uma reuniao, o mais recente primeiro, com as tentativas. */
async function listarPorReuniao(idReuniao) {
  const { rows } = await query(`${SELECT_JOB} WHERE p.id_reuniao = $1 ORDER BY p.criado_ts DESC, p.id_processamento DESC`, [idReuniao])
  if (!rows.length) return rows
  const { rows: logs } = await query(
    `SELECT id_processamento, tentativa, evento, detalhe, ${instante("criado_ts", "criado_ts")}
       FROM reuniao_processamento_log
      WHERE id_processamento = ANY($1::bigint[])
      ORDER BY id_log`,
    [rows.map((r) => r.id_processamento)]
  )
  return rows.map((r) => ({ ...r, tentativas_log: logs.filter((l) => l.id_processamento === r.id_processamento) }))
}

/** O job mais recente de um tipo para a reuniao (o que a tela mostra). */
async function ultimoDaReuniao(idReuniao, tipo) {
  const { rows } = await query(
    `${SELECT_JOB} WHERE p.id_reuniao = $1 AND p.tipo = $2::reuniaoProcTipo
      ORDER BY p.criado_ts DESC, p.id_processamento DESC LIMIT 1`,
    [idReuniao, tipo]
  )
  return rows[0]
}

async function buscar(idProcessamento) {
  const { rows } = await query(`${SELECT_JOB} WHERE p.id_processamento = $1`, [idProcessamento])
  return rows[0]
}

/** Cancela um job que ainda nao comecou. */
async function cancelar(idProcessamento) {
  const { rowCount } = await query(
    `UPDATE reuniao_processamento SET status = 'CANCELADO', concluido_ts = NOW()
      WHERE id_processamento = $1 AND status = 'PENDENTE'`,
    [idProcessamento]
  )
  return rowCount > 0
}

module.exports = {
  enfileirar,
  reservar,
  renovarTrava,
  concluir,
  adiar,
  falhar,
  registrarLog,
  recuperarVencidos,
  listarPorReuniao,
  ultimoDaReuniao,
  buscar,
  cancelar,
}
