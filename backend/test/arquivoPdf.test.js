/**
 * GET /arquivos/:id/pdf — o arquivo em PDF, para a Jornada desenhar na pagina.
 *
 * O conversor de verdade (Gotenberg, docker-compose.yml) nao roda na CI: no
 * lugar dele sobe aqui um servidor HTTP minimo, que responde no mesmo caminho
 * e conta quantas vezes foi chamado. O que se testa e o que e NOSSO: quem pode
 * abrir, o cache, a conversao unica sob concorrencia e o que acontece quando o
 * conversor falha ou nao existe.
 */
const fs = require("fs")
const os = require("os")
const path = require("path")
const http = require("http")

// O arquivoService le UPLOAD_DIR na carga: isto vem antes de qualquer require do app.
process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "quiron-arquivo-pdf-"))

const { test, describe, before, after, beforeEach } = require("node:test")
const assert = require("node:assert/strict")

const { prepararBanco, encerrar } = require("../apoio-teste/banco")
const { subirApi, req, enviarArquivo, baixar } = require("../apoio-teste/api")

const PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
const PDF_CONVERTIDO = "%PDF-1.7 convertido pelo conversor falso"

let api
let c
let conversor
let chamadas // nomes de arquivo que chegaram ao conversor
let responder // o que o conversor falso faz com a proxima chamada

const T = () => c.tenantA.id_tenant

/** O conversor falso: recebe o multipart e devolve um "PDF". */
function subirConversor() {
  return new Promise((resolve) => {
    const servidor = http.createServer((pedido, resposta) => {
      let corpo = ""
      pedido.on("data", (parte) => (corpo += parte))
      pedido.on("end", () => {
        if (pedido.url !== "/forms/libreoffice/convert") {
          resposta.writeHead(404).end()
          return
        }
        chamadas.push(/filename="([^"]+)"/.exec(corpo)?.[1])
        responder(resposta)
      })
    })
    servidor.listen(0, "127.0.0.1", () => {
      const { port } = servidor.address()
      resolve({ url: `http://127.0.0.1:${port}`, fechar: () => new Promise((ok) => servidor.close(ok)) })
    })
  })
}

const converteDepois = (ms) => (resposta) =>
  setTimeout(() => resposta.writeHead(200, { "Content-Type": "application/pdf" }).end(PDF_CONVERTIDO), ms)

async function subir(conteudo, nome, tipo) {
  const r = await enviarArquivo(api.url, c.adminA.token, T(), conteudo, { nome, tipo })
  assert.equal(r.status, 201, JSON.stringify(r.corpo))
  return r.corpo.arquivo
}

const pdfDe = (arquivo, token) => baixar(api.url, `/arquivos/${arquivo.id_arquivo}/pdf`, token)

before(async () => {
  await prepararBanco()
  c = await require("../apoio-teste/cenario").montarCenario()
  api = await subirApi()
  conversor = await subirConversor()
})

beforeEach(() => {
  process.env.CONVERSOR_URL = conversor.url
  chamadas = []
  responder = converteDepois(0)
})

after(async () => {
  delete process.env.CONVERSOR_URL
  await conversor.fechar()
  await api.fechar()
  await encerrar()
  fs.rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true })
})

describe("o que ja e PDF e o que nao tem conversao", () => {
  test("um PDF sai como esta, sem passar pelo conversor", async () => {
    const arquivo = await subir("%PDF-1.4 original", "plano.pdf", "application/pdf")
    const r = await pdfDe(arquivo, c.adminA.token)
    assert.equal(r.status, 200)
    assert.equal(r.texto, "%PDF-1.4 original")
    assert.equal(chamadas.length, 0)
  })

  test("texto e planilha nao tem versao em PDF: 415, e o conversor nem e chamado", async () => {
    const arquivo = await subir("so texto", "notas.txt", "text/plain")
    assert.equal((await pdfDe(arquivo, c.adminA.token)).status, 415)
    assert.equal(chamadas.length, 0)
  })
})

describe("a apresentacao convertida", () => {
  test("converte na primeira abertura e guarda: a segunda nao chama o conversor", async () => {
    const arquivo = await subir("PK bytes de pptx", "pitch.pptx", PPTX)

    const primeira = await fetch(`${api.url}/arquivos/${arquivo.id_arquivo}/pdf`, {
      headers: { Authorization: `Bearer ${c.adminA.token}` },
    })
    assert.equal(primeira.status, 200)
    assert.equal(primeira.headers.get("content-type"), "application/pdf")
    assert.match(primeira.headers.get("content-disposition"), /^inline; filename="pitch\.pdf"$/)
    assert.equal(await primeira.text(), PDF_CONVERTIDO)
    // A extensao vai pelo mime, e nao pelo nome enviado: e por ela que o
    // LibreOffice escolhe o leitor.
    assert.deepEqual(chamadas, ["documento.pptx"])

    const segunda = await pdfDe(arquivo, c.adminA.token)
    assert.equal(segunda.texto, PDF_CONVERTIDO)
    assert.equal(chamadas.length, 1)
  })

  test("varios abrindo ao mesmo tempo esperam UMA conversao", async () => {
    responder = converteDepois(150)
    const arquivo = await subir("PK outro pptx", "aula.pptx", PPTX)

    const respostas = await Promise.all([1, 2, 3, 4].map(() => pdfDe(arquivo, c.adminA.token)))
    assert.deepEqual(respostas.map((r) => r.status), [200, 200, 200, 200])
    assert.equal(chamadas.length, 1)
  })

  test("o download do original continua entregando o .pptx", async () => {
    const arquivo = await subir("PK original intacto", "original.pptx", PPTX)
    await pdfDe(arquivo, c.adminA.token)
    const r = await baixar(api.url, `/arquivos/${arquivo.id_arquivo}`, c.adminA.token)
    assert.equal(r.texto, "PK original intacto")
  })
})

describe("quem pode abrir: a mesma regra do original", () => {
  test("o incubado so abre depois que a apresentacao vira material da Biblioteca", async () => {
    const arquivo = await subir("PK material", "material.pptx", PPTX)

    assert.equal((await pdfDe(arquivo, c.colaboradorA.token)).status, 403)
    assert.equal((await pdfDe(arquivo, null)).status, 401)
    assert.equal(chamadas.length, 0, "barrado antes de gastar uma conversao")

    const r = await req(api.url, "/conteudos", {
      metodo: "POST",
      token: c.adminA.token,
      corpo: { id_tenant: T(), tipo: "ARQUIVO", titulo: "Pitch", url: arquivo.url, nome_arquivo: "material.pptx" },
    })
    assert.equal(r.status, 201, JSON.stringify(r.corpo))

    const depois = await pdfDe(arquivo, c.colaboradorA.token)
    assert.equal(depois.status, 200)
    assert.equal(depois.texto, PDF_CONVERTIDO)
  })
})

describe("quando o conversor falha", () => {
  test("sem conversor configurado: 503, e a proxima abertura tenta de novo", async () => {
    const arquivo = await subir("PK sem conversor", "deck.pptx", PPTX)

    delete process.env.CONVERSOR_URL
    assert.equal((await pdfDe(arquivo, c.adminA.token)).status, 503)

    process.env.CONVERSOR_URL = conversor.url
    const r = await pdfDe(arquivo, c.adminA.token)
    assert.equal(r.status, 200, "a falha nao pode ter ficado guardada")
    assert.equal(r.texto, PDF_CONVERTIDO)
  })

  test("o conversor recusa o arquivo: 422, e nada fica guardado", async () => {
    const arquivo = await subir("PK corrompido", "quebrado.pptx", PPTX)

    responder = (resposta) => resposta.writeHead(400).end("arquivo invalido")
    assert.equal((await pdfDe(arquivo, c.adminA.token)).status, 422)

    responder = converteDepois(0)
    assert.equal((await pdfDe(arquivo, c.adminA.token)).status, 200)
    assert.equal(chamadas.length, 2)
  })

  test("o conversor ocupado (503 dele): 503 para quem pediu", async () => {
    const arquivo = await subir("PK fila cheia", "cheio.pptx", PPTX)
    responder = (resposta) => resposta.writeHead(503).end("fila cheia")
    assert.equal((await pdfDe(arquivo, c.adminA.token)).status, 503)
  })
})
