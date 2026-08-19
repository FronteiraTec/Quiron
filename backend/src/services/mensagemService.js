/**
 * Service de Mensagens internas (regra de negocio).
 *
 * O canal proprio da incubadora, para o que o sistema nao sabe avisar sozinho.
 * O notificacaoService cobre os fatos que a plataforma produz (entrega enviada,
 * evento criado); aqui e uma PESSOA que decide falar, escolhe com quem, e o
 * recado aparece no sino de quem recebeu.
 *
 * DUAS CAMADAS DE PERMISSAO. `comunicacao.mensagens.enviar` diz se a pessoa
 * escreve; as chaves `enviar_*` dizem ate onde a voz dela alcanca — uma por
 * tipo de destino. Mandar recado para um colega e o caso comum; falar com a
 * incubadora inteira e um megafone, e quem tem um nao precisa ter o outro.
 *
 * RECEBER NAO PASSA POR PERMISSAO. A caixa de entrada e do proprio usuario,
 * como a Jornada: exigir chave para ler o que mandaram PARA ELE so criaria um
 * jeito novo de deixar alguem sem os avisos da incubadora. O que a leitura
 * checa e identidade (e sua?), nao autorizacao.
 *
 * O DESTINATARIO E CONGELADO NO ENVIO. A lista de pessoas e expandida uma vez,
 * na hora, e gravada linha a linha. Quem entrar na startup amanha nao recebe o
 * aviso de hoje; quem sair nao perde o que ja tinha. Ver o cabecalho da
 * migracao 012.
 */
const mensagemRepository = require("../repositories/mensagemRepository")
const startupRepository = require("../repositories/startupRepository")
const rbacRepository = require("../repositories/rbacRepository")
const tenantRepository = require("../repositories/tenantRepository")
const rbacService = require("./rbacService")
const auditLogService = require("./auditLogService")
const notificacaoService = require("./notificacaoService")
const { withTransaction } = require("../config/db")
const { erroNegocio } = require("../utils/erros")

const ASSUNTO_MAX = 150
const CORPO_MAX = 5000
// Teto de destinos escolhidos numa mensagem so. Nao e limite de PESSOAS (um
// unico destino "toda a incubadora" ja alcanca centenas): e limite de
// criterios, para o formulario nao virar uma lista infinita de chips.
const DESTINOS_MAX = 50

// A chave exigida por tipo de destino. Um tipo que nao esta aqui nao existe —
// e o mesmo conjunto do enum mensagemDestinoTipo (migracao 012).
const PERMISSAO_POR_TIPO = {
  USUARIO: "comunicacao.mensagens.enviar",
  STARTUP: "comunicacao.mensagens.enviar_startup",
  MENTORES: "comunicacao.mensagens.enviar_mentores",
  ROLE: "comunicacao.mensagens.enviar_role",
  TENANT: "comunicacao.mensagens.enviar_tenant",
}

const CHAVE_ENVIAR = "comunicacao.mensagens.enviar"
const CHAVE_VER_TODAS = "comunicacao.mensagens.visualizar"
const CHAVE_EXCLUIR = "comunicacao.mensagens.excluir"

/**
 * Le a lista de destinos do corpo da requisicao no formato interno.
 * @param {Array<{tipo:string, id_referencia?:number}>} destinos
 */
function normalizarDestinos(destinos) {
  if (!Array.isArray(destinos) || destinos.length === 0) {
    throw erroNegocio(400, "Escolha ao menos um destinatario.")
  }
  if (destinos.length > DESTINOS_MAX) {
    throw erroNegocio(400, `Escolha no maximo ${DESTINOS_MAX} destinatarios.`)
  }

  return destinos.map((d) => {
    const tipo = String(d?.tipo || "").toUpperCase()
    if (!PERMISSAO_POR_TIPO[tipo]) {
      throw erroNegocio(400, `Tipo de destinatario invalido: ${d?.tipo}.`)
    }
    const ref = d.id_referencia ?? d.idReferencia ?? null
    return { tipo, idReferencia: ref == null || ref === "" ? null : Number(ref) }
  })
}

/**
 * Confere que a referencia do destino existe DENTRO do tenant e devolve o
 * rotulo a gravar.
 *
 * Esta e a checagem que substitui a FK que `mensagem_destino.id_referencia` nao
 * tem (a coluna aponta para tres tabelas diferentes). Sem ela, daria para
 * enderecar uma mensagem a uma startup de outra incubadora — a expansao viria
 * vazia, mas o registro ficaria mentindo sobre para quem foi.
 *
 * @returns {Promise<string>} rotulo humano do destino.
 */
async function validarDestino(idTenant, { tipo, idReferencia }) {
  if (tipo === "TENANT") {
    if (idReferencia) throw erroNegocio(400, "O envio para toda a incubadora nao leva referencia.")
    const tenant = await tenantRepository.buscarPorId(idTenant)
    return `Toda a incubadora${tenant?.nome ? ` (${tenant.nome})` : ""}`
  }

  if (tipo === "MENTORES") {
    // Sem referencia = os mentores da incubadora. Com id_startup, so os que
    // acompanham aquela startup.
    if (!idReferencia) return "Mentores da incubadora"
    const startup = await startupRepository.buscarPorId(idReferencia)
    if (!startup || startup.id_tenant !== Number(idTenant)) {
      throw erroNegocio(400, "Startup invalida para esta incubadora.")
    }
    return `Mentores de ${startup.nome}`
  }

  if (tipo === "STARTUP") {
    const startup = await startupRepository.buscarPorId(idReferencia)
    if (!startup || startup.id_tenant !== Number(idTenant)) {
      throw erroNegocio(400, "Startup invalida para esta incubadora.")
    }
    return startup.nome
  }

  if (tipo === "ROLE") {
    const role = await rbacRepository.buscarRole(idTenant, idReferencia)
    if (!role) throw erroNegocio(400, "Role invalida para esta incubadora.")
    return role.nome
  }

  // USUARIO
  const pessoa = await tenantRepository.buscarUsuarioVinculado(idTenant, idReferencia)
  if (!pessoa) throw erroNegocio(400, "Usuario nao vinculado a esta incubadora.")
  return pessoa.nome
}

/**
 * Envia uma mensagem: valida, confere as permissoes de cada destino, expande a
 * lista de pessoas e grava tudo numa transacao.
 *
 * A transacao existe pelo caso ruim: se a gravacao dos destinatarios falhar no
 * meio, sobraria uma mensagem que aparece no historico do remetente e na caixa
 * de metade das pessoas — pior do que nao ter sido enviada, porque ninguem
 * desconfia de um aviso que "consta como enviado".
 *
 * @param {number} idTenant
 * @param {{id:number, root?:boolean}} usuario - quem esta enviando.
 * @param {{assunto:string, corpo:string, destinos:Array, importante?:boolean,
 *          rota?:string, enviarEmail?:boolean}} dados
 */
async function enviar(idTenant, usuario, dados) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")

  const assunto = (dados.assunto || "").trim()
  const corpo = (dados.corpo || "").trim()
  if (!assunto) throw erroNegocio(400, "Informe o assunto da mensagem.")
  if (!corpo) throw erroNegocio(400, "Escreva a mensagem antes de enviar.")
  if (assunto.length > ASSUNTO_MAX) {
    throw erroNegocio(400, `O assunto deve ter no maximo ${ASSUNTO_MAX} caracteres.`)
  }
  if (corpo.length > CORPO_MAX) {
    throw erroNegocio(400, `A mensagem deve ter no maximo ${CORPO_MAX} caracteres.`)
  }

  // Escrever vem antes de escolher para quem: sem a chave base nao ha envio,
  // por mais estreito que seja o publico.
  await rbacService.garantirPermissao(idTenant, usuario, CHAVE_ENVIAR)

  const destinos = normalizarDestinos(dados.destinos)

  // Uma checagem por tipo presente (nao por destino): tres startups escolhidas
  // sao a mesma pergunta feita tres vezes.
  for (const tipo of new Set(destinos.map((d) => d.tipo))) {
    await rbacService.garantirPermissao(idTenant, usuario, PERMISSAO_POR_TIPO[tipo])
  }

  // Valida cada destino e ja guarda o rotulo do momento do envio.
  const destinosValidados = []
  for (const destino of destinos) {
    const rotulo = await validarDestino(idTenant, destino)
    destinosValidados.push({ ...destino, rotulo })
  }

  // Expande em pessoas. O Set resolve a sobreposicao natural — quem e mentor da
  // Acme e tambem esta na role "Financeiro" recebe uma vez so.
  const ids = new Set()
  for (const destino of destinosValidados) {
    for (const id of await mensagemRepository.idsPorDestino(idTenant, destino)) {
      ids.add(id)
    }
  }
  // O remetente sai da propria lista: ele acabou de escrever, nao precisa do
  // sino piscando para se avisar. Vale principalmente no envio para o tenant
  // inteiro, onde ele esta dentro do publico sem ter escolhido isso.
  ids.delete(usuario.id)

  const idsUsuarios = [...ids]
  if (idsUsuarios.length === 0) {
    throw erroNegocio(
      400,
      "Nenhum destinatario ativo foi encontrado para os destinos escolhidos."
    )
  }

  const mensagem = await withTransaction(async (client) => {
    const criada = await mensagemRepository.criar(client, {
      idTenant,
      idRemetente: usuario.id,
      assunto,
      corpo,
      importante: Boolean(dados.importante),
      rota: dados.rota || null,
    })
    await mensagemRepository.adicionarDestinos(client, criada.id_mensagem, destinosValidados)
    await mensagemRepository.adicionarDestinatarios(client, criada.id_mensagem, idsUsuarios)
    return criada
  })

  await auditLogService.registrar({
    idTenant,
    idUsuario: usuario.id,
    acao: "ENVIAR",
    entidade: "mensagem",
    entidadeId: String(mensagem.id_mensagem),
    descricao:
      `Enviou a mensagem "${assunto}" para ${idsUsuarios.length} pessoa(s) ` +
      `(${destinosValidados.map((d) => d.rotulo).join(", ")}).`,
    dadosDepois: { ...mensagem, destinos: destinosValidados, total: idsUsuarios.length },
  })

  // O email e OPCIONAL e escolhido por quem escreve: a mensagem ja chega pelo
  // sino, e nem todo recado interno merece a caixa de entrada de trinta
  // pessoas. Vai em segundo plano, como os demais avisos (ver
  // notificacaoService): SMTP fora do ar nao pode desfazer o envio.
  if (dados.enviarEmail) {
    notificacaoService.mensagemEnviada(mensagem)
  }

  return {
    ...mensagem,
    destinos: destinosValidados,
    total_destinatarios: idsUsuarios.length,
  }
}

/**
 * A caixa de entrada do usuario logado. Sem checagem de permissao de proposito
 * (ver o cabecalho): o filtro e `md.id_usuario = <voce>`.
 */
async function caixaDeEntrada(idTenant, usuario, { limite, apenasNaoLidas } = {}) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  return mensagemRepository.listarCaixaDeEntrada(idTenant, usuario.id, {
    limite: Number(limite) || 50,
    apenasNaoLidas: apenasNaoLidas === true || apenasNaoLidas === "true",
  })
}

/** Quantas mensagens o usuario logado ainda nao leu (o badge do sino). */
async function contarNaoLidas(idTenant, usuario) {
  if (!idTenant) return 0
  return mensagemRepository.contarNaoLidas(idTenant, usuario.id)
}

/**
 * Marca uma mensagem como lida.
 *
 * O 404 aqui e literal: a linha (mensagem, usuario) so existe se a mensagem foi
 * enderecada a essa pessoa. Marcar a mensagem de outro nao e negado — nao
 * encontra nada para marcar.
 */
async function marcarLida(idMensagem, usuario) {
  const ok = await mensagemRepository.marcarLida(idMensagem, usuario.id)
  if (!ok) {
    // Ja lida tambem cai aqui, e tudo bem: o front so precisa saber que nao ha
    // mais nada pendente naquela linha.
    const existe = await mensagemRepository.buscarPorId(idMensagem)
    if (!existe) throw erroNegocio(404, "Mensagem nao encontrada.")
  }
  return { lida: true }
}

/** Zera o sino: marca como lido tudo que a pessoa tem no tenant. */
async function marcarTodasLidas(idTenant, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  const total = await mensagemRepository.marcarTodasLidas(idTenant, usuario.id)
  return { marcadas: total }
}

/**
 * O historico de envios.
 *
 * Quem tem `comunicacao.mensagens.visualizar` ve o tenant inteiro; quem so tem
 * `enviar` ve as proprias. Ninguem precisa de chave para lembrar o que ele
 * mesmo escreveu — e a chave existe para o caso oposto: ler o que os outros
 * escreveram nao e consequencia de poder escrever.
 */
async function listarEnviadas(idTenant, usuario, { limite } = {}) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")

  const veTudo = await rbacService.temPermissao(idTenant, usuario, CHAVE_VER_TODAS)
  if (!veTudo) {
    // Sem nenhuma das duas chaves a tela nao existe para essa pessoa.
    await rbacService.garantirPermissao(idTenant, usuario, CHAVE_ENVIAR)
  }

  return mensagemRepository.listarEnviadas(idTenant, {
    idRemetente: veTudo ? null : usuario.id,
    limite: Number(limite) || 100,
  })
}

/** Quem recebeu uma mensagem, e quem ja leu (detalhe do historico de envio). */
async function listarDestinatarios(idMensagem, usuario) {
  const mensagem = await mensagemRepository.buscarPorId(idMensagem)
  if (!mensagem) throw erroNegocio(404, "Mensagem nao encontrada.")

  const veTudo = await rbacService.temPermissao(mensagem.id_tenant, usuario, CHAVE_VER_TODAS)
  if (!veTudo && mensagem.id_remetente !== usuario.id && !usuario.root) {
    throw erroNegocio(403, "Voce nao tem permissao para ver os destinatarios desta mensagem.")
  }

  return mensagemRepository.listarDestinatarios(idMensagem)
}

/**
 * Exclui uma mensagem enviada — some do historico e das caixas de entrada
 * (ON DELETE CASCADE).
 *
 * O autor sempre pode apagar a propria; para apagar a de outra pessoa e preciso
 * `comunicacao.mensagens.excluir`.
 */
async function excluir(idMensagem, usuario) {
  const mensagem = await mensagemRepository.buscarPorId(idMensagem)
  if (!mensagem) throw erroNegocio(404, "Mensagem nao encontrada.")

  if (mensagem.id_remetente !== usuario.id) {
    await rbacService.garantirPermissao(mensagem.id_tenant, usuario, CHAVE_EXCLUIR)
  }

  await mensagemRepository.excluir(idMensagem)

  await auditLogService.registrar({
    idTenant: mensagem.id_tenant,
    idUsuario: usuario.id,
    acao: "EXCLUIR",
    entidade: "mensagem",
    entidadeId: String(idMensagem),
    descricao: `Excluiu a mensagem "${mensagem.assunto}".`,
    dadosAntes: mensagem,
  })
}

/**
 * O que esta pessoa pode escolher como destino — o formulario de nova mensagem
 * e montado a partir daqui.
 *
 * Cada lista so vem se a chave correspondente estiver concedida. Nao e
 * seguranca (o `enviar` refaz a checagem, e e ele que autoriza): e nao oferecer
 * na tela um publico que o envio recusaria depois.
 */
async function opcoesDeDestino(idTenant, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, CHAVE_ENVIAR)

  const [podeStartup, podeMentores, podeRole, podeTenant] = await Promise.all([
    rbacService.temPermissao(idTenant, usuario, PERMISSAO_POR_TIPO.STARTUP),
    rbacService.temPermissao(idTenant, usuario, PERMISSAO_POR_TIPO.MENTORES),
    rbacService.temPermissao(idTenant, usuario, PERMISSAO_POR_TIPO.ROLE),
    rbacService.temPermissao(idTenant, usuario, PERMISSAO_POR_TIPO.TENANT),
  ])

  // As startups aparecem se a pessoa puder falar com os membros OU com os
  // mentores de uma delas — sao dois destinos diferentes sobre a mesma lista.
  const [startups, roles, pessoas] = await Promise.all([
    podeStartup || podeMentores ? startupRepository.listarPorTenant(idTenant) : [],
    podeRole ? rbacRepository.listarRoles(idTenant) : [],
    tenantRepository.listarUsuarios(idTenant),
  ])

  return {
    pode: {
      startup: podeStartup,
      mentores: podeMentores,
      role: podeRole,
      tenant: podeTenant,
      // Sempre true aqui: a chave base ja foi exigida acima.
      usuario: true,
    },
    startups: startups.map((s) => ({ id_startup: s.id_startup, nome: s.nome, status: s.status })),
    roles: roles.map((r) => ({ id_role: r.id_role, nome: r.nome, total_usuarios: r.total_usuarios })),
    // A propria pessoa fica de fora da lista: mandar mensagem para si mesmo nao
    // avisa nada a ninguem (o envio a removeria dos destinatarios de qualquer
    // forma), e so ocuparia a primeira linha do seletor.
    pessoas: pessoas
      .filter((p) => p.ativo && p.id_usuario !== usuario.id)
      .map((p) => ({ id_usuario: p.id_usuario, nome: p.nome, email: p.email, papel: p.papel })),
  }
}

module.exports = {
  enviar,
  caixaDeEntrada,
  contarNaoLidas,
  marcarLida,
  marcarTodasLidas,
  listarEnviadas,
  listarDestinatarios,
  excluir,
  opcoesDeDestino,
}
