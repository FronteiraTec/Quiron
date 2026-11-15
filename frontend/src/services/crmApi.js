/**
 * As chamadas do Mini CRM, presas a uma startup: `crmApi(idStartup).clientes()`.
 *
 * Todas vao para /crm/:idStartup/..., e o backend confere a cada uma que quem
 * pede e membro da startup e que o beneficio esta ativo. Nada aqui decide
 * acesso — so evita repetir a URL em cada tela.
 */
import api from "./api"

export function crmApi(idStartup) {
  const b = `/crm/${idStartup}`
  const dados = (p) => p.then((r) => r.data)

  return {
    contexto: () => dados(api.get(`${b}/contexto`)),
    painel: (periodo) => dados(api.get(`${b}/painel`, { params: { periodo } })),

    clientes: () => dados(api.get(`${b}/clientes`)).then((d) => d.clientes),
    cliente: (id) => dados(api.get(`${b}/clientes/${id}`)),
    criarCliente: (corpo) => dados(api.post(`${b}/clientes`, corpo)).then((d) => d.cliente),
    atualizarCliente: (id, corpo) => dados(api.put(`${b}/clientes/${id}`, corpo)).then((d) => d.cliente),
    excluirCliente: (id) => api.delete(`${b}/clientes/${id}`),
    historicoCliente: (id, antes) =>
      dados(api.get(`${b}/clientes/${id}/historico`, { params: { antes: antes || undefined } })),
    atividadeCliente: (id, corpo) => dados(api.post(`${b}/clientes/${id}/atividades`, corpo)),

    oportunidades: () => dados(api.get(`${b}/oportunidades`)).then((d) => d.oportunidades),
    oportunidade: (id) => dados(api.get(`${b}/oportunidades/${id}`)),
    criarOportunidade: (corpo) => dados(api.post(`${b}/oportunidades`, corpo)).then((d) => d.oportunidade),
    atualizarOportunidade: (id, corpo) =>
      dados(api.put(`${b}/oportunidades/${id}`, corpo)).then((d) => d.oportunidade),
    moverOportunidade: (id, idEtapa) =>
      dados(api.patch(`${b}/oportunidades/${id}/etapa`, { id_etapa: idEtapa })).then((d) => d.oportunidade),
    ganhar: (id, corpo) => dados(api.post(`${b}/oportunidades/${id}/ganhar`, corpo)).then((d) => d.oportunidade),
    perder: (id, corpo) => dados(api.post(`${b}/oportunidades/${id}/perder`, corpo)).then((d) => d.oportunidade),
    reabrir: (id, corpo) => dados(api.post(`${b}/oportunidades/${id}/reabrir`, corpo || {})).then((d) => d.oportunidade),
    excluirOportunidade: (id) => api.delete(`${b}/oportunidades/${id}`),
    historicoOportunidade: (id, antes) =>
      dados(api.get(`${b}/oportunidades/${id}/historico`, { params: { antes: antes || undefined } })),
    atividadeOportunidade: (id, corpo) => dados(api.post(`${b}/oportunidades/${id}/atividades`, corpo)),

    tarefas: (filtros = {}) => dados(api.get(`${b}/tarefas`, { params: filtros })).then((d) => d.tarefas),
    tarefa: (id) => dados(api.get(`${b}/tarefas/${id}`)).then((d) => d.tarefa),
    criarTarefa: (corpo) => dados(api.post(`${b}/tarefas`, corpo)).then((d) => d.tarefa),
    atualizarTarefa: (id, corpo) => dados(api.put(`${b}/tarefas/${id}`, corpo)).then((d) => d.tarefa),
    statusTarefa: (id, status) => dados(api.patch(`${b}/tarefas/${id}/status`, { status })).then((d) => d.tarefa),
  }
}
