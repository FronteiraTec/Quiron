/**
 * Service de Entregas (regra de negocio).
 *
 * Alem da entrega simples (texto/arquivo), trata a entrega de QUESTIONARIO:
 * valida as respostas contra a estrutura do questionario (obrigatoriedade,
 * tipo da pergunta e pertencimento das alternativas) e persiste tudo. Quando
 * o questionario e uma PROVA, corrige as respostas contra o gabarito.
 */
const entregaRepository = require("../repositories/entregaRepository")
const trilhaRepository = require("../repositories/trilhaRepository")
const questionarioRepository = require("../repositories/questionarioRepository")
const startupRepository = require("../repositories/startupRepository")
const tenantRepository = require("../repositories/tenantRepository")
const rbacService = require("./rbacService")
const startupService = require("./startupService")
const notificacaoService = require("./notificacaoService")
const prova = require("../questionarios/prova")
const { erroNegocio } = require("../utils/erros")

const TIPOS_TEXTO = ["TEXTO_CURTO", "PARAGRAFO"]
const TIPOS_ESCOLHA = ["ESCOLHA_UNICA", "CAIXAS_SELECAO"]

/**
 * Agrupa as alternativas marcadas por pergunta, no formato que
 * `prova.corrigir` le. Caixas de selecao geram um par por alternativa.
 * @param {Array<[number, number|null]>} pares - [id_pergunta, id_alternativa]
 */
function marcadasPorPergunta(pares) {
  const mapa = new Map()
  for (const [idPergunta, idAlternativa] of pares) {
    if (idAlternativa == null) continue
    if (!mapa.has(idPergunta)) mapa.set(idPergunta, [])
    mapa.get(idPergunta).push(idAlternativa)
  }
  return mapa
}

/** Lista as entregas de uma startup — para quem tem vinculo com ela (QRN-04). */
async function listar(idStartup, usuario) {
  if (!idStartup) throw erroNegocio(400, "Informe o id_startup.")
  await startupService.garantirVinculo(idStartup, usuario)
  return entregaRepository.listarPorStartup(idStartup)
}

/**
 * Situacao da entrega para quem avalia.
 *
 * O reenvio apaga as avaliacoes anteriores, entao "ENVIADA sem avaliacao" ja
 * quer dizer "esperando o mentor" — tanto na primeira entrega quanto depois
 * de um pedido de ajuste atendido.
 */
function comSituacao(entrega) {
  return { ...entrega, situacao: entrega.avaliacao_status || "PENDENTE" }
}

/**
 * Fila de avaliacao do mentor: as entregas enviadas que esperam resposta.
 *
 * O recorte segue o mesmo criterio de startupService.listar — o mentor ve as
 * startups que acompanha, o admin ve o tenant inteiro — com uma diferenca: aqui
 * o vinculo que vale e so o de MENTOR. Ser membro de uma startup nao coloca a
 * entrega dela na sua fila de avaliacao.
 *
 * @param {number} idTenant
 * @param {number} idUsuario - usuario autenticado.
 */
async function listarFila(idTenant, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")

  // Ver a fila exige a chave. Ate a migracao 005 aceitava tambem o papel
  // (mentor/admin passavam direto), porque as roles padrao nao existiam e
  // exigir a chave deixaria todo mentor de fora.
  await rbacService.garantirPermissao(idTenant, usuario, "avaliacoes.entregas.visualizar")

  const papel = await tenantRepository.buscarPapel(idTenant, usuario.id)

  // Admin e root enxergam o tenant inteiro; os demais, so o que acompanham.
  const veTudo = usuario.root || papel === "admin"
  const idsPermitidos = veTudo
    ? null
    : await startupRepository.listarIdsPorMentor(idTenant, usuario.id)

  const fila = await entregaRepository.listarFila(idTenant, idsPermitidos)
  return fila.map(comSituacao)
}

/**
 * Busca uma entrega pelo id, incluindo suas respostas. A startup vem da
 * propria entrega, e quem le precisa ter vinculo com ela (QRN-04).
 */
async function buscar(id, usuario) {
  const entrega = await entregaRepository.buscarPorId(id)
  if (!entrega) throw erroNegocio(404, "Entrega nao encontrada.")
  await startupService.garantirVinculo(entrega.id_startup, usuario)
  const respostas = await entregaRepository.listarRespostasPorEntrega(id)
  return { ...entrega, respostas }
}

/**
 * Entrega com todo o contexto do painel de avaliacao: passo, startup, autor,
 * ultima avaliacao e — quando o passo e um questionario — as respostas. Se o
 * questionario for uma prova, vem tambem a correcao, com o gabarito: quem
 * chega aqui e quem avalia.
 *
 * O tenant nao vem do cliente: e lido da startup da propria entrega. Confiar
 * num id_tenant enviado na requisicao deixaria qualquer um alegar ser admin de
 * outra incubadora para ler o trabalho de uma startup alheia.
 */
async function buscarDetalhe(id, usuario) {
  const entrega = await entregaRepository.buscarDetalhe(id)
  if (!entrega) throw erroNegocio(404, "Entrega nao encontrada.")

  const startup = await startupRepository.buscarPorId(entrega.id_startup)
  const idTenant = startup?.id_tenant

  // A chave diz se pode ler entregas de startup; o vinculo diz de QUAIS.
  await rbacService.garantirPermissao(idTenant, usuario, "avaliacoes.entregas.visualizar")

  const papel = await tenantRepository.buscarPapel(idTenant, usuario.id)
  if (!usuario.root && papel !== "admin") {
    // Ter a chave nao e poder ler QUALQUER entrega: o vinculo com a startup e
    // o que delimita o que cada mentor enxerga.
    const ehMentor = await startupRepository.ehMentorDe(entrega.id_startup, usuario.id)
    if (!ehMentor) throw erroNegocio(403, "Voce nao acompanha esta startup.")
  }

  const respostas = await entregaRepository.listarRespostasPorEntrega(id)

  // Corrige contra o questionario que foi RESPONDIDO (o das perguntas), e nao
  // o que o passo aponta hoje: o passo pode ter trocado de questionario depois
  // da entrega. Sem respostas (entrega de texto), nao ha o que corrigir.
  let resultado = null
  if (respostas.length > 0) {
    const questionario = await questionarioRepository.buscarPorIdComPerguntas(
      respostas[0].id_questionario
    )
    if (questionario?.prova) {
      resultado = prova.corrigir(
        questionario.perguntas,
        marcadasPorPergunta(respostas.map((r) => [r.id_pergunta, r.id_alternativa]))
      )
    }
  }

  return { ...comSituacao(entrega), respostas, resultado }
}

/**
 * Cria uma entrega simples (texto/arquivo). O id_usuario vem do token.
 */
async function criar(dados, usuario) {
  const { idNo, idStartup, idUsuario } = dados
  if (!idNo || !idStartup || !idUsuario) {
    throw erroNegocio(400, "Informe id_no e id_startup.")
  }
  await startupService.garantirMembro(idStartup, usuario)

  const passo = await exigirPasso(idNo)
  if (!passo.permite_entrega) {
    throw erroNegocio(400, `O passo "${passo.nome}" nao aceita entregas.`)
  }

  const entrega = await entregaRepository.criar(dados)

  // Nasce ENVIADA (default da coluna status), ou seja: ja esta na fila do
  // mentor. Por isso avisa aqui tambem, e nao so no fluxo da jornada.
  notificacaoService.entregaEnviada({ idStartup, idNo, idUsuario })

  return entrega
}

/**
 * Garante que o no existe e e um PASSO. Fase e modulo sao agrupadores: nao
 * ha o que entregar neles.
 */
async function exigirPasso(idNo) {
  const no = await trilhaRepository.buscarPorId(idNo)
  if (!no) throw erroNegocio(404, "Passo da trilha nao encontrado.")
  if (no.tipo !== "PASSO") {
    throw erroNegocio(400, "So e possivel entregar em um PASSO da trilha.")
  }
  return no
}

/**
 * Registra as respostas de uma tarefa do tipo QUESTIONARIO.
 *
 * @param {object} dados
 * @param {number} dados.idNo - O PASSO da trilha respondido.
 * @param {number} dados.idStartup
 * @param {number} dados.idUsuario - Autor (vem do token).
 * @param {Array<{idPergunta:number, texto?:string, alternativas?:number[]}>} dados.respostas
 * @param {{id:number, root?:boolean}} usuario - autenticado; precisa ser membro.
 * @returns {Promise<{entrega:object, resultado:object|null}>} A entrega criada
 *   e, se o questionario for uma prova, a nota — sem o gabarito.
 */
async function responderQuestionario({ idNo, idStartup, idUsuario, respostas }, usuario) {
  if (!idNo || !idStartup) {
    throw erroNegocio(400, "Informe id_no e id_startup.")
  }
  await startupService.garantirMembro(idStartup, usuario)

  const passo = await exigirPasso(idNo)
  if (passo.tipo_passo !== "QUESTIONARIO" || !passo.id_questionario) {
    throw erroNegocio(400, "Este passo nao possui questionario.")
  }

  const questionario = await questionarioRepository.buscarPorIdComPerguntas(passo.id_questionario)
  if (!questionario) throw erroNegocio(404, "Questionario nao encontrado.")

  // Indexa as respostas recebidas por pergunta para consulta rapida.
  const respostasPorPergunta = new Map()
  for (const r of respostas || []) {
    respostasPorPergunta.set(Number(r.idPergunta), r)
  }

  // Valida cada pergunta e monta as linhas a persistir.
  const linhas = []
  for (const pergunta of questionario.perguntas) {
    const resposta = respostasPorPergunta.get(pergunta.id_pergunta)

    if (TIPOS_TEXTO.includes(pergunta.tipo)) {
      const texto = (resposta?.texto || "").trim()
      if (!texto) {
        if (pergunta.obrigatoria) {
          throw erroNegocio(400, `Responda a pergunta obrigatoria: "${pergunta.pergunta}".`)
        }
        continue // pergunta opcional sem resposta: ignora.
      }
      linhas.push({ idPergunta: pergunta.id_pergunta, textoResposta: texto })
      continue
    }

    if (TIPOS_ESCOLHA.includes(pergunta.tipo)) {
      const marcadas = (resposta?.alternativas || []).map(Number)
      // Escolha unica aceita no maximo uma alternativa marcada.
      if (pergunta.tipo === "ESCOLHA_UNICA" && marcadas.length > 1) {
        throw erroNegocio(400, `A pergunta "${pergunta.pergunta}" aceita apenas uma alternativa.`)
      }
      if (marcadas.length === 0) {
        if (pergunta.obrigatoria) {
          throw erroNegocio(400, `Responda a pergunta obrigatoria: "${pergunta.pergunta}".`)
        }
        continue
      }
      // Cada alternativa marcada precisa pertencer a esta pergunta.
      const idsValidos = new Set(pergunta.alternativas.map((a) => a.id_alternativa))
      for (const idAlt of marcadas) {
        if (!idsValidos.has(idAlt)) {
          throw erroNegocio(400, `Alternativa invalida na pergunta "${pergunta.pergunta}".`)
        }
        linhas.push({ idPergunta: pergunta.id_pergunta, idAlternativa: idAlt })
      }
    }
  }

  if (linhas.length === 0) {
    throw erroNegocio(400, "Nenhuma resposta informada.")
  }

  const entrega = await entregaRepository.criarComRespostas({
    idNo,
    idStartup,
    idUsuario,
    respostas: linhas,
  })

  notificacaoService.entregaEnviada({ idStartup, idNo, idUsuario })

  const resultado = questionario.prova
    ? prova.resumoParaQuemResponde(
        prova.corrigir(
          questionario.perguntas,
          marcadasPorPergunta(linhas.map((l) => [l.idPergunta, l.idAlternativa]))
        )
      )
    : null

  return { entrega, resultado }
}

module.exports = { listar, listarFila, buscar, buscarDetalhe, criar, responderQuestionario }
