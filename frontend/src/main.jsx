import React from "react"
import ReactDOM from "react-dom/client"
// Fontes da identidade visual (ver FONTES em theme.js), servidas junto com o
// build em vez de buscadas no Google Fonts.
import "@fontsource/anton"
import "@fontsource-variable/unbounded"
import "@fontsource-variable/plus-jakarta-sans"
import App from "./App"

const rootElement = document.getElementById("root")
const bootStatusElement = document.getElementById("boot-status")

if (!rootElement) {
  throw new Error("Elemento #root nao encontrado")
}

const showBootError = (message) => {
  if (!bootStatusElement) {
    return
  }

  bootStatusElement.style.display = "block"

  bootStatusElement.innerHTML =
    `<div style='padding:16px;font-family:Segoe UI,Arial,sans-serif;color:#991b1b;background:#fee2e2;border:1px solid #fecaca;border-radius:8px'>${message}</div>`
}

try {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
} catch (error) {
  console.error("Falha ao renderizar o frontend:", error)
  showBootError("Falha ao renderizar a interface. Verifique o console.")
}