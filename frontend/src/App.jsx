import { useEffect } from "react"

export default function App() {
  useEffect(() => {
    const bootStatusElement = document.getElementById("boot-status")
    if (bootStatusElement) {
      bootStatusElement.style.display = "none"
    }
  }, [])

  return (
    <div
      style={{
        minHeight: "100vh",
        margin: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f5f7fb",
        color: "#111827",
        fontFamily: "Segoe UI, Arial, sans-serif",
      }}
    >
      <h1 style={{ fontSize: "2.2rem", margin: 0 }}>Bem vindo ao Quiron</h1>
    </div>
  )
}