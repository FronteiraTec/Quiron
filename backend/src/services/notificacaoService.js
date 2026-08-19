/**
 * Service de Notificacoes por email.
 *
 * Um lugar so para responder "quem recebe o que" nos avisos do sistema:
 *
 *   entrega enviada   -> os mentores que acompanham a startup
 *   entrega avaliada  -> os membros ativos da startup
 *   evento criado     -> o publico do evento (geral ou startups direcionadas)
 *   feedback enviado  -> presidencia da FronteiraTec (endereco fixo)
 *   mensagem interna  -> quem a mensagem alcancou (so se o autor pediu email)
 *
 * DISPARO EM SEGUNDO PLANO. Todas as funcoes exportadas retornam imediatamente
 * e nunca lancam: notificar e efeito colateral do fato, nao parte dele. Um SMTP
 * fora do ar nao pode fazer a startup perder a entrega que acabou de enviar,
 * nem desfazer a devolutiva que o mentor escreveu.
 */
const startupRepository = require("../repositories/startupRepository")
const eventoRepository = require("../repositories/eventoRepository")
const trilhaRepository = require("../repositories/trilhaRepository")
const tenantRepository = require("../repositories/tenantRepository")
const usuarioRepository = require("../repositories/usuarioRepository")
const mensagemRepository = require("../repositories/mensagemRepository")
const { enviarEmail, layout, escapar } = require("../utils/email")

// URL base do frontend, usada nos links dos avisos.
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost"

// Rotulo humano de cada resultado de avaliacao (ver STATUS_VALIDOS).
const RESULTADO = {
  APROVADO: "aprovada",
  REPROVADO: "reprovada",
  AJUSTE: "devolvida para ajuste",
}

/**
 * Remetente configurado pela incubadora, com fallback para o padrao.
 *
 * Difere do resolverRemetente do authService: la o tenant e descoberto a partir
 * do usuario (na recuperacao de senha ninguem esta logado); aqui o fato ja
 * aconteceu dentro de um tenant conhecido.
 */
async function resolverRemetente(idTenant) {
  if (!idTenant) return {}
  const tenant = await tenantRepository.buscarPorId(idTenant)
  if (!tenant?.email_remetente) return {}

  const from = tenant.email_remetente_nome
    ? `${tenant.email_remetente_nome} <${tenant.email_remetente}>`
    : tenant.email_remetente

  return { from, replyTo: tenant.email_reply_to || undefined }
}

/**
 * Executa o envio sem prender quem chamou e engolindo qualquer erro — so
 * deixando o rastro no log.
 * @param {string} contexto - Identifica o aviso no log.
 * @param {() => Promise<any>} tarefa
 */
function emSegundoPlano(contexto, tarefa) {
  Promise.resolve()
    .then(tarefa)
    .catch((err) => {
      console.error(`[notificacao] Falha ao enviar aviso (${contexto}):`, err.message)
    })
}

/** Data/hora em formato brasileiro para exibir no corpo do email. */
function formatarData(ts) {
  if (!ts) return ""
  return new Date(ts).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  })
}

/** Emails validos de uma lista de pessoas. */
function emails(pessoas) {
  return pessoas.map((p) => p.email).filter(Boolean)
}

// ---------------------------------------------------------------------------
// ENTREGA ENVIADA -> mentores da startup
// ---------------------------------------------------------------------------

/**
 * Avisa os mentores de que ha uma entrega esperando avaliacao.
 *
 * Vale tanto para o primeiro envio quanto para o reenvio apos ajuste: nos dois
 * casos a entrega volta para a fila do mentor.
 *
 * @param {{idStartup:number, idNo:number, idUsuario:number, reenvio?:boolean}} dados
 */
function entregaEnviada({ idStartup, idNo, idUsuario, reenvio = false }) {
  emSegundoPlano(`entrega ${reenvio ? "reenviada" : "enviada"} startup=${idStartup}`, async () => {
    const [startup, passo, mentores, autor] = await Promise.all([
      startupRepository.buscarPorId(idStartup),
      trilhaRepository.buscarPorId(idNo),
      startupRepository.listarMentores(idStartup),
      idUsuario ? usuarioRepository.buscarPorId(idUsuario) : null,
    ])

    const destinatarios = emails(mentores)
    // Startup sem mentor vinculado ainda cai na fila do admin, mas nao ha a
    // quem escrever: sair aqui evita montar um email sem destinatario.
    if (destinatarios.length === 0) return

    const nomeStartup = escapar(startup?.nome || "Uma startup")
    const nomePasso = escapar(passo?.nome || "um passo da trilha")
    const verbo = reenvio ? "reenviou" : "enviou"

    await enviarEmail({
      para: destinatarios,
      assunto:
        `${reenvio ? "Entrega reenviada por" : "Nova entrega de"} ` +
        `${startup?.nome || "startup"} - ${passo?.nome || "trilha"}`,
      remetente: await resolverRemetente(startup?.id_tenant),
      html: layout({
        titulo: reenvio ? "Entrega reenviada" : "Nova entrega para avaliar",
        paragrafos: [
          `<strong>${nomeStartup}</strong> ${verbo} uma entrega no passo <strong>${nomePasso}</strong>.`,
          autor ? `Enviada por ${escapar(autor.nome)}.` : "",
          reenvio ? "Esta entrega ja havia sido devolvida para ajuste." : "",
        ].filter(Boolean),
        acao: { texto: "Avaliar entrega", url: `${FRONTEND_URL}/entregas` },
        rodape: "Voce recebeu este aviso porque acompanha esta startup no Quiron.",
      }),
    })
  })
}

// ---------------------------------------------------------------------------
// ENTREGA AVALIADA -> membros da startup
// ---------------------------------------------------------------------------

/**
 * Avisa a startup de que o mentor respondeu a entrega.
 *
 * Vai para todos os membros ativos, nao so para quem enviou: a entrega e da
 * startup, e quem precisa agir sobre um pedido de ajuste pode nao ser a mesma
 * pessoa que submeteu.
 *
 * @param {{entrega:object, avaliacao:object, idAvaliador:number}} dados
 */
function entregaAvaliada({ entrega, avaliacao, idAvaliador }) {
  emSegundoPlano(`avaliacao entrega=${entrega?.id_entrega}`, async () => {
    const [startup, passo, membros, avaliador] = await Promise.all([
      startupRepository.buscarPorId(entrega.id_startup),
      trilhaRepository.buscarPorId(entrega.id_no),
      startupRepository.listarMembros(entrega.id_startup),
      idAvaliador ? usuarioRepository.buscarPorId(idAvaliador) : null,
    ])

    const destinatarios = emails(membros)
    if (destinatarios.length === 0) return

    const nomePasso = escapar(passo?.nome || "um passo da trilha")
    const resultado = RESULTADO[avaliacao.status] || "avaliada"
    const comentario = (avaliacao.comentario || "").trim()

    await enviarEmail({
      para: destinatarios,
      assunto: `Sua entrega foi ${resultado} - ${passo?.nome || "trilha"}`,
      remetente: await resolverRemetente(startup?.id_tenant),
      html: layout({
        titulo: "Voce recebeu uma devolutiva",
        paragrafos: [
          `A entrega do passo <strong>${nomePasso}</strong> foi <strong>${resultado}</strong>` +
            (avaliador ? ` por ${escapar(avaliador.nome)}` : "") + ".",
          avaliacao.nota != null ? `Nota: <strong>${escapar(avaliacao.nota)}</strong>.` : "",
          // O comentario e o conteudo util do aviso quando ha ajuste a fazer:
          // sem ele a startup precisa entrar no sistema so para descobrir o que
          // mudar.
          comentario
            ? `<blockquote style="border-left:3px solid #e5e7eb;margin:16px 0;
                                  padding:4px 0 4px 12px;color:#4b5563;">
                 ${escapar(comentario).replace(/\n/g, "<br>")}
               </blockquote>`
            : "",
        ].filter(Boolean),
        acao: { texto: "Ver na jornada", url: `${FRONTEND_URL}/jornada` },
      }),
    })
  })
}

// ---------------------------------------------------------------------------
// EVENTO CRIADO -> publico do evento
// ---------------------------------------------------------------------------

/**
 * Avisa o publico de um evento recem-criado.
 *
 * O publico sai de eventoRepository.listarPublico — a mesma consulta da lista
 * de chamada. Assim o convite vai exatamente para quem depois aparece na tela
 * de presenca, respeitando o direcionamento por startup.
 *
 * @param {object} evento - Linha ja persistida (id_evento, id_tenant, titulo...).
 */
function eventoCriado(evento) {
  emSegundoPlano(`evento=${evento?.id_evento}`, async () => {
    const publico = await eventoRepository.listarPublico(evento.id_evento)
    const destinatarios = emails(publico)
    if (destinatarios.length === 0) return

    const quando = formatarData(evento.inicio_ts)

    await enviarEmail({
      para: destinatarios,
      assunto: `Novo evento: ${evento.titulo}`,
      remetente: await resolverRemetente(evento.id_tenant),
      html: layout({
        titulo: escapar(evento.titulo),
        paragrafos: [
          evento.obrigatorio
            ? "Um novo evento <strong>obrigatorio</strong> foi agendado na sua incubadora."
            : "Um novo evento foi agendado na sua incubadora.",
          quando ? `<strong>Quando:</strong> ${quando}` : "",
          evento.local ? `<strong>Onde:</strong> ${escapar(evento.local)}` : "",
          evento.mentor_nome ? `<strong>Responsavel:</strong> ${escapar(evento.mentor_nome)}` : "",
          evento.descricao ? escapar(evento.descricao).replace(/\n/g, "<br>") : "",
        ].filter(Boolean),
        acao: { texto: "Ver na agenda", url: `${FRONTEND_URL}/eventos` },
      }),
    })
  })
}

// ---------------------------------------------------------------------------
// FEEDBACK ENVIADO -> presidencia da FronteiraTec
// ---------------------------------------------------------------------------

// Destino fixo: feedback e sobre a plataforma como um todo, nao sobre uma
// incubadora especifica, entao nao usa o email configuravel do tenant.
const EMAIL_PRESIDENCIA = "presidente@fronteiratec.com"

/**
 * Avisa a presidencia de que um usuario enviou feedback pela plataforma.
 *
 * O replyTo vai para o proprio autor do feedback (nao para o remetente da
 * incubadora): assim quem recebe pode responder diretamente a pessoa, sem
 * precisar abrir o sistema pra descobrir o email de ninguem.
 *
 * @param {{id_feedback:number, id_usuario:number, id_tenant?:number, mensagem:string, criado_ts:string}} feedback
 */
function feedbackEnviado(feedback) {
  emSegundoPlano(`feedback=${feedback?.id_feedback}`, async () => {
    const [autor, tenant] = await Promise.all([
      usuarioRepository.buscarPorId(feedback.id_usuario),
      feedback.id_tenant ? tenantRepository.buscarPorId(feedback.id_tenant) : null,
    ])

    await enviarEmail({
      para: EMAIL_PRESIDENCIA,
      assunto: `Novo feedback${autor ? ` de ${autor.nome}` : ""} - Quiron`,
      remetente: { replyTo: autor?.email || undefined },
      html: layout({
        titulo: "Novo feedback recebido",
        paragrafos: [
          autor ? `<strong>${escapar(autor.nome)}</strong> (${escapar(autor.email)})` : "Um usuario",
          tenant ? `Incubadora: <strong>${escapar(tenant.nome)}</strong>.` : "",
          `<blockquote style="border-left:3px solid #e5e7eb;margin:16px 0;
                              padding:4px 0 4px 12px;color:#4b5563;">
             ${escapar(feedback.mensagem).replace(/\n/g, "<br>")}
           </blockquote>`,
        ].filter(Boolean),
        rodape: "Responda este email para falar diretamente com quem enviou.",
      }),
    })
  })
}

// ---------------------------------------------------------------------------
// MENSAGEM INTERNA -> quem ela alcancou
// ---------------------------------------------------------------------------

/**
 * Repete por email uma mensagem interna, quando quem escreveu pediu.
 *
 * Diferente dos outros avisos deste arquivo, este NAO e automatico: a mensagem
 * ja chega pelo sino, e mandar toda conversa interna para a caixa de entrada de
 * trinta pessoas ensina todo mundo a ignorar os emails do sistema. Por isso o
 * envio depende da opcao marcada no formulario (ver mensagemService.enviar).
 *
 * A lista de destinatarios sai da propria tabela de entrega — o instantaneo ja
 * congelado no envio —, e nao de uma nova expansao dos destinos: o email vai
 * exatamente para quem tem a mensagem na caixa.
 *
 * @param {{id_mensagem:number, id_tenant:number, id_remetente:number,
 *          assunto:string, corpo:string, importante?:boolean}} mensagem
 */
function mensagemEnviada(mensagem) {
  emSegundoPlano(`mensagem=${mensagem?.id_mensagem}`, async () => {
    const [destinatarios, autor] = await Promise.all([
      mensagemRepository.listarDestinatarios(mensagem.id_mensagem),
      mensagem.id_remetente ? usuarioRepository.buscarPorId(mensagem.id_remetente) : null,
    ])

    const para = emails(destinatarios)
    if (para.length === 0) return

    await enviarEmail({
      para,
      assunto: mensagem.importante ? `[Importante] ${mensagem.assunto}` : mensagem.assunto,
      remetente: await resolverRemetente(mensagem.id_tenant),
      html: layout({
        titulo: escapar(mensagem.assunto),
        paragrafos: [
          autor ? `Mensagem de <strong>${escapar(autor.nome)}</strong>:` : "Mensagem da sua incubadora:",
          escapar(mensagem.corpo).replace(/\n/g, "<br>"),
        ],
        acao: { texto: "Ver no Quiron", url: `${FRONTEND_URL}/mensagens` },
        rodape: "Voce recebeu este aviso porque a mensagem foi enderecada a voce no Quiron.",
      }),
    })
  })
}

module.exports = { entregaEnviada, entregaAvaliada, eventoCriado, feedbackEnviado, mensagemEnviada }
