/**
 * Store das permissoes do usuario logado (zustand).
 *
 * As chaves vem de GET /permissoes/minhas e valem para o tenant atual. Ficam
 * num store, e nao em cada tela, porque quem precisa delas primeiro e o MENU:
 * sem isso o usuario continua vendo itens que agora respondem 403 — falha
 * visivel, que e pior que a antiga falha silenciosa.
 *
 * O backend e quem autoriza. Isto aqui so evita oferecer o que nao vai
 * funcionar: esconder um botao nao protege nada, e nenhuma checagem daqui
 * substitui o `garantirPermissao` do service.
 */
import { create } from "zustand"
import api from "../services/api"

export const usePermissaoStore = create((set, get) => ({
  // null = ainda nao carregou. Distinto de [] (carregou e nao tem nenhuma):
  // sem essa diferenca o menu pisca vazio no primeiro render.
  chaves: null,
  carregando: false,

  /** Carrega as chaves do tenant. Idempotente por tenant. */
  carregar: async (idTenant) => {
    if (!idTenant) {
      set({ chaves: [], carregando: false })
      return
    }
    set({ carregando: true })
    try {
      const { data } = await api.get("/permissoes/minhas", {
        params: { id_tenant: idTenant },
      })
      set({ chaves: data.permissoes || [], carregando: false })
    } catch {
      // Falhar fechado: sem resposta, tratamos como "nenhuma permissao". O
      // usuario ve um menu curto em vez de itens que dariam 403 ao clicar.
      set({ chaves: [], carregando: false })
    }
  },

  /** Limpa no logout, para o proximo usuario nao herdar as chaves do anterior. */
  limpar: () => set({ chaves: null, carregando: false }),

  /**
   * O usuario tem esta chave?
   *
   * Enquanto `chaves` e null (carregando) responde `true`: o menu aparece
   * inteiro por um instante e encolhe, em vez de aparecer vazio e crescer. Os
   * cliques nesse intervalo continuam protegidos pelo backend.
   */
  pode: (chave) => {
    const { chaves } = get()
    if (!chave) return true
    if (chaves === null) return true
    return chaves.includes(chave)
  },
}))
