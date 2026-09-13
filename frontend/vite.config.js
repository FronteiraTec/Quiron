import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // Em dev, o axios usa baseURL "/api". Aqui encaminhamos essas chamadas
    // para o Nginx do stack Docker (localhost:80), que faz o proxy interno
    // ate o backend (node_api:3000, nao publicado no host). Em producao o
    // proprio Nginx serve o frontend, entao este proxy so vale no dev.
    proxy: {
      "/api": {
        target: "http://localhost:80",
        changeOrigin: true,
      },
    },
  },
  // Testes do frontend (`npm test`). Cobrem a logica propria — o hook de
  // salvamento automatico e as funcoes sobre o documento —, e nao o
  // comportamento do BlockNote, que e responsabilidade da biblioteca.
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{js,jsx}"],
  },
})
