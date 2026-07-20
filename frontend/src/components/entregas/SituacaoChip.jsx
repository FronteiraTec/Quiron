/**
 * Chip da situacao de uma entrega na fila do mentor.
 * Le tudo do mapa SITUACAO (avaliacaoMeta), como o StatusPasso faz na Jornada.
 */
import { Chip } from "@mui/material"
import { SITUACAO } from "../../data/avaliacaoMeta"

export default function SituacaoChip({ situacao, size = "small" }) {
  const meta = SITUACAO[situacao] || SITUACAO.PENDENTE
  const Icone = meta.icon

  return (
    <Chip
      size={size}
      icon={<Icone sx={{ fontSize: 16, color: `${meta.cor} !important` }} />}
      label={meta.label}
      sx={{
        height: 24,
        fontWeight: 700,
        fontSize: 12,
        bgcolor: `${meta.cor}1f`,
        color: meta.cor,
      }}
    />
  )
}
