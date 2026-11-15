/**
 * GRAVACAO E TRANSCRICAO das reunioes (Etapa 4 de docs/reunioes.md).
 *
 * O FLUXO, do lado da API:
 *   1. CONSENTIMENTO — antes de ligar o microfone, cada convidado aceita ou
 *      recusa ter a FALA DELE gravada. Quem recusa entra do mesmo jeito.
 *   2. GRAVACAO — o navegador de quem aceitou grava o PROPRIO microfone e
 *      manda um pedaco a cada 10 s (POST .../gravacoes, PUT .../partes/:n,
 *      POST .../fechar). Os pedacos vao para o volume `audio` da VPS.
 *   3. ENCERRAMENTO — na mesma transacao que marca a reuniao ENCERRADA nasce o
 *      job de TRANSCRICAO (`aoEncerrar`), para daqui a 10 minutos (o tempo dos
 *      ultimos pedacos chegarem). Quem transcreve e o lote noturno
 *      (reunioes/lote.js), nunca uma requisicao.
 *   4. LEITURA — a transcricao e do anfitriao e de quem tem
 *      `reunioes.transcricoes.visualizar`. Toda leitura vai para a auditoria.
 *
 * QUANDO A REUNIAO GRAVA: o anfitriao deixou `gravar_audio` ligado E a
 * incubadora tem o provedor de TRANSCRICAO configurado e ativo. Sem isso a
 * sala funciona igual, e diz "Esta reuniao nao e gravada".
 *
 * O PEDACO e conferido inteiro antes de tocar o disco: dono da gravacao,
 * consentimento ainda valido, reuniao aberta (ou encerrada ha menos de 10
 * min), tipo igual ao da gravacao, ate 512 KB, e — no pedaco 0, o unico com
 * cabecalho — os primeiros bytes do formato declarado.
 */
const { withTransaction } = require("../config/db")
const reuniaoRepository = require("../repositories/reuniaoRepository")
const gravacaoRepository = require("../repositories/reuniaoGravacaoRepository")
const processamentoRepository = require("../repositories/reuniaoProcessamentoRepository")
const iaConfigRepository = require("../repositories/iaConfigRepository")
const rbacService = require("./rbacService")
const auditLogService = require("./auditLogService")
const disco = require("../reunioes/audioDisco")
const janela = require("../reunioes/janela")
const livekit = require("../reunioes/livekit")
const { PROVEDORES_STT } = require("../reunioes/stt")
const { erroNegocio } = require("../utils/erros")
const { CHAVES, podeComChave, carregarVisivel, ehAnfitriao } = require("./reuniaoAcesso")

/** O navegador fecha um pedaco a cada tanto. */
const SEGUNDOS_POR_PARTE = 10
/** Teto de um pedaco: a ~24 kbps, 10 s dao ~30 KB. A folga cobre o Safari (AAC). */
const MAX_BYTES_PARTE = 512 * 1024
/** Depois de encerrada, a reuniao ainda aceita os ultimos pedacos por este tempo. */
const MINUTOS_APOS_ENCERRAR = 10
/** O job de transcricao espera este tanto depois do encerramento (os ultimos pedacos). */
const ESPERA_TRANSCRICAO_S = MINUTOS_APOS_ENCERRAR * 60
/** A sala abre 15 min antes; a gravacao, junto com ela. */
const MINUTOS_ANTES = 15
/** Teto de gravacoes por pessoa numa reuniao (cada reconexao abre uma). */
const MAX_GRAVACOES_POR_PESSOA = 200
/** O maior numero de pedaco aceito (10 s cada: ~11 dias). */
const MAX_PARTE = 100000

const TIPOS_AUDIO = ["audio/webm", "audio/ogg", "audio/mp4"]
const ABERTAS = ["AGENDADA", "EM_ANDAMENTO"]

const tipoBase = (mime) => String(mime || "").split(";")[0].trim().toLowerCase()

/** "HH:MM" no fuso da agenda, para as observacoes. */
function horaDaAgenda(data = new Date()) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: process.env.TZ_AGENDA || "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(data)
}

/** O consentimento desta pessoa, no formato da tela. */
function consentimentoDe(participante) {
  if (!participante) return null
  const aceito = Boolean(participante.consentiu_ts) && !participante.consentimento_revogado_ts
  return {
    decidido: Boolean(participante.consentiu_ts || participante.consentimento_revogado_ts),
    aceito,
    consentiu_ts: participante.consentiu_ts,
    revogado_ts: participante.consentimento_revogado_ts,
  }
}

const consentimentoAtivo = (participante) => Boolean(participante?.consentiu_ts) && !participante?.consentimento_revogado_ts

// ---------------------------------------------------------------------------
// ESTADO DA GRAVACAO DE UMA REUNIAO
// ---------------------------------------------------------------------------

/**
 * A reuniao grava? E, se grava, o que o aviso precisa dizer: quem transcreve
 * e por quanto tempo fica guardado.
 *
 * @returns {Promise<{disponivel: boolean, motivo: string|null, provedor: string|null,
 *   provedor_rotulo: string|null, retencao: {audio_dias: number, transcricao_dias: number}|null}>}
 */
async function estadoDaGravacao(reuniao) {
  if (!reuniao.gravar_audio) return { disponivel: false, motivo: "DESLIGADA_NA_REUNIAO", provedor: null, provedor_rotulo: null, retencao: null }
  const provedor = await iaConfigRepository.transcricaoAtiva(reuniao.id_tenant)
  if (!provedor) return { disponivel: false, motivo: "SEM_TRANSCRICAO", provedor: null, provedor_rotulo: null, retencao: null }
  const retencao = await iaConfigRepository.buscarRetencao(reuniao.id_tenant)
  return { disponivel: true, motivo: null, provedor, provedor_rotulo: PROVEDORES_STT[provedor]?.rotulo || provedor, retencao }
}

/** O atributo `gravacao` desta pessoa na sala ("sim" | "nao"). */
async function atributoDeGravacao(reuniao, participante) {
  if (!consentimentoAtivo(participante)) return "nao"
  return (await estadoDaGravacao(reuniao)).disponivel ? "sim" : "nao"
}

/**
 * O que o detalhe da reuniao mostra sobre gravacao e transcricao: o estado,
 * o consentimento de quem olha e o ultimo processamento.
 */
async function resumoParaDetalhe(reuniao, participante, usuario) {
  const [gravacao, ultimoJob, podeLer, podeVerProc, podeReprocessar] = await Promise.all([
    estadoDaGravacao(reuniao),
    processamentoRepository.ultimoDaReuniao(reuniao.id_reuniao, "TRANSCRICAO"),
    podeLerTranscricao(reuniao, usuario),
    podeVerProcessamentos(reuniao, usuario),
    usuario?.root ? true : rbacService.temPermissao(reuniao.id_tenant, usuario, CHAVES.REPROCESSAR),
  ])
  return {
    gravacao: { ...gravacao, segundos_por_parte: SEGUNDOS_POR_PARTE },
    meu_consentimento: consentimentoDe(participante),
    processamento: ultimoJob
      ? {
          id_processamento: ultimoJob.id_processamento,
          status: ultimoJob.status,
          tentativas: ultimoJob.tentativas,
          proxima_tentativa_ts: ultimoJob.proxima_tentativa_ts,
          erro_mensagem: ultimoJob.erro_mensagem,
          concluido_ts: ultimoJob.concluido_ts,
        }
      : null,
    janela_processamento: janela.resumoParaTela(),
    permissoes_transcricao: {
      ler: podeLer,
      processamentos: podeVerProc,
      reprocessar: podeReprocessar && reuniao.status === "ENCERRADA",
    },
  }
}

// ---------------------------------------------------------------------------
// CONSENTIMENTO
// ---------------------------------------------------------------------------

/**
 * Aceita ou recusa (ou retira) a gravacao da PROPRIA fala.
 *
 * So enquanto a reuniao esta aberta: e uma decisao sobre a conversa que vai
 * acontecer. Retirar no meio da reuniao fecha na hora a gravacao em curso — o
 * pedaco que chegar depois e recusado.
 */
async function consentir(idReuniao, aceito, usuario) {
  if (typeof aceito !== "boolean") throw erroNegocio(400, "Informe aceito: true ou false.")
  const { reuniao, participante } = await carregarVisivel(idReuniao, usuario)
  if (!participante) throw erroNegocio(403, "Só quem foi convidado decide sobre a gravação da própria fala.", "NAO_CONVIDADO")
  if (!ABERTAS.includes(reuniao.status)) {
    throw erroNegocio(409, "A reunião já terminou; o consentimento não muda mais.", "REUNIAO_FECHADA")
  }
  if (aceito && !(await estadoDaGravacao(reuniao)).disponivel) {
    throw erroNegocio(409, "Esta reunião não é gravada.", "GRAVACAO_INDISPONIVEL")
  }

  await gravacaoRepository.definirConsentimento(reuniao.id_reuniao, usuario.id, aceito)
  if (!aceito) await gravacaoRepository.fecharAbertasDoUsuario(reuniao.id_reuniao, usuario.id)

  await auditLogService.registrar({
    idTenant: reuniao.id_tenant,
    idUsuario: usuario.id,
    acao: aceito ? "CONSENTIR" : "RECUSAR",
    entidade: "reuniao",
    entidadeId: String(reuniao.id_reuniao),
    descricao: aceito
      ? `Aceitou a gravação da própria fala na reunião "${reuniao.titulo}".`
      : participante.consentiu_ts && !participante.consentimento_revogado_ts
        ? `Retirou o consentimento de gravação na reunião "${reuniao.titulo}".`
        : `Recusou a gravação da própria fala na reunião "${reuniao.titulo}".`,
  })

  // O selo na sala, para quem ja esta la. Falhar aqui nao desfaz a decisao.
  if (livekit.configurado()) {
    livekit
      .definirAtributos(reuniao.sala, `u-${usuario.id}`, { gravacao: aceito ? "sim" : "nao" })
      .catch((err) => console.error(`[reunioes] Selo de gravacao da reuniao ${reuniao.id_reuniao}:`, err.message))
  }

  const atualizado = await reuniaoRepository.buscarParticipante(reuniao.id_reuniao, usuario.id)
  return consentimentoDe(atualizado)
}

// ---------------------------------------------------------------------------
// GRAVACOES (o navegador de cada um)
// ---------------------------------------------------------------------------

/**
 * Abre uma gravacao. Cada faixa de microfone nova (entrada, reconexao, troca
 * de microfone) abre uma, e a anterior desta pessoa e fechada.
 */
async function abrirGravacao(idReuniao, { mime }, usuario) {
  const { reuniao, participante } = await carregarVisivel(idReuniao, usuario)
  if (!participante) throw erroNegocio(403, "Só quem foi convidado grava a própria fala.", "NAO_CONVIDADO")
  if (!ABERTAS.includes(reuniao.status)) throw erroNegocio(409, "Esta reunião já foi encerrada.", "REUNIAO_FECHADA")
  if (reuniao.segundos_para_inicio > MINUTOS_ANTES * 60) {
    throw erroNegocio(409, `A sala abre ${MINUTOS_ANTES} minutos antes do horário marcado.`, "SALA_AINDA_FECHADA")
  }
  if (!consentimentoAtivo(participante)) {
    throw erroNegocio(409, "Sem o seu consentimento, a sua fala não é gravada.", "SEM_CONSENTIMENTO")
  }
  if (!(await estadoDaGravacao(reuniao)).disponivel) {
    throw erroNegocio(409, "Esta reunião não é gravada.", "GRAVACAO_INDISPONIVEL")
  }

  const textoMime = String(mime || "").trim().toLowerCase()
  if (!TIPOS_AUDIO.includes(tipoBase(textoMime)) || textoMime.length > 60 || !/^audio\/(webm|ogg|mp4)(;[ a-z0-9=.,"-]*)?$/.test(textoMime)) {
    throw erroNegocio(400, "Formato de gravação não aceito. Use audio/webm, audio/ogg ou audio/mp4.", "FORMATO_INVALIDO")
  }
  if (!(await disco.temEspaco())) {
    throw erroNegocio(409, "O servidor está sem espaço para gravar agora. A reunião continua, sem gravação.", "SEM_ESPACO")
  }
  if ((await gravacaoRepository.contarDoUsuario(reuniao.id_reuniao, usuario.id)) >= MAX_GRAVACOES_POR_PESSOA) {
    throw erroNegocio(409, "Limite de gravações desta reunião atingido.", "LIMITE_GRAVACOES")
  }

  const idAudio = await withTransaction(async (client) => {
    await gravacaoRepository.fecharAbertasDoUsuario(reuniao.id_reuniao, usuario.id, client)
    return gravacaoRepository.criarAudio(
      { idTenant: reuniao.id_tenant, idReuniao: reuniao.id_reuniao, idUsuario: usuario.id, mime: textoMime },
      client
    )
  })

  return { id_audio: Number(idAudio), segundos_por_parte: SEGUNDOS_POR_PARTE, max_bytes: MAX_BYTES_PARTE }
}

/**
 * A gravacao desta pessoa nesta reuniao, ou 404. Nao alcanca a de outra
 * pessoa nem a de outra reuniao — o id e sequencial.
 */
async function carregarAudioProprio(idReuniao, idAudio, usuario) {
  const id = Number(idAudio)
  if (!Number.isSafeInteger(id) || id <= 0 || !usuario?.id) throw erroNegocio(404, "Gravação não encontrada.")
  const audio = await gravacaoRepository.buscarAudio(id)
  if (!audio || Number(audio.id_reuniao) !== Number(idReuniao) || Number(audio.id_usuario) !== Number(usuario.id)) {
    throw erroNegocio(404, "Gravação não encontrada.")
  }
  return audio
}

/** A reuniao ainda aceita pedaco? Aberta, ou encerrada ha menos de 10 min. */
function aceitaPedaco(reuniao, agora = Date.now()) {
  if (ABERTAS.includes(reuniao.status)) return true
  if (reuniao.status !== "ENCERRADA" || !reuniao.encerrada_ts) return false
  return agora - Date.parse(reuniao.encerrada_ts) <= MINUTOS_APOS_ENCERRAR * 60000
}

/**
 * Recebe um pedaco. Idempotente por `n`: o reenvio responde 200 sem gravar de
 * novo nem contar duas vezes.
 */
async function receberParte(idReuniao, idAudio, n, { dados, tipo }, usuario) {
  const audio = await carregarAudioProprio(idReuniao, idAudio, usuario)
  if (audio.status !== "GRAVANDO") throw erroNegocio(409, "Esta gravação já foi fechada.", "GRAVACAO_FECHADA")

  const reuniao = await reuniaoRepository.buscarPorId(audio.id_reuniao)
  if (!reuniao || !aceitaPedaco(reuniao)) throw erroNegocio(409, "A reunião já foi encerrada.", "REUNIAO_FECHADA")

  const participante = await reuniaoRepository.buscarParticipante(audio.id_reuniao, usuario.id)
  if (!consentimentoAtivo(participante)) {
    throw erroNegocio(409, "Sem o seu consentimento, a sua fala não é gravada.", "SEM_CONSENTIMENTO")
  }

  const numero = Number(n)
  if (!Number.isInteger(numero) || numero < 0 || numero > MAX_PARTE || String(n) !== String(numero)) {
    throw erroNegocio(400, "Número de pedaço inválido.")
  }
  if (!Buffer.isBuffer(dados) || dados.length === 0) throw erroNegocio(400, "O pedaço de áudio veio vazio.")
  if (dados.length > MAX_BYTES_PARTE) throw erroNegocio(413, "Pedaço de áudio maior que o permitido.")
  if (tipoBase(tipo) !== tipoBase(audio.mime)) {
    throw erroNegocio(415, `Esta gravação é ${tipoBase(audio.mime)}; o pedaço veio como ${tipoBase(tipo) || "sem tipo"}.`)
  }
  if (numero === 0 && !disco.confereAssinatura(tipoBase(audio.mime), dados)) {
    throw erroNegocio(400, "O conteúdo não é um áudio no formato declarado.", "CONTEUDO_INVALIDO")
  }

  if (!(await disco.temEspaco())) {
    await gravacaoRepository.anotarErro(audio.id_audio, `o disco do servidor encheu às ${horaDaAgenda()}`)
    throw erroNegocio(507, "O servidor está sem espaço para gravar agora.", "SEM_ESPACO")
  }

  const { novo } = await disco.gravarParte(
    { idTenant: audio.id_tenant, idReuniao: audio.id_reuniao, idAudio: audio.id_audio },
    numero,
    dados
  )
  if (novo) await gravacaoRepository.registrarParte(audio.id_audio, numero, dados.length)
  return { recebido: true, repetido: !novo }
}

/** O navegador terminou de mandar esta gravacao. Idempotente. */
async function fecharGravacao(idReuniao, idAudio, usuario) {
  const audio = await carregarAudioProprio(idReuniao, idAudio, usuario)
  await gravacaoRepository.fecharAudio(audio.id_audio)
  return { fechada: true }
}

// ---------------------------------------------------------------------------
// ENCERRAMENTO (dentro da transacao de quem encerra)
// ---------------------------------------------------------------------------

/**
 * Chamado na MESMA transacao que marca a reuniao ENCERRADA — pelo botao, pelo
 * `room_finished` do webhook ou pelo lote (reuniao esquecida aberta). Assim
 * nao existe reuniao gravada encerrada sem job de transcricao.
 *
 *   tem gravacao      -> transcricao PENDENTE + job TRANSCRICAO em 10 min
 *   gravacao desligada-> transcricao DESATIVADA
 *   senao             -> nada (a tela diz "Sem gravacao")
 */
async function aoEncerrar(reuniao, client, { esperaS = ESPERA_TRANSCRICAO_S } = {}) {
  if (await gravacaoRepository.temGravacao(reuniao.id_reuniao, client)) {
    await gravacaoRepository.definirTranscricao(reuniao.id_reuniao, "PENDENTE", null, client)
    await processamentoRepository.enfileirar(
      { idTenant: reuniao.id_tenant, idReuniao: reuniao.id_reuniao, tipo: "TRANSCRICAO", esperaS },
      client
    )
  } else if (!reuniao.gravar_audio) {
    await gravacaoRepository.definirTranscricao(reuniao.id_reuniao, "DESATIVADA", null, client)
  }
}

// ---------------------------------------------------------------------------
// TRANSCRICAO E PROCESSAMENTOS
// ---------------------------------------------------------------------------

/** Anfitriao, ou a chave de ler transcricoes (de quem e da incubadora). */
async function podeLerTranscricao(reuniao, usuario) {
  if (usuario?.root) return true
  if (ehAnfitriao(reuniao, usuario)) return true
  return rbacService.temPermissao(reuniao.id_tenant, usuario, CHAVES.TRANSCRICOES)
}

/** O historico de processamento: anfitriao, quem edita reunioes ou quem reprocessa. */
async function podeVerProcessamentos(reuniao, usuario) {
  if (usuario?.root) return true
  if (await podeComChave(reuniao, usuario, CHAVES.EDITAR)) return true
  return rbacService.temPermissao(reuniao.id_tenant, usuario, CHAVES.REPROCESSAR)
}

/** A transcricao inteira. A leitura fica na auditoria (secao 7). */
async function lerTranscricao(idReuniao, usuario) {
  const { reuniao } = await carregarVisivel(idReuniao, usuario)
  if (!(await podeLerTranscricao(reuniao, usuario))) {
    throw erroNegocio(403, "Só o anfitrião ou quem tem a permissão de ler transcrições vê esta.")
  }
  const [trechos, audios] = await Promise.all([
    gravacaoRepository.listarTrechos(reuniao.id_reuniao),
    gravacaoRepository.listarAudios(reuniao.id_reuniao),
  ])

  await auditLogService.registrar({
    idTenant: reuniao.id_tenant,
    idUsuario: usuario?.id ?? null,
    acao: "LER",
    entidade: "reuniao_transcricao",
    entidadeId: String(reuniao.id_reuniao),
    descricao: `Leu a transcrição da reunião "${reuniao.titulo}".`,
  })

  // Quem tem fala gravada, para a tela poder dizer "Ana: 12 trechos" e
  // mostrar quem nao teve a fala gravada.
  const falantes = new Map()
  for (const a of audios) {
    const f = falantes.get(a.id_usuario) || { id_usuario: a.id_usuario, nome: a.usuario_nome, gravacoes: 0, segundos: 0 }
    f.gravacoes += 1
    f.segundos += Number(a.duracao_s || 0)
    falantes.set(a.id_usuario, f)
  }

  return {
    transcricao: reuniao.transcricao,
    transcricao_obs: reuniao.transcricao_obs,
    trechos,
    falantes: [...falantes.values()],
  }
}

async function listarProcessamentos(idReuniao, usuario) {
  const { reuniao } = await carregarVisivel(idReuniao, usuario)
  if (!(await podeVerProcessamentos(reuniao, usuario))) {
    throw erroNegocio(403, "Só o anfitrião ou a coordenação vê o histórico de processamento.")
  }
  return processamentoRepository.listarPorReuniao(reuniao.id_reuniao)
}

/**
 * Pede uma nova transcricao. Roda na proxima janela da noite, como a
 * primeira. So enquanto o audio ainda esta no disco — por padrao ele e
 * apagado logo depois de transcrito.
 */
async function reprocessar(idReuniao, { tipo }, usuario) {
  const { reuniao } = await carregarVisivel(idReuniao, usuario)
  await rbacService.garantirPermissao(reuniao.id_tenant, usuario, CHAVES.REPROCESSAR)
  if (tipo === "RELATORIO") throw erroNegocio(400, "O relatório por IA chega na próxima etapa do módulo.")
  if (tipo !== "TRANSCRICAO") throw erroNegocio(400, "Informe tipo: TRANSCRICAO.")
  if (reuniao.status !== "ENCERRADA") throw erroNegocio(409, "Só se transcreve reunião encerrada.", "REUNIAO_ABERTA")

  const idProcessamento = await withTransaction(async (client) => {
    const reabertas = await gravacaoRepository.reabrirParaTranscrever(reuniao.id_reuniao, client)
    if (reabertas === 0) {
      throw erroNegocio(
        409,
        "Não há áudio guardado para transcrever de novo. O áudio é apagado depois da transcrição, conforme a retenção da incubadora.",
        "SEM_AUDIO"
      )
    }
    const id = await processamentoRepository.enfileirar(
      { idTenant: reuniao.id_tenant, idReuniao: reuniao.id_reuniao, tipo: "TRANSCRICAO", esperaS: 0, solicitadoPor: usuario?.id ?? null },
      client
    )
    if (!id) throw erroNegocio(409, "Já há uma transcrição desta reunião na fila.", "JA_NA_FILA")
    await gravacaoRepository.definirTranscricao(reuniao.id_reuniao, "PENDENTE", null, client)
    return id
  })

  await auditLogService.registrar({
    idTenant: reuniao.id_tenant,
    idUsuario: usuario?.id ?? null,
    acao: "REPROCESSAR",
    entidade: "reuniao",
    entidadeId: String(reuniao.id_reuniao),
    descricao: `Pediu nova transcrição da reunião "${reuniao.titulo}".`,
  })
  return processamentoRepository.buscar(idProcessamento)
}

/** Cancela um processamento que ainda nao comecou. */
async function cancelarProcessamento(idProcessamento, usuario) {
  const id = Number(idProcessamento)
  const job = Number.isSafeInteger(id) && id > 0 ? await processamentoRepository.buscar(id) : null
  if (!job) throw erroNegocio(404, "Processamento não encontrado.")
  // A reuniao precisa estar ao alcance, e o tenant e o dela.
  const { reuniao } = await carregarVisivel(job.id_reuniao, usuario)
  await rbacService.garantirPermissao(reuniao.id_tenant, usuario, CHAVES.REPROCESSAR)
  if (!(await processamentoRepository.cancelar(id))) {
    throw erroNegocio(409, "Só se cancela processamento que ainda não começou.", "PROCESSAMENTO_EM_CURSO")
  }
  await auditLogService.registrar({
    idTenant: reuniao.id_tenant,
    idUsuario: usuario?.id ?? null,
    acao: "CANCELAR",
    entidade: "reuniao_processamento",
    entidadeId: String(id),
    descricao: `Cancelou a ${job.tipo === "TRANSCRICAO" ? "transcrição" : "geração do relatório"} da reunião "${reuniao.titulo}".`,
  })
  return processamentoRepository.buscar(id)
}

module.exports = {
  SEGUNDOS_POR_PARTE,
  MAX_BYTES_PARTE,
  MINUTOS_APOS_ENCERRAR,
  estadoDaGravacao,
  atributoDeGravacao,
  resumoParaDetalhe,
  consentir,
  abrirGravacao,
  receberParte,
  fecharGravacao,
  aoEncerrar,
  podeLerTranscricao,
  lerTranscricao,
  listarProcessamentos,
  reprocessar,
  cancelarProcessamento,
  // Para o teste.
  aceitaPedaco,
  horaDaAgenda,
}
