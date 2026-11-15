/**
 * Service das oportunidades do CRM (migracao 026) — o funil.
 *
 * TODA ESCRITA GRAVA O HISTORICO NA MESMA TRANSACAO. A linha da oportunidade e
 * travada antes (crmOportunidadeRepository.travar), comparada com o pedido, e
 * cada diferenca vira um evento com o antes e o depois. Se o evento falhar, a
 * alteracao volta junto: nao existe oportunidade que mudou sem contar.
 *
 * GANHO E PERDA SAO ESTADOS FINAIS, nao etapas. Encerrada, a oportunidade sai
 * do funil aberto e nao muda de etapa ate ser reaberta. A etapa em que ela
 * estava fica gravada: e o que diz em que ponto do funil se ganha e se perde.
 */
const { withTransaction } = require("../config/db")
const crmOportunidadeRepository = require("../repositories/crmOportunidadeRepository")
const crmClienteRepository = require("../repositories/crmClienteRepository")
const crmEtapaRepository = require("../repositories/crmEtapaRepository")
const crmTarefaRepository = require("../repositories/crmTarefaRepository")
const crmEventoRepository = require("../repositories/crmEventoRepository")
const acesso = require("./crmAcessoService")
const crmHistorico = require("./crmHistoricoService")
const crmClienteService = require("./crmClienteService")
const h = require("../crm/historico")
const v = require("../crm/validacao")
const { SITUACOES } = require("../crm/padroes")
const { erroNegocio } = require("../utils/erros")

const NAO_ENCONTRADA = "Oportunidade não encontrada."
const TEXTO_MAX = 5000

/**
 * Os campos comerciais do pedido, validados. Na edicao so entra o que veio no
 * pedido — ausente e "nao mexi".
 */
function prepararCampos(dados = {}, { edicao = false } = {}) {
  const tem = (campo) => !edicao || dados[campo] !== undefined
  const c = {}
  if (tem("titulo")) {
    c.titulo = v.texto(dados.titulo ?? null, { rotulo: "o nome da oportunidade", max: 150, obrigatorio: true })
  }
  if (tem("descricao")) c.descricao = v.texto(dados.descricao ?? null, { rotulo: "a descrição", max: TEXTO_MAX })
  if (tem("valor_estimado")) c.valor_estimado = v.dinheiro(dados.valor_estimado ?? null, "o valor estimado")
  if (tem("probabilidade")) c.probabilidade = v.inteiroEntre(dados.probabilidade ?? null, 0, 100, "a probabilidade")
  if (tem("previsao_fechamento")) {
    c.previsao_fechamento = v.data(dados.previsao_fechamento ?? null, "a previsão de fechamento")
  }
  if (tem("origem")) c.origem = v.texto(dados.origem ?? null, { rotulo: "a origem", max: 60 })
  if (tem("observacoes")) c.observacoes = v.texto(dados.observacoes ?? null, { rotulo: "as observações", max: TEXTO_MAX })
  if (dados.id_responsavel !== undefined) c.id_responsavel = v.id(dados.id_responsavel, "o responsável")
  if (dados.id_cliente !== undefined) c.id_cliente = v.id(dados.id_cliente, "o cliente")
  return c
}

/** O retrato da oportunidade no evento de criacao. */
function retrato(op) {
  return {
    titulo: op.titulo,
    id_cliente: op.id_cliente,
    cliente: op.cliente_nome,
    id_etapa: op.id_etapa,
    etapa: op.etapa_nome,
    valor_estimado: op.valor_estimado,
    probabilidade: op.probabilidade,
    previsao_fechamento: op.previsao_fechamento,
    origem: op.origem,
    id_responsavel: op.id_responsavel,
    responsavel: op.responsavel_nome,
  }
}

/** Dias inteiros desde um instante ISO (quanto tempo ficou na etapa). */
function diasDesde(iso) {
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? null : Math.max(0, Math.floor((Date.now() - ms) / 86400000))
}

async function exigirOportunidade(client, ctx, idOportunidade) {
  const id = v.idRota(idOportunidade, NAO_ENCONTRADA)
  const atual = await crmOportunidadeRepository.travar(client, ctx.idStartup, id)
  if (!atual) throw erroNegocio(404, NAO_ENCONTRADA)
  return atual
}

/**
 * Muda a etapa dentro de uma transacao ja aberta (o PATCH e a edicao completa
 * passam por aqui). Mesma etapa e nada a fazer.
 */
async function moverNaTransacao(client, ctx, atual, idEtapa, idCliente = atual.id_cliente) {
  if (atual.situacao !== "ABERTA") {
    throw erroNegocio(409, "Esta oportunidade está encerrada. Reabra-a para mudar a etapa.")
  }
  const destino = await crmEtapaRepository.buscar(ctx.idStartup, idEtapa, client)
  if (!destino || !destino.ativo) throw erroNegocio(400, "Etapa inválida para este funil.")
  if (destino.id_etapa === atual.id_etapa) return false

  await crmOportunidadeRepository.moverEtapa(client, ctx.idStartup, atual.id_oportunidade, destino.id_etapa)
  await crmHistorico.registrar(client, ctx, {
    tipo: "ETAPA_ALTERADA",
    idOportunidade: atual.id_oportunidade,
    idCliente,
    descricao: `alterou a etapa de ${h.citar(atual.etapa_nome)} para ${h.citar(destino.nome)}`,
    antes: { id_etapa: atual.id_etapa, etapa: atual.etapa_nome },
    depois: { id_etapa: destino.id_etapa, etapa: destino.nome },
    metadados: { dias_na_etapa_anterior: diasDesde(atual.etapa_ts) },
  })
  return true
}

/** Cancela as tarefas abertas da oportunidade, com um evento por tarefa. */
async function cancelarTarefasAbertas(client, ctx, atual, motivo, frase) {
  const canceladas = await crmTarefaRepository.cancelarAbertas(client, ctx.idStartup, {
    idOportunidade: atual.id_oportunidade,
  })
  for (const t of canceladas) {
    await crmHistorico.registrar(client, ctx, {
      tipo: "TAREFA_CANCELADA",
      idOportunidade: atual.id_oportunidade,
      idCliente: t.id_cliente ?? atual.id_cliente,
      idTarefa: t.id_tarefa,
      descricao: `cancelou a tarefa ${h.citar(t.titulo)} ${frase}`,
      depois: { status: "CANCELADA" },
      metadados: { titulo: t.titulo, motivo },
    })
  }
  return canceladas.length
}

// ------------------------------------------------------------------ leituras

async function listar(idStartup, query = {}, usuario) {
  const ctx = await acesso.exigirAcesso(idStartup, usuario)
  const situacao = query.situacao && query.situacao !== "TODAS" ? v.umDe(query.situacao, SITUACOES, "a situação") : null
  return crmOportunidadeRepository.listar(ctx.idStartup, { situacao })
}

/** A oportunidade com as tarefas dela. O historico vem paginado, a parte. */
async function buscar(idStartup, idOportunidade, usuario) {
  const ctx = await acesso.exigirAcesso(idStartup, usuario)
  const id = v.idRota(idOportunidade, NAO_ENCONTRADA)
  const oportunidade = await crmOportunidadeRepository.buscar(ctx.idStartup, id)
  if (!oportunidade) throw erroNegocio(404, NAO_ENCONTRADA)
  const tarefas = await crmTarefaRepository.listar(ctx.idStartup, { idOportunidade: id })
  return { oportunidade, tarefas }
}

async function historico(idStartup, idOportunidade, query, usuario) {
  const ctx = await acesso.exigirAcesso(idStartup, usuario)
  const id = v.idRota(idOportunidade, NAO_ENCONTRADA)
  const existe = await crmOportunidadeRepository.buscar(ctx.idStartup, id)
  if (!existe) throw erroNegocio(404, NAO_ENCONTRADA)
  return crmEventoRepository.listar(ctx.idStartup, { idOportunidade: id }, crmHistorico.lerPagina(query))
}

// ------------------------------------------------------------------ escritas

/**
 * Cria a oportunidade. O cliente e um existente (`id_cliente`) ou nasce junto
 * (`novo_cliente`), na mesma transacao. Sem etapa, entra na primeira do
 * funil; sem responsavel, o responsavel e quem criou.
 */
async function criar(idStartup, dados = {}, usuario) {
  const ctx = await acesso.exigirAcesso(idStartup, usuario)
  const campos = prepararCampos(dados)
  if (campos.id_responsavel === undefined) campos.id_responsavel = ctx.idUsuario
  await acesso.exigirMembro(ctx, campos.id_responsavel)
  const idEtapaPedida = v.id(dados.id_etapa, "a etapa")

  return withTransaction(async (client) => {
    const etapa = idEtapaPedida
      ? await crmEtapaRepository.buscar(ctx.idStartup, idEtapaPedida, client)
      : await crmEtapaRepository.primeiraAtiva(ctx.idStartup, client)
    if (!etapa || !etapa.ativo) {
      throw erroNegocio(400, idEtapaPedida ? "Etapa inválida para este funil." : "O funil não tem nenhuma etapa ativa.")
    }

    let idCliente
    if (dados.novo_cliente) {
      idCliente = await crmClienteService.criarNaTransacao(client, ctx, dados.novo_cliente)
    } else {
      idCliente = campos.id_cliente
      if (!idCliente) throw erroNegocio(400, "Escolha o cliente da oportunidade ou cadastre um novo.")
      const cliente = await crmClienteRepository.buscar(ctx.idStartup, idCliente, client)
      if (!cliente) throw erroNegocio(400, "Cliente não encontrado nesta startup.")
    }

    const id = await crmOportunidadeRepository.criar(
      client,
      ctx.idStartup,
      { ...campos, id_cliente: idCliente, id_etapa: etapa.id_etapa },
      ctx.idUsuario
    )
    const criada = await crmOportunidadeRepository.buscar(ctx.idStartup, id, client)
    await crmHistorico.registrar(client, ctx, {
      tipo: "OPORTUNIDADE_CRIADA",
      idOportunidade: id,
      idCliente,
      descricao: `criou a oportunidade ${h.citar(criada.titulo)} na etapa ${h.citar(etapa.nome)}`,
      depois: retrato(criada),
    })
    return crmOportunidadeRepository.buscar(ctx.idStartup, id, client)
  })
}

/**
 * Edita a oportunidade. Cada campo alterado vira um evento proprio; trocar o
 * responsavel, o cliente ou a etapa tem tipo de evento proprio, com os nomes.
 */
async function atualizar(idStartup, idOportunidade, dados = {}, usuario) {
  const ctx = await acesso.exigirAcesso(idStartup, usuario)
  const campos = prepararCampos(dados, { edicao: true })
  const idEtapa = v.id(dados.id_etapa, "a etapa")

  return withTransaction(async (client) => {
    const atual = await exigirOportunidade(client, ctx, idOportunidade)
    const id = atual.id_oportunidade

    const difs = h.diferencas(atual, campos, h.CAMPOS_OPORTUNIDADE)
    const mudouResponsavel =
      "id_responsavel" in campos && (campos.id_responsavel ?? null) !== (atual.id_responsavel ?? null)
    const mudouCliente = "id_cliente" in campos && campos.id_cliente !== atual.id_cliente
    const mudouEtapa = Boolean(idEtapa) && idEtapa !== atual.id_etapa

    if (mudouResponsavel) await acesso.exigirMembro(ctx, campos.id_responsavel)
    let clienteNovo = null
    if (mudouCliente) {
      if (!campos.id_cliente) throw erroNegocio(400, "A oportunidade precisa de um cliente.")
      clienteNovo = await crmClienteRepository.buscar(ctx.idStartup, campos.id_cliente, client)
      if (!clienteNovo) throw erroNegocio(400, "Cliente não encontrado nesta startup.")
    }

    const gravar = {}
    for (const d of difs) gravar[d.campo] = campos[d.campo]
    if (mudouResponsavel) gravar.id_responsavel = campos.id_responsavel
    if (mudouCliente) gravar.id_cliente = campos.id_cliente
    await crmOportunidadeRepository.atualizar(client, ctx.idStartup, id, gravar)
    if (mudouCliente) {
      await crmTarefaRepository.trocarClienteDaOportunidade(client, ctx.idStartup, id, campos.id_cliente)
    }

    // Os eventos depois da troca de cliente levam o cliente NOVO: a partir
    // daqui a historia da oportunidade e a historia com ele.
    const idCliente = mudouCliente ? campos.id_cliente : atual.id_cliente

    if (mudouCliente) {
      await crmHistorico.registrar(client, ctx, {
        tipo: "CLIENTE_ASSOCIADO",
        idOportunidade: id,
        idCliente,
        descricao: `substituiu o cliente ${h.citar(atual.cliente_nome)} por ${h.citar(clienteNovo.nome)}`,
        antes: { id_cliente: atual.id_cliente, cliente: atual.cliente_nome },
        depois: { id_cliente: clienteNovo.id_cliente, cliente: clienteNovo.nome },
      })
    }

    for (const d of difs) {
      await crmHistorico.registrar(client, ctx, {
        tipo: "OPORTUNIDADE_ALTERADA",
        idOportunidade: id,
        idCliente,
        descricao: h.descreverCampoOportunidade(d),
        antes: { [d.campo]: d.antes },
        depois: { [d.campo]: d.depois },
        metadados: { campo: d.campo },
      })
    }

    if (mudouResponsavel) {
      const depois = await crmOportunidadeRepository.buscar(ctx.idStartup, id, client)
      await crmHistorico.registrar(client, ctx, {
        tipo: "RESPONSAVEL_ALTERADO",
        idOportunidade: id,
        idCliente,
        descricao: h.descreverResponsavel(atual.responsavel_nome, depois.responsavel_nome),
        antes: { id_responsavel: atual.id_responsavel, responsavel: atual.responsavel_nome },
        depois: { id_responsavel: depois.id_responsavel, responsavel: depois.responsavel_nome },
      })
    }

    if (mudouEtapa) await moverNaTransacao(client, ctx, atual, idEtapa, idCliente)

    return crmOportunidadeRepository.buscar(ctx.idStartup, id, client)
  })
}

/** O arrasto do kanban (e o "Mover para" do cartao). */
async function moverEtapa(idStartup, idOportunidade, dados = {}, usuario) {
  const ctx = await acesso.exigirAcesso(idStartup, usuario)
  const idEtapa = v.id(dados.id_etapa, "a etapa")
  if (!idEtapa) throw erroNegocio(400, "Informe a etapa de destino.")

  return withTransaction(async (client) => {
    const atual = await exigirOportunidade(client, ctx, idOportunidade)
    await moverNaTransacao(client, ctx, atual, idEtapa)
    return crmOportunidadeRepository.buscar(ctx.idStartup, atual.id_oportunidade, client)
  })
}

/**
 * Marca como ganha, com o valor EFETIVAMENTE vendido (que pode diferir do
 * estimado — sem informar, vale o estimado) e a data de fechamento (sem
 * informar, hoje no fuso da incubadora).
 *
 * O cliente que ainda era Lead passa a Cliente ativo: comprou. A mudanca vai
 * para o historico do cliente como qualquer outra.
 */
async function ganhar(idStartup, idOportunidade, dados = {}, usuario) {
  const ctx = await acesso.exigirAcesso(idStartup, usuario)
  const valorInformado = v.dinheiro(dados.valor_vendido ?? null, "o valor vendido")
  const fechamento = v.data(dados.fechamento_dt ?? null, "a data de fechamento") || v.hojeNoFuso()

  return withTransaction(async (client) => {
    const atual = await exigirOportunidade(client, ctx, idOportunidade)
    if (atual.situacao !== "ABERTA") throw erroNegocio(409, "Esta oportunidade já está encerrada.")

    const valor = valorInformado ?? atual.valor_estimado
    if (valor === null || valor === undefined) throw erroNegocio(400, "Informe o valor vendido.")

    const id = atual.id_oportunidade
    await crmOportunidadeRepository.encerrar(client, ctx.idStartup, id, {
      situacao: "GANHA",
      valorVendido: valor,
      fechamentoDt: fechamento,
      idUsuario: ctx.idUsuario,
    })

    const diferente = atual.valor_estimado !== null && Number(atual.valor_estimado) !== Number(valor)
    await crmHistorico.registrar(client, ctx, {
      tipo: "OPORTUNIDADE_GANHA",
      idOportunidade: id,
      idCliente: atual.id_cliente,
      descricao:
        `marcou a oportunidade como ganha: ${h.formatarMoeda(valor)}` +
        `${diferente ? ` (estimado ${h.formatarMoeda(atual.valor_estimado)})` : ""}` +
        `, fechada em ${h.formatarData(fechamento)}`,
      antes: { situacao: "ABERTA", valor_estimado: atual.valor_estimado },
      depois: { situacao: "GANHA", valor_vendido: valor, fechamento_dt: fechamento },
      metadados: { id_etapa: atual.id_etapa, etapa: atual.etapa_nome },
    })

    if (dados.cancelar_tarefas) {
      await cancelarTarefasAbertas(client, ctx, atual, "OPORTUNIDADE_GANHA", "ao encerrar a oportunidade")
    }

    const cliente = await crmClienteRepository.travar(client, ctx.idStartup, atual.id_cliente)
    if (cliente && cliente.status === "LEAD") {
      await crmClienteRepository.atualizar(client, ctx.idStartup, cliente.id_cliente, { ...cliente, status: "ATIVO" })
      await crmHistorico.registrar(client, ctx, {
        tipo: "CLIENTE_ALTERADO",
        idCliente: cliente.id_cliente,
        descricao: `alterou o status de Lead para Cliente ativo ao ganhar ${h.citar(atual.titulo)}`,
        antes: { status: "LEAD" },
        depois: { status: "ATIVO" },
        metadados: { campos: ["status"], automatico: true, id_oportunidade: id },
      })
    }

    return crmOportunidadeRepository.buscar(ctx.idStartup, id, client)
  })
}

/** Marca como perdida. O motivo e obrigatorio: sem ele, a perda nao ensina nada. */
async function perder(idStartup, idOportunidade, dados = {}, usuario) {
  const ctx = await acesso.exigirAcesso(idStartup, usuario)
  const motivo = v.texto(dados.motivo_perda ?? null, { rotulo: "o motivo da perda", max: 500, obrigatorio: true })
  const fechamento = v.data(dados.fechamento_dt ?? null, "a data de fechamento") || v.hojeNoFuso()

  return withTransaction(async (client) => {
    const atual = await exigirOportunidade(client, ctx, idOportunidade)
    if (atual.situacao !== "ABERTA") throw erroNegocio(409, "Esta oportunidade já está encerrada.")

    const id = atual.id_oportunidade
    await crmOportunidadeRepository.encerrar(client, ctx.idStartup, id, {
      situacao: "PERDIDA",
      fechamentoDt: fechamento,
      motivoPerda: motivo,
      idUsuario: ctx.idUsuario,
    })
    await crmHistorico.registrar(client, ctx, {
      tipo: "OPORTUNIDADE_PERDIDA",
      idOportunidade: id,
      idCliente: atual.id_cliente,
      descricao: `marcou a oportunidade como perdida. Motivo: ${h.citar(motivo, 200)}`,
      antes: { situacao: "ABERTA" },
      depois: { situacao: "PERDIDA", motivo_perda: motivo, fechamento_dt: fechamento },
      metadados: { id_etapa: atual.id_etapa, etapa: atual.etapa_nome },
    })

    if (dados.cancelar_tarefas) {
      await cancelarTarefasAbertas(client, ctx, atual, "OPORTUNIDADE_PERDIDA", "ao encerrar a oportunidade")
    }

    return crmOportunidadeRepository.buscar(ctx.idStartup, id, client)
  })
}

/**
 * Devolve ao funil. Na etapa informada; sem ela, na etapa em que estava (ou na
 * primeira, se aquela foi desativada).
 */
async function reabrir(idStartup, idOportunidade, dados = {}, usuario) {
  const ctx = await acesso.exigirAcesso(idStartup, usuario)
  const idEtapa = v.id(dados.id_etapa, "a etapa")

  return withTransaction(async (client) => {
    const atual = await exigirOportunidade(client, ctx, idOportunidade)
    if (atual.situacao === "ABERTA") throw erroNegocio(409, "Esta oportunidade já está aberta.")

    let destino = await crmEtapaRepository.buscar(ctx.idStartup, idEtapa || atual.id_etapa, client)
    if ((!destino || !destino.ativo) && idEtapa) throw erroNegocio(400, "Etapa inválida para este funil.")
    if (!destino || !destino.ativo) destino = await crmEtapaRepository.primeiraAtiva(ctx.idStartup, client)
    if (!destino) throw erroNegocio(400, "O funil não tem nenhuma etapa ativa.")

    const id = atual.id_oportunidade
    await crmOportunidadeRepository.reabrir(client, ctx.idStartup, id, destino.id_etapa)
    await crmHistorico.registrar(client, ctx, {
      tipo: "OPORTUNIDADE_REABERTA",
      idOportunidade: id,
      idCliente: atual.id_cliente,
      descricao: `reabriu a oportunidade na etapa ${h.citar(destino.nome)}`,
      antes: {
        situacao: atual.situacao,
        valor_vendido: atual.valor_vendido,
        fechamento_dt: atual.fechamento_dt,
        motivo_perda: atual.motivo_perda,
      },
      depois: { situacao: "ABERTA", id_etapa: destino.id_etapa, etapa: destino.nome },
    })
    return crmOportunidadeRepository.buscar(ctx.idStartup, id, client)
  })
}

/**
 * Exclusao logica: some do funil e das listas, e fica no banco com o historico
 * inteiro. As tarefas abertas dela sao canceladas, com evento.
 */
async function excluir(idStartup, idOportunidade, usuario) {
  const ctx = await acesso.exigirAcesso(idStartup, usuario)
  await withTransaction(async (client) => {
    const atual = await exigirOportunidade(client, ctx, idOportunidade)
    await cancelarTarefasAbertas(client, ctx, atual, "OPORTUNIDADE_EXCLUIDA", "ao excluir a oportunidade")
    await crmOportunidadeRepository.excluir(client, ctx.idStartup, atual.id_oportunidade, ctx.idUsuario)
    await crmHistorico.registrar(client, ctx, {
      tipo: "OPORTUNIDADE_EXCLUIDA",
      idOportunidade: atual.id_oportunidade,
      idCliente: atual.id_cliente,
      descricao: `excluiu a oportunidade ${h.citar(atual.titulo)}`,
      antes: { titulo: atual.titulo, situacao: atual.situacao, etapa: atual.etapa_nome },
    })
  })
}

/** Anotacao, contato ou reuniao registrados na oportunidade. */
async function registrarAtividade(idStartup, idOportunidade, dados, usuario) {
  const ctx = await acesso.exigirAcesso(idStartup, usuario)
  const atividade = crmHistorico.prepararAtividade(dados)
  return withTransaction(async (client) => {
    const atual = await exigirOportunidade(client, ctx, idOportunidade)
    const idEvento = await crmHistorico.registrar(client, ctx, {
      ...atividade,
      idOportunidade: atual.id_oportunidade,
      idCliente: atual.id_cliente,
    })
    return { id_evento: idEvento }
  })
}

module.exports = {
  listar,
  buscar,
  historico,
  criar,
  atualizar,
  moverEtapa,
  ganhar,
  perder,
  reabrir,
  excluir,
  registrarAtividade,
}
