/**
 * Service da Biblioteca (regra de negocio).
 *
 * A Biblioteca guarda o que a incubadora ENSINA. Cada tipo de conteudo exige
 * um corpo diferente (um LINK sem url e inutil; uma AULA vive dos blocos), e e
 * aqui que essa exigencia e verificada antes de chegar ao banco.
 */
const bibliotecaRepository = require("../repositories/bibliotecaRepository")
const rbacService = require("./rbacService")
const { erroNegocio } = require("../utils/erros")

const TIPOS = ["AULA", "VIDEO", "ARQUIVO", "TEMPLATE", "LINK"]

const TIPOS_BLOCO = [
  "h1", "h2", "paragrafo", "lista", "callout", "video", "arquivo", "divisor",
]

// Tipos cujo conteudo E o link: sem url nao ha o que entregar ao incubado.
const EXIGEM_URL = ["LINK", "VIDEO"]

// Logo do conteudo: data URL base64 (o front reduz a imagem antes de enviar)
// ou link http(s) de uma imagem ja hospedada. O teto acompanha o da foto de
// perfil e cabe no limite de corpo do express (server.js: 4mb).
const LOGO_MAX_BYTES = 2 * 1024 * 1024 // 2MB
const LOGO_DATA_URL = /^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,/
const LOGO_HTTP = /^https?:\/\//

// ---------------------------------------------------------------------------
// Autorizacao: quem tem a chave, como na trilha. O tenant das operacoes sobre
// um conteudo existente sai do PROPRIO conteudo — nunca de um id_tenant vindo
// do cliente, que permitiria checar permissao contra uma incubadora e escrever
// em outra.
// ---------------------------------------------------------------------------

/** Busca sem checar nada — primitiva interna (ver trilhaService.buscarNo). */
async function buscarConteudo(id) {
  const conteudo = await bibliotecaRepository.buscarPorId(id)
  if (!conteudo) throw erroNegocio(404, "Conteudo nao encontrado.")
  return conteudo
}

/** Carrega o conteudo e exige a permissao no tenant DELE. */
async function buscarComPermissao(id, usuario, chave) {
  const conteudo = await buscarConteudo(id)
  await rbacService.garantirPermissao(conteudo.id_tenant, usuario, chave)
  return conteudo
}

/** Lista os conteudos de um tenant, com filtros opcionais. */
async function listar(idTenant, filtros = {}, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, "programa.biblioteca.visualizar")

  if (filtros.tipo && !TIPOS.includes(filtros.tipo)) {
    throw erroNegocio(400, `Tipo invalido. Use: ${TIPOS.join(", ")}.`)
  }

  const [conteudos, contagem] = await Promise.all([
    bibliotecaRepository.listarPorTenant(idTenant, filtros),
    bibliotecaRepository.contarPorTipo(idTenant),
  ])

  return { conteudos, contagem }
}

/** Busca um conteudo (com blocos e usos). */
async function buscar(id, usuario) {
  return buscarComPermissao(id, usuario, "programa.biblioteca.visualizar")
}

/** Cria um conteudo. */
async function criar(dados, usuario) {
  const { idTenant, tipo, titulo } = dados

  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, "programa.biblioteca.criar")
  if (!tipo || !TIPOS.includes(tipo)) {
    throw erroNegocio(400, `Informe um tipo valido: ${TIPOS.join(", ")}.`)
  }
  if (!titulo || !titulo.trim()) throw erroNegocio(400, "Informe o titulo.")

  validarCorpo(tipo, dados)
  if (dados.blocos !== undefined) validarBlocos(tipo, dados.blocos)
  if (dados.tags !== undefined) validarTags(dados.tags)
  if (dados.logoUrl !== undefined) validarLogo(dados.logoUrl)

  return bibliotecaRepository.criar({ ...dados, titulo: titulo.trim() })
}

/** Aplica um patch parcial ao conteudo. */
async function atualizar(id, patch, usuario) {
  const atual = await buscarComPermissao(id, usuario, "programa.biblioteca.editar")

  if (patch.titulo !== undefined && !String(patch.titulo).trim()) {
    throw erroNegocio(400, "O titulo nao pode ficar vazio.")
  }

  // A validacao de corpo considera o estado resultante do merge: trocar so a
  // url de um LINK nao pode passar batido por o patch nao trazer o tipo.
  validarCorpo(atual.tipo, { ...atual, ...patch })

  if (patch.blocos !== undefined) validarBlocos(atual.tipo, patch.blocos)
  if (patch.tags !== undefined) validarTags(patch.tags)
  if (patch.logoUrl !== undefined) validarLogo(patch.logoUrl)

  const atualizado = await bibliotecaRepository.atualizar(id, patch)
  if (!atualizado) throw erroNegocio(404, "Conteudo nao encontrado.")
  return atualizado
}

/** Duplica um conteudo (a copia nasce sem vinculos com a trilha). */
async function duplicar(id, usuario) {
  // Duplicar cria um conteudo novo, entao a chave e "criar" — nao "editar":
  // quem so pode editar o que ja existe nao deveria povoar a biblioteca.
  await buscarComPermissao(id, usuario, "programa.biblioteca.criar")
  return bibliotecaRepository.duplicar(id)
}

/**
 * Exclui um conteudo.
 * Recusa se ele estiver em uso: apagar em silencio deixaria passos da trilha
 * sem o material que prometem ensinar.
 */
async function excluir(id, usuario) {
  await buscarComPermissao(id, usuario, "programa.biblioteca.excluir")

  const usos = await bibliotecaRepository.contarUsos(id)
  if (usos > 0) {
    throw erroNegocio(
      409,
      `Este conteudo e usado em ${usos} passo(s) da trilha. ` +
      "Desvincule-o antes de excluir."
    )
  }

  await bibliotecaRepository.excluir(id)
}

/** Cada tipo tem um corpo minimo sem o qual o conteudo nao serve. */
function validarCorpo(tipo, dados) {
  if (EXIGEM_URL.includes(tipo)) {
    const url = dados.url
    if (!url || !String(url).trim()) {
      throw erroNegocio(400, `Um conteudo do tipo ${tipo} precisa de uma url.`)
    }
  }
}

/** Blocos so existem em AULA, e cada um precisa de um tipo conhecido. */
function validarBlocos(tipo, blocos) {
  if (tipo !== "AULA") {
    throw erroNegocio(400, "Apenas conteudos do tipo AULA possuem blocos.")
  }
  if (!Array.isArray(blocos)) {
    throw erroNegocio(400, "blocos deve ser uma lista.")
  }

  for (const [i, b] of blocos.entries()) {
    if (!b || !TIPOS_BLOCO.includes(b.tipo)) {
      throw erroNegocio(
        400,
        `Bloco ${i + 1}: tipo invalido. Use: ${TIPOS_BLOCO.join(", ")}.`
      )
    }
  }
}

function validarTags(tags) {
  if (!Array.isArray(tags) || tags.some((t) => typeof t !== "string")) {
    throw erroNegocio(400, "tags deve ser uma lista de textos.")
  }
}

/**
 * O logo e opcional: null/"" limpa e o card volta ao icone do tipo. Quando vem
 * preenchido, so passa imagem — aceitar texto arbitrario aqui viraria um campo
 * de src injetado direto no <img> da tela.
 */
function validarLogo(logo) {
  if (logo === null || logo === "") return

  if (typeof logo !== "string" || (!LOGO_DATA_URL.test(logo) && !LOGO_HTTP.test(logo))) {
    throw erroNegocio(
      400,
      "O logo deve ser uma imagem (png, jpg, webp, gif ou svg) ou um link http(s)."
    )
  }
  if (logo.length > LOGO_MAX_BYTES) {
    throw erroNegocio(400, "A imagem do logo deve ter no maximo 2MB.")
  }
}

module.exports = {
  TIPOS,
  TIPOS_BLOCO,
  listar,
  buscar,
  criar,
  atualizar,
  duplicar,
  excluir,
}
