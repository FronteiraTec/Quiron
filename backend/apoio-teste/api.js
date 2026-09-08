/**
 * Cliente HTTP dos testes.
 *
 * Sobe o app numa porta SORTEADA pelo sistema (`listen(0)`) em vez de na 3000:
 * os arquivos de teste do `node:test` rodam em processos paralelos, e uma
 * porta fixa faria o segundo arquivo morrer com EADDRINUSE. Usa o `fetch`
 * nativo do Node 20 — nada de supertest, para o `npm ci` da CI nao precisar
 * baixar mais nada.
 */
const app = require("../src/app")

/**
 * Sobe a API e devolve o endereco e como derrubar.
 * @returns {Promise<{url: string, fechar: () => Promise<void>}>}
 */
function subirApi() {
  return new Promise((resolve) => {
    const servidor = app.listen(0, "127.0.0.1", () => {
      const { port } = servidor.address()
      resolve({
        url: `http://127.0.0.1:${port}`,
        fechar: () => new Promise((ok) => servidor.close(ok)),
      })
    })
  })
}

/**
 * Faz uma requisicao e ja devolve status + corpo decodificado.
 *
 * Devolve o corpo como TEXTO quando a resposta nao e JSON (a credencial
 * publica responde HTML), para o teste poder olhar as duas coisas sem se
 * preocupar com o content-type.
 *
 * @param {string} url - base devolvida por subirApi.
 * @param {string} caminho - ex.: "/auth/login".
 * @param {{metodo?: string, token?: string, corpo?: object, cabecalhos?: object}} [opcoes]
 */
async function req(url, caminho, opcoes = {}) {
  const { metodo = "GET", token, corpo, cabecalhos = {} } = opcoes

  const resposta = await fetch(`${url}${caminho}`, {
    method: metodo,
    headers: {
      ...(corpo ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...cabecalhos,
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  })

  const tipo = resposta.headers.get("content-type") || ""
  const dados = tipo.includes("application/json")
    ? await resposta.json()
    : await resposta.text()

  return { status: resposta.status, corpo: dados, cabecalhos: resposta.headers }
}

module.exports = { subirApi, req }
