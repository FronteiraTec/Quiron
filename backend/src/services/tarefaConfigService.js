/**
 * Service da configuracao da GESTAO DE TAREFAS: os STATUS (as colunas do
 * quadro) e os CAMPOS PERSONALIZAVEIS de cada incubadora.
 *
 * DUAS AUTORIZACOES DIFERENTES, como em startupConfigService e pelo mesmo
 * motivo:
 *
 *   LER   exige `tarefas.tarefas.visualizar` — o rotulo, a cor e a categoria de
 *         cada status sao as COLUNAS do quadro, e a definicao dos campos e a
 *         estrutura do formulario. Quem enxerga as tarefas precisa dos dois, ou
 *         o kanban renderiza colunas sem nome e os campos extras somem.
 *   ESCREVER exige `configuracoes.tarefas.gerenciar` — decidir que colunas o
 *         quadro tem e ato de administracao.
 *
 * Sem essa separacao seria preciso escolher entre dar poder de configuracao a
 * todo mundo ou deixar a equipe sem entender o proprio quadro.
 */
const tarefaConfigRepository = require("../repositories/tarefaConfigRepository")
const rbacService = require("./rbacService")
const auditLogService = require("./auditLogService")
const { CATEGORIAS_VALIDAS } = require("../tarefas/padroes")
// As mesmas regras de definicao de campo do cadastro de startup. Ver
// campos/tipos: o modulo nasceu para nao existirem duas copias disto.
const {
  chaveDisponivel,
  chaveDoRotulo,
  normalizarConfig,
  validarCor,
  validarRotulo,
  validarTipoCampo,
} = require("../campos/tipos")
const { erroNegocio } = require("../utils/erros")

const LER = "tarefas.tarefas.visualizar"
const GERENCIAR = "configuracoes.tarefas.gerenciar"

// ---------------------------------------------------------------------------
// STATUS (as colunas do quadro)
// ---------------------------------------------------------------------------

function validarCategoria(categoria) {
  if (!CATEGORIAS_VALIDAS.includes(categoria)) {
    throw erroNegocio(400, `Categoria invalida. Use: ${CATEGORIAS_VALIDAS.join(", ")}.`)
  }
}

async function listarStatus(idTenant, usuario, incluirInativos = false) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, LER)
  if (incluirInativos) await rbacService.garantirPermissao(idTenant, usuario, GERENCIAR)
  return tarefaConfigRepository.listarStatus(idTenant, incluirInativos)
}

async function criarStatus(idTenant, dados, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, GERENCIAR)
  validarRotulo(dados.rotulo, 60, "da coluna")
  validarCor(dados.cor)
  validarCategoria(dados.categoria)

  const rotulo = dados.rotulo.trim()
  const chave = await chaveDisponivel(
    idTenant,
    chaveDoRotulo(rotulo, "da coluna"),
    tarefaConfigRepository.buscarStatus
  )

  let status
  try {
    status = await tarefaConfigRepository.criarStatus(idTenant, {
      chave,
      rotulo,
      cor: dados.cor || "#6366f1",
      categoria: dados.categoria,
      ordem: dados.ordem,
    })
  } catch (err) {
    if (err.code === "23505") throw erroNegocio(409, "Ja existe uma coluna com esse nome.")
    throw err
  }

  await auditLogService.registrar({
    idTenant,
    idUsuario: usuario?.id,
    acao: "CRIAR",
    entidade: "tarefa_status",
    entidadeId: chave,
    descricao: `Criou a coluna de tarefas "${rotulo}".`,
    dadosDepois: status,
  })

  return status
}

/**
 * Atualiza um status.
 *
 * Mudar a CATEGORIA reprocessa as tarefas que ja estao nele: e uma correcao de
 * significado ("na verdade 'Arquivada' e uma tarefa concluida"), e sem o
 * reprocessamento o `concluida_ts` delas ficaria contando ao contrario para
 * sempre. Ver sincronizarConclusaoPorStatus.
 */
async function atualizarStatus(idTenant, chave, dados, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, GERENCIAR)
  validarRotulo(dados.rotulo, 60, "da coluna")
  validarCor(dados.cor)
  validarCategoria(dados.categoria)

  const antes = await tarefaConfigRepository.buscarStatus(idTenant, chave)
  if (!antes) throw erroNegocio(404, "Coluna nao encontrada.")

  let status
  try {
    status = await tarefaConfigRepository.atualizarStatus(idTenant, chave, {
      rotulo: dados.rotulo.trim(),
      cor: dados.cor || antes.cor,
      categoria: dados.categoria,
      ordem: dados.ordem,
    })
  } catch (err) {
    if (err.code === "23505") throw erroNegocio(409, "Ja existe uma coluna com esse nome.")
    throw err
  }

  if (antes.categoria !== status.categoria) {
    await tarefaConfigRepository.sincronizarConclusaoPorStatus(idTenant, chave, status.categoria)
  }

  await auditLogService.registrar({
    idTenant,
    idUsuario: usuario?.id,
    acao: "EDITAR",
    entidade: "tarefa_status",
    entidadeId: chave,
    descricao: `Editou a coluna de tarefas "${status.rotulo}".`,
    dadosAntes: antes,
    dadosDepois: status,
  })

  return status
}

/**
 * Ativa/desativa um status. Desativar e o "excluir" da tela: as tarefas que
 * estao nele continuam existindo e exibindo o rotulo (a FK exige que ele
 * continue existindo); a coluna some do quadro e do seletor.
 *
 * O QUADRO NAO PODE FICAR SEM NENHUMA COLUNA — diferente do tipo de startup,
 * que e opcional. Sem status ativo, nao ha onde criar a proxima tarefa, e a
 * incubadora ficaria trancada fora do proprio modulo por um clique reversivel
 * que ninguem adivinharia como desfazer.
 */
async function alterarStatusDoStatus(idTenant, chave, ativo, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, GERENCIAR)
  if (typeof ativo !== "boolean") throw erroNegocio(400, "Informe 'ativo' como true ou false.")

  const antes = await tarefaConfigRepository.buscarStatus(idTenant, chave)
  if (!antes) throw erroNegocio(404, "Coluna nao encontrada.")

  if (!ativo) {
    const ativos = await tarefaConfigRepository.listarStatus(idTenant)
    if (ativos.length <= 1) {
      throw erroNegocio(400, "O quadro precisa de ao menos uma coluna ativa.")
    }
  }

  const status = await tarefaConfigRepository.alterarStatusDoStatus(idTenant, chave, ativo)

  await auditLogService.registrar({
    idTenant,
    idUsuario: usuario?.id,
    acao: ativo ? "REATIVAR" : "DESATIVAR",
    entidade: "tarefa_status",
    entidadeId: chave,
    descricao: `${ativo ? "Reativou" : "Desativou"} a coluna de tarefas "${status.rotulo}".`,
    dadosAntes: antes,
    dadosDepois: status,
  })

  return status
}

async function usoDoStatus(idTenant, chave, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, GERENCIAR)
  return { tarefas: await tarefaConfigRepository.contarTarefasDoStatus(idTenant, chave) }
}

// ---------------------------------------------------------------------------
// CAMPOS PERSONALIZAVEIS
// ---------------------------------------------------------------------------

async function listarCampos(idTenant, usuario, incluirInativos = false) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, LER)
  if (incluirInativos) await rbacService.garantirPermissao(idTenant, usuario, GERENCIAR)
  return tarefaConfigRepository.listarCampos(idTenant, incluirInativos)
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
    tarefaConfigRepository.buscarCampoPorChave
  )
  const config = normalizarConfig(dados.tipo, dados.config)

  let campo
  try {
    campo = await tarefaConfigRepository.criarCampo(idTenant, {
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
    entidade: "tarefa_campo",
    entidadeId: String(campo.id_campo),
    descricao: `Criou o campo personalizado de tarefa "${rotulo}" (${dados.tipo}).`,
    dadosDepois: campo,
  })

  return campo
}

/**
 * Atualiza um campo. A chave e o tipo sao imutaveis (ver o repositorio): mudar
 * o tipo transformaria em lixo os valores ja preenchidos nas tarefas.
 */
async function atualizarCampo(idTenant, idCampo, dados, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, GERENCIAR)
  validarRotulo(dados.rotulo, 80, "do campo")

  const antes = await tarefaConfigRepository.buscarCampo(idCampo)
  if (!antes || Number(antes.id_tenant) !== Number(idTenant)) {
    throw erroNegocio(404, "Campo nao encontrado.")
  }

  // A config e validada contra o tipo GRAVADO, nao contra um que venha no
  // corpo: o tipo nao muda, e aceitar um do cliente aqui seria a porta dos
  // fundos para o que atualizarCampo se recusa a fazer pela porta da frente.
  const config = normalizarConfig(antes.tipo, dados.config ?? antes.config)

  let campo
  try {
    campo = await tarefaConfigRepository.atualizarCampo(idTenant, idCampo, {
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
    entidade: "tarefa_campo",
    entidadeId: String(idCampo),
    descricao: `Editou o campo personalizado de tarefa "${campo.rotulo}".`,
    dadosAntes: antes,
    dadosDepois: campo,
  })

  return campo
}

/**
 * Ativa/desativa um campo.
 *
 * Os valores ja preenchidos CONTINUAM no `campos_extras` de cada tarefa — o
 * campo so deixa de ser pedido e exibido. E o que torna a operacao reversivel:
 * reativar traz tudo de volta preenchido.
 */
async function alterarStatusCampo(idTenant, idCampo, ativo, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, GERENCIAR)
  if (typeof ativo !== "boolean") throw erroNegocio(400, "Informe 'ativo' como true ou false.")

  const antes = await tarefaConfigRepository.buscarCampo(idCampo)
  if (!antes || Number(antes.id_tenant) !== Number(idTenant)) {
    throw erroNegocio(404, "Campo nao encontrado.")
  }

  const campo = await tarefaConfigRepository.alterarStatusCampo(idTenant, idCampo, ativo)

  await auditLogService.registrar({
    idTenant,
    idUsuario: usuario?.id,
    acao: ativo ? "REATIVAR" : "DESATIVAR",
    entidade: "tarefa_campo",
    entidadeId: String(idCampo),
    descricao: `${ativo ? "Reativou" : "Desativou"} o campo personalizado de tarefa "${campo.rotulo}".`,
    dadosAntes: antes,
    dadosDepois: campo,
  })

  return campo
}

async function usoDoCampo(idTenant, idCampo, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, GERENCIAR)

  const campo = await tarefaConfigRepository.buscarCampo(idCampo)
  if (!campo || Number(campo.id_tenant) !== Number(idTenant)) {
    throw erroNegocio(404, "Campo nao encontrado.")
  }
  return { tarefas: await tarefaConfigRepository.contarTarefasComCampo(idTenant, campo.chave) }
}

module.exports = {
  listarStatus,
  criarStatus,
  atualizarStatus,
  alterarStatusDoStatus,
  usoDoStatus,

  listarCampos,
  criarCampo,
  atualizarCampo,
  alterarStatusCampo,
  usoDoCampo,
}
