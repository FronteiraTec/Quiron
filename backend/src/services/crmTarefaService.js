/**
 * Service das tarefas comerciais do CRM (migracao 026).
 *
 * A tarefa pode ser solta, de um cliente ou de uma oportunidade. Com
 * oportunidade, o cliente e o DELA (o pedido nao escolhe): uma tarefa da venda
 * para a Acme nao pode aparecer no historico de outro cliente.
 *
 * Tarefa ligada a cliente ou oportunidade conta a sua vida no historico deles
 * (criada, editada, iniciada, concluida, reaberta, cancelada), gravado na mesma
 * transacao. A tarefa solta nao tem historico onde morar — o CHECK de
 * crm_evento exige um alvo — e vive so na lista.
 *
 * O vinculo nao muda depois de criada: mover uma tarefa de uma venda para outra
 * reescreveria o historico das duas.
 */
const { withTransaction } = require("../config/db")
const crmTarefaRepository = require("../repositories/crmTarefaRepository")
const crmOportunidadeRepository = require("../repositories/crmOportunidadeRepository")
const crmClienteRepository = require("../repositories/crmClienteRepository")
const acesso = require("./crmAcessoService")
const crmHistorico = require("./crmHistoricoService")
const h = require("../crm/historico")
const v = require("../crm/validacao")
const { PRIORIDADES, STATUS_TAREFA } = require("../crm/padroes")
const { erroNegocio } = require("../utils/erros")

const NAO_ENCONTRADA = "Tarefa não encontrada."

function prepararCampos(dados = {}, { edicao = false } = {}) {
  const tem = (campo) => !edicao || dados[campo] !== undefined
  const c = {}
  if (tem("titulo")) {
    c.titulo = v.texto(dados.titulo ?? null, { rotulo: "o título da tarefa", max: 150, obrigatorio: true })
  }
  if (tem("descricao")) c.descricao = v.texto(dados.descricao ?? null, { rotulo: "a descrição", max: 5000 })
  if (tem("vencimento_ts")) c.vencimento_ts = v.instante(dados.vencimento_ts ?? null, "o prazo")
  if (tem("prioridade")) c.prioridade = v.umDe(dados.prioridade ?? "MEDIA", PRIORIDADES, "a prioridade")
  if (dados.id_responsavel !== undefined) c.id_responsavel = v.id(dados.id_responsavel, "o responsável")
  return c
}

/** O vinculo pedido, conferido contra a startup do contexto. */
async function resolverVinculo(client, ctx, dados) {
  const idOportunidade = v.id(dados.id_oportunidade, "a oportunidade")
  const idCliente = v.id(dados.id_cliente, "o cliente")
  if (idOportunidade) {
    const op = await crmOportunidadeRepository.buscar(ctx.idStartup, idOportunidade, client)
    if (!op) throw erroNegocio(400, "Oportunidade não encontrada nesta startup.")
    return { id_oportunidade: op.id_oportunidade, id_cliente: op.id_cliente }
  }
  if (idCliente) {
    const cliente = await crmClienteRepository.buscar(ctx.idStartup, idCliente, client)
    if (!cliente) throw erroNegocio(400, "Cliente não encontrado nesta startup.")
    return { id_oportunidade: null, id_cliente: cliente.id_cliente }
  }
  return { id_oportunidade: null, id_cliente: null }
}

/** Grava o evento so quando ha onde grava-lo (cliente ou oportunidade). */
function registrarSeVinculada(client, ctx, tarefa, evento) {
  if (!tarefa.id_oportunidade && !tarefa.id_cliente) return null
  return crmHistorico.registrar(client, ctx, {
    ...evento,
    idOportunidade: tarefa.id_oportunidade,
    idCliente: tarefa.id_cliente,
    idTarefa: tarefa.id_tarefa,
  })
}

/**
 * Qual evento e qual frase uma troca de status gera. Sair de concluida ou
 * cancelada e REABRIR, para qualquer status aberto.
 */
function transicao(de, para, titulo) {
  const t = h.citar(titulo)
  if (para === "CONCLUIDA") return { tipo: "TAREFA_CONCLUIDA", descricao: `concluiu a tarefa ${t}` }
  if (para === "CANCELADA") return { tipo: "TAREFA_CANCELADA", descricao: `cancelou a tarefa ${t}` }
  if (de === "CONCLUIDA" || de === "CANCELADA") return { tipo: "TAREFA_REABERTA", descricao: `reabriu a tarefa ${t}` }
  if (para === "EM_ANDAMENTO") return { tipo: "TAREFA_INICIADA", descricao: `iniciou a tarefa ${t}` }
  return { tipo: "TAREFA_EDITADA", descricao: `voltou a tarefa ${t} para pendente` }
}

// ------------------------------------------------------------------ leituras

/** Todas as tarefas da startup, ou as de um cliente / de uma oportunidade. */
async function listar(idStartup, query = {}, usuario) {
  const ctx = await acesso.exigirAcesso(idStartup, usuario)
  return crmTarefaRepository.listar(ctx.idStartup, {
    idOportunidade: v.id(query.id_oportunidade, "a oportunidade") || undefined,
    idCliente: v.id(query.id_cliente, "o cliente") || undefined,
  })
}

async function buscar(idStartup, idTarefa, usuario) {
  const ctx = await acesso.exigirAcesso(idStartup, usuario)
  const tarefa = await crmTarefaRepository.buscar(ctx.idStartup, v.idRota(idTarefa, NAO_ENCONTRADA))
  if (!tarefa) throw erroNegocio(404, NAO_ENCONTRADA)
  return tarefa
}

// ------------------------------------------------------------------ escritas

/** Cria. Sem responsavel, e de quem criou; nasce pendente ou em andamento. */
async function criar(idStartup, dados = {}, usuario) {
  const ctx = await acesso.exigirAcesso(idStartup, usuario)
  const campos = prepararCampos(dados)
  if (campos.id_responsavel === undefined) campos.id_responsavel = ctx.idUsuario
  await acesso.exigirMembro(ctx, campos.id_responsavel)
  const status = v.umDe(dados.status ?? "PENDENTE", ["PENDENTE", "EM_ANDAMENTO"], "o status inicial")

  return withTransaction(async (client) => {
    const vinculo = await resolverVinculo(client, ctx, dados)
    const id = await crmTarefaRepository.criar(client, ctx.idStartup, { ...campos, ...vinculo, status }, ctx.idUsuario)
    const tarefa = await crmTarefaRepository.buscar(ctx.idStartup, id, client)

    await registrarSeVinculada(client, ctx, tarefa, {
      tipo: "TAREFA_CRIADA",
      descricao: `criou a tarefa ${h.citar(tarefa.titulo)}`,
      depois: {
        titulo: tarefa.titulo,
        vencimento_ts: tarefa.vencimento_ts,
        prioridade: tarefa.prioridade,
        status: tarefa.status,
        id_responsavel: tarefa.id_responsavel,
        responsavel: tarefa.responsavel_nome,
      },
      metadados: { titulo: tarefa.titulo, vencimento_ts: tarefa.vencimento_ts, prioridade: tarefa.prioridade },
    })
    return tarefa
  })
}

/** Edita titulo, descricao, responsavel, prazo e prioridade. O status tem rota propria. */
async function atualizar(idStartup, idTarefa, dados = {}, usuario) {
  const ctx = await acesso.exigirAcesso(idStartup, usuario)
  const id = v.idRota(idTarefa, NAO_ENCONTRADA)
  const campos = prepararCampos(dados, { edicao: true })

  return withTransaction(async (client) => {
    const atual = await crmTarefaRepository.travar(client, ctx.idStartup, id)
    if (!atual) throw erroNegocio(404, NAO_ENCONTRADA)

    const difs = h.diferencas(atual, campos, h.CAMPOS_TAREFA)
    if (difs.length === 0) return crmTarefaRepository.buscar(ctx.idStartup, id, client)

    const trocaResponsavel = difs.find((d) => d.campo === "id_responsavel")
    if (trocaResponsavel) await acesso.exigirMembro(ctx, trocaResponsavel.depois)

    const gravar = {}
    for (const d of difs) gravar[d.campo] = campos[d.campo]
    await crmTarefaRepository.atualizar(client, ctx.idStartup, id, gravar)
    const tarefa = await crmTarefaRepository.buscar(ctx.idStartup, id, client)

    const { antes, depois } = h.lados(difs)
    await registrarSeVinculada(client, ctx, tarefa, {
      tipo: "TAREFA_EDITADA",
      descricao: h.descreverTarefaEditada(tarefa.titulo, difs),
      antes,
      depois,
      metadados: {
        titulo: tarefa.titulo,
        campos: difs.map((d) => d.campo),
        ...(trocaResponsavel
          ? { responsavel_anterior: atual.responsavel_nome, responsavel_novo: tarefa.responsavel_nome }
          : {}),
      },
    })
    return tarefa
  })
}

/** Iniciar, concluir, cancelar, reabrir. Mesmo status e nada a fazer. */
async function mudarStatus(idStartup, idTarefa, dados = {}, usuario) {
  const ctx = await acesso.exigirAcesso(idStartup, usuario)
  const id = v.idRota(idTarefa, NAO_ENCONTRADA)
  const status = v.umDe(dados.status, STATUS_TAREFA, "o status")
  if (!status) throw erroNegocio(400, "Informe o status.")

  return withTransaction(async (client) => {
    const atual = await crmTarefaRepository.travar(client, ctx.idStartup, id)
    if (!atual) throw erroNegocio(404, NAO_ENCONTRADA)
    if (atual.status === status) return crmTarefaRepository.buscar(ctx.idStartup, id, client)

    await crmTarefaRepository.mudarStatus(client, ctx.idStartup, id, status, ctx.idUsuario)
    const evento = transicao(atual.status, status, atual.titulo)
    await registrarSeVinculada(client, ctx, atual, {
      ...evento,
      antes: { status: atual.status },
      depois: { status },
      metadados: { titulo: atual.titulo },
    })
    return crmTarefaRepository.buscar(ctx.idStartup, id, client)
  })
}

module.exports = { listar, buscar, criar, atualizar, mudarStatus, transicao }
