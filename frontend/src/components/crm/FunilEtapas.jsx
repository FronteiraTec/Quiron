/**
 * O funil na tela da oportunidade: as etapas em sequencia, com a atual marcada
 * e as anteriores preenchidas, e o desfecho no fim.
 *
 * Aberta, cada etapa e um botao que move a oportunidade para ela (com o
 * historico registrando a mudanca). Encerrada, o funil e so leitura: mostra
 * em que etapa ela estava quando foi ganha ou perdida.
 */
import { Box, ButtonBase, Tooltip, Typography } from "@mui/material"
import { alpha } from "@mui/material/styles"
import { Check, EmojiEventsOutlined, ThumbDownAltOutlined } from "@mui/icons-material"

export default function FunilEtapas({ etapas = [], idEtapaAtual, situacao, onMover, desabilitado = false }) {
  // A etapa atual pode ter sido desativada depois: continua aparecendo, no lugar dela.
  const lista = etapas.filter((e) => e.ativo || e.id_etapa === idEtapaAtual)
  const indiceAtual = lista.findIndex((e) => e.id_etapa === idEtapaAtual)
  const aberta = situacao === "ABERTA"

  return (
    <Box
      role="list"
      aria-label="Etapas do funil"
      sx={{ display: "flex", gap: "3px", overflowX: "auto", pb: 0.5, scrollbarWidth: "thin" }}
    >
      {lista.map((etapa, i) => {
        const atual = i === indiceAtual
        const passada = i < indiceAtual
        const clicavel = aberta && !atual && !desabilitado && Boolean(onMover)
        return (
          <Tooltip key={etapa.id_etapa} title={clicavel ? `Mover para “${etapa.nome}”` : ""}>
            <Box role="listitem" sx={{ flex: "1 0 auto", minWidth: 96 }}>
              <ButtonBase
                disabled={!clicavel}
                onClick={() => onMover?.(etapa)}
                aria-current={atual ? "step" : undefined}
                aria-label={`${etapa.nome}${atual ? " (etapa atual)" : ""}`}
                sx={(t) => {
                  const preenchido = atual || passada
                  return {
                    width: "100%",
                    height: 36,
                    px: 1.5,
                    gap: 0.5,
                    justifyContent: "center",
                    // Chevron: a ponta para a direita diz o sentido do funil.
                    clipPath: i === 0 ? "polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)" : "polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%)",
                    bgcolor: atual
                      ? t.palette.primary.vivo
                      : passada
                        ? alpha(t.palette.primary.vivo, t.palette.mode === "dark" ? 0.3 : 0.28)
                        : t.palette.action.hover,
                    color: atual ? t.palette.primary.vivoContraste : preenchido ? t.palette.text.primary : t.palette.text.secondary,
                    opacity: !aberta && !atual ? 0.7 : 1,
                    transition: "background-color .15s",
                    "&:hover": clicavel ? { bgcolor: alpha(t.palette.primary.vivo, 0.45) } : undefined,
                    "&.Mui-focusVisible": { outline: `2px solid ${t.palette.primary.main}`, outlineOffset: -2 },
                    "&.Mui-disabled": { color: atual ? t.palette.primary.vivoContraste : undefined },
                  }
                }}
              >
                {passada && <Check sx={{ fontSize: 15 }} aria-hidden />}
                <Typography component="span" variant="caption" fontWeight={atual ? 800 : 600} noWrap>
                  {etapa.nome}
                </Typography>
              </ButtonBase>
            </Box>
          </Tooltip>
        )
      })}

      {!aberta && (
        <Box role="listitem" sx={{ flex: "1 0 auto", minWidth: 96 }}>
          <Box
            sx={(t) => {
              const cor = situacao === "GANHA" ? t.palette.success.main : t.palette.error.main
              return {
                height: 36,
                px: 1.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 0.5,
                clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%, 10px 50%)",
                bgcolor: alpha(cor, t.palette.mode === "dark" ? 0.3 : 0.16),
                color: cor,
              }
            }}
          >
            {situacao === "GANHA" ? <EmojiEventsOutlined sx={{ fontSize: 16 }} aria-hidden /> : <ThumbDownAltOutlined sx={{ fontSize: 16 }} aria-hidden />}
            <Typography component="span" variant="caption" fontWeight={800}>
              {situacao === "GANHA" ? "Ganha" : "Perdida"}
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  )
}
