/**
 * Store das categorias e locais de evento da incubadora atual (zustand).
 *
 * Ate a migracao 008 as categorias eram um objeto fixo em
 * components/calendar/categorias.js, espelho do enum do Postgres. Viraram
 * configuracao de cada incubadora, entao passam a vir da API.
 *
 * FICAM NUM STORE, e nao em cada tela, porque sao lidas em ONZE componentes
 * (calendario, drawers, dashboard, presenca, notificacoes). Um fetch por
 * componente seria uma dezena de requisicoes iguais a cada navegacao, e o
 * rotulo de uma categoria pode divergir entre duas telas abertas.
 *
 * O backend continua sendo quem valida. Isto e dado de APRESENTACAO — rotulo,
 * cor e icone — mais a lista que o seletor de evento novo oferece.
 */
import { create } from "zustand"
import api from "../services/api"

export const useAgendaConfigStore = create((set, get) => ({
  // null = ainda nao carregou. Distinto de [] (carregou e esta vazio): sem essa
  // diferenca o calendario decidiria "nao ha categoria" no primeiro render e
  // pintaria tudo com o fallback antes da resposta chegar.
  categorias: null,
  locais: null,
  idTenantCarregado: null,
  carregando: false,

  /**
   * Carrega categorias e locais do tenant.
   *
   * Ignora a chamada repetida para o mesmo tenant: os componentes que dependem
   * disto montam juntos, e sem essa guarda cada um dispararia o proprio par de
   * requisicoes no mesmo instante.
   */
  carregar: async (idTenant, { forcar = false } = {}) => {
    if (!idTenant) {
      set({ categorias: [], locais: [], idTenantCarregado: null, carregando: false })
      return
    }
    const { idTenantCarregado, carregando } = get()
    if (!forcar && carregando) return
    if (!forcar && idTenantCarregado === idTenant) return

    set({ carregando: true })
    try {
      const [respCategorias, respLocais] = await Promise.all([
        api.get("/agenda-config/categorias", { params: { id_tenant: idTenant } }),
        api.get("/agenda-config/locais", { params: { id_tenant: idTenant } }),
      ])
      set({
        categorias: respCategorias.data.categorias || [],
        locais: respLocais.data.locais || [],
        idTenantCarregado: idTenant,
        carregando: false,
      })
    } catch {
      // Falhar para o FALLBACK, nao para vazio: categoriaInfo() cai nas cores e
      // rotulos originais e o calendario continua legivel. Ao contrario das
      // permissoes, aqui nao ha nada a proteger — esconder o rotulo de um
      // evento so deixa a tela pior.
      set({ categorias: [], locais: [], carregando: false })
    }
  },

  /** Limpa no logout / troca de incubadora. */
  limpar: () => set({ categorias: null, locais: null, idTenantCarregado: null, carregando: false }),

  /**
   * Reaplica o que a tela de configuracao acabou de salvar, sem refetch.
   * A tela ja recebeu a lista atualizada na resposta; devolve-la aqui mantem o
   * calendario coerente na mesma navegacao.
   */
  definirCategorias: (categorias) => set({ categorias }),
  definirLocais: (locais) => set({ locais }),
}))
