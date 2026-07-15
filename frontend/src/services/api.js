/**
 * Cliente HTTP (axios) da aplicacao.
 *
 * baseURL "/api" -> o Nginx faz o proxy para o backend (backend:3000),
 * entao o frontend nunca fala direto com a API (comunicacao interna).
 *
 * Um interceptor injeta automaticamente o Bearer Token em toda requisicao,
 * e outro trata 401 (token invalido/expirado) forcando logout.
 */
import axios from "axios"

const api = axios.create({
  baseURL: "/api",
})

// Chave usada para guardar o token no localStorage.
export const TOKEN_KEY = "quiron_token"

// --- Request: anexa o Bearer Token, se existir ---
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// --- Response: se o token expirar (401), limpa e volta ao login ---
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      // Evita loop caso ja esteja na tela de login.
      if (window.location.pathname !== "/login") {
        window.location.href = "/login"
      }
    }
    return Promise.reject(error)
  }
)

export default api
