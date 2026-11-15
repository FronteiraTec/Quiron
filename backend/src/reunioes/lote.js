/**
 * O LOTE NOTURNO das reunioes (docs/reunioes.md, secao 3.4).
 *
 * Quem o chama e o container `processamento` (src/workers/processamento.js),
 * disparado pelo cron do servidor a cada 30 min. Ele nao fica de pe: sobe,
 * trabalha enquanto ha fila e janela, e sai.
 *
 * A JANELA e conferida antes de comecar e ANTES DE CADA ITEM (janela.js):
 *   - fora do horario: para (o item em curso termina antes);
 *   - maquina ocupada: espera 5 min e confere de novo.
 *
 * EM ORDEM:
 *   1. recuperacao — job PROCESSANDO com o prazo vencido volta a fila;
 *   2. reunioes esquecidas abertas (sem pedaco ha 1 h) sao encerradas, e o
 *      job de transcricao delas nasce;
 *   3. a fila, um job por vez (TRANSCRICAO; o RELATORIO chega na Etapa 5);
 *   4. a faxina — audio transcrito sai do disco (pela retencao da
 *      incubadora), pasta de audio com mais de 30 dias sai de todo jeito, e a
 *      transcricao vencida e apagada.
 *
 * O QUE FAZER COM CADA ERRO e decidido aqui, pelo tipo do ErroProvedor
 * (secao 5.2), nunca pelo codigo HTTP de cada fornecedor.
 *
 * Tudo que toca o mundo (relogio, janela, ffmpeg, provedor, espera) e
 * injetavel: o teste roda o lote inteiro sem ffmpeg, sem provedor de verdade
 * e sem depender da hora.
 */
const { withTransaction } = require("../config/db")
const reuniaoRepository = require("../repositories/reuniaoRepository")
const gravacaoRepository = require("../repositories/reuniaoGravacaoRepository")
const processamentoRepository = require("../repositories/reuniaoProcessamentoRepository")
const iaConfigRepository = require("../repositories/iaConfigRepository")
const auditLogService = require("../services/auditLogService")
const notificacaoService = require("../services/notificacaoService")
const gravacaoService = require("../services/reuniaoGravacaoService")
const discoPadrao = require("./audioDisco")
const janela = require("./janela")
const { executarTranscricao } = require("./transcricao")
const { ErroProvedor, TIPOS, limparSegredos } = require("./provedores")

/** Espera entre tentativas de erro temporario: 1 min, 5 min, 30 min, 2 h. */
const ESPERAS_S = [60, 300, 1800, 7200]
/** Maquina ocupada: confere de novo depois disto. */
const ESPERA_OCUPADA_MS = 5 * 60 * 1000
/** Prazo de um job inteiro. */
const PRAZO_JOB_MS = 2 * 60 * 60 * 1000
/** Rede de seguranca: nenhuma pasta de audio passa disto, com banco ou sem. */
const DIAS_MAXIMO_AUDIO = 30

const dormirPadrao = (ms) => new Promise((ok) => setTimeout(ok, ms))

/**
 * Decide o destino de um job que falhou.
 * @returns {{acao: 'ADIAR'|'FALHAR', esperaS?: number, devolverTentativa?: boolean, codigo: string}}
 */
function decidir(err, job) {
  const tipo = err instanceof ErroProvedor ? err.tipo : "ERRO_INTERNO"
  switch (tipo) {
    case TIPOS.LIMITE:
      return { acao: "ADIAR", esperaS: Math.max(30, Math.min(err.retryAfterS ?? 60, 6 * 3600)), devolverTentativa: true, codigo: tipo }
    case TIPOS.TEMPORARIA:
    case "ERRO_INTERNO":
      if (job.tentativas >= job.max_tentativas) return { acao: "FALHAR", codigo: tipo }
      return { acao: "ADIAR", esperaS: ESPERAS_S[Math.min(job.tentativas - 1, ESPERAS_S.length - 1)], codigo: tipo }
    case TIPOS.RESPOSTA_INVALIDA:
      // Uma nova tentativa (o provedor pode ter soluçado); a segunda falha e definitiva.
      return job.tentativas >= 2 ? { acao: "FALHAR", codigo: tipo } : { acao: "ADIAR", esperaS: 60, codigo: tipo }
    default:
      // CHAVE_INVALIDA, RECUSADA, SEM_CONFIGURACAO: repetir nao adianta.
      return { acao: "FALHAR", codigo: tipo }
  }
}

/** A culpa e da configuracao de IA da incubadora? (avisa quem pode corrigir) */
const ehDaConfiguracao = (codigo) => [TIPOS.CHAVE_INVALIDA, TIPOS.RECUSADA, TIPOS.SEM_CONFIGURACAO].includes(codigo)

/**
 * Roda o lote.
 *
 * @param {object} [opcoes]
 * @param {boolean} [opcoes.ignorarJanela] - so dev/local (o worker recusa em producao).
 * @param {() => {pode: boolean, motivo: string|null}} [opcoes.avaliarJanela]
 * @param {object} [opcoes.conversor] - o audioConversor (ou um falso).
 * @param {object} [opcoes.disco]
 * @param {Function} [opcoes.criarProvedor] - monta o provedor de STT a partir da config.
 * @param {(ms: number) => Promise<void>} [opcoes.dormir]
 * @param {number} [opcoes.maxItens]
 * @param {(texto: string) => void} [opcoes.log]
 */
async function rodar(opcoes = {}) {
  const {
    ignorarJanela = false,
    avaliarJanela = () => janela.avaliar(),
    conversor = require("./audioConversor"),
    disco = discoPadrao,
    criarProvedor,
    dormir = dormirPadrao,
    maxItens = Infinity,
    log = (t) => console.log(`[lote] ${t}`),
  } = opcoes

  const resultado = { motivo: null, recuperados: 0, encerradas: 0, concluidos: 0, adiados: 0, falhos: 0, audiosApagados: 0, transcricoesApagadas: 0 }

  /** Pode trabalhar? Espera enquanto a maquina esta ocupada; false fora do horario. */
  async function janelaAberta() {
    if (ignorarJanela) return true
    for (;;) {
      const r = avaliarJanela()
      if (r.pode) return true
      if (r.motivo === "FORA_DO_HORARIO") return false
      log(`maquina ocupada (${r.motivo}); esperando ${Math.round(ESPERA_OCUPADA_MS / 60000)} min`)
      await dormir(ESPERA_OCUPADA_MS)
    }
  }

  if (!(await janelaAberta())) {
    resultado.motivo = "FORA_DA_JANELA"
    return resultado
  }

  // 1. Recuperacao.
  for (const job of await processamentoRepository.recuperarVencidos()) {
    await processamentoRepository.registrarLog(job.id_processamento, job.tentativas, "ADIADO", { motivo: "worker anterior interrompido" })
    resultado.recuperados += 1
  }

  // 2. Reunioes esquecidas abertas.
  resultado.encerradas = await encerrarEsquecidas(log)

  // 3. A fila.
  let itens = 0
  while (itens < maxItens && (await janelaAberta())) {
    const job = await processamentoRepository.reservar({ tipos: ["TRANSCRICAO"] })
    if (!job) break
    itens += 1
    const desfecho = await executar(job, { conversor, disco, criarProvedor, janelaAberta: ignorarJanela ? null : janelaAberta, log })
    resultado[desfecho] += 1
  }

  // 4. Faxina.
  if (await janelaAberta()) {
    const faxina = await limpar({ disco, log })
    resultado.audiosApagados = faxina.audios
    resultado.transcricoesApagadas = faxina.transcricoes
  }
  return resultado
}

/** Executa um job reservado e registra o desfecho. @returns {'concluidos'|'adiados'|'falhos'} */
async function executar(job, { conversor, disco, criarProvedor, janelaAberta, log }) {
  const inicio = Date.now()
  await processamentoRepository.registrarLog(job.id_processamento, job.tentativas, "INICIO")
  const sinal = AbortSignal.timeout(PRAZO_JOB_MS)

  try {
    const r = await executarTranscricao(job, {
      conversor,
      disco,
      criarProvedor,
      sinal,
      renovarTrava: () => processamentoRepository.renovarTrava(job.id_processamento),
      // A janela fechou no meio: o que ja foi transcrito fica, e o resto volta para a proxima noite.
      deveParar: janelaAberta ? async () => !(await janelaAberta()) : null,
    })

    if (r.interrompido) {
      await processamentoRepository.adiar(job.id_processamento, {
        esperaS: 0,
        codigo: "JANELA_FECHOU",
        mensagem: "A janela da noite fechou no meio; continua na próxima.",
        devolverTentativa: true,
      })
      await processamentoRepository.registrarLog(job.id_processamento, job.tentativas, "ADIADO", { motivo: "janela fechou" })
      return "adiados"
    }

    await processamentoRepository.concluir(job.id_processamento, {
      provedor: r.provedor,
      modelo: r.modelo,
      segundosAudio: r.segundosAudio,
      duracaoMs: Date.now() - inicio,
    })
    await processamentoRepository.registrarLog(job.id_processamento, job.tentativas, "SUCESSO", {
      segundos_audio: r.segundosAudio,
      incompleta: r.incompleta,
    })
    log(`transcricao da reuniao ${job.id_reuniao}: concluida${r.incompleta ? " (incompleta)" : ""}`)
    if (r.reuniao) notificacaoService.transcricaoPronta({ reuniao: r.reuniao, incompleta: r.incompleta })
    return "concluidos"
  } catch (err) {
    const decisao = decidir(err, job)
    const mensagem = limparSegredos(err instanceof ErroProvedor ? err.message : `Erro interno: ${err?.message || err}`)
    if (!(err instanceof ErroProvedor)) console.error(`[lote] job ${job.id_processamento}:`, err)

    if (decisao.acao === "ADIAR") {
      await processamentoRepository.adiar(job.id_processamento, {
        esperaS: decisao.esperaS,
        codigo: decisao.codigo,
        mensagem,
        devolverTentativa: decisao.devolverTentativa,
      })
      await processamentoRepository.registrarLog(job.id_processamento, job.tentativas, "ADIADO", {
        codigo: decisao.codigo,
        mensagem,
        espera_s: decisao.esperaS,
      })
      log(`job ${job.id_processamento} adiado ${decisao.esperaS}s: ${decisao.codigo}`)
      return "adiados"
    }

    await processamentoRepository.falhar(job.id_processamento, { codigo: decisao.codigo, mensagem })
    await processamentoRepository.registrarLog(job.id_processamento, job.tentativas, "ERRO", { codigo: decisao.codigo, mensagem })
    log(`job ${job.id_processamento} falhou: ${decisao.codigo}`)

    const reuniao = await reuniaoRepository.buscarPorId(job.id_reuniao)
    if (reuniao) {
      if (decisao.codigo === TIPOS.CHAVE_INVALIDA || decisao.codigo === TIPOS.RECUSADA) {
        // A tela de Configuracoes passa a mostrar que a conexao parou de funcionar.
        await iaConfigRepository.registrarValidacao(reuniao.id_tenant, "TRANSCRICAO", { ok: false, erro: mensagem }).catch(() => {})
      }
      notificacaoService.transcricaoFalhou({ reuniao, mensagem, daConfiguracao: ehDaConfiguracao(decisao.codigo) })
    }
    return "falhos"
  }
}

/** Encerra as reunioes que ficaram abertas sem atividade, criando o job delas. */
async function encerrarEsquecidas(log) {
  let n = 0
  for (const id of await gravacaoRepository.reunioesEsquecidas(1)) {
    const reuniao = await reuniaoRepository.buscarPorId(id)
    if (!reuniao) continue
    const encerrou = await withTransaction(async (client) => {
      const ok = await reuniaoRepository.encerrar(id, null, client)
      // O ultimo pedaco chegou ha mais de uma hora: nao ha o que esperar.
      if (ok) await gravacaoService.aoEncerrar(reuniao, client, { esperaS: 0 })
      return ok
    })
    if (!encerrou) continue
    n += 1
    await auditLogService.registrar({
      idTenant: reuniao.id_tenant,
      idUsuario: null,
      acao: "ENCERRAR",
      entidade: "reuniao",
      entidadeId: String(id),
      descricao: `A reunião "${reuniao.titulo}" ficou aberta sem atividade e foi encerrada pelo processamento noturno.`,
    })
    log(`reuniao ${id} encerrada (esquecida aberta)`)
  }
  return n
}

/**
 * A faxina: o audio sai do disco quando a retencao da incubadora vence; a
 * pasta com mais de 30 dias sai de todo jeito; a transcricao vencida e
 * apagada (e isso fica na auditoria).
 */
async function limpar({ disco = discoPadrao, log = () => {} } = {}) {
  let audios = 0
  for (const a of await gravacaoRepository.audiosParaApagar()) {
    await disco.apagarAudio({ idTenant: a.id_tenant, idReuniao: a.id_reuniao, idAudio: a.id_audio })
    await gravacaoRepository.marcarAudio(a.id_audio, "EXCLUIDO")
    audios += 1
  }

  for (const ids of await disco.pastasAntigas(DIAS_MAXIMO_AUDIO)) {
    await disco.apagarAudio(ids)
    const linha = await gravacaoRepository.buscarAudio(ids.idAudio)
    if (linha && linha.status !== "EXCLUIDO" && Number(linha.id_tenant) === ids.idTenant) {
      await gravacaoRepository.marcarAudio(ids.idAudio, "EXCLUIDO", {
        erro: linha.status === "TRANSCRITO" ? null : `apagado sem transcrever: passou de ${DIAS_MAXIMO_AUDIO} dias`,
      })
    }
    audios += 1
  }

  let transcricoes = 0
  for (const r of await gravacaoRepository.reunioesComTranscricaoVencida()) {
    const apagados = await gravacaoRepository.apagarTrechosDaReuniao(r.id_reuniao)
    transcricoes += 1
    await auditLogService.registrar({
      idTenant: r.id_tenant,
      idUsuario: null,
      acao: "EXCLUIR",
      entidade: "reuniao_transcricao",
      entidadeId: String(r.id_reuniao),
      descricao: `Transcrição apagada pela retenção da incubadora (${r.dias} dias): ${apagados} trecho(s).`,
    })
  }
  if (audios || transcricoes) log(`faxina: ${audios} audio(s), ${transcricoes} transcricao(oes)`)
  return { audios, transcricoes }
}

module.exports = { rodar, executar, decidir, limpar, encerrarEsquecidas, ESPERAS_S }
