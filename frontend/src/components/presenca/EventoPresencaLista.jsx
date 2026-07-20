/**
 * Coluna esquerda da tela de Presenca: os eventos ja realizados.
 *
 * O que o admin procura aqui e "de qual evento ainda falta fazer a chamada".
 * Por isso o destaque nao e a data nem a categoria, e o ANDAMENTO: evento sem
 * ninguem marcado aparece em laranja, evento com todo mundo marcado sai do
 * caminho em cinza.
 *
 * "Marcado" inclui quem foi marcado como AUSENTE — senao um evento onde todos
 * faltaram pareceria nunca ter sido conferido.
 */
import { Box, Typography, Tooltip, LinearProgress } from "@mui/material"
import { EventBusy, CheckCircle } from "@mui/icons-material"
import { categoriaInfo } from "../calendar/categorias"

function dataLegivel(iso) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export default function EventoPresencaLista({ eventos, selecionado, onSelecionar }) {
  if (eventos.length === 0) {
    return (
      <Box sx={{ textAlign: "center", py: 8, px: 3, color: "text.secondary" }}>
        <EventBusy sx={{ fontSize: 48, opacity: 0.4 }} />
        <Typography sx={{ mt: 1 }}>Nenhum evento realizado.</Typography>
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          A chamada so faz sentido depois que o evento acontece — eventos
          futuros nao aparecem aqui.
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ overflowY: "auto", flex: 1 }}>
      {eventos.map((ev, i) => {
        const meta = categoriaInfo(ev.categoria)
        const ativo = selecionado === ev.id_evento
        const completo = ev.publico > 0 && ev.marcados === ev.publico
        const naoIniciado = ev.marcados === 0
        const pct = ev.publico > 0 ? (ev.marcados / ev.publico) * 100 : 0

        return (
          <Box
            key={ev.id_evento}
            onClick={() => onSelecionar(ev.id_evento)}
            sx={{
              px: 2.5,
              py: 1.75,
              cursor: "pointer",
              borderTop: i === 0 ? "none" : "1px solid",
              borderColor: "divider",
              borderLeft: "3px solid",
              borderLeftColor: ativo ? "primary.main" : "transparent",
              bgcolor: ativo ? "action.selected" : "transparent",
              "&:hover": { bgcolor: ativo ? "action.selected" : "action.hover" },
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
              <meta.Icone sx={{ fontSize: 17, color: meta.cor, flexShrink: 0 }} />
              <Typography fontWeight={700} noWrap sx={{ flex: 1, minWidth: 0 }}>
                {ev.titulo}
              </Typography>
              {completo && (
                <Tooltip title="Chamada completa" arrow>
                  <CheckCircle sx={{ fontSize: 17, color: "success.main", flexShrink: 0 }} />
                </Tooltip>
              )}
            </Box>

            <Typography variant="caption" color="text.secondary" component="div" noWrap>
              {dataLegivel(ev.inicio_ts)}
              {ev.local ? ` · ${ev.local}` : ""}
              {ev.obrigatorio ? " · obrigatorio" : ""}
            </Typography>

            <LinearProgress
              variant="determinate"
              value={pct}
              sx={{
                mt: 1,
                height: 4,
                borderRadius: 2,
                bgcolor: "action.hover",
                "& .MuiLinearProgress-bar": {
                  bgcolor: completo ? "success.main" : naoIniciado ? "#f97316" : "primary.main",
                },
              }}
            />

            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.75 }}>
              {naoIniciado ? (
                <Typography variant="caption" sx={{ color: "#f97316", fontWeight: 700 }}>
                  chamada nao feita
                </Typography>
              ) : (
                <Typography variant="caption" color="text.secondary">
                  {ev.marcados}/{ev.publico} marcados
                </Typography>
              )}
              <Box sx={{ flex: 1 }} />
              {ev.marcados > 0 && (
                <Typography variant="caption" sx={{ color: "success.main", fontWeight: 700 }}>
                  {ev.presentes} {ev.presentes === 1 ? "presente" : "presentes"}
                </Typography>
              )}
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}
