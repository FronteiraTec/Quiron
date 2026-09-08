/**
 * O cenario compartilhado pelos testes de autorizacao.
 *
 * Monta DUAS incubadoras e uma pessoa de fora, porque e assim que os furos de
 * autorizacao aparecem: quase todo endpoint erra na direcao de "confiar no
 * id_tenant que veio no pedido", e so um segundo tenant prova que a checagem
 * olha o recurso e nao o parametro.
 *
 * Construido pelos SERVICES, nao por INSERT cru. Um fixture montado em SQL
 * testa o banco; montado pelos services, ele passa pelos mesmos caminhos que a
 * aplicacao usa — inclusive a semeadura de roles padrao e do vocabulario de
 * cadastro, que uma startup precisa ter para existir.
 *
 * ELENCO
 *   adminA        admin da Incubadora A
 *   colaboradorA  incubado da A, MEMBRO da startupUm
 *   mentorA       mentor da A, sem vinculo com startup nenhuma
 *   adminB        admin da Incubadora B — existe so para provar o isolamento
 *   forasteiro    conta criada pelo /auth/register, sem tenant nenhum
 */
const tenantService = require("../src/services/tenantService")
const authService = require("../src/services/authService")
const startupService = require("../src/services/startupService")
const trilhaRepository = require("../src/repositories/trilhaRepository")
const entregaRepository = require("../src/repositories/entregaRepository")

// Quem monta o cenario age como root: e o unico que cria tenant.
const ROOT = { id: null, root: true }

const SENHA = "SenhaDeTeste#2026"

/** Cria a pessoa no tenant e ja devolve o token dela. */
async function pessoa(idTenant, { nome, email, papel }) {
  const usuario = await tenantService.criarUsuario(
    idTenant,
    { nome, email, celular: "11900000000", senha: SENHA, papel },
    ROOT
  )
  const { token } = await authService.login({ email, senha: SENHA })
  return { ...usuario, id: usuario.id_usuario, token, email, senha: SENHA }
}

async function montarCenario() {
  const endereco = {
    celular: "11999999999",
    pais: "Brasil",
    estado: "Sao Paulo",
    cidade: "Sao Paulo",
    rua: "Rua de Teste, 1",
  }

  const tenantA = await tenantService.criar({
    nome: "Incubadora A",
    email: "contato@incubadora-a.test",
    ...endereco,
  })
  const tenantB = await tenantService.criar({
    nome: "Incubadora B",
    email: "contato@incubadora-b.test",
    ...endereco,
  })

  const adminA = await pessoa(tenantA.id_tenant, {
    nome: "Admin A",
    email: "admin.a@teste.invalid",
    papel: "admin",
  })
  const colaboradorA = await pessoa(tenantA.id_tenant, {
    nome: "Colaborador A",
    email: "colab.a@teste.invalid",
    papel: "usuario",
  })
  const mentorA = await pessoa(tenantA.id_tenant, {
    nome: "Mentor A",
    email: "mentor.a@teste.invalid",
    papel: "mentor",
  })
  const adminB = await pessoa(tenantB.id_tenant, {
    nome: "Admin B",
    email: "admin.b@teste.invalid",
    papel: "admin",
  })

  // A pessoa de fora: entra pela porta publica e nao pertence a lugar nenhum.
  await authService.registrar({
    nome: "Forasteiro",
    email: "forasteiro@teste.invalid",
    celular: "11900000000",
    senha: SENHA,
  })
  const login = await authService.login({
    email: "forasteiro@teste.invalid",
    senha: SENHA,
  })
  const forasteiro = { ...login.usuario, token: login.token }

  // Duas startups na MESMA incubadora: e o par que revela se o recorte por
  // vinculo existe ou se basta ter a chave no tenant.
  const startupUm = await startupService.criar(
    { idTenant: tenantA.id_tenant, nome: "Startup Um", tipo: "INCUBADA", situacao: "ATIVA" },
    adminA
  )
  const startupDois = await startupService.criar(
    { idTenant: tenantA.id_tenant, nome: "Startup Dois", tipo: "INCUBADA", situacao: "ATIVA" },
    adminA
  )

  await startupService.adicionarMembro(
    startupUm.id_startup,
    colaboradorA.id,
    true,
    adminA
  )

  // Trilha minima: PROGRAMA > FASE > MODULO > PASSO que aceita entrega.
  const programa = await trilhaRepository.criar({
    idTenant: tenantA.id_tenant,
    idPai: null,
    tipo: "PROGRAMA",
    nome: "Programa de Teste",
  })
  const fase = await trilhaRepository.criar({
    idTenant: tenantA.id_tenant,
    idPai: programa.id_no,
    tipo: "FASE",
    nome: "Fase de Teste",
  })
  const modulo = await trilhaRepository.criar({
    idTenant: tenantA.id_tenant,
    idPai: fase.id_no,
    tipo: "MODULO",
    nome: "Modulo de Teste",
  })
  const passo = await trilhaRepository.criar({
    idTenant: tenantA.id_tenant,
    idPai: modulo.id_no,
    tipo: "PASSO",
    nome: "Passo de Teste",
    tipoPasso: "TEXTO",
    permiteEntrega: true,
  })

  await trilhaRepository.matricular(programa.id_no, startupUm.id_startup)

  // Uma entrega da startupUm, com conteudo reconhecivel: se este texto sair
  // numa resposta para quem nao devia, o teste tem como apontar o dedo.
  const entrega = await entregaRepository.criar({
    idNo: passo.id_no,
    idStartup: startupUm.id_startup,
    idUsuario: colaboradorA.id,
    textoResposta: "SEGREDO-DA-STARTUP-UM",
    arquivoUrl: null,
  })

  return {
    tenantA,
    tenantB,
    adminA,
    colaboradorA,
    mentorA,
    adminB,
    forasteiro,
    startupUm,
    startupDois,
    programa,
    passo,
    entrega,
    SENHA,
  }
}

module.exports = { montarCenario, SENHA }
