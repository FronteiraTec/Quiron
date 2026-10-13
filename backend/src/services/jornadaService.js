/**
 * Service da Jornada (regra de negocio).
 *
 * Monta a visao que a startup tem da trilha: a mesma arvore do Construtor,
 * filtrada pelo que esta ativo, com o estado de cada passo derivado de
 * entrega + avaliacao.
 *
 * Por que derivar em vez de guardar um `status` no banco: o estado do passo e
 * consequencia de fatos que ja estao registrados (existe entrega? foi enviada?
 * qual a ultima avaliacao?). Guardar tambem o resultado abriria espaco para os
 * dois discordarem — uma entrega aprovada com o passo marcado "aguardando".
 */
const jornadaRepository = require("../repositories/jornadaRepository")
const startupRepository = require("../repositories/startupRepository")
const trilhaRepository = require("../repositories/trilhaRepository")
const notificacaoService = require("./notificacaoService")
const { documentoDe } = require("./documentoAula")
const { erroNegocio } = require("../utils/erros")

/**
 * Estado de um passo, na ordem em que os fatos mandam.
 *
 *   sem entrega                     -> NAO_INICIADA
 *   entrega RASCUNHO                -> RASCUNHO
 *   enviada, sem avaliacao          -> AGUARDANDO
 *   ultima avaliacao AJUSTE/REPROVADO -> AJUSTE
 *   ultima avaliacao APROVADO       -> APROVADO
 */
function derivarStatus(row) {
  if (!row.id_entrega) return "NAO_INICIADA"
  if (row.entrega_status === "RASCUNHO") return "RASCUNHO"
  if (!row.avaliacao_status) return "AGUARDANDO"
  if (row.avaliacao_status === "APROVADO") return "APROVADO"
  // REPROVADO e AJUSTE levam a mesma acao do incubado: corrigir e reenviar.
  return "AJUSTE"
}

/** Monta o objeto `entrega` que a Jornada consome. */
function montarEntrega(row, historico) {
  return {
    status: derivarStatus(row),
    tipo: row.tipo_passo || "TEXTO",
    resposta: row.texto_resposta ?? "",
    anexos: row.anexos ?? [],
    feedback: row.comentario ?? null,
    nota: row.nota ?? null,
    avaliador: row.avaliador ?? null,
    historico,
  }
}

/**
 * Carrega a jornada completa da startup.
 *
 * Devolve `estagios` (as FASEs ativas) com seus passos ja achatados e o campo
 * `frente` preenchido com o nome do MODULO — a Jornada agrupa por `frente`
 * para montar suas telas, e o modulo e exatamente esse agrupamento.
 */
/**
 * Lista as trilhas da startup — as em andamento e as ja concluidas.
 *
 * E o que a tela "Minha Jornada" mostra antes de entrar numa delas. O
 * progresso vem calculado das entregas aprovadas, no repositorio.
 */
async function listarTrilhas(idStartup) {
  if (!idStartup) throw erroNegocio(400, "Informe o id_startup.")

  const startup = await startupRepository.buscarPorId(idStartup)
  if (!startup) throw erroNegocio(404, "Startup nao encontrada.")

  return trilhaRepository.programasDaStartup(idStartup)
}

/**
 * Resolve em qual trilha a Jornada vai abrir.
 *
 * Sem `idPrograma`, escolhe a primeira em andamento — `programasDaStartup` ja
 * ordena EM_ANDAMENTO antes de CONCLUIDA. Com ele, exige que a startup esteja
 * matriculada: sem essa checagem, trocar o id na URL daria acesso a trilha de
 * outra turma.
 */
async function resolverPrograma(idStartup, idPrograma) {
  const matriculas = await trilhaRepository.programasDaStartup(idStartup)
  if (matriculas.length === 0) return null

  if (!idPrograma) return matriculas[0].id_no

  const escolhida = matriculas.find((m) => Number(m.id_no) === Number(idPrograma))
  if (!escolhida) {
    throw erroNegocio(403, "Esta startup nao esta matriculada nesta trilha.")
  }
  return escolhida.id_no
}

async function carregar(idStartup, idPrograma) {
  if (!idStartup) throw erroNegocio(400, "Informe o id_startup.")

  const startup = await startupRepository.buscarPorId(idStartup)
  if (!startup) throw erroNegocio(404, "Startup nao encontrada.")

  const idTrilha = await resolverPrograma(idStartup, idPrograma)

  // Startup sem matricula nenhuma: a tela mostra o vazio, nao um erro.
  if (!idTrilha) {
    return {
      programa: null,
      startup: startup.nome,
      equipe: [],
      mentor: null,
      estagios: [],
    }
  }

  const [linhas, conteudos, blocos, avaliacoes, progresso, membros, mentores] =
    await Promise.all([
      jornadaRepository.carregar(idTrilha, idStartup),
      jornadaRepository.conteudosPorPasso(idTrilha),
      jornadaRepository.blocosDosConteudos(idTrilha),
      jornadaRepository.historicoPorStartup(idStartup),
      jornadaRepository.progressoPorFase(idStartup),
      jornadaRepository.equipe(idStartup),
      jornadaRepository.mentores(idStartup),
    ])

  // A tela mostra a inicial de cada membro no avatar.
  const equipe = membros.map((m) => ({
    id_usuario: m.id_usuario,
    nome: m.nome,
    inicial: (m.nome || "?").trim().charAt(0).toUpperCase(),
    lider: m.lider,
  }))

  // A tela espera um mentor; havendo varios, mostra o primeiro.
  const mentor = mentores[0] ? { nome: mentores[0].nome, online: false } : null

  // Corpo das aulas agrupado por conteudo (chegam prontas para leitura).
  // Os blocos so existem para as aulas anteriores a migracao 018; para elas,
  // o `documento` que o leitor recebe e derivado aqui (documentoAula.js).
  const blocosPorConteudo = new Map()
  for (const b of blocos) {
    if (!blocosPorConteudo.has(b.id_conteudo)) blocosPorConteudo.set(b.id_conteudo, [])
    blocosPorConteudo.get(b.id_conteudo).push({
      id: b.id_bloco,
      tipo: b.tipo,
      ordem: b.ordem,
      texto: b.texto,
      url: b.url,
      nome: b.nome,
      variante: b.variante,
    })
  }

  // Conteudos agrupados por passo.
  const conteudosPorNo = new Map()
  for (const c of conteudos) {
    if (!conteudosPorNo.has(c.id_no)) conteudosPorNo.set(c.id_no, [])
    conteudosPorNo.get(c.id_no).push({
      id_conteudo: c.id_conteudo,
      tipo: c.tipo,
      titulo: c.titulo,
      resumo: c.resumo,
      tags: c.tags,
      url: c.url,
      nome_arquivo: c.nome_arquivo,
      duracao: c.duracao,
      blocos: blocosPorConteudo.get(c.id_conteudo) ?? [],
      documento: documentoDe(c, blocosPorConteudo.get(c.id_conteudo) ?? []),
    })
  }

  // Historico de avaliacoes por passo, para a linha do tempo da startup.
  const historicoPorNo = new Map()
  for (const a of avaliacoes) {
    if (!historicoPorNo.has(a.id_no)) historicoPorNo.set(a.id_no, [])
    historicoPorNo.get(a.id_no).push({
      tipo: a.status === "APROVADO" ? "aprovada" : "ajuste",
      data: a.criado_ts?.toISOString?.().slice(0, 10) ?? null,
      por: a.avaliador,
      comentario: a.comentario,
    })
  }

  // Indexa por id e por pai para reconstruir a hierarquia.
  const porId = new Map(linhas.map((l) => [l.id_no, l]))
  const filhosDe = new Map()
  for (const l of linhas) {
    if (l.id_pai == null) continue
    if (!filhosDe.has(l.id_pai)) filhosDe.set(l.id_pai, [])
    filhosDe.get(l.id_pai).push(l)
  }

  const raiz = linhas.find((l) => l.tipo === "PROGRAMA")
  if (!raiz) {
    // Tenant sem trilha montada ainda: a tela mostra o vazio, nao um erro.
    return {
      programa: null,
      startup: startup.nome,
      equipe,
      mentor,
      estagios: [],
    }
  }

  const statusFase = new Map(progresso.map((p) => [p.id_no, p.status]))
  const fases = (filhosDe.get(raiz.id_no) ?? []).sort((a, b) => a.ordem - b.ordem)

  const estagios = []
  let anteriorConcluido = true // a primeira fase sempre comeca liberada

  for (const fase of fases) {
    const modulos = (filhosDe.get(fase.id_no) ?? []).sort((a, b) => a.ordem - b.ordem)

    const passos = []
    for (const modulo of modulos) {
      const filhos = (filhosDe.get(modulo.id_no) ?? []).sort((a, b) => a.ordem - b.ordem)
      for (const p of filhos) {
        passos.push({
          id: p.id_no,
          titulo: p.nome,
          descricao: p.descricao,
          // A Jornada agrupa por `frente` para montar seus modulos; aqui a
          // frente e o proprio MODULO da trilha.
          frente: modulo.nome,
          area: p.area,
          objetivo: p.objetivo,
          porque: p.porque,
          competencias: p.competencias ?? [],
          prazo: p.prazo,
          carga_horaria: p.carga_horaria,
          entregavel: p.entregavel,
          permite_entrega: p.permite_entrega,
          obrigatoria: p.obrigatoria,
          id_questionario: p.id_questionario,
          conteudos: conteudosPorNo.get(p.id_no) ?? [],
          entrega: montarEntrega(p, historicoPorNo.get(p.id_no) ?? []),
        })
      }
    }

    // Uma fase e liberada quando a anterior foi concluida. Assim a trilha tem
    // sequencia sem precisar de uma coluna "bloqueada" que teria de ser
    // mantida a mao a cada aprovacao.
    //
    // So os passos COM entrega contam: o passo so de conteudo (o "Materiais"
    // que o Construtor cria por baixo da fase) nunca tem entrega, nunca chega
    // a APROVADO e prendia a fase — e com ela todas as seguintes — para
    // sempre. Fase sem nenhuma entrega fica em andamento, mas nao bloqueia a
    // proxima: nao ha o que aprovar nela.
    const registrada = statusFase.get(fase.id_no)
    const avaliaveis = passos.filter((p) => p.permite_entrega)
    const concluida =
      registrada === "APROVADA" ||
      (avaliaveis.length > 0 && avaliaveis.every((p) => p.entrega.status === "APROVADO"))

    let status = "EM_ANDAMENTO"
    if (concluida) status = "CONCLUIDO"
    else if (!anteriorConcluido) status = "BLOQUEADO"

    estagios.push({
      id: fase.id_no,
      nome: fase.nome,
      descricao: fase.descricao,
      ordem: fase.ordem,
      status,
      passos,
    })

    anteriorConcluido = concluida || (status !== "BLOQUEADO" && avaliaveis.length === 0)
  }

  return {
    programa: { id: raiz.id_no, nome: raiz.nome },
    startup: startup.nome,
    equipe,
    mentor,
    estagios,
  }
}

/** Salva o rascunho de um passo (sem enviar ao mentor). */
async function salvarRascunho(dados) {
  await validarEntrega(dados)
  return jornadaRepository.salvarEntrega({ ...dados, status: "RASCUNHO" })
}

/** Envia a entrega para avaliacao. */
async function enviar(dados) {
  await validarEntrega(dados)

  const temResposta =
    (dados.textoResposta ?? "").trim() || (dados.anexos ?? []).length > 0
  if (!temResposta) {
    throw erroNegocio(400, "Escreva uma resposta ou anexe um arquivo antes de enviar.")
  }

  const entrega = await jornadaRepository.salvarEntrega({ ...dados, status: "ENVIADA" })

  // Aviso aos mentores. Fica aqui, e nao no salvarRascunho, porque so o envio
  // coloca a entrega na fila de alguem — o rascunho ainda e da startup.
  notificacaoService.entregaEnviada({
    idStartup: dados.idStartup,
    idNo: dados.idNo,
    idUsuario: dados.idUsuario,
  })

  return entrega
}

/** Reenvia apos ajuste: limpa as avaliacoes e volta para AGUARDANDO. */
async function reenviar(dados) {
  await validarEntrega(dados)
  const entrega = await jornadaRepository.reenviar(dados)
  if (!entrega) throw erroNegocio(404, "Nao ha entrega para reenviar neste passo.")

  notificacaoService.entregaEnviada({
    idStartup: dados.idStartup,
    idNo: dados.idNo,
    idUsuario: dados.idUsuario,
    reenvio: true,
  })

  return entrega
}

/** O passo precisa existir, ser folha e aceitar entrega. */
async function validarEntrega({ idNo, idStartup }) {
  if (!idNo || !idStartup) {
    throw erroNegocio(400, "Informe id_no e id_startup.")
  }

  const no = await trilhaRepository.buscarPorId(idNo)

  if (!no) throw erroNegocio(404, "Passo nao encontrado.")
  if (no.tipo !== "PASSO") {
    throw erroNegocio(400, "So e possivel entregar em um PASSO da trilha.")
  }
  if (!no.permite_entrega) {
    throw erroNegocio(400, `O passo "${no.nome}" nao aceita entregas.`)
  }
}

module.exports = {
  carregar,
  listarTrilhas,
  salvarRascunho,
  enviar,
  reenviar,
  derivarStatus,
}
