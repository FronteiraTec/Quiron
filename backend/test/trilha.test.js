/**
 * O Construtor pela borda HTTP: o passo que recebe entrega e a duplicacao.
 *
 * Duas perguntas, e as duas valem um deploy:
 *
 *   1. Da para dizer que um passo recebe entrega? Ate 13/09/2026 nao dava pela
 *      tela: permite_entrega nasce FALSE (default da coluna) e o Inspector nao
 *      mandava o campo, entao a trilha ficava montada e a incubada esbarrava
 *      em "o passo nao aceita entregas" ao enviar. Os quatro campos que
 *      definem a entrega andam juntos — e DESFAZER o vinculo com o
 *      questionario e o caso que a CHECK do banco recusa pela metade.
 *
 *   2. Duplicar leva o que esta dentro? Copiar so o no devolvia uma fase vazia
 *      chamada "(copia)". E a copia nao pode herdar matricula: quem faz a
 *      trilha antiga nao passa a fazer a nova por ela ter sido copiada.
 */
const { test, describe, before, after } = require("node:test")
const assert = require("node:assert/strict")

const { prepararBanco, encerrar } = require("../apoio-teste/banco")
const { subirApi, req } = require("../apoio-teste/api")

let api
let c

before(async () => {
  await prepararBanco()
  c = await require("../apoio-teste/cenario").montarCenario()
  api = await subirApi()
})

after(async () => {
  await api.fechar()
  await encerrar()
})

/** Cria um no da trilha e devolve o no criado. */
async function criarNo({ idPai, nome, token = c.adminA.token }) {
  const r = await req(api.url, "/trilha", {
    metodo: "POST",
    token,
    corpo: { id_tenant: c.tenantA.id_tenant, id_pai: idPai, nome },
  })
  assert.equal(r.status, 201, `criar "${nome}" respondeu ${JSON.stringify(r.corpo)}`)
  return r.corpo.no
}

/** Edita um no e devolve a resposta crua (o status importa em varios testes). */
function editarNo(idNo, corpo, token = c.adminA.token) {
  return req(api.url, `/trilha/${idNo}`, { metodo: "PATCH", token, corpo })
}

/** A arvore inteira de uma trilha, pela raiz. */
async function arvore(idPrograma, token = c.adminA.token) {
  const r = await req(api.url, `/trilha/programas/${idPrograma}`, { token })
  assert.equal(r.status, 200, `arvore respondeu ${JSON.stringify(r.corpo)}`)
  return r.corpo.trilha
}

/** Monta PROGRAMA > FASE > MODULO > PASSO novo, isolado dos outros testes. */
async function montarTrilha(nome) {
  const programa = await criarNo({ idPai: null, nome })
  const fase = await criarNo({ idPai: programa.id_no, nome: "Descoberta" })
  const modulo = await criarNo({ idPai: fase.id_no, nome: "Cliente" })
  const passo = await criarNo({ idPai: modulo.id_no, nome: "Entrevistar 10 pessoas" })
  return { programa, fase, modulo, passo }
}

// ---------------------------------------------------------------------------

describe("PASSO · o que a startup faz nele", () => {
  test("o passo nasce sem aceitar entrega — e por isso a tela precisa do campo", async () => {
    const { passo } = await montarTrilha("Trilha do default")
    assert.equal(passo.permite_entrega, false)
    assert.equal(passo.tipo_passo, null)
  })

  test("ligar a entrega grava os quatro campos de uma vez", async () => {
    const { passo } = await montarTrilha("Trilha da entrega")

    const r = await editarNo(passo.id_no, {
      permite_entrega: true,
      tipo_passo: "ANEXO",
      obrigatoria: true,
      id_questionario: null,
    })

    assert.equal(r.status, 200, JSON.stringify(r.corpo))
    assert.equal(r.corpo.no.permite_entrega, true)
    assert.equal(r.corpo.no.tipo_passo, "ANEXO")
    assert.equal(r.corpo.no.obrigatoria, true)
  })

  test("passo de questionario aponta para o questionario, e volta atras sem quebrar", async () => {
    const { passo } = await montarTrilha("Trilha do questionario")

    const q = await req(api.url, "/questionarios", {
      metodo: "POST",
      token: c.adminA.token,
      corpo: {
        id_tenant: c.tenantA.id_tenant,
        titulo: "Diagnostico inicial",
        descricao: "Onde a startup esta hoje.",
        perguntas: [{ pergunta: "Qual o seu problema?", tipo: "PARAGRAFO", obrigatoria: true }],
      },
    })
    assert.equal(q.status, 201, JSON.stringify(q.corpo))

    const vinculado = await editarNo(passo.id_no, {
      permite_entrega: true,
      tipo_passo: "QUESTIONARIO",
      obrigatoria: true,
      id_questionario: q.corpo.questionario.id_questionario,
    })
    assert.equal(vinculado.status, 200, JSON.stringify(vinculado.corpo))
    assert.equal(
      vinculado.corpo.no.id_questionario,
      q.corpo.questionario.id_questionario
    )

    // O caso que a CHECK ck_trilha_no_questionario recusa pela metade: trocar
    // o tipo SEM soltar o questionario. A tela manda os dois juntos.
    const desfeito = await editarNo(passo.id_no, {
      permite_entrega: true,
      tipo_passo: "TEXTO",
      obrigatoria: true,
      id_questionario: null,
    })
    assert.equal(desfeito.status, 200, JSON.stringify(desfeito.corpo))
    assert.equal(desfeito.corpo.no.tipo_passo, "TEXTO")
    assert.equal(desfeito.corpo.no.id_questionario, null)
  })

  test("desligar a entrega solta o tipo e o questionario junto", async () => {
    const { passo } = await montarTrilha("Trilha que volta a ser conteudo")

    const q = await req(api.url, "/questionarios", {
      metodo: "POST",
      token: c.adminA.token,
      corpo: {
        id_tenant: c.tenantA.id_tenant,
        titulo: "Checkpoint",
        descricao: "Meio do caminho.",
        perguntas: [{ pergunta: "Como foi?", tipo: "TEXTO_CURTO", obrigatoria: false }],
      },
    })
    await editarNo(passo.id_no, {
      permite_entrega: true,
      tipo_passo: "QUESTIONARIO",
      id_questionario: q.corpo.questionario.id_questionario,
    })

    // O que o Inspector manda quando alguem desliga "a startup entrega algo":
    // os tres campos de uma vez, senao a CHECK do banco recusa o meio-termo.
    const r = await editarNo(passo.id_no, {
      permite_entrega: false,
      tipo_passo: null,
      id_questionario: null,
    })

    assert.equal(r.status, 200, JSON.stringify(r.corpo))
    assert.equal(r.corpo.no.permite_entrega, false)
    assert.equal(r.corpo.no.tipo_passo, null)
    assert.equal(r.corpo.no.id_questionario, null)
  })

  test("questionario preso a um passo que nao e de questionario e recusado", async () => {
    const { passo } = await montarTrilha("Trilha da combinacao invalida")

    const r = await editarNo(passo.id_no, {
      permite_entrega: true,
      tipo_passo: "TEXTO",
      id_questionario: 1,
    })

    assert.equal(r.status, 400, JSON.stringify(r.corpo))
  })

  test("campo de passo numa FASE e recusado", async () => {
    const { fase } = await montarTrilha("Trilha do campo fora de lugar")
    const r = await editarNo(fase.id_no, { permite_entrega: true })
    assert.equal(r.status, 400, JSON.stringify(r.corpo))
  })
})

describe("Duplicar · a copia leva o que esta dentro", () => {
  test("duplicar uma FASE copia modulos, passos e o que foi configurado neles", async () => {
    const { programa, fase, passo } = await montarTrilha("Trilha a duplicar")
    await editarNo(passo.id_no, {
      permite_entrega: true,
      tipo_passo: "ANEXO",
      obrigatoria: false,
      entregavel: "Dez entrevistas transcritas",
    })

    const r = await req(api.url, `/trilha/${fase.id_no}/duplicar`, {
      metodo: "POST",
      token: c.adminA.token,
    })
    assert.equal(r.status, 201, JSON.stringify(r.corpo))
    assert.equal(r.corpo.no.nome, "Descoberta (cópia)")

    const raiz = await arvore(programa.id_no)
    const copia = raiz.filhos.find((f) => f.id_no === r.corpo.no.id_no)

    assert.equal(raiz.filhos.length, 2, "a copia entra como irma da original")
    assert.equal(copia.filhos.length, 1, "o modulo veio junto")
    assert.equal(copia.filhos[0].nome, "Cliente")

    const passoCopia = copia.filhos[0].filhos[0]
    assert.equal(passoCopia.nome, "Entrevistar 10 pessoas", "o passo veio junto")
    assert.notEqual(passoCopia.id_no, passo.id_no, "a copia tem id proprio")
    assert.equal(passoCopia.permite_entrega, true, "a configuracao da entrega veio junto")
    assert.equal(passoCopia.tipo_passo, "ANEXO")
    assert.equal(passoCopia.obrigatoria, false)
    assert.equal(passoCopia.entregavel, "Dez entrevistas transcritas")
  })

  test("duplicar o PASSO leva os conteudos da Biblioteca vinculados a ele", async () => {
    const { modulo, passo } = await montarTrilha("Trilha do conteudo")

    const conteudo = await req(api.url, "/conteudos", {
      metodo: "POST",
      token: c.adminA.token,
      corpo: { id_tenant: c.tenantA.id_tenant, tipo: "AULA", titulo: "Como entrevistar" },
    })
    assert.equal(conteudo.status, 201, JSON.stringify(conteudo.corpo))

    const vinculo = await req(api.url, `/trilha/${passo.id_no}/conteudos`, {
      metodo: "POST",
      token: c.adminA.token,
      corpo: { id_conteudo: conteudo.corpo.conteudo.id_conteudo },
    })
    assert.equal(vinculo.status, 201, JSON.stringify(vinculo.corpo))

    const r = await req(api.url, `/trilha/${passo.id_no}/duplicar`, {
      metodo: "POST",
      token: c.adminA.token,
    })
    assert.equal(r.status, 201, JSON.stringify(r.corpo))
    assert.equal(r.corpo.no.id_pai, modulo.id_no, "a copia fica no mesmo modulo")

    const daCopia = await req(api.url, `/trilha/${r.corpo.no.id_no}/conteudos`, {
      token: c.adminA.token,
    })
    assert.equal(daCopia.status, 200)
    assert.equal(daCopia.corpo.conteudos.length, 1)
    assert.equal(
      daCopia.corpo.conteudos[0].id_conteudo,
      conteudo.corpo.conteudo.id_conteudo,
      "aponta para o MESMO conteudo da Biblioteca, nao para uma copia dele"
    )
  })

  test("duplicar a raiz cria outra trilha, sem as startups e sem o titulo de padrao", async () => {
    const { programa } = await montarTrilha("Turma 2026")

    const matricula = await req(api.url, `/trilha/${programa.id_no}/startups`, {
      metodo: "POST",
      token: c.adminA.token,
      corpo: { id_startup: c.startupUm.id_startup },
    })
    assert.equal(matricula.status, 201, JSON.stringify(matricula.corpo))

    const padrao = await req(api.url, `/trilha/${programa.id_no}/padrao`, {
      metodo: "PATCH",
      token: c.adminA.token,
    })
    assert.equal(padrao.status, 200, JSON.stringify(padrao.corpo))

    const r = await req(api.url, `/trilha/${programa.id_no}/duplicar`, {
      metodo: "POST",
      token: c.adminA.token,
      corpo: { nome: "Turma 2027" },
    })
    assert.equal(r.status, 201, JSON.stringify(r.corpo))
    assert.equal(r.corpo.no.nome, "Turma 2027")
    assert.equal(r.corpo.no.tipo, "PROGRAMA")
    assert.equal(r.corpo.no.id_pai, null)

    const copia = await arvore(r.corpo.no.id_no)
    assert.equal(copia.filhos.length, 1, "a estrutura veio junto")

    // `padrao` nao volta no no (nao esta nas colunas do contrato); quem sabe
    // dele e a lista de trilhas, que e de onde o seletor do Construtor le.
    const lista = await req(
      api.url,
      `/trilha/programas?id_tenant=${c.tenantA.id_tenant}`,
      { token: c.adminA.token }
    )
    assert.equal(lista.status, 200, JSON.stringify(lista.corpo))
    const naLista = lista.corpo.programas.find(
      (p) => Number(p.id_no) === Number(r.corpo.no.id_no)
    )
    assert.equal(naLista.padrao, false, "so uma trilha por incubadora e a padrao")
    assert.equal(naLista.startups, 0, "a copia nao herda a turma")

    const alunos = await req(api.url, `/trilha/${r.corpo.no.id_no}/startups`, {
      token: c.adminA.token,
    })
    assert.equal(alunos.status, 200)
    assert.equal(alunos.corpo.startups.length, 0, "a copia nasce sem matricula")
  })

  test("admin de outra incubadora nao duplica nada", async () => {
    const { fase } = await montarTrilha("Trilha alheia")

    const r = await req(api.url, `/trilha/${fase.id_no}/duplicar`, {
      metodo: "POST",
      token: c.adminB.token,
    })

    assert.equal(r.status, 403, JSON.stringify(r.corpo))
  })
})
