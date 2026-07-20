/**
 * Store de autenticacao (zustand).
 *
 * Guarda o token e os dados do usuario logado, persistindo o token no
 * localStorage para sobreviver a recarregar a pagina. Expoe as acoes de
 * login e logout que falam com o backend.
 */
import { create } from "zustand"
import api, { TOKEN_KEY } from "../services/api"
import { usePreferenciaStore } from "./preferenciaStore"
import { usePermissaoStore } from "./permissaoStore"

export const useAuthStore = create((set) => ({
  // Estado inicial: recupera o token salvo (se houver).
  token: localStorage.getItem(TOKEN_KEY) || null,
  usuario: null,

  /**
   * Autentica no backend e guarda token + usuario.
   * @param {string} email
   * @param {string} senha
   */
  login: async (email, senha) => {
    const { data } = await api.post("/auth/login", { email, senha })
    localStorage.setItem(TOKEN_KEY, data.token)
    set({ token: data.token, usuario: data.usuario })
    return data
  },

  /**
   * Encerra a sessao: revoga o token no backend e limpa o estado local.
   */
  logout: async () => {
    try {
      await api.post("/auth/logout")
    } catch {
      // Mesmo que a chamada falhe, limpamos a sessao local.
    }
    localStorage.removeItem(TOKEN_KEY)
    set({ token: null, usuario: null })
    // Sem isto o proximo usuario herdaria as chaves do anterior ate o
    // AppLayout recarregar — e veria, por um instante, um menu que nao e dele.
    usePermissaoStore.getState().limpar()
    // Volta as preferencias visuais ao padrao para o proximo usuario.
    usePreferenciaStore.getState().resetar()
  },

  /**
   * Recarrega os dados do usuario logado a partir do token (GET /auth/me).
   */
  carregarUsuario: async () => {
    const { data } = await api.get("/auth/me")
    set({ usuario: data.usuario })
    return data.usuario
  },

  /**
   * Atualiza o perfil (nome/celular) do usuario logado (PUT /auth/me).
   * @param {{nome, celular}} dados
   */
  atualizarPerfil: async (dados) => {
    const { data } = await api.put("/auth/me", dados)
    set({ usuario: data.usuario })
    return data.usuario
  },

  /**
   * Atualiza a foto/avatar do usuario logado (PUT /auth/me/foto).
   * @param {string|null} fotoUrl - Data URL (base64) da imagem, ou null para remover.
   */
  atualizarFoto: async (fotoUrl) => {
    const { data } = await api.put("/auth/me/foto", { foto_url: fotoUrl })
    set({ usuario: data.usuario })
    return data.usuario
  },

  /**
   * Define a nova senha no primeiro acesso (troca da senha provisoria).
   * Ao concluir, limpa a flag deve_redefinir_senha do usuario em memoria.
   * @param {string} novaSenha
   */
  definirNovaSenha: async (novaSenha) => {
    await api.post("/auth/definir-senha", { senha: novaSenha })
    set((s) => ({
      usuario: s.usuario ? { ...s.usuario, deve_redefinir_senha: false } : s.usuario,
    }))
  },
}))
