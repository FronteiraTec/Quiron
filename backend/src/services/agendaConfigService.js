/**
 * Service da configuracao da agenda: categorias e locais de evento.
 *
 * DUAS AUTORIZACOES DIFERENTES, de proposito:
 *
 *   LER   exige `eventos.agenda.visualizar` — a mesma chave do calendario.
 *         Categoria nao e informacao restrita: e o rotulo e a cor de cada
 *         evento na tela. Quem enxerga a agenda precisa enxergar isto, senao o
 *         calendario renderiza cinza e sem nome para o incubado.
 *   ESCREVER exige `configuracoes.agenda.gerenciar` — decidir o vocabulario da
 *         incubadora e ato de administracao, junto das demais configuracoes.
 *
 * Sem essa separacao seria preciso escolher entre dar poder de configuracao a
 * todo mundo ou quebrar o calendario de quem so participa.
 */
const agendaConfigRepository = require("../repositories/agendaConfigRepository")
const rbacService = require("./rbacService")
const auditLogService = require("./auditLogService")
const { ICONES_VALIDOS } = require("../eventos/categoriasPadrao")
const { erroNegocio } = require("../utils/erros")

const HEX = /^#[0-9a-fA-F]{6}$/
const CHAVE_VALIDA = /^[A-Z0-9_]{1,40}$/

/**
 * Deriva a chave a partir do rotulo: "Demo Day" -> "DEMO_DAY".
 *
 * A chave e o que fica gravado em cada evento e nunca muda; o rotulo e o que a
 * incubadora ve e pode reescrever a vontade. Gerar uma a partir do outro poupa
 * o admin de entender essa distincao no momento do cadastro — ele so digita o
 * nome.
 *
 * NFD + remocao de diacriticos porque "Avaliacao" e "Avaliação" precisam cair
 * na mesma chave; sem isso a chave sairia com acento e viraria dor em qualquer
 * comparacao futura.
 */
function gerarChave(rotulo) {
  return rotulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40)
}

/**
 * Uma chave livre no tenant. Se "DEMO_DAY" ja existe (mesmo desativada, porque
 * a PK nao liga para o `ativo`), tenta DEMO_DAY_2, _3...
 */
async function chaveDisponivel(idTenant, base) {
  let candidata = base
  let n = 2
  while (await agendaConfigRepository.buscarCategoria(idTenant, candidata)) {
    const sufixo = `_${n}`
    candidata = `${base.slice(0, 40 - sufixo.length)}${sufixo}`
    n += 1
  }
  return candidata
}

/** Valida os campos comuns de uma categoria. */
function validarCategoria({ rotulo, cor, icone }) {
  if (!rotulo || !rotulo.trim()) throw erroNegocio(400, "Informe o nome da categoria.")
  if (rotulo.trim().length > 60) throw erroNegocio(400, "O nome da categoria deve ter no maximo 60 caracteres.")
  if (cor && !HEX.test(cor)) throw erroNegocio(400, "Cor invalida. Use hexadecimal, como #6366f1.")
  if (icone && !ICONES_VALIDOS.includes(icone)) {
    throw erroNegocio(400, `Icone invalido. Use: ${ICONES_VALIDOS.join(", ")}.`)
  }
}

// ---------------------------------------------------------------------------
// CATEGORIAS
// ---------------------------------------------------------------------------

/**
 * Categorias do tenant. `incluirInativas` so vale para quem gerencia: o
 * seletor de evento novo nunca deve oferecer o que foi desativado.
 */
async function listarCategorias(idTenant, usuario, incluirInativas = false) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, "eventos.agenda.visualizar")
  if (incluirInativas) {
    await rbacService.garantirPermissao(idTenant, usuario, "configuracoes.agenda.gerenciar")
  }
  return agendaConfigRepository.listarCategorias(idTenant, incluirInativas)
}

/** Cria uma categoria, derivando a chave do nome. */
async function criarCategoria(idTenant, dados, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, "configuracoes.agenda.gerenciar")
  validarCategoria(dados)

  const rotulo = dados.rotulo.trim()
  const base = gerarChave(rotulo)
  // Rotulo so de simbolos ("###") gera chave vazia, que a PK aceitaria como
  // string vazia e o resto do sistema trataria como categoria sem nome.
  if (!CHAVE_VALIDA.test(base)) {
    throw erroNegocio(400, "O nome da categoria precisa ter ao menos uma letra ou numero.")
  }
  const chave = await chaveDisponivel(idTenant, base)

  let categoria
  try {
    categoria = await agendaConfigRepository.criarCategoria(idTenant, {
      chave,
      rotulo,
      cor: dados.cor || "#8b5cf6",
      icone: dados.icone || "Event",
      ordem: dados.ordem,
    })
  } catch (err) {
    // uq_evento_categoria_rotulo: duas categorias com o mesmo nome no seletor
    // nao dariam para distinguir.
    if (err.code === "23505") {
      throw erroNegocio(409, "Ja existe uma categoria com esse nome.")
    }
    throw err
  }

  await auditLogService.registrar({
    idTenant,
    idUsuario: usuario?.id,
    acao: "CRIAR",
    entidade: "evento_categoria",
    entidadeId: chave,
    descricao: `Criou a categoria de evento "${rotulo}".`,
    dadosDepois: categoria,
  })

  return categoria
}

/** Atualiza rotulo/cor/icone/ordem. A chave e imutavel (ver o repositorio). */
async function atualizarCategoria(idTenant, chave, dados, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, "configuracoes.agenda.gerenciar")
  validarCategoria(dados)

  const antes = await agendaConfigRepository.buscarCategoria(idTenant, chave)
  if (!antes) throw erroNegocio(404, "Categoria nao encontrada.")

  let categoria
  try {
    categoria = await agendaConfigRepository.atualizarCategoria(idTenant, chave, {
      rotulo: dados.rotulo.trim(),
      cor: dados.cor || antes.cor,
      icone: dados.icone || antes.icone,
      ordem: dados.ordem,
    })
  } catch (err) {
    if (err.code === "23505") {
      throw erroNegocio(409, "Ja existe uma categoria com esse nome.")
    }
    throw err
  }

  await auditLogService.registrar({
    idTenant,
    idUsuario: usuario?.id,
    acao: "EDITAR",
    entidade: "evento_categoria",
    entidadeId: chave,
    descricao: `Editou a categoria de evento "${categoria.rotulo}".`,
    dadosAntes: antes,
    dadosDepois: categoria,
  })

  return categoria
}

/**
 * Ativa ou desativa uma categoria.
 *
 * Desativar e o "excluir" da tela: os eventos historicos continuam apontando
 * para ela (a FK exige) e seguem exibindo rotulo e cor; ela so some do seletor
 * de evento novo.
 *
 * Nao deixa desativar a ultima categoria ativa: sem nenhuma, a FK
 * (id_tenant, categoria) impede criar QUALQUER evento e a incubadora fica com a
 * agenda travada sem entender por que.
 */
async function alterarStatusCategoria(idTenant, chave, ativo, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, "configuracoes.agenda.gerenciar")
  if (typeof ativo !== "boolean") {
    throw erroNegocio(400, "Informe 'ativo' como true ou false.")
  }

  const antes = await agendaConfigRepository.buscarCategoria(idTenant, chave)
  if (!antes) throw erroNegocio(404, "Categoria nao encontrada.")

  if (!ativo) {
    const ativas = await agendaConfigRepository.listarCategorias(idTenant)
    if (ativas.length <= 1) {
      throw erroNegocio(400, "Mantenha ao menos uma categoria ativa — sem nenhuma nao e possivel criar eventos.")
    }
  }

  const categoria = await agendaConfigRepository.alterarStatusCategoria(idTenant, chave, ativo)

  await auditLogService.registrar({
    idTenant,
    idUsuario: usuario?.id,
    acao: "EDITAR",
    entidade: "evento_categoria",
    entidadeId: chave,
    descricao: `${ativo ? "Reativou" : "Desativou"} a categoria de evento "${antes.rotulo}".`,
    dadosAntes: antes,
    dadosDepois: categoria,
  })

  return categoria
}

/** Quantos eventos usam a categoria — a tela avisa antes de desativar. */
async function usoDaCategoria(idTenant, chave, usuario) {
  await rbacService.garantirPermissao(idTenant, usuario, "configuracoes.agenda.gerenciar")
  return { eventos: await agendaConfigRepository.contarEventosDaCategoria(idTenant, chave) }
}

// ---------------------------------------------------------------------------
// LOCAIS
// ---------------------------------------------------------------------------

/** Valida os campos de um local. */
function validarLocal({ nome, capacidade }) {
  if (!nome || !nome.trim()) throw erroNegocio(400, "Informe o nome do local.")
  if (nome.trim().length > 120) throw erroNegocio(400, "O nome do local deve ter no maximo 120 caracteres.")
  if (capacidade != null && capacidade !== "") {
    const n = Number(capacidade)
    if (!Number.isInteger(n) || n <= 0) {
      throw erroNegocio(400, "A capacidade deve ser um numero inteiro maior que zero.")
    }
  }
}

/** Normaliza capacidade para inteiro ou null (o form manda string vazia). */
function lerCapacidade(valor) {
  if (valor == null || valor === "") return null
  return Number(valor)
}

async function listarLocais(idTenant, usuario, incluirInativos = false) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, "eventos.agenda.visualizar")
  if (incluirInativos) {
    await rbacService.garantirPermissao(idTenant, usuario, "configuracoes.agenda.gerenciar")
  }
  return agendaConfigRepository.listarLocais(idTenant, incluirInativos)
}

async function criarLocal(idTenant, dados, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, "configuracoes.agenda.gerenciar")
  validarLocal(dados)

  let local
  try {
    local = await agendaConfigRepository.criarLocal(idTenant, {
      nome: dados.nome.trim(),
      endereco: dados.endereco?.trim() || null,
      capacidade: lerCapacidade(dados.capacidade),
    })
  } catch (err) {
    if (err.code === "23505") throw erroNegocio(409, "Ja existe um local com esse nome.")
    throw err
  }

  await auditLogService.registrar({
    idTenant,
    idUsuario: usuario?.id,
    acao: "CRIAR",
    entidade: "evento_local",
    entidadeId: String(local.id_local),
    descricao: `Cadastrou o local "${local.nome}".`,
    dadosDepois: local,
  })

  return local
}

async function atualizarLocal(idTenant, idLocal, dados, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, "configuracoes.agenda.gerenciar")
  validarLocal(dados)

  const antes = await agendaConfigRepository.buscarLocal(idLocal)
  // Confere a posse antes de responder 404: o UPDATE ja filtra por id_tenant,
  // mas assim a mensagem nao denuncia que o id existe em outra incubadora.
  if (!antes || antes.id_tenant !== Number(idTenant)) {
    throw erroNegocio(404, "Local nao encontrado.")
  }

  let local
  try {
    local = await agendaConfigRepository.atualizarLocal(idTenant, idLocal, {
      nome: dados.nome.trim(),
      endereco: dados.endereco?.trim() || null,
      capacidade: lerCapacidade(dados.capacidade),
    })
  } catch (err) {
    if (err.code === "23505") throw erroNegocio(409, "Ja existe um local com esse nome.")
    throw err
  }

  await auditLogService.registrar({
    idTenant,
    idUsuario: usuario?.id,
    acao: "EDITAR",
    entidade: "evento_local",
    entidadeId: String(idLocal),
    descricao: `Editou o local "${local.nome}".`,
    dadosAntes: antes,
    dadosDepois: local,
  })

  return local
}

/**
 * Ativa/desativa um local. Some do seletor; os eventos que aconteceram nele
 * continuam apontando para o registro e exibindo o nome.
 */
async function alterarStatusLocal(idTenant, idLocal, ativo, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, "configuracoes.agenda.gerenciar")
  if (typeof ativo !== "boolean") {
    throw erroNegocio(400, "Informe 'ativo' como true ou false.")
  }

  const antes = await agendaConfigRepository.buscarLocal(idLocal)
  if (!antes || antes.id_tenant !== Number(idTenant)) {
    throw erroNegocio(404, "Local nao encontrado.")
  }

  const local = await agendaConfigRepository.alterarStatusLocal(idTenant, idLocal, ativo)

  await auditLogService.registrar({
    idTenant,
    idUsuario: usuario?.id,
    acao: "EDITAR",
    entidade: "evento_local",
    entidadeId: String(idLocal),
    descricao: `${ativo ? "Reativou" : "Desativou"} o local "${antes.nome}".`,
    dadosAntes: antes,
    dadosDepois: local,
  })

  return local
}

/** Quantos eventos acontecem no local — a tela avisa antes de desativar. */
async function usoDoLocal(idTenant, idLocal, usuario) {
  await rbacService.garantirPermissao(idTenant, usuario, "configuracoes.agenda.gerenciar")
  return { eventos: await agendaConfigRepository.contarEventosDoLocal(idTenant, idLocal) }
}

module.exports = {
  listarCategorias,
  criarCategoria,
  atualizarCategoria,
  alterarStatusCategoria,
  usoDaCategoria,

  listarLocais,
  criarLocal,
  atualizarLocal,
  alterarStatusLocal,
  usoDoLocal,
}
