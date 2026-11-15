/**
 * Reunioes por video (migracao 027, docs/reunioes.md — Etapa 3), pela API.
 *
 * O que este arquivo prende:
 *   - quem cria (a chave), quem e convidado (so gente ativa da incubadora) e
 *     quem enxerga (convidado sempre; a chave `visualizar` ve todas);
 *   - o evento da reuniao vai para a Agenda, o e-mail e a presenca SO DOS
 *     CONVIDADOS — e um evento comum continua indo para as startups;
 *   - o token: so convidado, so com a reuniao aberta, so a partir de 15 min
 *     antes, so para a sala da reuniao, e curto;
 *   - o webhook: sem assinatura valida, 401; com ela, entradas e saidas viram
 *     sessoes, o reenvio nao duplica e a ordem trocada nao estraga nada;
 *   - encerrar fecha a sala no LiveKit; a sala que fecha sozinha encerra a
 *     reuniao; cancelar e excluir tiram o evento da Agenda;
 *   - a incubadora B nao alcanca nada da A.
 *
 * O LiveKit e um servidor HTTP falso nesta mesma maquina: registra as
 * chamadas de criar e fechar sala, que e o que interessa conferir.
 *
 * Os testes dependem da ordem (o estado se acumula), como uma sessao de uso.
 */
const { test, before, after } = require("node:test")
const assert = require("node:assert/strict")
const http = require("node:http")
const crypto = require("node:crypto")

const { prepararBanco, encerrar } = require("../apoio-teste/banco")
const { subirApi, req } = require("../apoio-teste/api")

const CHAVE = "chave-de-teste"
const SEGREDO = "segredo-de-teste-com-mais-de-trinta-e-dois-caracteres"
const ROOT = { id: null, root: true }

let api
let c
let query
let livekitFalso
let chamadasLivekit = []
let colaboradorDois // membro da startupDois, nunca convidado

let mentoria // a reuniao principal (anfitriao: mentorA; convidado: colaboradorA)

// ---------------------------------------------------------------------------
// APOIO
// ---------------------------------------------------------------------------

const como = (quem) => ({
  get: (caminho) => req(api.url, caminho, { token: quem.token }),
  post: (caminho, corpo) => req(api.url, caminho, { metodo: "POST", token: quem.token, corpo: corpo || {} }),
  put: (caminho, corpo) => req(api.url, caminho, { metodo: "PUT", token: quem.token, corpo: corpo || {} }),
  del: (caminho) => req(api.url, caminho, { metodo: "DELETE", token: quem.token }),
})

/** O horario de parede (o que evento.inicio_ts guarda) daqui a N minutos. */
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

async function pessoa(idTenant, { nome, email, papel }) {
  const tenantService = require("../src/services/tenantService")
  const authService = require("../src/services/authService")
  const usuario = await tenantService.criarUsuario(
    idTenant,
    { nome, email, celular: "11900000000", senha: c.SENHA, papel },
    ROOT
  )
  const { token } = await authService.login({ email, senha: c.SENHA })
  return { ...usuario, id: usuario.id_usuario, token }
}

async function salaDe(idReuniao) {
  const { rows } = await query("SELECT sala FROM reuniao WHERE id_reuniao = $1", [idReuniao])
  return rows[0].sala
}

/** Manda um webhook assinado como o LiveKit assina. */
async function webhook(corpoObj, { segredo = SEGREDO, assinar = true, corpoAdulterado } = {}) {
  const corpo = JSON.stringify(corpoObj)
  const cabecalhos = { "Content-Type": "application/webhook+json" }
  if (assinar) {
    const { AccessToken } = require("livekit-server-sdk")
    const token = new AccessToken(CHAVE, segredo)
    token.sha256 = crypto.createHash("sha256").update(corpo).digest("base64")
    cabecalhos.Authorization = await token.toJwt()
  }
  const resposta = await fetch(`${api.url}/livekit/webhook`, {
    method: "POST",
    headers: cabecalhos,
    body: corpoAdulterado ?? corpo,
  })
  return { status: resposta.status, corpo: await resposta.json().catch(() => null) }
}

const segundos = (ms) => String(Math.floor(ms / 1000))

/** Espera o LiveKit falso receber uma chamada (o fechamento e em segundo plano). */
async function esperarChamada(metodo, sala) {
  for (let i = 0; i < 50; i++) {
    if (chamadasLivekit.some((ch) => ch.metodo === metodo && ch.corpo?.room === sala)) return true
    await new Promise((r) => setTimeout(r, 40))
  }
  return false
}

function decodificarJwt(token) {
  return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"))
}

// ---------------------------------------------------------------------------
// MONTAGEM
// ---------------------------------------------------------------------------

before(async () => {
  // O LiveKit falso: responde a API de salas (Twirp) e guarda o que recebeu.
  livekitFalso = http.createServer((pedido, resposta) => {
    let corpo = ""
    pedido.on("data", (parte) => (corpo += parte))
    pedido.on("end", () => {
      const metodo = pedido.url.split("/").pop()
      let json = null
      try {
        json = JSON.parse(corpo)
      } catch {
        // corpo vazio
      }
      chamadasLivekit.push({ metodo, corpo: json, autorizacao: pedido.headers.authorization })
      resposta.writeHead(200, { "Content-Type": "application/json" })
      resposta.end(metodo === "CreateRoom" ? JSON.stringify({ name: json?.name }) : "{}")
    })
  })
  await new Promise((ok) => livekitFalso.listen(0, "127.0.0.1", ok))

  process.env.LIVEKIT_URL = `ws://127.0.0.1:${livekitFalso.address().port}`
  process.env.LIVEKIT_API_KEY = CHAVE
  process.env.LIVEKIT_API_SECRET = SEGREDO

  await prepararBanco()
  c = await require("../apoio-teste/cenario").montarCenario()
  api = await subirApi()
  query = require("../src/config/db").query

  colaboradorDois = await pessoa(c.tenantA.id_tenant, {
    nome: "Colaborador Dois",
    email: "colab.dois.reuniao@teste.invalid",
    papel: "usuario",
  })
  const startupService = require("../src/services/startupService")
  await startupService.adicionarMembro(c.startupDois.id_startup, colaboradorDois.id, true, c.adminA)
})

after(async () => {
  await api?.fechar()
  await new Promise((ok) => livekitFalso?.close(ok))
  await encerrar()
})

// ---------------------------------------------------------------------------
// MODULO E CRIACAO
// ---------------------------------------------------------------------------

test("com o LiveKit configurado, o modulo aparece", async () => {
  const r = await como(c.colaboradorA).get("/reunioes/disponibilidade")
  assert.equal(r.status, 200)
  assert.equal(r.corpo.disponivel, true)
  assert.equal(r.corpo.minutos_antes, 15)
})

test("o mentor cria uma mentoria com um incubado; o evento nasce junto", async () => {
  const r = await como(c.mentorA).post("/reunioes", {
    id_tenant: c.tenantA.id_tenant,
    titulo: "Mentoria de pitch",
    categoria: "MENTORIA",
    inicio_ts: parede(120),
    fim_ts: parede(180),
    id_startup: c.startupUm.id_startup,
    participantes: [c.colaboradorA.id],
  })
  assert.equal(r.status, 201, JSON.stringify(r.corpo))
  mentoria = r.corpo.reuniao

  assert.equal(mentoria.status, "AGENDADA")
  assert.equal(mentoria.meu_papel, "ANFITRIAO")
  assert.equal(mentoria.sala, undefined, "o nome da sala nao sai da API")
  assert.deepEqual(
    mentoria.participantes.map((p) => [p.id_usuario, p.papel]),
    [
      [c.mentorA.id, "ANFITRIAO"],
      [c.colaboradorA.id, "PARTICIPANTE"],
    ]
  )
  assert.equal(mentoria.permissoes.entrar, false, "faltam duas horas: a sala ainda nao abriu")

  // O evento: na categoria escolhida, com o mentor como responsavel (e o que
  // conta a mentoria no historico dele) e a startup marcada.
  const { rows } = await query(
    "SELECT categoria, id_usuario_mentor, criado_por, ativo FROM evento WHERE id_evento = $1",
    [mentoria.id_evento]
  )
  assert.deepEqual(rows[0], { categoria: "MENTORIA", id_usuario_mentor: c.mentorA.id, criado_por: c.mentorA.id, ativo: true })

  const auditoria = await query(
    "SELECT acao FROM audit_log WHERE entidade = 'reuniao' AND entidade_id = $1",
    [String(mentoria.id_reuniao)]
  )
  assert.deepEqual(auditoria.rows.map((l) => l.acao), ["CRIAR"])
})

test("quem cria escolhe convidados da propria incubadora, com a startup de cada um", async () => {
  const r = await como(c.mentorA).get(`/reunioes/convidaveis?id_tenant=${c.tenantA.id_tenant}`)
  assert.equal(r.status, 200, JSON.stringify(r.corpo))
  const ids = r.corpo.pessoas.map((p) => p.id_usuario)
  assert.ok(ids.includes(c.colaboradorA.id) && ids.includes(colaboradorDois.id))
  assert.ok(!ids.includes(c.adminB.id))
  const incubado = r.corpo.pessoas.find((p) => p.id_usuario === c.colaboradorA.id)
  assert.deepEqual(incubado.startups.map((s) => s.id_startup), [c.startupUm.id_startup])

  // Quem so participa nao precisa da lista de todo mundo; a B nao ve a da A.
  assert.equal((await como(c.colaboradorA).get(`/reunioes/convidaveis?id_tenant=${c.tenantA.id_tenant}`)).status, 403)
  assert.equal((await como(c.adminB).get(`/reunioes/convidaveis?id_tenant=${c.tenantA.id_tenant}`)).status, 403)
})

test("sem a chave de criar, o incubado nao marca reuniao", async () => {
  const r = await como(c.colaboradorA).post("/reunioes", {
    id_tenant: c.tenantA.id_tenant,
    titulo: "Tentativa",
    inicio_ts: parede(60),
  })
  assert.equal(r.status, 403)
})

test("so gente ATIVA da incubadora pode ser convidada", async () => {
  for (const intruso of [c.adminB.id, c.forasteiro.id_usuario || c.forasteiro.id]) {
    const r = await como(c.mentorA).post("/reunioes", {
      id_tenant: c.tenantA.id_tenant,
      titulo: "Com intruso",
      inicio_ts: parede(60),
      participantes: [intruso],
    })
    assert.equal(r.status, 400, `convidado ${intruso} deveria ser recusado`)
  }
  const { rows } = await query("SELECT COUNT(*)::int AS n FROM reuniao")
  assert.equal(rows[0].n, 1, "nenhuma reuniao a mais foi gravada")
})

test("os dados sao conferidos: categoria, horario e startup", async () => {
  const base = { id_tenant: c.tenantA.id_tenant, titulo: "Teste", inicio_ts: parede(60) }
  const casos = [
    { ...base, categoria: "WORKSHOP" },
    { ...base, inicio_ts: "05/11/2026 14:00" },
    { ...base, inicio_ts: "2026-02-30T10:00" },
    { ...base, fim_ts: parede(30) },
    { ...base, id_startup: 999999 },
    { ...base, titulo: "  " },
  ]
  for (const corpo of casos) {
    const r = await como(c.mentorA).post("/reunioes", corpo)
    assert.equal(r.status, 400, JSON.stringify(corpo))
  }
})

// ---------------------------------------------------------------------------
// QUEM ENXERGA
// ---------------------------------------------------------------------------

test("o convidado ve a reuniao; o colega nao convidado, nao", async () => {
  const doConvidado = await como(c.colaboradorA).get(`/reunioes?id_tenant=${c.tenantA.id_tenant}`)
  assert.equal(doConvidado.status, 200)
  assert.equal(doConvidado.corpo.escopo, "MINHAS")
  assert.deepEqual(doConvidado.corpo.reunioes.map((r) => r.id_reuniao), [mentoria.id_reuniao])
  assert.equal(doConvidado.corpo.reunioes[0].meu_papel, "PARTICIPANTE")

  const doColega = await como(colaboradorDois).get(`/reunioes?id_tenant=${c.tenantA.id_tenant}`)
  assert.equal(doColega.status, 200)
  assert.deepEqual(doColega.corpo.reunioes, [])

  // 404, e nao 403: o id e sequencial.
  const detalhe = await como(colaboradorDois).get(`/reunioes/${mentoria.id_reuniao}`)
  assert.equal(detalhe.status, 404)
})

test("a chave `visualizar` (o admin) ve todas; a incubadora B, nenhuma", async () => {
  const doAdmin = await como(c.adminA).get(`/reunioes?id_tenant=${c.tenantA.id_tenant}`)
  assert.equal(doAdmin.corpo.escopo, "TODAS")
  assert.equal(doAdmin.corpo.reunioes.length, 1)
  assert.equal(doAdmin.corpo.reunioes[0].meu_papel, null)

  const daB = await como(c.adminB).get(`/reunioes?id_tenant=${c.tenantA.id_tenant}`)
  assert.equal(daB.status, 403)

  const detalheB = await como(c.adminB).get(`/reunioes/${mentoria.id_reuniao}`)
  assert.equal(detalheB.status, 404)
})

test("so o anfitriao e a coordenacao veem quem entrou e saiu", async () => {
  const doConvidado = await como(c.colaboradorA).get(`/reunioes/${mentoria.id_reuniao}`)
  assert.equal(doConvidado.status, 200)
  assert.equal(doConvidado.corpo.reuniao.sessoes, null)
  assert.equal(doConvidado.corpo.reuniao.permissoes.editar, false)

  const doAnfitriao = await como(c.mentorA).get(`/reunioes/${mentoria.id_reuniao}`)
  assert.deepEqual(doAnfitriao.corpo.reuniao.sessoes, [])
  assert.equal(doAnfitriao.corpo.reuniao.permissoes.editar, true)
})

// ---------------------------------------------------------------------------
// A AGENDA
// ---------------------------------------------------------------------------

test("na Agenda, o evento da reuniao so aparece para os convidados (e para o admin)", async () => {
  const idsNaAgenda = async (quem) => {
    const r = await como(quem).get(`/eventos?id_tenant=${c.tenantA.id_tenant}`)
    assert.equal(r.status, 200, JSON.stringify(r.corpo))
    return r.corpo.eventos.map((e) => e.id_evento)
  }
  assert.ok((await idsNaAgenda(c.colaboradorA)).includes(mentoria.id_evento))
  assert.ok((await idsNaAgenda(c.adminA)).includes(mentoria.id_evento))
  assert.ok(!(await idsNaAgenda(colaboradorDois)).includes(mentoria.id_evento))

  const r = await como(colaboradorDois).get(`/eventos/${mentoria.id_evento}`)
  assert.equal(r.status, 404, "abrir o evento pelo id tambem nao vale")

  const doConvidado = await como(c.colaboradorA).get(`/eventos/${mentoria.id_evento}`)
  assert.equal(doConvidado.corpo.evento.id_reuniao, mentoria.id_reuniao)
})

test("no Google Agenda, o evento da reuniao vai so para os convidados — nem o admin recebe", async () => {
  const eventoRepository = require("../src/repositories/eventoRepository")
  const recebe = async (quem) =>
    (await eventoRepository.listarVisiveisParaUsuario(quem.id)).some((e) => e.id_evento === mentoria.id_evento)
  assert.equal(await recebe(c.colaboradorA), true)
  assert.equal(await recebe(c.mentorA), true)
  assert.equal(await recebe(colaboradorDois), false)
  assert.equal(await recebe(c.adminA), false, "a coordenacao ve na tela, mas a mentoria nao e compromisso dela")
})

test("a lista de presenca do evento da reuniao sao os convidados — e a de um evento geral continua sendo as startups", async () => {
  const daReuniao = await como(c.adminA).get(`/eventos/${mentoria.id_evento}/presenca`)
  assert.equal(daReuniao.status, 200, JSON.stringify(daReuniao.corpo))
  assert.deepEqual(
    daReuniao.corpo.publico.map((p) => p.id_usuario).sort(),
    [c.mentorA.id, c.colaboradorA.id].sort()
  )
  const doIncubado = daReuniao.corpo.publico.find((p) => p.id_usuario === c.colaboradorA.id)
  assert.deepEqual(doIncubado.startups.map((s) => s.id_startup), [c.startupUm.id_startup])
  const doMentor = daReuniao.corpo.publico.find((p) => p.id_usuario === c.mentorA.id)
  assert.deepEqual(doMentor.startups, [])

  // Controle: um evento GERAL comum convoca os membros das duas startups.
  const geral = await como(c.adminA).post("/eventos", {
    id_tenant: c.tenantA.id_tenant,
    titulo: "Workshop geral",
    inicio_ts: `${parede(60).slice(0, 10)}T10:00:00`,
  })
  assert.equal(geral.status, 201, JSON.stringify(geral.corpo))
  const doGeral = await como(c.adminA).get(`/eventos/${geral.corpo.evento.id_evento}/presenca`)
  assert.deepEqual(
    doGeral.corpo.publico.map((p) => p.id_usuario).sort(),
    [c.colaboradorA.id, colaboradorDois.id].sort()
  )

  // As outras leituras do mesmo publico continuam de pe.
  assert.equal((await como(c.adminA).get(`/eventos/presenca/resumo?id_tenant=${c.tenantA.id_tenant}`)).status, 200)
  assert.equal((await como(c.adminA).get(`/relatorios/engajamento?id_tenant=${c.tenantA.id_tenant}&dias=30`)).status, 200)
})

test("o evento de uma reuniao nao se edita nem se exclui pela Agenda", async () => {
  const editar = await como(c.adminA).put(`/eventos/${mentoria.id_evento}`, {
    titulo: "Mudado pela agenda",
    inicio_ts: parede(60),
  })
  assert.equal(editar.status, 409)
  assert.equal(editar.corpo.codigo, "EVENTO_DE_REUNIAO")

  const excluir = await como(c.adminA).del(`/eventos/${mentoria.id_evento}`)
  assert.equal(excluir.status, 409)
})

// ---------------------------------------------------------------------------
// TOKEN
// ---------------------------------------------------------------------------

test("o token so sai para convidado, e so a partir de 15 minutos antes", async () => {
  const doColega = await como(colaboradorDois).post(`/reunioes/${mentoria.id_reuniao}/token`)
  assert.equal(doColega.status, 404)

  const doAdmin = await como(c.adminA).post(`/reunioes/${mentoria.id_reuniao}/token`)
  assert.equal(doAdmin.status, 403, "ver a reuniao na lista nao e estar nela")
  assert.equal(doAdmin.corpo.codigo, "NAO_CONVIDADO")

  const cedoDemais = await como(c.colaboradorA).post(`/reunioes/${mentoria.id_reuniao}/token`)
  assert.equal(cedoDemais.status, 409)
  assert.equal(cedoDemais.corpo.codigo, "SALA_AINDA_FECHADA")

  const daB = await como(c.adminB).post(`/reunioes/${mentoria.id_reuniao}/token`)
  assert.equal(daB.status, 404)
})

test("o convidado que nao e anfitriao nao edita; o anfitriao remarca para daqui a 10 minutos", async () => {
  const corpo = {
    titulo: "Mentoria de pitch",
    categoria: "MENTORIA",
    inicio_ts: parede(10),
    fim_ts: parede(70),
    id_startup: c.startupUm.id_startup,
    participantes: [c.colaboradorA.id],
  }
  assert.equal((await como(c.colaboradorA).put(`/reunioes/${mentoria.id_reuniao}`, corpo)).status, 403)

  const r = await como(c.mentorA).put(`/reunioes/${mentoria.id_reuniao}`, corpo)
  assert.equal(r.status, 200, JSON.stringify(r.corpo))
  assert.equal(r.corpo.reuniao.inicio_ts.slice(0, 16), parede(10))
  assert.equal(r.corpo.reuniao.permissoes.entrar, true)
})

test("o token vale so para a sala da reuniao, com a identidade da pessoa, por 10 minutos", async () => {
  const r = await como(c.colaboradorA).post(`/reunioes/${mentoria.id_reuniao}/token`)
  assert.equal(r.status, 200, JSON.stringify(r.corpo))
  assert.equal(r.corpo.url, process.env.LIVEKIT_URL)
  assert.equal(r.corpo.identidade, `u-${c.colaboradorA.id}`)

  const sala = await salaDe(mentoria.id_reuniao)
  assert.match(sala, /^q-[0-9a-f-]{36}$/)

  const claims = decodificarJwt(r.corpo.token)
  assert.equal(claims.sub, `u-${c.colaboradorA.id}`)
  assert.equal(claims.iss, CHAVE)
  assert.equal(claims.video.room, sala)
  assert.equal(claims.video.roomJoin, true)
  assert.equal(claims.video.roomAdmin, undefined)
  assert.equal(claims.name, "Colaborador A")
  assert.equal(JSON.parse(claims.metadata).papel, "PARTICIPANTE")
  assert.ok(claims.exp - claims.nbf <= 600, "o token e curto")

  // A sala foi criada com o prazo de espera da reuniao, nao o padrao de 20 s.
  const criacao = chamadasLivekit.find((ch) => ch.metodo === "CreateRoom" && ch.corpo?.name === sala)
  assert.ok(criacao, "a sala foi preparada no LiveKit")
  assert.equal(criacao.corpo.departureTimeout, 600)
})

test("trocar a lista de convidados tira e da acesso na hora", async () => {
  const sem = await como(c.mentorA).put(`/reunioes/${mentoria.id_reuniao}/participantes`, {
    participantes: [colaboradorDois.id],
  })
  assert.equal(sem.status, 200, JSON.stringify(sem.corpo))
  assert.equal((await como(c.colaboradorA).get(`/reunioes/${mentoria.id_reuniao}`)).status, 404)
  assert.equal((await como(colaboradorDois).get(`/reunioes/${mentoria.id_reuniao}`)).status, 200)

  const devolta = await como(c.mentorA).put(`/reunioes/${mentoria.id_reuniao}/participantes`, {
    participantes: [c.colaboradorA.id],
  })
  assert.equal(devolta.status, 200)
  assert.equal((await como(colaboradorDois).get(`/reunioes/${mentoria.id_reuniao}`)).status, 404)
  assert.deepEqual(
    devolta.corpo.reuniao.participantes.map((p) => p.id_usuario),
    [c.mentorA.id, c.colaboradorA.id],
    "o anfitriao nunca sai da lista"
  )
})

// ---------------------------------------------------------------------------
// WEBHOOK
// ---------------------------------------------------------------------------

test("webhook sem assinatura, com assinatura errada ou com o corpo trocado: 401", async () => {
  const sala = await salaDe(mentoria.id_reuniao)
  const evento = { event: "room_started", id: "EV_1", createdAt: segundos(Date.now()), room: { sid: "RM_1", name: sala } }

  assert.equal((await webhook(evento, { assinar: false })).status, 401)
  assert.equal((await webhook(evento, { segredo: "outro-segredo-qualquer-com-tamanho-suficiente" })).status, 401)
  const trocado = JSON.stringify({ ...evento, event: "room_finished" })
  assert.equal((await webhook(evento, { corpoAdulterado: trocado })).status, 401)

  const { rows } = await query("SELECT status FROM reuniao WHERE id_reuniao = $1", [mentoria.id_reuniao])
  assert.equal(rows[0].status, "AGENDADA", "nada foi aplicado")
})

test("room_started abre a reuniao; entradas e saidas viram sessoes, sem duplicar no reenvio", async () => {
  const sala = await salaDe(mentoria.id_reuniao)
  const agora = Date.now()

  const iniciou = await webhook({ event: "room_started", id: "EV_2", createdAt: segundos(agora), room: { sid: "RM_1", name: sala } })
  assert.equal(iniciou.status, 200, JSON.stringify(iniciou.corpo))

  const entrada = {
    event: "participant_joined",
    id: "EV_3",
    createdAt: segundos(agora),
    room: { sid: "RM_1", name: sala },
    participant: { sid: "PA_incubado", identity: `u-${c.colaboradorA.id}`, name: "Colaborador A", joinedAt: segundos(agora) },
  }
  assert.equal((await webhook(entrada)).status, 200)
  assert.equal((await webhook(entrada)).status, 200, "o reenvio e aceito...")

  const detalhe = await como(c.mentorA).get(`/reunioes/${mentoria.id_reuniao}`)
  assert.equal(detalhe.corpo.reuniao.status, "EM_ANDAMENTO")
  assert.ok(detalhe.corpo.reuniao.iniciada_ts)
  assert.equal(detalhe.corpo.reuniao.sessoes.length, 1, "...e nao duplica a sessao")
  assert.equal(detalhe.corpo.reuniao.sessoes[0].id_usuario, c.colaboradorA.id)
  assert.equal(detalhe.corpo.reuniao.sessoes[0].saiu_ts, null)
  assert.equal(detalhe.corpo.reuniao.na_sala, 1)
  assert.equal(detalhe.corpo.reuniao.participantes.find((p) => p.id_usuario === c.colaboradorA.id).na_sala, true)

  const saida = { ...entrada, event: "participant_left", id: "EV_4", createdAt: segundos(agora + 60000) }
  assert.equal((await webhook(saida)).status, 200)
  const depois = await como(c.mentorA).get(`/reunioes/${mentoria.id_reuniao}`)
  assert.equal(depois.corpo.reuniao.sessoes[0].duracao_s, 60)
})

test("saida que chega antes da entrada cria a sessao ja fechada; identidade estranha fica sem dono", async () => {
  const sala = await salaDe(mentoria.id_reuniao)
  const agora = Date.now()
  const participante = { sid: "PA_mentor", identity: `u-${c.mentorA.id}`, name: "Mentor A", joinedAt: segundos(agora) }

  await webhook({ event: "participant_left", id: "EV_5", createdAt: segundos(agora + 30000), room: { name: sala }, participant: participante })
  await webhook({ event: "participant_joined", id: "EV_6", createdAt: segundos(agora), room: { name: sala }, participant: participante })

  const { rows } = await query(
    "SELECT id_usuario, saiu_ts IS NOT NULL AS fechada FROM reuniao_sessao WHERE sid_participante = 'PA_mentor'"
  )
  assert.deepEqual(rows, [{ id_usuario: c.mentorA.id, fechada: true }], "o joined atrasado nao reabriu")

  // Alguem com uma identidade que nao e convidado desta reuniao.
  await webhook({
    event: "participant_joined",
    id: "EV_7",
    createdAt: segundos(agora),
    room: { name: sala },
    participant: { sid: "PA_estranho", identity: `u-${colaboradorDois.id}`, joinedAt: segundos(agora) },
  })
  const estranho = await query("SELECT id_usuario FROM reuniao_sessao WHERE sid_participante = 'PA_estranho'")
  assert.equal(estranho.rows[0].id_usuario, null)
})

test("webhook de sala que nao e de reuniao nenhuma e ignorado com 200", async () => {
  const r = await webhook({ event: "room_started", id: "EV_8", createdAt: segundos(Date.now()), room: { name: "outra-sala" } })
  assert.equal(r.status, 200)
  assert.equal(r.corpo.ignorado, true)
})

// ---------------------------------------------------------------------------
// ENCERRAR
// ---------------------------------------------------------------------------

test("so o anfitriao (ou a chave) encerra; encerrar fecha a sala no LiveKit", async () => {
  const sala = await salaDe(mentoria.id_reuniao)

  assert.equal((await como(c.colaboradorA).post(`/reunioes/${mentoria.id_reuniao}/encerrar`)).status, 403)
  assert.equal((await como(c.adminB).post(`/reunioes/${mentoria.id_reuniao}/encerrar`)).status, 404)

  const r = await como(c.mentorA).post(`/reunioes/${mentoria.id_reuniao}/encerrar`)
  assert.equal(r.status, 202)
  assert.ok(await esperarChamada("DeleteRoom", sala), "a sala foi fechada no LiveKit")

  const { rows } = await query(
    "SELECT status, encerrada_por, encerrada_ts IS NOT NULL AS tem_data FROM reuniao WHERE id_reuniao = $1",
    [mentoria.id_reuniao]
  )
  assert.deepEqual(rows[0], { status: "ENCERRADA", encerrada_por: c.mentorA.id, tem_data: true })

  // Encerrar de novo nao e erro, e nao troca quem encerrou.
  assert.equal((await como(c.adminA).post(`/reunioes/${mentoria.id_reuniao}/encerrar`)).status, 202)
  const denovo = await query("SELECT encerrada_por FROM reuniao WHERE id_reuniao = $1", [mentoria.id_reuniao])
  assert.equal(denovo.rows[0].encerrada_por, c.mentorA.id)
})

test("depois de encerrada: sem token, sem edicao, e a sala que reabrir e fechada de novo", async () => {
  const token = await como(c.colaboradorA).post(`/reunioes/${mentoria.id_reuniao}/token`)
  assert.equal(token.status, 409)
  assert.equal(token.corpo.codigo, "REUNIAO_FECHADA")

  const editar = await como(c.mentorA).put(`/reunioes/${mentoria.id_reuniao}`, { titulo: "x", inicio_ts: parede(5) })
  assert.equal(editar.status, 409)

  // Alguem entra com um token emitido antes do encerramento (valem 10 min).
  const sala = await salaDe(mentoria.id_reuniao)
  chamadasLivekit = []
  await webhook({ event: "room_started", id: "EV_9", createdAt: segundos(Date.now()), room: { name: sala } })
  assert.ok(await esperarChamada("DeleteRoom", sala))
  const { rows } = await query("SELECT status FROM reuniao WHERE id_reuniao = $1", [mentoria.id_reuniao])
  assert.equal(rows[0].status, "ENCERRADA", "a reuniao nao ressuscitou")

  // room_finished fecha a sessao que ficou aberta (o estranho de antes).
  await webhook({ event: "room_finished", id: "EV_10", createdAt: segundos(Date.now()), room: { name: sala } })
  const abertas = await query(
    "SELECT COUNT(*)::int AS n FROM reuniao_sessao WHERE id_reuniao = $1 AND saiu_ts IS NULL",
    [mentoria.id_reuniao]
  )
  assert.equal(abertas.rows[0].n, 0)
})

test("a sala que fecha sozinha (todos sairam) encerra a reuniao, sem autor", async () => {
  const r = await como(c.mentorA).post("/reunioes", {
    id_tenant: c.tenantA.id_tenant,
    titulo: "Conversa rapida",
    inicio_ts: parede(0),
    participantes: [c.colaboradorA.id],
  })
  assert.equal(r.status, 201)
  const id = r.corpo.reuniao.id_reuniao
  const sala = await salaDe(id)

  await webhook({ event: "room_started", id: "EV_11", createdAt: segundos(Date.now()), room: { name: sala } })
  await webhook({ event: "room_finished", id: "EV_12", createdAt: segundos(Date.now()), room: { name: sala } })

  const { rows } = await query("SELECT status, encerrada_por FROM reuniao WHERE id_reuniao = $1", [id])
  assert.deepEqual(rows[0], { status: "ENCERRADA", encerrada_por: null })
  const auditoria = await query(
    "SELECT id_usuario FROM audit_log WHERE entidade = 'reuniao' AND entidade_id = $1 AND acao = 'ENCERRAR'",
    [String(id)]
  )
  assert.deepEqual(auditoria.rows, [{ id_usuario: null }])
})

// ---------------------------------------------------------------------------
// CANCELAR E EXCLUIR
// ---------------------------------------------------------------------------

test("cancelar tira o evento da Agenda e deixa a reuniao no historico", async () => {
  const r = await como(c.mentorA).post("/reunioes", {
    id_tenant: c.tenantA.id_tenant,
    titulo: "Vai ser cancelada",
    inicio_ts: parede(300),
    participantes: [c.colaboradorA.id],
  })
  const { id_reuniao, id_evento } = r.corpo.reuniao

  assert.equal((await como(c.colaboradorA).post(`/reunioes/${id_reuniao}/cancelar`)).status, 403)
  assert.equal((await como(c.adminB).post(`/reunioes/${id_reuniao}/cancelar`)).status, 404)

  const cancelada = await como(c.mentorA).post(`/reunioes/${id_reuniao}/cancelar`)
  assert.equal(cancelada.status, 200, JSON.stringify(cancelada.corpo))
  assert.equal(cancelada.corpo.reuniao.status, "CANCELADA")

  const agenda = await como(c.colaboradorA).get(`/eventos?id_tenant=${c.tenantA.id_tenant}`)
  assert.ok(!agenda.corpo.eventos.some((e) => e.id_evento === id_evento))

  assert.equal((await como(c.mentorA).del(`/reunioes/${id_reuniao}`)).status, 409, "cancelada nao se exclui")
  assert.equal((await como(c.colaboradorA).post(`/reunioes/${id_reuniao}/token`)).status, 409)
})

test("excluir apaga a reuniao que nao comecou; o anfitriao pode, o convidado nao, a B nem ve", async () => {
  const r = await como(c.mentorA).post("/reunioes", {
    id_tenant: c.tenantA.id_tenant,
    titulo: "Vai ser excluida",
    inicio_ts: parede(300),
    participantes: [c.colaboradorA.id],
  })
  const { id_reuniao, id_evento } = r.corpo.reuniao

  assert.equal((await como(c.colaboradorA).del(`/reunioes/${id_reuniao}`)).status, 403)
  assert.equal((await como(c.adminB).del(`/reunioes/${id_reuniao}`)).status, 404)

  const excluida = await como(c.mentorA).del(`/reunioes/${id_reuniao}`)
  assert.equal(excluida.status, 200)
  assert.equal((await como(c.mentorA).get(`/reunioes/${id_reuniao}`)).status, 404)

  const { rows } = await query("SELECT ativo FROM evento WHERE id_evento = $1", [id_evento])
  assert.equal(rows[0].ativo, false, "o evento saiu da agenda")
  const convites = await query("SELECT COUNT(*)::int AS n FROM reuniao_participante WHERE id_reuniao = $1", [id_reuniao])
  assert.equal(convites.rows[0].n, 0)
})

test("a incubadora B nao edita nem remarca nada da A", async () => {
  const r = await como(c.adminB).put(`/reunioes/${mentoria.id_reuniao}`, {
    titulo: "Invadida",
    inicio_ts: parede(5),
  })
  assert.equal(r.status, 404)
  const p = await como(c.adminB).put(`/reunioes/${mentoria.id_reuniao}/participantes`, { participantes: [c.adminB.id] })
  assert.equal(p.status, 404)
})

test("o banco recusa ligar a reuniao ao evento de outra incubadora", async () => {
  const { rows } = await query(
    `INSERT INTO evento (id_tenant, titulo, categoria, inicio_ts, criado_por)
     VALUES ($1, 'Evento da B', 'EVENTO', NOW(), $2) RETURNING id_evento`,
    [c.tenantB.id_tenant, c.adminB.id]
  )
  await assert.rejects(
    query(
      `INSERT INTO reuniao (id_tenant, id_evento, id_anfitriao) VALUES ($1, $2, $3)`,
      [c.tenantA.id_tenant, rows[0].id_evento, c.mentorA.id]
    ),
    /fk_reuniao_evento/
  )
})

test("sem as variaveis do LiveKit o modulo some e nao cria nada", async () => {
  const url = process.env.LIVEKIT_URL
  delete process.env.LIVEKIT_URL
  try {
    const disp = await como(c.mentorA).get("/reunioes/disponibilidade")
    assert.equal(disp.corpo.disponivel, false)
    const r = await como(c.mentorA).post("/reunioes", {
      id_tenant: c.tenantA.id_tenant,
      titulo: "Sem LiveKit",
      inicio_ts: parede(60),
    })
    assert.equal(r.status, 503)
    assert.equal(r.corpo.codigo, "REUNIOES_INDISPONIVEIS")
    const w = await webhook({ event: "room_started", room: { name: "x" } })
    assert.equal(w.status, 404)
  } finally {
    process.env.LIVEKIT_URL = url
  }
})
