/**
 * O chip de STATUS de uma startup, com o rotulo e a cor que a incubadora
 * cadastrou.
 *
 * Mora num componente, e nao solto em cada tela, porque o mesmo status e
 * desenhado na lista de startups, no detalhe, em "Minha Startup", no painel do
 * mentor e na tela de membros — e todos precisam concordar. Era o papel de
 * data/startupMeta.js quando o status era um enum de tres valores; com o status
 * virando vocabulario de cada incubadora (migracao 010), o mapa fixo deixou de
 * dar conta e virou o FALLBACK.
 *
 * O fallback importa: a linha vem do backend ja com `situacao_rotulo` e
 * `situacao_cor`, mas uma startup cadastrada antes da migracao pode nao ter
 * situacao, e o store pode ter falhado ao carregar. Nesses casos o chip volta a
 * desenhar o estado de ciclo (`status`), que sempre existe — melhor "Ativa" com
 * a cor padrao do que uma lacuna na tabela.
 */
import { Chip } from "@mui/material"
import { STATUS_ROTULO, STATUS_COR } from "../../data/startupMeta"

export default function ChipSituacao({ startup, size = "small", sx }) {
  const rotulo = startup?.situacao_rotulo
  const cor = startup?.situacao_cor

  if (rotulo && cor) {
    return (
      <Chip
        size={size}
        label={rotulo}
        sx={{ bgcolor: cor, color: "#fff", fontWeight: 600, ...sx }}
      />
    )
  }

  const status = startup?.status
  return (
    <Chip
      size={size}
      label={rotulo || STATUS_ROTULO[status] || status || "—"}
      color={STATUS_COR[status] || "default"}
      sx={sx}
    />
  )
}
