/**
 * Ponto de entrada da API (camada de aplicacao).
 *
 * Monta os middlewares globais, registra o agregador de rotas e o middleware
 * de erros, e sobe o servidor. As responsabilidades ficam distribuidas nas
 * camadas: routes -> controllers -> services -> repositories -> banco.
 */
const express = require("express")
const cors = require("cors")
const helmet = require("helmet")

const routes = require("./routes")
const { autenticar } = require("./middlewares/auth")
const { errorHandler } = require("./middlewares/errorHandler")
const { sincronizarCatalogo } = require("./rbac/sincronizarCatalogo")
const { repararRolesTenants } = require("./rbac/repararRoles")
const arquivoService = require("./services/arquivoService")

const app = express()

// --- Middlewares globais ---
app.use(helmet()) // Cabecalhos de seguranca.
app.use(cors()) // Libera requisicoes do frontend.
app.use(express.json({ limit: "4mb" })) // Faz o parse do corpo JSON (limite maior por causa da foto de perfil em base64).

// --- Health check (usado pelo Docker) ---
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "API is running" })
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

// --- Sobe o servidor ---
const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)

  // Mantem a tabela de permissoes em dia com o catalogo definido em codigo, e
  // so depois repara tenants/usuarios que ficaram fora do RBAC (o
  // Administrador so pode receber o catalogo inteiro se ele ja estiver
  // sincronizado).
  sincronizarCatalogo()
    .then(() => repararRolesTenants())
    .catch((err) => {
      console.error("Falha ao sincronizar RBAC (catalogo/roles):", err)
    })

  // Garante o diretorio de uploads. Feito na subida e nao no primeiro envio:
  // se o volume nao estiver montado, o erro aparece agora, no log do boot, e
  // nao para o usuario no meio de uma entrega.
  try {
    console.log(`Diretorio de uploads: ${arquivoService.prepararDiretorio()}`)
  } catch (err) {
    console.error("Falha ao preparar o diretorio de uploads:", err)
  }
})
