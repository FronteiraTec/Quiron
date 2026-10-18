/**
 * As pastas da biblioteca pessoal do mentor pela borda HTTP (migracao 025).
 *
 * Tres perguntas:
 *
 *   1. Organiza como um gerenciador de arquivos? Criar pasta e subpasta,
 *      criar material dentro dela, renomear, mover (um item ou varios, de uma
 *      vez) e excluir — sem que excluir uma pasta apague o que estava nela.
 *   2. A arvore se mantem de pe? Pasta nao entra nela mesma, irmas nao repetem
 *      nome, e um movimento com um id ruim nao move nada.
 *   3. Continua privada? Outro mentor e o admin nao veem, nao renomeiam, nao
 *      excluem e nao usam a pasta de ninguem — nem como destino de um
 *      material proprio.
 *
 * Os testes andam em ordem e compartilham o estado, como o fluxo real.
 */
const fs = require("fs")
const os = require("os")
const path = require("path")

process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "quiron-pastas-mentor-"))

const { test, describe, before, after } = require("node:test")
const assert = require("node:assert/strict")

const { prepararBanco, encerrar } = require("../apoio-teste/banco")
const { subirApi, req } = require("../apoio-teste/api")
const { query } = require("../src/config/db")

const tenantService = require("../src/services/tenantService")
const authService = require("../src/services/authService")

const ROOT = { id: null, root: true }

let api
let c
let mentorB

let pitch // raiz/Pitch
let modelos // raiz/Pitch/Modelos
let financeiro // raiz/Financeiro
let roteiro // material em Pitch/Modelos
let planilha // material na raiz

const T = () => c.tenantA.id_tenant

async function pessoa(idTenant, { nome, email, papel }) {
  const usuario = await tenantService.criarUsuario(
    idTenant,
    { nome, email, celular: "11900000000", senha: c.SENHA, papel },
    ROOT
  )
  const { token } = await authService.login({ email, senha: c.SENHA })
  return { id: usuario.id_usuario, token }
}

const criarPasta = (token, corpo) =>
  req(api.url, "/espaco-mentor/pastas", { metodo: "POST", token, corpo: { id_tenant: T(), ...corpo } })

const mover = (token, corpo) =>
  req(api.url, "/espaco-mentor/mover", { metodo: "POST", token, corpo: { id_tenant: T(), ...corpo } })

const biblioteca = (token) => req(api.url, `/espaco-mentor/materiais?id_tenant=${T()}`, { token })

function criarLink(token, corpo) {
  return req(api.url, "/espaco-mentor/materiais", {
    metodo: "POST",
    token,
    corpo: { id_tenant: T(), tipo: "LINK", url: "https://docs.exemplo.com/x", ...corpo },
  })
}

/** O estado atual, direto do banco — o que a tela vai ler na proxima carga. */
async function pastaDoMaterial(idMaterial) {
  const { rows } = await query(`SELECT id_pasta FROM mentor_material WHERE id_material = $1`, [idMaterial])
  return rows[0]?.id_pasta ?? null
}
async function paiDaPasta(idPasta) {
  const { rows } = await query(`SELECT id_pasta_pai, nome FROM mentor_pasta WHERE id_pasta = $1`, [idPasta])
  return rows[0]
}

before(async () => {
  await prepararBanco()
  c = await require("../apoio-teste/cenario").montarCenario()
  api = await subirApi()
  mentorB = await pessoa(T(), { nome: "Mentor B", email: "mentor.b.pastas@teste.invalid", papel: "mentor" })
})

after(async () => {
  await api.fechar()
  await encerrar()
  fs.rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true })
})

describe("1 · organizar", () => {
  test("cria pastas na raiz e dentro de outra", async () => {
    const a = await criarPasta(c.mentorA.token, { nome: "  Pitch  " })
    assert.equal(a.status, 201, JSON.stringify(a.corpo))
    pitch = a.corpo.pasta
    assert.equal(pitch.nome, "Pitch")
    assert.equal(pitch.id_pasta_pai, null)

    const b = await criarPasta(c.mentorA.token, { nome: "Modelos", id_pasta_pai: pitch.id_pasta })
    assert.equal(b.status, 201, JSON.stringify(b.corpo))
    modelos = b.corpo.pasta
    assert.equal(modelos.id_pasta_pai, pitch.id_pasta)

    const f = await criarPasta(c.mentorA.token, { nome: "Financeiro" })
    assert.equal(f.status, 201)
    financeiro = f.corpo.pasta
  })

  test("irmas nao repetem nome, sem diferenca de maiuscula; primas podem", async () => {
    const repetida = await criarPasta(c.mentorA.token, { nome: "pitch" })
    assert.equal(repetida.status, 409)
    const prima = await criarPasta(c.mentorA.token, { nome: "Modelos", id_pasta_pai: financeiro.id_pasta })
    assert.equal(prima.status, 201)
    await req(api.url, `/espaco-mentor/pastas/${prima.corpo.pasta.id_pasta}`, {
      metodo: "DELETE",
      token: c.mentorA.token,
    })
  })

  test("o material nasce na pasta que estava aberta", async () => {
    const r = await criarLink(c.mentorA.token, { titulo: "Roteiro do pitch", id_pasta: modelos.id_pasta })
    assert.equal(r.status, 201, JSON.stringify(r.corpo))
    roteiro = r.corpo.material
    assert.equal(roteiro.id_pasta, modelos.id_pasta)

    const p = await criarLink(c.mentorA.token, { titulo: "Planilha de unit economics" })
    assert.equal(p.status, 201)
    planilha = p.corpo.material
    assert.equal(planilha.id_pasta, null)
  })

  test("a biblioteca traz as pastas junto com os materiais", async () => {
    const r = await biblioteca(c.mentorA.token)
    assert.equal(r.status, 200)
    const nomes = r.corpo.pastas.map((p) => p.nome).sort()
    assert.deepEqual(nomes, ["Financeiro", "Modelos", "Pitch"])
    const doRoteiro = r.corpo.materiais.find((m) => m.id_material === roteiro.id_material)
    assert.equal(doRoteiro.id_pasta, modelos.id_pasta)
  })

  test("renomeia a pasta", async () => {
    const r = await req(api.url, `/espaco-mentor/pastas/${modelos.id_pasta}`, {
      metodo: "PATCH",
      token: c.mentorA.token,
      corpo: { nome: "Modelos de pitch" },
    })
    assert.equal(r.status, 200, JSON.stringify(r.corpo))
    assert.equal(r.corpo.pasta.nome, "Modelos de pitch")

    const vazio = await req(api.url, `/espaco-mentor/pastas/${modelos.id_pasta}`, {
      metodo: "PATCH",
      token: c.mentorA.token,
      corpo: { nome: "  " },
    })
    assert.equal(vazio.status, 400)
  })

  test("move um material e uma pasta de uma vez", async () => {
    const r = await mover(c.mentorA.token, {
      destino: financeiro.id_pasta,
      materiais: [planilha.id_material],
      pastas: [modelos.id_pasta],
    })
    assert.equal(r.status, 200, JSON.stringify(r.corpo))
    assert.equal(await pastaDoMaterial(planilha.id_material), financeiro.id_pasta)
    assert.equal((await paiDaPasta(modelos.id_pasta)).id_pasta_pai, financeiro.id_pasta)
    // O roteiro foi junto com a pasta dele, sem ninguem move-lo.
    assert.equal(await pastaDoMaterial(roteiro.id_material), modelos.id_pasta)
  })

  test("e volta para a raiz", async () => {
    const r = await mover(c.mentorA.token, { destino: null, materiais: [planilha.id_material] })
    assert.equal(r.status, 200)
    assert.equal(await pastaDoMaterial(planilha.id_material), null)
  })
})

describe("2 · a arvore se mantem de pe", () => {
  test("uma pasta nao vai para dentro dela mesma, nem de uma filha", async () => {
    const propria = await mover(c.mentorA.token, { destino: financeiro.id_pasta, pastas: [financeiro.id_pasta] })
    assert.equal(propria.status, 409)
    const filha = await mover(c.mentorA.token, { destino: modelos.id_pasta, pastas: [financeiro.id_pasta] })
    assert.equal(filha.status, 409)
    assert.equal((await paiDaPasta(financeiro.id_pasta)).id_pasta_pai, null)
  })

  test("um id ruim no meio derruba o movimento inteiro", async () => {
    const r = await mover(c.mentorA.token, {
      destino: pitch.id_pasta,
      materiais: [planilha.id_material, 999999],
    })
    assert.equal(r.status, 404)
    assert.equal(await pastaDoMaterial(planilha.id_material), null)
  })

  test("nada para mover, ou lista malformada, e 400", async () => {
    assert.equal((await mover(c.mentorA.token, { destino: null })).status, 400)
    assert.equal((await mover(c.mentorA.token, { destino: null, materiais: "1" })).status, 400)
  })
})

describe("3 · continua privada", () => {
  test("outro mentor nao ve as pastas de ninguem na propria biblioteca", async () => {
    const r = await biblioteca(mentorB.token)
    assert.equal(r.status, 200)
    assert.deepEqual(r.corpo.pastas, [])
  })

  test("nem renomeia, nem exclui, nem cria dentro, nem usa como destino", async () => {
    const renomear = await req(api.url, `/espaco-mentor/pastas/${pitch.id_pasta}`, {
      metodo: "PATCH",
      token: mentorB.token,
      corpo: { nome: "Minha agora" },
    })
    assert.equal(renomear.status, 404)

    const excluir = await req(api.url, `/espaco-mentor/pastas/${pitch.id_pasta}`, {
      metodo: "DELETE",
      token: mentorB.token,
    })
    assert.equal(excluir.status, 404)

    const dentro = await criarPasta(mentorB.token, { nome: "Intrusa", id_pasta_pai: pitch.id_pasta })
    assert.equal(dentro.status, 404)

    const material = await criarLink(mentorB.token, { titulo: "Do B", id_pasta: pitch.id_pasta })
    assert.equal(material.status, 404)

    const proprio = await criarLink(mentorB.token, { titulo: "Do B na raiz" })
    assert.equal(proprio.status, 201)
    const destino = await mover(mentorB.token, {
      destino: pitch.id_pasta,
      materiais: [proprio.corpo.material.id_material],
    })
    assert.equal(destino.status, 404)
  })

  test("nem move o material de outra pessoa para a propria pasta", async () => {
    const minha = await criarPasta(mentorB.token, { nome: "Do B" })
    assert.equal(minha.status, 201)
    const r = await mover(mentorB.token, {
      destino: minha.corpo.pasta.id_pasta,
      materiais: [roteiro.id_material],
    })
    assert.equal(r.status, 404)
    assert.equal(await pastaDoMaterial(roteiro.id_material), modelos.id_pasta)
  })

  test("o admin, com todas as chaves, tambem nao", async () => {
    const r = await req(api.url, `/espaco-mentor/pastas/${pitch.id_pasta}`, {
      metodo: "PATCH",
      token: c.adminA.token,
      corpo: { nome: "Do admin" },
    })
    assert.equal(r.status, 404)
  })

  test("o banco recusa o material na pasta de outra pessoa, mesmo sem o service", async () => {
    await assert.rejects(
      query(`UPDATE mentor_material SET id_pasta = $1 WHERE id_material = $2`, [
        pitch.id_pasta,
        (await biblioteca(mentorB.token)).corpo.materiais[0].id_material,
      ]),
      (err) => err.code === "23503"
    )
  })
})

describe("4 · excluir uma pasta nao apaga o que esta dentro", () => {
  test("o conteudo sobe para a pasta de cima; subpasta repetida ganha sufixo", async () => {
    // Financeiro/Modelos de pitch/Roteiro, e uma "Modelos de pitch" ja na raiz.
    const xara = await criarPasta(c.mentorA.token, { nome: "Modelos de pitch" })
    assert.equal(xara.status, 201)
    await mover(c.mentorA.token, { destino: financeiro.id_pasta, materiais: [planilha.id_material] })

    const r = await req(api.url, `/espaco-mentor/pastas/${financeiro.id_pasta}`, {
      metodo: "DELETE",
      token: c.mentorA.token,
    })
    assert.equal(r.status, 200, JSON.stringify(r.corpo))
    assert.equal(r.corpo.pastasMovidas, 1)
    assert.equal(r.corpo.materiaisMovidos, 1)

    assert.equal(await paiDaPasta(financeiro.id_pasta), undefined)
    const subiu = await paiDaPasta(modelos.id_pasta)
    assert.equal(subiu.id_pasta_pai, null)
    assert.equal(subiu.nome, "Modelos de pitch (2)")
    assert.equal(await pastaDoMaterial(planilha.id_material), null)
    // O roteiro continua na pasta dele, que so mudou de lugar.
    assert.equal(await pastaDoMaterial(roteiro.id_material), modelos.id_pasta)
  })

  test("a exclusao e as outras acoes ficam no log, com autor", async () => {
    const { rows } = await query(
      `SELECT acao FROM audit_log WHERE entidade = 'mentor_pasta' AND id_usuario = $1`,
      [c.mentorA.id]
    )
    const acoes = new Set(rows.map((r) => r.acao))
    for (const acao of ["CRIAR", "EDITAR", "MOVER", "EXCLUIR"]) assert.ok(acoes.has(acao), acao)
  })
})
