/**
 * O MOTOR DE PONTOS e as leituras do engajamento (ranking, painel, extrato).
 *
 * O que pode e o que nao pode virar ponto esta em engajamento/padroes.js; o
 * porque, no cabecalho da migracao 017. Em uma linha: PONTO mede PARTICIPACAO
 * e nasce de fato registrado por OUTRA pessoa; evolucao e protagonismo sao
 * SELO, que vale zero ponto (seloService).
 *
 * TRES PROPRIEDADES QUE O MOTOR PRECISA TER, E POR QUE:
 *
 *   1. IDEMPOTENTE. Toda pontuacao automatica e gravada pela chave natural do
 *      fato (quem, por qual acao, por causa de qual evento). Lista de chamada
 *      e corrigida o tempo todo, e cada correcao reenvia as mesmas pessoas —
 *      somar em vez de sincronizar inflaria o ranking a cada clique.
 *
 *   2. REVERSIVEL. Desmarcar a presenca apaga o ponto. Sem isso, o unico jeito
 *      de corrigir um engano seria mexer no banco.
 *
 *   3. NAO PODE DERRUBAR O ATO PRINCIPAL. Marcar presenca e o trabalho da
 *      coordenacao; pontuar e consequencia. Por isso as funcoes chamadas por
 *      outros modulos engolem o proprio erro e apenas logam: um ranking
 *      desatualizado se conserta com um recalculo, uma lista de chamada que
 *      falhou no meio nao.
 */
const engajamentoRepository = require("../repositories/engajamentoRepository")
const rbacService = require("./rbacService")
const auditLogService = require("./auditLogService")
const { erroNegocio } = require("../utils/erros")
const { NAO_PONTUAM, MOTIVO_NAO_PONTUAM } = require("../engajamento/padroes")

// ---------------------------------------------------------------------------
// DATAS
//
// Tudo aqui trabalha com 'AAAA-MM-DD' em texto, e nao com Date: a temporada e
// o teto sao janelas de CALENDARIO, e converter para instante traria fuso
// horario para uma conta que nao tem hora nenhuma — um evento das 21h viraria
// do dia seguinte e cairia na temporada errada.
// ---------------------------------------------------------------------------

/** Normaliza Date|string para 'AAAA-MM-DD' (componentes locais, sem UTC). */
function paraDataIso(valor) {
  if (!valor) return null
  if (typeof valor === "string") return valor.slice(0, 10)
  const d = valor instanceof Date ? valor : new Date(valor)
  if (Number.isNaN(d.getTime())) return null
  const mes = String(d.getMonth() + 1).padStart(2, "0")
  const dia = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${mes}-${dia}`
}

/** Primeiro e ultimo dia do mes de uma data. */
function janelaDoMes(dataIso) {
  const [ano, mes] = dataIso.split("-").map(Number)
  const ultimo = new Date(ano, mes, 0).getDate()
  return {
    de: `${dataIso.slice(0, 7)}-01`,
    ate: `${dataIso.slice(0, 7)}-${String(ultimo).padStart(2, "0")}`,
  }
}

// ---------------------------------------------------------------------------
// TETO
// ---------------------------------------------------------------------------

/**
 * Quanto este lancamento vale DE FATO, depois do teto da acao.
 *
 * O teto e o que impede a acao repetivel de virar fazenda de pontos: coworking
 * a 3 pontos sem limite premiaria quem mora no predio. O excedente NAO some do
 * extrato — vira uma linha de 0 marcada como limitada, porque "voce esteve la,
 * mas o teto do mes ja foi atingido" e uma resposta, e a participacao
 * desaparecer nao e.
 *
 * `ignorarOrigem` tira da conta o proprio lancamento que esta sendo
 * regravado. Sem isso, cada remarcacao de presenca empurraria o mesmo ponto
 * para mais perto do teto ate zera-lo sozinho.
 *
 * TETO POR TEMPORADA SEM TEMPORADA nao tem janela: o fato fica fora do ranking
 * de qualquer jeito, entao vale integral no historico em vez de virar zero
 * inexplicavel.
 */
async function aplicarTeto(acao, { idTenant, idUsuario, dataIso, temporada, ignorarOrigem }) {
  const base = acao.pontos
  if (!acao.teto_pontos || !acao.teto_periodo) return { pontos: base, limitado: false }

  let janela
  if (acao.teto_periodo === "MES") {
    janela = janelaDoMes(dataIso)
  } else if (temporada) {
    janela = { de: paraDataIso(temporada.inicio_dt), ate: paraDataIso(temporada.fim_dt) }
  } else {
    return { pontos: base, limitado: false }
  }

  const acumulado = await engajamentoRepository.somaNoPeriodo(
    idTenant,
    idUsuario,
    acao.chave,
    janela.de,
    janela.ate,
    ignorarOrigem
  )
  const restante = Math.max(0, acao.teto_pontos - acumulado)
  const pontos = Math.min(base, restante)
  return { pontos, limitado: pontos < base }
}

// ---------------------------------------------------------------------------
// GATILHO: PRESENCA EM EVENTO
// ---------------------------------------------------------------------------

/** Pontua (ou repontua) os presentes de um evento. */
async function pontuarPresentes(evento, ids) {
  if (!ids.length) return

  const acao = await engajamentoRepository.acaoDaCategoria(evento.id_tenant, evento.categoria)
  if (!acao) {
    // Categoria que a incubadora decidiu NAO pontuar (ou acao desativada). O
    // opt-in e explicito, e o que porventura tenha sido pontuado antes sai.
    await engajamentoRepository.removerPontosDeEventoParaUsuarios(evento.id_evento, ids)
    return
  }

  const dataIso = paraDataIso(evento.inicio_ts)
  const temporada = await engajamentoRepository.temporadaDaData(evento.id_tenant, dataIso)
  // Temporada encerrada = resultado congelado. Nao recebe ponto novo; desfazer
  // continua valendo (a remocao acontece antes de chegar aqui).
  if (temporada?.encerrada) return

  const ligas = await engajamentoRepository.ligasDeUsuarios(evento.id_tenant, ids)

  for (const idUsuario of ids) {
    const liga = ligas.get(idUsuario)
    // Sem liga = admin da incubadora, ou pessoa sem startup ativa: nao disputa.
    // A acao tambem pode ser restrita a uma liga so.
    if (!liga || (acao.liga && acao.liga !== liga)) {
      await engajamentoRepository.removerPontosDeEventoParaUsuarios(evento.id_evento, [idUsuario])
      continue
    }

    const { pontos, limitado } = await aplicarTeto(acao, {
      idTenant: evento.id_tenant,
      idUsuario,
      dataIso,
      temporada,
      ignorarOrigem: { origem_tipo: "EVENTO", origem_id: evento.id_evento },
    })

    await engajamentoRepository.sincronizarPonto({
      id_tenant: evento.id_tenant,
      id_temporada: temporada?.id_temporada ?? null,
      id_usuario: idUsuario,
      liga,
      chave_acao: acao.chave,
      pontos,
      limitado_por_teto: limitado,
      origem_tipo: "EVENTO",
      origem_id: evento.id_evento,
      ocorrido_dt: dataIso,
    })
  }
}

/**
 * O ponto do MENTOR dono da atividade — o outro lado da presenca.
 *
 * "Mentoria realizada" e evento com mentor dono e AO MENOS UM PRESENTE. Nao e
 * o mentor que declara ter atendido: e a lista de chamada fechada pela
 * coordenacao que prova que a mentoria aconteceu. E por isso que este
 * recalculo roda a cada marcacao de presenca — inclusive quando a ultima
 * presenca e desmarcada e a mentoria deixa de ter acontecido.
 *
 * O mentor NAO entra na lista de presentes: o publico do evento vem de
 * `startup_membros`, e ele nao e membro de startup nenhuma.
 */
async function recalcularMentoria(evento) {
  const acao = await engajamentoRepository.acaoDeMentoria(evento.id_tenant)
  if (!acao) return

  const limpar = () =>
    engajamentoRepository.removerPontosDoEventoPorAcao(evento.id_evento, acao.chave)

  if (!evento.id_usuario_mentor) return limpar()

  const presentes = await engajamentoRepository.contarPresentes(evento.id_evento)
  if (presentes === 0) return limpar()

  const liga = await engajamentoRepository.ligaDoUsuario(evento.id_tenant, evento.id_usuario_mentor)
  if (!liga || (acao.liga && acao.liga !== liga)) return limpar()

  // Apaga o que houver de OUTRO mentor no mesmo evento (o responsavel mudou).
  await limpar()

  const dataIso = paraDataIso(evento.inicio_ts)
  const temporada = await engajamentoRepository.temporadaDaData(evento.id_tenant, dataIso)
  if (temporada?.encerrada) return

  const { pontos, limitado } = await aplicarTeto(acao, {
    idTenant: evento.id_tenant,
    idUsuario: evento.id_usuario_mentor,
    dataIso,
    temporada,
    ignorarOrigem: { origem_tipo: "EVENTO", origem_id: evento.id_evento },
  })

  await engajamentoRepository.sincronizarPonto({
    id_tenant: evento.id_tenant,
    id_temporada: temporada?.id_temporada ?? null,
    id_usuario: evento.id_usuario_mentor,
    liga,
    chave_acao: acao.chave,
    pontos,
    limitado_por_teto: limitado,
    origem_tipo: "EVENTO",
    origem_id: evento.id_evento,
    ocorrido_dt: dataIso,
  })
}

/**
 * Chamada por eventoService.marcarPresenca. NAO LANCA: ver a propriedade 3 no
 * cabecalho.
 *
 * Carrega o proprio evento em vez de receber o objeto da tela para nao
 * depender do formato de quem chama — o motor precisa de quatro campos, e
 * pedi-los ao chamador amarraria os dois modulos.
 */
async function sincronizarPresenca(idEvento, idsUsuarios, presente) {
  try {
    const evento = await engajamentoRepository.buscarEventoParaPontuacao(idEvento)
    if (!evento) return

    const ids = [...new Set((idsUsuarios ?? []).map(Number).filter(Boolean))]

    if (presente) {
      await pontuarPresentes(evento, ids)
    } else {
      await engajamentoRepository.removerPontosDeEventoParaUsuarios(idEvento, ids)
    }

    await recalcularMentoria(evento)
  } catch (err) {
    console.error(`Falha ao sincronizar pontos do evento ${idEvento}:`, err)
  }
}

/**
 * Reprocessa o evento inteiro. Usada quando o evento MUDA (categoria, data ou
 * responsavel): sem isso, mudar "Workshop" para "Prazo" deixaria de pra sempre
 * os pontos de uma categoria que a incubadora nao pontua.
 *
 * Apaga tudo do evento e refaz a partir da lista de presenca atual — e a forma
 * mais simples de garantir que o resultado dependa so do estado de agora, e
 * nao da ordem em que as edicoes aconteceram.
 */
async function recalcularEvento(idEvento) {
  try {
    const evento = await engajamentoRepository.buscarEventoParaPontuacao(idEvento)
    if (!evento) return
    await engajamentoRepository.removerPontosDoEvento(idEvento)
    const presentes = await engajamentoRepository.listarPresentesDoEvento(idEvento)
    await pontuarPresentes(evento, presentes)
    await recalcularMentoria(evento)
  } catch (err) {
    console.error(`Falha ao recalcular pontos do evento ${idEvento}:`, err)
  }
}

/** O evento deixou de existir: os pontos que ele deu vao junto. */
async function removerPontosDoEvento(idEvento) {
  try {
    await engajamentoRepository.removerPontosDoEvento(idEvento)
  } catch (err) {
    console.error(`Falha ao remover pontos do evento ${idEvento}:`, err)
  }
}

// ---------------------------------------------------------------------------
// GATILHO: LANCAMENTO MANUAL
// ---------------------------------------------------------------------------

/**
 * Lancamento da coordenacao: coworking, indicacao, acao da INNE — o que o
 * sistema nao tem como saber sozinho.
 *
 * SO ACOES `MANUAL`. Lancar a mao uma acao de presenca burlaria a regra que
 * sustenta o modulo inteiro: ponto de presenca nasce de check-in marcado na
 * lista de chamada, que e verificavel e reversivel. Um caminho paralelo aqui
 * transformaria o ranking em "quem a coordenacao decidiu premiar".
 */
async function lancar(idTenant, dados, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, "engajamento.pontos.lancar")

  const idsUsuarios = [...new Set((dados.ids_usuarios ?? []).map(Number).filter(Boolean))]
  if (!idsUsuarios.length) throw erroNegocio(400, "Selecione ao menos uma pessoa.")

  const acao = await engajamentoRepository.buscarAcao(idTenant, dados.chave_acao)
  if (!acao) throw erroNegocio(404, "Ação de engajamento não encontrada.")
  if (!acao.ativo) throw erroNegocio(409, "Esta ação está desativada.")
  if (acao.gatilho !== "MANUAL") {
    throw erroNegocio(
      409,
      "Esta ação é pontuada automaticamente pela presença no evento e não pode ser lançada à mão."
    )
  }

  const dataIso = paraDataIso(dados.ocorrido_dt) ?? paraDataIso(new Date())
  const temporada = await engajamentoRepository.temporadaDaData(idTenant, dataIso)
  if (temporada?.encerrada) {
    throw erroNegocio(409, `A temporada "${temporada.nome}" está encerrada e não recebe lançamentos.`)
  }

  const ligas = await engajamentoRepository.ligasDeUsuarios(idTenant, idsUsuarios)

  const lancados = []
  const ignorados = []
  for (const idUsuario of idsUsuarios) {
    const liga = ligas.get(idUsuario)
    if (!liga) {
      ignorados.push({ id_usuario: idUsuario, motivo: "Não participa de nenhuma liga." })
      continue
    }
    if (acao.liga && acao.liga !== liga) {
      ignorados.push({ id_usuario: idUsuario, motivo: `Ação restrita à liga ${acao.liga}.` })
      continue
    }

    const { pontos, limitado } = await aplicarTeto(acao, {
      idTenant,
      idUsuario,
      dataIso,
      temporada,
    })

    lancados.push(
      await engajamentoRepository.lancarPontoManual({
        id_tenant: idTenant,
        id_temporada: temporada?.id_temporada ?? null,
        id_usuario: idUsuario,
        liga,
        chave_acao: acao.chave,
        pontos,
        limitado_por_teto: limitado,
        lancado_por: usuario?.id,
        observacao: dados.observacao?.trim() || null,
        ocorrido_dt: dataIso,
      })
    )
  }

  await auditLogService.registrar({
    idTenant,
    idUsuario: usuario?.id,
    acao: "CRIAR",
    entidade: "engajamento_ponto",
    entidadeId: acao.chave,
    descricao: `Lançou "${acao.rotulo}" para ${lancados.length} pessoa(s) em ${dataIso}.`,
    dadosDepois: { chave_acao: acao.chave, ocorrido_dt: dataIso, lancados: lancados.length },
  })

  return { lancados, ignorados }
}

/**
 * Estorna um lancamento.
 *
 * SO OS MANUAIS. O ponto automatico e reflexo de um fato registrado em outro
 * lugar: apaga-lo aqui faria o extrato discordar da lista de chamada, e a
 * proxima marcacao de presenca o traria de volta. O caminho certo e desmarcar
 * a presenca — e a mensagem diz isso.
 */
async function estornar(idPonto, usuario) {
  const ponto = await engajamentoRepository.buscarPonto(idPonto)
  if (!ponto) throw erroNegocio(404, "Lançamento não encontrado.")
  await rbacService.garantirPermissao(ponto.id_tenant, usuario, "engajamento.pontos.estornar")

  if (ponto.origem_tipo !== "MANUAL") {
    throw erroNegocio(
      409,
      "Este ponto veio da presença registrada no evento. Para desfazê-lo, desmarque a presença na lista de chamada."
    )
  }

  await engajamentoRepository.excluirPonto(idPonto)
  await auditLogService.registrar({
    idTenant: ponto.id_tenant,
    idUsuario: usuario?.id,
    acao: "EXCLUIR",
    entidade: "engajamento_ponto",
    entidadeId: String(idPonto),
    descricao: `Estornou ${ponto.pontos} ponto(s) de "${ponto.chave_acao}".`,
    dadosAntes: ponto,
  })
  return { estornado: true }
}

// ---------------------------------------------------------------------------
// LEITURAS
// ---------------------------------------------------------------------------

/** O degrau atual e o proximo, dada a escada da liga e o total da pessoa. */
function situarNaEscada(niveis, pontos) {
  const escada = [...niveis].sort((a, b) => a.pontos_min - b.pontos_min)
  let atual = null
  let proximo = null
  for (const nivel of escada) {
    if (pontos >= nivel.pontos_min) atual = nivel
    else if (!proximo) proximo = nivel
  }
  return {
    nivel: atual,
    proximo_nivel: proximo,
    faltam: proximo ? Math.max(0, proximo.pontos_min - pontos) : 0,
  }
}

/** Resolve a temporada pedida, ou a corrente. */
async function resolverTemporada(idTenant, idTemporada) {
  if (idTemporada) return engajamentoRepository.buscarTemporada(idTenant, idTemporada)
  return engajamentoRepository.temporadaCorrente(idTenant)
}

/**
 * O placar da incubadora: as duas ligas de pessoas e o placar por startup.
 *
 * As tres leituras vem juntas porque a tela mostra as tres em abas — tres
 * requisicoes so multiplicariam o custo da mesma resolucao de temporada.
 */
async function ranking(idTenant, { idTemporada, incluirStartups = true } = {}, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, "engajamento.ranking.visualizar")

  const temporada = await resolverTemporada(idTenant, idTemporada)
  const id = temporada?.id_temporada ?? null

  const [incubados, mentores, startups, niveis, temporadas] = await Promise.all([
    engajamentoRepository.ranking(idTenant, id, "INCUBADO"),
    engajamentoRepository.ranking(idTenant, id, "MENTOR"),
    incluirStartups ? engajamentoRepository.rankingStartups(idTenant, id) : [],
    engajamentoRepository.listarNiveis(idTenant),
    engajamentoRepository.listarTemporadas(idTenant),
  ])

  const escadas = {
    INCUBADO: niveis.filter((n) => n.liga === "INCUBADO"),
    MENTOR: niveis.filter((n) => n.liga === "MENTOR"),
  }
  const comNivel = (linhas, liga) =>
    linhas.map((linha, i) => ({
      ...linha,
      posicao: i + 1,
      ...situarNaEscada(escadas[liga], linha.pontos),
    }))

  return {
    temporada,
    temporadas,
    niveis: escadas,
    incubados: comNivel(incubados, "INCUBADO"),
    mentores: comNivel(mentores, "MENTOR"),
    startups,
  }
}

/**
 * O painel da PROPRIA pessoa: liga, pontos, nivel, posicao e extrato.
 *
 * NAO PASSA POR RBAC — e dado do proprio usuario, como /jornada e o Perfil.
 * Exigir chave para alguem ver o proprio progresso so criaria mais um jeito de
 * tranca-la fora do sistema.
 *
 * Vem com `acoes` e `nao_pontuam` porque a regra tem de estar visivel para
 * quem joga: sem isso, a primeira pessoa que entregar um passo da trilha e nao
 * vir ponto nenhum vai concluir que o sistema esta quebrado.
 */
async function meuPainel(idTenant, { idTemporada } = {}, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")

  const temporada = await resolverTemporada(idTenant, idTemporada)
  const id = temporada?.id_temporada ?? null
  const liga = await engajamentoRepository.ligaDoUsuario(idTenant, usuario.id)

  const [total, extrato, acoes, temporadas] = await Promise.all([
    engajamentoRepository.totalDoUsuario(idTenant, usuario.id, id),
    engajamentoRepository.listarExtrato(idTenant, usuario.id, id, 50),
    engajamentoRepository.listarAcoes(idTenant),
    engajamentoRepository.listarTemporadas(idTenant),
  ])

  let posicao = null
  let escada = []
  if (liga) {
    const [colocacao, niveis] = await Promise.all([
      engajamentoRepository.posicaoDoUsuario(idTenant, usuario.id, id, liga),
      engajamentoRepository.listarNiveis(idTenant, liga),
    ])
    posicao = colocacao
    escada = niveis
  }

  return {
    temporada,
    temporadas,
    liga,
    pontos: total.pontos,
    participacoes: total.participacoes,
    posicao: posicao?.posicao ?? null,
    competidores: posicao?.competidores ?? 0,
    escada,
    ...situarNaEscada(escada, total.pontos),
    extrato,
    acoes,
    nao_pontuam: NAO_PONTUAM,
    motivo_nao_pontuam: MOTIVO_NAO_PONTUAM,
  }
}

/**
 * Quem pode receber ponto ou selo — a lista das duas telas de acao.
 *
 * AUTORIZACAO COMPOSTA: basta UMA das duas chaves de acao. Quem so lanca
 * participacao (o coworking) e quem so concede selo sao perfis diferentes, e
 * exigir as duas obrigaria a dar a cada um o poder do outro so para conseguir
 * abrir a lista de pessoas.
 *
 * Nao serve `engajamento.ranking.visualizar`: o ranking mostra quem pontuou;
 * isto aqui e a lista NOMINAL de todo mundo da incubadora, que e outra coisa.
 */
async function participantes(idTenant, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  const [podeLancar, podeConceder] = await Promise.all([
    rbacService.temPermissao(idTenant, usuario, "engajamento.pontos.lancar"),
    rbacService.temPermissao(idTenant, usuario, "engajamento.selos.conceder"),
  ])
  if (!podeLancar && !podeConceder) {
    throw erroNegocio(403, "Voce nao tem permissao para realizar esta acao.")
  }
  return { participantes: await engajamentoRepository.listarParticipantes(idTenant) }
}

/**
 * Extrato de alguem. O proprio nao passa por RBAC; o dos outros exige chave —
 * e o historico de participacao de uma pessoa identificada.
 */
async function extrato(idTenant, idUsuario, { idTemporada } = {}, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  const alvo = Number(idUsuario) || usuario.id
  if (alvo !== usuario.id) {
    await rbacService.garantirPermissao(idTenant, usuario, "engajamento.pontos.visualizar")
  }
  const temporada = await resolverTemporada(idTenant, idTemporada)
  return {
    temporada,
    extrato: await engajamentoRepository.listarExtrato(
      idTenant,
      alvo,
      temporada?.id_temporada ?? null
    ),
  }
}

module.exports = {
  // Gatilhos (chamados por outros modulos — nao lancam)
  sincronizarPresenca,
  recalcularEvento,
  removerPontosDoEvento,

  // Lancamento da coordenacao
  lancar,
  estornar,

  // Leituras
  ranking,
  meuPainel,
  extrato,
  participantes,

  // Exportado para teste/reuso interno
  situarNaEscada,
  paraDataIso,
}
