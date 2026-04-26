const express = require("express")
const cors = require("cors")

const app = express()

// Middlewares
app.use(cors())
app.use(express.json())

// Health check (importante pra Docker)
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "API is running" })
})

// Rota de teste
app.get("/", (req, res) => {
  res.send("Backend rodando 🚀")
})

// Porta
const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})