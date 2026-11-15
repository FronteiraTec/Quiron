/**
 * O LiveKit Cloud, do jeito que as reunioes precisam dele: emitir o token de
 * uma sala, fechar uma sala e conferir a assinatura do webhook.
 *
 * O LiveKit so carrega a midia da sala (SFU + TURN). Nao grava e nao guarda
 * nada — ver docs/reunioes.md, decisao 1. Trocar por um LiveKit proprio e so
 * trocar LIVEKIT_URL e as chaves.
 *
 * SEM AS TRES VARIAVEIS, O MODULO FICA INVISIVEL, como o Google Agenda sem
 * GOOGLE_CLIENT_ID: o menu nao oferece Reunioes e as rotas que dependem da
 * sala respondem 503. As variaveis sao lidas a cada chamada, e nao na carga do
 * modulo, para o teste poder liga-las depois do `require`.
 *
 * Um projeto do LiveKit POR AMBIENTE: o webhook de cada projeto aponta para o
 * dominio do seu ambiente.
 */
const { AccessToken, RoomServiceClient, TrackSource, WebhookReceiver } = require("livekit-server-sdk")

// O token so precisa valer ate a conexao: depois de conectada, a sessao se
// renova sozinha no LiveKit. Curto para um token vazado nao abrir a sala de
// ninguem horas depois.
const VALIDADE_TOKEN = "10m"

// Fechar a sala e uma chamada so; se o LiveKit nao responder nisso, o
// `room_finished` fecha do mesmo jeito quando o ultimo sair.
const TIMEOUT_API_S = 10

function config() {
  return {
    url: process.env.LIVEKIT_URL || "",
    chave: process.env.LIVEKIT_API_KEY || "",
    segredo: process.env.LIVEKIT_API_SECRET || "",
  }
}

/** As tres variaveis estao definidas? Sem elas o modulo nao aparece. */
function configurado() {
  const { url, chave, segredo } = config()
  return Boolean(url && chave && segredo)
}

/** O endereco que o NAVEGADOR usa para conectar (wss://...). */
function urlCliente() {
  return config().url
}

/**
 * Token de entrada numa sala.
 *
 * A identidade e `u-<id_usuario>`, e e por ela que o webhook descobre quem
 * entrou — nunca pelo nome, que a pessoa troca no perfil.
 *
 * O que a pessoa pode publicar e fechado aqui: camera, microfone e tela.
 * `canPublishData` liga o chat e os avisos da sala.
 *
 * Os ATRIBUTOS sao o que a sala inteira enxerga de cada pessoa e muda durante
 * a reuniao — hoje, `gravacao: "sim" | "nao"`, o selo de quem tem a fala
 * gravada. So o servidor os escreve (`definirAtributos`); a pessoa nao.
 *
 * @param {{sala: string, identidade: string, nome: string, metadados?: object, atributos?: Record<string, string>}} dados
 * @returns {Promise<string>}
 */
async function emitirToken({ sala, identidade, nome, metadados, atributos }) {
  const { chave, segredo } = config()
  const token = new AccessToken(chave, segredo, {
    identity: identidade,
    name: nome,
    metadata: metadados ? JSON.stringify(metadados) : undefined,
    attributes: atributos,
    ttl: VALIDADE_TOKEN,
  })
  token.addGrant({
    room: sala,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    canPublishSources: [
      TrackSource.CAMERA,
      TrackSource.MICROPHONE,
      TrackSource.SCREEN_SHARE,
      TrackSource.SCREEN_SHARE_AUDIO,
    ],
    // O nome e a foto vem do Quiron; a pessoa nao se renomeia dentro da sala.
    canUpdateOwnMetadata: false,
  })
  return token.toJwt()
}

// Quanto tempo a sala espera depois que o ULTIMO sai, antes de fechar sozinha.
// O padrao do LiveKit sao 20 segundos — e como o fechamento da sala encerra a
// reuniao (room_finished), o mentor que entrou cedo e saiu para buscar um cafe
// voltaria para uma reuniao encerrada. Dez minutos cobrem a queda de conexao e
// a pausa; quem quer encerrar de fato usa o botao.
const ESPERA_APOS_ULTIMO_S = 10 * 60
// Sala criada em que ninguem entra: fecha depois disto.
const ESPERA_SALA_VAZIA_S = 20 * 60

function clienteSalas() {
  const { url, chave, segredo } = config()
  return new RoomServiceClient(url, chave, segredo, { requestTimeout: TIMEOUT_API_S })
}

/**
 * Cria a sala com os prazos de espera da reuniao, antes da primeira entrada.
 *
 * Sem isto o LiveKit cria a sala sozinho na primeira conexao, com os prazos
 * padrao (ver ESPERA_APOS_ULTIMO_S). Chamar de novo para uma sala que ja
 * existe nao muda nada.
 */
async function prepararSala(sala, { maxParticipantes } = {}) {
  await clienteSalas().createRoom({
    name: sala,
    emptyTimeout: ESPERA_SALA_VAZIA_S,
    departureTimeout: ESPERA_APOS_ULTIMO_S,
    maxParticipants: maxParticipantes || 0,
  })
}

/**
 * Fecha a sala: o LiveKit desconecta todo mundo e manda um
 * `participant_left` por pessoa e o `room_finished`.
 *
 * Sala que ja nao existe (todos sairam antes) nao e erro: o que se queria era
 * a sala fechada, e ela esta.
 */
async function encerrarSala(sala) {
  try {
    await clienteSalas().deleteRoom(sala)
  } catch (err) {
    if (err?.status === 404 || err?.code === "not_found") return
    throw err
  }
}

/**
 * Troca os atributos de quem ja esta na sala (o selo de gravacao, quando a
 * pessoa muda o consentimento la dentro). Quem nao esta na sala responde 404:
 * nao e erro — o token da proxima entrada ja leva o valor novo.
 */
async function definirAtributos(sala, identidade, atributos) {
  try {
    await clienteSalas().updateParticipant(sala, identidade, { attributes: atributos })
  } catch (err) {
    if (err?.status === 404 || err?.code === "not_found") return
    throw err
  }
}

/**
 * Confere a assinatura de um webhook e devolve o evento.
 *
 * A assinatura e um JWT no cabecalho Authorization, assinado com o segredo da
 * API, que carrega o sha256 do CORPO. Por isso o corpo precisa chegar CRU —
 * reserializar o JSON mudaria os bytes e a conferencia falharia.
 *
 * @param {string} corpo - o corpo exatamente como chegou.
 * @param {string|undefined} autorizacao - o cabecalho Authorization.
 * @returns {Promise<import('livekit-server-sdk').WebhookEvent>} lanca se nao conferir.
 */
async function receberWebhook(corpo, autorizacao) {
  const { chave, segredo } = config()
  const token = String(autorizacao || "").replace(/^Bearer\s+/i, "")
  return new WebhookReceiver(chave, segredo).receive(corpo, token)
}

module.exports = {
  ESPERA_APOS_ULTIMO_S,
  configurado,
  urlCliente,
  emitirToken,
  prepararSala,
  encerrarSala,
  definirAtributos,
  receberWebhook,
}
