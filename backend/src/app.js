/**
 * Montagem do aplicativo Express (sem subir servidor).
 *
 * Separado do server.js de proposito: aqui o modulo so MONTA o app e o
 * exporta. Quem chama `listen` e o server.js.
 *
 * O motivo e o teste. Com o `app.listen()` no corpo do modulo, qualquer
 * `require` do app — inclusive o de um arquivo de teste — subia um servidor
 * de verdade numa porta de verdade, e dois arquivos de teste em paralelo
 * brigavam pela mesma porta. Exportando o app, o supertest/fetch fala com ele
 * em memoria, sem porta nenhuma.
 *
 * A regra que decorre disso: NADA de efeito colateral neste arquivo. Sincronia
 * de RBAC, diretorio de upload e escuta de porta sao trabalho da subida, e
 * moram no server.js.
 */
const express = require("express")
const cors = require("cors")
const helmet = require("helmet")

const routes = require("./routes")
const { autenticar } = require("./middlewares/auth")
const { errorHandler } = require("./middlewares/errorHandler")

const app = express()

// --- Middlewares globais ---
app.use(helmet()) // Cabecalhos de seguranca.

// CORS restrito a origem do proprio frontend. Era `cors()` aberto, que
// respondia `Access-Control-Allow-Origin: *` para qualquer site da internet.
// Em dev sem FRONTEND_URL definido, cai no aberto para nao travar o Vite em
// localhost:5173, que e uma origem diferente do Nginx em localhost:80.
app.use(cors({ origin: process.env.FRONTEND_URL || true }))

app.use(express.json({ limit: "4mb" })) // Parse do corpo JSON (limite maior por causa da foto de perfil em base64).

// Atras do Nginx/Caddy, o IP que interessa vem no X-Forwarded-For. Sem isto o
// rate limit enxergaria o IP do proxy e contaria a internet inteira como uma
// pessoa so.
app.set("trust proxy", 1)

// --- Health check (usado pelo Docker e pelo smoke test do deploy) ---
// `versao` e o commit da imagem (o deploy.yml passa no build). E como o deploy
// confere, pela internet, que a versao nova e a que esta respondendo — e como
// qualquer um descobre o que esta no ar sem entrar no servidor.
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "API is running", versao: process.env.VERSAO || "local" })
})

// --- Rotas da aplicacao ---
app.use("/", routes)

/**
 * Exemplo de rota protegida (modelo para rotas que exigem Bearer Token).
 */
app.get("/protegido", autenticar, (req, res) => {
  res.json({ mensagem: "Voce acessou uma rota protegida!", usuario: req.usuario })
})

// --- Tratamento central de erros (deve ser o ultimo middleware) ---
app.use(errorHandler)

module.exports = app
