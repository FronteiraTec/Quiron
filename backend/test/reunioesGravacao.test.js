/**
 * Reunioes — gravacao e transcricao (migracao 028, Etapa 4 de
 * docs/reunioes.md), pela API e pelo lote noturno.
 *
 * O que este arquivo prende:
 *   - a configuracao de IA: so quem tem a chave mexe; a chave de API entra e
 *     NUNCA volta (nem na resposta, nem na auditoria), e esta cifrada no banco
 *     com o contexto da incubadora; a url_base nao aponta para dentro;
 *   - sem transcricao configurada, a reuniao nao grava (e diz por que);
 *   - o consentimento: so do proprio convidado, e retirar fecha a gravacao;
 *   - os pedacos: so a dona da gravacao, com consentimento, com a reuniao
 *     aberta (ou ate 10 min depois), no tipo declarado, ate 512 KB, com os
 *     primeiros bytes conferidos; o reenvio nao duplica; o disco cheio recusa
 *     e fica anotado;
 *   - encerrar (botao, webhook ou o lote) cria o job na mesma transacao;
 *   - o lote: respeita a janela, transcreve cada gravacao no nome da dona,
 *     com o horario absoluto, diz o que faltou, apaga o eco e o audio; e cada
 *     erro do provedor tem o destino certo (adiar, falhar, avisar);
 *   - a transcricao: so anfitriao e chave, e a leitura vai para a auditoria;
 *   - reprocessar, cancelar, recuperar job interrompido, reuniao esquecida
 *     aberta e a retencao;
 *   - a incubadora B nao alcanca nada da A.
 *
 * Sem ffmpeg: o lote recebe um CONVERSOR FALSO que so junta os bytes. Os
 * pedacos levam frases marcadas (FALA[...]) e o provedor falso devolve, como
 * "transcricao", as frases que encontrar no audio que recebeu — e assim que se
 * confere que a fala de cada um chegou no nome certo. O ffmpeg de verdade e
 * testado em audioFfmpeg.test.js (so roda onde ele existe).
 *
 * Os testes dependem da ordem (o estado se acumula), como uma sessao de uso.
 */
const { test, before, after } = require("node:test")
const assert = require("node:assert/strict")
const http = require("node:http")
const os = require("node:os")
const fs = require("node:fs")
const path = require("node:path")

const { prepararBanco, encerrar } = require("../apoio-teste/banco")
const { subirApi, req } = require("../apoio-teste/api")

const CHAVE_LK = "chave-de-teste"
const SEGREDO_LK = "segredo-de-teste-com-mais-de-trinta-e-dois-caracteres"
const CHAVE_IA = "sk-teste-chave-da-incubadora-abcd"
const EBML = Buffer.from([0x1a, 0x45, 0xdf, 0xa3])

let api
let c
let query
let livekitFalso
let stt // o provedor de transcricao falso
let sttBase
let respostaStt = null // null = transcreve normalmente; senao { status, corpo, cabecalhos }
let pedidosStt = 0
let pastaAudio

let reuniao // a mentoria principal: mentorA (anfitriao) e colaboradorA
let audioColab
let audioMentor

// ---------------------------------------------------------------------------
// APOIO
// ---------------------------------------------------------------------------

const como = (quem) => ({
  get: (caminho) => req(api.url, caminho, { token: quem.token }),
  post: (caminho, corpo) => req(api.url, caminho, { metodo: "POST", token: quem.token, corpo: corpo || {} }),
  put: (caminho, corpo) => req(api.url, caminho, { metodo: "PUT", token: quem.token, corpo: corpo || {} }),
})

/** PUT de um pedaco de audio cru. */
async function parte(quem, idReuniao, idAudio, n, dados, tipo = "audio/webm;codecs=opus") {
  const r = await fetch(`${api.url}/reunioes/${idReuniao}/gravacoes/${idAudio}/partes/${n}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${quem.token}`, "Content-Type": tipo },
    body: dados,
  })
  return { status: r.status, corpo: await r.json().catch(() => null) }
}

/** O pedaco 0 tem o cabecalho EBML; os demais, so a continuacao. */
const pedaco0 = (frase) => Buffer.concat([EBML, Buffer.from(`........FALA[${frase}]`)])
const pedacoN = (frase) => Buffer.from(`FALA[${frase}]`)

function parede(minutos) {
  const d = new Date(Date.now() + minutos * 60000)
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value])
  )
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}

async function criarReuniao(anfitriao, convidados, titulo = "Mentoria gravada") {
  const r = await como(anfitriao).post("/reunioes", {
    id_tenant: c.tenantA.id_tenant,
    titulo,
    categoria: "MENTORIA",
    inicio_ts: parede(0),
    fim_ts: parede(60),
    participantes: convidados.map((p) => p.id),
  })
  assert.equal(r.status, 201, JSON.stringify(r.corpo))
  return r.corpo.reuniao
}

/** O conversor falso: junta os bytes; "dura" 10 s por pedaco; sem silencio. */
function conversorFalso() {
  const duracoes = new Map()
  return {
    extrairCabecalho: (mime, parte0) => (parte0.subarray(0, 4).equals(EBML) ? parte0.subarray(0, 4) : null),
    async normalizar({ partes, destino, cabecalho }) {
      const bytes = [cabecalho || Buffer.alloc(0), ...partes.map((p) => fs.readFileSync(p))]
      fs.writeFileSync(destino, Buffer.concat(bytes))
      duracoes.set(destino, partes.length * 10)
    },
    duracao: async (arquivo) => duracoes.get(arquivo) ?? 10,
    silencios: async () => [],
    async recortar(arquivo, inicio, duracao, destino) {
      fs.copyFileSync(arquivo, destino)
    },
  }
}

const rodarLote = (extra = {}) =>
  require("../src/reunioes/lote").rodar({
    ignorarJanela: true,
    conversor: conversorFalso(),
    log: () => {},
    dormir: async () => {},
    ...extra,
  })

/** Deixa os jobs PENDENTE da reuniao prontos para o lote agora. */
const liberarFila = (idReuniao) =>
  query(`UPDATE reuniao_processamento SET proxima_tentativa_ts = NOW() - interval '1 second' WHERE id_reuniao = $1 AND status = 'PENDENTE'`, [idReuniao])

const jobsDa = async (idReuniao) =>
  (await query(`SELECT * FROM reuniao_processamento WHERE id_reuniao = $1 ORDER BY id_processamento`, [idReuniao])).rows

async function configurarTranscricao() {
  const r = await como(c.adminA).put("/ia-config/TRANSCRICAO", {
    id_tenant: c.tenantA.id_tenant,
    provedor: "OPENAI_COMPATIVEL",
    modelo: "whisper-large-v3",
    url_base: `${sttBase}/v1`,
    chave: CHAVE_IA,
  })
  assert.equal(r.status, 200, JSON.stringify(r.corpo))
  return r
}

// ---------------------------------------------------------------------------
// MONTAGEM
// ---------------------------------------------------------------------------

before(async () => {
  livekitFalso = http.createServer((pedido, resposta) => {
    let corpo = ""
    pedido.on("data", (p) => (corpo += p))
    pedido.on("end", () => {
      const metodo = pedido.url.split("/").pop()
      let json = null
      try {
        json = JSON.parse(corpo)
      } catch {
        // vazio
      }
      resposta.writeHead(200, { "Content-Type": "application/json" })
      resposta.end(metodo === "CreateRoom" ? JSON.stringify({ name: json?.name }) : "{}")
    })
  })
  await new Promise((ok) => livekitFalso.listen(0, "127.0.0.1", ok))

  // O provedor de transcricao falso, compativel com a OpenAI: devolve como
  // segmentos as frases FALA[...] que achar no audio recebido.
  stt = http.createServer((pedido, resposta) => {
    const partes = []
    pedido.on("data", (p) => partes.push(p))
    pedido.on("end", () => {
      pedidosStt += 1
      if (respostaStt) {
        resposta.writeHead(respostaStt.status, { "Content-Type": "application/json", ...(respostaStt.cabecalhos || {}) })
        resposta.end(JSON.stringify(respostaStt.corpo || {}))
        return
      }
      const corpo = Buffer.concat(partes).toString("latin1")
      const frases = [...corpo.matchAll(/FALA\[([^\]]*)\]/g)].map((m) => m[1])
      resposta.writeHead(200, { "Content-Type": "application/json" })
      resposta.end(
        JSON.stringify({
          text: frases.join(" "),
          segments: frases.map((f, i) => ({ start: i * 10 + 1, end: i * 10 + 4, text: ` ${f} `, avg_logprob: -0.1, no_speech_prob: 0.01 })),
        })
      )
    })
  })
  await new Promise((ok) => stt.listen(0, "127.0.0.1", ok))
  sttBase = `http://127.0.0.1:${stt.address().port}`

  pastaAudio = fs.mkdtempSync(path.join(os.tmpdir(), "quiron-teste-audio-"))
  process.env.AUDIO_DIR = pastaAudio
  process.env.AUDIO_DISCO_MIN_MB = "0"
  process.env.IA_URL_BASE_PERMITIDAS = `${sttBase}/v1`
  process.env.LIVEKIT_URL = `ws://127.0.0.1:${livekitFalso.address().port}`
  process.env.LIVEKIT_API_KEY = CHAVE_LK
  process.env.LIVEKIT_API_SECRET = SEGREDO_LK

  await prepararBanco()
  c = await require("../apoio-teste/cenario").montarCenario()
  api = await subirApi()
  query = require("../src/config/db").query
})

after(async () => {
  await api?.fechar()
  await new Promise((ok) => livekitFalso?.close(ok))
  await new Promise((ok) => stt?.close(ok))
  fs.rmSync(pastaAudio, { recursive: true, force: true })
  await encerrar()
})

// ---------------------------------------------------------------------------
// SEM TRANSCRICAO CONFIGURADA, A REUNIAO NAO GRAVA
// ---------------------------------------------------------------------------

test("sem o provedor de transcricao, a reuniao diz que nao grava e recusa o consentimento", async () => {
  reuniao = await criarReuniao(c.mentorA, [c.colaboradorA])
  assert.equal(reuniao.gravacao.disponivel, false)
  assert.equal(reuniao.gravacao.motivo, "SEM_TRANSCRICAO")
  assert.deepEqual(reuniao.meu_consentimento, { decidido: false, aceito: false, consentiu_ts: null, revogado_ts: null })

  const r = await como(c.colaboradorA).post(`/reunioes/${reuniao.id_reuniao}/consentimento`, { aceito: true })
  assert.equal(r.status, 409)
  assert.equal(r.corpo.codigo, "GRAVACAO_INDISPONIVEL")
})

// ---------------------------------------------------------------------------
// CONFIGURACAO DE IA
// ---------------------------------------------------------------------------

test("so quem tem a chave ve e mexe na configuracao de IA; a B nao alcanca a da A", async () => {
  assert.equal((await como(c.colaboradorA).get(`/ia-config?id_tenant=${c.tenantA.id_tenant}`)).status, 403)
  assert.equal((await como(c.mentorA).get(`/ia-config?id_tenant=${c.tenantA.id_tenant}`)).status, 403)
  assert.equal((await como(c.adminB).get(`/ia-config?id_tenant=${c.tenantA.id_tenant}`)).status, 403)
  assert.equal(
    (await como(c.adminB).put("/ia-config/TRANSCRICAO", { id_tenant: c.tenantA.id_tenant, provedor: "OPENAI", chave: CHAVE_IA })).status,
    403
  )

  const r = await como(c.adminA).get(`/ia-config?id_tenant=${c.tenantA.id_tenant}`)
  assert.equal(r.status, 200)
  assert.deepEqual(r.corpo.configuracoes, [])
  assert.deepEqual(r.corpo.retencao, { audio_dias: 0, transcricao_dias: 180 })
  assert.ok(r.corpo.provedores.TRANSCRICAO.OPENAI)
  assert.equal(r.corpo.pode_editar, true)
})

test("a configuracao e conferida: chave obrigatoria na primeira vez, provedor da finalidade, endereco publico", async () => {
  const a = como(c.adminA)
  const base = { id_tenant: c.tenantA.id_tenant }
  assert.equal((await a.put("/ia-config/TRANSCRICAO", { ...base, provedor: "OPENAI" })).status, 400, "sem chave")
  assert.equal((await a.put("/ia-config/TRANSCRICAO", { ...base, provedor: "ANTHROPIC", chave: CHAVE_IA })).status, 400, "Anthropic nao transcreve")
  assert.equal((await a.put("/ia-config/RELATORIO", { ...base, provedor: "OPENAI", chave: CHAVE_IA })).status, 400, "relatorio e da Etapa 5")
  for (const url of ["http://api.exemplo.com/v1", "https://10.1.2.3/v1", "https://postgres/v1", "https://localhost:8443/v1"]) {
    const r = await a.put("/ia-config/TRANSCRICAO", { ...base, provedor: "OPENAI_COMPATIVEL", modelo: "w", url_base: url, chave: CHAVE_IA })
    assert.equal(r.status, 400, url)
  }
  const { rows } = await query("SELECT COUNT(*)::int AS n FROM tenant_ia_config")
  assert.equal(rows[0].n, 0)
})

test("a chave de API entra cifrada e nunca volta: nem na resposta, nem na listagem, nem na auditoria", async () => {
  const r = await configurarTranscricao()
  const cfg = r.corpo.configuracao
  assert.equal(cfg.provedor, "OPENAI_COMPATIVEL")
  assert.equal(cfg.chave_final, "abcd")
  assert.equal(cfg.chave, undefined)
  assert.equal(cfg.chave_cifrada, undefined)
  assert.ok(!JSON.stringify(r.corpo).includes(CHAVE_IA))

  const lista = await como(c.adminA).get(`/ia-config?id_tenant=${c.tenantA.id_tenant}`)
  assert.ok(!JSON.stringify(lista.corpo).includes(CHAVE_IA))

  const { rows } = await query("SELECT chave_cifrada FROM tenant_ia_config WHERE id_tenant = $1", [c.tenantA.id_tenant])
  assert.ok(!rows[0].chave_cifrada.includes(CHAVE_IA))
  const { decifrar } = require("../src/utils/cripto")
  assert.equal(decifrar(rows[0].chave_cifrada, `ia:${c.tenantA.id_tenant}:TRANSCRICAO`), CHAVE_IA)
  assert.equal(decifrar(rows[0].chave_cifrada, `ia:${c.tenantB.id_tenant}:TRANSCRICAO`), null, "copiada para a B, nao abre")

  const auditoria = await query("SELECT * FROM audit_log WHERE entidade = 'ia_config'")
  assert.equal(auditoria.rows.length, 1)
  assert.ok(!JSON.stringify(auditoria.rows).includes(CHAVE_IA))
  assert.ok(auditoria.rows[0].descricao.includes("abcd"))

  // Salvar sem mandar a chave mantem a atual.
  const sem = await como(c.adminA).put("/ia-config/TRANSCRICAO", {
    id_tenant: c.tenantA.id_tenant,
    provedor: "OPENAI_COMPATIVEL",
    modelo: "whisper-large-v3",
    url_base: `${sttBase}/v1`,
  })
  assert.equal(sem.status, 200)
  const depois = await query("SELECT chave_cifrada FROM tenant_ia_config WHERE id_tenant = $1", [c.tenantA.id_tenant])
  assert.equal(decifrar(depois.rows[0].chave_cifrada, `ia:${c.tenantA.id_tenant}:TRANSCRICAO`), CHAVE_IA)
})

test("testar a conexao: chave aceita fica marcada; chave recusada guarda o motivo, sem a chave", async () => {
  const ok = await como(c.adminA).post("/ia-config/TRANSCRICAO/testar", { id_tenant: c.tenantA.id_tenant })
  assert.equal(ok.status, 200)
  assert.equal(ok.corpo.ok, true)
  assert.equal(ok.corpo.configuracao.ultima_validacao_ok, true)

  respostaStt = { status: 401, corpo: { error: { message: `Incorrect API key provided: ${CHAVE_IA}` } } }
  try {
    const ruim = await como(c.adminA).post("/ia-config/TRANSCRICAO/testar", { id_tenant: c.tenantA.id_tenant })
    assert.equal(ruim.corpo.ok, false)
    assert.match(ruim.corpo.erro, /recusou a chave/)
    assert.ok(!JSON.stringify(ruim.corpo).includes(CHAVE_IA))
  } finally {
    respostaStt = null
  }
  assert.equal((await como(c.mentorA).post("/ia-config/TRANSCRICAO/testar", { id_tenant: c.tenantA.id_tenant })).status, 403)
})

// ---------------------------------------------------------------------------
// CONSENTIMENTO
// ---------------------------------------------------------------------------

test("com a transcricao ligada, a reuniao grava e o aviso sabe quem transcreve e por quanto tempo guarda", async () => {
  const r = await como(c.colaboradorA).get(`/reunioes/${reuniao.id_reuniao}`)
  assert.equal(r.corpo.reuniao.gravacao.disponivel, true)
  assert.equal(r.corpo.reuniao.gravacao.provedor_rotulo, "Compatível com a OpenAI")
  assert.deepEqual(r.corpo.reuniao.gravacao.retencao, { audio_dias: 0, transcricao_dias: 180 })
  assert.equal(r.corpo.reuniao.gravacao.segundos_por_parte, 10)
})

test("cada convidado decide pela propria fala; quem nao foi convidado nao decide nada", async () => {
  const r = await como(c.colaboradorA).post(`/reunioes/${reuniao.id_reuniao}/consentimento`, { aceito: true })
  assert.equal(r.status, 200, JSON.stringify(r.corpo))
  assert.equal(r.corpo.consentimento.aceito, true)
  assert.equal(r.corpo.consentimento.decidido, true)

  assert.equal((await como(c.mentorA).post(`/reunioes/${reuniao.id_reuniao}/consentimento`, { aceito: true })).status, 200)
  assert.equal((await como(c.adminB).post(`/reunioes/${reuniao.id_reuniao}/consentimento`, { aceito: true })).status, 404)
  // O admin da A enxerga a reuniao (chave), mas nao foi convidado.
  assert.equal((await como(c.adminA).post(`/reunioes/${reuniao.id_reuniao}/consentimento`, { aceito: true })).status, 403)
  assert.equal((await como(c.colaboradorA).post(`/reunioes/${reuniao.id_reuniao}/consentimento`, { aceito: "sim" })).status, 400)

  const auditoria = await query("SELECT acao FROM audit_log WHERE entidade = 'reuniao' AND acao = 'CONSENTIR'")
  assert.equal(auditoria.rows.length, 2)
})

test("o token da sala leva o selo de gravacao de quem aceitou", async () => {
  const r = await como(c.colaboradorA).post(`/reunioes/${reuniao.id_reuniao}/token`)
  assert.equal(r.status, 200, JSON.stringify(r.corpo))
  const jwt = JSON.parse(Buffer.from(r.corpo.token.split(".")[1], "base64url").toString("utf8"))
  assert.deepEqual(jwt.attributes, { gravacao: "sim" })
})

// ---------------------------------------------------------------------------
// GRAVACOES E PEDACOS
// ---------------------------------------------------------------------------

test("abrir uma gravacao: so audio/webm, audio/ogg ou audio/mp4", async () => {
  const caminho = `/reunioes/${reuniao.id_reuniao}/gravacoes`
  assert.equal((await como(c.colaboradorA).post(caminho, { mime: "video/mp4" })).status, 400)
  assert.equal((await como(c.colaboradorA).post(caminho, { mime: "audio/wav" })).status, 400)
  assert.equal((await como(c.adminB).post(caminho, { mime: "audio/webm" })).status, 404)

  const r = await como(c.colaboradorA).post(caminho, { mime: "audio/webm;codecs=opus" })
  assert.equal(r.status, 201, JSON.stringify(r.corpo))
  assert.equal(r.corpo.segundos_por_parte, 10)
  assert.equal(r.corpo.max_bytes, 512 * 1024)
  audioColab = r.corpo.id_audio
})

test("o pedaco 0 tem de ser do formato declarado; o tipo tem de bater com o da gravacao", async () => {
  const id = reuniao.id_reuniao
  const lixo = await parte(c.colaboradorA, id, audioColab, 0, Buffer.from("isto nao e audio nenhum, e texto"))
  assert.equal(lixo.status, 400)
  assert.equal(lixo.corpo.codigo, "CONTEUDO_INVALIDO")
  assert.equal((await parte(c.colaboradorA, id, audioColab, 0, pedaco0("ola"), "audio/ogg")).status, 415)
  assert.equal((await parte(c.colaboradorA, id, audioColab, 0, pedaco0("ola"), "application/octet-stream")).status, 415)
  assert.equal(fs.existsSync(path.join(pastaAudio, String(c.tenantA.id_tenant))), false, "nada foi gravado no disco")
})

test("o pedaco certo vai para o disco; o reenvio responde 200 sem contar duas vezes", async () => {
  const id = reuniao.id_reuniao
  const r = await parte(c.colaboradorA, id, audioColab, 0, pedaco0("bom dia mentor"))
  assert.equal(r.status, 200, JSON.stringify(r.corpo))
  assert.equal(r.corpo.repetido, false)
  const repetido = await parte(c.colaboradorA, id, audioColab, 0, pedaco0("bom dia mentor"))
  assert.equal(repetido.status, 200)
  assert.equal(repetido.corpo.repetido, true)

  assert.equal((await parte(c.colaboradorA, id, audioColab, 1, pedacoN("nosso faturamento cresceu"))).status, 200)
  // O pedaco 2 "se perdeu"; o 3 chega.
  assert.equal((await parte(c.colaboradorA, id, audioColab, 3, pedacoN("queremos captar investimento"))).status, 200)

  const { rows } = await query("SELECT partes, ultima_parte FROM reuniao_audio WHERE id_audio = $1", [audioColab])
  assert.deepEqual(rows[0], { partes: 3, ultima_parte: 3 })
  const pasta = path.join(pastaAudio, String(c.tenantA.id_tenant), String(id), String(audioColab))
  assert.deepEqual(fs.readdirSync(pasta).sort(), ["0.parte", "1.parte", "3.parte"])
})

test("o pedaco de outra pessoa, de outra incubadora, grande demais ou com numero invalido e recusado", async () => {
  const id = reuniao.id_reuniao
  assert.equal((await parte(c.mentorA, id, audioColab, 4, pedacoN("intruso"))).status, 404, "o anfitriao nao escreve na gravacao do convidado")
  assert.equal((await parte(c.adminB, id, audioColab, 4, pedacoN("intruso"))).status, 404)
  assert.equal((await parte(c.colaboradorA, id + 999, audioColab, 4, pedacoN("x"))).status, 404, "a gravacao e de outra reuniao")
  assert.equal((await parte(c.colaboradorA, id, audioColab, 4, Buffer.alloc(600 * 1024, 1))).status, 413)
  assert.equal((await parte(c.colaboradorA, id, audioColab, "-1", pedacoN("x"))).status, 400)
  assert.equal((await parte(c.colaboradorA, id, audioColab, "1.5", pedacoN("x"))).status, 400)
  assert.equal((await parte(c.colaboradorA, id, audioColab, "../../etc", pedacoN("x"))).status, 404)
  assert.equal((await parte(c.colaboradorA, id, audioColab, 5, Buffer.alloc(0))).status, 400)
})

test("disco abaixo do minimo: o pedaco e recusado e o momento fica anotado na gravacao", async () => {
  process.env.AUDIO_DISCO_MIN_MB = String(1e12)
  try {
    const r = await parte(c.colaboradorA, reuniao.id_reuniao, audioColab, 4, pedacoN("perdida"))
    assert.equal(r.status, 507)
    assert.equal(r.corpo.codigo, "SEM_ESPACO")
    assert.equal((await como(c.mentorA).post(`/reunioes/${reuniao.id_reuniao}/gravacoes`, { mime: "audio/webm" })).status, 409)
  } finally {
    process.env.AUDIO_DISCO_MIN_MB = "0"
  }
  const { rows } = await query("SELECT erro FROM reuniao_audio WHERE id_audio = $1", [audioColab])
  assert.match(rows[0].erro, /^o disco do servidor encheu às \d{2}:\d{2}$/)
})

test("retirar o consentimento fecha a gravacao na hora; voltar a aceitar abre outra", async () => {
  const id = reuniao.id_reuniao
  assert.equal((await como(c.colaboradorA).post(`/reunioes/${id}/consentimento`, { aceito: false })).status, 200)
  const depois = await parte(c.colaboradorA, id, audioColab, 5, pedacoN("depois de retirar"))
  assert.equal(depois.status, 409)
  assert.equal((await como(c.colaboradorA).post(`/reunioes/${id}/gravacoes`, { mime: "audio/webm" })).status, 409)

  const { rows } = await query("SELECT status FROM reuniao_audio WHERE id_audio = $1", [audioColab])
  assert.equal(rows[0].status, "DISPONIVEL", "o que ja tinha chegado fica para a transcricao")

  const d = await como(c.colaboradorA).get(`/reunioes/${id}`)
  assert.equal(d.corpo.reuniao.meu_consentimento.aceito, false)
  assert.ok(d.corpo.reuniao.meu_consentimento.revogado_ts)

  assert.equal((await como(c.colaboradorA).post(`/reunioes/${id}/consentimento`, { aceito: true })).status, 200)
  const nova = await como(c.colaboradorA).post(`/reunioes/${id}/gravacoes`, { mime: "audio/webm" })
  assert.equal(nova.status, 201)
  assert.notEqual(nova.corpo.id_audio, audioColab)
  assert.equal((await parte(c.colaboradorA, id, nova.corpo.id_audio, 0, pedaco0("voltei a falar"))).status, 200)
  // Fechar e idempotente; depois de fechada, nenhum pedaco entra.
  assert.equal((await como(c.colaboradorA).post(`/reunioes/${id}/gravacoes/${nova.corpo.id_audio}/fechar`)).status, 200)
  assert.equal((await como(c.colaboradorA).post(`/reunioes/${id}/gravacoes/${nova.corpo.id_audio}/fechar`)).status, 200)
  assert.equal((await parte(c.colaboradorA, id, nova.corpo.id_audio, 1, pedacoN("tarde demais"))).status, 409)
})

test("o anfitriao grava a propria fala, numa gravacao dele", async () => {
  const r = await como(c.mentorA).post(`/reunioes/${reuniao.id_reuniao}/gravacoes`, { mime: "audio/webm;codecs=opus" })
  assert.equal(r.status, 201)
  audioMentor = r.corpo.id_audio
  assert.equal((await parte(c.mentorA, reuniao.id_reuniao, audioMentor, 0, pedaco0("vamos falar do pitch"))).status, 200)
})

// ---------------------------------------------------------------------------
// ENCERRAMENTO
// ---------------------------------------------------------------------------

test("encerrar cria o job de transcricao na mesma hora, para dali a 10 minutos", async () => {
  const r = await como(c.mentorA).post(`/reunioes/${reuniao.id_reuniao}/encerrar`)
  assert.equal(r.status, 202)
  const jobs = await jobsDa(reuniao.id_reuniao)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].tipo, "TRANSCRICAO")
  assert.equal(jobs[0].status, "PENDENTE")
  const { rows } = await query(
    "SELECT EXTRACT(EPOCH FROM (proxima_tentativa_ts - NOW()))::int AS s FROM reuniao_processamento WHERE id_processamento = $1",
    [jobs[0].id_processamento]
  )
  assert.ok(rows[0].s > 540 && rows[0].s <= 600, `espera ${rows[0].s}s`)

  const d = await como(c.mentorA).get(`/reunioes/${reuniao.id_reuniao}`)
  assert.equal(d.corpo.reuniao.transcricao, "PENDENTE")
  assert.equal(d.corpo.reuniao.processamento.status, "PENDENTE")
  assert.equal(d.corpo.reuniao.janela_processamento.fim, "07:00")
})

test("depois de encerrada, os ultimos pedacos entram por 10 minutos, e nao depois", async () => {
  const id = reuniao.id_reuniao
  assert.equal((await parte(c.mentorA, id, audioMentor, 1, pedacoN("ultima frase do mentor"))).status, 200)
  await query("UPDATE reuniao SET encerrada_ts = NOW() - interval '11 minutes' WHERE id_reuniao = $1", [id])
  assert.equal((await parte(c.mentorA, id, audioMentor, 2, pedacoN("tarde demais"))).status, 409)
  await query("UPDATE reuniao SET encerrada_ts = NOW() - interval '9 minutes' WHERE id_reuniao = $1", [id])
  // Consentir depois do fim: nao muda mais.
  assert.equal((await como(c.colaboradorA).post(`/reunioes/${id}/consentimento`, { aceito: false })).status, 409)
})

// ---------------------------------------------------------------------------
// O LOTE NOTURNO
// ---------------------------------------------------------------------------

test("fora da janela o lote nao toca em nada; com a maquina ocupada, espera e confere de novo", async () => {
  await liberarFila(reuniao.id_reuniao)
  const lote = require("../src/reunioes/lote")
  const fora = await lote.rodar({ avaliarJanela: () => ({ pode: false, motivo: "FORA_DO_HORARIO" }), conversor: conversorFalso(), log: () => {} })
  assert.equal(fora.motivo, "FORA_DA_JANELA")
  assert.equal((await jobsDa(reuniao.id_reuniao))[0].status, "PENDENTE")
  assert.equal(pedidosStt, 2, "so os dois testes de conexao chamaram o provedor")

  // Ocupada, ocupada, e depois fora do horario: dormiu duas vezes e saiu sem processar.
  const respostas = [
    { pode: false, motivo: "CARGA" },
    { pode: false, motivo: "MEMORIA" },
    { pode: false, motivo: "FORA_DO_HORARIO" },
  ]
  let dormiu = 0
  const r = await lote.rodar({
    avaliarJanela: () => respostas.shift(),
    dormir: async () => {
      dormiu += 1
    },
    conversor: conversorFalso(),
    log: () => {},
  })
  assert.equal(dormiu, 2)
  assert.equal(r.motivo, "FORA_DA_JANELA")
  assert.equal((await jobsDa(reuniao.id_reuniao))[0].status, "PENDENTE")
})

test("o lote transcreve cada gravacao no nome da dona, no horario certo, e diz o que faltou", async () => {
  const r = await rodarLote()
  assert.equal(r.concluidos, 1, JSON.stringify(r))
  assert.equal(r.falhos, 0)

  const job = (await jobsDa(reuniao.id_reuniao))[0]
  assert.equal(job.status, "CONCLUIDO")
  assert.equal(job.provedor, "OPENAI_COMPATIVEL")
  assert.equal(job.modelo, "whisper-large-v3")

  const { rows: trechos } = await query(
    `SELECT t.id_usuario, t.texto, t.origem,
            EXTRACT(EPOCH FROM (t.inicio_ts - a.inicio_ts))::numeric(10,1) AS desde_inicio
       FROM reuniao_trecho t JOIN reuniao_audio a ON a.id_audio = t.id_audio
      WHERE t.id_reuniao = $1 ORDER BY t.id_usuario, t.inicio_ts`,
    [reuniao.id_reuniao]
  )
  const de = (quem) => trechos.filter((t) => t.id_usuario === quem.id).map((t) => t.texto)
  assert.deepEqual(de(c.colaboradorA).sort(), ["bom dia mentor", "nosso faturamento cresceu", "queremos captar investimento", "voltei a falar"].sort())
  assert.deepEqual(de(c.mentorA).sort(), ["ultima frase do mentor", "vamos falar do pitch"].sort())
  assert.ok(trechos.every((t) => t.origem === "OPENAI_COMPATIVEL:whisper-large-v3"))
  // O horario e o inicio da gravacao + o deslocamento que o provedor devolveu.
  assert.ok(trechos.some((t) => Number(t.desde_inicio) === 1.0))

  const { rows } = await query("SELECT transcricao, transcricao_obs FROM reuniao WHERE id_reuniao = $1", [reuniao.id_reuniao])
  assert.equal(rows[0].transcricao, "INCOMPLETA")
  assert.match(rows[0].transcricao_obs, /faltam ~10 s da gravação de/)
  assert.match(rows[0].transcricao_obs, /disco do servidor encheu às \d{2}:\d{2} \(gravação de/i)
})

test("depois de transcrito, o audio sai do disco (retencao de 0 dias)", async () => {
  const { rows } = await query("SELECT status, excluido_ts FROM reuniao_audio WHERE id_reuniao = $1 AND partes > 0", [reuniao.id_reuniao])
  assert.ok(rows.length >= 3)
  assert.ok(rows.every((a) => a.status === "EXCLUIDO" && a.excluido_ts), JSON.stringify(rows))
  assert.equal(fs.existsSync(path.join(pastaAudio, String(c.tenantA.id_tenant), String(reuniao.id_reuniao))), false)
})

test("a transcricao e do anfitriao e de quem tem a chave; cada leitura vai para a auditoria", async () => {
  const caminho = `/reunioes/${reuniao.id_reuniao}/transcricao`
  const r = await como(c.mentorA).get(caminho)
  assert.equal(r.status, 200, JSON.stringify(r.corpo))
  assert.equal(r.corpo.transcricao, "INCOMPLETA")
  assert.equal(r.corpo.trechos.length, 6)
  assert.ok(r.corpo.trechos.every((t) => t.nome && t.inicio_ts.endsWith("Z")))
  assert.equal(r.corpo.falantes.length, 2)

  assert.equal((await como(c.colaboradorA).get(caminho)).status, 403, "o convidado nao le a transcricao")
  assert.equal((await como(c.adminA).get(caminho)).status, 200, "o admin tem a chave")
  assert.equal((await como(c.adminB).get(caminho)).status, 404)

  const { rows } = await query("SELECT COUNT(*)::int AS n FROM audit_log WHERE entidade = 'reuniao_transcricao' AND acao = 'LER'")
  assert.equal(rows[0].n, 2)

  const d = await como(c.colaboradorA).get(`/reunioes/${reuniao.id_reuniao}`)
  assert.equal(d.corpo.reuniao.permissoes.ler, false)
  const dm = await como(c.mentorA).get(`/reunioes/${reuniao.id_reuniao}`)
  assert.equal(dm.corpo.reuniao.permissoes.ler, true)
})

test("o historico do processamento mostra cada tentativa", async () => {
  const r = await como(c.mentorA).get(`/reunioes/${reuniao.id_reuniao}/processamentos`)
  assert.equal(r.status, 200)
  assert.equal(r.corpo.processamentos.length, 1)
  assert.deepEqual(r.corpo.processamentos[0].tentativas_log.map((l) => l.evento), ["INICIO", "SUCESSO"])
  assert.equal((await como(c.colaboradorA).get(`/reunioes/${reuniao.id_reuniao}/processamentos`)).status, 403)
})

test("reprocessar sem audio guardado: 409, e so com a chave", async () => {
  assert.equal((await como(c.mentorA).post(`/reunioes/${reuniao.id_reuniao}/processamentos`, { tipo: "TRANSCRICAO" })).status, 403)
  const r = await como(c.adminA).post(`/reunioes/${reuniao.id_reuniao}/processamentos`, { tipo: "TRANSCRICAO" })
  assert.equal(r.status, 409)
  assert.equal(r.corpo.codigo, "SEM_AUDIO")
})

// ---------------------------------------------------------------------------
// ERROS DO PROVEDOR
// ---------------------------------------------------------------------------

let segunda // reuniao para os erros

async function reuniaoGravadaEEncerrada(titulo) {
  const r = await criarReuniao(c.mentorA, [c.colaboradorA], titulo)
  assert.equal((await como(c.mentorA).post(`/reunioes/${r.id_reuniao}/consentimento`, { aceito: true })).status, 200)
  const g = await como(c.mentorA).post(`/reunioes/${r.id_reuniao}/gravacoes`, { mime: "audio/webm" })
  assert.equal(g.status, 201)
  assert.equal((await parte(c.mentorA, r.id_reuniao, g.corpo.id_audio, 0, pedaco0(`frase de ${titulo}`))).status, 200)
  assert.equal((await como(c.mentorA).post(`/reunioes/${r.id_reuniao}/encerrar`)).status, 202)
  await liberarFila(r.id_reuniao)
  return { ...r, id_audio: g.corpo.id_audio }
}

test("limite de uso (429): adia pelo Retry-After, sem gastar tentativa", async () => {
  segunda = await reuniaoGravadaEEncerrada("Reuniao com erros")
  respostaStt = { status: 429, corpo: { error: { message: "Rate limit reached" } }, cabecalhos: { "Retry-After": "120" } }
  try {
    const r = await rodarLote()
    assert.equal(r.adiados, 1)
  } finally {
    respostaStt = null
  }
  const [job] = await jobsDa(segunda.id_reuniao)
  assert.equal(job.status, "PENDENTE")
  assert.equal(job.tentativas, 0, "o limite nao conta como tentativa")
  assert.equal(job.erro_codigo, "LIMITE")
  const { rows } = await query("SELECT EXTRACT(EPOCH FROM (proxima_tentativa_ts - NOW()))::int AS s FROM reuniao_processamento WHERE id_processamento = $1", [job.id_processamento])
  assert.ok(rows[0].s > 100 && rows[0].s <= 120, `espera ${rows[0].s}s`)
})

test("falha temporaria (5xx): adia 1 minuto e conta a tentativa", async () => {
  await liberarFila(segunda.id_reuniao)
  respostaStt = { status: 503, corpo: { error: { message: "overloaded" } } }
  try {
    assert.equal((await rodarLote()).adiados, 1)
  } finally {
    respostaStt = null
  }
  const [job] = await jobsDa(segunda.id_reuniao)
  assert.equal(job.status, "PENDENTE")
  assert.equal(job.tentativas, 1)
  assert.equal(job.erro_codigo, "TEMPORARIA")
  const { rows } = await query("SELECT EXTRACT(EPOCH FROM (proxima_tentativa_ts - NOW()))::int AS s FROM reuniao_processamento WHERE id_processamento = $1", [job.id_processamento])
  assert.ok(rows[0].s > 40 && rows[0].s <= 60, `espera ${rows[0].s}s`)
})

test("chave recusada (401): falha de vez, marca a configuracao e nao guarda segredo", async () => {
  await liberarFila(segunda.id_reuniao)
  respostaStt = { status: 401, corpo: { error: { message: `Incorrect API key provided: ${CHAVE_IA}` } } }
  try {
    assert.equal((await rodarLote()).falhos, 1)
  } finally {
    respostaStt = null
  }
  const [job] = await jobsDa(segunda.id_reuniao)
  assert.equal(job.status, "FALHOU")
  assert.equal(job.erro_codigo, "CHAVE_INVALIDA")
  assert.ok(!job.erro_mensagem.includes(CHAVE_IA), job.erro_mensagem)
  const logs = await query("SELECT detalhe::text AS d FROM reuniao_processamento_log WHERE id_processamento = $1", [job.id_processamento])
  assert.ok(logs.rows.every((l) => !String(l.d).includes(CHAVE_IA)))

  const { rows } = await query("SELECT ultima_validacao_ok FROM tenant_ia_config WHERE id_tenant = $1", [c.tenantA.id_tenant])
  assert.equal(rows[0].ultima_validacao_ok, false)

  const d = await como(c.mentorA).get(`/reunioes/${segunda.id_reuniao}`)
  assert.equal(d.corpo.reuniao.processamento.status, "FALHOU")
  // O audio continua no disco: da para pedir de novo depois de corrigir a chave.
  const { rows: a } = await query("SELECT status FROM reuniao_audio WHERE id_audio = $1", [segunda.id_audio])
  assert.equal(a[0].status, "DISPONIVEL")
})

test("reprocessar depois da falha: entra na fila; um segundo pedido e recusado; cancelar so o que nao comecou", async () => {
  const caminho = `/reunioes/${segunda.id_reuniao}/processamentos`
  assert.equal((await como(c.adminA).post(caminho, { tipo: "RELATORIO" })).status, 400)
  const r = await como(c.adminA).post(caminho, { tipo: "TRANSCRICAO" })
  assert.equal(r.status, 201, JSON.stringify(r.corpo))
  assert.equal(r.corpo.processamento.status, "PENDENTE")
  assert.equal(r.corpo.processamento.solicitado_por, c.adminA.id)

  const outra = await como(c.adminA).post(caminho, { tipo: "TRANSCRICAO" })
  assert.equal(outra.status, 409)
  assert.equal(outra.corpo.codigo, "JA_NA_FILA")

  const id = r.corpo.processamento.id_processamento
  assert.equal((await como(c.mentorA).post(`/reunioes/processamentos/${id}/cancelar`)).status, 403)
  assert.equal((await como(c.adminB).post(`/reunioes/processamentos/${id}/cancelar`)).status, 404)
  assert.equal((await como(c.adminA).post(`/reunioes/processamentos/${id}/cancelar`)).status, 200)
  assert.equal((await como(c.adminA).post(`/reunioes/processamentos/${id}/cancelar`)).status, 409)

  // Pede de novo e, agora com o provedor bom, transcreve.
  assert.equal((await como(c.adminA).post(caminho, { tipo: "TRANSCRICAO" })).status, 201)
  assert.equal((await rodarLote()).concluidos, 1)
  const t = await como(c.mentorA).get(`/reunioes/${segunda.id_reuniao}/transcricao`)
  assert.deepEqual(t.corpo.trechos.map((x) => x.texto), ["frase de Reuniao com erros"])
  assert.equal(t.corpo.transcricao, "COMPLETA")
})

// ---------------------------------------------------------------------------
// ROBUSTEZ DA FILA
// ---------------------------------------------------------------------------

test("job de um worker que morreu no meio volta para a fila e e terminado", async () => {
  const r = await reuniaoGravadaEEncerrada("Worker que morreu")
  const [job] = await jobsDa(r.id_reuniao)
  await query(
    "UPDATE reuniao_processamento SET status = 'PROCESSANDO', tentativas = 1, travado_ate = NOW() - interval '1 minute' WHERE id_processamento = $1",
    [job.id_processamento]
  )
  const resultado = await rodarLote()
  assert.equal(resultado.recuperados, 1)
  assert.equal(resultado.concluidos, 1)
  assert.equal((await jobsDa(r.id_reuniao))[0].status, "CONCLUIDO")
})

test("um job por incubadora de cada vez, e nunca o mesmo job duas vezes", async () => {
  const processamento = require("../src/repositories/reuniaoProcessamentoRepository")
  const a = await criarReuniao(c.mentorA, [], "Fila A1")
  const b = await criarReuniao(c.mentorA, [], "Fila A2")
  for (const r of [a, b]) {
    await query("UPDATE reuniao SET status = 'ENCERRADA', encerrada_ts = NOW() WHERE id_reuniao = $1", [r.id_reuniao])
    assert.ok(await processamento.enfileirar({ idTenant: c.tenantA.id_tenant, idReuniao: r.id_reuniao, tipo: "TRANSCRICAO" }))
  }
  // O indice parcial: um segundo job ativo do mesmo tipo nao nasce.
  assert.equal(await processamento.enfileirar({ idTenant: c.tenantA.id_tenant, idReuniao: a.id_reuniao, tipo: "TRANSCRICAO" }), null)

  const [x, y] = await Promise.all([processamento.reservar({ tipos: ["TRANSCRICAO"] }), processamento.reservar({ tipos: ["TRANSCRICAO"] })])
  const reservados = [x, y].filter(Boolean)
  assert.equal(reservados.length, 1, "a mesma incubadora nao roda dois ao mesmo tempo")
  assert.equal(await processamento.reservar({ tipos: ["TRANSCRICAO"] }), null, "enquanto um roda, o outro espera")

  // Limpa para os proximos testes.
  await query("UPDATE reuniao_processamento SET status = 'CANCELADO', travado_ate = NULL WHERE id_reuniao = ANY($1::int[])", [[a.id_reuniao, b.id_reuniao]])
})

test("a sala que fecha sozinha (webhook) tambem cria o job", async () => {
  const r = await criarReuniao(c.mentorA, [c.colaboradorA], "Fecha sozinha")
  assert.equal((await como(c.mentorA).post(`/reunioes/${r.id_reuniao}/consentimento`, { aceito: true })).status, 200)
  const g = await como(c.mentorA).post(`/reunioes/${r.id_reuniao}/gravacoes`, { mime: "audio/webm" })
  assert.equal((await parte(c.mentorA, r.id_reuniao, g.corpo.id_audio, 0, pedaco0("so eu falei"))).status, 200)

  const { rows } = await query("SELECT sala FROM reuniao WHERE id_reuniao = $1", [r.id_reuniao])
  const crypto = require("node:crypto")
  const { AccessToken } = require("livekit-server-sdk")
  const corpo = JSON.stringify({ event: "room_finished", room: { name: rows[0].sala }, createdAt: String(Math.floor(Date.now() / 1000)) })
  const token = new AccessToken(CHAVE_LK, SEGREDO_LK)
  token.sha256 = crypto.createHash("sha256").update(corpo).digest("base64")
  const resposta = await fetch(`${api.url}/livekit/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/webhook+json", Authorization: await token.toJwt() },
    body: corpo,
  })
  assert.equal(resposta.status, 200)
  const jobs = await jobsDa(r.id_reuniao)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].status, "PENDENTE")
})

test("reuniao esquecida aberta (sem pedaco ha mais de 1 h) e encerrada pelo lote, e transcrita", async () => {
  const r = await criarReuniao(c.mentorA, [c.colaboradorA], "Esquecida aberta")
  assert.equal((await como(c.mentorA).post(`/reunioes/${r.id_reuniao}/consentimento`, { aceito: true })).status, 200)
  const g = await como(c.mentorA).post(`/reunioes/${r.id_reuniao}/gravacoes`, { mime: "audio/webm" })
  assert.equal((await parte(c.mentorA, r.id_reuniao, g.corpo.id_audio, 0, pedaco0("ninguem encerrou"))).status, 200)
  await query("UPDATE reuniao SET status = 'EM_ANDAMENTO' WHERE id_reuniao = $1", [r.id_reuniao])
  await query(
    "UPDATE reuniao_audio SET inicio_ts = NOW() - interval '3 hours', ultima_parte_ts = NOW() - interval '2 hours' WHERE id_audio = $1",
    [g.corpo.id_audio]
  )
  // A reuniao "Fecha sozinha" tambem esta na fila, pronta: o lote faz as duas.
  await query("UPDATE reuniao_processamento SET proxima_tentativa_ts = NOW() - interval '1 second' WHERE status = 'PENDENTE'")

  const resultado = await rodarLote()
  assert.equal(resultado.encerradas, 1)
  assert.equal(resultado.concluidos, 2)
  const { rows } = await query("SELECT status, transcricao FROM reuniao WHERE id_reuniao = $1", [r.id_reuniao])
  assert.deepEqual(rows[0], { status: "ENCERRADA", transcricao: "COMPLETA" })
})

// ---------------------------------------------------------------------------
// ECO E RETENCAO
// ---------------------------------------------------------------------------

test("o eco (a mesma frase no microfone de outra pessoa, ao mesmo tempo) sai da transcricao", async () => {
  const r = await criarReuniao(c.mentorA, [c.colaboradorA], "Sem fone")
  for (const quem of [c.mentorA, c.colaboradorA]) {
    assert.equal((await como(quem).post(`/reunioes/${r.id_reuniao}/consentimento`, { aceito: true })).status, 200)
  }
  const gm = await como(c.mentorA).post(`/reunioes/${r.id_reuniao}/gravacoes`, { mime: "audio/webm" })
  const gc = await como(c.colaboradorA).post(`/reunioes/${r.id_reuniao}/gravacoes`, { mime: "audio/webm" })
  const frase = "precisamos validar o produto com dez clientes"
  assert.equal((await parte(c.mentorA, r.id_reuniao, gm.corpo.id_audio, 0, pedaco0(frase))).status, 200)
  assert.equal((await parte(c.colaboradorA, r.id_reuniao, gc.corpo.id_audio, 0, pedaco0(frase))).status, 200)
  // As duas gravacoes comecaram no mesmo instante.
  await query("UPDATE reuniao_audio SET inicio_ts = NOW() - interval '1 minute' WHERE id_audio = ANY($1::bigint[])", [[gm.corpo.id_audio, gc.corpo.id_audio]])
  assert.equal((await como(c.mentorA).post(`/reunioes/${r.id_reuniao}/encerrar`)).status, 202)
  await liberarFila(r.id_reuniao)
  assert.equal((await rodarLote()).concluidos, 1)

  const { rows } = await query("SELECT texto FROM reuniao_trecho WHERE id_reuniao = $1", [r.id_reuniao])
  assert.deepEqual(rows.map((t) => t.texto), [frase], "ficou uma so")
})

test("a retencao da transcricao vence e a faxina apaga os trechos, com registro na auditoria", async () => {
  await query("UPDATE reuniao SET encerrada_ts = NOW() - interval '181 days' WHERE id_reuniao = $1", [reuniao.id_reuniao])
  const resultado = await rodarLote()
  assert.ok(resultado.transcricoesApagadas >= 1)
  const { rows } = await query("SELECT COUNT(*)::int AS n FROM reuniao_trecho WHERE id_reuniao = $1", [reuniao.id_reuniao])
  assert.equal(rows[0].n, 0)
  const a = await query("SELECT descricao FROM audit_log WHERE entidade = 'reuniao_transcricao' AND acao = 'EXCLUIR' AND entidade_id = $1", [
    String(reuniao.id_reuniao),
  ])
  assert.match(a.rows[0].descricao, /retenção da incubadora \(180 dias\)/)
})

test("retencao: so com a chave, dentro dos limites", async () => {
  const caminho = "/ia-config/retencao"
  assert.equal((await como(c.mentorA).put(caminho, { id_tenant: c.tenantA.id_tenant, audio_dias: 1, transcricao_dias: 30 })).status, 403)
  assert.equal((await como(c.adminA).put(caminho, { id_tenant: c.tenantA.id_tenant, audio_dias: 31, transcricao_dias: 30 })).status, 400)
  assert.equal((await como(c.adminA).put(caminho, { id_tenant: c.tenantA.id_tenant, audio_dias: 1, transcricao_dias: 0 })).status, 400)
  const r = await como(c.adminA).put(caminho, { id_tenant: c.tenantA.id_tenant, audio_dias: 2, transcricao_dias: 90 })
  assert.equal(r.status, 200)
  assert.deepEqual(r.corpo.retencao, { audio_dias: 2, transcricao_dias: 90 })
})

test("a rede de seguranca apaga a pasta de audio com mais de 30 dias, mesmo sem o banco saber dela", async () => {
  const pasta = path.join(pastaAudio, "999", "888", "777")
  fs.mkdirSync(pasta, { recursive: true })
  const arquivo = path.join(pasta, "0.parte")
  fs.writeFileSync(arquivo, "velho")
  const antigo = new Date(Date.now() - 31 * 86400000)
  fs.utimesSync(arquivo, antigo, antigo)
  fs.utimesSync(pasta, antigo, antigo)
  await require("../src/reunioes/lote").limpar()
  assert.equal(fs.existsSync(pasta), false)
})

// ---------------------------------------------------------------------------
// ISOLAMENTO NO BANCO
// ---------------------------------------------------------------------------

test("o banco recusa trecho que aponte para a gravacao de outra incubadora (FK composta)", async () => {
  const { rows } = await query("SELECT id_audio, id_reuniao, id_usuario FROM reuniao_audio LIMIT 1")
  await assert.rejects(
    query(
      `INSERT INTO reuniao_trecho (id_tenant, id_reuniao, id_audio, id_usuario, ordem, texto, inicio_ts, fim_ts)
       VALUES ($1, $2, $3, $4, 999, 'x', NOW(), NOW())`,
      [c.tenantB.id_tenant, rows[0].id_reuniao, rows[0].id_audio, rows[0].id_usuario]
    ),
    /foreign key/
  )
})
