/**
 * Store de Preferencias visuais (zustand).
 *
 * Guarda as preferencias do usuario (tema, cores do painel, densidade, etc.)
 * e expoe acoes para carregar do backend e salvar. O App observa este estado
 * para reconstruir o tema do MUI em tempo real.
 */
import { create } from "zustand"
import api from "../services/api"
import { PREFERENCIAS_PADRAO } from "../theme"

export const usePreferenciaStore = create((set) => ({
  // Comeca no padrao ate carregar as preferencias reais do usuario.
  preferencias: PREFERENCIAS_PADRAO,

  /**
   * Carrega as preferencias do usuario logado (GET /preferencias).
   */
  carregar: async () => {
    const { data } = await api.get("/preferencias")
    set({ preferencias: data.preferencias })
    return data.preferencias
  },

  /**
   * Salva um subconjunto das preferencias (PUT /preferencias) e atualiza
   * o estado com a resposta do backend.
   * @param {object} patch - Campos a atualizar.
   */
  salvar: async (patch) => {
    const { data } = await api.put("/preferencias", patch)
    set({ preferencias: data.preferencias })
    return data.preferencias
  },

  /**
   * Aplica um patch localmente sem esperar o backend, para refletir a
   * mudanca (ex.: tema, cor) na interface de forma imediata.
   * @param {object} patch - Campos a atualizar.
   */
  atualizarLocal: (patch) =>
    set((s) => ({ preferencias: { ...s.preferencias, ...patch } })),

  /**
   * Restaura o padrao local (ex.: no logout), sem tocar no backend.
   */
  resetar: () => set({ preferencias: PREFERENCIAS_PADRAO }),
}))
