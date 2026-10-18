/**
 * Service da biblioteca PESSOAL do mentor (regra de negocio) — migracao 020.
 *
 * A REGRA CENTRAL E UMA SO: o material e do dono. Nao existe chave RBAC que de
 * acesso a biblioteca de outra pessoa — nem a do admin. A chave
 * `mentoria.materiais.gerenciar` diz QUEM tem biblioteca; o que cada um alcanca
 * dentro dela e o que e dele. Para todos os outros, um material alheio responde
 * 404, e nao 403: confirmar que o id existe ja seria dizer algo sobre a
 * biblioteca de outra pessoa.
 *
 * O ARQUIVO entra pelo caminho de upload de sempre (POST /arquivos, PRIVADO,
 * com os tipos e o teto de 15MB do arquivoService). Aqui ele so e AMARRADO ao
 * material, e a amarracao confere o que o upload nao tem como saber: que o
 * arquivo foi enviado por quem esta criando o material, nesta incubadora. Sem
 * isso, quem soubesse o UUID do anexo de entrega de uma startup o colocaria na
 * propria biblioteca — e dai o compartilharia com outra startup.
 *
 * EXCLUIR E ARQUIVAR sao duas coisas. Arquivar tira o material da biblioteca de
 * trabalho e mantem o que ja foi entregue; excluir apaga — e por isso e
 * recusado enquanto houver startup com o material (ver excluir).
 */
const mentorMaterialRepository = require("../repositories/mentorMaterialRepository")
const mentorPastaRepository = require("../repositories/mentorPastaRepository")
const arquivoRepository = require("../repositories/arquivoRepository")
const tenantRepository = require("../repositories/tenantRepository")
const arquivoService = require("./arquivoService")
const rbacService = require("./rbacService")
const auditLogService = require("./auditLogService")
const { normalizarMaterial, normalizarPatchMaterial } = require("../mentores/material")
const { idPastaOuRaiz } = require("../mentores/pastas")
const { erroNegocio } = require("../utils/erros")

const GERENCIAR = "mentoria.materiais.gerenciar"

/** O formato que a tela recebe: a linha do banco, mais o estado legivel. */
function apresentar(material) {
  return { ...material, arquivado: Boolean(material.arquivado_ts) }
}

/**
 * Carrega o material e exige que ele seja de quem pede.
 *
 * O tenant sai do PROPRIO material, nunca do pedido: a chave e conferida na
 * incubadora onde o material esta guardado.
 */
async function carregarDoDono(idMaterial, usuario) {
  const id = Number(idMaterial)
  const material = Number.isInteger(id) && id > 0
    ? await mentorMaterialRepository.buscarPorId(id)
    : null

  if (!material || Number(material.id_mentor) !== Number(usuario?.id)) {
    throw erroNegocio(404, "Material nao encontrado.")
  }
  await rbacService.garantirPermissao(material.id_tenant, usuario, GERENCIAR)
  return material
}

/**
 * O arquivo pode virar o corpo de um material? So o que a propria pessoa
 * enviou, nesta incubadora, como PRIVADO — e que nada mais reclama: nem outro
 * material (pessoal ou da incubadora), nem um anexo de tarefa. Livre e o que
 * permite apagar os bytes junto com o material, mais tarde, sem tirar o
 * arquivo de baixo de ninguem.
 *
 * Exportada porque os materiais que a incubadora publica para os mentores
 * (materialIncubadoraService) amarram o arquivo pela mesma regra.
 */
async function validarArquivo(idArquivo, idTenant, usuario) {
  // UUID ja conferido pelo normalizador; o catch cobre so o improvavel.
  const arquivo = await arquivoRepository.buscarPorId(idArquivo).catch(() => null)
  if (
    !arquivo ||
    Number(arquivo.id_tenant) !== Number(idTenant) ||
    Number(arquivo.enviado_por) !== Number(usuario.id)
  ) {
    throw erroNegocio(400, "Arquivo invalido. Envie o arquivo novamente.")
  }
  if (arquivo.visibilidade !== "PRIVADO") {
    throw erroNegocio(400, "O arquivo de um material precisa ser enviado como privado.")
  }
  if ((await arquivoRepository.contarReferencias(idArquivo)) > 0) {
    throw erroNegocio(409, "Este arquivo ja esta vinculado a outro material ou anexo.")
  }
}

/**
 * A biblioteca de quem pede, nesta incubadora: os materiais, as pastas
 * (migracao 025) e as categorias em uso. Vem tudo de uma vez — a tela navega
 * entre pastas sem voltar ao servidor, como a pessoa espera de um gerenciador
 * de arquivos.
 */
async function listar(idTenant, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, GERENCIAR)

  const [materiais, categorias, pastas] = await Promise.all([
    mentorMaterialRepository.listarDoMentor(idTenant, usuario.id),
    mentorMaterialRepository.categoriasDoMentor(idTenant, usuario.id),
    mentorPastaRepository.listarDoMentor(idTenant, usuario.id),
  ])
  return { materiais: materiais.map(apresentar), categorias, pastas }
}

/** Um material, com os lugares para onde ele ja foi. */
async function buscar(idMaterial, usuario) {
  const material = await carregarDoDono(idMaterial, usuario)
  const compartilhamentos = await mentorMaterialRepository.compartilhamentosDoMaterial(
    material.id_material
  )
  return { ...apresentar(material), compartilhamentos }
}

async function criar(idTenant, corpo, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, GERENCIAR)

  // A biblioteca e de quem esta na incubadora (FK para tenant_usuarios). O
  // root passa em toda chave, mas nao tem vinculo — nem onde guardar material.
  const papel = await tenantRepository.buscarPapel(idTenant, usuario.id)
  if (!papel) throw erroNegocio(403, "Voce nao pertence a esta incubadora.")

  const dados = normalizarMaterial(corpo)
  if (dados.idArquivo) await validarArquivo(dados.idArquivo, idTenant, usuario)

  // A pasta onde ele nasce (a que estava aberta na tela). Pasta de outra pessoa
  // responde como pasta que nao existe — a FK composta recusaria de todo jeito.
  const idPasta = idPastaOuRaiz(corpo.id_pasta)
  if (idPasta) {
    const pasta = await mentorPastaRepository.buscarPorId(idPasta)
    if (!pasta || Number(pasta.id_mentor) !== Number(usuario.id) || Number(pasta.id_tenant) !== Number(idTenant)) {
      throw erroNegocio(404, "Pasta nao encontrada.")
    }
  }

  let material
  try {
    material = await mentorMaterialRepository.criar({ ...dados, idPasta, idTenant, idMentor: usuario.id })
  } catch (err) {
    // Dois envios simultaneos do mesmo arquivo: o indice unico decide.
    if (err.code === "23505") throw erroNegocio(409, "Este arquivo ja pertence a outro material.")
    // A pasta foi excluida entre a conferencia e a gravacao.
    if (err.code === "23503" && err.constraint === "fk_mentor_material_pasta") {
      throw erroNegocio(404, "Pasta nao encontrada.")
    }
    throw err
  }

  await auditLogService.registrar({
    idTenant,
    idUsuario: usuario.id,
    acao: "CRIAR",
    entidade: "mentor_material",
    entidadeId: String(material.id_material),
    descricao: `Adicionou "${material.titulo}" a biblioteca pessoal.`,
    dadosDepois: material,
  })
  return apresentar(material)
}

/**
 * Edita, troca o arquivo, troca o tipo, arquiva ou desarquiva.
 *
 * Trocar o arquivo e o que torna o compartilhamento util ao longo do tempo: a
 * startup aponta para o MATERIAL, e passa a abrir a versao nova sem ninguem
 * compartilhar de novo. O arquivo antigo sai junto — ninguem mais o alcanca, e
 * deixa-lo no volume so ocuparia disco.
 */
async function atualizar(idMaterial, corpo, usuario) {
  const atual = await carregarDoDono(idMaterial, usuario)
  const final = normalizarPatchMaterial(atual, corpo)

  const trocouArquivo = (final.idArquivo || null) !== (atual.id_arquivo || null)
  if (final.idArquivo && trocouArquivo) {
    await validarArquivo(final.idArquivo, atual.id_tenant, usuario)
  }

  let material
  try {
    material = await mentorMaterialRepository.atualizar(atual.id_material, final)
  } catch (err) {
    if (err.code === "23505") throw erroNegocio(409, "Este arquivo ja pertence a outro material.")
    throw err
  }

  if (trocouArquivo && atual.id_arquivo) await arquivoService.remover(atual.id_arquivo)

  let descricao = `Editou "${material.titulo}" na biblioteca pessoal.`
  if (final.arquivado === true && !atual.arquivado_ts) {
    descricao = `Arquivou "${material.titulo}" da biblioteca pessoal.`
  } else if (final.arquivado === false && atual.arquivado_ts) {
    descricao = `Reativou "${material.titulo}" na biblioteca pessoal.`
  }

  await auditLogService.registrar({
    idTenant: atual.id_tenant,
    idUsuario: usuario.id,
    acao: "EDITAR",
    entidade: "mentor_material",
    entidadeId: String(atual.id_material),
    descricao,
    dadosAntes: atual,
    dadosDepois: material,
  })
  return apresentar(material)
}

/**
 * Exclui um material que NUNCA chegou a startup nenhuma — ou cujos
 * compartilhamentos o mentor ja removeu.
 *
 * Material compartilhado nao some pela biblioteca: a startup perderia, sem
 * aviso, o que o mentor entregou a ela. A mensagem diz os dois caminhos — tirar
 * o material das startups, ou arquiva-lo, que limpa a biblioteca sem tirar
 * nada de ninguem.
 */
async function excluir(idMaterial, usuario) {
  const material = await carregarDoDono(idMaterial, usuario)

  const resultado = await mentorMaterialRepository.excluirSeLivre(material.id_material)
  if (!resultado.excluido && resultado.compartilhamentos > 0) {
    throw erroNegocio(
      409,
      `Este material esta compartilhado (${resultado.compartilhamentos} vinculo(s) com startups). ` +
        "Remova os compartilhamentos antes de excluir, ou arquive o material para tira-lo da sua biblioteca."
    )
  }
  if (!resultado.excluido) throw erroNegocio(404, "Material nao encontrado.")

  if (resultado.idArquivo) await arquivoService.remover(resultado.idArquivo)

  await auditLogService.registrar({
    idTenant: material.id_tenant,
    idUsuario: usuario.id,
    acao: "EXCLUIR",
    entidade: "mentor_material",
    entidadeId: String(material.id_material),
    descricao: `Excluiu "${material.titulo}" da biblioteca pessoal.`,
    dadosAntes: material,
  })
  return { excluido: true }
}

/** Os bytes do material, so para o dono (a startup abre pelo compartilhamento). */
async function abrirArquivo(idMaterial, usuario) {
  const material = await carregarDoDono(idMaterial, usuario)
  if (material.tipo !== "ARQUIVO" || !material.id_arquivo) {
    throw erroNegocio(404, "Este material nao tem arquivo.")
  }
  return arquivoService.carregar(material.id_arquivo, { idTenant: material.id_tenant })
}

module.exports = {
  GERENCIAR,
  validarArquivo,
  listar,
  buscar,
  criar,
  atualizar,
  excluir,
  abrirArquivo,
}
