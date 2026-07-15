/**
 * MiniCalendar - calendario mensal compacto da sidebar.
 * Ao clicar num dia, chama onSelecionar(data) para navegar o calendario principal.
 */
import { useMemo, useState, useEffect } from "react"
import { Box, IconButton, Typography, alpha } from "@mui/material"
import { ChevronLeft, ChevronRight } from "@mui/icons-material"
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  format,
  isSameDay,
  isSameMonth,
  isToday,
} from "date-fns"
import { ptBR } from "date-fns/locale"

const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"]

export default function MiniCalendar({ dataSelecionada, onSelecionar, diasComEvento = new Set() }) {
  const [mesExibido, setMesExibido] = useState(startOfMonth(dataSelecionada))

  // Acompanha a navegacao feita no calendario principal.
  useEffect(() => {
    setMesExibido(startOfMonth(dataSelecionada))
  }, [dataSelecionada])

  const dias = useMemo(() => {
    const inicio = startOfWeek(startOfMonth(mesExibido), { weekStartsOn: 0 })
    const fim = endOfWeek(endOfMonth(mesExibido), { weekStartsOn: 0 })
    return eachDayOfInterval({ start: inicio, end: fim })
  }, [mesExibido])

  return (
    <Box sx={{ px: 2, py: 1 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography variant="body2" fontWeight={700} sx={{ textTransform: "capitalize" }}>
          {format(mesExibido, "MMMM yyyy", { locale: ptBR })}
        </Typography>
        <Box>
          <IconButton size="small" onClick={() => setMesExibido((m) => subMonths(m, 1))}>
            <ChevronLeft fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => setMesExibido((m) => addMonths(m, 1))}>
            <ChevronRight fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0.5, mb: 0.5 }}>
        {DIAS_SEMANA.map((d, i) => (
          <Typography
            key={i}
            variant="caption"
            align="center"
            sx={{ color: "text.disabled", fontSize: 10.5, fontWeight: 600 }}
          >
            {d}
          </Typography>
        ))}
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0.5 }}>
        {dias.map((dia) => {
          const foraDoMes = !isSameMonth(dia, mesExibido)
          const selecionado = isSameDay(dia, dataSelecionada)
          const hoje = isToday(dia)
          const temEvento = diasComEvento.has(format(dia, "yyyy-MM-dd"))

          return (
            <Box
              key={dia.toISOString()}
              onClick={() => onSelecionar(dia)}
              sx={{
                position: "relative",
                aspectRatio: "1 / 1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "8px",
                fontSize: 12.5,
                fontWeight: selecionado ? 700 : 500,
                cursor: "pointer",
                color: selecionado
                  ? "primary.contrastText"
                  : foraDoMes
                    ? "text.disabled"
                    : hoje
                      ? "primary.main"
                      : "text.primary",
                bgcolor: selecionado ? "primary.main" : "transparent",
                border: hoje && !selecionado ? "1px solid" : "1px solid transparent",
                borderColor: hoje && !selecionado ? "primary.main" : "transparent",
                transition: "background-color 140ms ease",
                "&:hover": { bgcolor: (t) => (selecionado ? "primary.main" : alpha(t.palette.primary.main, 0.1)) },
              }}
            >
              {format(dia, "d")}
              {temEvento && !selecionado && (
                <Box
                  sx={{
                    position: "absolute",
                    bottom: 3,
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    bgcolor: "primary.main",
                  }}
                />
              )}
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
