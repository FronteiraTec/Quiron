/**
 * Service das REUNIOES POR VIDEO (regra de negocio). Desenho completo em
 * docs/reunioes.md. Aqui mora a reuniao e a sala (Etapa 3); a gravacao, o
 * consentimento e a transcricao (Etapa 4) moram no reuniaoGravacaoService, e
 * as regras de quem alcanca a reuniao, no reuniaoAcesso.
 *
 * TODA REUNIAO E UM EVENTO DA AGENDA. Criar a reuniao cria o evento na mesma
 * transacao, e titulo, horario, categoria e startup moram la. O PUBLICO desse
 * evento sao os convidados, e nao as startups (ver eventoRepository): a
 * mentoria marcada com tres pessoas nao vai para a agenda da incubadora toda.
 *
 * QUEM ENXERGA O QUE — o desenho de Tarefas:
 *
 *   `reunioes.reunioes.visualizar` da TODAS as reunioes da incubadora: e a
 *   visao de quem coordena.
 *
 *   SEM ela, a pessoa ve as reunioes para as quais foi convidada, e mais nada.
 *   Isso NAO passa por permissao: ser chamado para uma conversa e como receber
 *   uma tarefa — exigir chave para ver o convite so criaria um jeito novo de
 *   deixar alguem de fora da propria reuniao.
 *
 *   Quem nao alcanca uma reuniao recebe 404, e nao 403: o id e sequencial, e um
 *   403 confirmaria que ha uma mentoria ali.
 *
 * QUEM MEXE NO QUE — um degrau acima:
 *
 *   O ANFITRIAO (quem criou) sempre edita, cancela, exclui e encerra a propria
 *   reuniao, com chave ou sem. As chaves `editar` e `excluir` sao para as
 *   reunioes DOS OUTROS — a coordenacao que precisa remarcar a mentoria de um
 *   mentor, ou fechar uma sala que ficou aberta.
 *
 * QUEM ENTRA NA SALA: so convidado. Nem a chave `visualizar` da token — ver a
 * reuniao na lista nao e o mesmo que estar nela.
 */
const { withTransaction } = require("../config/db")
const reuniaoRepository = require("../repositories/reuniaoRepository")
const eventoRepository = require("../repositories/eventoRepository")
const agendaConfigRepository = require("../repositories/agendaConfigRepository")
const tenantRepository = require("../repositories/tenantRepository")
const startupRepository = require("../repositories/startupRepository")
const usuarioRepository = require("../repositories/usuarioRepository")
const rbacService = require("./rbacService")
const auditLogService = require("./auditLogService")
const notificacaoService = require("./notificacaoService")
const googleAgendaService = require("./googleAgendaService")
const engajamentoService = require("./engajamentoService")
const livekit = require("../reunioes/livekit")
const { erroNegocio } = require("../utils/erros")
const { CHAVES, garantirMembro, enxergaTodas, podeComChave, carregarVisivel } = require("./reuniaoAcesso")
const gravacaoService = require("./reuniaoGravacaoService")

const { CRIAR, EDITAR, EXCLUIR } = CHAVES

/** As categorias da agenda que uma reuniao pode ter. */
const CATEGORIAS = ["REUNIAO", "MENTORIA"]
const CATEGORIA_PADRAO = "REUNIAO"

/** A sala abre este tanto antes do horario marcado. */
const MINUTOS_ANTES = 15

/** Teto de convidados. Reuniao com mais gente que isso e palestra. */
const MAX_CONVIDADOS = 50

/** O que vai no campo "local" do evento (aparece na Agenda e no Google). */
const LOCAL = "Online — sala de vídeo do Quíron"

const STATUS = ["AGENDADA", "EM_ANDAMENTO", "ENCERRADA", "CANCELADA"]
const ABERTAS = ["AGENDADA", "EM_ANDAMENTO"]

// ---------------------------------------------------------------------------
// PREPARO DOS DADOS
// ---------------------------------------------------------------------------

/** Texto vazio vira NULL; longo demais e erro, e nao corte silencioso. */
function texto(valor, { rotulo, max, obrigatorio = false }) {
  const limpo = String(valor ?? "").trim()
  if (!limpo) {
    if (obrigatorio) throw erroNegocio(400, `Informe ${rotulo}.`)
    return null
  }
  if (max && limpo.length > max) {
    throw erroNegocio(400, `O campo ${rotulo} aceita no máximo ${max} caracteres.`)
  }
  return limpo
}

/**
 * Um horario de parede, no formato que evento.inicio_ts guarda.
 *
 * Aceita "AAAA-MM-DDTHH:mm" (o que o <input type="datetime-local"> devolve) e
 * com segundos. Recusa o resto em vez de deixar o Postgres adivinhar: um
 * horario errado por um fuso inteiro e pior que um erro de validacao.
 */
function horarioDeParede(valor, { rotulo, obrigatorio = false }) {
  if (valor === null || valor === undefined || valor === "") {
    if (obrigatorio) throw erroNegocio(400, `Informe ${rotulo}.`)
    return null
  }
  const Rotulo = rotulo.charAt(0).toUpperCase() + rotulo.slice(1)
  const m = String(valor).trim().match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (!m) throw erroNegocio(400, `${Rotulo} está num formato inválido. Use AAAA-MM-DDTHH:mm.`)
  const [, ano, mes, dia, hora, minuto, segundo = "00"] = m
  // 31/02 e 25:00 passariam pelo regex; o round-trip pelo Date (em UTC, so
  // como calendario) pega o que nao existe.
  const d = new Date(Date.UTC(+ano, +mes - 1, +dia, +hora, +minuto, +segundo))
  if (
    d.getUTCFullYear() !== +ano || d.getUTCMonth() !== +mes - 1 || d.getUTCDate() !== +dia ||
    d.getUTCHours() !== +hora || d.getUTCMinutes() !== +minuto
  ) {
    throw erroNegocio(400, `${Rotulo} é uma data que não existe.`)
  }
  return `${ano}-${mes}-${dia}T${hora}:${minuto}:${segundo}`
}

/**
 * Valida o corpo de uma reuniao contra a incubadora dela.
 *
 * Uma funcao so para criar e editar, pela razao de sempre: duas copias
 * garantiriam que uma regra nova entrasse numa e faltasse na outra.
 *
 * `participantes` undefined = "nao mexi na lista" (so na edicao); a criacao
 * sempre manda, nem que vazia.
 */
async function prepararDados(idTenant, dados, idAnfitriao) {
  const titulo = texto(dados.titulo, { rotulo: "o título", max: 150, obrigatorio: true })
  const descricao = texto(dados.descricao, { rotulo: "a descrição", max: 5000 })

  const categoria = dados.categoria || CATEGORIA_PADRAO
  if (!CATEGORIAS.includes(categoria)) {
    throw erroNegocio(400, "A reunião precisa ser da categoria Reunião ou Mentoria.")
  }
  // A categoria e da incubadora (migracao 008): pode ter sido desativada.
  const cat = await agendaConfigRepository.buscarCategoria(idTenant, categoria)
  if (!cat) throw erroNegocio(400, "Esta incubadora não tem a categoria escolhida na agenda.")
  if (!cat.ativo) throw erroNegocio(400, `A categoria "${cat.rotulo}" está desativada na agenda.`)

  const inicioTs = horarioDeParede(dados.inicioTs, { rotulo: "o início", obrigatorio: true })
  const fimTs = horarioDeParede(dados.fimTs, { rotulo: "o fim" })
  if (fimTs && fimTs <= inicioTs) throw erroNegocio(400, "O fim precisa ser depois do início.")

  // A startup e opcional; quando vem, e desta incubadora. A FK composta ja
  // recusaria a de outra — conferir antes existe para a resposta ser um 400
  // que explica, e nao um 500 de constraint.
  const idStartup = dados.idStartup ? Number(dados.idStartup) : null
  if (idStartup) {
    const startup = await startupRepository.buscarPorId(idStartup)
    if (!startup || Number(startup.id_tenant) !== Number(idTenant)) {
      throw erroNegocio(400, "Startup inválida para esta incubadora.")
    }
  }

  // Cada convidado precisa ser gente ATIVA desta incubadora. A FK aponta para
  // `usuarios`, que e global: sem esta checagem daria para chamar alguem de
  // outra incubadora — e o convite levaria junto o titulo da mentoria.
  let participantes
  if (dados.participantes !== undefined) {
    if (!Array.isArray(dados.participantes)) throw erroNegocio(400, "Convidados inválidos.")
    const ids = [
      ...new Set(
        dados.participantes
          .map((p) => Number(p?.id_usuario ?? p))
          .filter((id) => Number.isInteger(id) && id > 0 && id !== Number(idAnfitriao))
      ),
    ]
    if (ids.length > MAX_CONVIDADOS) {
      throw erroNegocio(400, `Uma reunião aceita no máximo ${MAX_CONVIDADOS} convidados.`)
    }
    for (const id of ids) {
      const vinculo = await tenantRepository.buscarUsuarioVinculado(idTenant, id)
      if (!vinculo || !vinculo.ativo) {
        throw erroNegocio(400, "Todo convidado precisa ser um usuário ativo desta incubadora.")
      }
    }
    participantes = ids
  }

  const gravarAudio = dados.gravarAudio === undefined ? true : dados.gravarAudio === true

  // Numa MENTORIA, o anfitriao mentor (ou da coordenacao) e o responsavel do
  // evento. E dai que sai o historico do mentor na tela /mentores (migracao
  // 016) — sem isto, a mentoria feita aqui nao contaria para ele.
  let idUsuarioMentor = null
  if (categoria === "MENTORIA") {
    const papel = await tenantRepository.buscarPapel(idTenant, idAnfitriao)
    if (papel === "mentor" || papel === "admin") idUsuarioMentor = Number(idAnfitriao)
  }

  return { titulo, descricao, categoria, inicioTs, fimTs, idStartup, participantes, gravarAudio, idUsuarioMentor }
}

// ---------------------------------------------------------------------------
// ACESSO
// ---------------------------------------------------------------------------

/** Sem as variaveis do LiveKit nao ha sala, e o modulo nao aparece. */
function exigirModulo() {
  if (!livekit.configurado()) {
    throw erroNegocio(
      503,
      "As reuniões por vídeo não estão configuradas nesta instalação.",
      "REUNIOES_INDISPONIVEIS"
    )
  }
}

/** O nome da sala nao sai da API: so o token precisa dele. */
function semSala({ sala, ...resto }) {
  return resto
}

/**
 * A reuniao no formato da tela de detalhe: os convidados, as sessoes (para
 * quem pode ver quem entrou e saiu) e o que esta pessoa pode fazer — para o
 * front nao reimplementar estas regras e oferecer botao que daria 403.
 */
async function montarDetalhe(reuniao, participante, usuario) {
  const [podeEditar, podeExcluir, tudo] = await Promise.all([
    podeComChave(reuniao, usuario, EDITAR),
    podeComChave(reuniao, usuario, EXCLUIR),
    enxergaTodas(reuniao.id_tenant, usuario),
  ])
  const aberta = ABERTAS.includes(reuniao.status)
  const participantes = await reuniaoRepository.listarParticipantes(reuniao.id_reuniao)
  // Quem entrou e saiu, e quando, e informacao de gestao: do anfitriao e de
  // quem coordena. Os demais convidados veem quem esta na sala agora (na_sala).
  const sessoes = podeEditar || tudo ? await reuniaoRepository.listarSessoes(reuniao.id_reuniao) : null
  const { permissoes_transcricao: permissoesTranscricao, ...gravacao } = await gravacaoService.resumoParaDetalhe(
    reuniao,
    participante,
    usuario
  )

  return {
    ...semSala(reuniao),
    meu_papel: participante?.papel || null,
    participantes,
    sessoes,
    minutos_antes: MINUTOS_ANTES,
    ...gravacao,
    permissoes: {
      ...permissoesTranscricao,
      editar: podeEditar && aberta,
      cancelar: podeEditar && reuniao.status === "AGENDADA",
      excluir: podeExcluir && reuniao.status === "AGENDADA",
      encerrar: podeEditar && aberta,
      // Convidado, sala aberta e a menos de MINUTOS_ANTES do inicio.
      entrar:
        Boolean(participante) &&
        aberta &&
        livekit.configurado() &&
        reuniao.segundos_para_inicio <= MINUTOS_ANTES * 60,
    },
  }
}

// ---------------------------------------------------------------------------
// LEITURA
// ---------------------------------------------------------------------------

/** O menu so oferece Reunioes quando ha LiveKit. */
function disponibilidade() {
  return { disponivel: livekit.configurado(), minutos_antes: MINUTOS_ANTES }
}

/** Filtro de periodo: "AAAA-MM-DD" vale o dia inteiro. */
const diaOuHorario = (valor, hora) => (/^\d{4}-\d{2}-\d{2}$/.test(String(valor)) ? `${valor}${hora}` : valor)

/**
 * As reunioes que esta pessoa enxerga. Ver o cabecalho: nunca 403 para quem e
 * da incubadora — sem a chave, a lista vem recortada nas dela.
 */
async function listar(idTenant, filtros, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await garantirMembro(idTenant, usuario)
  const tudo = await enxergaTodas(idTenant, usuario)

  const status = filtros?.status
    ? String(filtros.status).split(",").map((s) => s.trim()).filter(Boolean)
    : null
  if (status?.some((s) => !STATUS.includes(s))) {
    throw erroNegocio(400, `Status inválido. Use: ${STATUS.join(", ")}.`)
  }

  const reunioes = await reuniaoRepository.listarPorTenant(idTenant, {
    doUsuario: tudo ? null : usuario?.id,
    idUsuario: usuario?.id ?? null,
    de: filtros?.de ? horarioDeParede(diaOuHorario(filtros.de, "T00:00"), { rotulo: "o início do período" }) : null,
    ate: filtros?.ate ? horarioDeParede(diaOuHorario(filtros.ate, "T23:59:59"), { rotulo: "o fim do período" }) : null,
    status,
  })
  return { reunioes: reunioes.map(semSala), escopo: tudo ? "TODAS" : "MINHAS" }
}

async function buscar(idReuniao, usuario) {
  const { reuniao, participante } = await carregarVisivel(idReuniao, usuario)
  return montarDetalhe(reuniao, participante, usuario)
}

/**
 * Quem pode ser convidado: a gente ATIVA da incubadora, com as startups de
 * cada um — e o que deixa o formulario oferecer "convidar a equipe da
 * startup" com um clique.
 *
 * ENDPOINT PROPRIO, como `/tarefas/equipe`, e pelo mesmo motivo: a lista de
 * usuarios da incubadora e rota de administracao, e o mentor com a chave de
 * criar reuniao receberia 403 ao abrir o seletor. Exige a chave de CRIAR —
 * quem so participa nao precisa da lista de todo mundo.
 */
async function listarConvidaveis(idTenant, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, CRIAR)

  const [pessoas, vinculos] = await Promise.all([
    tenantRepository.listarUsuarios(idTenant),
    startupRepository.listarMembrosPorTenant(idTenant),
  ])
  const startupsDe = new Map()
  for (const v of vinculos) {
    if (v.startup_status === "ENCERRADA") continue
    const lista = startupsDe.get(v.id_usuario) || []
    lista.push({ id_startup: v.id_startup, nome: v.startup })
    startupsDe.set(v.id_usuario, lista)
  }
  return pessoas
    .filter((p) => p.ativo)
    .map((p) => ({
      id_usuario: p.id_usuario,
      nome: p.nome,
      email: p.email,
      papel: p.papel,
      startups: startupsDe.get(p.id_usuario) || [],
    }))
}

// ---------------------------------------------------------------------------
// ESCRITA
// ---------------------------------------------------------------------------

/** Os campos do evento que a reuniao controla, sobre os que ela nao mexe. */
function dadosDoEvento(preparados, { idTenant, criadoPor, antes }) {
  return {
    idTenant,
    titulo: preparados.titulo,
    descricao: preparados.descricao,
    categoria: preparados.categoria,
    inicioTs: preparados.inicioTs,
    fimTs: preparados.fimTs,
    // A startup da reuniao e a do evento, para a Agenda mostrar o chip. NAO
    // decide o publico (ver o cabecalho).
    idsStartups: preparados.idStartup ? [preparados.idStartup] : [],
    idUsuarioMentor: preparados.idUsuarioMentor,
    mentorNome: null,
    // O resto do evento a reuniao nao edita: fica como estava.
    local: antes ? antes.local : LOCAL,
    idLocal: antes ? antes.id_local : null,
    anexos: antes ? antes.anexos : [],
    vagas: antes ? antes.vagas : null,
    obrigatorio: antes ? antes.obrigatorio : false,
    criadoPor,
  }
}

async function criar(idTenant, dados, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  exigirModulo()
  await rbacService.garantirPermissao(idTenant, usuario, CRIAR)
  if (!usuario?.id) throw erroNegocio(400, "A reunião precisa de um anfitrião com conta.")

  const preparados = await prepararDados(idTenant, { ...dados, participantes: dados.participantes ?? [] }, usuario.id)

  const { evento, idReuniao, adicionados } = await withTransaction(async (client) => {
    const evento = await eventoRepository.criar(
      dadosDoEvento(preparados, { idTenant, criadoPor: usuario.id }),
      client
    )
    const idReuniao = await reuniaoRepository.criar(
      {
        idTenant,
        idEvento: evento.id_evento,
        idStartup: preparados.idStartup,
        gravarAudio: preparados.gravarAudio,
        idAnfitriao: usuario.id,
        criadoPor: usuario.id,
      },
      client
    )
    const { adicionados } = await reuniaoRepository.definirParticipantes(
      { idTenant, idReuniao, idAnfitriao: usuario.id, idsConvidados: preparados.participantes, convidadoPor: usuario.id },
      client
    )
    return { evento, idReuniao, adicionados }
  })

  const reuniao = await reuniaoRepository.buscarPorId(idReuniao)

  await auditLogService.registrar({
    idTenant,
    idUsuario: usuario.id,
    acao: "CRIAR",
    entidade: "reuniao",
    entidadeId: String(idReuniao),
    descricao: `Criou a reunião "${reuniao.titulo}" com ${adicionados.length} convidado(s).`,
    dadosDepois: { ...semSala(reuniao), participantes: preparados.participantes },
  })

  // Os dois em segundo plano, como no eventoService: nao derrubam a criacao.
  notificacaoService.reuniaoConvite({ reuniao, idsUsuarios: adicionados, idAutor: usuario.id })
  googleAgendaService.eventoCriado(evento)

  return buscar(idReuniao, usuario)
}

/**
 * Edita a reuniao: os campos do evento, a startup, a gravacao e (quando vem)
 * a lista de convidados — tudo numa transacao.
 */
async function atualizar(idReuniao, dados, usuario) {
  const { reuniao: antes } = await carregarVisivel(idReuniao, usuario)
  if (!(await podeComChave(antes, usuario, EDITAR))) {
    throw erroNegocio(403, "Só o anfitrião ou quem tem a permissão de editar reuniões altera esta.")
  }
  if (!ABERTAS.includes(antes.status)) {
    throw erroNegocio(409, "Reunião encerrada ou cancelada não se edita.", "REUNIAO_FECHADA")
  }

  const idTenant = antes.id_tenant
  const preparados = await prepararDados(idTenant, dados, antes.id_anfitriao)
  const eventoAntes = await eventoRepository.buscarPorId(antes.id_evento)

  const { evento, mudancaConvidados } = await withTransaction(async (client) => {
    const evento = await eventoRepository.atualizar(
      antes.id_evento,
      dadosDoEvento(preparados, { idTenant, antes: eventoAntes }),
      client
    )
    if (!evento) throw erroNegocio(409, "O evento desta reunião foi removido da agenda.")
    await reuniaoRepository.atualizar(
      antes.id_reuniao,
      { idStartup: preparados.idStartup, gravarAudio: preparados.gravarAudio },
      client
    )
    const mudancaConvidados = preparados.participantes
      ? await reuniaoRepository.definirParticipantes(
          {
            idTenant,
            idReuniao: antes.id_reuniao,
            idAnfitriao: antes.id_anfitriao,
            idsConvidados: preparados.participantes,
            convidadoPor: usuario?.id,
          },
          client
        )
      : { adicionados: [], removidos: [] }
    return { evento, mudancaConvidados }
  })

  const reuniao = await reuniaoRepository.buscarPorId(antes.id_reuniao)
  await registrarEdicao(antes, reuniao, mudancaConvidados, usuario)
  notificacaoService.reuniaoConvite({ reuniao, idsUsuarios: mudancaConvidados.adicionados, idAutor: usuario?.id })
  // Atualiza para quem continua e APAGA de quem saiu da lista.
  googleAgendaService.eventoAtualizado(evento)

  // Categoria, data e mentor mudam quanto o evento vale no engajamento — o
  // mesmo recalculo que o eventoService faz quando a Agenda os edita.
  if (
    eventoAntes.categoria !== evento.categoria ||
    String(eventoAntes.inicio_ts) !== String(evento.inicio_ts) ||
    eventoAntes.id_usuario_mentor !== evento.id_usuario_mentor
  ) {
    await engajamentoService.recalcularEvento(antes.id_evento)
  }

  return buscar(antes.id_reuniao, usuario)
}

async function registrarEdicao(antes, depois, { adicionados, removidos }, usuario) {
  const partes = []
  if (adicionados.length) partes.push(`convidou ${adicionados.length}`)
  if (removidos.length) partes.push(`retirou ${removidos.length} convidado(s)`)
  await auditLogService.registrar({
    idTenant: antes.id_tenant,
    idUsuario: usuario?.id,
    acao: "EDITAR",
    entidade: "reuniao",
    entidadeId: String(antes.id_reuniao),
    descricao: `Editou a reunião "${depois.titulo}"${partes.length ? ` (${partes.join(", ")})` : ""}.`,
    dadosAntes: semSala(antes),
    dadosDepois: { ...semSala(depois), convidados_adicionados: adicionados, convidados_removidos: removidos },
  })
}

/**
 * So a lista de convidados (PUT /reunioes/:id/participantes). Mesmas regras
 * da edicao completa, que e por onde passa.
 */
async function definirParticipantes(idReuniao, participantes, usuario) {
  const { reuniao } = await carregarVisivel(idReuniao, usuario)
  return atualizar(
    idReuniao,
    {
      titulo: reuniao.titulo,
      descricao: reuniao.descricao,
      categoria: reuniao.categoria,
      inicioTs: reuniao.inicio_ts,
      fimTs: reuniao.fim_ts,
      idStartup: reuniao.id_startup,
      gravarAudio: reuniao.gravar_audio,
      participantes: participantes ?? [],
    },
    usuario
  )
}

/**
 * Cancela uma reuniao que ainda nao comecou. Ela fica no historico como
 * Cancelada; o evento sai da Agenda e do Google de quem o tinha.
 */
async function cancelar(idReuniao, usuario) {
  const { reuniao } = await carregarVisivel(idReuniao, usuario)
  if (!(await podeComChave(reuniao, usuario, EDITAR))) {
    throw erroNegocio(403, "Só o anfitrião ou quem tem a permissão de editar reuniões cancela esta.")
  }
  if (reuniao.status !== "AGENDADA") {
    throw erroNegocio(409, "Só se cancela reunião que ainda não começou. Depois disso, encerre.", "REUNIAO_FECHADA")
  }

  // ANTES da desativacao do evento, pelo motivo de eventoService.excluir: a
  // lista de quem recebeu no Google depende de o evento ainda estar visivel.
  const espelhos = await googleAgendaService.espelhosDoEvento(reuniao.id_evento)

  await withTransaction(async (client) => {
    if (!(await reuniaoRepository.cancelar(reuniao.id_reuniao, client))) {
      throw erroNegocio(409, "A reunião acabou de mudar de situação. Recarregue a página.")
    }
    await eventoRepository.excluir(reuniao.id_evento, client)
  })

  await auditLogService.registrar({
    idTenant: reuniao.id_tenant,
    idUsuario: usuario?.id,
    acao: "CANCELAR",
    entidade: "reuniao",
    entidadeId: String(reuniao.id_reuniao),
    descricao: `Cancelou a reunião "${reuniao.titulo}".`,
    dadosAntes: semSala(reuniao),
  })
  googleAgendaService.eventoExcluido(reuniao.id_evento, espelhos)
  await engajamentoService.removerPontosDoEvento(reuniao.id_evento)

  return buscar(reuniao.id_reuniao, usuario)
}

/**
 * Apaga a reuniao. So enquanto AGENDADA — depois que alguem entrou, ha
 * sessao para guardar, e o caminho e cancelar ou encerrar.
 */
async function excluir(idReuniao, usuario) {
  const { reuniao } = await carregarVisivel(idReuniao, usuario)
  if (!(await podeComChave(reuniao, usuario, EXCLUIR))) {
    throw erroNegocio(403, "Só o anfitrião ou quem tem a permissão de excluir reuniões apaga esta.")
  }
  if (reuniao.status !== "AGENDADA") {
    throw erroNegocio(409, "Só se exclui reunião que ainda não começou.", "REUNIAO_FECHADA")
  }

  const espelhos = await googleAgendaService.espelhosDoEvento(reuniao.id_evento)

  await withTransaction(async (client) => {
    if (!(await reuniaoRepository.excluir(reuniao.id_reuniao, client))) {
      throw erroNegocio(409, "A reunião acabou de mudar de situação. Recarregue a página.")
    }
    await eventoRepository.excluir(reuniao.id_evento, client)
  })

  await auditLogService.registrar({
    idTenant: reuniao.id_tenant,
    idUsuario: usuario?.id,
    acao: "EXCLUIR",
    entidade: "reuniao",
    entidadeId: String(reuniao.id_reuniao),
    descricao: `Excluiu a reunião "${reuniao.titulo}".`,
    dadosAntes: semSala(reuniao),
  })
  googleAgendaService.eventoExcluido(reuniao.id_evento, espelhos)
  await engajamentoService.removerPontosDoEvento(reuniao.id_evento)

  return { excluida: true }
}

// ---------------------------------------------------------------------------
// SALA
// ---------------------------------------------------------------------------

/**
 * O token do LiveKit para esta pessoa entrar nesta sala.
 *
 * So emite para CONVIDADO, com a reuniao aberta, e a partir de MINUTOS_ANTES
 * do horario. O token vale 10 minutos e so para esta sala (ver livekit.js).
 */
async function emitirToken(idReuniao, usuario) {
  exigirModulo()
  const { reuniao, participante } = await carregarVisivel(idReuniao, usuario)
  if (!participante) {
    throw erroNegocio(403, "Só quem foi convidado entra na sala.", "NAO_CONVIDADO")
  }
  if (!ABERTAS.includes(reuniao.status)) {
    throw erroNegocio(409, "Esta reunião já foi encerrada.", "REUNIAO_FECHADA")
  }
  if (reuniao.segundos_para_inicio > MINUTOS_ANTES * 60) {
    throw erroNegocio(
      409,
      `A sala abre ${MINUTOS_ANTES} minutos antes do horário marcado.`,
      "SALA_AINDA_FECHADA"
    )
  }

  const pessoa = await usuarioRepository.buscarPorId(usuario.id)

  // Cria a sala com os prazos de espera da reuniao. Falhar aqui nao impede a
  // entrada: o LiveKit cria a sala sozinho na primeira conexao, so que com os
  // prazos padrao.
  try {
    const total = await reuniaoRepository.listarParticipantes(reuniao.id_reuniao)
    await livekit.prepararSala(reuniao.sala, { maxParticipantes: total.length })
  } catch (err) {
    console.error(`[reunioes] Nao foi possivel preparar a sala da reuniao ${reuniao.id_reuniao}:`, err.message)
  }

  const identidade = `u-${usuario.id}`
  const token = await livekit.emitirToken({
    sala: reuniao.sala,
    identidade,
    nome: pessoa?.nome || "Participante",
    metadados: { id_usuario: Number(usuario.id), papel: participante.papel, foto_url: pessoa?.foto_url || null },
    // O selo de quem tem a fala gravada, que a sala inteira enxerga.
    atributos: { gravacao: await gravacaoService.atributoDeGravacao(reuniao, participante) },
  })

  return { token, url: livekit.urlCliente(), identidade, papel: participante.papel }
}

/**
 * Encerra a reuniao (o botao do anfitriao): marca ENCERRADA e fecha a sala no
 * LiveKit, que desconecta todo mundo.
 *
 * Responde na hora (202). Fechar a sala vai em segundo plano: se o LiveKit nao
 * responder, o `room_finished` fecha do mesmo jeito quando o ultimo sair.
 *
 * Encerrar o que ja esta encerrado nao e erro: dois cliques, ou o botao
 * depois de a sala ter fechado sozinha, pedem o mesmo estado final.
 *
 * Na MESMA transacao nasce o job de TRANSCRICAO, se alguem teve a fala
 * gravada (gravacaoService.aoEncerrar).
 */
async function encerrar(idReuniao, usuario) {
  const { reuniao } = await carregarVisivel(idReuniao, usuario)
  if (!(await podeComChave(reuniao, usuario, EDITAR))) {
    throw erroNegocio(403, "Só o anfitrião encerra a reunião.")
  }
  if (reuniao.status === "CANCELADA") {
    throw erroNegocio(409, "Esta reunião foi cancelada.", "REUNIAO_FECHADA")
  }

  const encerrouAgora = await withTransaction(async (client) => {
    const encerrou = await reuniaoRepository.encerrar(reuniao.id_reuniao, usuario?.id, client)
    if (encerrou) await gravacaoService.aoEncerrar(reuniao, client)
    return encerrou
  })

  if (encerrouAgora) {
    await auditLogService.registrar({
      idTenant: reuniao.id_tenant,
      idUsuario: usuario?.id,
      acao: "ENCERRAR",
      entidade: "reuniao",
      entidadeId: String(reuniao.id_reuniao),
      descricao: `Encerrou a reunião "${reuniao.titulo}".`,
    })
  }

  fecharSalaEmSegundoPlano(reuniao)
  return { encerrada: true }
}

/** Fecha a sala no LiveKit sem prender quem chamou e sem lancar. */
function fecharSalaEmSegundoPlano(reuniao) {
  if (!livekit.configurado()) return
  livekit.encerrarSala(reuniao.sala).catch((err) => {
    console.error(`[reunioes] Falha ao fechar a sala da reuniao ${reuniao.id_reuniao}:`, err.message)
  })
}

module.exports = {
  MINUTOS_ANTES,
  disponibilidade,
  listar,
  buscar,
  listarConvidaveis,
  criar,
  atualizar,
  definirParticipantes,
  cancelar,
  excluir,
  emitirToken,
  encerrar,
  fecharSalaEmSegundoPlano,
  // Exportados para o teste das regras de entrada, sem banco.
  horarioDeParede,
}
