/**
 * Cliente HTTP do Google (OAuth 2.0 + Calendar API v3).
 *
 * Aqui mora o TRANSPORTE — montar URL, trocar codigo por token, chamar os
 * endpoints do calendario — e nada da regra de negocio: quem decide QUEM
 * recebe qual evento e o googleAgendaService, como o notificacaoService decide
 * quem recebe qual email enquanto o utils/email.js so sabe enviar.
 *
 * SEM O PACOTE `googleapis`. Ele traz o cliente de ~300 APIs para usarmos seis
 * endpoints. O `fetch` global do Node 20 resolve, e o resto do backend ja fala
 * HTTP e SQL na mao — nao ha SDK escondendo nada em lugar nenhum deste projeto.
 *
 * ESCOPO ESCOLHIDO: `calendar.app.created`. Ele da acesso total aos
 * calendarios que ESTE app criou, e a nenhum outro. Com ele o Quiron nao
 * consegue ler a agenda pessoal de ninguem — so escrever na camada "Quiron"
 * que ele mesmo criou. O `calendar.events` (usado para escrever na agenda
 * principal) daria acesso a TODOS os eventos de TODOS os calendarios da
 * pessoa, incluindo os que nao tem nada a ver com a incubadora.
 */
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ""
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ""

// Precisa bater EXATAMENTE com um "URI de redirecionamento autorizado" no
// Google Cloud Console — incluindo esquema, porta e barra final. O padrao
// assume o Nginx do projeto, que serve a API sob /api.
const REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ||
  `${process.env.FRONTEND_URL || "http://localhost"}/api/google-agenda/callback`

// Escopo de calendario, configuravel. O padrao e o de menor privilegio que
// atende ao desenho (uma agenda separada, criada por nos).
//
// POR QUE E CONFIGURAVEL. A caixa de "adicionar escopos manualmente" do Google
// Cloud Console valida contra um catalogo legado e recusa escopos granulares
// mais novos — inclusive este, com a mensagem "o nome do escopo inserido e
// invalido ou se refere a um escopo mais recente". Quase sempre e so a Calendar
// API nao estar ativada no projeto (a caixa so resolve escopos de API ativa),
// e ativar resolve. Quando nao resolve, trocar de escopo passa a ser questao de
// ambiente, e nao de editar codigo e reconstruir a imagem.
//
// ALTERNATIVA, se o Console insistir em recusar:
//   GOOGLE_SCOPE_CALENDAR="https://www.googleapis.com/auth/calendar.calendars \
//                          https://www.googleapis.com/auth/calendar.events.owned"
// `calendar.calendars` cria a agenda secundaria e `calendar.events.owned`
// escreve nela ("calendarios que voce possui" — a nossa e um deles). Custa mais
// privilegio que o padrao: o `events.owned` alcanca os eventos das OUTRAS
// agendas proprias da pessoa, o que o `app.created` nao faz. Ainda assim e bem
// menos que o `calendar` cheio, que le e apaga tudo o que ela enxerga.
const ESCOPO_CALENDARIO =
  process.env.GOOGLE_SCOPE_CALENDAR || "https://www.googleapis.com/auth/calendar.app.created"

const ESCOPOS = [
  // Aceita varios escopos separados por espaco (ver a alternativa acima).
  ...ESCOPO_CALENDARIO.split(/\s+/).filter(Boolean),
  // openid + email so para saber COM QUAL conta a pessoa conectou, e poder
  // mostrar isso na tela. Nao sao escopos sensiveis e nao pesam na revisao.
  "openid",
  "email",
]

const URL_AUTORIZACAO = "https://accounts.google.com/o/oauth2/v2/auth"
const URL_TOKEN = "https://oauth2.googleapis.com/token"
const URL_REVOGACAO = "https://oauth2.googleapis.com/revoke"
const API_CALENDARIO = "https://www.googleapis.com/calendar/v3"

/** A integracao so aparece na tela quando ha credenciais no ambiente. */
function configurado() {
  return Boolean(CLIENT_ID && CLIENT_SECRET)
}

/**
 * Erro vindo do Google, com o que quem chamou precisa para decidir.
 *
 * `reautenticar` separa os dois tipos de falha que exigem tratamento
 * diferente: a autorizacao morreu (a pessoa revogou o acesso, trocou a senha,
 * o refresh token expirou por desuso) e so reconectando se resolve — ou foi um
 * problema passageiro (rede, 500 do Google, cota), e insistir depois funciona.
 * Sem essa distincao, um 503 momentaneo derrubaria a conexao de todo mundo.
 */
class GoogleErro extends Error {
  constructor(mensagem, { status, codigo, reautenticar = false } = {}) {
    super(mensagem)
    this.name = "GoogleErro"
    this.status = status
    this.codigo = codigo
    this.reautenticar = reautenticar
  }
}

/** Le a resposta do Google e transforma falha em GoogleErro. */
async function lerResposta(resposta, contexto) {
  // 204 (o delete devolve isso) nao tem corpo — .json() estouraria.
  const texto = await resposta.text()
  const corpo = texto ? JSON.parse(texto) : {}

  if (resposta.ok) return corpo

  // O formato do erro difere entre os dois servicos: o OAuth devolve
  // { error, error_description } na raiz; a Calendar API devolve
  // { error: { code, message } }. Os dois caem aqui.
  const erroOAuth = typeof corpo.error === "string" ? corpo.error : null
  const mensagem =
    corpo.error_description || corpo.error?.message || erroOAuth || `HTTP ${resposta.status}`

  throw new GoogleErro(`${contexto}: ${mensagem}`, {
    status: resposta.status,
    codigo: erroOAuth || corpo.error?.status,
    // invalid_grant = o refresh token nao vale mais. 401 = access token
    // invalido, o que logo apos um refresh bem-sucedido tambem significa
    // autorizacao morta. 403 NAO entra: costuma ser cota ou escopo faltando, e
    // desconectar a pessoa por causa de cota seria o remedio errado.
    reautenticar: erroOAuth === "invalid_grant" || resposta.status === 401,
  })
}

// ---------------------------------------------------------------------------
// OAUTH
// ---------------------------------------------------------------------------

/**
 * Monta a URL da tela de consentimento do Google.
 *
 * `access_type=offline` + `prompt=consent` sao o que garantem o REFRESH TOKEN.
 * Sem os dois, o Google devolve refresh token so na PRIMEIRA autorizacao de
 * cada conta — quem ja tivesse autorizado o app antes reconectaria e ficaria
 * com uma conexao que morre em uma hora, sem nenhum erro aparente na hora.
 *
 * @param {string} state - Token curto que amarra o callback a esta pessoa.
 */
function urlAutorizacao(state) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: ESCOPOS.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  })
  return `${URL_AUTORIZACAO}?${params}`
}

/** Troca o `code` do callback pelos tokens. */
async function trocarCodigo(code) {
  const resposta = await fetch(URL_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  })
  return lerResposta(resposta, "Falha ao trocar o codigo de autorizacao")
}

/**
 * Renova o access token. A resposta NAO traz refresh token novo — o antigo
 * continua valendo, e sobrescrever a coluna com o `undefined` daqui apagaria a
 * unica coisa que nao da para recuperar sem a pessoa autorizar de novo.
 */
async function renovarAccessToken(refreshToken) {
  const resposta = await fetch(URL_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  })
  return lerResposta(resposta, "Falha ao renovar o acesso ao Google")
}

/**
 * Revoga a autorizacao no Google (o app some de myaccount.google.com).
 *
 * Nunca lanca: desconectar e ato do usuario e tem de terminar. Se a revogacao
 * falhar (o token ja podia estar morto — a causa mais comum de alguem querer
 * desconectar), o Quiron ainda assim apaga o que guardava, que e a parte sob
 * nosso controle. O contrario — recusar a desconexao porque o Google nao
 * respondeu — deixaria a pessoa presa a uma conexao que ela quer desfazer.
 */
async function revogar(token) {
  if (!token) return false
  try {
    const resposta = await fetch(URL_REVOGACAO, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    })
    return resposta.ok
  } catch {
    return false
  }
}

/**
 * Le `sub` e `email` do id_token, sem chamar mais nada.
 *
 * O id_token e um JWT e daria para VALIDAR a assinatura buscando as chaves
 * publicas do Google. Nao fazemos porque ele nao chegou pelo navegador: veio
 * na resposta direta do endpoint de token, por HTTPS, autenticada com o nosso
 * client_secret. Nesse fluxo o proprio Google dispensa a verificacao — nao ha
 * intermediario que pudesse ter forjado o valor.
 */
function dadosDoIdToken(idToken) {
  if (!idToken) return {}
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8"))
    return { sub: payload.sub, email: payload.email }
  } catch {
    return {}
  }
}

// ---------------------------------------------------------------------------
// CALENDAR API
// ---------------------------------------------------------------------------

/** Chamada autenticada a Calendar API. */
async function chamar(accessToken, caminho, { metodo = "GET", corpo } = {}) {
  const resposta = await fetch(`${API_CALENDARIO}${caminho}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(corpo ? { "Content-Type": "application/json" } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  })
  return lerResposta(resposta, `Falha em ${metodo} ${caminho}`)
}

/** Cria a agenda secundaria do Quiron na conta da pessoa. */
function criarCalendario(accessToken, { nome, descricao, fusoHorario }) {
  return chamar(accessToken, "/calendars", {
    metodo: "POST",
    corpo: { summary: nome, description: descricao, timeZone: fusoHorario },
  })
}

/** Confere se o calendario ainda existe (a pessoa pode te-lo apagado la). */
function buscarCalendario(accessToken, idCalendario) {
  return chamar(accessToken, `/calendars/${encodeURIComponent(idCalendario)}`)
}

/**
 * Apaga a agenda inteira. Usado na desconexao: leva junto todos os eventos que
 * o Quiron criou, sem precisar percorrer um por um.
 */
function apagarCalendario(accessToken, idCalendario) {
  return chamar(accessToken, `/calendars/${encodeURIComponent(idCalendario)}`, {
    metodo: "DELETE",
  })
}

/** Cria um evento e devolve o que o Google gerou (inclusive o id). */
function inserirEvento(accessToken, idCalendario, evento) {
  return chamar(accessToken, `/calendars/${encodeURIComponent(idCalendario)}/events`, {
    metodo: "POST",
    corpo: evento,
  })
}

/**
 * Atualiza um evento existente. PUT (update) e nao PATCH: o corpo que o service
 * monta e o evento COMPLETO, entao o merge do PATCH so esconderia campos que o
 * Quiron acabou de esvaziar (uma descricao apagada aqui continuaria la).
 */
function atualizarEvento(accessToken, idCalendario, idEvento, evento) {
  return chamar(
    accessToken,
    `/calendars/${encodeURIComponent(idCalendario)}/events/${encodeURIComponent(idEvento)}`,
    { metodo: "PUT", corpo: evento }
  )
}

function apagarEvento(accessToken, idCalendario, idEvento) {
  return chamar(
    accessToken,
    `/calendars/${encodeURIComponent(idCalendario)}/events/${encodeURIComponent(idEvento)}`,
    { metodo: "DELETE" }
  )
}

module.exports = {
  configurado,
  GoogleErro,
  ESCOPOS,
  REDIRECT_URI,
  urlAutorizacao,
  trocarCodigo,
  renovarAccessToken,
  revogar,
  dadosDoIdToken,
  criarCalendario,
  buscarCalendario,
  apagarCalendario,
  inserirEvento,
  atualizarEvento,
  apagarEvento,
}
