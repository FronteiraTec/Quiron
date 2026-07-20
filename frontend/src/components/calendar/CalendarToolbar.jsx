/**
 * CalendarToolbar - cabecalho da area principal do calendario.
 * Esquerda: titulo + contexto (incubadora). Centro: navegacao de data.
 * Direita: alternador de visao + botao de nova atividade.
 */
import { Box, Typography, IconButton, Button, ButtonGroup } from "@mui/material"
import { ChevronLeft, ChevronRight, Add, CalendarMonth } from "@mui/icons-material"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

const VISOES = [
  { chave: "dia", label: "Dia" },
  { chave: "semana", label: "Semana" },
  { chave: "mes", label: "Mes" },
  { chave: "agenda", label: "Agenda" },
]

export default function CalendarToolbar({
  contexto,
  dataReferencia,
  visao,
  onAnterior,
  onProximo,
  onHoje,
  onMudarVisao,
  onNovaAtividade,
}) {
  const rotuloData =
    visao === "dia"
      ? format(dataReferencia, "d 'de' MMMM, yyyy", { locale: ptBR })
      : format(dataReferencia, "MMMM yyyy", { locale: ptBR })

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 1.5,
        px: 2,
        py: 1,
        borderBottom: "1px solid",
        borderColor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)"),
      }}
    >
      {/* Esquerda: titulo + contexto */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
        <Box
          sx={{
            width: 30,
            height: 30,
            borderRadius: "9px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "primary.main",
            color: "primary.contrastText",
            flexShrink: 0,
          }}
        >
          <CalendarMonth sx={{ fontSize: 16 }} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={700} noWrap sx={{ lineHeight: 1.2 }}>
            Calendario da Incubacao
          </Typography>
          {contexto && (
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block", lineHeight: 1.2 }}>
              {contexto}
            </Typography>
          )}
        </Box>
      </Box>

      {/* Centro: navegacao */}
      <Box data-tour="calendario-navegacao" sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        <IconButton size="small" onClick={onAnterior} sx={{ border: "1px solid", borderColor: "divider", p: 0.5 }}>
          <ChevronLeft fontSize="small" />
        </IconButton>
        <Typography variant="body2" fontWeight={700} sx={{ minWidth: 130, textAlign: "center", textTransform: "capitalize" }}>
          {rotuloData}
        </Typography>
        <IconButton size="small" onClick={onProximo} sx={{ border: "1px solid", borderColor: "divider", p: 0.5 }}>
          <ChevronRight fontSize="small" />
        </IconButton>
        <Button size="small" variant="outlined" onClick={onHoje} sx={{ ml: 0.5, borderRadius: "8px" }}>
          Hoje
        </Button>
      </Box>

      {/* Direita: visao + nova atividade */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <ButtonGroup data-tour="calendario-visoes" size="small" sx={{ borderRadius: "10px", overflow: "hidden" }}>
          {VISOES.map((v) => (
            <Button
              key={v.chave}
              onClick={() => onMudarVisao(v.chave)}
              variant={visao === v.chave ? "contained" : "outlined"}
              disableElevation
            >
              {v.label}
            </Button>
          ))}
        </ButtonGroup>
        {onNovaAtividade && (
          <Button
            data-tour="calendario-nova-atividade"
            variant="contained"
            startIcon={<Add />}
            onClick={onNovaAtividade}
            sx={{ borderRadius: "10px" }}
          >
            Nova Atividade
          </Button>
        )}
      </Box>
    </Box>
  )
}
