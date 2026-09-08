/**
 * Service da integracao com o Google Agenda (regra de negocio).
 *
 * O QUE ELA FAZ: cada pessoa conecta a PROPRIA conta Google e passa a receber,
 * numa agenda separada chamada "Quiron", os eventos que ela ja enxerga na
 * agenda do sistema. Criou, editou ou excluiu aqui, muda la.
 *
 * DIRECAO UNICA: Quiron -> Google. O que a pessoa fizer do lado do Google
 * (mover, apagar, criar um evento na agenda "Quiron") nao volta. A proxima
 * edicao aqui sobrescreve o que ela mexeu la, e isso e proposital: a agenda da
 * incubadora e a fonte da verdade, e uma mentoria remarcada por engano no
 * celular de um participante nao pode virar a versao oficial para ninguem.
 *
 * ISOLAMENTO DE FALHA (mesmo principio do notificacaoService): os ganchos
 * chamados pelo eventoService retornam na hora e nunca lancam. O Google fora
 * do ar, uma cota estourada ou uma autorizacao revogada nao podem impedir a
 * incubadora de criar o evento — sincronizar e efeito colateral do fato, nao
 * parte dele. E a falha de UMA pessoa nao interrompe as demais: o laco trata
 * cada conta por conta.
 */
const crypto = require("crypto")
const jwt = require("jsonwebtoken")

const googleApi = require("../utils/googleApi")
const googleAgendaRepository = require("../repositories/googleAgendaRepository")
const eventoRepository = require("../repositories/eventoRepository")
const { erroNegocio } = require("../utils/erros")

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost"

// Fuso declarado ao Google para cada evento. As colunas inicio_ts/fim_ts sao
// TIMESTAMP sem fuso — guardam hora de parede ("14h") — entao alguem precisa
// dizer 14h ONDE. Sem isso o Google assume o fuso do calendario e a mentoria
// aparece no horario errado para quem estiver viajando.
const FUSO = process.env.TZ_AGENDA || "America/Sao_Paulo"

// Nome da agenda secundaria criada na conta da pessoa.
const NOME_CALENDARIO = "Quiron"
const DESCRICAO_CALENDARIO =
  "Eventos da sua incubadora, sincronizados automaticamente pelo Quiron. " +
  "Alteracoes feitas aqui sao sobrescritas pelo sistema."

// Duracao assumida quando o evento nao tem fim. O Google EXIGE `end`; assumir
// uma hora e melhor que recusar o envio de um evento que o Quiron aceita sem
// hora de termino.
const DURACAO_PADRAO_MIN = 60

// Janela da sincronizacao manual. Uma agenda serve para o que vem; a semana
// para tras entra so para o passado recente nao sumir de vista de quem acabou
// de conectar.
const DIAS_PARA_TRAS = 7
const DIAS_PARA_FRENTE = 180

// ---------------------------------------------------------------------------
// STATE DO OAUTH
//
// O callback do Google chega pelo NAVEGADOR, sem cabecalho Authorization: nao
// da para saber quem e a pessoa pelo token de sessao. O `state` resolve isso —
// e um token curto, assinado por nos, que vai na ida e volta identificando
// quem comecou o fluxo. De quebra e a defesa contra CSRF que o proprio
// protocolo pede.
//
// SEGREDO PROPRIO, DERIVADO DO JWT_SECRET. Se o state fosse assinado com o
// segredo das sessoes, ele SERIA uma sessao: o `verificarToken` do
// middlewares/auth aceitaria o mesmo valor como Bearer Token, e o state
// trafega em URL — ou seja, em historico de navegador, log de proxy e cabecalho
// Referer. Com o HMAC abaixo, um state vazado nao autentica nada, e um token de
// sessao vazado nao serve de state.
// ---------------------------------------------------------------------------
const SEGREDO_STATE = crypto
  .createHmac("sha256", process.env.JWT_SECRET || "")
  .update("google-oauth-state")
  .digest("hex")

// Vale so o tempo de a pessoa ler a tela de consentimento e clicar.
const VALIDADE_STATE = "10m"

function assinarState(idUsuario) {
  return jwt.sign({ id: idUsuario, tipo: "google_oauth" }, SEGREDO_STATE, {
    expiresIn: VALIDADE_STATE,
  })
}

function lerState(state) {
  try {
    const payload = jwt.verify(state, SEGREDO_STATE)
    // A checagem do `tipo` e cinto e suspensorio: com o segredo proprio nada
    // mais e assinado assim hoje, mas ela garante que continue verdade se
    // amanha outro fluxo passar a usar o mesmo segredo.
    if (payload.tipo !== "google_oauth") return null
    return payload.id
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// TOKENS
// ---------------------------------------------------------------------------

/**
 * Access token valido para esta conexao, renovando se preciso.
 *
 * Guarda uma margem de um minuto: um token que expira "em 5 segundos" passaria
 * na conta e morreria no meio da requisicao seguinte.
 *
 * Atualiza tambem o objeto `conta` em memoria, e nao so o banco, porque a
 * sincronizacao percorre dezenas de eventos com a mesma conta — sem isso, cada
 * evento dispararia um refresh novo contra o Google.
 *
 * @param {object} conta - Linha de google_conta com os tokens ja decifrados.
 */
async function tokenValido(conta) {
  const margemMs = 60 * 1000
  const expira = conta.access_token_expira_ts
    ? new Date(conta.access_token_expira_ts).getTime()
    : 0

  if (conta.access_token && expira - margemMs > Date.now()) {
    return conta.access_token
  }

  if (!conta.refresh_token) {
    // Sem refresh token nao ha como renovar. Acontece quando a cifragem nao
    // abre (SECRET_KEY trocado) ou quando o Google nao devolveu um na
    // autorizacao. Nos dois casos, so reconectando.
    throw new googleApi.GoogleErro("Conexao com o Google incompleta.", { reautenticar: true })
  }

  const resposta = await googleApi.renovarAccessToken(conta.refresh_token)
  const novoExpira = new Date(Date.now() + (Number(resposta.expires_in) || 3600) * 1000)

  await googleAgendaRepository.atualizarAccessToken(
    conta.id_usuario,
    resposta.access_token,
    novoExpira
  )
  conta.access_token = resposta.access_token
  conta.access_token_expira_ts = novoExpira

  return resposta.access_token
}

/**
 * Garante que a agenda "Quiron" existe na conta e devolve o id dela.
 *
 * Confere antes de usar porque a pessoa pode ter apagado o calendario do lado
 * do Google — e ai todo envio bateria em 404 para sempre. Criar outro e
 * suficiente: os espelhos antigos apontam para um calendario morto, o
 * update falha com 404 e o enviarEvento cai na criacao, no calendario novo.
 */
async function garantirCalendario(conta, accessToken) {
  if (conta.id_calendario) {
    try {
      await googleApi.buscarCalendario(accessToken, conta.id_calendario)
      return conta.id_calendario
    } catch (err) {
      // 404 (nao existe) ou 403 (perdemos acesso) -> refaz. Qualquer outra
      // coisa e problema de verdade e sobe.
      if (err.status !== 404 && err.status !== 403) throw err
    }
  }

  const calendario = await googleApi.criarCalendario(accessToken, {
    nome: NOME_CALENDARIO,
    descricao: DESCRICAO_CALENDARIO,
    fusoHorario: FUSO,
  })
  await googleAgendaRepository.definirCalendario(conta.id_usuario, calendario.id)
  conta.id_calendario = calendario.id
  return calendario.id
}

// ---------------------------------------------------------------------------
// TRADUCAO evento do Quiron -> evento do Google
// ---------------------------------------------------------------------------

/**
 * Hora de parede no formato que o Google espera, sem fuso embutido.
 *
 * O `toISOString()` NAO serve aqui: ele converte para UTC, e como a coluna e
 * TIMESTAMP sem fuso o driver ja montou o Date com os componentes locais do
 * processo. Ler de volta os mesmos componentes locais devolve exatamente o que
 * esta no banco, independente do TZ do container; quem diz o fuso e o campo
 * `timeZone` do payload, logo abaixo.
 */
function horaLocal(valor) {
  const d = new Date(valor)
  const p = (n) => String(n).padStart(2, "0")
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  )
}

/** Monta o corpo do evento na Calendar API a partir de um evento do Quiron. */
function corpoDoEvento(evento) {
  const inicio = new Date(evento.inicio_ts)
  const fim = evento.fim_ts
    ? new Date(evento.fim_ts)
    : new Date(inicio.getTime() + DURACAO_PADRAO_MIN * 60 * 1000)

  const startups = Array.isArray(evento.startups) ? evento.startups.map((s) => s.nome) : []

  // Linhas montadas e depois filtradas: um evento sem mentor, sem startup
  // direcionada e sem descricao nao pode render linhas vazias no corpo.
  const linhas = [
    evento.descricao || "",
    evento.categoria_rotulo ? `Categoria: ${evento.categoria_rotulo}` : "",
    evento.mentor_nome ? `Responsavel: ${evento.mentor_nome}` : "",
    startups.length ? `Startups: ${startups.join(", ")}` : "",
    evento.obrigatorio ? "Presenca obrigatoria." : "",
    `Ver no Quiron: ${FRONTEND_URL}/eventos?evento=${evento.id_evento}`,
  ].filter(Boolean)

  return {
    summary: evento.titulo,
    description: linhas.join("\n\n"),
    location: evento.local_nome || undefined,
    start: { dateTime: horaLocal(inicio), timeZone: FUSO },
    end: { dateTime: horaLocal(fim), timeZone: FUSO },
    // NAO enviamos `attendees`. Cada pessoa recebe o evento na propria agenda,
    // criado por ela mesma: colocar os outros como convidados faria o Google
    // disparar um convite de cada participante para todos os demais, e uma
    // mentoria de dez pessoas viraria cem emails.
    reminders: { useDefault: true },
    // Marca de origem: identifica os eventos do Quiron na conta da pessoa sem
    // depender do titulo, que ela pode ter renomeado.
    extendedProperties: {
      private: {
        quironEvento: String(evento.id_evento),
        quironTenant: String(evento.id_tenant),
      },
    },
    source: { title: "Quiron", url: `${FRONTEND_URL}/eventos?evento=${evento.id_evento}` },
  }
}

// ---------------------------------------------------------------------------
// ENVIO
// ---------------------------------------------------------------------------

/**
 * Poe (ou atualiza) um evento na agenda de UMA pessoa.
 *
 * Atualiza quando ja existe espelho, cria quando nao. O 404/410 no update e
 * tratado como "a pessoa apagou este evento no Google": em vez de propagar o
 * erro, esquece o espelho e cria de novo — a agenda da incubadora e a fonte da
 * verdade, e o evento tem de voltar.
 */
async function enviarEvento(conta, evento) {
  const accessToken = await tokenValido(conta)
  const corpo = corpoDoEvento(evento)

  const espelho = await googleAgendaRepository.buscarEspelho(evento.id_evento, conta.id_usuario)
  if (espelho) {
    try {
      await googleApi.atualizarEvento(
        accessToken,
        espelho.id_calendario,
        espelho.google_event_id,
        corpo
      )
      return
    } catch (err) {
      if (err.status !== 404 && err.status !== 410) throw err
      await googleAgendaRepository.removerEspelho(evento.id_evento, conta.id_usuario)
    }
  }

  const idCalendario = await garantirCalendario(conta, accessToken)
  const criado = await googleApi.inserirEvento(accessToken, idCalendario, corpo)
  await googleAgendaRepository.salvarEspelho(
    evento.id_evento,
    conta.id_usuario,
    criado.id,
    idCalendario
  )
}

/** Tira um evento da agenda de uma pessoa e esquece o espelho. */
async function removerEvento(conta, espelho) {
  const accessToken = await tokenValido(conta)
  try {
    await googleApi.apagarEvento(accessToken, espelho.id_calendario, espelho.google_event_id)
  } catch (err) {
    // Ja nao estava la: o objetivo era esse, entao seguimos para limpar a
    // linha. Qualquer outro erro sobe — a linha precisa continuar existindo
    // para a proxima tentativa achar o evento que ficou orfao no Google.
    if (err.status !== 404 && err.status !== 410) throw err
  }
  await googleAgendaRepository.removerEspelho(espelho.id_evento, conta.id_usuario)
}

/**
 * Anota a falha na conexao da pessoa.
 *
 * Autorizacao morta DESLIGA o envio (sincronizar = FALSE). Sem isso, cada
 * evento criado na incubadora dispararia uma tentativa condenada por conta
 * revogada, e o log viraria ruido — a tela mostra o motivo e o botao de
 * reconectar, que e a unica coisa que resolve.
 */
async function registrarFalha(conta, err) {
  const contexto = err?.reautenticar
    ? "Autorizacao do Google expirou ou foi revogada. Reconecte sua conta."
    : err?.message || "Falha ao sincronizar com o Google Agenda."

  try {
    if (err?.reautenticar) {
      await googleAgendaRepository.definirSincronizar(conta.id_usuario, false)
    }
    await googleAgendaRepository.registrarSync(conta.id_usuario, contexto)
  } catch (erroBanco) {
    console.error("[google-agenda] Falha ao registrar o erro:", erroBanco.message)
  }
}

/**
 * Executa sem prender quem chamou e engolindo qualquer erro — igual ao
 * emSegundoPlano do notificacaoService, e pelo mesmo motivo.
 */
function emSegundoPlano(contexto, tarefa) {
  if (!googleApi.configurado()) return
  Promise.resolve()
    .then(tarefa)
    .catch((err) => {
      console.error(`[google-agenda] Falha (${contexto}):`, err.message)
    })
}

// ---------------------------------------------------------------------------
// GANCHOS DO eventoService
// ---------------------------------------------------------------------------

/** Evento criado no Quiron -> agenda de todo mundo que o enxerga. */
function eventoCriado(evento) {
  emSegundoPlano(`criar evento=${evento?.id_evento}`, async () => {
    const contas = await googleAgendaRepository.listarContasDoPublico(evento.id_evento)
    for (const conta of contas) {
      try {
        await enviarEvento(conta, evento)
      } catch (err) {
        await registrarFalha(conta, err)
      }
    }
  })
}

/**
 * Evento editado -> atualiza para quem continua no publico e APAGA de quem
 * saiu dele.
 *
 * A segunda metade e o que a edicao tem de diferente da criacao: mudar as
 * startups direcionadas muda o publico, e quem ficou de fora carregaria na
 * agenda um compromisso que nao e mais dele. Vem primeiro no codigo porque e a
 * parte que se esquece.
 */
function eventoAtualizado(evento) {
  emSegundoPlano(`atualizar evento=${evento?.id_evento}`, async () => {
    const foraDoPublico = await googleAgendaRepository.listarEspelhosForaDoPublico(evento.id_evento)
    for (const espelho of foraDoPublico) {
      const conta = await googleAgendaRepository.buscarConta(espelho.id_usuario)
      if (!conta) continue
      try {
        await removerEvento(conta, espelho)
      } catch (err) {
        await registrarFalha(conta, err)
      }
    }

    const contas = await googleAgendaRepository.listarContasDoPublico(evento.id_evento)
    for (const conta of contas) {
      try {
        await enviarEvento(conta, evento)
      } catch (err) {
        await registrarFalha(conta, err)
      }
    }
  })
}

/**
 * Evento excluido no Quiron -> some da agenda de todo mundo.
 *
 * Recebe os espelhos ja carregados porque a exclusao aqui e logica
 * (ativo = FALSE) mas a consulta de publico depende do evento continuar
 * visivel: buscar depois, em segundo plano, poderia devolver lista vazia e
 * deixar o evento cancelado na agenda de todos.
 */
function eventoExcluido(idEvento, espelhos) {
  emSegundoPlano(`excluir evento=${idEvento}`, async () => {
    for (const espelho of espelhos) {
      const conta = await googleAgendaRepository.buscarConta(espelho.id_usuario)
      if (!conta) continue
      try {
        await removerEvento(conta, espelho)
      } catch (err) {
        await registrarFalha(conta, err)
      }
    }
  })
}

/** Espelhos de um evento — o eventoService busca ANTES de excluir. Ver acima. */
function espelhosDoEvento(idEvento) {
  if (!googleApi.configurado()) return Promise.resolve([])
  return googleAgendaRepository.listarEspelhosDoEvento(idEvento).catch(() => [])
}

// ---------------------------------------------------------------------------
// FLUXO DA PESSOA (conectar / sincronizar / desconectar)
// ---------------------------------------------------------------------------

/** O que a tela de perfil precisa saber sobre a conexao. */
async function status(idUsuario) {
  if (!googleApi.configurado()) {
    return { configurado: false, conectado: false }
  }
  const conta = await googleAgendaRepository.buscarStatus(idUsuario)
  return {
    configurado: true,
    conectado: Boolean(conta),
    email: conta?.google_email || null,
    sincronizar: conta?.sincronizar ?? false,
    ultimo_sync_ts: conta?.ultimo_sync_ts || null,
    ultimo_erro: conta?.ultimo_erro || null,
    conectado_ts: conta?.conectado_ts || null,
  }
}

/** URL da tela de consentimento, ja carimbada com quem esta conectando. */
function urlAutorizacao(idUsuario) {
  if (!googleApi.configurado()) {
    throw erroNegocio(
      503,
      "A integracao com o Google Agenda nao esta configurada nesta instalacao."
    )
  }
  return googleApi.urlAutorizacao(assinarState(idUsuario))
}

/**
 * Fecha o fluxo: valida o state, troca o codigo pelos tokens, cria a agenda e
 * dispara a primeira carga.
 *
 * @returns {Promise<number>} id do usuario que conectou (para o redirect).
 */
async function concluirAutorizacao(code, state) {
  const idUsuario = lerState(state)
  if (!idUsuario) {
    throw erroNegocio(400, "Autorizacao expirada ou invalida. Tente conectar novamente.")
  }
  if (!code) {
    throw erroNegocio(400, "O Google nao devolveu o codigo de autorizacao.")
  }

  const tokens = await googleApi.trocarCodigo(code)
  if (!tokens.refresh_token) {
    // Sem refresh token a conexao morreria em uma hora. Melhor recusar agora,
    // com um texto que diz o que fazer, do que gravar algo que vai quebrar
    // sozinho depois — ver o comentario de urlAutorizacao no googleApi.
    throw erroNegocio(
      400,
      "O Google nao devolveu a autorizacao de longo prazo. Remova o acesso do " +
        "Quiron em myaccount.google.com/permissions e conecte novamente."
    )
  }

  const { sub, email } = googleApi.dadosDoIdToken(tokens.id_token)

  // Reconectou com OUTRA conta Google: o calendario antigo esta na conta
  // antiga, onde nao temos mais acesso — e os espelhos apontam para eventos
  // que este token nao alcanca. Zerar a conexao faz a proxima sincronizacao
  // criar tudo do lado certo.
  const anterior = await googleAgendaRepository.buscarConta(idUsuario)
  if (anterior && sub && anterior.google_sub !== sub) {
    await googleAgendaRepository.removerConta(idUsuario)
  }

  const conta = await googleAgendaRepository.salvarConta({
    idUsuario,
    googleSub: sub || "desconhecido",
    googleEmail: email,
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token,
    expiraTs: new Date(Date.now() + (Number(tokens.expires_in) || 3600) * 1000),
    escopos: tokens.scope,
  })

  await garantirCalendario(conta, tokens.access_token)

  // Primeira carga em segundo plano: o navegador da pessoa esta parado num
  // redirect do Google esperando resposta, e empurrar 180 dias de agenda antes
  // de responder deixaria a tela em branco por dezenas de segundos.
  emSegundoPlano(`carga inicial usuario=${idUsuario}`, () => sincronizar(idUsuario))

  return idUsuario
}

/**
 * Empurra para o Google tudo o que a pessoa enxerga na janela configurada.
 *
 * Serve tanto a carga inicial quanto o botao "sincronizar agora" — que existe
 * para quem conectou depois de os eventos ja terem sido criados, e para
 * recuperar o que ficou para tras enquanto a conexao estava com problema.
 */
async function sincronizar(idUsuario) {
  const conta = await googleAgendaRepository.buscarConta(idUsuario)
  if (!conta) throw erroNegocio(400, "Conecte sua conta do Google primeiro.")

  const agora = Date.now()
  const dia = 24 * 60 * 60 * 1000
  const eventos = await eventoRepository.listarVisiveisParaUsuario(idUsuario, {
    desde: new Date(agora - DIAS_PARA_TRAS * dia).toISOString(),
    ate: new Date(agora + DIAS_PARA_FRENTE * dia).toISOString(),
  })

  let enviados = 0
  for (const evento of eventos) {
    try {
      await enviarEvento(conta, evento)
      enviados += 1
    } catch (err) {
      await registrarFalha(conta, err)
      // Autorizacao morta nao melhora no proximo evento: parar aqui evita
      // dezenas de chamadas condenadas. Falha pontual, ao contrario, nao pode
      // travar a fila inteira — o resto da agenda ainda vai.
      if (err?.reautenticar) throw err
    }
  }

  await googleAgendaRepository.registrarSync(idUsuario, null)
  return { enviados, total: eventos.length }
}

/** Pausa ou retoma o envio, sem desfazer a autorizacao. */
async function definirSincronizar(idUsuario, ativo) {
  const conta = await googleAgendaRepository.buscarStatus(idUsuario)
  if (!conta) throw erroNegocio(400, "Conecte sua conta do Google primeiro.")

  const atualizada = await googleAgendaRepository.definirSincronizar(idUsuario, Boolean(ativo))
  // Religar depois de uma pausa deixa buracos: os eventos criados enquanto
  // estava desligado nunca foram enviados. A carga fecha essa lacuna.
  if (ativo) emSegundoPlano(`retomada usuario=${idUsuario}`, () => sincronizar(idUsuario))
  return atualizada
}

/**
 * Desconecta: apaga a agenda "Quiron" da conta da pessoa, revoga a autorizacao
 * e esquece os tokens.
 *
 * A ordem importa. Apagar o calendario PRECISA vir antes da revogacao — depois
 * dela o token nao vale mais e a agenda ficaria orfa na conta da pessoa, com os
 * eventos da incubadora que ela pediu para remover.
 *
 * Nenhuma das duas etapas externas pode impedir a limpeza local: se o Google
 * estiver fora do ar, a pessoa ainda assim quis desconectar, e a linha (com o
 * refresh token) tem de sair do nosso banco.
 */
async function desconectar(idUsuario) {
  const conta = await googleAgendaRepository.buscarConta(idUsuario)
  if (!conta) return { desconectado: false }

  try {
    const accessToken = await tokenValido(conta)
    if (conta.id_calendario) {
      await googleApi.apagarCalendario(accessToken, conta.id_calendario)
    }
  } catch (err) {
    console.error("[google-agenda] Nao foi possivel apagar a agenda no Google:", err.message)
  }

  // O refresh token derruba TODA a autorizacao (inclusive os access tokens
  // vivos); revogar o access token sozinho deixaria o refresh de pe.
  await googleApi.revogar(conta.refresh_token)
  await googleAgendaRepository.removerConta(idUsuario)

  return { desconectado: true }
}

module.exports = {
  status,
  urlAutorizacao,
  concluirAutorizacao,
  sincronizar,
  definirSincronizar,
  desconectar,
  // Ganchos do eventoService.
  eventoCriado,
  eventoAtualizado,
  eventoExcluido,
  espelhosDoEvento,
}
