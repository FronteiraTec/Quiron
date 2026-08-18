/**
 * Service da Trilha (regra de negocio).
 *
 * Substitui faseService + moduloService + tarefaService. Como os tres niveis
 * viraram uma arvore so, as regras que antes estavam espalhadas (que tipo
 * aceita que filho, onde a ordem e valida) ficam centralizadas aqui.
 *
 * O banco tambem defende essas regras (trigger trg_trilha_no_hierarquia), mas
 * validar aqui devolve 400 com mensagem legivel em vez de um 500 vindo do
 * driver do Postgres.
 */
const trilhaRepository = require("../repositories/trilhaRepository")
const rbacService = require("./rbacService")
const { erroNegocio } = require("../utils/erros")

// ---------------------------------------------------------------------------
// Autorizacao
//
// A trilha e o primeiro modulo em que a permissao RBAC decide sozinha — sem
// "ou o papel e admin" atras. Quem pode editar o programa e quem tem a chave,
// e as roles padrao ja nascem com o conjunto que reproduz o que cada papel
// fazia antes (ver rbac/rolesPadrao.js e a migracao 005).
//
// A maioria das operacoes recebe so o id do NO, nao o do tenant. O tenant sai
// do proprio no: confiar num id_tenant vindo do cliente deixaria alguem checar
// permissao contra a incubadora onde ele tem acesso para depois editar a
// arvore de outra.
// ---------------------------------------------------------------------------

/**
 * Busca sem checar nada — primitiva interna.
 *
 * Separada de `buscar` (o endpoint) porque as operacoes de escrita precisam
 * carregar o no ANTES de saber contra qual tenant checar. Se esta funcao
 * checasse "visualizar", toda escrita faria duas checagens em sequencia, e a
 * primeira delas com a chave errada.
 */
async function buscarNo(id) {
  const no = await trilhaRepository.buscarPorId(id)
  if (!no) throw erroNegocio(404, "No da trilha nao encontrado.")
  return no
}

/** Carrega o no e exige a permissao no tenant DELE. */
async function buscarComPermissao(id, usuario, chave) {
  const no = await buscarNo(id)
  await rbacService.garantirPermissao(no.id_tenant, usuario, chave)
  return no
}

// Qual tipo cada nivel aceita como filho. `null` = folha.
const TIPO_FILHO = {
  PROGRAMA: "FASE",
  FASE: "MODULO",
  MODULO: "PASSO",
  PASSO: null,
}

const TIPOS = Object.keys(TIPO_FILHO)
const TIPOS_PASSO = ["TEXTO", "ANEXO", "VIDEO", "QUESTIONARIO"]

/** Carrega a arvore completa de um tenant. */
async function arvore(idTenant, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, "programa.trilha.visualizar")
  return trilhaRepository.arvorePorTenant(idTenant)
}

/** Busca um no pelo id. */
async function buscar(id, usuario) {
  return buscarComPermissao(id, usuario, "programa.trilha.visualizar")
}

/** Lista os filhos diretos de um no. */
async function listarFilhos(idPai, usuario) {
  await buscarComPermissao(idPai, usuario, "programa.trilha.visualizar")
  return trilhaRepository.listarFilhos(idPai)
}

/**
 * Cria um no. O tipo e deduzido do pai — quem chama informa onde pendurar, e
 * o nivel decorre disso. Evita que o cliente peca um PASSO dentro de uma FASE.
 */
async function criar(dados, usuario) {
  const { idTenant, idPai, nome } = dados

  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, "programa.trilha.criar")
  if (!nome || !nome.trim()) throw erroNegocio(400, "Informe o nome.")

  let tipo

  if (idPai == null) {
    // Sem pai so existe a raiz.
    tipo = "PROGRAMA"
  } else {
    const pai = await trilhaRepository.buscarPorId(idPai)
    if (!pai) throw erroNegocio(404, "No pai nao encontrado.")

    if (Number(pai.id_tenant) !== Number(idTenant)) {
      throw erroNegocio(400, "O no pai pertence a outro tenant.")
    }

    tipo = TIPO_FILHO[pai.tipo]
    if (!tipo) {
      throw erroNegocio(400, "Um PASSO e folha da trilha: nao aceita filhos.")
    }
  }

  validarCamposDePasso(tipo, dados)

  return trilhaRepository.criar({ ...dados, tipo, nome: nome.trim() })
}

/** Aplica um patch parcial ao no. */
async function atualizar(id, patch, usuario) {
  const no = await buscarComPermissao(id, usuario, "programa.trilha.editar")

  if (patch.nome !== undefined && !String(patch.nome).trim()) {
    throw erroNegocio(400, "O nome nao pode ficar vazio.")
  }

  validarCamposDePasso(no.tipo, patch)

  const atualizado = await trilhaRepository.atualizar(id, patch)
  if (!atualizado) throw erroNegocio(400, "Nenhum campo valido para atualizar.")
  return atualizado
}

/** Remove o no e toda a sua subarvore. */
async function excluir(id, usuario) {
  await buscarComPermissao(id, usuario, "programa.trilha.excluir")
  await trilhaRepository.excluir(id)
}

/**
 * Reordena os filhos de um no.
 * Exige a lista COMPLETA de irmaos: reordenacao parcial deixaria buracos ou
 * duplicatas na coluna `ordem`.
 */
async function reordenarFilhos(idPai, ids, usuario) {
  await buscarComPermissao(idPai, usuario, "programa.trilha.editar")

  if (!Array.isArray(ids) || ids.length === 0) {
    throw erroNegocio(400, "Informe a lista de ids na nova ordem.")
  }

  const filhos = await trilhaRepository.listarFilhos(idPai)
  const atuais = filhos.map((f) => Number(f.id_no)).sort()
  const pedidos = ids.map(Number).sort()

  if (atuais.length !== pedidos.length || atuais.some((v, i) => v !== pedidos[i])) {
    throw erroNegocio(
      400,
      "A lista deve conter exatamente os filhos deste no, sem repetir nem omitir."
    )
  }

  return trilhaRepository.reordenar(idPai, ids.map(Number))
}

/** Move um no para outro pai. */
async function mover(id, novoPaiId, usuario) {
  const no = await buscarComPermissao(id, usuario, "programa.trilha.editar")

  if (novoPaiId == null) {
    throw erroNegocio(400, "Informe o no de destino.")
  }
  if (Number(novoPaiId) === Number(id)) {
    throw erroNegocio(400, "Um no nao pode ser pai de si mesmo.")
  }

  const destino = await trilhaRepository.buscarPorId(novoPaiId)
  if (!destino) throw erroNegocio(404, "No de destino nao encontrado.")

  if (TIPO_FILHO[destino.tipo] !== no.tipo) {
    throw erroNegocio(
      400,
      `Um ${no.tipo} nao pode ficar dentro de um ${destino.tipo}.`
    )
  }

  if (await ehDescendente(novoPaiId, id)) {
    throw erroNegocio(400, "Nao e possivel mover um no para dentro dele mesmo.")
  }

  return trilhaRepository.mover(id, novoPaiId)
}

/**
 * Um no e descendente de outro? Impede o ciclo de arrastar um pai para dentro
 * do proprio filho — o banco aceitaria, e a arvore viraria um anel orfao,
 * invisivel e impossivel de apagar pela UI.
 */
async function ehDescendente(idCandidato, idAncestral) {
  let atual = await trilhaRepository.buscarPorId(idCandidato)
  while (atual && atual.id_pai != null) {
    if (Number(atual.id_pai) === Number(idAncestral)) return true
    atual = await trilhaRepository.buscarPorId(atual.id_pai)
  }
  return false
}

// ---------------------------------------------------------------------------
// Vinculo com a Biblioteca
// ---------------------------------------------------------------------------

/** Lista os conteudos que um passo ensina. */
async function listarConteudos(idNo, usuario) {
  await exigirPasso(idNo, usuario, "programa.trilha.visualizar")
  return trilhaRepository.listarConteudos(idNo)
}

/** Vincula um conteudo da Biblioteca a um passo. */
async function vincularConteudo(idNo, idConteudo, usuario) {
  await exigirPasso(idNo, usuario, "programa.trilha.editar")
  if (!idConteudo) throw erroNegocio(400, "Informe o id_conteudo.")

  const vinculo = await trilhaRepository.vincularConteudo(idNo, idConteudo)
  // ON CONFLICT DO NOTHING devolve vazio quando ja existia — nao e erro.
  return vinculo ?? { id_no: Number(idNo), id_conteudo: Number(idConteudo), ja_vinculado: true }
}

/** Desvincula um conteudo (ele continua na Biblioteca). */
async function desvincularConteudo(idNo, idConteudo, usuario) {
  await exigirPasso(idNo, usuario, "programa.trilha.editar")
  const removido = await trilhaRepository.desvincularConteudo(idNo, idConteudo)
  if (!removido) throw erroNegocio(404, "Este conteudo nao esta vinculado ao passo.")
}

/** Conteudo so se pendura em PASSO — fase e modulo sao agrupadores. */
async function exigirPasso(idNo, usuario, chave) {
  const no = await buscarComPermissao(idNo, usuario, chave)
  if (no.tipo !== "PASSO") {
    throw erroNegocio(400, "Conteudo da Biblioteca so pode ser vinculado a um PASSO.")
  }
  return no
}

/**
 * Campos exclusivos de PASSO (tipo_passo, entregavel, prazo...) nao fazem
 * sentido em FASE ou MODULO. Recusar aqui evita dado morto no banco.
 */
function validarCamposDePasso(tipo, dados) {
  const exclusivos = [
    "tipoPasso", "permiteEntrega", "obrigatoria", "idQuestionario",
    "anexo", "prazo", "cargaHoraria", "entregavel",
    // Moldura pedagogica: descreve o que o incubado faz no passo, entao nao
    // cabe numa fase ou modulo, que sao agrupadores.
    "objetivo", "porque", "competencias", "area",
  ]

  if (tipo !== "PASSO") {
    const usado = exclusivos.find((c) => dados[c] !== undefined && dados[c] !== null)
    if (usado) {
      throw erroNegocio(400, `O campo "${usado}" so se aplica a um PASSO.`)
    }
    return
  }

  if (dados.tipoPasso !== undefined && dados.tipoPasso !== null
      && !TIPOS_PASSO.includes(dados.tipoPasso)) {
    throw erroNegocio(400, `tipo_passo invalido. Use: ${TIPOS_PASSO.join(", ")}.`)
  }

  if (dados.idQuestionario && dados.tipoPasso !== "QUESTIONARIO") {
    throw erroNegocio(400, "So um passo do tipo QUESTIONARIO aceita id_questionario.")
  }
}

// ---------------------------------------------------------------------------
// Trilhas do tenant e matricula de startups
// ---------------------------------------------------------------------------

/** Lista as trilhas (raizes) do tenant, com contagens para o seletor. */
async function listarProgramas(idTenant, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, "programa.trilha.visualizar")
  return trilhaRepository.listarProgramas(idTenant)
}

/** Carrega UMA trilha inteira. Usado pelo Construtor ao trocar de trilha. */
async function arvoreDoPrograma(idPrograma, usuario) {
  const raiz = await buscarComPermissao(idPrograma, usuario, "programa.trilha.visualizar")
  if (raiz.tipo !== "PROGRAMA") {
    throw erroNegocio(400, "Este id nao e a raiz de uma trilha.")
  }
  return trilhaRepository.arvorePorPrograma(idPrograma)
}

/**
 * Marca a trilha como padrao do tenant — a que vem pre-selecionada no
 * cadastro de startup. Trocar de padrao nao mexe em matricula nenhuma: quem
 * ja entrou continua onde estava.
 */
async function definirPadrao(idPrograma, usuario) {
  const raiz = await buscarComPermissao(idPrograma, usuario, "programa.trilha.editar")
  if (raiz.tipo !== "PROGRAMA") {
    throw erroNegocio(400, "So a raiz de uma trilha pode ser a padrao.")
  }
  return trilhaRepository.definirPadrao(raiz.id_tenant, idPrograma)
}

/** Startups matriculadas numa trilha. */
async function listarStartupsDoPrograma(idPrograma, usuario) {
  const raiz = await exigirPrograma(idPrograma, usuario, "programa.trilha.visualizar")
  return trilhaRepository.listarStartupsDoPrograma(raiz.id_no)
}

/**
 * Matricula uma startup na trilha.
 *
 * A permissao cobrada e a de EDITAR A TRILHA, nao a de editar a startup: quem
 * decide a composicao de uma turma e quem gere o programa. O trigger
 * trg_startup_programa_raiz ainda barra startup de outro tenant.
 */
async function matricular(idPrograma, idStartup, usuario) {
  const raiz = await exigirPrograma(idPrograma, usuario, "programa.trilha.editar")
  if (!idStartup) throw erroNegocio(400, "Informe o id_startup.")

  try {
    const m = await trilhaRepository.matricular(raiz.id_no, idStartup)
    // ON CONFLICT DO NOTHING devolve vazio quando ja existia — nao e erro.
    return m ?? { id_no: Number(raiz.id_no), id_startup: Number(idStartup), ja_matriculada: true }
  } catch (err) {
    // Mensagens do trigger: tenant cruzado ou no que nao e raiz.
    if (err.code === "P0001") throw erroNegocio(400, err.message)
    throw err
  }
}

/** Tira a startup da trilha. As entregas ja feitas continuam no banco. */
async function desmatricular(idPrograma, idStartup, usuario) {
  const raiz = await exigirPrograma(idPrograma, usuario, "programa.trilha.editar")
  const r = await trilhaRepository.desmatricular(raiz.id_no, idStartup)
  if (!r) throw erroNegocio(404, "Esta startup nao esta matriculada nesta trilha.")
}

const STATUS_MATRICULA = ["EM_ANDAMENTO", "CONCLUIDA"]

/** Marca a trilha como concluida (ou reabre) para uma startup. */
async function definirStatusMatricula(idPrograma, idStartup, status, usuario) {
  const raiz = await exigirPrograma(idPrograma, usuario, "programa.trilha.editar")
  if (!STATUS_MATRICULA.includes(status)) {
    throw erroNegocio(400, `Status invalido. Use: ${STATUS_MATRICULA.join(", ")}.`)
  }
  const r = await trilhaRepository.definirStatusMatricula(raiz.id_no, idStartup, status)
  if (!r) throw erroNegocio(404, "Esta startup nao esta matriculada nesta trilha.")
  return r
}

/** Carrega o no e exige que ele seja a raiz de uma trilha. */
async function exigirPrograma(idPrograma, usuario, chave) {
  const no = await buscarComPermissao(idPrograma, usuario, chave)
  if (no.tipo !== "PROGRAMA") {
    throw erroNegocio(400, "Esta operacao exige a raiz de uma trilha (PROGRAMA).")
  }
  return no
}

module.exports = {
  TIPOS,
  TIPO_FILHO,
  arvore,
  buscar,
  listarFilhos,
  criar,
  atualizar,
  excluir,
  reordenarFilhos,
  mover,
  listarConteudos,
  vincularConteudo,
  desvincularConteudo,
  listarProgramas,
  arvoreDoPrograma,
  definirPadrao,
  listarStartupsDoPrograma,
  matricular,
  desmatricular,
  definirStatusMatricula,
}
