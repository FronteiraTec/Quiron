/**
 * Os marcadores das reunioes: a situacao (um rotulo so, ver reuniaoMeta) e a
 * categoria. Separados para a lista, o detalhe e a sala falarem igual.
 */
import { Box, Chip } from "@mui/material"
import { situacao } from "../../data/reuniaoMeta"

export function SituacaoReuniao({ reuniao, recebidoEm, agora, minutosAntes, size = "small" }) {
  const s = situacao(reuniao, recebidoEm, agora, minutosAntes)
  const aoVivo = s.chave === "EM_ANDAMENTO" || s.chave === "SALA_ABERTA"
  return (
    <Chip
      size={size}
      color={s.cor}
      variant={aoVivo ? "filled" : "outlined"}
      label={
        <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
          {aoVivo && (
            <Box
              component="span"
              aria-hidden
              sx={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                bgcolor: "currentColor",
                "@media (prefers-reduced-motion: no-preference)": {
                  animation: "reuniaoPulso 1.6s ease-in-out infinite",
                },
                "@keyframes reuniaoPulso": { "0%, 100%": { opacity: 1 }, "50%": { opacity: 0.35 } },
              }}
            />
          )}
          {s.rotulo}
        </Box>
      }
      sx={{ fontWeight: 600 }}
    />
  )
}

export function CategoriaReuniao({ reuniao }) {
  if (!reuniao?.categoria) return null
  const cor = reuniao.categoria_cor || "#64748b"
  return (
    <Chip
      size="small"
      label={reuniao.categoria_rotulo || reuniao.categoria}
      sx={{ bgcolor: `${cor}1f`, color: cor, fontWeight: 700 }}
    />
  )
}
