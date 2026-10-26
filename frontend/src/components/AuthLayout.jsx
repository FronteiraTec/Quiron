/**
 * Moldura comum das telas de autenticacao (login, esqueci a senha, nova senha,
 * primeiro acesso).
 *
 * Duas colunas no desktop: a esquerda apresenta a marca (o centauro do Quiron
 * e o que o sistema faz), a direita traz o cartao com o formulario. No mobile
 * a coluna da marca some e sobra uma versao compacta (logo + nome) acima do
 * cartao — o formulario nunca disputa espaco com a apresentacao.
 *
 * O painel da marca e a capa do modelo de apresentacao (Desafio Empreende
 * UFFS 2026): fundo preto com o brilho verde no canto, titulo em Anton, o
 * subtitulo vazado, a barra lima-clara ao lado do texto e a faixa diagonal.
 * Ele e preto nas duas aparencias, de proposito — e a assinatura da marca.
 * Quem acompanha a aparencia escolhida e a coluna do formulario.
 */
import { Box, Paper, Typography, useTheme } from "@mui/material"
import { alpha } from "@mui/material/styles"
import { motion, useReducedMotion } from "framer-motion"
import { LogoQuiron } from "./marca/MarcaQuiron"
import { FONTES, MARCA } from "../theme"

// Texto da fita diagonal: os modulos do sistema, em loop (repetido o bastante
// para atravessar o painel inteiro mesmo inclinado).
const FITA = "Quiron | Startups | Mentoria | Jornada | Entregas | ".repeat(4)

/**
 * @param {object} props
 * @param {string} props.titulo - Titulo do cartao (ex.: "Entrar").
 * @param {string} [props.subtitulo] - Linha de apoio abaixo do titulo.
 * @param {React.ReactNode} props.children - Conteudo do cartao (o formulario).
 */
export default function AuthLayout({ titulo, subtitulo, children }) {
  const theme = useTheme()
  const semMovimento = useReducedMotion()
  const escuro = theme.palette.mode === "dark"

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        // Painel da marca só a partir de md; abaixo disso, uma coluna.
        gridTemplateColumns: { xs: "1fr", md: "1.05fr 1fr" },
        bgcolor: "background.default",
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
          py: 8,
          bgcolor: MARCA.preto,
          color: MARCA.branco,
          backgroundImage: `radial-gradient(640px 480px at 100% 0%, ${alpha(MARCA.lima, 0.28)}, transparent 62%)`,
        }}
      >
        <Box sx={{ position: "relative", zIndex: 1, maxWidth: 520 }}>
          {/* alt vazio: o nome "Quiron" vem logo abaixo, em texto. */}
          <LogoQuiron cor={MARCA.lima} detalhe={MARCA.preto} sx={{ width: 96, height: 96, mb: 3 }} />

          <Typography
            component="h1"
            sx={{
              fontFamily: FONTES.titulo,
              fontSize: { md: 96, lg: 120 },
              lineHeight: 0.9,
              letterSpacing: "0.01em",
              textTransform: "uppercase",
            }}
          >
            Quiron
          </Typography>

          {/* Vazado, como o "TEXTO TEXTO TEXTO" do modelo. O respiro de cima
              e para o til de "GESTÃO" nao encostar na base do nome. */}
          <Typography
            sx={{
              mt: 1.5,
              fontFamily: FONTES.titulo,
              fontSize: { md: 40, lg: 50 },
              lineHeight: 1.05,
              textTransform: "uppercase",
              color: "transparent",
              WebkitTextStroke: `1.5px ${MARCA.branco}`,
            }}
          >
            Gestão de incubação
          </Typography>

          <Box sx={{ mt: 4, pl: 2.5, borderLeft: `3px solid ${MARCA.limaClaro}` }}>
            <Typography
              sx={{
                fontFamily: FONTES.larga,
                fontWeight: 300,
                fontSize: 15,
                lineHeight: 1.75,
                color: alpha(MARCA.branco, 0.86),
              }}
            >
              A plataforma que organiza o dia a dia do seu programa de incubação,
              das startups às mentorias, da jornada às entregas.
            </Typography>
          </Box>
        </Box>

        {/* Faixa diagonal: a fita escura com texto e o traço lima cruzando,
            como nos slides do modelo. So decoracao — e some em telas baixas,
            onde passaria por cima do texto. */}
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            "@media (max-height: 680px)": { display: "none" },
          }}
        >
          <Box
            sx={{
              position: "absolute",
              left: "-6%",
              bottom: 92,
              width: "125%",
              height: 42,
              display: "flex",
              alignItems: "center",
              bgcolor: "#242424",
              transform: "rotate(7deg)",
              transformOrigin: "left center",
              overflow: "hidden",
            }}
          >
            <Typography
              component="span"
              sx={{
                pl: 3,
                whiteSpace: "nowrap",
                fontFamily: FONTES.larga,
                fontWeight: 700,
                fontSize: 15,
                letterSpacing: "0.02em",
                textTransform: "uppercase",
              }}
            >
              {FITA}
            </Typography>
          </Box>
          <Box
            sx={{
              position: "absolute",
              right: "-8%",
              bottom: 40,
              width: "78%",
              height: 14,
              bgcolor: MARCA.lima,
              transform: "rotate(-8deg)",
              transformOrigin: "right center",
            }}
          />
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
          {/* Marca compacta: substitui o painel da esquerda no mobile. O
              centauro acompanha a aparencia (escuro no claro, claro no
              escuro); os detalhes tem a cor do fundo, para lerem como recorte. */}
          <Box
            sx={{
              display: { xs: "flex", md: "none" },
              alignItems: "center",
              justifyContent: "center",
              gap: 1.5,
              mb: 3,
            }}
          >
            <LogoQuiron
              cor={escuro ? theme.palette.text.primary : "#121212"}
              detalhe={theme.palette.background.default}
              sx={{ width: 44, height: 44 }}
            />
            <Typography
              sx={{
                fontFamily: FONTES.titulo,
                fontSize: 34,
                lineHeight: 1,
                letterSpacing: "0.02em",
                textTransform: "uppercase",
              }}
            >
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
                // O traco de cima no preenchimento vivo: no claro, o lima.
                borderTop: `4px solid ${theme.palette.primary.vivo}`,
              }}
            >
              <Typography variant="h5" component="h2">
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
