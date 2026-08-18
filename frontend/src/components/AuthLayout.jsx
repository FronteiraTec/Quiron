/**
 * Moldura comum das telas de autenticacao (login, esqueci a senha, nova senha,
 * primeiro acesso).
 *
 * Duas colunas no desktop: a esquerda apresenta a marca (o logo do Quiron e o
 * que o sistema faz), a direita traz o cartao com o formulario. No mobile a
 * coluna da marca some e sobra uma versao compacta (logo + nome) acima do
 * cartao — o formulario nunca disputa espaco com a apresentacao.
 *
 * O fundo e claro de proposito: o logo e um desenho escuro (#121212) e so
 * sobrevive sobre superficie clara. As manchas de cor saem de primary/secondary
 * do tema, entao a tela acompanha a cor escolhida nas preferencias.
 */
import { Box, Paper, Typography, useTheme } from "@mui/material"
import { alpha } from "@mui/material/styles"
import {
  RocketLaunchOutlined,
  GroupsOutlined,
  InsightsOutlined,
} from "@mui/icons-material"
import { motion, useReducedMotion } from "framer-motion"
import logo from "../assets/logo.svg"

// O que o sistema entrega, em uma linha cada. Fica so no painel da marca.

/**
 * @param {object} props
 * @param {string} props.titulo - Titulo do cartao (ex.: "Entrar").
 * @param {string} [props.subtitulo] - Linha de apoio abaixo do titulo.
 * @param {React.ReactNode} props.children - Conteudo do cartao (o formulario).
 */
export default function AuthLayout({ titulo, subtitulo, children }) {
  const theme = useTheme()
  const semMovimento = useReducedMotion()
  const primaria = theme.palette.primary.main
  const secundaria = theme.palette.secondary.main

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        // Painel da marca só a partir de md; abaixo disso, uma coluna.
        gridTemplateColumns: { xs: "1fr", md: "1.05fr 1fr" },
        bgcolor: "#f5f7fb",
      }}
    >
      {/* ---------- Painel da marca (desktop) ---------- */}
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          position: "relative",
          overflow: "hidden",
          flexDirection: "column",
          justifyContent: "center",
          px: { md: 6, lg: 10 },
          bgcolor: "#ffffff",
          borderRight: "1px solid",
          borderColor: "divider",
          backgroundImage: `
            radial-gradient(900px 620px at 12% 18%, ${alpha(primaria, 0.12)}, transparent 62%),
            radial-gradient(760px 540px at 88% 88%, ${alpha(secundaria, 0.12)}, transparent 60%)
          `,
        }}
      >
        {/* Marca d'agua: o proprio logo, grande e quase invisivel, so para dar
            profundidade ao painel. aria-hidden porque nao informa nada. */}
        <Box
          component="img"
          src={logo}
          alt=""
          aria-hidden
          sx={{
            position: "absolute",
            right: -140,
            bottom: -160,
            width: 560,
            opacity: 0.04,
            pointerEvents: "none",
            userSelect: "none",
          }}
        />

        <Box sx={{ position: "relative", maxWidth: 460 }}>
          {/* aria-hidden: o nome "Quiron" vem logo abaixo, em texto. */}
          <Box
            component="img"
            src={logo}
            alt=""
            aria-hidden
            sx={{ width: 96, height: 96, display: "block", mb: 3 }}
          />

          <Typography variant="h3" fontWeight={800} letterSpacing={-1.5}>
            Quiron
          </Typography>

          <Typography variant="h6" fontWeight={400} color="text.secondary" sx={{ mt: 1.5 }}>
            A plataforma que organiza o dia a dia do seu programa de incubação —
            das startups às mentorias, da jornada às entregas.
          </Typography>
        </Box>
      </Box>

      {/* ---------- Coluna do formulario ---------- */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: { xs: 2, sm: 4 },
        }}
      >
        <Box sx={{ width: "100%", maxWidth: 420 }}>
          {/* Marca compacta: substitui o painel da esquerda no mobile. */}
          <Box
            sx={{
              display: { xs: "flex", md: "none" },
              alignItems: "center",
              justifyContent: "center",
              gap: 1.5,
              mb: 3,
            }}
          >
            <Box component="img" src={logo} alt="" aria-hidden sx={{ width: 44, height: 44 }} />
            <Typography variant="h5" fontWeight={800} letterSpacing={-0.5}>
              Quiron
            </Typography>
          </Box>

          <Box
            component={motion.div}
            initial={semMovimento ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <Paper
              elevation={0}
              sx={{
                p: { xs: 3, sm: 4 },
                borderRadius: 0,
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Typography variant="h5" fontWeight={700}>
                {titulo}
              </Typography>
              {subtitulo && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {subtitulo}
                </Typography>
              )}

              <Box sx={{ mt: 3 }}>{children}</Box>
            </Paper>
          </Box>

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", textAlign: "center", mt: 3 }}
          >
            © {new Date().getFullYear()} Quiron
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}
