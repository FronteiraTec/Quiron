/**
 * Service dos materiais que a INCUBADORA publica para os MENTORES (regra de
 * negocio) — migracao 021.
 *
 * O caminho inverso do Espaco do Mentor: la o mentor guarda o proprio material
 * e entrega as startups; aqui a coordenacao entrega aos mentores o que eles
 * precisam para mentorar — o guia do mentor, a rubrica de avaliacao, o modelo
 * de relatorio de mentoria.
 *
 * QUEM VE: quem tem `mentoria.materiais_incubadora.visualizar` NA INCUBADORA DO
 * MATERIAL. O tenant de um material existente sai dele, nunca do pedido.
 *
 * QUEM MEXE: criar, editar e excluir sao chaves separadas, como na Biblioteca.
 * Arquivar e editar — tira o material da vista dos mentores sem apaga-lo, e so
 * quem pode editar continua enxergando o arquivado (para reativa-lo).
 *
 * O ARQUIVO entra pelo upload de sempre (POST /arquivos, PRIVADO) e e amarrado
 * pela mesma regra da biblioteca pessoal (mentorMaterialService.validarArquivo):
 * enviado por quem publica, nesta incubadora, e livre. Ele so abre pelo proprio
 * material — a rota generica de arquivos o recusa a quem nao o enviou.
 *
 * Estes materiais NAO entram no compartilhamento com startups: sao internos a
 * mentoria (uma rubrica de avaliacao nao e para quem e avaliado por ela). O que
 * e para a startup mora na Biblioteca.
 */
const materialIncubadoraRepository = require("../repositories/materialIncubadoraRepository")
const arquivoService = require("./arquivoService")
const rbacService = require("./rbacService")
const auditLogService = require("./auditLogService")
const { validarArquivo } = require("./mentorMaterialService")
const { normalizarMaterial, normalizarPatchMaterial } = require("../mentores/material")
const { erroNegocio } = require("../utils/erros")

const VER = "mentoria.materiais_incubadora.visualizar"
const CRIAR = "mentoria.materiais_incubadora.criar"
const EDITAR = "mentoria.materiais_incubadora.editar"
const EXCLUIR = "mentoria.materiais_incubadora.excluir"

function apresentar(material) {
  return { ...material, arquivado: Boolean(material.arquivado_ts) }
}

/**
 * Carrega o material para quem pode ve-lo. Arquivado so existe para quem pode
 * editar: para o mentor, ele saiu de vista — 404, como se nao existisse.
 */
async function carregar(idMaterial, usuario) {
  const id = Number(idMaterial)
  const material = Number.isInteger(id) && id > 0
    ? await materialIncubadoraRepository.buscarPorId(id)
    : null
  if (!material) throw erroNegocio(404, "Material nao encontrado.")

  await rbacService.garantirPermissao(material.id_tenant, usuario, VER)
  if (material.arquivado_ts && !(await rbacService.temPermissao(material.id_tenant, usuario, EDITAR))) {
    throw erroNegocio(404, "Material nao encontrado.")
  }
  return material
}

/** Os materiais da incubadora; quem pode editar ve tambem os arquivados. */
async function listar(idTenant, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, VER)

  const comArquivados = await rbacService.temPermissao(idTenant, usuario, EDITAR)
  const [materiais, categorias] = await Promise.all([
    materialIncubadoraRepository.listarPorTenant(idTenant, { comArquivados }),
    materialIncubadoraRepository.categorias(idTenant, { comArquivados }),
  ])
  return { materiais: materiais.map(apresentar), categorias }
}

async function buscar(idMaterial, usuario) {
  return apresentar(await carregar(idMaterial, usuario))
}

async function criar(idTenant, corpo, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, CRIAR)

  const dados = normalizarMaterial(corpo)
  if (dados.idArquivo) await validarArquivo(dados.idArquivo, idTenant, usuario)

  let material
  try {
    material = await materialIncubadoraRepository.criar({ ...dados, idTenant, criadoPor: usuario.id })
  } catch (err) {
    if (err.code === "23505") throw erroNegocio(409, "Este arquivo ja esta vinculado a outro material.")
    throw err
  }

  await auditLogService.registrar({
    idTenant,
    idUsuario: usuario.id,
    acao: "CRIAR",
    entidade: "mentor_material_incubadora",
    entidadeId: String(material.id_material),
    descricao: `Publicou "${material.titulo}" para os mentores.`,
    dadosDepois: material,
  })
  return apresentar(material)
}

/** Edita, troca o arquivo, arquiva ou reativa. */
async function atualizar(idMaterial, corpo, usuario) {
  const id = Number(idMaterial)
  const atual = Number.isInteger(id) && id > 0
    ? await materialIncubadoraRepository.buscarPorId(id)
    : null
  if (!atual) throw erroNegocio(404, "Material nao encontrado.")
  await rbacService.garantirPermissao(atual.id_tenant, usuario, EDITAR)

  const final = normalizarPatchMaterial(atual, corpo)
  const trocouArquivo = (final.idArquivo || null) !== (atual.id_arquivo || null)
  if (final.idArquivo && trocouArquivo) await validarArquivo(final.idArquivo, atual.id_tenant, usuario)

  let material
  try {
    material = await materialIncubadoraRepository.atualizar(atual.id_material, {
      ...final,
      atualizadoPor: usuario.id,
    })
  } catch (err) {
    if (err.code === "23505") throw erroNegocio(409, "Este arquivo ja esta vinculado a outro material.")
    throw err
  }

  // A versao antiga nao fica no volume: nenhum mentor a alcanca mais.
  if (trocouArquivo && atual.id_arquivo) await arquivoService.remover(atual.id_arquivo)

  let descricao = `Editou "${material.titulo}" nos materiais para os mentores.`
  if (final.arquivado === true && !atual.arquivado_ts) {
    descricao = `Arquivou "${material.titulo}" — saiu da vista dos mentores.`
  } else if (final.arquivado === false && atual.arquivado_ts) {
    descricao = `Reativou "${material.titulo}" para os mentores.`
  }

  await auditLogService.registrar({
    idTenant: atual.id_tenant,
    idUsuario: usuario.id,
    acao: "EDITAR",
    entidade: "mentor_material_incubadora",
    entidadeId: String(atual.id_material),
    descricao,
    dadosAntes: atual,
    dadosDepois: material,
  })
  return apresentar(material)
}

/** Exclui o material e o arquivo dele. Nada aponta para ca: nao ha o que barrar. */
async function excluir(idMaterial, usuario) {
  const id = Number(idMaterial)
  const material = Number.isInteger(id) && id > 0
    ? await materialIncubadoraRepository.buscarPorId(id)
    : null
  if (!material) throw erroNegocio(404, "Material nao encontrado.")
  await rbacService.garantirPermissao(material.id_tenant, usuario, EXCLUIR)

  const removido = await materialIncubadoraRepository.excluir(material.id_material)
  if (removido?.id_arquivo) await arquivoService.remover(removido.id_arquivo)

  await auditLogService.registrar({
    idTenant: material.id_tenant,
    idUsuario: usuario.id,
    acao: "EXCLUIR",
    entidade: "mentor_material_incubadora",
    entidadeId: String(material.id_material),
    descricao: `Excluiu "${material.titulo}" dos materiais para os mentores.`,
    dadosAntes: material,
  })
  return { excluido: true }
}

/** Os bytes do material, para quem pode ve-lo. */
async function abrirArquivo(idMaterial, usuario) {
  const material = await carregar(idMaterial, usuario)
  if (material.tipo !== "ARQUIVO" || !material.id_arquivo) {
    throw erroNegocio(404, "Este material nao tem arquivo.")
  }
  return arquivoService.carregar(material.id_arquivo, { idTenant: material.id_tenant })
}

module.exports = { listar, buscar, criar, atualizar, excluir, abrirArquivo }
