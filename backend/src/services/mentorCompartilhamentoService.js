/**
 * Service dos COMPARTILHAMENTOS do Espaco do Mentor (regra de negocio) —
 * migracao 020.
 *
 * Um compartilhamento entrega um material — da biblioteca pessoal do mentor ou
 * da Biblioteca da incubadora — a UMA startup, numa trilha em que ela esta
 * matriculada e, opcionalmente, numa etapa dela (FASE ou PASSO).
 *
 * OS DOIS EIXOS DE SEMPRE, como na fila de avaliacao:
 *
 *   A CHAVE `mentoria.materiais.compartilhar` diz O QUE a pessoa faz.
 *   O VINCULO `mentor_startup` diz PARA QUEM. Admin e root respondem pela
 *   incubadora inteira e nao estao em mentor_startup de ninguem — exigir o
 *   vinculo deles travaria a coordenacao (o mesmo raciocinio de
 *   avaliacaoService.garantirPodeAvaliar).
 *
 * Nenhum id do pedido e prova de nada: a startup, a trilha, a etapa e a origem
 * sao relidas do banco e conferidas entre si — mesmo tenant, startup
 * matriculada naquela trilha, etapa dentro dela, material do proprio mentor.
 *
 * QUEM ENXERGA UM MATERIAL COMPARTILHADO: quem tem vinculo com a startup que o
 * recebeu — os membros, os mentores que a acompanham, o admin (o mesmo recorte
 * da Jornada, startupService.garantirVinculo). Compartilhar e justamente tirar
 * o material da biblioteca privada e entrega-lo a esse circulo; a biblioteca em
 * si continua privada (mentorMaterialService).
 *
 * MATERIAL DE REFERENCIA x ATIVIDADE: a atividade e um PASSO que ja existe na
 * trilha. Este modulo nao cria passo nem tarefa: a trilha e a mesma para todas
 * as startups matriculadas, e o quadro de tarefas e a gestao interna da equipe.
 */
const mentorCompartilhamentoRepository = require("../repositories/mentorCompartilhamentoRepository")
const mentorMaterialRepository = require("../repositories/mentorMaterialRepository")
const startupRepository = require("../repositories/startupRepository")
const tenantRepository = require("../repositories/tenantRepository")
const trilhaRepository = require("../repositories/trilhaRepository")
const jornadaRepository = require("../repositories/jornadaRepository")
const bibliotecaRepository = require("../repositories/bibliotecaRepository")
const arquivoService = require("./arquivoService")
const rbacService = require("./rbacService")
const startupService = require("./startupService")
const auditLogService = require("./auditLogService")
const notificacaoService = require("./notificacaoService")
const { derivarStatus } = require("./jornadaService")
const {
  normalizarCompartilhamento,
  normalizarPatchCompartilhamento,
} = require("../mentores/material")
const { erroNegocio } = require("../utils/erros")

const COMPARTILHAR = "mentoria.materiais.compartilhar"
// Escolher um conteudo da Biblioteca da incubadora exige poder consulta-la.
const VER_BIBLIOTECA = "programa.biblioteca.visualizar"

// ---------------------------------------------------------------------------
// AUTORIZACAO
// ---------------------------------------------------------------------------

/**
 * As startups que a pessoa acompanha no tenant. `null` = todas (admin e root),
 * como em entregaService.listarFila.
 */
async function idsAcompanhados(idTenant, usuario) {
  if (usuario?.root) return null
  const papel = await tenantRepository.buscarPapel(idTenant, usuario?.id)
  if (!papel) return []
  if (papel === "admin") return null
  return startupRepository.listarIdsPorMentor(idTenant, usuario.id)
}

function acompanha(ids, idStartup) {
  return ids === null || ids.includes(Number(idStartup))
}

async function carregarStartup(idStartup) {
  const id = Number(idStartup)
  const startup = Number.isInteger(id) && id > 0 ? await startupRepository.buscarPorId(id) : null
  if (!startup) throw erroNegocio(404, "Startup nao encontrada.")
  return startup
}

/** Chave no tenant DA STARTUP e vinculo com ela. Devolve o recorte, que a tela reaproveita. */
async function garantirAcompanha(startup, usuario) {
  await rbacService.garantirPermissao(startup.id_tenant, usuario, COMPARTILHAR)
  const ids = await idsAcompanhados(startup.id_tenant, usuario)
  if (!acompanha(ids, startup.id_startup)) {
    throw erroNegocio(403, "Voce nao acompanha esta startup.")
  }
  return ids
}

/** A trilha, se for uma raiz do tenant da startup. Diz tambem se ha matricula. */
async function carregarTrilha(startup, idPrograma) {
  const id = Number(idPrograma)
  const programa = Number.isInteger(id) && id > 0 ? await trilhaRepository.buscarPorId(id) : null
  if (
    !programa ||
    programa.tipo !== "PROGRAMA" ||
    Number(programa.id_tenant) !== Number(startup.id_tenant)
  ) {
    throw erroNegocio(404, "Trilha nao encontrada.")
  }
  const matriculada = await trilhaRepository.startupMatriculada(startup.id_startup, programa.id_no)
  return { programa, matriculada }
}

// ---------------------------------------------------------------------------
// APRESENTACAO
// ---------------------------------------------------------------------------

/** "Trilha › Fase › Passo", ou so a trilha. */
function caminho(row) {
  const partes = [row.programa_nome]
  if (row.etapa_visivel && row.fase_nome) partes.push(row.fase_nome)
  if (row.etapa_visivel && row.etapa_tipo === "PASSO") partes.push(row.etapa_nome)
  return partes.join(" › ")
}

/**
 * Em que pe o compartilhamento esta, do ponto de vista da startup.
 *
 *   FORA_DA_TRILHA      a startup saiu da trilha: ela nao abre mais esta
 *                       trilha na Jornada, e o material nao aparece para ela.
 *   ETAPA_INDISPONIVEL  a etapa foi desativada ou movida no Construtor: a
 *                       startup continua vendo o material, no nivel da trilha.
 *   DISPONIVEL          onde o mentor o colocou.
 */
function situacao(row) {
  if (!row.matriculada) return "FORA_DA_TRILHA"
  if (!row.etapa_visivel) return "ETAPA_INDISPONIVEL"
  return "DISPONIVEL"
}

/**
 * O que a tela do MENTOR recebe. `meu` e `acompanha` decidem os botoes — so o
 * autor edita e remove — e `arquivo_url` ja vem montada pelo caminho que
 * autoriza quem pede: o dono abre pela propria biblioteca; os demais, pelo
 * compartilhamento.
 */
function paraMentor(row, usuario, ids) {
  const meu = Number(row.compartilhado_por) === Number(usuario.id)
  const pessoal = row.origem === "PESSOAL"
  const temArquivo = pessoal && row.tipo === "ARQUIVO"

  let arquivoUrl = null
  if (temArquivo && Number(row.material_dono) === Number(usuario.id)) {
    arquivoUrl = `/api/espaco-mentor/materiais/${row.id_material}/arquivo`
  } else if (temArquivo) {
    arquivoUrl = `/api/jornada/materiais/${row.id_compartilhamento}/arquivo`
  }

  const { material_dono, material_arquivado_ts, ...resto } = row
  return {
    ...resto,
    caminho: caminho(row),
    situacao: situacao(row),
    material_arquivado: Boolean(material_arquivado_ts),
    meu,
    acompanha: acompanha(ids, row.id_startup),
    arquivo_url: arquivoUrl,
  }
}

/**
 * O que a STARTUP recebe — e nada alem disso: nem o dono do material, nem se o
 * mentor o arquivou na biblioteca dele, nem os ids internos da origem pessoal.
 *
 * Etapa que a startup nao enxerga mais (desativada ou movida no Construtor)
 * volta para o nivel da trilha, e com ela a finalidade vira referencia: uma
 * "atividade" que nao esta na tela de atividade nenhuma nao orienta ninguem.
 */
function paraStartup(row) {
  const visivel = row.etapa_visivel
  const pessoal = row.origem === "PESSOAL"
  return {
    id_compartilhamento: row.id_compartilhamento,
    id_startup: row.id_startup,
    id_programa: row.id_programa,
    programa_nome: row.programa_nome,
    id_no: visivel ? row.id_no : null,
    etapa_tipo: visivel ? row.etapa_tipo : null,
    etapa_nome: visivel ? row.etapa_nome : null,
    id_fase: visivel ? row.id_fase : null,
    fase_nome: visivel ? row.fase_nome : null,
    modulo_nome: visivel ? row.modulo_nome : null,
    caminho: caminho(row),
    finalidade: visivel ? row.finalidade : "REFERENCIA",
    orientacao: row.orientacao,
    compartilhado_por_nome: row.compartilhado_por_nome,
    criado_ts: row.criado_ts,
    origem: row.origem,
    id_conteudo: row.id_conteudo,
    titulo: row.titulo,
    descricao: row.descricao,
    categoria: row.categoria,
    tipo: row.tipo,
    url: row.url,
    conteudo_duracao: row.conteudo_duracao,
    arquivo_nome: row.arquivo_nome,
    arquivo_mime: row.arquivo_mime,
    arquivo_tamanho: row.arquivo_tamanho,
    arquivo_url:
      pessoal && row.tipo === "ARQUIVO"
        ? `/api/jornada/materiais/${row.id_compartilhamento}/arquivo`
        : null,
  }
}

/**
 * A trilha como o mentor a escolhe: fases > modulos > passos ATIVOS, com o
 * estado de cada passo para aquela startup — o mesmo que ela ve na Jornada
 * (jornadaRepository.carregar + jornadaService.derivarStatus).
 */
function montarArvore(linhas, programa) {
  const filhosDe = new Map()
  for (const l of linhas) {
    if (l.id_pai == null) continue
    if (!filhosDe.has(l.id_pai)) filhosDe.set(l.id_pai, [])
    filhosDe.get(l.id_pai).push(l)
  }
  const ordenados = (id) =>
    (filhosDe.get(id) ?? []).sort((a, b) => a.ordem - b.ordem || a.id_no - b.id_no)

  const raiz = linhas.find((l) => l.tipo === "PROGRAMA")
  // Trilha desativada no Construtor: a Jornada da startup tambem fica vazia.
  if (!raiz) return { id_no: programa.id_no, nome: programa.nome, ativa: false, fases: [] }

  const fases = ordenados(raiz.id_no).map((f) => {
    const modulos = ordenados(f.id_no).map((m) => ({
      id_no: m.id_no,
      nome: m.nome,
      passos: ordenados(m.id_no).map((p) => ({
        id_no: p.id_no,
        nome: p.nome,
        tipo_passo: p.tipo_passo,
        permite_entrega: p.permite_entrega,
        status: derivarStatus(p),
      })),
    }))
    const passos = modulos.flatMap((m) => m.passos)
    return {
      id_no: f.id_no,
      nome: f.nome,
      descricao: f.descricao,
      ordem: f.ordem,
      passos_total: passos.length,
      passos_concluidos: passos.filter((p) => p.status === "APROVADO").length,
      modulos,
    }
  })
  return { id_no: raiz.id_no, nome: raiz.nome, ativa: true, fases }
}

// ---------------------------------------------------------------------------
// MEUS INCUBADOS
// ---------------------------------------------------------------------------

/**
 * As startups que a pessoa acompanha, cada uma com as trilhas em que esta
 * matriculada (progresso e fase atual) e quantos materiais ja recebeu.
 *
 * O progresso vem de trilhaRepository.programasDaStartup — o mesmo numero da
 * tela de trilhas da Jornada —, uma consulta por startup: um mentor acompanha
 * um punhado, e duplicar aqui a regra de progresso para economizar consultas
 * abriria espaco para as duas telas discordarem.
 */
async function listarIncubados(idTenant, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, COMPARTILHAR)

  const ids = await idsAcompanhados(idTenant, usuario)
  const startups = await startupRepository.listarPorTenant(idTenant, ids)
  const idsLista = startups.map((s) => s.id_startup)

  const [trilhas, fases, contagens] = await Promise.all([
    Promise.all(idsLista.map((id) => trilhaRepository.programasDaStartup(id))),
    mentorCompartilhamentoRepository.fasesAtuais(idsLista),
    mentorCompartilhamentoRepository.contarPorStartup(idsLista, usuario.id),
  ])

  const faseAtual = new Map(fases.map((f) => [`${f.id_startup}:${f.id_programa}`, f]))
  const contagem = new Map(contagens.map((c) => [c.id_startup, c]))

  return startups.map((s, i) => ({
    id_startup: s.id_startup,
    uuid: s.uuid,
    nome: s.nome,
    status: s.status,
    tipo_rotulo: s.tipo_rotulo,
    tipo_cor: s.tipo_cor,
    situacao_rotulo: s.situacao_rotulo,
    situacao_cor: s.situacao_cor,
    cidade: s.cidade,
    uf: s.uf,
    trilhas: trilhas[i].map((t) => {
      const fase = faseAtual.get(`${s.id_startup}:${t.id_no}`)
      return {
        id_no: t.id_no,
        nome: t.nome,
        status: t.status,
        passos: t.passos,
        passos_concluidos: t.passos_concluidos,
        fase_atual: fase ? { id_no: fase.id_fase, nome: fase.nome } : null,
      }
    }),
    materiais: {
      total: contagem.get(s.id_startup)?.total ?? 0,
      meus: contagem.get(s.id_startup)?.meus ?? 0,
    },
  }))
}

/** Uma trilha de uma startup acompanhada: a arvore e o que ja foi entregue nela. */
async function carregarTrilhaDoIncubado(idStartup, idPrograma, usuario) {
  const startup = await carregarStartup(idStartup)
  const ids = await garantirAcompanha(startup, usuario)

  const { programa, matriculada } = await carregarTrilha(startup, idPrograma)
  if (!matriculada) throw erroNegocio(404, "Esta startup nao esta matriculada nesta trilha.")

  const [linhas, compartilhamentos] = await Promise.all([
    jornadaRepository.carregar(programa.id_no, startup.id_startup),
    mentorCompartilhamentoRepository.listarDaStartup(startup.id_startup, programa.id_no),
  ])

  return {
    startup: { id_startup: startup.id_startup, nome: startup.nome },
    trilha: montarArvore(linhas, programa),
    compartilhamentos: compartilhamentos.map((r) => paraMentor(r, usuario, ids)),
  }
}

// ---------------------------------------------------------------------------
// COMPARTILHAMENTOS (lado do mentor)
// ---------------------------------------------------------------------------

/**
 * O que a pessoa compartilhou e o que as startups que ela acompanha receberam.
 * `idStartup` recorta uma startup so (a aba do incubado).
 */
async function listar(idTenant, { idStartup } = {}, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, COMPARTILHAR)

  const ids = await idsAcompanhados(idTenant, usuario)
  const id = idStartup ? Number(idStartup) : null
  if (idStartup && (!Number.isInteger(id) || id <= 0)) {
    throw erroNegocio(400, "Startup invalida.")
  }

  const linhas = await mentorCompartilhamentoRepository.listar({
    idTenant,
    idAutor: usuario.id,
    idsStartups: ids,
    idStartup: id,
  })
  return linhas.map((r) => paraMentor(r, usuario, ids))
}

/**
 * Compartilha um material com uma startup.
 *
 * A ordem das conferencias e a ordem das perguntas: a startup existe e a
 * pessoa a acompanha? a trilha e dela? a etapa e dessa trilha? o material e
 * de quem compartilha (ou da Biblioteca que ela pode consultar)? So entao o
 * vinculo nasce.
 */
async function compartilhar(corpo, usuario) {
  const dados = normalizarCompartilhamento(corpo)

  const startup = await carregarStartup(dados.idStartup)
  const ids = await garantirAcompanha(startup, usuario)

  const { programa, matriculada } = await carregarTrilha(startup, dados.idPrograma)
  if (!matriculada) {
    throw erroNegocio(409, "Esta startup nao esta matriculada nesta trilha.")
  }

  let etapa = null
  if (dados.idNo) {
    etapa = await mentorCompartilhamentoRepository.etapaDaTrilha(programa.id_no, dados.idNo)
    if (!etapa) throw erroNegocio(404, "Etapa nao encontrada nesta trilha.")
    if (etapa.tipo !== "FASE" && etapa.tipo !== "PASSO") {
      throw erroNegocio(400, "Escolha uma fase ou uma atividade (passo) da trilha.")
    }
  }
  if (dados.finalidade === "ATIVIDADE" && etapa?.tipo !== "PASSO") {
    throw erroNegocio(400, "Para associar o material a uma atividade, escolha o passo da trilha.")
  }

  if (dados.idMaterial) {
    const material = await mentorMaterialRepository.buscarPorId(dados.idMaterial)
    // 404 tambem para o material de OUTRO mentor: a biblioteca dele e privada,
    // e confirmar que o id existe ja diria algo sobre ela.
    if (
      !material ||
      Number(material.id_mentor) !== Number(usuario.id) ||
      Number(material.id_tenant) !== Number(startup.id_tenant)
    ) {
      throw erroNegocio(404, "Material nao encontrado na sua biblioteca.")
    }
    if (material.arquivado_ts) {
      throw erroNegocio(409, "Este material esta arquivado. Reative-o antes de compartilhar.")
    }
  } else {
    await rbacService.garantirPermissao(startup.id_tenant, usuario, VER_BIBLIOTECA)
    const conteudo = await mentorCompartilhamentoRepository.conteudoResumo(dados.idConteudo)
    if (!conteudo || Number(conteudo.id_tenant) !== Number(startup.id_tenant)) {
      throw erroNegocio(404, "Conteudo nao encontrado na Biblioteca da incubadora.")
    }
  }

  let criado
  try {
    criado = await mentorCompartilhamentoRepository.criar({
      ...dados,
      idTenant: startup.id_tenant,
      idPrograma: programa.id_no,
      compartilhadoPor: usuario.id,
    })
  } catch (err) {
    if (err.code === "23505") {
      throw erroNegocio(409, "Este material ja foi disponibilizado para esta startup neste lugar da trilha.")
    }
    // O material foi excluido entre a conferencia e o INSERT (ver
    // mentorMaterialRepository.excluirSeLivre).
    if (err.code === "23503") throw erroNegocio(404, "Material nao encontrado na sua biblioteca.")
    throw err
  }

  await auditLogService.registrar({
    idTenant: startup.id_tenant,
    idUsuario: usuario.id,
    acao: "CRIAR",
    entidade: "mentor_compartilhamento",
    entidadeId: String(criado.id_compartilhamento),
    descricao: `Compartilhou "${criado.titulo}" com ${criado.startup_nome} (${caminho(criado)}).`,
    dadosDepois: criado,
  })

  // Sem `await`: avisar e efeito colateral do fato, nao parte dele.
  notificacaoService.materialCompartilhado(criado)

  return paraMentor(criado, usuario, ids)
}

/** Carrega o compartilhamento e exige que seja de quem pede. */
async function carregarDoAutor(idCompartilhamento, usuario) {
  const id = Number(idCompartilhamento)
  const atual = Number.isInteger(id) && id > 0
    ? await mentorCompartilhamentoRepository.buscarPorId(id)
    : null
  if (!atual) throw erroNegocio(404, "Compartilhamento nao encontrado.")

  await rbacService.garantirPermissao(atual.id_tenant, usuario, COMPARTILHAR)
  if (Number(atual.compartilhado_por) !== Number(usuario.id)) {
    throw erroNegocio(403, "So quem compartilhou pode alterar este compartilhamento.")
  }
  return atual
}

/**
 * Muda a orientacao ou a finalidade. So o autor, e so enquanto acompanha a
 * startup: reescrever o que a startup le e agir sobre ela.
 */
async function atualizar(idCompartilhamento, corpo, usuario) {
  const atual = await carregarDoAutor(idCompartilhamento, usuario)
  const ids = await idsAcompanhados(atual.id_tenant, usuario)
  if (!acompanha(ids, atual.id_startup)) {
    throw erroNegocio(403, "Voce nao acompanha mais esta startup. Voce ainda pode remover o compartilhamento.")
  }

  const final = normalizarPatchCompartilhamento(atual, corpo)
  if (final.finalidade === "ATIVIDADE" && atual.etapa_tipo !== "PASSO") {
    throw erroNegocio(400, "So um material compartilhado num passo pode ser associado a uma atividade.")
  }

  const atualizado = await mentorCompartilhamentoRepository.atualizar(atual.id_compartilhamento, final)

  await auditLogService.registrar({
    idTenant: atual.id_tenant,
    idUsuario: usuario.id,
    acao: "EDITAR",
    entidade: "mentor_compartilhamento",
    entidadeId: String(atual.id_compartilhamento),
    descricao: `Editou o compartilhamento de "${atual.titulo}" com ${atual.startup_nome}.`,
    dadosAntes: atual,
    dadosDepois: atualizado,
  })
  return paraMentor(atualizado, usuario, ids)
}

/**
 * Tira o material da startup. O autor pode sempre — inclusive depois de deixar
 * de acompanha-la: desfazer a propria entrega so diminui o que fica exposto.
 * O material continua na biblioteca de origem.
 */
async function remover(idCompartilhamento, usuario) {
  const atual = await carregarDoAutor(idCompartilhamento, usuario)
  await mentorCompartilhamentoRepository.excluir(atual.id_compartilhamento)

  await auditLogService.registrar({
    idTenant: atual.id_tenant,
    idUsuario: usuario.id,
    acao: "EXCLUIR",
    entidade: "mentor_compartilhamento",
    entidadeId: String(atual.id_compartilhamento),
    descricao: `Removeu "${atual.titulo}" de ${atual.startup_nome} (${caminho(atual)}).`,
    dadosAntes: atual,
  })
  return { removido: true }
}

// ---------------------------------------------------------------------------
// MATERIAIS RECEBIDOS (lado da startup, na Jornada)
// ---------------------------------------------------------------------------

/**
 * O que a startup recebeu, de uma trilha ou de todas.
 *
 * Mesmo portao da Jornada: vinculo com a startup (QRN-04), sem chave RBAC — e
 * o material da propria startup, como a trilha dela. Com `idPrograma`, exige a
 * matricula, como jornadaService.resolverPrograma: trocar o id na URL nao abre
 * a trilha de outra turma.
 */
async function listarRecebidos(idStartup, idPrograma, usuario) {
  const id = Number(idStartup)
  if (!Number.isInteger(id) || id <= 0) throw erroNegocio(400, "Informe o id_startup.")
  const startup = await startupService.garantirVinculo(id, usuario)

  let programa = null
  if (idPrograma) {
    programa = Number(idPrograma)
    const matriculada =
      Number.isInteger(programa) &&
      (await trilhaRepository.startupMatriculada(startup.id_startup, programa))
    if (!matriculada) throw erroNegocio(403, "Esta startup nao esta matriculada nesta trilha.")
  }

  const linhas = await mentorCompartilhamentoRepository.listarDaStartup(startup.id_startup, programa)
  return linhas.map(paraStartup)
}

/**
 * Carrega um compartilhamento para quem tem vinculo com a startup dele. Fora
 * da trilha, ele nao existe para ninguem do lado da startup (404).
 */
async function carregarRecebido(idCompartilhamento, usuario) {
  const id = Number(idCompartilhamento)
  const row = Number.isInteger(id) && id > 0
    ? await mentorCompartilhamentoRepository.buscarPorId(id)
    : null
  if (!row) throw erroNegocio(404, "Material nao encontrado.")

  await startupService.garantirVinculo(row.id_startup, usuario)
  if (!row.matriculada) throw erroNegocio(404, "Material nao encontrado.")
  return row
}

/**
 * Um material recebido, inteiro. A AULA da Biblioteca vem com o corpo — e o
 * mesmo documento que a Jornada mostra num passo (bibliotecaRepository ja o
 * converte quando a aula ainda esta no formato antigo).
 */
async function buscarRecebido(idCompartilhamento, usuario) {
  const row = await carregarRecebido(idCompartilhamento, usuario)
  const material = paraStartup(row)

  if (row.origem === "INSTITUCIONAL" && row.tipo === "AULA") {
    const conteudo = await bibliotecaRepository.buscarPorId(row.id_conteudo)
    material.documento = conteudo?.documento ?? []
  }
  return material
}

/** Os bytes de um material pessoal compartilhado, autorizados pelo vinculo. */
async function abrirArquivoRecebido(idCompartilhamento, usuario) {
  const row = await carregarRecebido(idCompartilhamento, usuario)
  if (row.origem !== "PESSOAL" || row.tipo !== "ARQUIVO") {
    throw erroNegocio(404, "Este material nao tem arquivo para baixar.")
  }
  const material = await mentorMaterialRepository.buscarPorId(row.id_material)
  if (!material?.id_arquivo) throw erroNegocio(404, "Este material nao tem arquivo para baixar.")
  return arquivoService.carregar(material.id_arquivo, { idTenant: row.id_tenant })
}

module.exports = {
  COMPARTILHAR,
  listarIncubados,
  carregarTrilhaDoIncubado,
  listar,
  compartilhar,
  atualizar,
  remover,
  listarRecebidos,
  buscarRecebido,
  abrirArquivoRecebido,
}
