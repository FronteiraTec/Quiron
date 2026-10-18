/**
 * Os materiais que a incubadora publica para os mentores, pela borda HTTP
 * (migracao 021).
 *
 * Tres perguntas:
 *
 *   1. A coordenacao publica e o mentor recebe? Arquivo e link, com o upload
 *      de sempre, e o mentor baixa pelo proprio material.
 *   2. Fica so entre a incubadora e os mentores? O incubado nao ve — uma
 *      rubrica de avaliacao nao e para quem e avaliado por ela —, o mentor nao
 *      publica, e o arquivo nao escapa pela rota generica de arquivos.
 *   3. Arquivar e excluir fazem o que dizem? Arquivado sai da vista do mentor e
 *      continua com quem gerencia; excluido leva o arquivo junto.
 */
const fs = require("fs")
const os = require("os")
const path = require("path")

// O arquivoService le UPLOAD_DIR na carga: isto vem antes de qualquer require do app.
process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "quiron-materiais-incubadora-"))

const { test, describe, before, after } = require("node:test")
const assert = require("node:assert/strict")

const { prepararBanco, encerrar } = require("../apoio-teste/banco")
const { subirApi, req, enviarArquivo, baixar } = require("../apoio-teste/api")
const { query } = require("../src/config/db")

let api
let c
let guia // o material com arquivo que o fluxo vai mexendo
let arquivoGuia

const T = () => c.tenantA.id_tenant
const PDF = "%PDF-1.4 guia do mentor v1"
const PDF_V2 = "%PDF-1.4 guia do mentor v2"

async function subir(token, conteudo, nome = "guia-do-mentor.pdf") {
  const r = await enviarArquivo(api.url, token, T(), conteudo, { nome })
  assert.equal(r.status, 201, JSON.stringify(r.corpo))
  return r.corpo.arquivo
}

function publicar(token, corpo) {
  return req(api.url, "/espaco-mentor/incubadora", {
    metodo: "POST",
    token,
    corpo: { id_tenant: T(), ...corpo },
  })
}

function listar(token, idTenant = T()) {
  return req(api.url, `/espaco-mentor/incubadora?id_tenant=${idTenant}`, { token })
}

/** 401, 403 ou 404 — e nenhum dado no corpo. */
function barrou(resposta, mensagem) {
  const corpo = JSON.stringify(resposta.corpo ?? resposta.texto ?? "")
  assert.ok([401, 403, 404].includes(resposta.status), `${mensagem} — respondeu ${resposta.status} com ${corpo.slice(0, 160)}`)
}

before(async () => {
  await prepararBanco()
  c = await require("../apoio-teste/cenario").montarCenario()
  api = await subirApi()
})

after(async () => {
  await api.fechar()
  await encerrar()
  fs.rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true })
})

describe("1 · a coordenacao publica, o mentor recebe", () => {
  test("a role Mentor nasce so com a chave de ver; o Administrador, com todas", async () => {
    const m = await req(api.url, `/permissoes/minhas?id_tenant=${T()}`, { token: c.mentorA.token })
    const doMentor = m.corpo.permissoes.filter((p) => p.startsWith("mentoria.materiais_incubadora"))
    assert.deepEqual(doMentor, ["mentoria.materiais_incubadora.visualizar"])

    const a = await req(api.url, `/permissoes/minhas?id_tenant=${T()}`, { token: c.adminA.token })
    const doAdmin = a.corpo.permissoes.filter((p) => p.startsWith("mentoria.materiais_incubadora")).sort()
    assert.equal(doAdmin.length, 4)
  })

  test("o admin publica um material com arquivo, pelo upload de sempre", async () => {
    arquivoGuia = await subir(c.adminA.token, PDF)
    const r = await publicar(c.adminA.token, {
      tipo: "ARQUIVO",
      titulo: "Guia do mentor 2026",
      descricao: "Como conduzir a primeira reunião e o que esperar de cada fase.",
      categoria: "Guia",
      id_arquivo: arquivoGuia.id_arquivo,
    })
    assert.equal(r.status, 201, JSON.stringify(r.corpo))
    guia = r.corpo.material
    assert.equal(guia.criado_por_nome, "Admin A")
    assert.equal(guia.arquivo_nome, "guia-do-mentor.pdf")
    assert.equal(guia.arquivado, false)
  })

  test("e um link", async () => {
    const r = await publicar(c.adminA.token, {
      tipo: "LINK",
      titulo: "Rubrica de avaliação das entregas",
      categoria: "Avaliação",
      url: "https://docs.exemplo.com/rubrica",
    })
    assert.equal(r.status, 201, JSON.stringify(r.corpo))
  })

  test("o mentor ve os dois, com as categorias, e baixa o arquivo pelo material", async () => {
    const r = await listar(c.mentorA.token)
    assert.equal(r.status, 200)
    assert.deepEqual(r.corpo.materiais.map((m) => m.titulo).sort(), [
      "Guia do mentor 2026",
      "Rubrica de avaliação das entregas",
    ])
    assert.deepEqual(r.corpo.categorias, ["Avaliação", "Guia"])

    const arquivo = await baixar(api.url, `/espaco-mentor/incubadora/${guia.id_material}/arquivo`, c.mentorA.token)
    assert.equal(arquivo.status, 200)
    assert.equal(arquivo.texto, PDF)
  })

  test("validacao: link inseguro e arquivo de outra pessoa sao recusados", async () => {
    const script = await publicar(c.adminA.token, { tipo: "LINK", titulo: "x", url: "javascript:alert(1)" })
    assert.equal(script.status, 400)

    const doMentor = await subir(c.mentorA.token, "%PDF-1.4 do mentor", "do-mentor.pdf")
    const alheio = await publicar(c.adminA.token, {
      tipo: "ARQUIVO",
      titulo: "Pego emprestado",
      id_arquivo: doMentor.id_arquivo,
    })
    assert.equal(alheio.status, 400)
  })

  test("o arquivo de um material nao vira o de outro — nem na biblioteca pessoal", async () => {
    const r = await req(api.url, "/espaco-mentor/materiais", {
      metodo: "POST",
      token: c.adminA.token,
      corpo: { id_tenant: T(), tipo: "ARQUIVO", titulo: "Copia", id_arquivo: arquivoGuia.id_arquivo },
    })
    assert.equal(r.status, 409)
  })
})

describe("2 · fica entre a incubadora e os mentores", () => {
  test("o mentor nao publica, nao edita e nao exclui", async () => {
    const criar = await publicar(c.mentorA.token, { tipo: "LINK", titulo: "x", url: "https://x.exemplo" })
    assert.equal(criar.status, 403)
    const caminho = `/espaco-mentor/incubadora/${guia.id_material}`
    const editar = await req(api.url, caminho, { metodo: "PATCH", token: c.mentorA.token, corpo: { titulo: "meu" } })
    assert.equal(editar.status, 403)
    const excluir = await req(api.url, caminho, { metodo: "DELETE", token: c.mentorA.token })
    assert.equal(excluir.status, 403)
  })

  test("o incubado nao ve nem baixa — a rubrica nao e para quem e avaliado por ela", async () => {
    assert.equal((await listar(c.colaboradorA.token)).status, 403)
    const r = await baixar(api.url, `/espaco-mentor/incubadora/${guia.id_material}/arquivo`, c.colaboradorA.token)
    barrou(r, "o incubado baixou o material dos mentores")
    assert.ok(!r.texto.includes(PDF), "os bytes vazaram")
  })

  test("forasteiro e admin de outra incubadora nao alcancam nada", async () => {
    barrou(await listar(c.forasteiro.token), "forasteiro listou")
    barrou(await listar(c.adminB.token, T()), "admin B listou os materiais do tenant A")
    barrou(
      await req(api.url, `/espaco-mentor/incubadora/${guia.id_material}`, { token: c.adminB.token }),
      "admin B abriu o material do tenant A"
    )
    barrou(
      await req(api.url, `/espaco-mentor/incubadora/${guia.id_material}`, {
        metodo: "PATCH",
        token: c.adminB.token,
        corpo: { titulo: "invadido" },
      }),
      "admin B editou o material do tenant A"
    )
  })

  test("nem pela rota generica de arquivos: so quem enviou abre por ela", async () => {
    // O mentor TEM a chave de baixar entregas — e ainda assim nao abre por la.
    assert.equal((await baixar(api.url, `/arquivos/${arquivoGuia.id_arquivo}`, c.mentorA.token)).status, 403)
    assert.equal((await baixar(api.url, `/arquivos/${arquivoGuia.id_arquivo}`, c.adminA.token)).status, 200)
  })
})

describe("3 · arquivar, trocar e excluir", () => {
  test("arquivado sai da vista do mentor; quem edita continua vendo e reativa", async () => {
    const caminho = `/espaco-mentor/incubadora/${guia.id_material}`
    const arquivar = await req(api.url, caminho, {
      metodo: "PATCH",
      token: c.adminA.token,
      corpo: { arquivado: true },
    })
    assert.equal(arquivar.status, 200)
    assert.equal(arquivar.corpo.material.arquivado, true)

    const doMentor = await listar(c.mentorA.token)
    assert.ok(!doMentor.corpo.materiais.some((m) => m.id_material === guia.id_material))
    assert.ok(!doMentor.corpo.categorias.includes("Guia"), "a categoria do arquivado continuou no filtro")
    assert.equal((await req(api.url, caminho, { token: c.mentorA.token })).status, 404)
    assert.equal((await baixar(api.url, `${caminho}/arquivo`, c.mentorA.token)).status, 404)

    const doAdmin = await listar(c.adminA.token)
    const visto = doAdmin.corpo.materiais.find((m) => m.id_material === guia.id_material)
    assert.equal(visto.arquivado, true)

    const reativar = await req(api.url, caminho, {
      metodo: "PATCH",
      token: c.adminA.token,
      corpo: { arquivado: false },
    })
    assert.equal(reativar.corpo.material.arquivado, false)
    assert.ok((await listar(c.mentorA.token)).corpo.materiais.some((m) => m.id_material === guia.id_material))
  })

  test("trocar o arquivo: o mentor baixa a versao nova, e a antiga some", async () => {
    const novo = await subir(c.adminA.token, PDF_V2)
    const r = await req(api.url, `/espaco-mentor/incubadora/${guia.id_material}`, {
      metodo: "PATCH",
      token: c.adminA.token,
      corpo: { id_arquivo: novo.id_arquivo },
    })
    assert.equal(r.status, 200, JSON.stringify(r.corpo))
    assert.equal(r.corpo.material.atualizado_por_nome, "Admin A")

    const baixado = await baixar(api.url, `/espaco-mentor/incubadora/${guia.id_material}/arquivo`, c.mentorA.token)
    assert.equal(baixado.texto, PDF_V2)
    assert.equal((await baixar(api.url, `/arquivos/${arquivoGuia.id_arquivo}`, c.adminA.token)).status, 404)
    arquivoGuia = novo
  })

  test("excluir apaga o material e o arquivo", async () => {
    const r = await req(api.url, `/espaco-mentor/incubadora/${guia.id_material}`, {
      metodo: "DELETE",
      token: c.adminA.token,
    })
    assert.equal(r.status, 200)
    assert.ok(!(await listar(c.mentorA.token)).corpo.materiais.some((m) => m.id_material === guia.id_material))
    assert.equal((await baixar(api.url, `/arquivos/${arquivoGuia.id_arquivo}`, c.adminA.token)).status, 404)
  })

  test("publicar, editar e excluir ficam no log, com autor", async () => {
    const { rows } = await query(
      `SELECT acao, id_usuario FROM audit_log WHERE entidade = 'mentor_material_incubadora'`
    )
    for (const acao of ["CRIAR", "EDITAR", "EXCLUIR"]) {
      assert.ok(
        rows.some((r) => r.acao === acao && r.id_usuario === c.adminA.id),
        `faltou ${acao} no log`
      )
    }
  })
})
