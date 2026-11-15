/**
 * A TRANSCRICAO de uma reuniao — o job TRANSCRICAO do lote noturno
 * (docs/reunioes.md, secao 3.4).
 *
 * PARA CADA GRAVACAO (a voz de uma pessoa), em ordem:
 *   1. le os pedacos do disco e os divide em CORRIDAS de numeros
 *      consecutivos (um buraco = duas corridas; ver audioConversor);
 *   2. normaliza cada corrida em OGG/Opus, na linha do tempo da gravacao;
 *   3. acha os silencios e planeja os pedacos que vao ao provedor: pulam o
 *      silencio (nao se paga transcricao de silencio) e tem no maximo 10 min —
 *      ou 1 min, quando o modelo nao devolve o tempo de cada frase, para cada
 *      pedaco virar um trecho com horario util;
 *   4. transcreve, e grava os trechos com o horario ABSOLUTO (inicio da
 *      gravacao, pelo relogio do servidor, + deslocamento) numa transacao que
 *      tambem marca a gravacao TRANSCRITO.
 *
 * RETOMAVEL: a gravacao ja TRANSCRITO nao e refeita. Se o worker morre, ou a
 * janela fecha, a proxima rodada continua de onde parou.
 *
 * ERRO DO PROVEDOR (ErroProvedor) sobe e interrompe o job — quem decide se
 * adia ou falha e o lote, pelo tipo. Arquivo ILEGIVEL nao e erro do job: a
 * gravacao vira FALHOU, com o motivo, e entra na observacao da transcricao.
 *
 * NO FIM, numa transacao: apaga os ecos (reunioes/eco.js) e grava
 * `reuniao.transcricao` COMPLETA, ou INCOMPLETA com o que faltou ("faltam
 * ~40 s da gravacao de Ana", "o disco do servidor encheu as 15:10").
 */
const os = require("os")
const path = require("path")
const fsp = require("fs").promises
const { withTransaction } = require("../config/db")
const reuniaoRepository = require("../repositories/reuniaoRepository")
const gravacaoRepository = require("../repositories/reuniaoGravacaoRepository")
const iaConfigRepository = require("../repositories/iaConfigRepository")
const discoPadrao = require("./audioDisco")
const { criarProvedorSTT } = require("./stt")
const { validarUrlBase } = require("./urlBase")
const { acharEcos } = require("./eco")
const { ErroProvedor, TIPOS } = require("./provedores")

const SEGUNDOS_POR_PARTE = 10
const PEDACO_MAX_COM_TEMPOS_S = 600
const PEDACO_MAX_SEM_TEMPOS_S = 60
/** Menos fala que isto na gravacao inteira: nada a transcrever. */
const FALA_MINIMA_S = 1
/** Silencio que sobra nas pontas de cada pedaco (para nao cortar a primeira silaba). */
const MARGEM_S = 0.3

/** [0,1,2,4,5] -> [[0,1,2],[4,5]] */
function corridas(numeros) {
  const grupos = []
  for (const n of numeros) {
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && n === ultimo[ultimo.length - 1] + 1) ultimo.push(n)
    else grupos.push([n])
  }
  return grupos
}

/** Os intervalos com som: o complemento dos silencios dentro de [0, duracao]. */
function regioesDeFala(duracao, silencios) {
  const regioes = []
  let cursor = 0
  for (const s of [...silencios].sort((a, b) => a.inicio - b.inicio)) {
    if (s.inicio > cursor) regioes.push({ inicio: cursor, fim: Math.min(s.inicio, duracao) })
    cursor = Math.max(cursor, Math.min(s.fim, duracao))
  }
  if (cursor < duracao) regioes.push({ inicio: cursor, fim: duracao })
  return regioes.filter((r) => r.fim - r.inicio > 0.05)
}

/**
 * Os pedacos que vao ao provedor: cobrem toda a fala, pulam os silencios
 * longos e tem no maximo `maxS`. O corte cai no MEIO de um silencio sempre
 * que ha um na segunda metade do pedaco; senao, corta no limite.
 * @returns {Array<{inicio: number, fim: number}>}
 */
function planejarPedacos({ duracao, silencios, maxS }) {
  const fala = regioesDeFala(duracao, silencios)
  const pedacos = []
  let i = 0
  while (i < fala.length) {
    const inicio = Math.max(0, fala[i].inicio - MARGEM_S)
    let fim = fala[i].fim
    let j = i
    // Junta as regioes seguintes enquanto couber.
    while (j + 1 < fala.length && fala[j + 1].fim - inicio <= maxS) {
      j += 1
      fim = fala[j].fim
    }
    if (fim - inicio <= maxS) {
      pedacos.push({ inicio, fim: Math.min(duracao, fim + MARGEM_S) })
      i = j + 1
      continue
    }
    // Uma regiao de fala sozinha maior que o limite: corta no limite.
    pedacos.push({ inicio, fim: inicio + maxS })
    fala[i] = { inicio: inicio + maxS, fim: fala[i].fim }
  }
  return pedacos
}

/** "Ana" + segundos -> "~40 s" / "~3 min" */
function quanto(segundos) {
  return segundos < 90 ? `~${Math.round(segundos)} s` : `~${Math.round(segundos / 60)} min`
}

/**
 * Transcreve uma gravacao. Nao grava nada no banco: devolve os trechos (com
 * deslocamento em ms desde o inicio da gravacao) ou o motivo da falha.
 *
 * @returns {Promise<{trechos: Array, segundos: number, avisos: string[], falha: string|null}>}
 */
async function transcreverAudio(audio, { provedor, conversor, disco = discoPadrao, sinal, pastaTemporaria }) {
  const ids = { idTenant: audio.id_tenant, idReuniao: audio.id_reuniao, idAudio: audio.id_audio }
  const numeros = await disco.listarPartes(ids)
  if (numeros.length === 0) return { trechos: [], segundos: 0, avisos: [], falha: "nenhum pedaço da gravação está no servidor" }
  if (numeros[0] !== 0) {
    return { trechos: [], segundos: 0, avisos: [], falha: "o primeiro pedaço da gravação (que tem o cabeçalho do arquivo) não chegou" }
  }

  const avisos = []
  const cabecalho = conversor.extrairCabecalho(audio.mime, await fsp.readFile(disco.arquivoDaParte(ids, 0)))
  const { devolveTempos } = provedor.capacidades()
  const maxS = devolveTempos ? PEDACO_MAX_COM_TEMPOS_S : PEDACO_MAX_SEM_TEMPOS_S

  const trechos = []
  let segundos = 0
  let lidas = 0
  const grupos = corridas(numeros)

  for (const [k, grupo] of grupos.entries()) {
    if (grupo[0] !== 0 && !cabecalho) {
      avisos.push(`um trecho da gravação de ${audio.usuario_nome} não pôde ser lido depois de uma falha no envio`)
      continue
    }
    const normalizado = path.join(pastaTemporaria, `corrida-${k}.ogg`)
    try {
      await conversor.normalizar({
        partes: grupo.map((n) => disco.arquivoDaParte(ids, n)),
        mime: audio.mime,
        temporario: path.join(pastaTemporaria, `corrida-${k}.bruto`),
        destino: normalizado,
        cabecalho: grupo[0] === 0 ? null : cabecalho,
        sinal,
      })
    } catch (err) {
      if (sinal?.aborted) throw new ErroProvedor(TIPOS.TEMPORARIA, "Processamento interrompido.")
      avisos.push(`um trecho da gravação de ${audio.usuario_nome} não pôde ser lido`)
      console.error(`[transcricao] audio ${audio.id_audio}, corrida ${k}: ${err.message}`)
      continue
    }
    lidas += 1

    const duracao = await conversor.duracao(normalizado, { sinal })
    const silencios = await conversor.silencios(normalizado, { sinal })
    const falaTotal = regioesDeFala(duracao, silencios).reduce((t, r) => t + (r.fim - r.inicio), 0)
    if (falaTotal < FALA_MINIMA_S) continue

    for (const [p, pedaco] of planejarPedacos({ duracao, silencios, maxS }).entries()) {
      const arquivo = path.join(pastaTemporaria, `corrida-${k}-pedaco-${p}.ogg`)
      await conversor.recortar(normalizado, pedaco.inicio, pedaco.fim - pedaco.inicio, arquivo, { sinal })
      const audioDoPedaco = await fsp.readFile(arquivo)
      const resposta = await provedor.transcrever({ audio: audioDoPedaco, mime: "audio/ogg", idioma: "pt", sinal })
      segundos += pedaco.fim - pedaco.inicio
      const baseMs = pedaco.inicio * 1000
      const limiteMs = pedaco.fim * 1000
      for (const t of resposta) {
        const inicioMs = Math.min(baseMs + t.inicioMs, limiteMs)
        const fimMs = t.fimMs === null || t.fimMs === undefined ? limiteMs : Math.min(baseMs + t.fimMs, limiteMs)
        trechos.push({ texto: t.texto, inicioMs, fimMs: Math.max(inicioMs, fimMs), confianca: t.confianca ?? null })
      }
      await fsp.rm(arquivo, { force: true })
    }
  }

  if (lidas === 0) return { trechos: [], segundos: 0, avisos, falha: "o arquivo da gravação não pôde ser lido" }
  trechos.sort((a, b) => a.inicioMs - b.inicioMs)
  return { trechos, segundos, avisos, falha: null }
}

/** As observacoes da transcricao, a partir do estado final das gravacoes. */
function observacoes(audios, avisosDoJob) {
  const obs = [...avisosDoJob]
  for (const a of audios) {
    if (a.status === "FALHOU") obs.push(`a gravação de ${a.usuario_nome} não foi transcrita: ${a.erro || "falha na leitura"}`)
    if (a.erro && a.status !== "FALHOU") obs.push(`${a.erro} (gravação de ${a.usuario_nome})`)
    // O placar do recebimento: pedacos que nunca chegaram entre o primeiro e o ultimo.
    if (a.ultima_parte !== null && a.ultima_parte !== undefined && a.status !== "FALHOU") {
      const faltando = Number(a.ultima_parte) + 1 - Number(a.partes)
      if (faltando > 0) obs.push(`faltam ${quanto(faltando * SEGUNDOS_POR_PARTE)} da gravação de ${a.usuario_nome}`)
    }
  }
  return [...new Set(obs)]
}

const frase = (lista) => {
  if (!lista.length) return null
  const texto = lista.join("; ")
  return `${texto.charAt(0).toUpperCase()}${texto.slice(1)}.`
}

/** A configuracao de transcricao, pronta para chamar — ou o ErroProvedor que explica por que nao. */
async function provedorDaIncubadora(idTenant, criar = criarProvedorSTT) {
  const config = await iaConfigRepository.buscarComChave(idTenant, "TRANSCRICAO")
  if (!config || !config.ativo) {
    throw new ErroProvedor(TIPOS.SEM_CONFIGURACAO, "A incubadora não tem a transcrição configurada e ativa.")
  }
  if (!config.chave) {
    throw new ErroProvedor(TIPOS.SEM_CONFIGURACAO, "A chave de transcrição salva não pôde ser lida; informe-a de novo em Configurações.")
  }
  if (config.provedor === "OPENAI_COMPATIVEL") {
    try {
      config.url_base = await validarUrlBase(config.url_base)
    } catch (err) {
      throw new ErroProvedor(TIPOS.RECUSADA, `O endereço do provedor foi recusado: ${err.message}`)
    }
  }
  return { provedor: criar(config), config }
}

/**
 * O job TRANSCRICAO de uma reuniao.
 *
 * @param {object} job - a linha de reuniao_processamento.
 * @param {{conversor: object, disco?: object, criarProvedor?: Function, sinal?: AbortSignal,
 *          renovarTrava?: () => Promise<void>, deveParar?: () => Promise<boolean>}} deps
 * @returns {Promise<{provedor: string, modelo: string, segundosAudio: number, incompleta: boolean, reuniao: object}|{interrompido: true}>}
 */
async function executarTranscricao(job, deps) {
  const { conversor, disco = discoPadrao, criarProvedor = criarProvedorSTT, sinal, renovarTrava, deveParar } = deps
  const reuniao = await reuniaoRepository.buscarPorId(job.id_reuniao)
  if (!reuniao) return { provedor: null, modelo: null, segundosAudio: 0, incompleta: false, reuniao: null }

  await gravacaoRepository.fecharAbandonadas(reuniao.id_reuniao)
  const { provedor, config } = await provedorDaIncubadora(reuniao.id_tenant, criarProvedor)

  const avisos = []
  let segundosAudio = 0
  for (const audio of await gravacaoRepository.listarAudios(reuniao.id_reuniao, { status: ["DISPONIVEL"] })) {
    if (deveParar && (await deveParar())) return { interrompido: true }
    await renovarTrava?.()

    const pastaTemporaria = await fsp.mkdtemp(path.join(os.tmpdir(), `quiron-audio-${audio.id_audio}-`))
    try {
      const r = await transcreverAudio(audio, { provedor, conversor, disco, sinal, pastaTemporaria })
      avisos.push(...r.avisos)
      segundosAudio += r.segundos
      if (r.falha) {
        await gravacaoRepository.marcarAudio(audio.id_audio, "FALHOU", { erro: r.falha })
      } else {
        await withTransaction((client) =>
          gravacaoRepository.gravarTranscricaoDoAudio(audio, r.trechos, `${config.provedor}:${config.modelo}`, client)
        )
      }
    } finally {
      await fsp.rm(pastaTemporaria, { recursive: true, force: true })
    }
  }

  // Consolidacao: o eco e o estado final, numa transacao.
  const audios = await gravacaoRepository.listarAudios(reuniao.id_reuniao)
  const obs = frase(observacoes(audios, avisos))
  await withTransaction(async (client) => {
    const ecos = acharEcos(await gravacaoRepository.trechosParaEco(reuniao.id_reuniao, client))
    await gravacaoRepository.apagarTrechos(ecos, client)
    await gravacaoRepository.definirTranscricao(reuniao.id_reuniao, obs ? "INCOMPLETA" : "COMPLETA", obs, client)
    // (Etapa 5: e aqui, na mesma transacao, que nasce o job do RELATORIO.)
  })

  return {
    provedor: config.provedor,
    modelo: config.modelo,
    segundosAudio: Math.round(segundosAudio),
    incompleta: Boolean(obs),
    reuniao: { ...reuniao, transcricao_obs: obs },
  }
}

module.exports = {
  executarTranscricao,
  transcreverAudio,
  provedorDaIncubadora,
  // Para o teste.
  corridas,
  regioesDeFala,
  planejarPedacos,
  observacoes,
}
