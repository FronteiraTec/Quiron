/**
 * Ponto de entrada da API.
 *
 * A MONTAGEM do app (middlewares, rotas, erro) mora no app.js; aqui ficam a
 * escuta da porta e o trabalho de subida — sincronizar o catalogo RBAC e
 * garantir o diretorio de uploads. A divisao existe para o teste conseguir
 * importar o app sem ligar um servidor de verdade (ver o cabecalho do app.js).
 */
const app = require("./app")
const { sincronizarCatalogo } = require("./rbac/sincronizarCatalogo")
const { repararRolesTenants } = require("./rbac/repararRoles")
const arquivoService = require("./services/arquivoService")

// Segredo obrigatorio. Antes o `utils/jwt` caia num literal conhecido quando a
// variavel faltava — e como esse literal estava no docker-compose versionado,
// qualquer pessoa com acesso ao repositorio assinava um token de root. Falhar
// na subida e mais barato que subir aceitando token forjado.
if (!process.env.JWT_SECRET) {
  console.error(
    "FATAL: JWT_SECRET nao definido. Gere um com `openssl rand -base64 48` " +
      "e coloque no .env do ambiente. A API nao sobe sem ele."
  )
  process.exit(1)
}

if (process.env.NODE_ENV === "production" && !process.env.SECRET_KEY) {
  console.error(
    "FATAL: SECRET_KEY nao definida. Ela cifra os refresh tokens do Google no " +
      "banco. Sem ela o codigo cairia no JWT_SECRET, e rodar o JWT_SECRET " +
      "(que se faz a qualquer momento) tornaria ilegivel todo token ja gravado."
  )
  process.exit(1)
}

const PORT = process.env.PORT || 3000

const servidor = app.listen(PORT, () => {
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

// O Docker manda SIGTERM no `stop` e no `up -d` que recria o container. Sem
// tratar, o processo morre na hora e derruba requisicao em voo — inclusive um
// upload de 15MB no meio da gravacao.
for (const sinal of ["SIGTERM", "SIGINT"]) {
  process.on(sinal, () => {
    console.log(`${sinal} recebido, encerrando o servidor...`)
    servidor.close(() => process.exit(0))
    // Rede de seguranca: se alguma conexao pendurada nao fechar, nao ficamos
    // presos ate o timeout do Docker (10s) matar o processo de qualquer jeito.
    setTimeout(() => process.exit(0), 8000).unref()
  })
}
