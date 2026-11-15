/**
 * Store dos beneficios que a pessoa logada alcanca como membro de startup
 * (zustand). Hoje so o Mini CRM.
 *
 * Fica num store pelo mesmo motivo das permissoes: quem precisa primeiro e o
 * MENU, que so oferece o item "CRM" a quem tem o beneficio ativo. Quem autoriza
 * e o backend, a cada pedido do CRM — isto so evita oferecer o que daria 403.
 */
import { create } from "zustand"
import api from "../services/api"

export const useBeneficioStore = create((set, get) => ({
  // null = ainda nao carregou; [] = carregou e nao ha beneficio nenhum.
  beneficios: null,

  carregar: async (idTenant) => {
    if (!idTenant) {
      set({ beneficios: [] })
      return
    }
    try {
      const { data } = await api.get("/beneficios/meus", { params: { id_tenant: idTenant } })
      set({ beneficios: data.beneficios || [] })
    } catch {
      // Falhar fechado: sem resposta, o item do CRM nao aparece.
      set({ beneficios: [] })
    }
  },

  limpar: () => set({ beneficios: null }),

  /**
   * Tem o beneficio? Enquanto carrega responde FALSE, ao contrario das
   * permissoes: o item do CRM e a excecao no menu de quase todo mundo, e
   * piscar um item que some e pior que ve-lo aparecer.
   */
  tem: (chave) => {
    if (!chave) return true
    return (get().beneficios || []).some((b) => b.beneficio === chave)
  },

  /** As startups em que o beneficio esta ativo para esta pessoa. */
  startupsCom: (chave) => (get().beneficios || []).filter((b) => b.beneficio === chave),
}))
