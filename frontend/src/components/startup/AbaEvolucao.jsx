/**
 * Aba "Evolucao": o quanto a empresa ja ganhou forma.
 *
 * Reune o que antes era a tela "Minha Empresa": o Blueprint das fases, o radar
 * de maturidade e a linha do tempo dos marcos aprovados.
 *
 * Tudo deriva das FASES que a incubadora monta no Construtor — nao ha lista
 * fixa de areas aqui.
 *
 * Diferente das outras abas, esta NAO recebe idStartup: le do useJornada, que
 * resolve a startup do usuario logado. Por isso serve so na MinhaStartup — em
 * StartupDetail (admin/mentor olhando outra startup) ela mostraria os dados
 * errados.
 */
import { Box, Typography } from "@mui/material"
import { AutoAwesome, Insights, History as HistoryIcon } from "@mui/icons-material"
import { useJornada } from "../../hooks/useJornada"
import CompanyBlueprint from "../empresa/CompanyBlueprint"
import MaturityRadar from "../empresa/MaturityRadar"
import StartupTimeline from "../empresa/StartupTimeline"

export default function AbaEvolucao() {
  const j = useJornada()

  // Abaixo de 3 eixos o Recharts desenha uma linha/angulo, nao um poligono —
  // fica pior que nao mostrar.
  const radarVale = j.radarFases.length >= 3

  return (
    <Box
      sx={{
        display: "grid",
        gap: 3,
        gridTemplateColumns: { xs: "1fr", md: radarVale ? "1.6fr 1fr" : "1fr" },
        alignItems: "start",
      }}
    >
      <Box>
        <SecaoTitulo icone={<AutoAwesome sx={{ fontSize: 18 }} />} texto="A sua empresa" />
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Você concluiu {j.progressoGeral.feitos} de {j.progressoGeral.total} passos da trilha
          {" "}({j.progressoGeral.pct}%). Cada fase se acende quando você conclui os passos dela.
        </Typography>
        <CompanyBlueprint fases={j.blueprintFases} />
      </Box>

      <Box sx={{ display: "grid", gap: 3 }}>
        {radarVale && (
          <Box>
            <SecaoTitulo icone={<Insights sx={{ fontSize: 18 }} />} texto="Maturidade" />
            <MaturityRadar dados={j.radarFases} />
          </Box>
        )}

        <Box>
          <SecaoTitulo icone={<HistoryIcon sx={{ fontSize: 18 }} />} texto="Linha do tempo" />
          <StartupTimeline eventos={j.linhaTempo} />
        </Box>
      </Box>
    </Box>
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
