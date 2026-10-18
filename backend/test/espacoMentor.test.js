/**
 * O Espaco do Mentor pela borda HTTP (migracao 020).
 *
 * Tres perguntas atravessam o arquivo, e as tres valem um deploy:
 *
 *   1. O fluxo funciona? O mentor guarda material, ve as startups que
 *      acompanha, escolhe uma etapa da trilha e compartilha — e a startup
 *      recebe, com a orientacao, no lugar certo.
 *   2. A biblioteca pessoal e privada? Nem outro mentor (que tem a chave de
 *      entregas), nem o admin (que tem todas), nem a startup alcancam o material
 *      pela biblioteca ou pela rota generica de arquivos. A startup so o abre
 *      pelo compartilhamento.
 *   3. Os vinculos aguentam o mundo mudando? Material compartilhado nao se
 *      exclui; conteudo excluido na Biblioteca leva o vinculo junto; startup que
 *      sai da trilha deixa de ver; mentor desvinculado nao compartilha mais, mas
 *      ainda desfaz o que fez.
 *
 * Os testes andam em ordem e compartilham o estado (o material criado num
 * bloco e compartilhado no seguinte), como o fluxo real.
 */
const fs = require("fs")
const os = require("os")
const path = require("path")

// Os uploads vao para um diretorio descartavel: o arquivoService le UPLOAD_DIR
// na carga do modulo, entao isto vem antes de qualquer require do app.
process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "quiron-espaco-mentor-"))

const { test, describe, before, after } = require("node:test")
const assert = require("node:assert/strict")

const { prepararBanco, encerrar } = require("../apoio-teste/banco")
const { subirApi, req, enviarArquivo: enviar, baixar: baixarDe } = require("../apoio-teste/api")
const { query } = require("../src/config/db")

// O aviso por e-mail sai em segundo plano para o SMTP — ou, sem ele, para uma
// conta de teste do Ethereal, pela internet. O teste nao fala com a internet:
// o aviso vira um registro, e e esse registro que se confere.
const notificacaoService = require("../src/services/notificacaoService")
const avisos = []
notificacaoService.materialCompartilhado = (compartilhamento) => avisos.push(compartilhamento)

const tenantService = require("../src/services/tenantService")
const authService = require("../src/services/authService")
const startupService = require("../src/services/startupService")
const mentorRepository = require("../src/repositories/mentorRepository")
const trilhaRepository = require("../src/repositories/trilhaRepository")

const ROOT = { id: null, root: true }

let api
let c
let mentorB // mentor da A que acompanha so a startupDois
let colaboradorDois // membro da startupDois
let modulo
let fase
let faseExtra
let outraTrilha
let faseDaOutra

// Estado que o fluxo vai construindo.
let linkA // material LINK do mentorA
let arqA // material ARQUIVO do mentorA
let arquivoV1
let arquivoV2
let compPessoal // arqA -> startupUm, na fase
let compInst // conteudo da Biblioteca -> startupUm, no passo, como atividade
let conteudoInst

const T = () => c.tenantA.id_tenant
const PDF_V1 = "%PDF-1.4 hipoteses de mercado v1"
const PDF_V2 = "%PDF-1.4 hipoteses de mercado v2"
const ORIENTACAO =
  "Utilize este modelo para organizar as hipoteses de mercado levantadas nas " +
  "entrevistas e traga os resultados para nossa proxima mentoria."

/** Cria a pessoa no tenant e ja devolve o token dela (como o cenario faz). */
async function pessoa(idTenant, { nome, email, papel }) {
  const usuario = await tenantService.criarUsuario(
    idTenant,
    { nome, email, celular: "11900000000", senha: c.SENHA, papel },
    ROOT
  )
  const { token } = await authService.login({ email, senha: c.SENHA })
  return { id: usuario.id_usuario, token }
}

/** Sobe um arquivo pelo caminho de sempre (POST /arquivos) e exige o 201. */
async function enviarArquivo(token, conteudo, { nome = "modelo-hipoteses.pdf", ...opcoes } = {}) {
  const r = await enviar(api.url, token, T(), conteudo, { nome, ...opcoes })
  assert.equal(r.status, 201, `upload respondeu ${r.status}: ${JSON.stringify(r.corpo)}`)
  return r.corpo.arquivo
}

const baixar = (caminho, token) => baixarDe(api.url, caminho, token)

function criarMaterial(token, corpo) {
  return req(api.url, "/espaco-mentor/materiais", {
    metodo: "POST",
    token,
    corpo: { id_tenant: T(), ...corpo },
  })
}

function compartilhar(token, corpo) {
  return req(api.url, "/espaco-mentor/compartilhamentos", {
    metodo: "POST",
    token,
    corpo: { id_startup: c.startupUm.id_startup, id_programa: c.programa.id_no, ...corpo },
  })
}

function recebidos(token, idStartup = c.startupUm.id_startup, extra = "") {
  return req(api.url, `/jornada/materiais?id_startup=${idStartup}${extra}`, { token })
}

/**
 * Afirma que a resposta barrou (401, 403 ou 404), e nao entregou dado. Aceita
 * a resposta de `req` (corpo) e a de `baixar` (texto).
 */
function barrou(resposta, mensagem) {
  const corpo = JSON.stringify(resposta.corpo ?? resposta.texto ?? "")
  assert.ok(
    [401, 403, 404].includes(resposta.status),
    `${mensagem} — respondeu ${resposta.status} com ${corpo.slice(0, 160)}`
  )
}

before(async () => {
  await prepararBanco()
  c = await require("../apoio-teste/cenario").montarCenario()
  api = await subirApi()

  mentorB = await pessoa(T(), { nome: "Mentor B", email: "mentor.b@teste.invalid", papel: "mentor" })
  colaboradorDois = await pessoa(T(), {
    nome: "Colaborador Dois",
    email: "colab.dois@teste.invalid",
    papel: "usuario",
  })
  await startupService.adicionarMembro(c.startupDois.id_startup, colaboradorDois.id, true, c.adminA)

  // Quem acompanha quem: e o vinculo que recorta o compartilhamento.
  await mentorRepository.vincular(c.mentorA.id, c.startupUm.id_startup)
  await mentorRepository.vincular(mentorB.id, c.startupDois.id_startup)
  await trilhaRepository.matricular(c.programa.id_no, c.startupDois.id_startup)

  modulo = await trilhaRepository.buscarPorId(c.passo.id_pai)
  fase = await trilhaRepository.buscarPorId(modulo.id_pai)
  faseExtra = await trilhaRepository.criar({
    idTenant: T(),
    idPai: c.programa.id_no,
    tipo: "FASE",
    nome: "Fase Extra",
  })
  // Uma trilha em que a startupUm NAO esta matriculada.
  outraTrilha = await trilhaRepository.criar({
    idTenant: T(),
    idPai: null,
    tipo: "PROGRAMA",
    nome: "Outra trilha",
  })
  faseDaOutra = await trilhaRepository.criar({
    idTenant: T(),
    idPai: outraTrilha.id_no,
    tipo: "FASE",
    nome: "Fase da outra trilha",
  })
})

after(async () => {
  await api.fechar()
  await encerrar()
  fs.rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true })
})

// ---------------------------------------------------------------------------

describe("1 · acesso ao Espaco do Mentor", () => {
  test("o mentor com a role padrao abre a propria biblioteca, ainda vazia", async () => {
    const r = await req(api.url, `/espaco-mentor/materiais?id_tenant=${T()}`, { token: c.mentorA.token })
    assert.equal(r.status, 200)
    assert.deepEqual(r.corpo.materiais, [])
    assert.deepEqual(r.corpo.categorias, [])
  })

  test("o incubado, sem a chave, e barrado", async () => {
    const r = await req(api.url, `/espaco-mentor/materiais?id_tenant=${T()}`, {
      token: c.colaboradorA.token,
    })
    assert.equal(r.status, 403)
    const i = await req(api.url, `/espaco-mentor/incubados?id_tenant=${T()}`, {
      token: c.colaboradorA.token,
    })
    assert.equal(i.status, 403)
  })

  test("forasteiro e admin de outra incubadora sao barrados", async () => {
    barrou(
      await req(api.url, `/espaco-mentor/materiais?id_tenant=${T()}`, { token: c.forasteiro.token }),
      "forasteiro abriu o Espaco do Mentor"
    )
    barrou(
      await req(api.url, `/espaco-mentor/compartilhamentos?id_tenant=${T()}`, { token: c.adminB.token }),
      "admin B listou os compartilhamentos do tenant A"
    )
  })

  test("sem token, nada", async () => {
    const r = await req(api.url, `/espaco-mentor/materiais?id_tenant=${T()}`)
    assert.equal(r.status, 401)
  })
})

describe("2 · minha biblioteca", () => {
  test("cria um material de LINK, com descricao e categoria", async () => {
    const r = await criarMaterial(c.mentorA.token, {
      tipo: "LINK",
      titulo: "Roteiro de entrevista de problema",
      descricao: "As perguntas que eu uso na primeira rodada.",
      categoria: "Roteiro",
      url: "https://docs.exemplo.com/roteiro",
    })
    assert.equal(r.status, 201, JSON.stringify(r.corpo))
    linkA = r.corpo.material
    assert.equal(linkA.tipo, "LINK")
    assert.equal(linkA.id_mentor, c.mentorA.id)
    assert.equal(linkA.arquivado, false)
  })

  test("cria um material de ARQUIVO a partir do upload de sempre (POST /arquivos)", async () => {
    arquivoV1 = await enviarArquivo(c.mentorA.token, PDF_V1)
    const r = await criarMaterial(c.mentorA.token, {
      tipo: "ARQUIVO",
      titulo: "Modelo de hipoteses de mercado",
      categoria: "Modelo",
      id_arquivo: arquivoV1.id_arquivo,
    })
    assert.equal(r.status, 201, JSON.stringify(r.corpo))
    arqA = r.corpo.material
    assert.equal(arqA.arquivo_nome, "modelo-hipoteses.pdf")
    assert.equal(arqA.arquivo_mime, "application/pdf")
    assert.equal(arqA.id_arquivo, arquivoV1.id_arquivo)
  })

  test("o dono baixa o arquivo pelo material", async () => {
    const r = await baixar(`/espaco-mentor/materiais/${arqA.id_material}/arquivo`, c.mentorA.token)
    assert.equal(r.status, 200)
    assert.equal(r.texto, PDF_V1)
  })

  test("a lista traz os dois e as categorias em uso", async () => {
    const r = await req(api.url, `/espaco-mentor/materiais?id_tenant=${T()}`, { token: c.mentorA.token })
    assert.equal(r.status, 200)
    assert.equal(r.corpo.materiais.length, 2)
    assert.deepEqual(r.corpo.categorias, ["Modelo", "Roteiro"])
  })

  test("validacao: titulo, tipo e link inseguro sao recusados", async () => {
    const semTitulo = await criarMaterial(c.mentorA.token, { tipo: "LINK", url: "https://x.y" })
    assert.equal(semTitulo.status, 400)
    const script = await criarMaterial(c.mentorA.token, {
      tipo: "LINK",
      titulo: "x",
      url: "javascript:alert(document.cookie)",
    })
    assert.equal(script.status, 400)
  })

  test("nao aceita como corpo o arquivo enviado por OUTRA pessoa", async () => {
    // O anexo de entrega de uma startup e PRIVADO e do tenant; sem esta
    // checagem, quem soubesse o UUID o poria na propria biblioteca — e dali o
    // compartilharia com outra startup.
    const alheio = await enviarArquivo(c.colaboradorA.token, "%PDF-1.4 plano da startup", {
      nome: "plano.pdf",
    })
    const r = await criarMaterial(c.mentorA.token, {
      tipo: "ARQUIVO",
      titulo: "Pego emprestado",
      id_arquivo: alheio.id_arquivo,
    })
    assert.equal(r.status, 400)
  })

  test("nao aceita arquivo PUBLICO (sairia por URL sem token)", async () => {
    const publico = await enviarArquivo(c.mentorA.token, "png-falso", {
      nome: "logo.png",
      tipo: "image/png",
      visibilidade: "PUBLICO",
    })
    const r = await criarMaterial(c.mentorA.token, {
      tipo: "ARQUIVO",
      titulo: "Imagem publica",
      id_arquivo: publico.id_arquivo,
    })
    assert.equal(r.status, 400)
  })

  test("o mesmo arquivo nao vira dois materiais", async () => {
    const r = await criarMaterial(c.mentorA.token, {
      tipo: "ARQUIVO",
      titulo: "Copia",
      id_arquivo: arquivoV1.id_arquivo,
    })
    assert.equal(r.status, 409)
  })

  test("edita titulo, descricao e categoria", async () => {
    const r = await req(api.url, `/espaco-mentor/materiais/${linkA.id_material}`, {
      metodo: "PATCH",
      token: c.mentorA.token,
      corpo: { titulo: "Roteiro de entrevista (v2)", descricao: "", categoria: "Entrevistas" },
    })
    assert.equal(r.status, 200, JSON.stringify(r.corpo))
    assert.equal(r.corpo.material.titulo, "Roteiro de entrevista (v2)")
    assert.equal(r.corpo.material.descricao, null)
    assert.equal(r.corpo.material.categoria, "Entrevistas")
    linkA = r.corpo.material
  })

  test("troca o arquivo: o material passa a servir a versao nova e a antiga some", async () => {
    arquivoV2 = await enviarArquivo(c.mentorA.token, PDF_V2)
    const r = await req(api.url, `/espaco-mentor/materiais/${arqA.id_material}`, {
      metodo: "PATCH",
      token: c.mentorA.token,
      corpo: { id_arquivo: arquivoV2.id_arquivo },
    })
    assert.equal(r.status, 200, JSON.stringify(r.corpo))
    arqA = r.corpo.material

    const novo = await baixar(`/espaco-mentor/materiais/${arqA.id_material}/arquivo`, c.mentorA.token)
    assert.equal(novo.texto, PDF_V2)
    // O antigo nao ficou no volume, acessivel a quem tivesse o UUID.
    const antigo = await baixar(`/arquivos/${arquivoV1.id_arquivo}`, c.mentorA.token)
    assert.equal(antigo.status, 404)
  })

  test("arquiva e reativa", async () => {
    const arquivar = await req(api.url, `/espaco-mentor/materiais/${linkA.id_material}`, {
      metodo: "PATCH",
      token: c.mentorA.token,
      corpo: { arquivado: true },
    })
    assert.equal(arquivar.corpo.material.arquivado, true)
    const reativar = await req(api.url, `/espaco-mentor/materiais/${linkA.id_material}`, {
      metodo: "PATCH",
      token: c.mentorA.token,
      corpo: { arquivado: false },
    })
    assert.equal(reativar.corpo.material.arquivado, false)
  })
})

describe("3 · a biblioteca pessoal e privada", () => {
  test("outro mentor nao le, nao edita, nao exclui e nao baixa o material", async () => {
    const base = `/espaco-mentor/materiais/${arqA.id_material}`
    assert.equal((await req(api.url, base, { token: mentorB.token })).status, 404)
    assert.equal(
      (await req(api.url, base, { metodo: "PATCH", token: mentorB.token, corpo: { titulo: "meu" } })).status,
      404
    )
    assert.equal((await req(api.url, base, { metodo: "DELETE", token: mentorB.token })).status, 404)
    assert.equal((await baixar(`${base}/arquivo`, mentorB.token)).status, 404)
  })

  test("nem pela rota generica de arquivos — embora tenha a chave de baixar entregas", async () => {
    const r = await baixar(`/arquivos/${arquivoV2.id_arquivo}`, mentorB.token)
    assert.equal(r.status, 403)
    assert.ok(!r.texto.includes(PDF_V2), "os bytes do material vazaram")
    // O dono continua abrindo por ela.
    assert.equal((await baixar(`/arquivos/${arquivoV2.id_arquivo}`, c.mentorA.token)).status, 200)
  })

  test("o admin, com todas as chaves, tambem nao", async () => {
    assert.equal(
      (await req(api.url, `/espaco-mentor/materiais/${arqA.id_material}`, { token: c.adminA.token })).status,
      404
    )
    assert.equal((await baixar(`/arquivos/${arquivoV2.id_arquivo}`, c.adminA.token)).status, 403)
  })

  test("a biblioteca de outro mentor nao traz o material", async () => {
    const r = await req(api.url, `/espaco-mentor/materiais?id_tenant=${T()}`, { token: mentorB.token })
    assert.equal(r.status, 200)
    assert.equal(r.corpo.materiais.length, 0)
  })
})

describe("4 · meus incubados", () => {
  test("o mentor ve so as startups que acompanha, com trilha, progresso e fase atual", async () => {
    const r = await req(api.url, `/espaco-mentor/incubados?id_tenant=${T()}`, { token: c.mentorA.token })
    assert.equal(r.status, 200)
    assert.deepEqual(r.corpo.startups.map((s) => s.nome), ["Startup Um"])

    const [trilha] = r.corpo.startups[0].trilhas
    assert.equal(trilha.nome, "Programa de Teste")
    assert.equal(trilha.passos, 1)
    assert.equal(trilha.passos_concluidos, 0)
    // A entrega do cenario esta esperando avaliacao: a fase ainda nao fechou.
    assert.equal(trilha.fase_atual.nome, "Fase de Teste")
  })

  test("o outro mentor ve as dele; o admin, a incubadora inteira", async () => {
    const b = await req(api.url, `/espaco-mentor/incubados?id_tenant=${T()}`, { token: mentorB.token })
    assert.deepEqual(b.corpo.startups.map((s) => s.nome), ["Startup Dois"])
    const admin = await req(api.url, `/espaco-mentor/incubados?id_tenant=${T()}`, { token: c.adminA.token })
    assert.deepEqual(admin.corpo.startups.map((s) => s.nome).sort(), ["Startup Dois", "Startup Um"])
  })

  test("abre a trilha da startup: fases, modulos e passos com o estado de cada um", async () => {
    const r = await req(
      api.url,
      `/espaco-mentor/incubados/${c.startupUm.id_startup}/trilhas/${c.programa.id_no}`,
      { token: c.mentorA.token }
    )
    assert.equal(r.status, 200, JSON.stringify(r.corpo))
    const nomes = r.corpo.trilha.fases.map((f) => f.nome)
    assert.deepEqual(nomes, ["Fase de Teste", "Fase Extra"])
    const passo = r.corpo.trilha.fases[0].modulos[0].passos[0]
    assert.equal(passo.nome, "Passo de Teste")
    assert.equal(passo.status, "AGUARDANDO")
  })

  test("nao abre a trilha de startup que nao acompanha", async () => {
    const r = await req(
      api.url,
      `/espaco-mentor/incubados/${c.startupDois.id_startup}/trilhas/${c.programa.id_no}`,
      { token: c.mentorA.token }
    )
    assert.equal(r.status, 403)
  })

  test("nao abre trilha em que a startup nao esta matriculada", async () => {
    const r = await req(
      api.url,
      `/espaco-mentor/incubados/${c.startupUm.id_startup}/trilhas/${outraTrilha.id_no}`,
      { token: c.mentorA.token }
    )
    assert.equal(r.status, 404)
  })
})

describe("5 · compartilhar com um incubado", () => {
  test("material pessoal numa fase, como referencia, com a orientacao do mentor", async () => {
    const r = await compartilhar(c.mentorA.token, {
      id_material: arqA.id_material,
      id_no: fase.id_no,
      orientacao: ORIENTACAO,
    })
    assert.equal(r.status, 201, JSON.stringify(r.corpo))
    compPessoal = r.corpo.compartilhamento
    assert.equal(compPessoal.finalidade, "REFERENCIA")
    assert.equal(compPessoal.situacao, "DISPONIVEL")
    assert.equal(compPessoal.caminho, "Programa de Teste › Fase de Teste")
    assert.equal(compPessoal.meu, true)
    assert.equal(compPessoal.orientacao, ORIENTACAO)
    // A startup e avisada.
    assert.ok(avisos.some((a) => a.id_compartilhamento === compPessoal.id_compartilhamento))
  })

  test("conteudo da Biblioteca da incubadora num passo, associado a atividade", async () => {
    const criado = await req(api.url, "/conteudos", {
      metodo: "POST",
      token: c.adminA.token,
      corpo: {
        id_tenant: T(),
        tipo: "LINK",
        titulo: "Mapa de empatia",
        url: "https://biblioteca.exemplo/mapa",
      },
    })
    assert.equal(criado.status, 201)
    conteudoInst = criado.corpo.conteudo

    const r = await compartilhar(c.mentorA.token, {
      id_conteudo: conteudoInst.id_conteudo,
      id_no: c.passo.id_no,
      finalidade: "ATIVIDADE",
    })
    assert.equal(r.status, 201, JSON.stringify(r.corpo))
    compInst = r.corpo.compartilhamento
    assert.equal(compInst.origem, "INSTITUCIONAL")
    assert.equal(compInst.finalidade, "ATIVIDADE")
    assert.equal(compInst.caminho, "Programa de Teste › Fase de Teste › Passo de Teste")
  })

  test("o mesmo material no mesmo lugar nao se repete", async () => {
    const r = await compartilhar(c.mentorA.token, { id_material: arqA.id_material, id_no: fase.id_no })
    assert.equal(r.status, 409)
  })

  test("nao compartilha com startup que nao acompanha", async () => {
    const r = await compartilhar(c.mentorA.token, {
      id_startup: c.startupDois.id_startup,
      id_material: arqA.id_material,
    })
    assert.equal(r.status, 403)
  })

  test("atividade so num passo; etapa de outra trilha e trilha sem matricula sao recusadas", async () => {
    const naFase = await compartilhar(c.mentorA.token, {
      id_material: linkA.id_material,
      id_no: fase.id_no,
      finalidade: "ATIVIDADE",
    })
    assert.equal(naFase.status, 400)

    const outraEtapa = await compartilhar(c.mentorA.token, {
      id_material: linkA.id_material,
      id_no: faseDaOutra.id_no,
    })
    assert.equal(outraEtapa.status, 404)

    const semMatricula = await compartilhar(c.mentorA.token, {
      id_programa: outraTrilha.id_no,
      id_material: linkA.id_material,
    })
    assert.equal(semMatricula.status, 409)
  })

  test("nao compartilha o material de outro mentor, nem o conteudo de outra incubadora", async () => {
    const deB = await criarMaterial(mentorB.token, {
      tipo: "LINK",
      titulo: "Material do mentor B",
      url: "https://b.exemplo/material",
    })
    assert.equal(deB.status, 201)

    const alheio = await compartilhar(c.mentorA.token, { id_material: deB.corpo.material.id_material })
    assert.equal(alheio.status, 404)

    // E o mentor B nao entrega o material do A nem para a startup que ele acompanha.
    const doA = await compartilhar(mentorB.token, {
      id_startup: c.startupDois.id_startup,
      id_material: arqA.id_material,
    })
    assert.equal(doA.status, 404)

    const deFora = await req(api.url, "/conteudos", {
      metodo: "POST",
      token: c.adminB.token,
      corpo: {
        id_tenant: c.tenantB.id_tenant,
        tipo: "LINK",
        titulo: "Conteudo da B",
        url: "https://b.exemplo/conteudo",
      },
    })
    assert.equal(deFora.status, 201)
    const r = await compartilhar(c.mentorA.token, { id_conteudo: deFora.corpo.conteudo.id_conteudo })
    assert.equal(r.status, 404)
  })

  test("material arquivado nao e compartilhado", async () => {
    await req(api.url, `/espaco-mentor/materiais/${linkA.id_material}`, {
      metodo: "PATCH",
      token: c.mentorA.token,
      corpo: { arquivado: true },
    })
    const r = await compartilhar(c.mentorA.token, { id_material: linkA.id_material })
    assert.equal(r.status, 409)
    await req(api.url, `/espaco-mentor/materiais/${linkA.id_material}`, {
      metodo: "PATCH",
      token: c.mentorA.token,
      corpo: { arquivado: false },
    })
  })

  test("o incubado e o forasteiro nao compartilham", async () => {
    barrou(
      await compartilhar(c.colaboradorA.token, { id_material: arqA.id_material }),
      "incubado compartilhou"
    )
    barrou(
      await compartilhar(c.forasteiro.token, { id_material: arqA.id_material }),
      "forasteiro compartilhou"
    )
  })

  test("a biblioteca identifica o que ja foi compartilhado", async () => {
    const r = await req(api.url, `/espaco-mentor/materiais?id_tenant=${T()}`, { token: c.mentorA.token })
    const material = r.corpo.materiais.find((m) => m.id_material === arqA.id_material)
    assert.equal(material.total_compartilhamentos, 1)
    assert.deepEqual(material.startups_compartilhadas.map((s) => s.nome), ["Startup Um"])

    const detalhe = await req(api.url, `/espaco-mentor/materiais/${arqA.id_material}`, {
      token: c.mentorA.token,
    })
    assert.equal(detalhe.corpo.material.compartilhamentos.length, 1)
  })

  test("a visao consolidada traz destinatario, etapa, data, autor e orientacao", async () => {
    const r = await req(api.url, `/espaco-mentor/compartilhamentos?id_tenant=${T()}`, {
      token: c.mentorA.token,
    })
    assert.equal(r.status, 200)
    assert.equal(r.corpo.compartilhamentos.length, 2)
    const item = r.corpo.compartilhamentos.find(
      (x) => x.id_compartilhamento === compPessoal.id_compartilhamento
    )
    assert.equal(item.startup_nome, "Startup Um")
    assert.equal(item.fase_nome, "Fase de Teste")
    assert.equal(item.compartilhado_por_nome, "Mentor A")
    assert.equal(item.orientacao, ORIENTACAO)
    assert.ok(item.criado_ts)
    // O mentor B nao acompanha a startupUm nem compartilhou nada com ela.
    const b = await req(api.url, `/espaco-mentor/compartilhamentos?id_tenant=${T()}`, {
      token: mentorB.token,
    })
    assert.equal(b.corpo.compartilhamentos.length, 0)
  })
})

describe("6 · o incubado recebe, no contexto da trilha", () => {
  test("o membro ve os materiais com orientacao, autor, data, trilha e etapa", async () => {
    const r = await recebidos(c.colaboradorA.token)
    assert.equal(r.status, 200, JSON.stringify(r.corpo))
    assert.equal(r.corpo.materiais.length, 2)

    const pessoal = r.corpo.materiais.find((m) => m.origem === "PESSOAL")
    assert.equal(pessoal.titulo, "Modelo de hipoteses de mercado")
    assert.equal(pessoal.orientacao, ORIENTACAO)
    assert.equal(pessoal.compartilhado_por_nome, "Mentor A")
    assert.equal(pessoal.id_fase, fase.id_no)
    assert.equal(pessoal.programa_nome, "Programa de Teste")
    assert.ok(pessoal.criado_ts)
    assert.ok(pessoal.arquivo_url)
    // Nada da biblioteca de origem atravessa para a startup.
    for (const campo of ["id_material", "material_dono", "id_tenant", "material_arquivado_ts"]) {
      assert.ok(!(campo in pessoal), `o campo ${campo} vazou para a startup`)
    }

    const atividade = r.corpo.materiais.find((m) => m.origem === "INSTITUCIONAL")
    assert.equal(atividade.finalidade, "ATIVIDADE")
    assert.equal(atividade.id_no, c.passo.id_no)
  })

  test("filtra pela trilha, e trilha alheia e recusada", async () => {
    const r = await recebidos(c.colaboradorA.token, c.startupUm.id_startup, `&id_trilha=${c.programa.id_no}`)
    assert.equal(r.corpo.materiais.length, 2)
    const outra = await recebidos(c.colaboradorA.token, c.startupUm.id_startup, `&id_trilha=${outraTrilha.id_no}`)
    assert.equal(outra.status, 403)
  })

  test("abre o arquivo pelo compartilhamento — a versao atual", async () => {
    const r = await baixar(`/jornada/materiais/${compPessoal.id_compartilhamento}/arquivo`, c.colaboradorA.token)
    assert.equal(r.status, 200)
    assert.equal(r.texto, PDF_V2)
  })

  test("abre o detalhe do conteudo da Biblioteca", async () => {
    const r = await req(api.url, `/jornada/materiais/${compInst.id_compartilhamento}`, {
      token: c.colaboradorA.token,
    })
    assert.equal(r.status, 200)
    assert.equal(r.corpo.material.titulo, "Mapa de empatia")
    assert.equal(r.corpo.material.url, "https://biblioteca.exemplo/mapa")
  })

  test("mas nao alcanca a biblioteca do mentor, nem pela rota generica", async () => {
    barrou(
      await req(api.url, `/espaco-mentor/materiais/${arqA.id_material}`, { token: c.colaboradorA.token }),
      "o incubado leu a biblioteca do mentor"
    )
    assert.equal((await baixar(`/arquivos/${arquivoV2.id_arquivo}`, c.colaboradorA.token)).status, 403)
  })

  test("membro de outra startup nao ve nem baixa o que a startupUm recebeu", async () => {
    barrou(await recebidos(colaboradorDois.token), "listou os materiais de outra startup")
    barrou(
      await req(api.url, `/jornada/materiais/${compPessoal.id_compartilhamento}`, { token: colaboradorDois.token }),
      "abriu o material de outra startup"
    )
    const r = await baixar(`/jornada/materiais/${compPessoal.id_compartilhamento}/arquivo`, colaboradorDois.token)
    barrou(r, "baixou o arquivo de outra startup")
    assert.ok(!r.texto.includes(PDF_V2), "os bytes vazaram")
  })

  test("forasteiro nao ve nada", async () => {
    barrou(await recebidos(c.forasteiro.token), "forasteiro listou os materiais")
    barrou(
      await baixar(`/jornada/materiais/${compPessoal.id_compartilhamento}/arquivo`, c.forasteiro.token),
      "forasteiro baixou o material"
    )
  })
})

describe("7 · integridade dos vinculos", () => {
  test("material compartilhado nao pode ser excluido", async () => {
    const r = await req(api.url, `/espaco-mentor/materiais/${arqA.id_material}`, {
      metodo: "DELETE",
      token: c.mentorA.token,
    })
    assert.equal(r.status, 409)
    assert.match(r.corpo.erro, /compartilhad/)
  })

  test("so o autor edita ou remove o compartilhamento — nem o admin", async () => {
    const caminho = `/espaco-mentor/compartilhamentos/${compPessoal.id_compartilhamento}`
    for (const token of [mentorB.token, c.adminA.token]) {
      const editar = await req(api.url, caminho, { metodo: "PATCH", token, corpo: { orientacao: "x" } })
      assert.equal(editar.status, 403)
      const remover = await req(api.url, caminho, { metodo: "DELETE", token })
      assert.equal(remover.status, 403)
    }
    const r = await req(api.url, caminho, {
      metodo: "PATCH",
      token: c.mentorA.token,
      corpo: { orientacao: "Traga as hipoteses priorizadas." },
    })
    assert.equal(r.status, 200)
    assert.equal(r.corpo.compartilhamento.orientacao, "Traga as hipoteses priorizadas.")
  })

  test("etapa desativada no Construtor: o material volta para o nivel da trilha", async () => {
    const r = await compartilhar(c.mentorA.token, { id_material: linkA.id_material, id_no: faseExtra.id_no })
    assert.equal(r.status, 201)
    await trilhaRepository.atualizar(faseExtra.id_no, { ativo: false })

    const doMentor = await req(api.url, `/espaco-mentor/compartilhamentos?id_tenant=${T()}`, {
      token: c.mentorA.token,
    })
    const visto = doMentor.corpo.compartilhamentos.find(
      (x) => x.id_compartilhamento === r.corpo.compartilhamento.id_compartilhamento
    )
    assert.equal(visto.situacao, "ETAPA_INDISPONIVEL")

    const daStartup = await recebidos(c.colaboradorA.token)
    const recebido = daStartup.corpo.materiais.find(
      (x) => x.id_compartilhamento === r.corpo.compartilhamento.id_compartilhamento
    )
    assert.equal(recebido.id_no, null)
    assert.equal(recebido.id_fase, null)

    await trilhaRepository.atualizar(faseExtra.id_no, { ativo: true })
  })

  test("startup fora da trilha: o material some para ela, e o mentor ve a situacao", async () => {
    await trilhaRepository.desmatricular(c.programa.id_no, c.startupUm.id_startup)
    try {
      const r = await recebidos(c.colaboradorA.token)
      assert.equal(r.corpo.materiais.length, 0)
      const detalhe = await req(api.url, `/jornada/materiais/${compPessoal.id_compartilhamento}`, {
        token: c.colaboradorA.token,
      })
      assert.equal(detalhe.status, 404)

      const doMentor = await req(api.url, `/espaco-mentor/compartilhamentos?id_tenant=${T()}`, {
        token: c.mentorA.token,
      })
      assert.ok(doMentor.corpo.compartilhamentos.every((x) => x.situacao === "FORA_DA_TRILHA"))
    } finally {
      await trilhaRepository.matricular(c.programa.id_no, c.startupUm.id_startup)
    }
  })

  test("mentor desvinculado: nao compartilha mais, a startup mantem o material, e ele ainda o remove", async () => {
    await mentorRepository.desvincular(c.mentorA.id, c.startupUm.id_startup)
    try {
      const novo = await compartilhar(c.mentorA.token, { id_material: linkA.id_material })
      assert.equal(novo.status, 403)

      const incubados = await req(api.url, `/espaco-mentor/incubados?id_tenant=${T()}`, {
        token: c.mentorA.token,
      })
      assert.equal(incubados.corpo.startups.length, 0)

      // O que ja foi entregue continua com a startup.
      const daStartup = await recebidos(c.colaboradorA.token)
      assert.ok(daStartup.corpo.materiais.some((m) => m.id_compartilhamento === compPessoal.id_compartilhamento))

      // O mentor ainda ve o que fez, sabe que nao acompanha mais, e so pode desfazer.
      const doMentor = await req(api.url, `/espaco-mentor/compartilhamentos?id_tenant=${T()}`, {
        token: c.mentorA.token,
      })
      const item = doMentor.corpo.compartilhamentos.find(
        (x) => x.id_compartilhamento === compPessoal.id_compartilhamento
      )
      assert.equal(item.meu, true)
      assert.equal(item.acompanha, false)

      const caminho = `/espaco-mentor/compartilhamentos/${compPessoal.id_compartilhamento}`
      const editar = await req(api.url, caminho, {
        metodo: "PATCH",
        token: c.mentorA.token,
        corpo: { orientacao: "x" },
      })
      assert.equal(editar.status, 403)
      const remover = await req(api.url, caminho, { metodo: "DELETE", token: c.mentorA.token })
      assert.equal(remover.status, 200)

      const depois = await recebidos(c.colaboradorA.token)
      assert.ok(!depois.corpo.materiais.some((m) => m.id_compartilhamento === compPessoal.id_compartilhamento))
    } finally {
      await mentorRepository.vincular(c.mentorA.id, c.startupUm.id_startup)
    }
  })

  test("sem compartilhamentos, o material e excluido — e o arquivo vai junto", async () => {
    const r = await req(api.url, `/espaco-mentor/materiais/${arqA.id_material}`, {
      metodo: "DELETE",
      token: c.mentorA.token,
    })
    assert.equal(r.status, 200, JSON.stringify(r.corpo))
    assert.equal((await baixar(`/arquivos/${arquivoV2.id_arquivo}`, c.mentorA.token)).status, 404)
  })

  test("excluir o conteudo na Biblioteca leva os compartilhamentos junto — e a Biblioteca avisa antes", async () => {
    const antes = await req(api.url, `/conteudos/${conteudoInst.id_conteudo}`, { token: c.adminA.token })
    assert.equal(antes.corpo.conteudo.compartilhamentos, 1)
    const lista = await req(api.url, `/conteudos?id_tenant=${T()}`, { token: c.adminA.token })
    const naLista = lista.corpo.conteudos.find((x) => x.id_conteudo === conteudoInst.id_conteudo)
    assert.equal(naLista.compartilhamentos, 1)

    const excluir = await req(api.url, `/conteudos/${conteudoInst.id_conteudo}`, {
      metodo: "DELETE",
      token: c.adminA.token,
    })
    assert.equal(excluir.status, 204)

    const daStartup = await recebidos(c.colaboradorA.token)
    assert.ok(!daStartup.corpo.materiais.some((m) => m.id_compartilhamento === compInst.id_compartilhamento))
    const detalhe = await req(api.url, `/jornada/materiais/${compInst.id_compartilhamento}`, {
      token: c.colaboradorA.token,
    })
    assert.equal(detalhe.status, 404)
  })
})

describe("8 · auditoria", () => {
  test("criar, editar e excluir material e compartilhamento ficam no log, com autor", async () => {
    const { rows } = await query(
      `SELECT entidade, acao, id_usuario FROM audit_log
        WHERE entidade IN ('mentor_material', 'mentor_compartilhamento')`
    )
    const houve = (entidade, acao) =>
      rows.some((r) => r.entidade === entidade && r.acao === acao && r.id_usuario === c.mentorA.id)

    assert.ok(houve("mentor_material", "CRIAR"))
    assert.ok(houve("mentor_material", "EDITAR"))
    assert.ok(houve("mentor_material", "EXCLUIR"))
    assert.ok(houve("mentor_compartilhamento", "CRIAR"))
    assert.ok(houve("mentor_compartilhamento", "EDITAR"))
    assert.ok(houve("mentor_compartilhamento", "EXCLUIR"))
  })
})
