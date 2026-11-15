/**
 * As frases e as comparacoes do historico do CRM (crm/historico.js) e a
 * validacao de documento — sem banco.
 *
 * O que se prende aqui: alteracao que ninguem fez nao vira evento ("" e null,
 * "2000" e 2000), e a frase diz o antes e o depois no formato que a pessoa le.
 */
const { test, describe } = require("node:test")
const assert = require("node:assert/strict")

const h = require("../src/crm/historico")
const v = require("../src/crm/validacao")
const { transicao } = require("../src/services/crmTarefaService")

describe("formatos", () => {
  test("moeda em reais, com milhar e centavos", () => {
    assert.equal(h.formatarMoeda(2000), "R$ 2.000,00")
    assert.equal(h.formatarMoeda(3500.5), "R$ 3.500,50")
    assert.equal(h.formatarMoeda(1234567.891), "R$ 1.234.567,89")
    assert.equal(h.formatarMoeda(0), "R$ 0,00")
    assert.equal(h.formatarMoeda(null), "—")
  })

  test("data pelo texto, sem passar por fuso", () => {
    assert.equal(h.formatarData("2026-11-05"), "05/11/2026")
    assert.equal(h.formatarData("2026-11-05T00:00:00.000Z"), "05/11/2026")
  })

  test("citacao corta texto longo e junta linhas", () => {
    assert.equal(h.citar("Cliente\n  gostou"), '"Cliente gostou"')
    assert.equal(h.citar("x".repeat(200), 10), `"${"x".repeat(9)}…"`)
  })
})

describe("diferencas", () => {
  test("vazio, null e espaco nao sao alteracao", () => {
    const antes = { titulo: "Site", descricao: null, valor_estimado: 2000 }
    const depois = { titulo: " Site ", descricao: "", valor_estimado: "2000.00" }
    assert.deepEqual(h.diferencas(antes, depois, h.CAMPOS_OPORTUNIDADE), [])
  })

  test("campo ausente no pedido e 'nao mexi', nao 'apagou'", () => {
    const antes = { titulo: "Site", origem: "Indicação" }
    assert.deepEqual(h.diferencas(antes, { titulo: "Site" }, h.CAMPOS_OPORTUNIDADE), [])
  })

  test("cada campo alterado sai com o antes e o depois normalizados", () => {
    const antes = { valor_estimado: 2000, previsao_fechamento: "2026-12-01", origem: null }
    const depois = { valor_estimado: "3500", previsao_fechamento: "2026-12-15", origem: "Site" }
    assert.deepEqual(h.diferencas(antes, depois, h.CAMPOS_OPORTUNIDADE), [
      { campo: "valor_estimado", antes: 2000, depois: 3500 },
      { campo: "previsao_fechamento", antes: "2026-12-01", depois: "2026-12-15" },
      { campo: "origem", antes: null, depois: "Site" },
    ])
  })

  test("instante compara o momento, nao o texto", () => {
    const antes = { vencimento_ts: "2026-11-05T17:00:00.000Z" }
    const igual = { vencimento_ts: "2026-11-05T14:00:00-03:00" }
    assert.deepEqual(h.diferencas(antes, igual, h.CAMPOS_TAREFA), [])
  })
})

describe("frases", () => {
  test("valor estimado alterado diz de quanto para quanto", () => {
    assert.equal(
      h.descreverCampoOportunidade({ campo: "valor_estimado", antes: 2000, depois: 3500 }),
      "alterou o valor estimado de R$ 2.000,00 para R$ 3.500,00"
    )
  })

  test("campo que nao existia, e campo removido", () => {
    assert.equal(
      h.descreverCampoOportunidade({ campo: "previsao_fechamento", antes: null, depois: "2026-12-15" }),
      "definiu a previsão de fechamento: 15/12/2026"
    )
    assert.equal(
      h.descreverCampoOportunidade({ campo: "probabilidade", antes: 40, depois: null }),
      "removeu a probabilidade de conversão (era 40%)"
    )
  })

  test("texto longo nao vai inteiro para a frase", () => {
    assert.equal(h.descreverCampoOportunidade({ campo: "descricao", antes: "a", depois: "b" }), "alterou a descrição")
  })

  test("responsavel com e sem nome de antes", () => {
    assert.equal(h.descreverResponsavel("Ana", "Bruno"), "alterou o responsável de Ana para Bruno")
    assert.equal(h.descreverResponsavel(null, "Bruno"), "definiu Bruno como responsável")
    assert.equal(h.descreverResponsavel("Ana", null), "removeu o responsável (era Ana)")
  })

  test("cadastro do cliente lista os campos e o status sai por extenso", () => {
    const difs = [
      { campo: "email", antes: null, depois: "a@b.com" },
      { campo: "telefone", antes: null, depois: "11999990000" },
      { campo: "status", antes: "LEAD", depois: "ATIVO" },
    ]
    assert.equal(
      h.descreverCliente(difs),
      "atualizou o cadastro (e-mail e telefone) e alterou o status de Lead para Cliente ativo"
    )
  })

  test("cada troca de status da tarefa tem o seu evento", () => {
    assert.equal(transicao("PENDENTE", "EM_ANDAMENTO", "X").tipo, "TAREFA_INICIADA")
    assert.equal(transicao("EM_ANDAMENTO", "CONCLUIDA", "X").tipo, "TAREFA_CONCLUIDA")
    assert.equal(transicao("CONCLUIDA", "PENDENTE", "X").tipo, "TAREFA_REABERTA")
    assert.equal(transicao("CANCELADA", "EM_ANDAMENTO", "X").tipo, "TAREFA_REABERTA")
    assert.equal(transicao("PENDENTE", "CANCELADA", "X").tipo, "TAREFA_CANCELADA")
    assert.equal(transicao("CONCLUIDA", "PENDENTE", "Enviar").descricao, 'reabriu a tarefa "Enviar"')
  })
})

describe("documento", () => {
  test("CPF e CNPJ conferem os digitos verificadores", () => {
    assert.equal(v.cpfValido("52998224725"), true)
    assert.equal(v.cpfValido("52998224724"), false)
    assert.equal(v.cpfValido("11111111111"), false)
    assert.equal(v.cnpjValido("11222333000181"), true)
    assert.equal(v.cnpjValido("11222333000180"), false)
  })

  test("a mascara sai, o tipo de pessoa decide qual documento", () => {
    assert.equal(v.documento("529.982.247-25", "PF"), "52998224725")
    assert.equal(v.documento("11.222.333/0001-81", "PJ"), "11222333000181")
    assert.throws(() => v.documento("529.982.247-25", "PJ"), /CNPJ inválido/)
  })
})
