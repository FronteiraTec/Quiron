/**
 * Service de Arquivos (regra de negocio + acesso ao disco).
 *
 * Unico lugar do sistema que fala com o sistema de arquivos. Os bytes ficam em
 * UPLOAD_DIR (volume `uploads` do container); o banco guarda so o registro.
 * Trocar isso por S3 um dia mexe aqui e em mais lugar nenhum.
 *
 * DUAS VISIBILIDADES, e a diferenca nao e capricho:
 *
 *   PRIVADO  anexo de entrega — trabalho confidencial de uma startup. Sai pela
 *            API, com token e permissao.
 *   PUBLICO  imagem de interface (logo, avatar). Sai sem token, porque
 *            <img src> do navegador NAO envia cabecalho Authorization: exigir
 *            token deixaria toda imagem quebrada na tela. A protecao e o nome
 *            de armazenamento ser aleatorio. Vazar um logo nao e incidente;
 *            vazar o plano de negocio de uma startup e — por isso os dois
 *            regimes.
 */
const fs = require("fs/promises")
const fsSync = require("fs")
const path = require("path")
const crypto = require("crypto")

const arquivoRepository = require("../repositories/arquivoRepository")
const rbacService = require("./rbacService")
const tenantRepository = require("../repositories/tenantRepository")
const { erroNegocio } = require("../utils/erros")

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, "../../uploads")

// Tetos por regime. Documento de entrega e maior que imagem de interface de
// proposito: um PDF de plano de negocio passa de 2MB com facilidade, um avatar
// nao tem por que passar.
const MAX_PRIVADO = 15 * 1024 * 1024 // 15MB
const MAX_PUBLICO = 2 * 1024 * 1024 // 2MB

// Lista de permitidos, nao de proibidos: o que nao esta aqui e recusado. Uma
// lista de proibidos sempre esquece um formato novo.
const MIMES_IMAGEM = ["image/png", "image/jpeg", "image/webp", "image/gif"]
const MIMES_DOCUMENTO = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
]

// SVG fica FORA da lista de imagens de proposito. Ele e XML e pode carregar
// <script>; servido da mesma origem do app, um SVG enviado por um usuario vira
// XSS contra os outros. O ganho visual nao paga.
const MIMES_PUBLICO = MIMES_IMAGEM
const MIMES_PRIVADO = [...MIMES_IMAGEM, ...MIMES_DOCUMENTO]

// Abrir no navegador so o que o navegador renderiza sem executar. O resto
// baixa. HTML nunca entra na lista (ver o comentario do SVG acima).
const EXIBIVEIS_INLINE = [...MIMES_IMAGEM, "application/pdf", "text/plain"]

/** Garante que o diretorio existe. Roda na subida da API. */
function prepararDiretorio() {
  fsSync.mkdirSync(UPLOAD_DIR, { recursive: true })
  return UPLOAD_DIR
}

function limiteDe(visibilidade) {
  return visibilidade === "PUBLICO" ? MAX_PUBLICO : MAX_PRIVADO
}

function mimesDe(visibilidade) {
  return visibilidade === "PUBLICO" ? MIMES_PUBLICO : MIMES_PRIVADO
}

/**
 * Caminho absoluto de um arquivo armazenado.
 *
 * Resolve e CONFERE que o resultado continua dentro de UPLOAD_DIR. O nome vem
 * do banco e foi gerado por nos, entao hoje nao ha como escapar — a checagem
 * existe para que isso continue verdade se um dia alguem passar a aceitar nome
 * vindo de fora.
 */
function caminhoDe(nomeArmazenado) {
  const completo = path.resolve(UPLOAD_DIR, nomeArmazenado)
  const raiz = path.resolve(UPLOAD_DIR)
  if (completo !== raiz && !completo.startsWith(raiz + path.sep)) {
    throw erroNegocio(400, "Caminho de arquivo invalido.")
  }
  return completo
}

/**
 * Grava um arquivo enviado e registra no banco.
 *
 * @param {{buffer: Buffer, originalname: string, mimetype: string, size: number}} upload
 * @param {{idTenant: number, visibilidade: string}} opcoes
 * @param {{id: number}} usuario
 */
async function salvar(upload, { idTenant, visibilidade = "PRIVADO" }, usuario) {
  if (!upload) throw erroNegocio(400, "Nenhum arquivo enviado.")
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  if (!["PUBLICO", "PRIVADO"].includes(visibilidade)) {
    throw erroNegocio(400, "Visibilidade invalida. Use PUBLICO ou PRIVADO.")
  }

  // Quem envia precisa pertencer a incubadora — senao qualquer autenticado
  // encheria o disco de um tenant alheio.
  if (!usuario?.root) {
    const papel = await tenantRepository.buscarPapel(idTenant, usuario?.id)
    if (!papel) throw erroNegocio(403, "Voce nao pertence a esta incubadora.")
  }

  const permitidos = mimesDe(visibilidade)
  if (!permitidos.includes(upload.mimetype)) {
    throw erroNegocio(400, `Tipo de arquivo nao aceito (${upload.mimetype}).`)
  }

  const teto = limiteDe(visibilidade)
  if (upload.size > teto) {
    throw erroNegocio(413, `Arquivo acima do limite de ${Math.round(teto / 1024 / 1024)}MB.`)
  }
  if (!upload.size) throw erroNegocio(400, "Arquivo vazio.")

  // O nome no disco e sorteado, nunca o que veio do cliente: dois
  // "contrato.pdf" colidiriam, e um nome como "../../x" viraria caminho. A
  // extensao original e preservada so por conveniencia de inspecao manual.
  const extensao = path.extname(upload.originalname || "").slice(0, 10).replace(/[^.\w]/g, "")
  const nomeArmazenado = `${crypto.randomUUID()}${extensao}`

  prepararDiretorio()
  await fs.writeFile(caminhoDe(nomeArmazenado), upload.buffer)

  try {
    return await arquivoRepository.criar({
      idTenant,
      enviadoPor: usuario.id,
      nomeOriginal: (upload.originalname || "arquivo").slice(0, 255),
      nomeArmazenado,
      mime: upload.mimetype,
      tamanho: upload.size,
      visibilidade,
    })
  } catch (err) {
    // O registro falhou depois do byte no disco: remove o orfao, senao o
    // volume acumula arquivo que ninguem consegue mais referenciar.
    await fs.unlink(caminhoDe(nomeArmazenado)).catch(() => {})
    throw err
  }
}

/**
 * Carrega um arquivo para download, aplicando a autorizacao do regime.
 *
 * PUBLICO sai direto. PRIVADO exige token e, alem disso, uma de duas coisas:
 * ser quem enviou (a pessoa sempre alcanca o proprio arquivo) ou ter a chave
 * `avaliacoes.entregas.baixar` naquela incubadora — que e o mentor avaliando.
 *
 * LIMITE CONHECIDO: a checagem e por TENANT, nao por startup. Um mentor com a
 * chave que descobrisse o UUID de um anexo de startup que ele nao acompanha
 * conseguiria abri-lo. Fechar isso exige ligar o arquivo a entrega, o que hoje
 * nao da para fazer no upload (o anexo sobe ANTES de a entrega existir) —
 * teria de ser amarrado no envio. Fica registrado como o proximo aperto.
 *
 * @param {string} idArquivo
 * @param {{id:number, root?:boolean}|null} usuario - null quando nao autenticado.
 */
async function abrir(idArquivo, usuario) {
  const arquivo = await arquivoRepository.buscarPorId(idArquivo)
  if (!arquivo) throw erroNegocio(404, "Arquivo nao encontrado.")

  if (arquivo.visibilidade === "PRIVADO") {
    if (!usuario) throw erroNegocio(401, "Autenticacao necessaria.")
    const ehDono = Number(arquivo.enviado_por) === Number(usuario.id)
    if (!ehDono && !usuario.root) {
      await rbacService.garantirPermissao(
        arquivo.id_tenant,
        usuario,
        "avaliacoes.entregas.baixar"
      )
    }
  }

  const caminho = caminhoDe(arquivo.nome_armazenado)
  try {
    await fs.access(caminho)
  } catch {
    // Registro sem bytes: volume recriado sem o dado, ou remocao manual.
    throw erroNegocio(410, "O conteudo deste arquivo nao esta mais disponivel.")
  }

  return {
    caminho,
    nomeOriginal: arquivo.nome_original,
    mime: arquivo.mime,
    tamanho: arquivo.tamanho,
    // Abrir na aba x baixar: so entra inline o que o navegador desenha sem
    // executar nada.
    inline: EXIBIVEIS_INLINE.includes(arquivo.mime),
  }
}

module.exports = {
  salvar,
  abrir,
  prepararDiretorio,
  UPLOAD_DIR,
  MAX_PRIVADO,
  MAX_PUBLICO,
}
