/**
 * Store da disponibilidade das reunioes por video (zustand).
 *
 * Sem o LiveKit configurado no servidor, o modulo fica invisivel — como o
 * Google Agenda sem credenciais. Quem precisa saber primeiro e o MENU, que so
 * oferece "Reunioes" quando ha sala de video. Muda so com um deploy, entao
 * carrega uma vez por sessao.
 */
import { create } from "zustand"
import { reunioesApi } from "../services/reunioesApi"

export const useReuniaoStore = create((set, get) => ({
  // null = ainda nao carregou.
  disponivel: null,
  minutosAntes: 15,

  carregar: async () => {
    if (get().disponivel !== null) return
    try {
      const { disponivel, minutos_antes } = await reunioesApi.disponibilidade()
      set({ disponivel: Boolean(disponivel), minutosAntes: minutos_antes || 15 })
    } catch {
      // Falhar fechado: sem resposta, o item nao aparece.
      set({ disponivel: false })
    }
  },

  limpar: () => set({ disponivel: null }),

  /** O modulo existe nesta instalacao? Enquanto carrega, nao (nao pisca). */
  tem: (modulo) => {
    if (!modulo) return true
    if (modulo === "reunioes") return get().disponivel === true
    return true
  },
}))
