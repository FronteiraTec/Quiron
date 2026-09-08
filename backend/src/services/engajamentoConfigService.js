/**
 * Service da configuracao do engajamento: TEMPORADAS, ACOES que pontuam e
 * NIVEIS de cada liga.
 *
 * DUAS AUTORIZACOES DIFERENTES, no mesmo desenho de agendaConfigService:
 *
 *   LER   exige `engajamento.ranking.visualizar` — a mesma chave do placar. As
 *         acoes e os niveis nao sao informacao restrita: sao AS REGRAS DO
 *         JOGO. Quem disputa precisa saber quanto vale cada coisa e quanto
 *         falta para o proximo degrau, senao o ranking vira um numero sem
 *         explicacao.
 *   ESCREVER exige `engajamento.configuracao.gerenciar` — definir quanto vale
 *         participar e ato de coordenacao.
 *
 * Sem essa separacao seria preciso escolher entre dar poder de configuracao a
 * todo mundo ou esconder do participante a regra que decide o premio dele.
 */
const engajamentoRepository = require("../repositories/engajamentoRepository")
const tenantRepository = require("../repositories/tenantRepository")
const rbacService = require("./rbacService")
const auditLogService = require("./auditLogService")
const { erroNegocio } = require("../utils/erros")
const { ICONES_VALIDOS, GATILHOS, PERIODOS_TETO, LIGAS } = require("../engajamento/padroes")

const HEX = /^#[0-9a-fA-F]{6}$/
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/
const CHAVE_VALIDA = /^[A-Z0-9_]{1,40}$/

const CHAVE_LEITURA = "engajamento.ranking.visualizar"
const CHAVE_GESTAO = "engajamento.configuracao.gerenciar"

/** Deriva a chave a partir do rotulo ("Uso do coworking" -> "USO_DO_COWORKING"). */
function gerarChave(rotulo) {
  return rotulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40)
}

/** Uma chave livre no tenant (DEMO_DAY, DEMO_DAY_2, ...). */
async function chaveDisponivel(idTenant, base) {
  let candidata = base
  let n = 2
  while (await engajamentoRepository.buscarAcao(idTenant, candidata)) {
    const sufixo = `_${n}`
    candidata = `${base.slice(0, 40 - sufixo.length)}${sufixo}`
    n += 1
  }
  return candidata
}

/** Normaliza Date|string vinda do banco/cliente para 'AAAA-MM-DD'. */
function dataIso(valor) {
  if (!valor) return null
  if (typeof valor === "string") return valor.slice(0, 10)
  const d = valor instanceof Date ? valor : new Date(valor)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`
}

// ---------------------------------------------------------------------------
// TEMPORADAS
// ---------------------------------------------------------------------------

async function listarTemporadas(idTenant, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, CHAVE_LEITURA)
  return engajamentoRepository.listarTemporadas(idTenant)
}

/**
 * Valida a temporada e recusa SOBREPOSICAO.
 *
 * Duas temporadas cobrindo o mesmo dia deixariam o motor sem resposta para "em
 * qual delas este ponto cai" — e a escolha acabaria dependendo da ordem da
 * consulta. A mensagem diz COM QUAL colidiu, que e o que o admin precisa para
 * corrigir.
 */
async function validarTemporada(idTenant, dados, idIgnorar = null) {
  const nome = dados.nome?.trim()
  if (!nome) throw erroNegocio(400, "Informe o nome da temporada.")
  if (nome.length > 80) throw erroNegocio(400, "O nome deve ter no máximo 80 caracteres.")

  const inicio = dataIso(dados.inicio_dt)
  const fim = dataIso(dados.fim_dt)
  if (!inicio || !DATA_ISO.test(inicio)) throw erroNegocio(400, "Informe a data de início.")
  if (!fim || !DATA_ISO.test(fim)) throw erroNegocio(400, "Informe a data de término.")
  if (fim < inicio) throw erroNegocio(400, "O término não pode ser antes do início.")

  const colisao = await engajamentoRepository.temporadaSobreposta(idTenant, inicio, fim, idIgnorar)
  if (colisao) {
    throw erroNegocio(
      409,
      `Este período se sobrepõe à temporada "${colisao.nome}" (${dataIso(
        colisao.inicio_dt
      )} a ${dataIso(colisao.fim_dt)}).`
    )
  }
  return { nome, inicio_dt: inicio, fim_dt: fim, premiacao: dados.premiacao?.trim() || null }
}

async function criarTemporada(idTenant, dados, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, CHAVE_GESTAO)
  const limpos = await validarTemporada(idTenant, dados)

  let temporada
  try {
    temporada = await engajamentoRepository.criarTemporada(idTenant, limpos)
  } catch (err) {
    if (err.code === "23505") throw erroNegocio(409, "Já existe uma temporada com esse nome.")
    throw err
  }

  await auditLogService.registrar({
    idTenant,
    idUsuario: usuario?.id,
    acao: "CRIAR",
    entidade: "engajamento_temporada",
    entidadeId: String(temporada.id_temporada),
    descricao: `Criou a temporada "${temporada.nome}".`,
    dadosDepois: temporada,
  })
  return temporada
}

async function atualizarTemporada(idTenant, idTemporada, dados, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, CHAVE_GESTAO)

  const antes = await engajamentoRepository.buscarTemporada(idTenant, idTemporada)
  if (!antes) throw erroNegocio(404, "Temporada não encontrada.")
  const limpos = await validarTemporada(idTenant, dados, Number(idTemporada))

  let temporada
  try {
    temporada = await engajamentoRepository.atualizarTemporada(idTenant, idTemporada, limpos)
  } catch (err) {
    if (err.code === "23505") throw erroNegocio(409, "Já existe uma temporada com esse nome.")
    throw err
  }

  await auditLogService.registrar({
    idTenant,
    idUsuario: usuario?.id,
    acao: "EDITAR",
    entidade: "engajamento_temporada",
    entidadeId: String(idTemporada),
    descricao: `Editou a temporada "${temporada.nome}".`,
    dadosAntes: antes,
    dadosDepois: temporada,
  })
  return temporada
}

/**
 * Encerra/reabre. Encerrar CONGELA o resultado: a temporada para de receber
 * lancamento (o motor confere isso antes de gravar). E o que permite premiar
 * sem que uma presenca lancada depois mude o vencedor.
 */
async function alterarEncerradaTemporada(idTenant, idTemporada, encerrada, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, CHAVE_GESTAO)

  const temporada = await engajamentoRepository.alterarEncerradaTemporada(
    idTenant,
    idTemporada,
    Boolean(encerrada)
  )
  if (!temporada) throw erroNegocio(404, "Temporada não encontrada.")

  await auditLogService.registrar({
    idTenant,
    idUsuario: usuario?.id,
    acao: "EDITAR",
    entidade: "engajamento_temporada",
    entidadeId: String(idTemporada),
    descricao: `${encerrada ? "Encerrou" : "Reabriu"} a temporada "${temporada.nome}".`,
    dadosDepois: temporada,
  })
  return temporada
}

/** Quantos pontos a temporada carrega — o aviso antes de excluir. */
async function usoDaTemporada(idTenant, idTemporada, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, CHAVE_LEITURA)
  return { lancamentos: await engajamentoRepository.contarPontosDaTemporada(idTenant, idTemporada) }
}

async function excluirTemporada(idTenant, idTemporada, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, CHAVE_GESTAO)

  const antes = await engajamentoRepository.buscarTemporada(idTenant, idTemporada)
  if (!antes) throw erroNegocio(404, "Temporada não encontrada.")

  await engajamentoRepository.excluirTemporada(idTenant, idTemporada)
  await auditLogService.registrar({
    idTenant,
    idUsuario: usuario?.id,
    acao: "EXCLUIR",
    entidade: "engajamento_temporada",
    entidadeId: String(idTemporada),
    // Os pontos NAO somem junto (FK ON DELETE SET NULL): viram historico sem
    // disputa. Dizer isso no log evita a leitura de que a exclusao apagou o
    // engajamento de todo mundo.
    descricao: `Excluiu a temporada "${antes.nome}". Os lançamentos viraram histórico sem temporada.`,
    dadosAntes: antes,
  })
  return { excluida: true }
}

// ---------------------------------------------------------------------------
// ACOES
// ---------------------------------------------------------------------------

async function listarAcoes(idTenant, usuario, incluirInativas = false) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, CHAVE_LEITURA)
  if (incluirInativas) await rbacService.garantirPermissao(idTenant, usuario, CHAVE_GESTAO)
  return engajamentoRepository.listarAcoes(idTenant, incluirInativas)
}

/** Campos comuns de uma acao. */
function validarAcao(dados) {
  const rotulo = dados.rotulo?.trim()
  if (!rotulo) throw erroNegocio(400, "Informe o nome da ação.")
  if (rotulo.length > 60) throw erroNegocio(400, "O nome deve ter no máximo 60 caracteres.")

  const pontos = Number(dados.pontos)
  if (!Number.isInteger(pontos) || pontos < 0 || pontos > 1000) {
    throw erroNegocio(400, "Os pontos devem ser um número inteiro entre 0 e 1000.")
  }

  if (dados.liga && !LIGAS.includes(dados.liga)) throw erroNegocio(400, "Liga inválida.")
  if (dados.cor && !HEX.test(dados.cor)) {
    throw erroNegocio(400, "Cor inválida. Use hexadecimal, como #6366f1.")
  }
  if (dados.icone && !ICONES_VALIDOS.includes(dados.icone)) {
    throw erroNegocio(400, "Ícone inválido.")
  }

  // Teto e periodo andam juntos: teto sem janela nao diz nada.
  const teto = dados.teto_pontos === "" || dados.teto_pontos == null ? null : Number(dados.teto_pontos)
  const periodo = dados.teto_periodo || null
  if (teto !== null && (!Number.isInteger(teto) || teto <= 0)) {
    throw erroNegocio(400, "O teto deve ser um número inteiro maior que zero.")
  }
  if ((teto === null) !== (periodo === null)) {
    throw erroNegocio(400, "Informe o teto e o período do teto juntos, ou nenhum dos dois.")
  }
  if (periodo && !PERIODOS_TETO.includes(periodo)) {
    throw erroNegocio(400, "Período de teto inválido.")
  }

  return {
    rotulo,
    descricao: dados.descricao?.trim() || null,
    liga: dados.liga || null,
    pontos,
    teto_pontos: teto,
    teto_periodo: periodo,
    icone: dados.icone || "EmojiEvents",
    cor: dados.cor || "#6366f1",
    ordem: dados.ordem,
  }
}

/**
 * Cria uma acao.
 *
 * O GATILHO E ESCOLHIDO AQUI E NUNCA MAIS MUDA (ver o repositorio): ele define
 * de onde o ponto nasce, e trocar depois reescreveria o significado do que ja
 * foi pontuado.
 *
 * PRESENCA_EVENTO precisa de categoria, e so uma acao por categoria — quem
 * pergunta "quanto vale esta presenca?" tem que receber uma resposta so.
 * MENTORIA_MINISTRADA e unica no tenant pelo mesmo motivo.
 */
async function criarAcao(idTenant, dados, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, CHAVE_GESTAO)

  const gatilho = dados.gatilho || "MANUAL"
  if (!GATILHOS.includes(gatilho)) throw erroNegocio(400, "Gatilho inválido.")

  const limpos = validarAcao(dados)
  const categoria = gatilho === "PRESENCA_EVENTO" ? dados.categoria_evento : null
  if (gatilho === "PRESENCA_EVENTO" && !categoria) {
    throw erroNegocio(400, "Escolha a categoria de agenda que esta ação pontua.")
  }

  const base = gerarChave(limpos.rotulo)
  if (!CHAVE_VALIDA.test(base)) {
    throw erroNegocio(400, "O nome da ação precisa ter ao menos uma letra ou número.")
  }
  const chave = await chaveDisponivel(idTenant, base)

  let acao
  try {
    acao = await engajamentoRepository.criarAcao(idTenant, {
      ...limpos,
      chave,
      gatilho,
      categoria_evento: categoria,
    })
  } catch (err) {
    if (err.code === "23505") {
      throw erroNegocio(
        409,
        "Já existe uma ação com esse nome, ou já há uma ação pontuando essa categoria/mentoria."
      )
    }
    if (err.code === "23503") throw erroNegocio(400, "Categoria de agenda inválida.")
    throw err
  }

  await auditLogService.registrar({
    idTenant,
    idUsuario: usuario?.id,
    acao: "CRIAR",
    entidade: "engajamento_acao",
    entidadeId: chave,
    descricao: `Criou a ação "${acao.rotulo}" valendo ${acao.pontos} ponto(s).`,
    dadosDepois: acao,
  })
  return acao
}

/**
 * Atualiza a acao. Reprecificar NAO reprocessa o passado (ver o repositorio):
 * quem estava em primeiro nao pode amanhecer em terceiro sem ter feito nada.
 */
async function atualizarAcao(idTenant, chave, dados, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, CHAVE_GESTAO)

  const antes = await engajamentoRepository.buscarAcao(idTenant, chave)
  if (!antes) throw erroNegocio(404, "Ação não encontrada.")

  const limpos = validarAcao(dados)
  // A acao restrita a uma liga nao pode mudar de liga se ja pontuou: o extrato
  // de quem recebeu ficaria apontando para uma regra que nao existe mais.
  let acao
  try {
    acao = await engajamentoRepository.atualizarAcao(idTenant, chave, limpos)
  } catch (err) {
    if (err.code === "23505") throw erroNegocio(409, "Já existe uma ação com esse nome.")
    throw err
  }

  await auditLogService.registrar({
    idTenant,
    idUsuario: usuario?.id,
    acao: "EDITAR",
    entidade: "engajamento_acao",
    entidadeId: chave,
    descricao: `Editou a ação "${acao.rotulo}" (${antes.pontos} -> ${acao.pontos} ponto(s)).`,
    dadosAntes: antes,
    dadosDepois: acao,
  })
  return acao
}

async function alterarAtivoAcao(idTenant, chave, ativo, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, CHAVE_GESTAO)

  const acao = await engajamentoRepository.alterarAtivoAcao(idTenant, chave, Boolean(ativo))
  if (!acao) throw erroNegocio(404, "Ação não encontrada.")

  await auditLogService.registrar({
    idTenant,
    idUsuario: usuario?.id,
    acao: "EDITAR",
    entidade: "engajamento_acao",
    entidadeId: chave,
    // Desativar para de pontuar DALI EM DIANTE. O que ja foi pontuado fica —
    // e por isso que a acao nao pode ser excluida (FK dos pontos).
    descricao: `${ativo ? "Reativou" : "Desativou"} a ação "${acao.rotulo}".`,
    dadosDepois: acao,
  })
  return acao
}

async function usoDaAcao(idTenant, chave, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, CHAVE_LEITURA)
  return engajamentoRepository.contarPontosDaAcao(idTenant, chave)
}

// ---------------------------------------------------------------------------
// NIVEIS
// ---------------------------------------------------------------------------

async function listarNiveis(idTenant, usuario, liga = null) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, CHAVE_LEITURA)
  if (liga && !LIGAS.includes(liga)) throw erroNegocio(400, "Liga inválida.")
  return engajamentoRepository.listarNiveis(idTenant, liga)
}

/**
 * Substitui a escada inteira de uma liga.
 *
 * O PRIMEIRO DEGRAU TEM DE SER ZERO: sem isso, quem ainda nao pontuou fica sem
 * nivel nenhum, e a tela teria de inventar um estado "sem classificacao" para
 * exatamente as pessoas que o modulo existe para trazer para dentro.
 *
 * Os cortes tem de ser crescentes e distintos, senao a escada nao ordena.
 */
async function definirNiveis(idTenant, liga, niveis, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, CHAVE_GESTAO)
  if (!LIGAS.includes(liga)) throw erroNegocio(400, "Liga inválida.")
  if (!Array.isArray(niveis) || niveis.length === 0) {
    throw erroNegocio(400, "Informe ao menos um nível.")
  }
  if (niveis.length > 10) throw erroNegocio(400, "Use no máximo 10 níveis por liga.")

  const limpos = niveis.map((nivel) => {
    const nome = nivel.nome?.trim()
    if (!nome) throw erroNegocio(400, "Todo nível precisa de nome.")
    if (nome.length > 60) throw erroNegocio(400, "O nome do nível deve ter no máximo 60 caracteres.")
    const pontos = Number(nivel.pontos_min)
    if (!Number.isInteger(pontos) || pontos < 0) {
      throw erroNegocio(400, `Pontos inválidos no nível "${nome}".`)
    }
    if (nivel.cor && !HEX.test(nivel.cor)) throw erroNegocio(400, `Cor inválida no nível "${nome}".`)
    if (nivel.icone && !ICONES_VALIDOS.includes(nivel.icone)) {
      throw erroNegocio(400, `Ícone inválido no nível "${nome}".`)
    }
    return {
      nome,
      pontos_min: pontos,
      cor: nivel.cor || "#6366f1",
      icone: nivel.icone || "EmojiEvents",
    }
  })

  limpos.sort((a, b) => a.pontos_min - b.pontos_min)
  if (limpos[0].pontos_min !== 0) {
    throw erroNegocio(400, "O primeiro nível precisa começar em 0 ponto.")
  }
  for (let i = 1; i < limpos.length; i += 1) {
    if (limpos[i].pontos_min === limpos[i - 1].pontos_min) {
      throw erroNegocio(400, "Dois níveis não podem começar na mesma pontuação.")
    }
  }

  const salvos = await engajamentoRepository.substituirNiveis(idTenant, liga, limpos)
  await auditLogService.registrar({
    idTenant,
    idUsuario: usuario?.id,
    acao: "EDITAR",
    entidade: "engajamento_nivel",
    entidadeId: liga,
    descricao: `Redefiniu os ${salvos.length} níveis da liga ${liga}.`,
    dadosDepois: salvos,
  })
  return salvos
}

// ---------------------------------------------------------------------------
// LINKEDIN DA INCUBADORA
// ---------------------------------------------------------------------------

/**
 * O id da pagina da incubadora no LinkedIn, usado pela credencial de selo.
 *
 * MORA NA CONFIGURACAO DO ENGAJAMENTO, e nao em Dados Cadastrais, porque e a
 * unica coisa que ele faz: preencher `organizationId` no botao "Adicionar ao
 * perfil". Quem for procurar por ele estara olhando os selos.
 *
 * So digitos: o LinkedIn identifica a organizacao por um numero. Aceitar a URL
 * inteira geraria uma certificacao apontando para lugar nenhum, sem erro
 * visivel — o LinkedIn simplesmente ignora o parametro invalido.
 */
async function definirLinkedin(idTenant, orgId, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, CHAVE_GESTAO)

  const valor = String(orgId ?? "").trim()
  if (valor && !/^\d{1,20}$/.test(valor)) {
    throw erroNegocio(
      400,
      "Informe apenas o número identificador da página no LinkedIn (só dígitos), ou deixe em branco."
    )
  }

  const tenant = await tenantRepository.atualizarLinkedin(idTenant, valor || null)
  if (!tenant) throw erroNegocio(404, "Incubadora não encontrada.")

  await auditLogService.registrar({
    idTenant,
    idUsuario: usuario?.id,
    acao: "EDITAR",
    entidade: "tenant",
    entidadeId: String(idTenant),
    descricao: valor
      ? `Definiu a página do LinkedIn da incubadora (${valor}).`
      : "Removeu a página do LinkedIn da incubadora.",
    dadosDepois: tenant,
  })
  return tenant
}

module.exports = {
  definirLinkedin,

  listarTemporadas,
  criarTemporada,
  atualizarTemporada,
  alterarEncerradaTemporada,
  usoDaTemporada,
  excluirTemporada,

  listarAcoes,
  criarAcao,
  atualizarAcao,
  alterarAtivoAcao,
  usoDaAcao,

  listarNiveis,
  definirNiveis,
}
