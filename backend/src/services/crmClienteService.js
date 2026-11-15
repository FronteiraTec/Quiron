/**
 * Service dos clientes do CRM (migracao 026).
 *
 * Toda funcao publica comeca por crmAcessoService.exigirAcesso: membro ativo
 * da startup e beneficio ativo, conferidos no banco. Depois disso, o id da
 * startup que vale e o do CONTEXTO, e toda consulta o leva junto.
 *
 * O historico do cliente (cadastrou, atualizou, excluiu, anotacoes) e gravado
 * na mesma transacao da escrita.
 */
const { withTransaction } = require("../config/db")
const crmClienteRepository = require("../repositories/crmClienteRepository")
const crmOportunidadeRepository = require("../repositories/crmOportunidadeRepository")
const crmTarefaRepository = require("../repositories/crmTarefaRepository")
const crmEventoRepository = require("../repositories/crmEventoRepository")
const acesso = require("./crmAcessoService")
const crmHistorico = require("./crmHistoricoService")
const h = require("../crm/historico")
const v = require("../crm/validacao")
const { TIPOS_PESSOA, STATUS_CLIENTE } = require("../crm/padroes")
const { erroNegocio } = require("../utils/erros")

const NAO_ENCONTRADO = "Cliente não encontrado."

/**
 * Valida o cadastro. Na edicao, o que nao veio no pedido continua como esta
 * (`atual`), e o resultado e sempre o cadastro inteiro.
 */
function preparar(dados = {}, atual = null) {
  const fonte = atual ? { ...atual, ...v.definidos(dados) } : dados
  const tipo = v.umDe(fonte.tipo_pessoa ?? "PF", TIPOS_PESSOA, "o tipo de pessoa")
  const pj = tipo === "PJ"
  return {
    tipo_pessoa: tipo,
    nome: v.texto(fonte.nome ?? null, { rotulo: "o nome do cliente", max: 150, obrigatorio: true }),
    documento: v.documento(fonte.documento ?? null, tipo),
    email: v.email(fonte.email ?? null),
    telefone: v.telefone(fonte.telefone ?? null, "o telefone"),
    whatsapp: v.telefone(fonte.whatsapp ?? null, "o WhatsApp"),
    // Para PJ o proprio cliente e a empresa: "empresa" e "cargo" descrevem uma
    // pessoa, e ficam vazios.
    empresa: pj ? null : v.texto(fonte.empresa ?? null, { rotulo: "a empresa", max: 150 }),
    cargo: pj ? null : v.texto(fonte.cargo ?? null, { rotulo: "o cargo", max: 100 }),
    origem: v.texto(fonte.origem ?? null, { rotulo: "a origem", max: 60 }),
    status: v.umDe(fonte.status ?? "LEAD", STATUS_CLIENTE, "o status"),
    observacoes: v.texto(fonte.observacoes ?? null, { rotulo: "as observações", max: 5000 }),
  }
}

/** O documento duplicado vira 409 com a palavra certa (CPF ou CNPJ). */
function traduzirDuplicado(err, tipo) {
  if (err.code === "23505" && String(err.constraint || "").includes("documento")) {
    return erroNegocio(409, `Já existe um cliente com este ${tipo === "PJ" ? "CNPJ" : "CPF"}.`)
  }
  return err
}

/**
 * Cria o cliente dentro de uma transacao ja aberta. Exposto para a
 * oportunidade criada junto com um cliente novo: os dois nascem, ou nenhum.
 * @returns {Promise<number>} o id do cliente.
 */
async function criarNaTransacao(client, ctx, dados) {
  const cadastro = preparar(dados)
  let idCliente
  try {
    idCliente = await crmClienteRepository.criar(client, ctx.idStartup, cadastro, ctx.idUsuario)
  } catch (err) {
    throw traduzirDuplicado(err, cadastro.tipo_pessoa)
  }
  await crmHistorico.registrar(client, ctx, {
    tipo: "CLIENTE_CRIADO",
    idCliente,
    descricao: `cadastrou o cliente ${h.citar(cadastro.nome)}`,
    depois: cadastro,
  })
  return idCliente
}

async function listar(idStartup, usuario) {
  const ctx = await acesso.exigirAcesso(idStartup, usuario)
  return crmClienteRepository.listar(ctx.idStartup)
}

/** O cliente com as oportunidades e as tarefas dele (a tela de detalhe). */
async function buscar(idStartup, idCliente, usuario) {
  const ctx = await acesso.exigirAcesso(idStartup, usuario)
  const id = v.idRota(idCliente, NAO_ENCONTRADO)
  const cliente = await crmClienteRepository.buscar(ctx.idStartup, id)
  if (!cliente) throw erroNegocio(404, NAO_ENCONTRADO)
  const [oportunidades, tarefas] = await Promise.all([
    crmOportunidadeRepository.listar(ctx.idStartup, { idCliente: id }),
    crmTarefaRepository.listar(ctx.idStartup, { idCliente: id }),
  ])
  return { cliente, oportunidades, tarefas }
}

async function criar(idStartup, dados, usuario) {
  const ctx = await acesso.exigirAcesso(idStartup, usuario)
  return withTransaction(async (client) => {
    const idCliente = await criarNaTransacao(client, ctx, dados)
    return crmClienteRepository.buscar(ctx.idStartup, idCliente, client)
  })
}

async function atualizar(idStartup, idCliente, dados, usuario) {
  const ctx = await acesso.exigirAcesso(idStartup, usuario)
  const id = v.idRota(idCliente, NAO_ENCONTRADO)

  return withTransaction(async (client) => {
    const atual = await crmClienteRepository.travar(client, ctx.idStartup, id)
    if (!atual) throw erroNegocio(404, NAO_ENCONTRADO)

    const novo = preparar(dados, atual)
    const difs = h.diferencas(atual, novo, h.CAMPOS_CLIENTE)
    if (difs.length === 0) return crmClienteRepository.buscar(ctx.idStartup, id, client)

    try {
      await crmClienteRepository.atualizar(client, ctx.idStartup, id, novo)
    } catch (err) {
      throw traduzirDuplicado(err, novo.tipo_pessoa)
    }

    const { antes, depois } = h.lados(difs)
    await crmHistorico.registrar(client, ctx, {
      tipo: "CLIENTE_ALTERADO",
      idCliente: id,
      descricao: h.descreverCliente(difs),
      antes,
      depois,
      metadados: { campos: difs.map((d) => d.campo) },
    })
    return crmClienteRepository.buscar(ctx.idStartup, id, client)
  })
}

/**
 * Exclusao logica. Cliente com oportunidade nao sai: a oportunidade ficaria
 * apontando para um cliente invisivel, e o funil mostraria uma venda sem
 * comprador. As tarefas abertas do cliente sao canceladas, com evento.
 */
async function excluir(idStartup, idCliente, usuario) {
  const ctx = await acesso.exigirAcesso(idStartup, usuario)
  const id = v.idRota(idCliente, NAO_ENCONTRADO)

  await withTransaction(async (client) => {
    const atual = await crmClienteRepository.travar(client, ctx.idStartup, id)
    if (!atual) throw erroNegocio(404, NAO_ENCONTRADO)

    const total = await crmClienteRepository.contarOportunidades(client, ctx.idStartup, id)
    if (total > 0) {
      throw erroNegocio(
        409,
        `Este cliente tem ${total} oportunidade${total > 1 ? "s" : ""}. Exclua-as ou associe-as a outro cliente antes de excluí-lo.`
      )
    }

    const canceladas = await crmTarefaRepository.cancelarAbertas(client, ctx.idStartup, { idCliente: id })
    for (const t of canceladas) {
      await crmHistorico.registrar(client, ctx, {
        tipo: "TAREFA_CANCELADA",
        idCliente: id,
        idTarefa: t.id_tarefa,
        descricao: `cancelou a tarefa ${h.citar(t.titulo)} ao excluir o cliente`,
        depois: { status: "CANCELADA" },
        metadados: { titulo: t.titulo, motivo: "CLIENTE_EXCLUIDO" },
      })
    }

    await crmClienteRepository.excluir(client, ctx.idStartup, id, ctx.idUsuario)
    await crmHistorico.registrar(client, ctx, {
      tipo: "CLIENTE_EXCLUIDO",
      idCliente: id,
      descricao: `excluiu o cliente ${h.citar(atual.nome)}`,
      antes: { nome: atual.nome },
    })
  })
}

/** O historico de interacoes do cliente: os eventos dele e os das oportunidades dele. */
async function historico(idStartup, idCliente, query, usuario) {
  const ctx = await acesso.exigirAcesso(idStartup, usuario)
  const id = v.idRota(idCliente, NAO_ENCONTRADO)
  const cliente = await crmClienteRepository.buscar(ctx.idStartup, id)
  if (!cliente) throw erroNegocio(404, NAO_ENCONTRADO)
  return crmEventoRepository.listar(ctx.idStartup, { idCliente: id }, crmHistorico.lerPagina(query))
}

/** Anotacao, contato ou reuniao registrados direto no cliente. */
async function registrarAtividade(idStartup, idCliente, dados, usuario) {
  const ctx = await acesso.exigirAcesso(idStartup, usuario)
  const id = v.idRota(idCliente, NAO_ENCONTRADO)
  const atividade = crmHistorico.prepararAtividade(dados)

  return withTransaction(async (client) => {
    const atual = await crmClienteRepository.travar(client, ctx.idStartup, id)
    if (!atual) throw erroNegocio(404, NAO_ENCONTRADO)
    const idEvento = await crmHistorico.registrar(client, ctx, { ...atividade, idCliente: id })
    return { id_evento: idEvento }
  })
}

module.exports = {
  preparar,
  criarNaTransacao,
  listar,
  buscar,
  criar,
  atualizar,
  excluir,
  historico,
  registrarAtividade,
}
