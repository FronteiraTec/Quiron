/**
 * Integracoes de Inteligencia Artificial da incubadora (aba de Configuracoes).
 *
 * A incubadora escolhe e PAGA o provedor (docs/reunioes.md, decisao 6). Cada
 * finalidade e um slot: TRANSCRICAO (Etapa 4) e RELATORIO (Etapa 5). Sem o
 * slot de transcricao ativo, a reuniao funciona, mas nao e gravada.
 *
 * A CHAVE:
 *   - entra por aqui e e cifrada no repositorio, com o contexto da
 *     incubadora e da finalidade;
 *   - NUNCA volta ao front: a tela recebe so `chave_final` (4 caracteres);
 *   - salvar sem mandar a chave mantem a atual (a tela nao a tem para reenviar);
 *   - a auditoria registra a troca com o final da chave, nunca a chave.
 *
 * O endereco do provedor compativel passa por urlBase.validarUrlBase ao salvar
 * e de novo antes de cada chamada (secao 7).
 */
const iaConfigRepository = require("../repositories/iaConfigRepository")
const rbacService = require("./rbacService")
const auditLogService = require("./auditLogService")
const { criarProvedorSTT, PROVEDORES_STT } = require("../reunioes/stt")
const { validarUrlBase } = require("../reunioes/urlBase")
const { ErroProvedor, limparSegredos } = require("../reunioes/provedores")
const { erroNegocio } = require("../utils/erros")

const VISUALIZAR = "configuracoes.ia.visualizar"
const EDITAR = "configuracoes.ia.editar"

const FINALIDADES = ["TRANSCRICAO", "RELATORIO"]

/** Os slots que ja tem codigo atras. O de relatorio chega na Etapa 5. */
const FINALIDADES_ATIVAS = ["TRANSCRICAO"]

const PROVEDORES_POR_FINALIDADE = { TRANSCRICAO: PROVEDORES_STT }

const LIMITES_RETENCAO = { audio: [0, 30], transcricao: [1, 3650] }

function conferirFinalidade(finalidade) {
  if (!FINALIDADES.includes(finalidade)) throw erroNegocio(404, "Finalidade desconhecida.")
  if (!FINALIDADES_ATIVAS.includes(finalidade)) {
    throw erroNegocio(400, "O relatório por IA chega na próxima etapa do módulo de reuniões.", "FINALIDADE_INDISPONIVEL")
  }
}

/** A configuracao da incubadora, sem chave, mais o que a tela precisa para montar o formulario. */
async function listar(idTenant, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, VISUALIZAR)
  const [configuracoes, retencao, podeEditar] = await Promise.all([
    iaConfigRepository.listar(idTenant),
    iaConfigRepository.buscarRetencao(idTenant),
    rbacService.temPermissao(idTenant, usuario, EDITAR),
  ])
  return {
    configuracoes,
    retencao,
    limites_retencao: { audio_dias: LIMITES_RETENCAO.audio, transcricao_dias: LIMITES_RETENCAO.transcricao },
    provedores: { TRANSCRICAO: PROVEDORES_STT },
    finalidades_disponiveis: FINALIDADES_ATIVAS,
    pode_editar: podeEditar,
  }
}

/**
 * Grava o slot de uma finalidade.
 * @param {{provedor: string, modelo?: string, url_base?: string, chave?: string, ativo?: boolean}} dados
 */
async function salvar(idTenant, finalidade, dados, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, EDITAR)
  conferirFinalidade(finalidade)

  const catalogo = PROVEDORES_POR_FINALIDADE[finalidade]
  const provedor = String(dados?.provedor || "")
  if (!catalogo[provedor]) {
    throw erroNegocio(400, `Provedor inválido para ${finalidade === "TRANSCRICAO" ? "transcrição" : "relatório"}.`)
  }

  const modelo = String(dados?.modelo || catalogo[provedor].modeloPadrao || "").trim()
  if (!modelo) throw erroNegocio(400, "Informe o modelo.")
  if (modelo.length > 100 || !/^[\w.:/@+-]+$/.test(modelo)) throw erroNegocio(400, "Nome de modelo inválido.")

  const urlBase = provedor === "OPENAI_COMPATIVEL" ? await validarUrlBase(dados?.url_base) : null

  const chave = typeof dados?.chave === "string" ? dados.chave.trim() : ""
  if (chave && (chave.length < 8 || chave.length > 500 || /\s/.test(chave))) {
    throw erroNegocio(400, "A chave de API parece incompleta. Copie de novo do painel do provedor.")
  }
  const antes = await iaConfigRepository.buscar(idTenant, finalidade)
  if (!chave && !antes) throw erroNegocio(400, "Informe a chave de API.")

  const ativo = dados?.ativo === undefined ? true : dados.ativo === true

  await iaConfigRepository.salvar({ idTenant, finalidade, provedor, modelo, urlBase, chave: chave || null, ativo, idUsuario: usuario?.id })
  const depois = await iaConfigRepository.buscar(idTenant, finalidade)

  await auditLogService.registrar({
    idTenant,
    idUsuario: usuario?.id ?? null,
    acao: antes ? "EDITAR" : "CRIAR",
    entidade: "ia_config",
    entidadeId: finalidade,
    descricao:
      `${antes ? "Alterou" : "Configurou"} a integração de ${finalidade === "TRANSCRICAO" ? "transcrição" : "relatório"}: ` +
      `${catalogo[provedor].rotulo}, modelo ${modelo}${chave ? `, chave terminada em ${depois.chave_final}` : ""}${ativo ? "" : " (desativada)"}.`,
    dadosAntes: antes ? semAutoria(antes) : null,
    dadosDepois: semAutoria(depois),
  })
  return depois
}

/** O que vai para a auditoria: sem chave (ela nunca esta aqui) e sem o carimbo do teste. */
function semAutoria({ ultima_validacao_ts, ultima_validacao_ok, ultima_validacao_erro, atualizado_ts, ...resto }) {
  return resto
}

/**
 * Testa a conexao: chave E modelo, transcrevendo 1 s de silencio. Grava o
 * resultado em `ultima_validacao_*` para a tela mostrar.
 */
async function testar(idTenant, finalidade, usuario, { prazoMs = 45000 } = {}) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, EDITAR)
  conferirFinalidade(finalidade)

  const config = await iaConfigRepository.buscarComChave(idTenant, finalidade)
  if (!config) throw erroNegocio(409, "Salve a configuração antes de testar.", "SEM_CONFIGURACAO")
  if (!config.chave) {
    throw erroNegocio(409, "A chave salva não pôde ser lida (a chave do servidor mudou?). Informe a chave de novo.", "CHAVE_ILEGIVEL")
  }

  let ok = true
  let erro = null
  try {
    if (config.provedor === "OPENAI_COMPATIVEL") config.url_base = await validarUrlBase(config.url_base)
    const provedor = criarProvedorSTT(config)
    await provedor.testar({ sinal: AbortSignal.timeout(prazoMs) })
  } catch (err) {
    ok = false
    erro = err instanceof ErroProvedor || err?.status ? limparSegredos(err.message) : limparSegredos(`Falha inesperada: ${err?.message}`)
  }
  await iaConfigRepository.registrarValidacao(idTenant, finalidade, { ok, erro })
  return { ok, erro, configuracao: await iaConfigRepository.buscar(idTenant, finalidade) }
}

/** Por quanto tempo o audio e a transcricao ficam guardados. */
async function salvarRetencao(idTenant, dados, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, EDITAR)
  const inteiro = (v, [min, max], rotulo) => {
    const n = Number(v)
    if (!Number.isInteger(n) || n < min || n > max) throw erroNegocio(400, `${rotulo} deve ser um número inteiro de ${min} a ${max}.`)
    return n
  }
  const audioDias = inteiro(dados?.audio_dias, LIMITES_RETENCAO.audio, "A retenção do áudio")
  const transcricaoDias = inteiro(dados?.transcricao_dias, LIMITES_RETENCAO.transcricao, "A retenção da transcrição")

  const antes = await iaConfigRepository.buscarRetencao(idTenant)
  await iaConfigRepository.salvarRetencao(idTenant, { audioDias, transcricaoDias })
  const depois = await iaConfigRepository.buscarRetencao(idTenant)
  await auditLogService.registrar({
    idTenant,
    idUsuario: usuario?.id ?? null,
    acao: "EDITAR",
    entidade: "reuniao_retencao",
    entidadeId: String(idTenant),
    descricao: `Retenção das reuniões: áudio ${audioDias} dia(s), transcrição ${transcricaoDias} dia(s).`,
    dadosAntes: antes,
    dadosDepois: depois,
  })
  return depois
}

module.exports = { listar, salvar, testar, salvarRetencao, FINALIDADES_ATIVAS }
