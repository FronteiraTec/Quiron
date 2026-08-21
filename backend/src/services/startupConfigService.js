/**
 * Service da configuracao do cadastro de startup: TIPOS, SITUACOES e CAMPOS
 * PERSONALIZAVEIS de cada incubadora.
 *
 * DUAS AUTORIZACOES DIFERENTES, como em agendaConfigService e pelo mesmo
 * motivo:
 *
 *   LER   exige `startups.startups.visualizar` — tipo, situacao e a definicao
 *         dos campos sao o rotulo, a cor e a estrutura do que a tela de
 *         startups mostra. Quem enxerga a lista precisa disto, senao a coluna
 *         de status renderiza a chave crua e os campos extras somem.
 *   ESCREVER exige `configuracoes.startups.gerenciar` — decidir quais campos
 *         existem no cadastro e ato de administracao.
 *
 * Sem essa separacao seria preciso escolher entre dar poder de configuracao a
 * todo mundo ou deixar o mentor sem entender a propria lista de startups.
 */
const startupConfigRepository = require("../repositories/startupConfigRepository")
const rbacService = require("./rbacService")
const auditLogService = require("./auditLogService")
const { CICLOS_VALIDOS } = require("../startups/padroes")
// A derivacao da chave, a validacao do rotulo/cor e a normalizacao da `config`
// de cada tipo moram em campos/tipos: sao as mesmas regras da definicao de
// campo da gestao de tarefas, e duas copias divergiriam na primeira correcao.
const {
  chaveDisponivel,
  chaveDoRotulo,
  normalizarConfig,
  validarCor,
  validarRotulo,
  validarTipoCampo,
} = require("../campos/tipos")
const { erroNegocio } = require("../utils/erros")

const LER = "startups.startups.visualizar"
const GERENCIAR = "configuracoes.startups.gerenciar"

// ---------------------------------------------------------------------------
// TIPOS
// ---------------------------------------------------------------------------

async function listarTipos(idTenant, usuario, incluirInativos = false) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, LER)
  if (incluirInativos) await rbacService.garantirPermissao(idTenant, usuario, GERENCIAR)
  return startupConfigRepository.listarTipos(idTenant, incluirInativos)
}

async function criarTipo(idTenant, dados, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, GERENCIAR)
  validarRotulo(dados.rotulo, 60, "do tipo")
  validarCor(dados.cor)

  const rotulo = dados.rotulo.trim()
  const chave = await chaveDisponivel(
    idTenant,
    chaveDoRotulo(rotulo, "do tipo"),
    startupConfigRepository.buscarTipo
  )

  let tipo
  try {
    tipo = await startupConfigRepository.criarTipo(idTenant, {
      chave,
      rotulo,
      cor: dados.cor || "#6366f1",
      ordem: dados.ordem,
    })
  } catch (err) {
    if (err.code === "23505") throw erroNegocio(409, "Ja existe um tipo com esse nome.")
    throw err
  }

  await auditLogService.registrar({
    idTenant,
    idUsuario: usuario?.id,
    acao: "CRIAR",
    entidade: "startup_tipo",
    entidadeId: chave,
    descricao: `Criou o tipo de startup "${rotulo}".`,
    dadosDepois: tipo,
  })

  return tipo
}

async function atualizarTipo(idTenant, chave, dados, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, GERENCIAR)
  validarRotulo(dados.rotulo, 60, "do tipo")
  validarCor(dados.cor)

  const antes = await startupConfigRepository.buscarTipo(idTenant, chave)
  if (!antes) throw erroNegocio(404, "Tipo nao encontrado.")

  let tipo
  try {
    tipo = await startupConfigRepository.atualizarTipo(idTenant, chave, {
      rotulo: dados.rotulo.trim(),
      cor: dados.cor || antes.cor,
      ordem: dados.ordem,
    })
  } catch (err) {
    if (err.code === "23505") throw erroNegocio(409, "Ja existe um tipo com esse nome.")
    throw err
  }

  await auditLogService.registrar({
    idTenant,
    idUsuario: usuario?.id,
    acao: "EDITAR",
    entidade: "startup_tipo",
    entidadeId: chave,
    descricao: `Editou o tipo de startup "${tipo.rotulo}".`,
    dadosAntes: antes,
    dadosDepois: tipo,
  })

  return tipo
}

/**
 * Ativa/desativa um tipo. Desativar e o "excluir" da tela: as startups que o
 * usam continuam exibindo o rotulo (a FK exige que ele continue existindo); ele
 * so some do seletor do cadastro.
 */
async function alterarStatusTipo(idTenant, chave, ativo, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, GERENCIAR)
  if (typeof ativo !== "boolean") throw erroNegocio(400, "Informe 'ativo' como true ou false.")

  const antes = await startupConfigRepository.buscarTipo(idTenant, chave)
  if (!antes) throw erroNegocio(404, "Tipo nao encontrado.")

  // Ao contrario da situacao, o tipo pode ficar sem nenhum ativo: ele e
  // opcional no cadastro. O que nao pode e a incubadora perder a lista inteira
  // sem perceber, entao o aviso de uso na tela cuida disso.
  const tipo = await startupConfigRepository.alterarStatusTipo(idTenant, chave, ativo)

  await auditLogService.registrar({
    idTenant,
    idUsuario: usuario?.id,
    acao: ativo ? "REATIVAR" : "DESATIVAR",
    entidade: "startup_tipo",
    entidadeId: chave,
    descricao: `${ativo ? "Reativou" : "Desativou"} o tipo de startup "${tipo.rotulo}".`,
    dadosAntes: antes,
    dadosDepois: tipo,
  })

  return tipo
}

async function usoDoTipo(idTenant, chave, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, GERENCIAR)
  return { startups: await startupConfigRepository.contarStartupsDoTipo(idTenant, chave) }
}

// ---------------------------------------------------------------------------
// SITUACOES
// ---------------------------------------------------------------------------

function validarCiclo(ciclo) {
  if (!CICLOS_VALIDOS.includes(ciclo)) {
    throw erroNegocio(
      400,
      `Ciclo invalido. Use ${CICLOS_VALIDOS.join(", ")} — e o que diz se a startup ainda esta no programa.`
    )
  }
}

async function listarSituacoes(idTenant, usuario, incluirInativas = false) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, LER)
  if (incluirInativas) await rbacService.garantirPermissao(idTenant, usuario, GERENCIAR)
  return startupConfigRepository.listarSituacoes(idTenant, incluirInativas)
}

async function criarSituacao(idTenant, dados, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, GERENCIAR)
  validarRotulo(dados.rotulo, 60, "da situacao")
  validarCor(dados.cor)
  const ciclo = dados.ciclo || "ATIVA"
  validarCiclo(ciclo)

  const rotulo = dados.rotulo.trim()
  const chave = await chaveDisponivel(
    idTenant,
    chaveDoRotulo(rotulo, "da situacao"),
    startupConfigRepository.buscarSituacao
  )

  let situacao
  try {
    situacao = await startupConfigRepository.criarSituacao(idTenant, {
      chave,
      rotulo,
      cor: dados.cor || "#10b981",
      ciclo,
      ordem: dados.ordem,
    })
  } catch (err) {
    if (err.code === "23505") throw erroNegocio(409, "Ja existe uma situacao com esse nome.")
    throw err
  }

  await auditLogService.registrar({
    idTenant,
    idUsuario: usuario?.id,
    acao: "CRIAR",
    entidade: "startup_situacao",
    entidadeId: chave,
    descricao: `Criou a situacao de startup "${rotulo}".`,
    dadosDepois: situacao,
  })

  return situacao
}

/**
 * Atualiza uma situacao. Trocar o CICLO reprocessa o status das startups que
 * ja estao nela — sem isso elas ficariam dentro do programa quando deviam
 * estar fora (ou o contrario) em todos os relatorios.
 */
async function atualizarSituacao(idTenant, chave, dados, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, GERENCIAR)
  validarRotulo(dados.rotulo, 60, "da situacao")
  validarCor(dados.cor)

  const antes = await startupConfigRepository.buscarSituacao(idTenant, chave)
  if (!antes) throw erroNegocio(404, "Situacao nao encontrada.")

  const ciclo = dados.ciclo || antes.ciclo
  validarCiclo(ciclo)

  let situacao
  try {
    situacao = await startupConfigRepository.atualizarSituacao(idTenant, chave, {
      rotulo: dados.rotulo.trim(),
      cor: dados.cor || antes.cor,
      ciclo,
      ordem: dados.ordem,
    })
  } catch (err) {
    if (err.code === "23505") throw erroNegocio(409, "Ja existe uma situacao com esse nome.")
    throw err
  }

  let startupsAfetadas = 0
  if (ciclo !== antes.ciclo) {
    startupsAfetadas = await startupConfigRepository.sincronizarStatusPorSituacao(idTenant, chave)
  }

  await auditLogService.registrar({
    idTenant,
    idUsuario: usuario?.id,
    acao: "EDITAR",
    entidade: "startup_situacao",
    entidadeId: chave,
    descricao:
      `Editou a situacao de startup "${situacao.rotulo}".` +
      (startupsAfetadas ? ` ${startupsAfetadas} startup(s) tiveram o status recalculado.` : ""),
    dadosAntes: antes,
    dadosDepois: situacao,
  })

  return situacao
}

/**
 * Ativa/desativa uma situacao.
 *
 * Nao deixa desativar a ultima ativa: sem nenhuma, o cadastro de startup fica
 * sem status para oferecer e a incubadora trava sem entender por que — mesma
 * guarda das categorias de evento.
 */
async function alterarStatusSituacao(idTenant, chave, ativo, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, GERENCIAR)
  if (typeof ativo !== "boolean") throw erroNegocio(400, "Informe 'ativo' como true ou false.")

  const antes = await startupConfigRepository.buscarSituacao(idTenant, chave)
  if (!antes) throw erroNegocio(404, "Situacao nao encontrada.")

  if (!ativo) {
    const ativas = await startupConfigRepository.listarSituacoes(idTenant)
    if (ativas.length <= 1) {
      throw erroNegocio(
        400,
        "Mantenha ao menos uma situacao ativa — sem nenhuma nao e possivel cadastrar startups."
      )
    }
  }

  const situacao = await startupConfigRepository.alterarStatusSituacao(idTenant, chave, ativo)

  await auditLogService.registrar({
    idTenant,
    idUsuario: usuario?.id,
    acao: ativo ? "REATIVAR" : "DESATIVAR",
    entidade: "startup_situacao",
    entidadeId: chave,
    descricao: `${ativo ? "Reativou" : "Desativou"} a situacao "${situacao.rotulo}".`,
    dadosAntes: antes,
    dadosDepois: situacao,
  })

  return situacao
}

async function usoDaSituacao(idTenant, chave, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, GERENCIAR)
  return { startups: await startupConfigRepository.contarStartupsDaSituacao(idTenant, chave) }
}

// ---------------------------------------------------------------------------
// CAMPOS PERSONALIZAVEIS
// ---------------------------------------------------------------------------

async function listarCampos(idTenant, usuario, incluirInativos = false) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, LER)
  if (incluirInativos) await rbacService.garantirPermissao(idTenant, usuario, GERENCIAR)
  return startupConfigRepository.listarCampos(idTenant, incluirInativos)
}

async function criarCampo(idTenant, dados, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, GERENCIAR)
  validarRotulo(dados.rotulo, 80, "do campo")
  validarTipoCampo(dados.tipo)

  const rotulo = dados.rotulo.trim()
  const chave = await chaveDisponivel(
    idTenant,
    chaveDoRotulo(rotulo, "do campo"),
    startupConfigRepository.buscarCampoPorChave
  )
  const config = normalizarConfig(dados.tipo, dados.config)

  let campo
  try {
    campo = await startupConfigRepository.criarCampo(idTenant, {
      chave,
      rotulo,
      tipo: dados.tipo,
      descricao: dados.descricao?.trim() || null,
      obrigatorio: Boolean(dados.obrigatorio),
      ordem: dados.ordem,
      config: JSON.stringify(config),
    })
  } catch (err) {
    if (err.code === "23505") throw erroNegocio(409, "Ja existe um campo com esse nome.")
    throw err
  }

  await auditLogService.registrar({
    idTenant,
    idUsuario: usuario?.id,
    acao: "CRIAR",
    entidade: "startup_campo",
    entidadeId: String(campo.id_campo),
    descricao: `Criou o campo personalizado "${rotulo}" (${dados.tipo}).`,
    dadosDepois: campo,
  })

  return campo
}

/**
 * Atualiza um campo. A chave e o tipo sao imutaveis (ver o repositorio): mudar
 * o tipo transformaria em lixo os valores ja preenchidos nas startups.
 */
async function atualizarCampo(idTenant, idCampo, dados, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, GERENCIAR)
  validarRotulo(dados.rotulo, 80, "do campo")

  const antes = await startupConfigRepository.buscarCampo(idCampo)
  if (!antes || Number(antes.id_tenant) !== Number(idTenant)) {
    throw erroNegocio(404, "Campo nao encontrado.")
  }

  // A config e validada contra o tipo GRAVADO, nao contra um que venha no
  // corpo: o tipo nao muda, e aceitar um do cliente aqui seria a porta dos
  // fundos para o que atualizarCampo se recusa a fazer pela porta da frente.
  const config = normalizarConfig(antes.tipo, dados.config ?? antes.config)

  let campo
  try {
    campo = await startupConfigRepository.atualizarCampo(idTenant, idCampo, {
      rotulo: dados.rotulo.trim(),
      descricao: dados.descricao?.trim() || null,
      obrigatorio: typeof dados.obrigatorio === "boolean" ? dados.obrigatorio : null,
      ordem: dados.ordem,
      config: JSON.stringify(config),
    })
  } catch (err) {
    if (err.code === "23505") throw erroNegocio(409, "Ja existe um campo com esse nome.")
    throw err
  }

  await auditLogService.registrar({
    idTenant,
    idUsuario: usuario?.id,
    acao: "EDITAR",
    entidade: "startup_campo",
    entidadeId: String(idCampo),
    descricao: `Editou o campo personalizado "${campo.rotulo}".`,
    dadosAntes: antes,
    dadosDepois: campo,
  })

  return campo
}

/**
 * Ativa/desativa um campo.
 *
 * Os valores ja preenchidos CONTINUAM no `campos_extras` de cada startup — o
 * campo so deixa de ser pedido e exibido. E o que torna a operacao reversivel:
 * reativar traz tudo de volta preenchido.
 */
async function alterarStatusCampo(idTenant, idCampo, ativo, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, GERENCIAR)
  if (typeof ativo !== "boolean") throw erroNegocio(400, "Informe 'ativo' como true ou false.")

  const antes = await startupConfigRepository.buscarCampo(idCampo)
  if (!antes || Number(antes.id_tenant) !== Number(idTenant)) {
    throw erroNegocio(404, "Campo nao encontrado.")
  }

  const campo = await startupConfigRepository.alterarStatusCampo(idTenant, idCampo, ativo)

  await auditLogService.registrar({
    idTenant,
    idUsuario: usuario?.id,
    acao: ativo ? "REATIVAR" : "DESATIVAR",
    entidade: "startup_campo",
    entidadeId: String(idCampo),
    descricao: `${ativo ? "Reativou" : "Desativou"} o campo personalizado "${campo.rotulo}".`,
    dadosAntes: antes,
    dadosDepois: campo,
  })

  return campo
}

async function usoDoCampo(idTenant, idCampo, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, GERENCIAR)

  const campo = await startupConfigRepository.buscarCampo(idCampo)
  if (!campo || Number(campo.id_tenant) !== Number(idTenant)) {
    throw erroNegocio(404, "Campo nao encontrado.")
  }
  return { startups: await startupConfigRepository.contarStartupsComCampo(idTenant, campo.chave) }
}

module.exports = {
  listarTipos,
  criarTipo,
  atualizarTipo,
  alterarStatusTipo,
  usoDoTipo,

  listarSituacoes,
  criarSituacao,
  atualizarSituacao,
  alterarStatusSituacao,
  usoDaSituacao,

  listarCampos,
  criarCampo,
  atualizarCampo,
  alterarStatusCampo,
  usoDoCampo,
}
