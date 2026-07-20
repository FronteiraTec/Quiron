/**
 * Radar de maturidade da startup (Recharts).
 *
 * Mostra o quanto cada area da empresa esta desenvolvida, em linguagem que
 * investidor entende (diagnostico), nao de jogo. O poligono cresce conforme os
 * passos vao sendo aprovados.
 */
import { useTheme } from "@mui/material"
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts"

export default function MaturityRadar({ dados }) {
  const theme = useTheme()
  const cor = theme.palette.primary.main

  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart data={dados} outerRadius="72%">
        <PolarGrid stroke={theme.palette.divider} />
        <PolarAngleAxis
          dataKey="area"
          tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
        />
        <Radar
          dataKey="valor"
          stroke={cor}
          fill={cor}
          fillOpacity={0.35}
          isAnimationActive
          animationDuration={800}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}
