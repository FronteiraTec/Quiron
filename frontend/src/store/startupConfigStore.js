/**
 * Store do vocabulario de cadastro de startup da incubadora atual (zustand):
 * TIPOS, SITUACOES e a definicao dos CAMPOS PERSONALIZAVEIS.
 *
 * FICA NUM STORE, e nao em cada tela, pelo mesmo motivo do agendaConfigStore:
 * as tres listas sao lidas na lista de startups, no cadastro, no detalhe, em
 * "Minha Startup" e no painel do mentor. Um fetch por componente seria meia
 * duzia de requisicoes iguais a cada navegacao, e o rotulo de uma situacao
 * poderia divergir entre duas telas abertas.
 *
 * O backend continua sendo quem valida. Isto e dado de APRESENTACAO — rotulo,
 * cor e a estrutura do formulario — mais a lista que os seletores oferecem.
 */
import { create } from "zustand"
import api from "../services/api"

export const useStartupConfigStore = create((set, get) => ({
  // null = ainda nao carregou. Distinto de [] (carregou e esta vazio): sem essa
  // diferenca o formulario decidiria "nao ha campo personalizado" no primeiro
  // render e nao os desenharia quando a resposta chegasse.
  tipos: null,
  situacoes: null,
  campos: null,
  idTenantCarregado: null,
  carregando: false,

  /**
   * Carrega tipos, situacoes e campos do tenant.
   *
   * Ignora a chamada repetida para o mesmo tenant: os componentes que dependem
   * disto montam juntos, e sem essa guarda cada um dispararia o proprio trio
   * de requisicoes no mesmo instante.
   */
  carregar: async (idTenant, { forcar = false } = {}) => {
    if (!idTenant) {
      set({ tipos: [], situacoes: [], campos: [], idTenantCarregado: null, carregando: false })
      return
    }
    const { idTenantCarregado, carregando } = get()
    if (!forcar && carregando) return
    if (!forcar && idTenantCarregado === idTenant) return

    set({ carregando: true })
    try {
      const params = { id_tenant: idTenant }
      const [respTipos, respSituacoes, respCampos] = await Promise.all([
        api.get("/startups-config/tipos", { params }),
        api.get("/startups-config/situacoes", { params }),
        api.get("/startups-config/campos", { params }),
      ])
      set({
        tipos: respTipos.data.tipos || [],
        situacoes: respSituacoes.data.situacoes || [],
        campos: respCampos.data.campos || [],
        idTenantCarregado: idTenant,
        carregando: false,
      })
    } catch {
      // Falhar para VAZIO, e nao deixar em null: com null as telas ficariam em
      // "carregando" para sempre. Vazio pelo menos deixa a lista de startups
      // legivel — a chip de situacao cai no fallback de data/startupMeta.
      set({ tipos: [], situacoes: [], campos: [], carregando: false })
    }
  },

  /** Limpa no logout / troca de incubadora. */
  limpar: () =>
    set({ tipos: null, situacoes: null, campos: null, idTenantCarregado: null, carregando: false }),

  /**
   * Reaplica o que a tela de configuracao acabou de salvar, sem refetch.
   * A tela ja recebeu a lista atualizada; devolve-la aqui mantem o cadastro
   * coerente na mesma navegacao. So as ATIVAS entram — e o que os seletores
   * podem oferecer.
   */
  definirTipos: (tipos) => set({ tipos: tipos.filter((t) => t.ativo) }),
  definirSituacoes: (situacoes) => set({ situacoes: situacoes.filter((s) => s.ativo) }),
  definirCampos: (campos) => set({ campos: campos.filter((c) => c.ativo) }),
}))
