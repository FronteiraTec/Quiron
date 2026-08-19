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
const { CICLOS_VALIDOS, TIPOS_CAMPO } = require("../startups/padroes")
const { erroNegocio } = require("../utils/erros")

const LER = "startups.startups.visualizar"
const GERENCIAR = "configuracoes.startups.gerenciar"

const HEX = /^#[0-9a-fA-F]{6}$/
const CHAVE_VALIDA = /^[A-Z0-9_]{1,40}$/

/**
 * Deriva a chave a partir do rotulo: "Em tracao" -> "EM_TRACAO".
 *
 * Mesma funcao (e mesma justificativa) de agendaConfigService: a chave e o que
 * fica gravado em cada startup e nunca muda; o rotulo e o que a incubadora ve e
 * reescreve a vontade. Gerar uma da outra poupa quem cadastra de entender essa
 * distincao — ele so digita o nome.
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
 * Uma chave livre no tenant. Se "PARCEIRA" ja existe (mesmo desativada, porque
 * a PK nao liga para o `ativo`), tenta PARCEIRA_2, _3...
 *
 * @param {(idTenant:number, chave:string) => Promise<any>} buscar
 */
async function chaveDisponivel(idTenant, base, buscar) {
  let candidata = base
  let n = 2
  while (await buscar(idTenant, candidata)) {
    const sufixo = `_${n}`
    candidata = `${base.slice(0, 40 - sufixo.length)}${sufixo}`
    n += 1
  }
  return candidata
}

/** O rotulo precisa existir, caber na coluna e gerar uma chave utilizavel. */
function validarRotulo(rotulo, limite, oQue) {
  if (!rotulo || !rotulo.trim()) throw erroNegocio(400, `Informe o nome ${oQue}.`)
  if (rotulo.trim().length > limite) {
    throw erroNegocio(400, `O nome ${oQue} deve ter no maximo ${limite} caracteres.`)
  }
}

function validarCor(cor) {
  if (cor && !HEX.test(cor)) throw erroNegocio(400, "Cor invalida. Use hexadecimal, como #6366f1.")
}

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
  const base = gerarChave(rotulo)
  // Rotulo so de simbolos ("###") gera chave vazia, que a PK aceitaria como
  // string vazia e o resto do sistema trataria como tipo sem nome.
  if (!CHAVE_VALIDA.test(base)) {
    throw erroNegocio(400, "O nome do tipo precisa ter ao menos uma letra ou numero.")
  }
  const chave = await chaveDisponivel(idTenant, base, startupConfigRepository.buscarTipo)

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
  const base = gerarChave(rotulo)
  if (!CHAVE_VALIDA.test(base)) {
    throw erroNegocio(400, "O nome da situacao precisa ter ao menos uma letra ou numero.")
  }
  const chave = await chaveDisponivel(idTenant, base, startupConfigRepository.buscarSituacao)

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

/**
 * Valida a `config` de um campo contra o seu tipo, e devolve so o que aquele
 * tipo usa.
 *
 * FILTRAR, e nao so validar: sem isso a config de um campo que ja foi
 * CATEGORIA e virou outra coisa carregaria `opcoes` para sempre, e a proxima
 * pessoa a ler o JSON nao saberia dizer o que vale.
 */
function normalizarConfig(tipo, config) {
  const entrada = config && typeof config === "object" ? config : {}

  if (tipo === "CATEGORIA") {
    const opcoes = Array.isArray(entrada.opcoes) ? entrada.opcoes : []
    const limpas = opcoes
      .map((o) => ({
        valor: String(o?.valor ?? o?.rotulo ?? "").trim(),
        rotulo: String(o?.rotulo ?? o?.valor ?? "").trim(),
      }))
      .filter((o) => o.valor && o.rotulo)

    if (limpas.length === 0) {
      throw erroNegocio(400, "Um campo de categoria precisa de ao menos uma opcao.")
    }
    // Opcoes com o mesmo valor sao indistinguiveis na hora de gravar: as duas
    // gravariam a mesma string e uma delas nunca poderia ser selecionada de
    // volta ao abrir o cadastro.
    const vistos = new Set()
    for (const o of limpas) {
      if (vistos.has(o.valor)) {
        throw erroNegocio(400, `A opcao "${o.valor}" esta repetida.`)
      }
      vistos.add(o.valor)
    }
    return { opcoes: limpas }
  }

  if (tipo === "DOCUMENTO") {
    const mascara = String(entrada.mascara ?? "").trim()
    if (!mascara) {
      throw erroNegocio(400, "Um campo de documento precisa de uma mascara. Ex.: ###.###.###-##")
    }
    if (mascara.length > 40) {
      throw erroNegocio(400, "A mascara deve ter no maximo 40 caracteres.")
    }
    // '#' = digito, 'A' = letra ou digito. Sem nenhum dos dois a "mascara" e
    // texto fixo e o campo nao aceitaria nada.
    if (!/[#A]/.test(mascara)) {
      throw erroNegocio(400, "Use # para digito e A para letra ou digito. Ex.: ###.###.###-##")
    }
    return { mascara }
  }

  if (tipo === "NUMERICO") {
    const saida = {}
    if (entrada.min !== undefined && entrada.min !== null && entrada.min !== "") {
      saida.min = Number(entrada.min)
    }
    if (entrada.max !== undefined && entrada.max !== null && entrada.max !== "") {
      saida.max = Number(entrada.max)
    }
    if (saida.min !== undefined && !Number.isFinite(saida.min)) {
      throw erroNegocio(400, "O minimo precisa ser um numero.")
    }
    if (saida.max !== undefined && !Number.isFinite(saida.max)) {
      throw erroNegocio(400, "O maximo precisa ser um numero.")
    }
    if (saida.min !== undefined && saida.max !== undefined && saida.min > saida.max) {
      throw erroNegocio(400, "O minimo nao pode ser maior que o maximo.")
    }
    const casas = Number(entrada.casas ?? 0)
    if (!Number.isInteger(casas) || casas < 0 || casas > 6) {
      throw erroNegocio(400, "As casas decimais devem ser um inteiro entre 0 e 6.")
    }
    saida.casas = casas
    const sufixo = String(entrada.sufixo ?? "").trim()
    if (sufixo) saida.sufixo = sufixo.slice(0, 10)
    return saida
  }

  if (tipo === "MONETARIO") {
    const moeda = String(entrada.moeda ?? "BRL").trim().toUpperCase()
    if (!/^[A-Z]{3}$/.test(moeda)) {
      throw erroNegocio(400, "A moeda deve ser o codigo de tres letras, como BRL ou USD.")
    }
    return { moeda }
  }

  // TEXTO.
  return entrada.multilinha ? { multilinha: true } : {}
}

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

  if (!TIPOS_CAMPO.includes(dados.tipo)) {
    throw erroNegocio(400, `Tipo de campo invalido. Use: ${TIPOS_CAMPO.join(", ")}.`)
  }

  const rotulo = dados.rotulo.trim()
  const base = gerarChave(rotulo)
  if (!CHAVE_VALIDA.test(base)) {
    throw erroNegocio(400, "O nome do campo precisa ter ao menos uma letra ou numero.")
  }
  const chave = await chaveDisponivel(idTenant, base, startupConfigRepository.buscarCampoPorChave)
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
