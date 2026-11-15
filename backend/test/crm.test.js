/**
 * Mini CRM ponta a ponta (migracao 026), pela API.
 *
 * O que este arquivo prende:
 *   - o CRM so abre para MEMBRO ativo da startup com o beneficio ATIVO — nem o
 *     admin nem o mentor entram, e a startup vizinha nao enxerga nada;
 *   - toda escrita relevante deixa um evento no historico, com o antes e o
 *     depois, o autor da sessao e a data do servidor;
 *   - o historico nao se edita nem se apaga, nem pela API nem no banco;
 *   - revogar o beneficio fecha o acesso e NAO apaga nada; conceder de novo
 *     devolve tudo como estava.
 *
 * Os testes dependem da ordem (o estado se acumula), como uma sessao de uso.
 */
const { test, describe, before, after } = require("node:test")
const assert = require("node:assert/strict")

const { prepararBanco, encerrar } = require("../apoio-teste/banco")
const { subirApi, req } = require("../apoio-teste/api")

let api
let c
let colaboradorDois // membro da startupDois
let colegaUm // segundo membro da startupUm
let query

const ROOT = { id: null, root: true }
const CPF = "52998224725"
const CNPJ = "11222333000181"

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

const um = () => c.startupUm.id_startup
const dois = () => c.startupDois.id_startup
const crm = (idStartup, caminho = "") => `/crm/${idStartup}${caminho}`

/** Atalho: chamada autenticada como alguem. */
const como = (quem) => ({
  get: (caminho) => req(api.url, caminho, { token: quem.token }),
  post: (caminho, corpo) => req(api.url, caminho, { metodo: "POST", token: quem.token, corpo: corpo || {} }),
  put: (caminho, corpo) => req(api.url, caminho, { metodo: "PUT", token: quem.token, corpo: corpo || {} }),
  patch: (caminho, corpo) => req(api.url, caminho, { metodo: "PATCH", token: quem.token, corpo: corpo || {} }),
  del: (caminho) => req(api.url, caminho, { metodo: "DELETE", token: quem.token }),
})

/** Os eventos de uma oportunidade, do mais recente para o mais antigo. */
async function eventosDa(idOportunidade, limite = 100) {
  const r = await como(c.colaboradorA).get(crm(um(), `/oportunidades/${idOportunidade}/historico?limite=${limite}`))
  assert.equal(r.status, 200, JSON.stringify(r.corpo))
  return r.corpo.eventos
}

before(async () => {
  await prepararBanco()
  c = await require("../apoio-teste/cenario").montarCenario()
  api = await subirApi()
  query = require("../src/config/db").query

  const startupService = require("../src/services/startupService")
  colaboradorDois = await pessoa(c.tenantA.id_tenant, {
    nome: "Colaborador Dois",
    email: "colab.dois@teste.invalid",
    papel: "usuario",
  })
  colegaUm = await pessoa(c.tenantA.id_tenant, {
    nome: "Colega Um",
    email: "colega.um@teste.invalid",
    papel: "usuario",
  })
  await startupService.adicionarMembro(dois(), colaboradorDois.id, true, c.adminA)
  await startupService.adicionarMembro(um(), colegaUm.id, false, c.adminA)
})

after(async () => {
  await api.fechar()
  await encerrar()
})

// ===========================================================================
describe("beneficio: quem concede e o que ele libera", () => {
  test("sem o beneficio, o membro recebe 403 BENEFICIO_INATIVO", async () => {
    const r = await como(c.colaboradorA).get(crm(um(), "/contexto"))
    assert.equal(r.status, 403)
    assert.equal(r.corpo.codigo, "BENEFICIO_INATIVO")
  })

  test("o incubado nao concede beneficio a propria startup", async () => {
    const r = await como(c.colaboradorA).put(`/startups/${um()}/beneficios/CRM`, { ativo: true })
    assert.equal(r.status, 403)
  })

  test("o admin de outra incubadora nao concede", async () => {
    const r = await como(c.adminB).put(`/startups/${um()}/beneficios/CRM`, { ativo: true })
    assert.equal(r.status, 403)
  })

  test("o mentor sem a chave nem le os beneficios", async () => {
    const r = await como(c.mentorA).get(`/startups/${um()}/beneficios`)
    assert.equal(r.status, 403)
  })

  test("beneficio que nao existe responde 404", async () => {
    const r = await como(c.adminA).put(`/startups/${um()}/beneficios/NADA`, { ativo: true })
    assert.equal(r.status, 404)
  })

  test("o admin concede o CRM as duas startups e o funil nasce com as etapas padrao", async () => {
    for (const id of [um(), dois()]) {
      const r = await como(c.adminA).put(`/startups/${id}/beneficios/CRM`, { ativo: true })
      assert.equal(r.status, 200, JSON.stringify(r.corpo))
      assert.equal(r.corpo.beneficio.ativo, true)
      assert.equal(r.corpo.beneficio.concedido_por_nome, "Admin A")
    }
    const ctx = await como(c.colaboradorA).get(crm(um(), "/contexto"))
    assert.equal(ctx.status, 200)
    assert.deepEqual(
      ctx.corpo.etapas.map((e) => e.nome),
      ["Sem contato", "Contato feito", "Identificação do interesse", "Apresentação", "Proposta enviada", "Negociação"]
    )
    assert.ok(ctx.corpo.membros.some((m) => m.id_usuario === c.colaboradorA.id))
  })

  test("conceder de novo nao duplica nada nem gera outra auditoria", async () => {
    const r = await como(c.adminA).put(`/startups/${um()}/beneficios/CRM`, { ativo: true })
    assert.equal(r.status, 200)
    const { rows } = await query(
      `SELECT COUNT(*)::int AS n FROM audit_log WHERE entidade = 'startup_beneficio' AND entidade_id = $1`,
      [`${um()}:CRM`]
    )
    assert.equal(rows[0].n, 1)
    const etapas = await query(`SELECT COUNT(*)::int AS n FROM crm_etapa WHERE id_startup = $1`, [um()])
    assert.equal(etapas.rows[0].n, 6)
  })

  test("a startup aparece em /beneficios/meus de quem e membro, e so dele", async () => {
    const meus = await como(c.colaboradorA).get(`/beneficios/meus?id_tenant=${c.tenantA.id_tenant}`)
    assert.equal(meus.status, 200)
    assert.deepEqual(
      meus.corpo.beneficios.map((b) => [b.beneficio, b.id_startup]),
      [["CRM", um()]]
    )
    const doAdmin = await como(c.adminA).get(`/beneficios/meus?id_tenant=${c.tenantA.id_tenant}`)
    assert.deepEqual(doAdmin.corpo.beneficios, [])
  })

  test("a lista de startups mostra quem tem o beneficio", async () => {
    const r = await como(c.adminA).get(`/startups?id_tenant=${c.tenantA.id_tenant}`)
    const linha = r.corpo.startups.find((s) => s.id_startup === um())
    assert.deepEqual(linha.beneficios, ["CRM"])
  })
})

// ===========================================================================
describe("acesso: so o membro da startup entra", () => {
  test("sem token, 401", async () => {
    const r = await req(api.url, crm(um(), "/contexto"))
    assert.equal(r.status, 401)
  })

  test("admin e mentor da incubadora nao entram no CRM da startup", async () => {
    for (const quem of [c.adminA, c.mentorA, c.adminB, c.forasteiro]) {
      const r = await como(quem).get(crm(um(), "/clientes"))
      assert.equal(r.status, 403, `${quem.email} entrou no CRM`)
      assert.equal(r.corpo.codigo, "SEM_VINCULO")
    }
  })

  test("o membro de uma startup nao entra no CRM da outra", async () => {
    const r = await como(c.colaboradorA).get(crm(dois(), "/clientes"))
    assert.equal(r.status, 403)
    const w = await como(c.colaboradorA).post(crm(dois(), "/clientes"), { nome: "Intruso" })
    assert.equal(w.status, 403)
  })

  test("startup que nao existe, ou id que nao e numero, responde 404", async () => {
    assert.equal((await como(c.colaboradorA).get(crm(999999, "/clientes"))).status, 404)
    assert.equal((await como(c.colaboradorA).get(crm("abc", "/clientes"))).status, 404)
  })
})

// ===========================================================================
const estado = {}

describe("clientes", () => {
  test("CPF invalido e recusado", async () => {
    const r = await como(c.colaboradorA).post(crm(um(), "/clientes"), { nome: "Ana", documento: "12345678900" })
    assert.equal(r.status, 400)
    assert.match(r.corpo.erro, /CPF/)
  })

  test("cria o cliente e o historico registra o cadastro", async () => {
    const r = await como(c.colaboradorA).post(crm(um(), "/clientes"), {
      nome: "Ana Souza",
      tipo_pessoa: "PF",
      documento: "529.982.247-25",
      email: "ANA@exemplo.com",
      telefone: "(11) 98888-7777",
      empresa: "Acme",
      cargo: "Compras",
      origem: "Indicação",
    })
    assert.equal(r.status, 201, JSON.stringify(r.corpo))
    assert.equal(r.corpo.cliente.documento, CPF)
    assert.equal(r.corpo.cliente.email, "ana@exemplo.com")
    assert.equal(r.corpo.cliente.telefone, "11988887777")
    assert.equal(r.corpo.cliente.status, "LEAD")
    estado.ana = r.corpo.cliente.id_cliente

    const hist = await como(c.colaboradorA).get(crm(um(), `/clientes/${estado.ana}/historico`))
    assert.equal(hist.corpo.eventos[0].tipo, "CLIENTE_CRIADO")
    assert.equal(hist.corpo.eventos[0].autor_nome, "Colaborador A")
  })

  test("o mesmo CPF duas vezes na startup e 409", async () => {
    const r = await como(c.colaboradorA).post(crm(um(), "/clientes"), { nome: "Ana de novo", documento: CPF })
    assert.equal(r.status, 409)
  })

  test("o mesmo CPF em OUTRA startup e outro cliente", async () => {
    const r = await como(colaboradorDois).post(crm(dois(), "/clientes"), { nome: "Ana (na Dois)", documento: CPF })
    assert.equal(r.status, 201)
    estado.anaNaDois = r.corpo.cliente.id_cliente
  })

  test("PJ guarda o CNPJ e nao guarda empresa/cargo", async () => {
    const r = await como(c.colaboradorA).post(crm(um(), "/clientes"), {
      nome: "Beta Ltda",
      tipo_pessoa: "PJ",
      documento: CNPJ,
      empresa: "ignorado",
      cargo: "ignorado",
    })
    assert.equal(r.status, 201)
    assert.equal(r.corpo.cliente.empresa, null)
    assert.equal(r.corpo.cliente.cargo, null)
    estado.beta = r.corpo.cliente.id_cliente
  })

  test("editar gera UM evento com os campos e o status por extenso", async () => {
    const r = await como(c.colaboradorA).put(crm(um(), `/clientes/${estado.ana}`), {
      whatsapp: "11977776666",
      cargo: "Diretora de compras",
      status: "LEAD",
    })
    assert.equal(r.status, 200, JSON.stringify(r.corpo))
    const hist = await como(c.colaboradorA).get(crm(um(), `/clientes/${estado.ana}/historico`))
    const ev = hist.corpo.eventos[0]
    assert.equal(ev.tipo, "CLIENTE_ALTERADO")
    assert.equal(ev.descricao, "atualizou o cadastro (WhatsApp e cargo)")
    assert.deepEqual(ev.dados_anteriores, { whatsapp: null, cargo: "Compras" })
    assert.deepEqual(ev.dados_novos, { whatsapp: "11977776666", cargo: "Diretora de compras" })
  })

  test("salvar sem mudar nada nao gera evento", async () => {
    const antes = (await como(c.colaboradorA).get(crm(um(), `/clientes/${estado.ana}/historico`))).corpo.eventos.length
    await como(c.colaboradorA).put(crm(um(), `/clientes/${estado.ana}`), { nome: "Ana Souza", cargo: "Diretora de compras" })
    const depois = (await como(c.colaboradorA).get(crm(um(), `/clientes/${estado.ana}/historico`))).corpo.eventos.length
    assert.equal(depois, antes)
  })

  test("a lista traz os clientes da startup e so deles", async () => {
    const r = await como(c.colaboradorA).get(crm(um(), "/clientes"))
    const nomes = r.corpo.clientes.map((x) => x.nome)
    assert.deepEqual(nomes, ["Ana Souza", "Beta Ltda"])
  })
})

// ===========================================================================
describe("oportunidades e o historico de cada mudanca", () => {
  test("cria na primeira etapa, com quem criou de responsavel", async () => {
    const r = await como(c.colaboradorA).post(crm(um(), "/oportunidades"), {
      titulo: "Desenvolvimento de website",
      id_cliente: estado.ana,
      valor_estimado: 2000,
      probabilidade: 30,
      origem: "Indicação",
    })
    assert.equal(r.status, 201, JSON.stringify(r.corpo))
    const op = r.corpo.oportunidade
    assert.equal(op.etapa_nome, "Sem contato")
    assert.equal(op.situacao, "ABERTA")
    assert.equal(op.id_responsavel, c.colaboradorA.id)
    assert.equal(op.cliente_nome, "Ana Souza")
    estado.op = op.id_oportunidade
    estado.etapas = (await como(c.colaboradorA).get(crm(um(), "/contexto"))).corpo.etapas

    const [ev] = await eventosDa(estado.op)
    assert.equal(ev.tipo, "OPORTUNIDADE_CRIADA")
    assert.equal(ev.descricao, 'criou a oportunidade "Desenvolvimento de website" na etapa "Sem contato"')
    assert.equal(ev.dados_novos.valor_estimado, 2000)
    assert.equal(ev.autor_nome, "Colaborador A")
  })

  test("cria junto com um cliente novo, na mesma transacao", async () => {
    const r = await como(c.colaboradorA).post(crm(um(), "/oportunidades"), {
      titulo: "Consultoria",
      novo_cliente: { nome: "Carlos Lima", email: "carlos@exemplo.com" },
    })
    assert.equal(r.status, 201, JSON.stringify(r.corpo))
    assert.equal(r.corpo.oportunidade.cliente_nome, "Carlos Lima")
    estado.carlos = r.corpo.oportunidade.id_cliente
    estado.consultoria = r.corpo.oportunidade.id_oportunidade
  })

  test("cliente novo invalido nao deixa oportunidade orfa", async () => {
    const antes = await query(`SELECT COUNT(*)::int AS n FROM crm_oportunidade WHERE id_startup = $1`, [um()])
    const r = await como(c.colaboradorA).post(crm(um(), "/oportunidades"), {
      titulo: "Nao deve existir",
      novo_cliente: { nome: "Duplicada", documento: CPF },
    })
    assert.equal(r.status, 409)
    const depois = await query(`SELECT COUNT(*)::int AS n FROM crm_oportunidade WHERE id_startup = $1`, [um()])
    assert.equal(depois.rows[0].n, antes.rows[0].n)
  })

  test("valor estimado alterado: a frase e os dados dizem de quanto para quanto", async () => {
    const r = await como(c.colaboradorA).put(crm(um(), `/oportunidades/${estado.op}`), { valor_estimado: 3500 })
    assert.equal(r.status, 200)
    const [ev] = await eventosDa(estado.op)
    assert.equal(ev.tipo, "OPORTUNIDADE_ALTERADA")
    assert.equal(ev.descricao, "alterou o valor estimado de R$ 2.000,00 para R$ 3.500,00")
    assert.deepEqual(ev.dados_anteriores, { valor_estimado: 2000 })
    assert.deepEqual(ev.dados_novos, { valor_estimado: 3500 })
    assert.equal(ev.metadados.campo, "valor_estimado")
  })

  test("varios campos de uma vez viram um evento por campo; o que nao mudou nao conta", async () => {
    const antes = (await eventosDa(estado.op)).length
    const r = await como(c.colaboradorA).put(crm(um(), `/oportunidades/${estado.op}`), {
      titulo: "Desenvolvimento de website institucional",
      previsao_fechamento: "2026-12-15",
      descricao: "Site com blog",
      valor_estimado: 3500,
      origem: "Indicação",
    })
    assert.equal(r.status, 200)
    const eventos = await eventosDa(estado.op)
    assert.equal(eventos.length, antes + 3)
    const campos = eventos.slice(0, 3).map((e) => e.metadados.campo).sort()
    assert.deepEqual(campos, ["descricao", "previsao_fechamento", "titulo"])
    assert.ok(eventos.some((e) => e.descricao === "definiu a previsão de fechamento: 15/12/2026"))
  })

  test("trocar o responsavel registra os nomes", async () => {
    const r = await como(c.colaboradorA).put(crm(um(), `/oportunidades/${estado.op}`), { id_responsavel: colegaUm.id })
    assert.equal(r.status, 200)
    const [ev] = await eventosDa(estado.op)
    assert.equal(ev.tipo, "RESPONSAVEL_ALTERADO")
    assert.equal(ev.descricao, "alterou o responsável de Colaborador A para Colega Um")
  })

  test("responsavel que nao e membro da startup e recusado", async () => {
    for (const id of [colaboradorDois.id, c.adminA.id]) {
      const r = await como(c.colaboradorA).put(crm(um(), `/oportunidades/${estado.op}`), { id_responsavel: id })
      assert.equal(r.status, 400)
    }
  })

  test("mudar de etapa registra a etapa anterior, a nova e o autor", async () => {
    const apresentacao = estado.etapas.find((e) => e.nome === "Apresentação")
    const r = await como(c.colaboradorA).patch(crm(um(), `/oportunidades/${estado.op}/etapa`), {
      id_etapa: apresentacao.id_etapa,
    })
    assert.equal(r.status, 200)
    assert.equal(r.corpo.oportunidade.etapa_nome, "Apresentação")
    const [ev] = await eventosDa(estado.op)
    assert.equal(ev.tipo, "ETAPA_ALTERADA")
    assert.equal(ev.descricao, 'alterou a etapa de "Sem contato" para "Apresentação"')
    assert.equal(ev.dados_anteriores.etapa, "Sem contato")
    assert.equal(ev.dados_novos.etapa, "Apresentação")
    assert.match(ev.criado_ts, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })

  test("a etapa, o cliente e a oportunidade de outra startup nao servem", async () => {
    const etapaDois = (await como(colaboradorDois).get(crm(dois(), "/contexto"))).corpo.etapas[0]
    const mover = await como(c.colaboradorA).patch(crm(um(), `/oportunidades/${estado.op}/etapa`), {
      id_etapa: etapaDois.id_etapa,
    })
    assert.equal(mover.status, 400)

    const cliente = await como(c.colaboradorA).post(crm(um(), "/oportunidades"), {
      titulo: "Com cliente alheio",
      id_cliente: estado.anaNaDois,
    })
    assert.equal(cliente.status, 400)

    // Pela startup Dois, a oportunidade da Um simplesmente nao existe.
    for (const r of [
      await como(colaboradorDois).get(crm(dois(), `/oportunidades/${estado.op}`)),
      await como(colaboradorDois).put(crm(dois(), `/oportunidades/${estado.op}`), { titulo: "Roubada" }),
      await como(colaboradorDois).get(crm(dois(), `/oportunidades/${estado.op}/historico`)),
      await como(colaboradorDois).get(crm(dois(), `/clientes/${estado.ana}`)),
    ]) {
      assert.equal(r.status, 404)
    }
  })

  test("o kanban lista as oportunidades com cliente, etapa e responsavel", async () => {
    const r = await como(c.colaboradorA).get(crm(um(), "/oportunidades"))
    const op = r.corpo.oportunidades.find((o) => o.id_oportunidade === estado.op)
    assert.equal(op.etapa_nome, "Apresentação")
    assert.equal(op.responsavel_nome, "Colega Um")
    assert.equal(op.valor_estimado, 3500)
    assert.equal(op.previsao_fechamento, "2026-12-15")
    const daDois = await como(colaboradorDois).get(crm(dois(), "/oportunidades"))
    assert.deepEqual(daDois.corpo.oportunidades, [])
  })
})

// ===========================================================================
describe("tarefas e a linha do tempo", () => {
  test("tarefa criada na oportunidade herda o cliente dela e entra no historico", async () => {
    const r = await como(c.colaboradorA).post(crm(um(), "/tarefas"), {
      titulo: "Enviar orçamento",
      id_oportunidade: estado.op,
      id_cliente: estado.beta, // ignorado: com oportunidade, o cliente e o dela
      prioridade: "ALTA",
      vencimento_ts: "2026-11-20T17:00:00.000Z",
    })
    assert.equal(r.status, 201, JSON.stringify(r.corpo))
    assert.equal(r.corpo.tarefa.id_cliente, estado.ana)
    assert.equal(r.corpo.tarefa.vencimento_ts, "2026-11-20T17:00:00.000Z")
    estado.tarefa = r.corpo.tarefa.id_tarefa

    const [ev] = await eventosDa(estado.op)
    assert.equal(ev.tipo, "TAREFA_CRIADA")
    assert.equal(ev.descricao, 'criou a tarefa "Enviar orçamento"')
    assert.equal(ev.id_tarefa, estado.tarefa)
  })

  test("a tarefa aparece na area geral e no detalhe da oportunidade", async () => {
    const geral = await como(c.colaboradorA).get(crm(um(), "/tarefas"))
    assert.ok(geral.corpo.tarefas.some((t) => t.id_tarefa === estado.tarefa))
    const detalhe = await como(c.colaboradorA).get(crm(um(), `/oportunidades/${estado.op}`))
    assert.deepEqual(detalhe.corpo.tarefas.map((t) => t.id_tarefa), [estado.tarefa])
    assert.equal(detalhe.corpo.oportunidade.proxima_tarefa_titulo, "Enviar orçamento")
  })

  test("editar prazo e prioridade gera TAREFA_EDITADA com os campos", async () => {
    const r = await como(c.colaboradorA).put(crm(um(), `/tarefas/${estado.tarefa}`), {
      vencimento_ts: "2026-11-22T17:00:00.000Z",
      prioridade: "MEDIA",
      titulo: "Enviar orçamento",
    })
    assert.equal(r.status, 200)
    const [ev] = await eventosDa(estado.op)
    assert.equal(ev.tipo, "TAREFA_EDITADA")
    assert.equal(ev.descricao, 'editou a tarefa "Enviar orçamento" (prazo e prioridade)')
  })

  test("iniciar, concluir, reabrir e cancelar: um evento por troca", async () => {
    const passos = [
      ["EM_ANDAMENTO", "TAREFA_INICIADA"],
      ["CONCLUIDA", "TAREFA_CONCLUIDA"],
      ["PENDENTE", "TAREFA_REABERTA"],
      ["CANCELADA", "TAREFA_CANCELADA"],
      ["PENDENTE", "TAREFA_REABERTA"],
    ]
    for (const [status, tipo] of passos) {
      const r = await como(c.colaboradorA).patch(crm(um(), `/tarefas/${estado.tarefa}/status`), { status })
      assert.equal(r.status, 200, JSON.stringify(r.corpo))
      assert.equal(r.corpo.tarefa.status, status)
      assert.equal(Boolean(r.corpo.tarefa.concluida_ts), status === "CONCLUIDA")
      const [ev] = await eventosDa(estado.op)
      assert.equal(ev.tipo, tipo)
    }
  })

  test("tarefa vencida e aberta conta como atrasada", async () => {
    const r = await como(c.colaboradorA).post(crm(um(), "/tarefas"), {
      titulo: "Ligar para a Beta",
      id_cliente: estado.beta,
      vencimento_ts: "2020-01-01T12:00:00.000Z",
    })
    assert.equal(r.status, 201)
    assert.equal(r.corpo.tarefa.atrasada, true)
    estado.tarefaBeta = r.corpo.tarefa.id_tarefa
    const hist = await como(c.colaboradorA).get(crm(um(), `/clientes/${estado.beta}/historico`))
    assert.equal(hist.corpo.eventos[0].tipo, "TAREFA_CRIADA")
  })

  test("tarefa ligada a oportunidade de outra startup e recusada", async () => {
    const r = await como(colaboradorDois).post(crm(dois(), "/tarefas"), { titulo: "X", id_oportunidade: estado.op })
    assert.equal(r.status, 400)
  })

  test("a anotacao entra no topo da linha do tempo com o autor da sessao", async () => {
    const r = await como(colegaUm).post(crm(um(), `/oportunidades/${estado.op}/atividades`), {
      tipo: "ANOTACAO",
      texto: "Cliente demonstrou interesse na proposta",
      // Tentativas de forjar o evento: nada disto e lido.
      id_usuario: c.adminA.id,
      criado_ts: "2000-01-01T00:00:00.000Z",
      autor_nome: "Outra pessoa",
    })
    assert.equal(r.status, 201)
    const [ev] = await eventosDa(estado.op)
    assert.equal(ev.tipo, "ANOTACAO")
    assert.equal(ev.descricao, 'adicionou uma anotação: "Cliente demonstrou interesse na proposta"')
    assert.equal(ev.metadados.texto, "Cliente demonstrou interesse na proposta")
    assert.equal(ev.autor_nome, "Colega Um")
    assert.equal(ev.id_usuario, colegaUm.id)
    assert.ok(Date.parse(ev.criado_ts) > Date.parse("2026-01-01"))
  })

  test("contato e reuniao sao registros manuais; tipo automatico pelo pedido e recusado", async () => {
    const contato = await como(c.colaboradorA).post(crm(um(), `/oportunidades/${estado.op}/atividades`), {
      tipo: "CONTATO",
      canal: "WHATSAPP",
      texto: "Pediu o orçamento por escrito",
    })
    assert.equal(contato.status, 201)
    const reuniao = await como(c.colaboradorA).post(crm(um(), `/oportunidades/${estado.op}/atividades`), {
      tipo: "REUNIAO",
      texto: "Apresentação do escopo",
    })
    assert.equal(reuniao.status, 201)
    const [r1, r2] = await eventosDa(estado.op)
    assert.equal(r1.tipo, "REUNIAO")
    assert.equal(r2.descricao, 'registrou um contato por WhatsApp: "Pediu o orçamento por escrito"')

    const forjado = await como(c.colaboradorA).post(crm(um(), `/oportunidades/${estado.op}/atividades`), {
      tipo: "OPORTUNIDADE_GANHA",
      texto: "ganhei",
    })
    assert.equal(forjado.status, 400)
    const vazio = await como(c.colaboradorA).post(crm(um(), `/oportunidades/${estado.op}/atividades`), {
      tipo: "ANOTACAO",
      texto: "   ",
    })
    assert.equal(vazio.status, 400)
  })

  test("a linha do tempo pagina do mais recente para o mais antigo", async () => {
    const todos = await eventosDa(estado.op)
    const p1 = await como(c.colaboradorA).get(crm(um(), `/oportunidades/${estado.op}/historico?limite=3`))
    assert.equal(p1.corpo.eventos.length, 3)
    assert.equal(p1.corpo.temMais, true)
    const ultimo = p1.corpo.eventos[2].id_evento
    const p2 = await como(c.colaboradorA).get(
      crm(um(), `/oportunidades/${estado.op}/historico?limite=100&antes=${ultimo}`)
    )
    assert.deepEqual(
      [...p1.corpo.eventos, ...p2.corpo.eventos].map((e) => e.id_evento),
      todos.map((e) => e.id_evento)
    )
    assert.equal(p2.corpo.temMais, false)
    assert.equal(todos[todos.length - 1].tipo, "OPORTUNIDADE_CRIADA")
  })

  test("o historico do cliente reune os eventos das oportunidades dele", async () => {
    const r = await como(c.colaboradorA).get(crm(um(), `/clientes/${estado.ana}/historico?limite=100`))
    const tipos = new Set(r.corpo.eventos.map((e) => e.tipo))
    for (const t of ["CLIENTE_CRIADO", "OPORTUNIDADE_CRIADA", "ETAPA_ALTERADA", "TAREFA_CRIADA", "ANOTACAO"]) {
      assert.ok(tipos.has(t), `faltou ${t}`)
    }
  })
})

// ===========================================================================
describe("encerramento", () => {
  test("ganha: valor vendido diferente do estimado, data de fechamento, e o lead vira cliente ativo", async () => {
    const r = await como(c.colaboradorA).post(crm(um(), `/oportunidades/${estado.op}/ganhar`), {
      valor_vendido: 3200,
      fechamento_dt: "2026-11-02",
    })
    assert.equal(r.status, 200, JSON.stringify(r.corpo))
    const op = r.corpo.oportunidade
    assert.equal(op.situacao, "GANHA")
    assert.equal(op.valor_vendido, 3200)
    assert.equal(op.valor_estimado, 3500)
    assert.equal(op.fechamento_dt, "2026-11-02")
    assert.equal(op.etapa_nome, "Apresentação")

    const [ev] = await eventosDa(estado.op)
    assert.equal(ev.tipo, "OPORTUNIDADE_GANHA")
    assert.equal(
      ev.descricao,
      "marcou a oportunidade como ganha: R$ 3.200,00 (estimado R$ 3.500,00), fechada em 02/11/2026"
    )
    assert.equal(ev.metadados.etapa, "Apresentação")

    const cliente = await como(c.colaboradorA).get(crm(um(), `/clientes/${estado.ana}`))
    assert.equal(cliente.corpo.cliente.status, "ATIVO")
    const hist = await como(c.colaboradorA).get(crm(um(), `/clientes/${estado.ana}/historico`))
    assert.equal(hist.corpo.eventos[0].tipo, "CLIENTE_ALTERADO")
    assert.equal(hist.corpo.eventos[0].metadados.automatico, true)
  })

  test("encerrada nao muda de etapa nem se encerra de novo", async () => {
    const mover = await como(c.colaboradorA).patch(crm(um(), `/oportunidades/${estado.op}/etapa`), {
      id_etapa: estado.etapas[0].id_etapa,
    })
    assert.equal(mover.status, 409)
    const outra = await como(c.colaboradorA).post(crm(um(), `/oportunidades/${estado.op}/perder`), {
      motivo_perda: "x",
    })
    assert.equal(outra.status, 409)
  })

  test("reabrir volta ao funil e o encerramento fica no historico", async () => {
    const r = await como(c.colaboradorA).post(crm(um(), `/oportunidades/${estado.op}/reabrir`), {})
    assert.equal(r.status, 200)
    assert.equal(r.corpo.oportunidade.situacao, "ABERTA")
    assert.equal(r.corpo.oportunidade.valor_vendido, null)
    const [ev] = await eventosDa(estado.op)
    assert.equal(ev.tipo, "OPORTUNIDADE_REABERTA")
    assert.equal(ev.dados_anteriores.valor_vendido, 3200)
  })

  test("perdida exige motivo, e o motivo vai para o historico", async () => {
    const semMotivo = await como(c.colaboradorA).post(crm(um(), `/oportunidades/${estado.consultoria}/perder`), {})
    assert.equal(semMotivo.status, 400)
    const r = await como(c.colaboradorA).post(crm(um(), `/oportunidades/${estado.consultoria}/perder`), {
      motivo_perda: "Preço acima do orçamento do cliente",
      fechamento_dt: "2026-11-03",
    })
    assert.equal(r.status, 200)
    assert.equal(r.corpo.oportunidade.situacao, "PERDIDA")
    assert.equal(r.corpo.oportunidade.motivo_perda, "Preço acima do orçamento do cliente")
    const eventos = await como(c.colaboradorA).get(crm(um(), `/oportunidades/${estado.consultoria}/historico`))
    assert.equal(eventos.corpo.eventos[0].tipo, "OPORTUNIDADE_PERDIDA")
    assert.match(eventos.corpo.eventos[0].descricao, /Motivo: "Preço acima do orçamento do cliente"/)
  })
})

// ===========================================================================
describe("painel", () => {
  test("os indicadores contam os dados da startup, e so dela", async () => {
    const r = await como(c.colaboradorA).get(crm(um(), "/painel?periodo=tudo"))
    assert.equal(r.status, 200)
    const i = r.corpo.indicadores
    assert.equal(i.total_clientes, 3)
    assert.equal(i.oportunidades_abertas, 1)
    assert.equal(i.valor_funil, 3500)
    assert.equal(i.perdidas, 1)
    assert.equal(i.ganhas, 0)
    assert.equal(i.taxa_conversao, 0)
    assert.equal(i.tarefas_pendentes, 2)
    assert.equal(i.tarefas_atrasadas, 1)
    assert.ok(r.corpo.etapas.find((e) => e.nome === "Apresentação").quantidade === 1)
    assert.ok(r.corpo.atividades.length > 0)

    const outra = await como(colaboradorDois).get(crm(dois(), "/painel?periodo=tudo"))
    assert.equal(outra.corpo.indicadores.oportunidades_abertas, 0)
    assert.equal(outra.corpo.indicadores.total_clientes, 1)
    assert.ok(outra.corpo.atividades.every((e) => e.cliente_nome === "Ana (na Dois)"))
  })
})

// ===========================================================================
describe("o historico e imutavel", () => {
  test("nao ha rota para editar ou apagar evento", async () => {
    const [ev] = await eventosDa(estado.op)
    const put = await como(c.colaboradorA).put(crm(um(), `/oportunidades/${estado.op}/historico/${ev.id_evento}`), {
      descricao: "reescrito",
    })
    const del = await como(c.colaboradorA).del(crm(um(), `/oportunidades/${estado.op}/historico/${ev.id_evento}`))
    assert.equal(put.status, 404)
    assert.equal(del.status, 404)
  })

  test("nem direto no banco: UPDATE e DELETE sao recusados pelo trigger", async () => {
    const [ev] = await eventosDa(estado.op)
    await assert.rejects(
      query(`UPDATE crm_evento SET descricao = 'reescrito' WHERE id_evento = $1`, [ev.id_evento]),
      /nao pode ser alterado nem apagado/
    )
    await assert.rejects(query(`DELETE FROM crm_evento WHERE id_evento = $1`, [ev.id_evento]), /nao pode ser alterado/)
  })
})

// ===========================================================================
describe("exclusao", () => {
  test("cliente com oportunidade nao sai", async () => {
    const r = await como(c.colaboradorA).del(crm(um(), `/clientes/${estado.ana}`))
    assert.equal(r.status, 409)
  })

  test("excluir a oportunidade cancela as tarefas abertas e preserva o historico", async () => {
    const totalEventos = (await eventosDa(estado.op)).length
    const r = await como(c.colaboradorA).del(crm(um(), `/oportunidades/${estado.op}`))
    assert.equal(r.status, 204)

    assert.equal((await como(c.colaboradorA).get(crm(um(), `/oportunidades/${estado.op}`))).status, 404)
    const lista = await como(c.colaboradorA).get(crm(um(), "/oportunidades"))
    assert.ok(!lista.corpo.oportunidades.some((o) => o.id_oportunidade === estado.op))

    const tarefa = await como(c.colaboradorA).get(crm(um(), `/tarefas/${estado.tarefa}`))
    assert.equal(tarefa.corpo.tarefa.status, "CANCELADA")

    const { rows } = await query(`SELECT tipo FROM crm_evento WHERE id_oportunidade = $1 ORDER BY id_evento`, [estado.op])
    assert.equal(rows.length, totalEventos + 2) // a tarefa cancelada e a exclusao
    assert.deepEqual(rows.slice(-2).map((x) => x.tipo), ["TAREFA_CANCELADA", "OPORTUNIDADE_EXCLUIDA"])
    const linha = await query(`SELECT excluido_ts FROM crm_oportunidade WHERE id_oportunidade = $1`, [estado.op])
    assert.ok(linha.rows[0].excluido_ts)
  })
})

// ===========================================================================
describe("revogacao: fecha o acesso e preserva os dados", () => {
  const contar = async () => {
    const { rows } = await query(
      `SELECT (SELECT COUNT(*) FROM crm_cliente WHERE id_startup = $1)::int AS clientes,
              (SELECT COUNT(*) FROM crm_oportunidade WHERE id_startup = $1)::int AS oportunidades,
              (SELECT COUNT(*) FROM crm_tarefa WHERE id_startup = $1)::int AS tarefas,
              (SELECT COUNT(*) FROM crm_evento WHERE id_startup = $1)::int AS eventos,
              (SELECT COUNT(*) FROM crm_etapa WHERE id_startup = $1)::int AS etapas`,
      [um()]
    )
    return rows[0]
  }

  test("revogado, todo endpoint do CRM responde 403 e os dados continuam no banco", async () => {
    estado.antesDaRevogacao = await contar()
    const r = await como(c.adminA).put(`/startups/${um()}/beneficios/CRM`, { ativo: false })
    assert.equal(r.status, 200)
    assert.equal(r.corpo.beneficio.ativo, false)
    assert.equal(r.corpo.beneficio.revogado_por_nome, "Admin A")

    for (const resp of [
      await como(c.colaboradorA).get(crm(um(), "/clientes")),
      await como(c.colaboradorA).get(crm(um(), "/painel")),
      await como(c.colaboradorA).post(crm(um(), "/clientes"), { nome: "Depois da revogação" }),
      await como(c.colaboradorA).patch(crm(um(), `/tarefas/${estado.tarefaBeta}/status`), { status: "CONCLUIDA" }),
    ]) {
      assert.equal(resp.status, 403)
      assert.equal(resp.corpo.codigo, "BENEFICIO_INATIVO")
    }

    assert.deepEqual(await contar(), estado.antesDaRevogacao)
    const meus = await como(c.colaboradorA).get(`/beneficios/meus?id_tenant=${c.tenantA.id_tenant}`)
    assert.deepEqual(meus.corpo.beneficios, [])

    // A outra startup nao e afetada.
    assert.equal((await como(colaboradorDois).get(crm(dois(), "/clientes"))).status, 200)
  })

  test("concedido de novo, tudo volta como estava (e o funil nao e semeado outra vez)", async () => {
    const r = await como(c.adminA).put(`/startups/${um()}/beneficios/CRM`, { ativo: true })
    assert.equal(r.status, 200)
    assert.deepEqual(await contar(), estado.antesDaRevogacao)
    const clientes = await como(c.colaboradorA).get(crm(um(), "/clientes"))
    assert.deepEqual(clientes.corpo.clientes.map((x) => x.nome), ["Ana Souza", "Beta Ltda", "Carlos Lima"])
    const hist = await como(c.colaboradorA).get(crm(um(), `/clientes/${estado.ana}/historico?limite=100`))
    assert.ok(hist.corpo.eventos.length > 5)

    const { rows } = await query(
      `SELECT acao FROM audit_log WHERE entidade = 'startup_beneficio' AND entidade_id = $1 ORDER BY id_log`,
      [`${um()}:CRM`]
    )
    assert.deepEqual(rows.map((x) => x.acao), ["CONCEDER", "REVOGAR", "CONCEDER"])
  })

  test("membro desligado da startup perde o acesso na hora", async () => {
    const startupService = require("../src/services/startupService")
    await startupService.removerMembro(um(), colegaUm.id, c.adminA)
    const r = await como(colegaUm).get(crm(um(), "/clientes"))
    assert.equal(r.status, 403)
    assert.equal(r.corpo.codigo, "SEM_VINCULO")
  })
})

// ===========================================================================
describe("integridade referencial", () => {
  test("apagar a startup leva o CRM dela junto (o trigger deixa a cascata passar)", async () => {
    await query(`DELETE FROM startup WHERE id_startup = $1`, [dois()])
    const { rows } = await query(
      `SELECT (SELECT COUNT(*) FROM crm_evento WHERE id_startup = $1)::int AS eventos,
              (SELECT COUNT(*) FROM crm_cliente WHERE id_startup = $1)::int AS clientes`,
      [dois()]
    )
    assert.deepEqual(rows[0], { eventos: 0, clientes: 0 })
  })
})
