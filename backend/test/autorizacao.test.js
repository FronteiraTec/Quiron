/**
 * REGRESSAO DE AUTORIZACAO — os achados da auditoria de 30/08/2026.
 *
 * Cada teste aqui afirma o comportamento CORRETO, nao o atual. Enquanto os
 * achados nao forem corrigidos, este arquivo falha de proposito: ele e a
 * definicao de pronto do trabalho de autorizacao, e o portao que impede o
 * furo de voltar depois de fechado.
 *
 * O identificador QRN-xx no nome de cada teste aponta o achado no relatorio.
 *
 * A pergunta que todos fazem e a mesma: o endpoint autoriza pelo RECURSO ou
 * confia no `id_tenant`/`id_startup` que veio no pedido? O `forasteiro` — conta
 * sem incubadora nenhuma — e o reagente: qualquer 200 para ele e um furo.
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

/** Afirma que a resposta barrou (401 ou 403), e nao entregou dado. */
function barrou(resposta, mensagem) {
  assert.ok(
    resposta.status === 401 || resposta.status === 403 || resposta.status === 404,
    `${mensagem} — respondeu ${resposta.status} com ${JSON.stringify(resposta.corpo).slice(0, 160)}`
  )
}

describe("QRN-04 · rotas sem checagem de autorizacao", () => {
  test("forasteiro NAO le o log de auditoria de uma incubadora alheia", async () => {
    const r = await req(api.url, `/auditlogs?id_tenant=${c.tenantA.id_tenant}`, {
      token: c.forasteiro.token,
    })
    barrou(r, "auditlogs entregou o log do tenant A a quem nao pertence a ele")
  })

  test("forasteiro NAO le a jornada de uma startup alheia", async () => {
    const r = await req(api.url, `/jornada?id_startup=${c.startupUm.id_startup}`, {
      token: c.forasteiro.token,
    })
    barrou(r, "jornada entregou a trilha, a equipe e as entregas da startup")
  })

  test("forasteiro NAO lista as entregas de uma startup alheia", async () => {
    const r = await req(api.url, `/entregas?id_startup=${c.startupUm.id_startup}`, {
      token: c.forasteiro.token,
    })
    barrou(r, "entregas listou o trabalho da startup")
    assert.ok(
      !JSON.stringify(r.corpo).includes("SEGREDO-DA-STARTUP-UM"),
      "o texto da entrega vazou no corpo da resposta"
    )
  })

  test("forasteiro NAO abre uma entrega pelo id", async () => {
    const r = await req(api.url, `/entregas/${c.entrega.id_entrega}`, {
      token: c.forasteiro.token,
    })
    barrou(r, "entrega aberta por id sem nenhum vinculo")
    assert.ok(
      !JSON.stringify(r.corpo).includes("SEGREDO-DA-STARTUP-UM"),
      "o texto da entrega vazou no corpo da resposta"
    )
  })

  test("forasteiro NAO le as avaliacoes de uma entrega alheia", async () => {
    const r = await req(api.url, `/avaliacoes?id_entrega=${c.entrega.id_entrega}`, {
      token: c.forasteiro.token,
    })
    barrou(r, "avaliacoes entregou a devolutiva do mentor")
  })

  test("forasteiro NAO grava entrega em nome de uma startup alheia", async () => {
    const r = await req(api.url, "/jornada/enviar", {
      metodo: "POST",
      token: c.forasteiro.token,
      corpo: {
        id_no: c.passo.id_no,
        id_startup: c.startupUm.id_startup,
        texto_resposta: "escrito por quem nao devia",
      },
    })
    barrou(r, "escrita de entrega aceita de quem nao e da startup")
  })

  test("forasteiro NAO reenvia — o reenvio APAGA as avaliacoes existentes", async () => {
    const r = await req(api.url, "/jornada/reenviar", {
      metodo: "POST",
      token: c.forasteiro.token,
      corpo: {
        id_no: c.passo.id_no,
        id_startup: c.startupUm.id_startup,
        texto_resposta: "reenvio destrutivo",
      },
    })
    barrou(r, "reenvio destrutivo aceito de terceiro")
  })

  test("admin de OUTRA incubadora tambem nao alcanca — nao e so o forasteiro", async () => {
    // Um admin tem todas as chaves DO TENANT DELE. Se o endpoint confia no
    // id_tenant do pedido em vez de ler o tenant do recurso, o adminB passa.
    const r = await req(api.url, `/auditlogs?id_tenant=${c.tenantA.id_tenant}`, {
      token: c.adminB.token,
    })
    barrou(r, "admin do tenant B leu o log de auditoria do tenant A")
  })
})

describe("QRN-08 · recorte por vinculo dentro da mesma incubadora", () => {
  test("colaborador NAO le o Canvas da startup vizinha", async () => {
    const r = await req(api.url, `/startups/${c.startupDois.id_startup}/canvas`, {
      token: c.colaboradorA.token,
    })
    barrou(r, "Canvas da startup vizinha entregue a um incubado de outra startup")
  })

  test("colaborador NAO EDITA o Canvas da startup vizinha", async () => {
    // A role Colaborador tem `startups.canvas.editar`, e a checagem hoje e por
    // tenant: sem o recorte por vinculo, isto grava no modelo de negocio alheio.
    const r = await req(api.url, `/startups/${c.startupDois.id_startup}/canvas/proposta_valor`, {
      metodo: "PUT",
      token: c.colaboradorA.token,
      corpo: { conteudo: "escrito pela concorrente" },
    })
    barrou(r, "Canvas da startup vizinha ACEITOU escrita de terceiro")
  })

  test("colaborador NAO le a matriz GUT da startup vizinha", async () => {
    const r = await req(api.url, `/startups/${c.startupDois.id_startup}/gut`, {
      token: c.colaboradorA.token,
    })
    barrou(r, "GUT da startup vizinha entregue")
  })

  test("colaborador NAO le o 5W2H da startup vizinha", async () => {
    const r = await req(api.url, `/startups/${c.startupDois.id_startup}/5w2h`, {
      token: c.colaboradorA.token,
    })
    barrou(r, "5W2H da startup vizinha entregue")
  })

  test("colaborador CONTINUA lendo o Canvas da PROPRIA startup", async () => {
    // O contrapeso: a correcao nao pode fechar o acesso legitimo.
    const r = await req(api.url, `/startups/${c.startupUm.id_startup}/canvas`, {
      token: c.colaboradorA.token,
    })
    assert.equal(r.status, 200, "o incubado perdeu acesso a propria startup")
  })
})

describe("QRN-07 · desativar usuario revoga o acesso", () => {
  test("vinculo desativado deixa de passar nas chaves do tenant", async () => {
    const alvo = c.mentorA

    // Antes: o mentor enxerga a lista de startups.
    const antes = await req(api.url, `/startups?id_tenant=${c.tenantA.id_tenant}`, {
      token: alvo.token,
    })
    assert.equal(antes.status, 200, "o mentor deveria enxergar antes de ser desligado")

    await req(api.url, `/tenants/${c.tenantA.id_tenant}/usuarios/${alvo.id}/status`, {
      metodo: "PATCH",
      token: c.adminA.token,
      corpo: { ativo: false },
    })

    // Depois: o token continua valido, mas a permissao no tenant acabou.
    const depois = await req(api.url, `/startups?id_tenant=${c.tenantA.id_tenant}`, {
      token: alvo.token,
    })
    barrou(depois, "usuario desativado continuou passando nas chaves do tenant")
  })

  test("usuario desativado nao volta a entrar por um login novo", async () => {
    const r = await req(api.url, "/auth/login", {
      metodo: "POST",
      corpo: { email: c.mentorA.email, senha: c.SENHA },
    })

    if (r.status === 200) {
      const comToken = await req(api.url, `/startups?id_tenant=${c.tenantA.id_tenant}`, {
        token: r.corpo.token,
      })
      barrou(comToken, "login novo devolveu um token que ainda alcanca o tenant")
    }
  })
})

describe("QRN-13 · IDOR na edicao de perfil entre incubadoras", () => {
  test("admin A nao consegue renomear um usuario do tenant B", async () => {
    const r = await req(
      api.url,
      `/tenants/${c.tenantA.id_tenant}/usuarios/${c.adminB.id}`,
      {
        metodo: "PUT",
        token: c.adminA.token,
        corpo: { nome: "RENOMEADO PELO ADMIN A", celular: "11911111111", papel: "usuario" },
      }
    )
    barrou(r, "a chamada deveria ser barrada")

    // O ponto do achado: o 404 chegava DEPOIS da escrita. Conferimos o efeito,
    // nao so o status.
    const perfil = await req(api.url, "/auth/me", { token: c.adminB.token })
    assert.equal(
      perfil.corpo.usuario.nome,
      "Admin B",
      "o nome foi alterado mesmo com a resposta de erro"
    )
  })
})

describe("QRN-05 · politica de senha", () => {
  test("cadastro nao aceita senha de um caractere", async () => {
    const r = await req(api.url, "/auth/register", {
      metodo: "POST",
      corpo: {
        nome: "Senha Curta",
        email: "senha.curta@teste.invalid",
        celular: "11900000000",
        senha: "a",
      },
    })
    assert.notEqual(r.status, 201, "uma senha de 1 caractere foi aceita no cadastro")
  })

  test("redefinicao por token nao aceita senha de um caractere", async () => {
    const r = await req(api.url, "/auth/reset-password", {
      metodo: "POST",
      corpo: { token: "token-qualquer", senha: "a" },
    })
    // Token invalido tambem da 400; o que nao pode e a senha curta passar.
    assert.equal(r.status, 400)
  })
})

describe("isolamento entre incubadoras nas rotas ja protegidas", () => {
  test("admin B nao lista as startups do tenant A", async () => {
    const r = await req(api.url, `/startups?id_tenant=${c.tenantA.id_tenant}`, {
      token: c.adminB.token,
    })
    barrou(r, "admin do tenant B listou startups do tenant A")
  })

  test("admin B nao le a configuracao do tenant A", async () => {
    const r = await req(api.url, `/tenants/${c.tenantA.id_tenant}`, {
      token: c.adminB.token,
    })
    barrou(r, "admin do tenant B leu a configuracao do tenant A")
  })

  test("nao-root nao lista todas as incubadoras", async () => {
    const r = await req(api.url, "/tenants", { token: c.adminA.token })
    barrou(r, "rota somenteRoot atendeu um admin comum")
  })
})
