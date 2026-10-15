/**
 * Service de Audit Log (regra de negocio).
 */
const auditLogRepository = require("../repositories/auditLogRepository")
const rbacService = require("./rbacService")
const { erroNegocio } = require("../utils/erros")

/**
 * Lista os registros de auditoria de um tenant. Exige a chave NO tenant
 * pedido (QRN-04): ser admin de outra incubadora nao vale aqui.
 */
async function listar(idTenant, limite, usuario) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
  await rbacService.garantirPermissao(idTenant, usuario, "configuracoes.auditoria.visualizar")
  return auditLogRepository.listarPorTenant(idTenant, limite)
}

/** Registra uma acao no log de auditoria. */
async function registrar(dados) {
  const { acao, entidade } = dados
  if (!acao || !entidade) {
    throw erroNegocio(400, "Informe acao e entidade.")
  }
  return auditLogRepository.registrar(dados)
}

module.exports = { listar, registrar }
