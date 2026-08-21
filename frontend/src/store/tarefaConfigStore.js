/**
 * Store do vocabulario do QUADRO DE TAREFAS da incubadora atual (zustand): as
 * COLUNAS (status) e a definicao dos CAMPOS PERSONALIZAVEIS.
 *
 * FICA NUM STORE, e nao em cada tela, pelo mesmo motivo do startupConfigStore:
 * as duas listas sao lidas na tela de tarefas (nas duas visualizacoes), no
 * painel de cadastro e na tela de configuracao. Um fetch por componente seria
 * meia duzia de requisicoes iguais a cada navegacao, e o rotulo de uma coluna
 * poderia divergir entre a tabela e o kanban abertos lado a lado.
 *
 * O backend continua sendo quem valida. Isto e dado de APRESENTACAO — rotulo,
 * cor, categoria e a estrutura do formulario — mais a lista que os seletores
 * oferecem.
 */
import { create } from "zustand"
import api from "../services/api"

export const useTarefaConfigStore = create((set, get) => ({
  // null = ainda nao carregou. Distinto de [] (carregou e esta vazio): sem essa
  // diferenca o quadro decidiria "nao ha coluna nenhuma" no primeiro render e
  // mostraria o estado vazio antes de a resposta chegar.
  status: null,
  campos: null,
  idTenantCarregado: null,
  carregando: false,

  /**
   * Carrega colunas e campos do tenant.
   *
   * Ignora a chamada repetida para o mesmo tenant: os componentes que dependem
   * disto montam juntos, e sem essa guarda cada um dispararia o proprio par de
   * requisicoes no mesmo instante.
   */
  carregar: async (idTenant, { forcar = false } = {}) => {
    if (!idTenant) {
      set({ status: [], campos: [], idTenantCarregado: null, carregando: false })
      return
    }
    const { idTenantCarregado, carregando } = get()
    if (!forcar && carregando) return
    if (!forcar && idTenantCarregado === idTenant) return

    set({ carregando: true })
    try {
      const params = { id_tenant: idTenant }
      const [respStatus, respCampos] = await Promise.all([
        api.get("/tarefas-config/status", { params }),
        api.get("/tarefas-config/campos", { params }),
      ])
      set({
        status: respStatus.data.status || [],
        campos: respCampos.data.campos || [],
        idTenantCarregado: idTenant,
        carregando: false,
      })
    } catch {
      // Falhar para VAZIO, e nao deixar em null: com null as telas ficariam em
      // "carregando" para sempre. Vazio ao menos deixa a tela dizer o que
      // aconteceu. Quem nao tem a chave `tarefas.tarefas.visualizar` cai aqui
      // por 403 — e nem chega a ver o item de menu.
      set({ status: [], campos: [], carregando: false })
    }
  },

  /** Limpa no logout / troca de incubadora. */
  limpar: () => set({ status: null, campos: null, idTenantCarregado: null, carregando: false }),

  /**
   * Reaplica o que a tela de configuracao acabou de salvar, sem refetch.
   * A tela ja recebeu a lista atualizada; devolve-la aqui mantem o quadro
   * coerente na mesma navegacao. So os ATIVOS entram — e o que o quadro pode
   * desenhar e o formulario oferecer.
   */
  definirStatus: (status) => set({ status: status.filter((s) => s.ativo) }),
  definirCampos: (campos) => set({ campos: campos.filter((c) => c.ativo) }),
}))
