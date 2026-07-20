/**
 * Minha Empresa (Home do incubado) — o centro emocional da experiencia.
 *
 * Aqui o protagonista NAO e o programa (a trilha), e a EMPRESA: o Blueprint das
 * areas que vao ganhando forma, o radar de maturidade, a linha do tempo (a
 * biografia da startup) e um unico "proximo passo" que leva de volta a Jornada.
 *
 * Tudo derivado do useJornada, que le da API (/jornada).
 */
import { useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Box, Paper, Typography, Button, LinearProgress, Chip } from "@mui/material"
import { PlayArrow, AutoAwesome, Insights, History as HistoryIcon } from "@mui/icons-material"
import { motion } from "framer-motion"
import AppLayout from "../components/AppLayout"
import { useJornada } from "../hooks/useJornada"
import CompanyBlueprint from "../components/empresa/CompanyBlueprint"
import MaturityRadar from "../components/empresa/MaturityRadar"
import StartupTimeline from "../components/empresa/StartupTimeline"

function statementDe(pct) {
  if (pct < 25) return "Uma ideia em exploracao."
  if (pct < 55) return "Um problema validado, em busca do modelo certo."
  if (pct < 85) return "Um modelo validado, construindo o produto."
  return "Um produto no mercado, pronto para escalar."
}

export default function MinhaEmpresa() {
  const j = useJornada()
  const navigate = useNavigate()

  const estagioAtual = j.jornada.estagios.find((e) => e.status === "EM_ANDAMENTO")
  const proximoPasso = useMemo(
    () => j.passosFlat.find((p) => p.id === j.proximoPassoId) ?? null,
    [j.passosFlat, j.proximoPassoId]
  )

  const irParaProximo = () => {
    if (proximoPasso) j.setSelecionadoId(proximoPasso.id)
    navigate("/jornada")
  }

  return (
    <AppLayout>
      <Box>
        {/* Cabecalho: identidade + statement + proximo passo */}
        <Box
          component={motion.div}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 2,
            alignItems: "center",
            justifyContent: "space-between",
            mb: 3,
          }}
        >
          <Box>
            <Typography variant="h4" fontWeight={800}>
              {j.jornada.startup}
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 1 }}>
              {statementDe(j.progressoGeral.pct)}
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              {estagioAtual && (
                <Chip
                  size="small"
                  label={`Estagio: ${estagioAtual.nome}`}
                  sx={{ fontWeight: 700, bgcolor: "primary.main", color: "primary.contrastText" }}
                />
              )}
              <Chip
                size="small"
                icon={<AutoAwesome sx={{ fontSize: 15 }} />}
                label={`Maturidade ${j.maturidade.pct}%`}
                variant="outlined"
              />
            </Box>
          </Box>

          {proximoPasso && (
            <Paper
              elevation={0}
              sx={{
                p: 2,
                minWidth: 260,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 0,
                display: "flex",
                flexDirection: "column",
                gap: 1,
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
                PROXIMO PASSO
              </Typography>
              <Typography sx={{ fontWeight: 700, lineHeight: 1.25 }}>{proximoPasso.titulo}</Typography>
              <Typography variant="caption" color="text.secondary">
                {proximoPasso.estagio.nome} · {proximoPasso.frente}
              </Typography>
              <Button
                variant="contained"
                startIcon={<PlayArrow />}
                onClick={irParaProximo}
                sx={{ textTransform: "none", mt: 0.5 }}
              >
                Continuar jornada
              </Button>
            </Paper>
          )}
        </Box>

        {/* Grade: Blueprint (grande) + radar/linha do tempo */}
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", md: "1.6fr 1fr" },
            alignItems: "start",
          }}
        >
          {/* Blueprint */}
          <Paper elevation={0} sx={{ p: 2.5, border: "1px solid", borderColor: "divider", borderRadius: 0 }}>
            <SecaoTitulo icone={<AutoAwesome sx={{ fontSize: 18 }} />} texto="A sua empresa" />
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Sua empresa esta {j.maturidade.pct}% estruturada. Cada area se acende
              quando voce conclui os passos que a constroem.
            </Typography>
            <CompanyBlueprint areas={j.areasEmpresa} />
          </Paper>

          {/* Coluna direita */}
          <Box sx={{ display: "grid", gap: 2 }}>
            <Paper elevation={0} sx={{ p: 2.5, border: "1px solid", borderColor: "divider", borderRadius: 0 }}>
              <SecaoTitulo icone={<Insights sx={{ fontSize: 18 }} />} texto="Maturidade" />
              <MaturityRadar dados={j.maturidade.radar} />
            </Paper>

            <Paper elevation={0} sx={{ p: 2.5, border: "1px solid", borderColor: "divider", borderRadius: 0 }}>
              <SecaoTitulo icone={<HistoryIcon sx={{ fontSize: 18 }} />} texto="Linha do tempo" />
              <StartupTimeline eventos={j.linhaTempo} />
            </Paper>
          </Box>
        </Box>
      </Box>
    </AppLayout>
  )
}

function SecaoTitulo({ icone, texto }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 1.5, color: "primary.main" }}>
      {icone}
      <Typography sx={{ fontWeight: 700, fontSize: 15 }} color="text.primary">
        {texto}
      </Typography>
    </Box>
  )
}
