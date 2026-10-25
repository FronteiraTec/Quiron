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
const conversorPdf = require("../utils/conversorPdf")
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

// O que o navegador nao desenha e o conversor transforma em PDF (ver
// utils/conversorPdf.js), com a extensao pela qual o LibreOffice escolhe o
// leitor — o nome no disco pode ter vindo sem extensao nenhuma.
const CONVERSIVEIS_PDF = {
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
  "application/vnd.ms-powerpoint": ".ppt",
  "application/msword": ".doc",
}

// O PDF convertido fica guardado ao lado dos originais, em UPLOAD_DIR/previas.
// O arquivo nunca muda (uma versao nova e outro id_arquivo), entao converter
// uma vez basta; e, se a pasta sumir, a proxima abertura converte de novo.
const DIR_PREVIAS = "previas"

// Uma conversao por arquivo: a turma inteira abrindo o mesmo passo ao mesmo
// tempo espera UMA conversao, e nao enfileira trinta iguais no conversor.
const conversoesEmAndamento = new Map()

/**
 * Garante que o diretorio existe E que da para escrever nele. Roda na subida.
 *
 * A checagem de ESCRITA nao e preciosismo. `mkdirSync` num diretorio que JA
 * EXISTE devolve sucesso mesmo sem permissao de escrita — entao o boot passava
 * limpo e a falha so aparecia depois, um upload por vez, como 500 com EACCES
 * enterrado no log. Foi exatamente o que aconteceu com o volume de uploads
 * criado antes do QRN-19, quando o container ainda rodava como root: o volume
 * ficou `root:root`, a API passou a rodar como `node`, e todo envio de arquivo
 * parou de funcionar sem que nada na subida reclamasse.
 *
 * A sonda abaixo transforma isso num erro nomeado, na primeira linha do log.
 */
function prepararDiretorio() {
  fsSync.mkdirSync(UPLOAD_DIR, { recursive: true })

  const sonda = path.join(UPLOAD_DIR, `.escrita-${process.pid}`)
  try {
    fsSync.writeFileSync(sonda, "")
    fsSync.unlinkSync(sonda)
  } catch (err) {
    throw new Error(
      `Sem permissao de escrita em ${UPLOAD_DIR} (${err.code}). ` +
        "TODO upload vai falhar: logo de conteudo, anexo de entrega, imagem de aula. " +
        "O dono do volume precisa ser o usuario que roda a API (node, uid 1000) — " +
        'e o que o servico "permissoes" do docker-compose.yml acerta a cada subida.'
    )
  }

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
 * Carrega um arquivo para servir, SEM autorizar nada.
 *
 * Separada de `abrir` porque a autorizacao de um arquivo privado depende do
 * MODULO que o referencia, e nao ha uma regra so que sirva para todos: anexo de
 * entrega se autoriza por `avaliacoes.entregas.baixar` (ver `abrir`), anexo de
 * tarefa se autoriza por quem enxerga aquela tarefa (ver
 * tarefaService.abrirAnexo). Um `if` por modulo aqui dentro faria este arquivo
 * — o unico que fala com o disco — precisar conhecer as regras de todos eles.
 *
 * QUEM CHAMA ESTA FUNCAO E RESPONSAVEL PELA AUTORIZACAO. Ela nao e exposta em
 * rota nenhuma: quem a usa e sempre um service que ja disse "sim" antes.
 *
 * @param {string} idArquivo
 * @param {{idTenant?: number}} [esperado] - quando informado, confere que o
 *   arquivo e mesmo daquela incubadora. Defesa em profundidade: o vinculo que
 *   autorizou ja implica o tenant, e isto e o que garante que continue assim se
 *   alguem quebrar o vinculo depois.
 */
async function carregar(idArquivo, { idTenant } = {}) {
  const arquivo = await arquivoRepository.buscarPorId(idArquivo)
  if (!arquivo) throw erroNegocio(404, "Arquivo nao encontrado.")
  if (idTenant && Number(arquivo.id_tenant) !== Number(idTenant)) {
    throw erroNegocio(404, "Arquivo nao encontrado.")
  }

  const caminho = caminhoDe(arquivo.nome_armazenado)
  try {
    await fs.access(caminho)
  } catch {
    // Registro sem bytes: volume recriado sem o dado, ou remocao manual.
    throw erroNegocio(410, "O conteudo deste arquivo nao esta mais disponivel.")
  }

  return {
    idArquivo: arquivo.id_arquivo,
    caminho,
    nomeOriginal: arquivo.nome_original,
    mime: arquivo.mime,
    tamanho: arquivo.tamanho,
    // Abrir na aba x baixar: so entra inline o que o navegador desenha sem
    // executar nada.
    inline: EXIBIVEIS_INLINE.includes(arquivo.mime),
  }
}

/**
 * Carrega um arquivo para download, aplicando a autorizacao do regime.
 *
 * E a rota GENERICA (GET /arquivos/:id). PUBLICO sai direto. PRIVADO exige
 * token e, alem disso, uma de duas coisas: ser quem enviou (a pessoa sempre
 * alcanca o proprio arquivo) ou ter a chave `avaliacoes.entregas.baixar`
 * naquela incubadora — que e o mentor avaliando.
 *
 * LIMITE CONHECIDO: a checagem e por TENANT, nao por startup. Um mentor com a
 * chave que descobrisse o UUID de um anexo de startup que ele nao acompanha
 * conseguiria abri-lo. Fechar isso exige ligar o arquivo a entrega, o que hoje
 * nao da para fazer no upload (o anexo sobe ANTES de a entrega existir) —
 * teria de ser amarrado no envio. Fica registrado como o proximo aperto.
 *
 * O anexo de TAREFA nao passa por aqui, e e o desenho que este limite pede: ele
 * tem rota propria (GET /tarefas/:id/anexos/:idArquivo), autorizada pelo
 * vinculo em `tarefa_anexo` — saber o UUID nao basta, e preciso enxergar a
 * tarefa em que ele esta.
 *
 * O arquivo de um material do ESPACO DO MENTOR tambem nao, e aqui ele e
 * recusado a quem nao o enviou — mesmo com a chave de entregas. A chave e do
 * mentor avaliando entrega, e quem pode ler esses materiais e decidido pelo
 * material: a biblioteca pessoal e privada para os outros mentores (migracao
 * 020), e o material que a incubadora publica para os mentores segue a chave
 * dele e sai de vista quando arquivado (migracao 021). Esse arquivo abre pelo
 * material (GET /espaco-mentor/materiais/:id/arquivo e
 * /espaco-mentor/incubadora/:id/arquivo) ou pelo compartilhamento
 * (GET /jornada/materiais/:id/arquivo, quem tem vinculo com a startup que o
 * recebeu).
 *
 * O arquivo de um MATERIAL/TEMPLATE da Biblioteca segue o caminho oposto:
 * passa por aqui, mas com `programa.biblioteca.visualizar` no lugar da chave
 * de entregas — e o que o incubado tem para ler o que a trilha ensina.
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
      if (await arquivoRepository.ehDoEspacoMentor(idArquivo)) {
        throw erroNegocio(403, "Este arquivo so pode ser aberto pelo material a que pertence.")
      }
      // O arquivo de um MATERIAL/TEMPLATE da Biblioteca e o que a incubadora
      // ensina: abre para quem pode ver a Biblioteca — o incubado, na Jornada,
      // nao tem a chave de entregas. Apontar um conteudo para o anexo de uma
      // startup nao abre essa porta: a Biblioteca so aceita, como corpo, um
      // arquivo enviado por quem esta editando (bibliotecaService).
      const chave = (await arquivoRepository.ehDaBiblioteca(idArquivo, arquivo.id_tenant))
        ? "programa.biblioteca.visualizar"
        : "avaliacoes.entregas.baixar"
      await rbacService.garantirPermissao(arquivo.id_tenant, usuario, chave)
    }
  }

  return carregar(idArquivo)
}

/**
 * O arquivo em PDF, para desenhar na pagina: o proprio, se ja for PDF; senao,
 * a versao convertida (apresentacao, .doc), gerada na primeira abertura e
 * guardada para as seguintes.
 *
 * A autorizacao e a de `abrir`, inteira: quem nao abre o original nao abre o
 * PDF dele. O PDF convertido nunca tem registro proprio nem rota propria —
 * so sai por aqui, atras do mesmo portao.
 *
 * @param {string} idArquivo
 * @param {{id:number, root?:boolean}|null} usuario
 */
async function abrirComoPdf(idArquivo, usuario) {
  const original = await abrir(idArquivo, usuario)
  if (original.mime === "application/pdf") return original

  const extensao = CONVERSIVEIS_PDF[original.mime]
  if (!extensao) throw erroNegocio(415, "Este tipo de arquivo nao tem versao em PDF.")

  const caminho = caminhoDaPrevia(original.idArquivo)
  if (!(await existe(caminho))) await gerarPdf(original, extensao, caminho)

  const { size } = await fs.stat(caminho)
  return {
    idArquivo: original.idArquivo,
    caminho,
    nomeOriginal: `${path.parse(original.nomeOriginal).name}.pdf`,
    mime: "application/pdf",
    tamanho: size,
    inline: true,
  }
}

function caminhoDaPrevia(idArquivo) {
  return caminhoDe(path.join(DIR_PREVIAS, `${idArquivo}.pdf`))
}

async function existe(caminho) {
  try {
    await fs.access(caminho)
    return true
  } catch {
    return false
  }
}

function gerarPdf(original, extensao, destino) {
  let pendente = conversoesEmAndamento.get(original.idArquivo)
  if (!pendente) {
    pendente = (async () => {
      const bytes = await fs.readFile(original.caminho)
      const pdf = await conversorPdf.paraPdf(bytes, `documento${extensao}`)
      await fs.mkdir(path.dirname(destino), { recursive: true })
      // Grava ao lado e renomeia: quem chegar no meio nunca le meio PDF.
      const parcial = `${destino}.${crypto.randomUUID()}.parcial`
      await fs.writeFile(parcial, pdf)
      await fs.rename(parcial, destino)
    })().finally(() => conversoesEmAndamento.delete(original.idArquivo))
    conversoesEmAndamento.set(original.idArquivo, pendente)
  }
  return pendente
}

/**
 * Apaga um arquivo: o registro e os bytes.
 *
 * SO APAGA O QUE NINGUEM MAIS REFERENCIA. Desanexar de uma tarefa nao apaga o
 * arquivo, porque ele pode estar em outro lugar — e e aqui que "outro lugar" e
 * conferido, pelas FKs que apontam para `arquivo`. Havendo vinculo, nao faz
 * nada e responde false: quem chamou continua certo de que o SEU vinculo saiu.
 *
 * Quem chama e o modulo que era dono do arquivo (hoje, o material da biblioteca
 * pessoal do mentor, ao ser excluido ou ter o arquivo trocado). A rota publica
 * de arquivos nao expoe exclusao.
 *
 * Os bytes saem DEPOIS do registro: se o disco falhar, sobra um arquivo sem
 * registro — inacessivel e inofensivo —, e nunca um registro apontando para
 * bytes que sumiram.
 *
 * @param {string} idArquivo
 * @returns {Promise<boolean>} se o arquivo foi de fato apagado.
 */
async function remover(idArquivo) {
  if (!idArquivo) return false
  if ((await arquivoRepository.contarReferencias(idArquivo)) > 0) return false

  const removido = await arquivoRepository.excluir(idArquivo)
  if (!removido) return false

  await fs.unlink(caminhoDe(removido.nome_armazenado)).catch((err) => {
    // ENOENT: os bytes ja nao estavam la (volume recriado) — nada a avisar.
    if (err.code !== "ENOENT") {
      console.error(`[arquivo] registro ${idArquivo} removido, bytes nao:`, err.message)
    }
  })
  // O PDF convertido, se houve: sem o original ninguem mais chega nele.
  await fs.unlink(caminhoDaPrevia(idArquivo)).catch(() => {})
  return true
}

module.exports = {
  salvar,
  abrir,
  abrirComoPdf,
  carregar,
  remover,
  prepararDiretorio,
  UPLOAD_DIR,
  MAX_PRIVADO,
  MAX_PUBLICO,
}
