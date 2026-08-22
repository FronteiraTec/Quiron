/**
 * O chip de STATUS do mentor (ATIVO / INDISPONIVEL / INATIVO).
 *
 * Mora num componente pelo mesmo motivo do ChipSituacao da startup: o mesmo
 * status aparece na listagem, no cadastro e no cabecalho do painel, e os tres
 * precisam concordar na cor.
 *
 * "Ativo" sai VAZADO e os outros dois PREENCHIDOS de proposito. O normal e ser
 * ativo — se ele viesse solido, uma tabela de trinta mentores seria trinta
 * chips verdes gritando, e justamente os dois casos que pedem acao (o
 * indisponivel e o inativo) se perderiam no meio.
 */
import { Chip } from "@mui/material"
import { corSituacao, rotuloSituacao, SITUACAO_ATIVO } from "./vocabulario"

export default function ChipSituacaoMentor({ situacao, size = "small", sx }) {
  const cor = corSituacao(situacao)
  const rotulo = rotuloSituacao(situacao)

  if (situacao === SITUACAO_ATIVO) {
    return (
      <Chip
        size={size}
        variant="outlined"
        label={rotulo}
        sx={{ borderColor: cor, color: cor, fontWeight: 600, ...sx }}
      />
    )
  }

  return (
    <Chip
      size={size}
      label={rotulo}
      sx={{ bgcolor: cor, color: "#fff", fontWeight: 600, ...sx }}
    />
  )
}
