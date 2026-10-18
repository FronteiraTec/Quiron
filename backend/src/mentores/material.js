/**
 * O Espaco do Mentor: o vocabulario e a normalizacao do que chega dos
 * formularios (migracao 020).
 *
 * TIPO do material e FINALIDADE do compartilhamento sao listas FECHADAS — CHECK
 * no banco — porque ha codigo atras delas: o tipo decide se ha bytes a servir
 * (ARQUIVO) ou um endereco a abrir (LINK); a finalidade decide onde a Jornada
 * mostra o material (como apoio de uma atividade, ou como consulta).
 *
 * CATEGORIA e o oposto: texto livre, como as especialidades do mentor
 * (perfil.js). Nao ha codigo atras de "Modelo" ou "Leitura" — o que este
 * arquivo faz com ela e so higiene.
 *
 * Funcoes puras: nada aqui consulta o banco. O que depende dele (o arquivo e
 * mesmo de quem envia? a etapa e mesmo daquela trilha?) e do service.
 */
const { erroNegocio } = require("../utils/erros")

const TIPOS = ["ARQUIVO", "LINK"]
const FINALIDADES = ["REFERENCIA", "ATIVIDADE"]
const FINALIDADE_PADRAO = "REFERENCIA"

// Os tetos sao os das colunas (VARCHAR) ou, nos campos TEXT, o que separa um
// texto de um documento colado no campo errado.
const MAX_TITULO = 200
const MAX_CATEGORIA = 60
const MAX_DESCRICAO = 4000
const MAX_ORIENTACAO = 2000
const MAX_URL = 2000

// Link de material: so http(s). `javascript:` ou `data:` num <a href> rodariam
// o que quisessem na origem do Quiron, para quem clicasse.
const URL_HTTP = /^https?:\/\/\S+$/i

// O id de `arquivo` e UUID. Conferir o formato aqui transforma um id malformado
// em 400 legivel, e nao no erro de sintaxe do Postgres (22P02) virando 500.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Texto opcional: "" e "   " valem o mesmo que nao preencher. */
function texto(valor, max) {
  if (valor === null || valor === undefined) return null
  const limpo = String(valor).trim()
  if (!limpo) return null
  return limpo.slice(0, max)
}

function titulo(valor) {
  const limpo = texto(valor, MAX_TITULO)
  if (!limpo) throw erroNegocio(400, "Informe o titulo do material.")
  return limpo
}

/**
 * A categoria como ela deve ser gravada: espacos repetidos viram um, para que
 * "Modelo  de pitch" e "Modelo de pitch" nao virem dois filtros na tela.
 */
function categoria(valor) {
  const limpo = texto(valor, MAX_CATEGORIA)
  return limpo ? limpo.replace(/\s+/g, " ") : null
}

function url(valor) {
  const limpo = texto(valor, MAX_URL + 1)
  if (!limpo) throw erroNegocio(400, "Informe o endereco do link.")
  if (limpo.length > MAX_URL) throw erroNegocio(400, "O endereco do link e longo demais.")
  if (!URL_HTTP.test(limpo)) {
    throw erroNegocio(400, "O link precisa comecar com http:// ou https://.")
  }
  return limpo
}

/** Minusculo, como o Postgres devolve: e o que permite comparar com o atual. */
function idArquivo(valor) {
  const limpo = String(valor ?? "").trim().toLowerCase()
  if (!limpo) throw erroNegocio(400, "Envie o arquivo do material.")
  if (!UUID.test(limpo)) throw erroNegocio(400, "Arquivo invalido.")
  return limpo
}

function tipo(valor) {
  const limpo = String(valor ?? "").trim().toUpperCase()
  if (!TIPOS.includes(limpo)) {
    throw erroNegocio(400, `Tipo de material invalido. Use: ${TIPOS.join(", ")}.`)
  }
  return limpo
}

/** Inteiro positivo, ou o erro com o nome do campo. */
function inteiro(valor, rotulo) {
  const numero = Number(valor)
  if (!Number.isInteger(numero) || numero <= 0) {
    throw erroNegocio(400, `Informe ${rotulo}.`)
  }
  return numero
}

/**
 * O corpo de um material NOVO, ja no formato do repositorio.
 *
 * O tipo decide o corpo: ARQUIVO vem com o id do arquivo ja enviado por
 * POST /arquivos (o mesmo caminho de upload de todo o sistema); LINK vem com o
 * endereco. O campo do outro tipo e descartado, e nao recusado: o formulario
 * pode ter guardado os dois enquanto a pessoa alternava a opcao.
 */
function normalizarMaterial(corpo = {}) {
  const t = tipo(corpo.tipo)
  return {
    titulo: titulo(corpo.titulo),
    descricao: texto(corpo.descricao, MAX_DESCRICAO),
    categoria: categoria(corpo.categoria),
    tipo: t,
    idArquivo: t === "ARQUIVO" ? idArquivo(corpo.id_arquivo) : null,
    url: t === "LINK" ? url(corpo.url) : null,
  }
}

/**
 * O patch de um material que JA EXISTE, aplicado sobre o estado atual.
 *
 * Campo ausente (undefined) fica como esta; null ou "" limpa o que e opcional.
 * Devolve o estado FINAL inteiro, e nao so o que mudou, porque a regra do corpo
 * (ARQUIVO tem arquivo, LINK tem url) vale para o resultado do merge: trocar o
 * tipo sem mandar o corpo novo tem de falhar aqui, e nao no CHECK do banco.
 *
 * @param {object} atual - linha de mentor_material.
 * @param {object} corpo - o que veio no PATCH.
 */
function normalizarPatchMaterial(atual, corpo = {}) {
  const final = {
    titulo: corpo.titulo !== undefined ? titulo(corpo.titulo) : atual.titulo,
    descricao:
      corpo.descricao !== undefined ? texto(corpo.descricao, MAX_DESCRICAO) : atual.descricao,
    categoria: corpo.categoria !== undefined ? categoria(corpo.categoria) : atual.categoria,
    tipo: corpo.tipo !== undefined ? tipo(corpo.tipo) : atual.tipo,
  }

  if (final.tipo === "ARQUIVO") {
    const veio = corpo.id_arquivo !== undefined && corpo.id_arquivo !== null && corpo.id_arquivo !== ""
    final.idArquivo = veio ? idArquivo(corpo.id_arquivo) : atual.id_arquivo
    if (!final.idArquivo) throw erroNegocio(400, "Envie o arquivo do material.")
    final.url = null
  } else {
    const veio = corpo.url !== undefined && corpo.url !== null && corpo.url !== ""
    final.url = veio ? url(corpo.url) : atual.url
    if (!final.url) throw erroNegocio(400, "Informe o endereco do link.")
    final.idArquivo = null
  }

  if (corpo.arquivado !== undefined) final.arquivado = Boolean(corpo.arquivado)
  return final
}

function finalidade(valor) {
  if (valor === null || valor === undefined || valor === "") return FINALIDADE_PADRAO
  const limpo = String(valor).trim().toUpperCase()
  if (!FINALIDADES.includes(limpo)) {
    throw erroNegocio(400, `Finalidade invalida. Use: ${FINALIDADES.join(", ")}.`)
  }
  return limpo
}

function orientacao(valor) {
  const limpo = texto(valor, MAX_ORIENTACAO + 1)
  if (limpo && limpo.length > MAX_ORIENTACAO) {
    throw erroNegocio(400, `A orientacao pode ter no maximo ${MAX_ORIENTACAO} caracteres.`)
  }
  return limpo
}

/**
 * O corpo de um compartilhamento NOVO.
 *
 * A ORIGEM e exatamente uma: material pessoal OU conteudo da Biblioteca. Os
 * dois juntos seria um vinculo que aponta para dois lugares; nenhum, um
 * vinculo que aponta para nada.
 *
 * Atividade pede etapa — o PASSO. Se a etapa escolhida e mesmo um passo, quem
 * confere e o service, que enxerga a trilha.
 */
function normalizarCompartilhamento(corpo = {}) {
  const temMaterial = corpo.id_material !== undefined && corpo.id_material !== null && corpo.id_material !== ""
  const temConteudo = corpo.id_conteudo !== undefined && corpo.id_conteudo !== null && corpo.id_conteudo !== ""
  if (temMaterial === temConteudo) {
    throw erroNegocio(400, "Escolha um material: da sua biblioteca ou da biblioteca da incubadora.")
  }

  const temEtapa = corpo.id_no !== undefined && corpo.id_no !== null && corpo.id_no !== ""
  const dados = {
    idStartup: inteiro(corpo.id_startup, "a startup"),
    idPrograma: inteiro(corpo.id_programa, "a trilha"),
    idNo: temEtapa ? inteiro(corpo.id_no, "a etapa") : null,
    idMaterial: temMaterial ? inteiro(corpo.id_material, "o material") : null,
    idConteudo: temConteudo ? inteiro(corpo.id_conteudo, "o conteudo") : null,
    finalidade: finalidade(corpo.finalidade),
    orientacao: orientacao(corpo.orientacao),
  }

  if (dados.finalidade === "ATIVIDADE" && !dados.idNo) {
    throw erroNegocio(400, "Para associar o material a uma atividade, escolha o passo da trilha.")
  }
  return dados
}

/** O que o PATCH de um compartilhamento pode mudar: a orientacao e a finalidade. */
function normalizarPatchCompartilhamento(atual, corpo = {}) {
  return {
    orientacao: corpo.orientacao !== undefined ? orientacao(corpo.orientacao) : atual.orientacao,
    finalidade: corpo.finalidade !== undefined ? finalidade(corpo.finalidade) : atual.finalidade,
  }
}

module.exports = {
  TIPOS,
  FINALIDADES,
  FINALIDADE_PADRAO,
  MAX_TITULO,
  MAX_CATEGORIA,
  MAX_DESCRICAO,
  MAX_ORIENTACAO,
  normalizarMaterial,
  normalizarPatchMaterial,
  normalizarCompartilhamento,
  normalizarPatchCompartilhamento,
}
