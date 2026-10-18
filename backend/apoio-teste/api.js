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

/**
 * Sobe um arquivo pelo caminho de sempre, POST /arquivos (multipart). Usa o
 * FormData/Blob nativos do Node 20, como o `fetch` acima.
 *
 * @param {string} url - base devolvida por subirApi.
 * @param {string} token
 * @param {number} idTenant
 * @param {string} conteudo - os bytes, como texto.
 * @param {{nome?: string, tipo?: string, visibilidade?: string}} [opcoes]
 * @returns {Promise<{status: number, corpo: object}>}
 */
async function enviarArquivo(url, token, idTenant, conteudo, opcoes = {}) {
  const { nome = "arquivo.pdf", tipo = "application/pdf", visibilidade = "PRIVADO" } = opcoes
  const form = new FormData()
  form.append("arquivo", new Blob([conteudo], { type: tipo }), nome)
  form.append("id_tenant", String(idTenant))
  form.append("visibilidade", visibilidade)

  const resposta = await fetch(`${url}/arquivos`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  return { status: resposta.status, corpo: await resposta.json() }
}

/** Baixa um caminho e devolve o corpo como texto (para comparar os bytes). */
async function baixar(url, caminho, token) {
  const resposta = await fetch(`${url}${caminho}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  return { status: resposta.status, texto: await resposta.text() }
}

module.exports = { subirApi, req, enviarArquivo, baixar }
