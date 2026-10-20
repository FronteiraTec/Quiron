/**
 * Questionario no modo PROVA (migracao 024).
 *
 * Tres perguntas:
 *
 *   1. A correcao conta certo? Escolha unica pela alternativa marcada; caixas
 *      de selecao so pontuam com EXATAMENTE as corretas; em branco e erro.
 *   2. Uma prova sem gabarito coerente nao nasce? Texto livre, escolha unica
 *      com duas corretas, caixas sem nenhuma.
 *   3. O gabarito fica com quem avalia? O incubado abre a prova sem ele, recebe
 *      a nota ao entregar — sem a resposta certa — e o mentor ve tudo.
 */
const { test, describe, before, after } = require("node:test")
const assert = require("node:assert/strict")

const { corrigir } = require("../src/questionarios/prova")

describe("1 · a correcao", () => {
  const perguntas = [
    {
      id_pergunta: 1,
      pergunta: "Capital do Brasil?",
      alternativas: [
        { id_alternativa: 10, descricao: "Rio", correta: false },
        { id_alternativa: 11, descricao: "Brasilia", correta: true },
      ],
    },
    {
      id_pergunta: 2,
      pergunta: "Quais sao primos?",
      alternativas: [
        { id_alternativa: 20, descricao: "2", correta: true },
        { id_alternativa: 21, descricao: "4", correta: false },
        { id_alternativa: 22, descricao: "5", correta: true },
      ],
    },
  ]
  const nota = (marcadas) => corrigir(perguntas, new Map(Object.entries(marcadas).map(([k, v]) => [Number(k), v])))

  test("tudo certo vale um ponto por pergunta", () => {
    const r = nota({ 1: [11], 2: [20, 22] })
    assert.equal(r.acertos, 2)
    assert.equal(r.total, 2)
  })

  test("caixa a mais ou a menos erra a pergunta inteira", () => {
    assert.equal(nota({ 1: [11], 2: [20, 21, 22] }).acertos, 1, "marcar todas nao pode pontuar")
    assert.equal(nota({ 1: [11], 2: [20] }).acertos, 1, "metade das corretas nao pontua")
  })

  test("pergunta em branco conta como erro, e o gabarito sai junto", () => {
    const r = nota({ 2: [22, 20] })
    assert.equal(r.acertos, 1)
    assert.equal(r.total, 2)
    assert.deepEqual(r.perguntas[0], {
      id_pergunta: 1,
      pergunta: "Capital do Brasil?",
      acertou: false,
      corretas: [11],
      gabarito: ["Brasilia"],
    })
  })
})

describe("pela borda HTTP", () => {
  let api
  let c
  let req
  let encerrar
  let idProva
  let passoProva

  const T = () => c.tenantA.id_tenant

  const PERGUNTAS = [
    {
      pergunta: "Qual e a etapa de validacao?",
      tipo: "ESCOLHA_UNICA",
      obrigatoria: true,
      alternativas: [
        { descricao: "Escrever o plano de negocios" },
        { descricao: "Testar a hipotese com clientes", correta: true },
      ],
    },
    {
      pergunta: "Quais sao blocos do Canvas?",
      tipo: "CAIXAS_SELECAO",
      obrigatoria: false,
      alternativas: [
        { descricao: "Proposta de valor", correta: true },
        { descricao: "Organograma" },
        { descricao: "Fontes de receita", correta: true },
      ],
    },
  ]

  function criarProva(perguntas, token = c.adminA.token) {
    return req(api.url, "/questionarios", {
      metodo: "POST",
      token,
      corpo: { id_tenant: T(), titulo: "Prova de validacao", descricao: "Assinale", prova: true, perguntas },
    })
  }

  before(async () => {
    const banco = require("../apoio-teste/banco")
    encerrar = banco.encerrar
    await banco.prepararBanco()
    c = await require("../apoio-teste/cenario").montarCenario()
    const http = require("../apoio-teste/api")
    req = http.req
    api = await http.subirApi()
  })

  after(async () => {
    await api.fechar()
    await encerrar()
  })

  describe("2 · a prova nasce com gabarito coerente", () => {
    test("o admin cria a prova", async () => {
      const r = await criarProva(PERGUNTAS)
      assert.equal(r.status, 201, JSON.stringify(r.corpo))
      assert.equal(r.corpo.questionario.prova, true)
      idProva = r.corpo.questionario.id_questionario
    })

    test("pergunta de texto livre nao entra em prova", async () => {
      const r = await criarProva([{ pergunta: "Comente", tipo: "PARAGRAFO" }])
      assert.equal(r.status, 400)
      assert.match(r.corpo.erro, /escolha unica ou caixas de selecao/)
    })

    test("escolha unica com duas corretas e recusada", async () => {
      const r = await criarProva([
        {
          pergunta: "Ambigua",
          tipo: "ESCOLHA_UNICA",
          alternativas: [
            { descricao: "A", correta: true },
            { descricao: "B", correta: true },
          ],
        },
      ])
      assert.equal(r.status, 400)
      assert.match(r.corpo.erro, /uma unica alternativa correta/)
    })

    test("caixas de selecao sem nenhuma correta sao recusadas", async () => {
      const r = await criarProva([
        { pergunta: "Sem gabarito", tipo: "CAIXAS_SELECAO", alternativas: [{ descricao: "A" }, { descricao: "B" }] },
      ])
      assert.equal(r.status, 400)
      assert.match(r.corpo.erro, /ao menos uma alternativa correta/)
    })

    test("fora de prova, marcar correta nao grava gabarito", async () => {
      const r = await req(api.url, "/questionarios", {
        metodo: "POST",
        token: c.adminA.token,
        corpo: { id_tenant: T(), titulo: "Formulario", descricao: "Pesquisa", perguntas: PERGUNTAS },
      })
      assert.equal(r.status, 201, JSON.stringify(r.corpo))
      const lido = await req(api.url, `/questionarios/${r.corpo.questionario.id_questionario}`, {
        token: c.adminA.token,
      })
      const corretas = lido.corpo.questionario.perguntas.flatMap((p) => p.alternativas).filter((a) => a.correta)
      assert.equal(corretas.length, 0)
    })
  })

  describe("edicao antes de alguem responder", () => {
    let idEditavel

    before(async () => {
      const r = await criarProva(PERGUNTAS)
      idEditavel = r.corpo.questionario.id_questionario
    })

    test("o admin troca perguntas, modo e titulo", async () => {
      const r = await req(api.url, `/questionarios/${idEditavel}`, {
        metodo: "PUT",
        token: c.adminA.token,
        corpo: {
          titulo: "Pesquisa revista",
          descricao: "Agora e formulario",
          prova: false,
          perguntas: [{ pergunta: "Comente a etapa", tipo: "PARAGRAFO" }],
        },
      })
      assert.equal(r.status, 200, JSON.stringify(r.corpo))
      const lido = await req(api.url, `/questionarios/${idEditavel}`, { token: c.adminA.token })
      assert.equal(lido.corpo.questionario.titulo, "Pesquisa revista")
      assert.equal(lido.corpo.questionario.prova, false)
      assert.equal(lido.corpo.questionario.respondido, false)
      assert.deepEqual(
        lido.corpo.questionario.perguntas.map((p) => [p.pergunta, p.tipo]),
        [["Comente a etapa", "PARAGRAFO"]]
      )
    })

    test("a edicao valida como a criacao", async () => {
      const r = await req(api.url, `/questionarios/${idEditavel}`, {
        metodo: "PUT",
        token: c.adminA.token,
        corpo: { titulo: "X", descricao: "Y", prova: true, perguntas: [{ pergunta: "Livre", tipo: "PARAGRAFO" }] },
      })
      assert.equal(r.status, 400)
    })

    test("o incubado nao edita", async () => {
      const r = await req(api.url, `/questionarios/${idEditavel}`, {
        metodo: "PUT",
        token: c.colaboradorA.token,
        corpo: { titulo: "Invadido", descricao: "Y" },
      })
      assert.equal(r.status, 403)
    })
  })

  describe("3 · o gabarito fica com quem avalia", () => {
    before(async () => {
      const trilhaRepository = require("../src/repositories/trilhaRepository")
      passoProva = await trilhaRepository.criar({
        idTenant: T(),
        idPai: c.passo.id_pai,
        tipo: "PASSO",
        nome: "Passo com prova",
        tipoPasso: "QUESTIONARIO",
        permiteEntrega: true,
        idQuestionario: idProva,
      })
    })

    test("quem cria ve o gabarito", async () => {
      const r = await req(api.url, `/questionarios/${idProva}`, { token: c.adminA.token })
      assert.equal(r.status, 200)
      const corretas = r.corpo.questionario.perguntas.flatMap((p) => p.alternativas).filter((a) => a.correta)
      assert.equal(corretas.length, 3)
    })

    test("o incubado abre a prova sem o gabarito", async () => {
      const r = await req(api.url, `/questionarios/${idProva}`, { token: c.colaboradorA.token })
      assert.equal(r.status, 200, JSON.stringify(r.corpo))
      assert.equal(r.corpo.questionario.prova, true)
      for (const alt of r.corpo.questionario.perguntas.flatMap((p) => p.alternativas)) {
        assert.equal("correta" in alt, false, `vazou o gabarito: ${JSON.stringify(alt)}`)
      }
    })

    test("a entrega devolve a nota, sem dizer qual era a certa", async () => {
      const aberta = await req(api.url, `/questionarios/${idProva}`, { token: c.colaboradorA.token })
      const [unica, caixas] = aberta.corpo.questionario.perguntas
      const certa = unica.alternativas.find((a) => a.descricao.startsWith("Testar"))
      const errada = caixas.alternativas.find((a) => a.descricao === "Organograma")

      const r = await req(api.url, "/entregas/questionario", {
        metodo: "POST",
        token: c.colaboradorA.token,
        corpo: {
          id_no: passoProva.id_no,
          id_startup: c.startupUm.id_startup,
          respostas: [
            { idPergunta: unica.id_pergunta, alternativas: [certa.id_alternativa] },
            { idPergunta: caixas.id_pergunta, alternativas: [errada.id_alternativa] },
          ],
        },
      })
      assert.equal(r.status, 201, JSON.stringify(r.corpo))
      assert.deepEqual(r.corpo.resultado, {
        acertos: 1,
        total: 2,
        perguntas: [
          { id_pergunta: unica.id_pergunta, acertou: true },
          { id_pergunta: caixas.id_pergunta, acertou: false },
        ],
      })

      // O admin avalia: o detalhe traz a correcao com o gabarito.
      const d = await req(api.url, `/entregas/${r.corpo.entrega.id_entrega}/detalhe`, { token: c.adminA.token })
      assert.equal(d.status, 200, JSON.stringify(d.corpo))
      assert.equal(d.corpo.entrega.resultado.acertos, 1)
      assert.deepEqual(d.corpo.entrega.resultado.perguntas[1].gabarito, ["Proposta de valor", "Fontes de receita"])
    })

    test("depois de respondida, a prova so muda titulo e descricao", async () => {
      const trocar = await req(api.url, `/questionarios/${idProva}`, {
        metodo: "PUT",
        token: c.adminA.token,
        corpo: { titulo: "Outra", descricao: "Outra", prova: true, perguntas: PERGUNTAS },
      })
      assert.equal(trocar.status, 409, JSON.stringify(trocar.corpo))

      const cabecalho = await req(api.url, `/questionarios/${idProva}`, {
        metodo: "PUT",
        token: c.adminA.token,
        corpo: { titulo: "Prova de validacao (v1)", descricao: "Assinale com calma" },
      })
      assert.equal(cabecalho.status, 200, JSON.stringify(cabecalho.corpo))

      const lido = await req(api.url, `/questionarios/${idProva}`, { token: c.adminA.token })
      assert.equal(lido.corpo.questionario.titulo, "Prova de validacao (v1)")
      assert.equal(lido.corpo.questionario.prova, true)
      assert.equal(lido.corpo.questionario.respondido, true)
      assert.equal(lido.corpo.questionario.perguntas.length, 2, "as perguntas respondidas ficam")
    })
  })
})
