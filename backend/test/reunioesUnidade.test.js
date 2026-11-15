/**
 * Reunioes, Etapa 4 — as pecas que nao precisam de banco nem de ffmpeg:
 *   - o plano de pedacos (pula silencio, respeita o teto, corta no silencio);
 *   - as corridas de pedacos consecutivos (o buraco no envio);
 *   - a deduplicacao do eco (conservadora: so a mesma frase, ao mesmo tempo,
 *     de pessoas diferentes);
 *   - a janela da noite (atravessa a meia-noite, fim de semana, carga e
 *     memoria);
 *   - a url_base do provedor compativel (nada de rede interna);
 *   - o filtro de segredos;
 *   - os provedores OpenAI e Deepgram contra servidores HTTP falsos: o
 *     formato do pedido, a leitura da resposta e a traducao de cada erro;
 *   - a decisao do lote para cada tipo de erro.
 */
const { test, before, after } = require("node:test")
const assert = require("node:assert/strict")
const http = require("node:http")

const { planejarPedacos, corridas, regioesDeFala, observacoes } = require("../src/reunioes/transcricao")
const { acharEcos } = require("../src/reunioes/eco")
const janela = require("../src/reunioes/janela")
const { validarUrlBase } = require("../src/reunioes/urlBase")
const { limparSegredos, ErroProvedor, TIPOS } = require("../src/reunioes/provedores")
const { criarOpenAI } = require("../src/reunioes/stt/openai")
const { criarDeepgram } = require("../src/reunioes/stt/deepgram")
const { decidir } = require("../src/reunioes/lote")
const { cifrar, decifrar } = require("../src/utils/cripto")

// ---------------------------------------------------------------------------
// PROVEDOR FALSO
// ---------------------------------------------------------------------------

let servidor
let base
let proximaResposta = null // { status, corpo, cabecalhos }
let ultimoPedido = null

before(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "segredo-dos-testes-de-unidade"
  servidor = http.createServer((pedido, resposta) => {
    const partes = []
    pedido.on("data", (p) => partes.push(p))
    pedido.on("end", () => {
      ultimoPedido = { url: pedido.url, metodo: pedido.method, cabecalhos: pedido.headers, corpo: Buffer.concat(partes) }
      const r = proximaResposta || { status: 200, corpo: {} }
      resposta.writeHead(r.status, { "Content-Type": "application/json", ...(r.cabecalhos || {}) })
      resposta.end(typeof r.corpo === "string" ? r.corpo : JSON.stringify(r.corpo))
    })
  })
  await new Promise((ok) => servidor.listen(0, "127.0.0.1", ok))
  base = `http://127.0.0.1:${servidor.address().port}`
})

after(async () => {
  await new Promise((ok) => servidor?.close(ok))
})

// ---------------------------------------------------------------------------
// PLANO DE PEDACOS E CORRIDAS
// ---------------------------------------------------------------------------

test("corridas: um buraco no envio separa a gravacao em duas", () => {
  assert.deepEqual(corridas([0, 1, 2, 4, 5, 9]), [[0, 1, 2], [4, 5], [9]])
  assert.deepEqual(corridas([0]), [[0]])
})

test("regioes de fala sao o complemento dos silencios", () => {
  assert.deepEqual(
    regioesDeFala(100, [
      { inicio: 0, fim: 10 },
      { inicio: 50, fim: 70 },
      { inicio: 95, fim: Infinity },
    ]),
    [
      { inicio: 10, fim: 50 },
      { inicio: 70, fim: 95 },
    ]
  )
})

test("o plano pula o silencio longo e nao manda silencio ao provedor", () => {
  const pedacos = planejarPedacos({
    duracao: 100,
    silencios: [
      { inicio: 0, fim: 10 },
      { inicio: 30, fim: 31 },
      { inicio: 50, fim: 70 },
      { inicio: 95, fim: Infinity },
    ],
    maxS: 60,
  })
  // Dois pedacos (10-50 e 70-95, com margem), nenhum cobrindo 50-70.
  assert.equal(pedacos.length, 2)
  assert.ok(pedacos[0].inicio < 10 && pedacos[0].fim > 50 && pedacos[0].fim < 51)
  assert.ok(pedacos[1].inicio > 69 && pedacos[1].inicio < 70)
})

test("o plano respeita o teto: fala continua de 200 s vira pedacos de no maximo 60 s", () => {
  const pedacos = planejarPedacos({ duracao: 200, silencios: [], maxS: 60 })
  assert.ok(pedacos.length >= 4)
  for (const p of pedacos) assert.ok(p.fim - p.inicio <= 60.0001)
  assert.equal(pedacos[0].inicio, 0)
  assert.equal(pedacos.at(-1).fim, 200)
})

test("gravacao so de silencio nao gera pedaco nenhum", () => {
  assert.deepEqual(planejarPedacos({ duracao: 300, silencios: [{ inicio: 0, fim: Infinity }], maxS: 600 }), [])
})

test("as observacoes contam os pedacos que faltaram, a gravacao ilegivel e o disco cheio", () => {
  const obs = observacoes(
    [
      { usuario_nome: "Ana", status: "TRANSCRITO", partes: 10, ultima_parte: 13, erro: null },
      { usuario_nome: "Bruno", status: "FALHOU", partes: 3, ultima_parte: 2, erro: "o arquivo da gravação não pôde ser lido" },
      { usuario_nome: "Caio", status: "TRANSCRITO", partes: 5, ultima_parte: 4, erro: "o disco do servidor encheu às 15:10" },
    ],
    []
  )
  assert.ok(obs.includes("faltam ~40 s da gravação de Ana"), obs.join(" | "))
  assert.ok(obs.some((o) => o.startsWith("a gravação de Bruno não foi transcrita")))
  assert.ok(obs.includes("o disco do servidor encheu às 15:10 (gravação de Caio)"))
})

// ---------------------------------------------------------------------------
// ECO
// ---------------------------------------------------------------------------

test("eco: a mesma frase, ao mesmo tempo, de outra pessoa sai; fica a de maior confianca", () => {
  const ids = acharEcos([
    { id_trecho: 1, id_usuario: 1, texto: "Vamos fechar o contrato na sexta-feira.", confianca: 0.9, inicio_ms: 1000, fim_ms: 4000 },
    { id_trecho: 2, id_usuario: 2, texto: "vamos fechar o contrato na sexta feira", confianca: 0.4, inicio_ms: 1300, fim_ms: 4100 },
    { id_trecho: 3, id_usuario: 2, texto: "concordo plenamente com tudo isso", confianca: 0.9, inicio_ms: 5000, fim_ms: 7000 },
  ])
  assert.deepEqual(ids, [2])
})

test("eco: a mesma frase da MESMA pessoa, frase curta ou em outro momento nao sao eco", () => {
  assert.deepEqual(
    acharEcos([
      // mesma pessoa repetindo
      { id_trecho: 1, id_usuario: 1, texto: "precisamos revisar o plano de negocios", confianca: 0.9, inicio_ms: 0, fim_ms: 3000 },
      { id_trecho: 2, id_usuario: 1, texto: "precisamos revisar o plano de negocios", confianca: 0.8, inicio_ms: 500, fim_ms: 3500 },
      // "sim, isso" dito pelos dois: curto demais para afirmar que e eco
      { id_trecho: 3, id_usuario: 1, texto: "sim isso", confianca: 0.9, inicio_ms: 10000, fim_ms: 10500 },
      { id_trecho: 4, id_usuario: 2, texto: "sim isso", confianca: 0.2, inicio_ms: 10100, fim_ms: 10600 },
      // a mesma frase, um minuto depois (a pessoa repetiu o que o outro disse)
      { id_trecho: 5, id_usuario: 2, texto: "precisamos revisar o plano de negocios", confianca: 0.3, inicio_ms: 60000, fim_ms: 63000 },
    ]),
    []
  )
})

// ---------------------------------------------------------------------------
// JANELA
// ---------------------------------------------------------------------------

const config = janela.lerConfig({ PROCESSAMENTO_JANELA: "19:00-07:00", PROCESSAMENTO_FIM_DE_SEMANA: "true", TZ_AGENDA: "America/Sao_Paulo" })
// Quinta, 12/11/2026. Sao Paulo = UTC-3.
const quinta = (hora) => new Date(`2026-11-12T${hora}:00-03:00`)

test("janela: atravessa a meia-noite (19h ate 7h) e fica fechada no expediente", () => {
  assert.equal(janela.dentroDoHorario(quinta("18:59"), config), false)
  assert.equal(janela.dentroDoHorario(quinta("19:00"), config), true)
  assert.equal(janela.dentroDoHorario(quinta("23:30"), config), true)
  assert.equal(janela.dentroDoHorario(new Date("2026-11-13T03:00:00-03:00"), config), true)
  assert.equal(janela.dentroDoHorario(new Date("2026-11-13T07:00:00-03:00"), config), false)
  assert.equal(janela.dentroDoHorario(quinta("14:00"), config), false)
})

test("janela: sabado e domingo o dia todo, a menos que desligado", () => {
  const sabado = new Date("2026-11-14T14:00:00-03:00")
  assert.equal(janela.dentroDoHorario(sabado, config), true)
  assert.equal(janela.dentroDoHorario(sabado, { ...config, fimDeSemana: false }), false)
})

test("janela: no horario, mas com a maquina ocupada ou sem memoria, nao trabalha", () => {
  const noite = quinta("22:00")
  assert.deepEqual(janela.avaliar({ agora: noite, config, carga: () => 0.2, memoria: () => 900 }).pode, true)
  assert.equal(janela.avaliar({ agora: noite, config, carga: () => 0.8, memoria: () => 900 }).motivo, "CARGA")
  assert.equal(janela.avaliar({ agora: noite, config, carga: () => 0.2, memoria: () => 300 }).motivo, "MEMORIA")
  assert.equal(janela.avaliar({ agora: quinta("10:00"), config, carga: () => 0, memoria: () => 9999 }).motivo, "FORA_DO_HORARIO")
})

// ---------------------------------------------------------------------------
// URL DO PROVEDOR COMPATIVEL
// ---------------------------------------------------------------------------

const publico = async () => [{ address: "104.18.0.1", family: 4 }]

test("url_base: https publico passa; http, IP privado, nome interno e metadados da nuvem nao", async () => {
  delete process.env.IA_URL_BASE_PERMITIDAS
  assert.equal(await validarUrlBase("https://api.groq.com/openai/v1/", { resolver: publico }), "https://api.groq.com/openai/v1")

  for (const ruim of [
    "http://api.groq.com/openai/v1",
    "https://10.0.0.5/v1",
    "https://169.254.169.254/latest",
    "https://[::1]/v1",
    "https://postgres/v1",
    "https://localhost/v1",
    "https://usuario:senha@api.groq.com/v1",
  ]) {
    await assert.rejects(validarUrlBase(ruim, { resolver: publico }), (err) => err.status === 400, ruim)
  }
  // Um nome publico que RESOLVE para a rede interna tambem e recusado.
  await assert.rejects(
    validarUrlBase("https://parece-publico.exemplo.com/v1", { resolver: async () => [{ address: "192.168.0.10", family: 4 }] }),
    (err) => err.codigo === "URL_INTERNA"
  )
  await assert.rejects(
    validarUrlBase("https://ipv6-mapeado.exemplo.com/v1", { resolver: async () => [{ address: "::ffff:127.0.0.1", family: 6 }] }),
    (err) => err.codigo === "URL_INTERNA"
  )
})

test("url_base: o que o SERVIDOR libera em IA_URL_BASE_PERMITIDAS passa, http inclusive", async () => {
  process.env.IA_URL_BASE_PERMITIDAS = "http://whisper:8000/v1, http://10.0.0.7:9000"
  try {
    assert.equal(await validarUrlBase("http://whisper:8000/v1"), "http://whisper:8000/v1")
    assert.equal(await validarUrlBase("http://10.0.0.7:9000/v1"), "http://10.0.0.7:9000/v1")
    await assert.rejects(validarUrlBase("http://whisper:8001/v1"), (err) => err.status === 400)
  } finally {
    delete process.env.IA_URL_BASE_PERMITIDAS
  }
})

// ---------------------------------------------------------------------------
// SEGREDOS E CIFRAGEM
// ---------------------------------------------------------------------------

test("o filtro tira chave, token e sequencia longa da mensagem", () => {
  const limpo = limparSegredos(
    'Incorrect API key provided: sk-proj-AbCdEf1234567890abcdef. Authorization: Bearer eyJhbGciOi.abc.def; token=0123456789abcdef0123456789abcdef01'
  )
  assert.ok(!/sk-proj|eyJhbGci|0123456789abcdef0123/.test(limpo), limpo)
  assert.ok(limpo.includes("[oculto]"))
  assert.ok(limparSegredos("x".repeat(1000)).length <= 300)
})

test("a chave cifrada com o contexto de uma incubadora nao decifra no contexto de outra", () => {
  const pacote = cifrar("sk-chave-secreta-da-incubadora", "ia:1:TRANSCRICAO")
  assert.equal(decifrar(pacote, "ia:1:TRANSCRICAO"), "sk-chave-secreta-da-incubadora")
  assert.equal(decifrar(pacote, "ia:2:TRANSCRICAO"), null)
  assert.equal(decifrar(pacote, "ia:1:RELATORIO"), null)
  assert.equal(decifrar(pacote), null, "sem o contexto tambem nao abre")
  // O que ja existia (sem contexto) continua igual.
  assert.equal(decifrar(cifrar("token-do-google")), "token-do-google")
})

// ---------------------------------------------------------------------------
// PROVEDORES
// ---------------------------------------------------------------------------

test("OpenAI whisper: manda multipart com modelo e idioma, e devolve os segmentos com tempo", async () => {
  proximaResposta = {
    status: 200,
    corpo: {
      text: "ola tudo bem",
      segments: [
        { start: 0.5, end: 2.25, text: " Olá, tudo bem? ", avg_logprob: -0.2, no_speech_prob: 0.01 },
        { start: 3, end: 5, text: "Obrigado por assistir", avg_logprob: -1.6, no_speech_prob: 0.9 },
      ],
    },
  }
  const stt = criarOpenAI({ chave: "sk-teste", modelo: "whisper-1", urlBase: `${base}/v1` })
  assert.equal(stt.capacidades().devolveTempos, true)
  const trechos = await stt.transcrever({ audio: Buffer.from("audio"), mime: "audio/ogg" })

  assert.equal(ultimoPedido.url, "/v1/audio/transcriptions")
  assert.equal(ultimoPedido.cabecalhos.authorization, "Bearer sk-teste")
  const corpo = ultimoPedido.corpo.toString("latin1")
  assert.ok(corpo.includes('name="model"') && corpo.includes("whisper-1"))
  assert.ok(corpo.includes('name="language"') && corpo.includes("\r\npt\r\n"))
  assert.ok(corpo.includes("verbose_json"))

  // O segmento que o Whisper inventou no silencio foi descartado.
  assert.equal(trechos.length, 1)
  assert.equal(trechos[0].texto, "Olá, tudo bem?")
  assert.equal(trechos[0].inicioMs, 500)
  assert.equal(trechos[0].fimMs, 2250)
})

test("OpenAI gpt-4o-transcribe: so texto, sem tempo (o lote corta antes)", async () => {
  proximaResposta = { status: 200, corpo: { text: "Frase inteira do pedaço." } }
  const stt = criarOpenAI({ chave: "sk-teste", modelo: "gpt-4o-transcribe", urlBase: `${base}/v1` })
  assert.equal(stt.capacidades().devolveTempos, false)
  const trechos = await stt.transcrever({ audio: Buffer.from("audio"), mime: "audio/ogg" })
  assert.ok(ultimoPedido.corpo.toString("latin1").includes("\r\njson\r\n"))
  assert.deepEqual(trechos, [{ texto: "Frase inteira do pedaço.", inicioMs: 0, fimMs: null, confianca: null }])
})

test("Deepgram: audio cru, Token no cabecalho, pt-BR, e as utterances viram trechos", async () => {
  proximaResposta = {
    status: 200,
    corpo: { results: { utterances: [{ start: 1.2, end: 3.4, transcript: "Bom dia a todos", confidence: 0.93 }] } },
  }
  const stt = criarDeepgram({ chave: "dg-teste", modelo: "nova-2", urlBase: `${base}/v1` })
  const trechos = await stt.transcrever({ audio: Buffer.from("OggS-audio"), mime: "audio/ogg" })
  assert.ok(ultimoPedido.url.startsWith("/v1/listen?"))
  const params = new URLSearchParams(ultimoPedido.url.split("?")[1])
  assert.equal(params.get("model"), "nova-2")
  assert.equal(params.get("language"), "pt-BR")
  assert.equal(params.get("utterances"), "true")
  assert.equal(ultimoPedido.cabecalhos.authorization, "Token dg-teste")
  assert.equal(ultimoPedido.cabecalhos["content-type"], "audio/ogg")
  assert.equal(ultimoPedido.corpo.toString(), "OggS-audio")
  assert.deepEqual(trechos, [{ texto: "Bom dia a todos", inicioMs: 1200, fimMs: 3400, confianca: 0.93 }])
})

test("cada falha do provedor vira o tipo certo, sem segredo na mensagem", async () => {
  const stt = criarOpenAI({ chave: "sk-teste", modelo: "whisper-1", urlBase: `${base}/v1` })
  const casos = [
    [{ status: 401, corpo: { error: { message: "Incorrect API key provided: sk-proj-AbCdEf1234567890abcdef" } } }, TIPOS.CHAVE_INVALIDA],
    [{ status: 429, corpo: { error: { message: "Rate limit" } }, cabecalhos: { "Retry-After": "120" } }, TIPOS.LIMITE],
    [{ status: 429, corpo: { error: { code: "insufficient_quota", message: "You exceeded your current quota" } } }, TIPOS.CHAVE_INVALIDA],
    [{ status: 503, corpo: "upstream down" }, TIPOS.TEMPORARIA],
    [{ status: 404, corpo: { error: { message: "The model `whisper-9` does not exist" } } }, TIPOS.RECUSADA],
    [{ status: 200, corpo: "isto nao e json" }, TIPOS.RESPOSTA_INVALIDA],
    [{ status: 200, corpo: { outra: "coisa" } }, TIPOS.RESPOSTA_INVALIDA],
  ]
  for (const [resposta, tipo] of casos) {
    proximaResposta = resposta
    await assert.rejects(
      stt.transcrever({ audio: Buffer.from("a"), mime: "audio/ogg" }),
      (err) => {
        assert.ok(err instanceof ErroProvedor, `${resposta.status}: nao e ErroProvedor`)
        assert.equal(err.tipo, tipo, `${resposta.status}: ${err.message}`)
        assert.ok(!/sk-proj-AbCd/.test(err.message), err.message)
        if (tipo === TIPOS.LIMITE) assert.equal(err.retryAfterS, 120)
        return true
      }
    )
  }
})

test("provedor que nao responde no prazo: TEMPORARIA", async () => {
  const lento = http.createServer(() => {}) // nunca responde
  await new Promise((ok) => lento.listen(0, "127.0.0.1", ok))
  try {
    const stt = criarOpenAI({ chave: "k", modelo: "whisper-1", urlBase: `http://127.0.0.1:${lento.address().port}/v1` })
    await assert.rejects(
      stt.transcrever({ audio: Buffer.from("a"), mime: "audio/ogg", sinal: AbortSignal.timeout(200) }),
      (err) => err.tipo === TIPOS.TEMPORARIA
    )
  } finally {
    lento.closeAllConnections?.()
    await new Promise((ok) => lento.close(ok))
  }
})

// ---------------------------------------------------------------------------
// DECISAO DO LOTE
// ---------------------------------------------------------------------------

test("o lote decide pelo tipo: limite espera o Retry-After sem gastar tentativa; temporaria espera mais a cada vez", () => {
  const job = (tentativas) => ({ tentativas, max_tentativas: 5 })
  assert.deepEqual(decidir(new ErroProvedor(TIPOS.LIMITE, "x", { retryAfterS: 120 }), job(1)), {
    acao: "ADIAR",
    esperaS: 120,
    devolverTentativa: true,
    codigo: "LIMITE",
  })
  assert.equal(decidir(new ErroProvedor(TIPOS.TEMPORARIA, "x"), job(1)).esperaS, 60)
  assert.equal(decidir(new ErroProvedor(TIPOS.TEMPORARIA, "x"), job(2)).esperaS, 300)
  assert.equal(decidir(new ErroProvedor(TIPOS.TEMPORARIA, "x"), job(4)).esperaS, 7200)
  assert.equal(decidir(new ErroProvedor(TIPOS.TEMPORARIA, "x"), job(5)).acao, "FALHAR")
  assert.equal(decidir(new Error("bug"), job(1)).codigo, "ERRO_INTERNO")
  assert.equal(decidir(new ErroProvedor(TIPOS.RESPOSTA_INVALIDA, "x"), job(1)).acao, "ADIAR")
  assert.equal(decidir(new ErroProvedor(TIPOS.RESPOSTA_INVALIDA, "x"), job(2)).acao, "FALHAR")
  for (const tipo of [TIPOS.CHAVE_INVALIDA, TIPOS.RECUSADA, TIPOS.SEM_CONFIGURACAO]) {
    assert.equal(decidir(new ErroProvedor(tipo, "x"), job(1)).acao, "FALHAR", tipo)
  }
})
