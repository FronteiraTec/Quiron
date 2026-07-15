/**
 * Service de Audit Log (regra de negocio).
 */
const auditLogRepository = require("../repositories/auditLogRepository")
const { erroNegocio } = require("../utils/erros")

/** Lista os registros de auditoria de um tenant. */
async function listar(idTenant, limite) {
  if (!idTenant) throw erroNegocio(400, "Informe o id_tenant.")
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
