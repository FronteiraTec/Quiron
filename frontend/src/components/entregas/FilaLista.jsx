/**
 * Coluna esquerda da tela de Entregas: a fila em si.
 *
 * Cada item mostra o que o mentor precisa para decidir se abre agora — qual
 * startup, qual passo e ha quanto tempo espera. O tempo de espera fica em
 * destaque quando passa de DIAS_FILA_CRITICA: e o mesmo corte que o relatorio
 * "Entregas e avaliacoes" usa para separar fila de problema.
 */
import { Box, Typography, Tooltip } from "@mui/material"
import { Inbox, WarningAmber } from "@mui/icons-material"
import SituacaoChip from "./SituacaoChip"

// Uma entrega parada mais de uma semana deixou de ser fila e virou problema.
export const DIAS_FILA_CRITICA = 7

/** Dias inteiros desde o envio. */
export function diasEsperando(iso) {
  if (!iso) return 0
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

function esperaLegivel(dias) {
  if (dias <= 0) return "hoje"
  if (dias === 1) return "ontem"
  return `ha ${dias} dias`
}

export default function FilaLista({ entregas, selecionada, onSelecionar }) {
  if (entregas.length === 0) {
    return (
      <Box sx={{ textAlign: "center", py: 8, px: 3, color: "text.secondary" }}>
        <Inbox sx={{ fontSize: 48, opacity: 0.4 }} />
        <Typography sx={{ mt: 1 }}>Nenhuma entrega por aqui.</Typography>
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          Quando uma startup enviar, ela aparece nesta fila.
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ overflowY: "auto", flex: 1 }}>
      {entregas.map((e, i) => {
        const dias = diasEsperando(e.atualizado_ts || e.criado_ts)
        const atrasada = e.situacao === "PENDENTE" && dias >= DIAS_FILA_CRITICA
        const ativa = selecionada === e.id_entrega

        return (
          <Box
            key={e.id_entrega}
            onClick={() => onSelecionar(e.id_entrega)}
            sx={{
              px: 2.5,
              py: 1.75,
              cursor: "pointer",
              borderTop: i === 0 ? "none" : "1px solid",
              borderColor: "divider",
              // A barra na lateral marca o item aberto sem precisar de fundo forte.
              borderLeft: "3px solid",
              borderLeftColor: ativa ? "primary.main" : "transparent",
              bgcolor: ativa ? "action.selected" : "transparent",
              "&:hover": { bgcolor: ativa ? "action.selected" : "action.hover" },
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
              <Typography fontWeight={700} noWrap sx={{ flex: 1, minWidth: 0 }}>
                {e.startup}
              </Typography>
              <SituacaoChip situacao={e.situacao} />
            </Box>

            <Typography variant="body2" noWrap sx={{ color: "text.primary" }}>
              {e.passo}
            </Typography>

            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.5 }}>
              {e.fase && (
                <Typography variant="caption" color="text.secondary" noWrap sx={{ minWidth: 0 }}>
                  {e.fase}
                  {e.modulo ? ` · ${e.modulo}` : ""}
                </Typography>
              )}
              <Box sx={{ flex: 1 }} />
              {atrasada && (
                <Tooltip title={`Parada ha ${dias} dias`} arrow>
                  <WarningAmber sx={{ fontSize: 15, color: "#f97316" }} />
                </Tooltip>
              )}
              <Typography
                variant="caption"
                sx={{
                  color: atrasada ? "#f97316" : "text.secondary",
                  fontWeight: atrasada ? 700 : 400,
                  flexShrink: 0,
                }}
              >
                {esperaLegivel(dias)}
              </Typography>
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}
