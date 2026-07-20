/**
 * Tela de 404 - rota inexistente.
 *
 * Usada pelo catch-all do App.jsx. Fica em tela cheia (sem Navbar/Sidebar),
 * entao serve tanto para usuario logado quanto para visitante.
 *
 * A animacao (src/assets/404-animation.json) e um Lottie quadrado (1080x1080)
 * usado como fundo: o "slice" no preserveAspectRatio faz ela cobrir a tela
 * inteira, cortando topo/base em monitores widescreen. A linha do chao da cena
 * fica no meio da composicao, entao o corte preserva o dino e o "404".
 *
 * O texto vai sobreposto na base, onde a cena e area branca vazia. O botao
 * volta para "/", que o ProtectedRoute manda para o login se nao houver sessao.
 */
import { useNavigate } from "react-router-dom"
import { Box, Button, Typography } from "@mui/material"
import { ArrowBack } from "@mui/icons-material"
import Lottie from "lottie-react"
import animacao404 from "../assets/404-animation.json"

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <Box
      sx={{
        position: "relative",
        height: "100vh",
        width: "100%",
        overflow: "hidden",
        // Mesmo branco do fundo da animacao, para nao aparecer emenda.
        bgcolor: "#fff",
      }}
    >
      {/* Camada de fundo: a animacao cobrindo todo o viewport. */}
      <Box sx={{ position: "absolute", inset: 0 }}>
        <Lottie
          animationData={animacao404}
          loop
          autoplay
          rendererSettings={{ preserveAspectRatio: "xMidYMid slice" }}
          style={{ width: "100%", height: "100%" }}
        />
      </Box>

      {/* Camada de conteudo: ancorada na base, sobre a area branca da cena. */}
      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-end",
          textAlign: "center",
          px: 2,
          pb: { xs: 5, sm: 8 },
          // Deixa o clique passar para a animacao, menos nos elementos abaixo.
          pointerEvents: "none",
          "& > *": { pointerEvents: "auto" },
        }}
      >
      </Box>
    </Box>
  )
}
