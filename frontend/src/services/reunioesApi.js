/**
 * Chamadas das reunioes por video (docs/reunioes.md). Quem autoriza e o
 * backend (reuniaoService); aqui so se fala com ele.
 */
import api from "./api"

export const reunioesApi = {
  disponibilidade: () => api.get("/reunioes/disponibilidade").then((r) => r.data),
  listar: (idTenant, params = {}) =>
    api.get("/reunioes", { params: { id_tenant: idTenant, ...params } }).then((r) => r.data),
  buscar: (id) => api.get(`/reunioes/${id}`).then((r) => r.data.reuniao),
  convidaveis: (idTenant) =>
    api.get("/reunioes/convidaveis", { params: { id_tenant: idTenant } }).then((r) => r.data.pessoas),
  criar: (dados) => api.post("/reunioes", dados).then((r) => r.data.reuniao),
  atualizar: (id, dados) => api.put(`/reunioes/${id}`, dados).then((r) => r.data.reuniao),
  cancelar: (id) => api.post(`/reunioes/${id}/cancelar`).then((r) => r.data.reuniao),
  excluir: (id) => api.delete(`/reunioes/${id}`).then((r) => r.data),
  token: (id) => api.post(`/reunioes/${id}/token`).then((r) => r.data),
  encerrar: (id) => api.post(`/reunioes/${id}/encerrar`).then((r) => r.data),

  // Gravacao e transcricao (Etapa 4).
  consentir: (id, aceito) => api.post(`/reunioes/${id}/consentimento`, { aceito }).then((r) => r.data.consentimento),
  abrirGravacao: (id, mime) => api.post(`/reunioes/${id}/gravacoes`, { mime }).then((r) => r.data),
  /** O pedaco vai CRU, com o tipo da gravacao no Content-Type. */
  enviarParte: (id, idAudio, n, blob, mime) =>
    api.put(`/reunioes/${id}/gravacoes/${idAudio}/partes/${n}`, blob, { headers: { "Content-Type": mime } }).then((r) => r.data),
  fecharGravacao: (id, idAudio) => api.post(`/reunioes/${id}/gravacoes/${idAudio}/fechar`).then((r) => r.data),
  transcricao: (id) => api.get(`/reunioes/${id}/transcricao`).then((r) => r.data),
  processamentos: (id) => api.get(`/reunioes/${id}/processamentos`).then((r) => r.data.processamentos),
  reprocessar: (id, tipo = "TRANSCRICAO") => api.post(`/reunioes/${id}/processamentos`, { tipo }).then((r) => r.data.processamento),
  cancelarProcessamento: (idProcessamento) =>
    api.post(`/reunioes/processamentos/${idProcessamento}/cancelar`).then((r) => r.data.processamento),
}

/** Integracoes de IA da incubadora (Configuracoes > Inteligencia artificial). */
export const iaConfigApi = {
  listar: (idTenant) => api.get("/ia-config", { params: { id_tenant: idTenant } }).then((r) => r.data),
  salvar: (idTenant, finalidade, dados) => api.put(`/ia-config/${finalidade}`, { id_tenant: idTenant, ...dados }).then((r) => r.data.configuracao),
  testar: (idTenant, finalidade) => api.post(`/ia-config/${finalidade}/testar`, { id_tenant: idTenant }).then((r) => r.data),
  salvarRetencao: (idTenant, dados) => api.put("/ia-config/retencao", { id_tenant: idTenant, ...dados }).then((r) => r.data.retencao),
}

/** A frase de erro que o backend mandou, ou a padrao. */
export function mensagemErro(err, padrao = "Não foi possível concluir. Tente de novo.") {
  return err?.response?.data?.erro || padrao
}

/** O codigo estavel do erro (ex.: "SALA_AINDA_FECHADA"), para a tela reagir. */
export function codigoErro(err) {
  return err?.response?.data?.codigo || null
}
