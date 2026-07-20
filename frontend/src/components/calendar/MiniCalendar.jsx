/**
 * MiniCalendar - calendario mensal compacto da sidebar.
 * Ao clicar num dia, chama onSelecionar(data) para navegar o calendario principal.
 *
 * Dimensionado para ocupar pouca altura: a grade e limitada por LARGURA_GRADE
 * (centralizada na sidebar) em vez de esticar ate a borda, entao as celulas
 * quadradas ficam pequenas e o bloco todo cabe no rodape sem empurrar as
 * secoes de cima.
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
const LARGURA_GRADE = 168

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
    <Box sx={{ px: 1.5, py: 0.75 }}>
      <Box sx={{ maxWidth: LARGURA_GRADE, mx: "auto" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
          <Typography sx={{ fontSize: 11.5, fontWeight: 700, textTransform: "capitalize" }}>
            {format(mesExibido, "MMM yyyy", { locale: ptBR })}
          </Typography>
          <Box sx={{ display: "flex", flexShrink: 0 }}>
            <IconButton size="small" sx={{ p: 0.25 }} onClick={() => setMesExibido((m) => subMonths(m, 1))}>
              <ChevronLeft sx={{ fontSize: 15 }} />
            </IconButton>
            <IconButton size="small" sx={{ p: 0.25 }} onClick={() => setMesExibido((m) => addMonths(m, 1))}>
              <ChevronRight sx={{ fontSize: 15 }} />
            </IconButton>
          </Box>
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0.25, mb: 0.25 }}>
          {DIAS_SEMANA.map((d, i) => (
            <Typography
              key={i}
              variant="caption"
              align="center"
              sx={{ color: "text.disabled", fontSize: 9, fontWeight: 600, lineHeight: 1.4 }}
            >
              {d}
            </Typography>
          ))}
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0.25 }}>
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
                  borderRadius: "5px",
                  fontSize: 10,
                  lineHeight: 1,
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
                      bottom: 1.5,
                      width: 3,
                      height: 3,
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
    </Box>
  )
}
