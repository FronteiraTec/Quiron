/**
 * CalendarGrid - area de calendario propriamente dita.
 * Renderiza a visao ativa: mes (grade de cards), semana/dia (colunas de
 * agenda) ou agenda (lista cronologica agrupada por dia).
 */
import { Box, Typography, CircularProgress } from "@mui/material"
import { EventNote } from "@mui/icons-material"
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns"
import { ptBR } from "date-fns/locale"
import CalendarEvent from "./CalendarEvent"

const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]
const MAX_POR_CELULA = 2

function agruparPorDia(eventos) {
  const mapa = new Map()
  for (const ev of eventos) {
    const chave = format(new Date(ev.inicio_ts), "yyyy-MM-dd")
    if (!mapa.has(chave)) mapa.set(chave, [])
    mapa.get(chave).push(ev)
  }
  return mapa
}

// -------------------------------------------------------------- visao mes
function VisaoMes({ dataReferencia, eventos, onSelecionarEvento, onSelecionarDia }) {
  const inicio = startOfWeek(startOfMonth(dataReferencia), { weekStartsOn: 0 })
  const fim = endOfWeek(endOfMonth(dataReferencia), { weekStartsOn: 0 })
  const dias = eachDayOfInterval({ start: inicio, end: fim })
  const porDia = agruparPorDia(eventos)

  return (
    <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", px: 2, pt: 1, pb: 0.5 }}>
        {DIAS_SEMANA.map((d) => (
          <Typography key={d} variant="caption" align="center" fontWeight={700} color="text.secondary" sx={{ fontSize: 10.5 }}>
            {d.slice(0, 3)}
          </Typography>
        ))}
      </Box>
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gridAutoRows: "minmax(0, 1fr)",
          gap: 0.5,
          p: 2,
          pt: 0,
          overflow: "hidden",
        }}
      >
        {dias.map((dia) => {
          const chave = format(dia, "yyyy-MM-dd")
          const eventosDoDia = porDia.get(chave) || []
          const visiveis = eventosDoDia.slice(0, MAX_POR_CELULA)
          const restantes = eventosDoDia.length - visiveis.length
          const foraDoMes = !isSameMonth(dia, dataReferencia)
          const hoje = isToday(dia)

          return (
            <Box
              key={chave}
              sx={{
                minHeight: 0,
                minWidth: 0,
                overflow: "hidden",
                borderRadius: "10px",
                border: "1px solid",
                borderColor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.07)"),
                bgcolor: foraDoMes ? "action.hover" : "background.paper",
                p: 0.625,
                display: "flex",
                flexDirection: "column",
                gap: 0.25,
                transition: "box-shadow 160ms ease, border-color 160ms ease",
                "&:hover": {
                  borderColor: "primary.main",
                  boxShadow: (t) => `0 4px 14px ${t.palette.mode === "dark" ? "rgba(0,0,0,0.35)" : "rgba(15,23,42,0.08)"}`,
                },
              }}
            >
              <Box
                onClick={() => onSelecionarDia(dia)}
                sx={{
                  display: "flex",
                  justifyContent: "flex-end",
                  cursor: "pointer",
                }}
              >
                <Box
                  sx={{
                    width: 19,
                    height: 19,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "50%",
                    fontSize: 11,
                    fontWeight: hoje ? 800 : 500,
                    color: hoje ? "primary.contrastText" : foraDoMes ? "text.disabled" : "text.primary",
                    bgcolor: hoje ? "primary.main" : "transparent",
                  }}
                >
                  {format(dia, "d")}
                </Box>
              </Box>

              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25, overflow: "hidden", minHeight: 0 }}>
                {visiveis.map((ev) => (
                  <CalendarEvent
                    key={ev.id_evento}
                    evento={ev}
                    variante="pilula"
                    onClick={() => onSelecionarEvento(ev)}
                  />
                ))}
                {restantes > 0 && (
                  <Typography
                    variant="caption"
                    onClick={() => onSelecionarDia(dia)}
                    sx={{ color: "text.secondary", fontWeight: 600, pl: 0.5, cursor: "pointer", "&:hover": { color: "primary.main" } }}
                  >
                    +{restantes} atividades
                  </Typography>
                )}
              </Box>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

// ----------------------------------------------------------- visao semana
function VisaoSemana({ dataReferencia, eventos, onSelecionarEvento }) {
  const inicio = startOfWeek(dataReferencia, { weekStartsOn: 0 })
  const fim = endOfWeek(dataReferencia, { weekStartsOn: 0 })
  const dias = eachDayOfInterval({ start: inicio, end: fim })
  const porDia = agruparPorDia(eventos)

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1.5, p: 3, overflowY: "auto" }}>
      {dias.map((dia) => {
        const chave = format(dia, "yyyy-MM-dd")
        const eventosDoDia = (porDia.get(chave) || []).sort((a, b) => new Date(a.inicio_ts) - new Date(b.inicio_ts))
        const hoje = isToday(dia)
        return (
          <Box key={chave} sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Box sx={{ textAlign: "center", pb: 1 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: "block" }}>
                {format(dia, "EEE", { locale: ptBR }).toUpperCase()}
              </Typography>
              <Box
                sx={{
                  width: 30,
                  height: 30,
                  mx: "auto",
                  mt: 0.25,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "50%",
                  fontWeight: 700,
                  bgcolor: hoje ? "primary.main" : "transparent",
                  color: hoje ? "primary.contrastText" : "text.primary",
                }}
              >
                {format(dia, "d")}
              </Box>
            </Box>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {eventosDoDia.length === 0 ? (
                <Typography variant="caption" align="center" color="text.disabled">
                  —
                </Typography>
              ) : (
                eventosDoDia.map((ev) => (
                  <CalendarEvent key={ev.id_evento} evento={ev} variante="lista" onClick={() => onSelecionarEvento(ev)} />
                ))
              )}
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}

// -------------------------------------------------------------- visao dia
function VisaoDia({ dataReferencia, eventos, onSelecionarEvento }) {
  const ordenados = [...eventos].sort((a, b) => new Date(a.inicio_ts) - new Date(b.inicio_ts))
  return (
    <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", p: 3, maxWidth: 900, mx: "auto", width: "100%" }}>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, textTransform: "capitalize" }}>
        {format(dataReferencia, "EEEE, d 'de' MMMM", { locale: ptBR })}
      </Typography>
      {ordenados.length === 0 ? (
        <EstadoVazio texto="Nenhuma atividade para este dia." />
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {ordenados.map((ev) => (
            <CalendarEvent key={ev.id_evento} evento={ev} variante="lista" onClick={() => onSelecionarEvento(ev)} />
          ))}
        </Box>
      )}
    </Box>
  )
}

// ----------------------------------------------------------- visao agenda
function VisaoAgenda({ eventos, onSelecionarEvento }) {
  const ordenados = [...eventos].sort((a, b) => new Date(a.inicio_ts) - new Date(b.inicio_ts))
  const porDia = agruparPorDia(ordenados)
  const chaves = [...porDia.keys()].sort()

  return (
    <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", p: 3, maxWidth: 720, mx: "auto", width: "100%" }}>
      {chaves.length === 0 ? (
        <EstadoVazio texto="Nenhuma atividade no período." />
      ) : (
        chaves.map((chave) => {
          const dia = new Date(`${chave}T00:00:00`)
          return (
            <Box key={chave} sx={{ mb: 2.5 }}>
              <Typography
                variant="body2"
                fontWeight={700}
                sx={{ mb: 1, textTransform: "capitalize", color: isToday(dia) ? "primary.main" : "text.primary" }}
              >
                {format(dia, "EEEE, d 'de' MMMM", { locale: ptBR })}
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {porDia.get(chave).map((ev) => (
                  <CalendarEvent key={ev.id_evento} evento={ev} variante="lista" onClick={() => onSelecionarEvento(ev)} />
                ))}
              </Box>
            </Box>
          )
        })
      )}
    </Box>
  )
}

function EstadoVazio({ texto }) {
  return (
    <Box sx={{ textAlign: "center", py: 8, color: "text.disabled" }}>
      <EventNote sx={{ fontSize: 40, opacity: 0.4, mb: 1 }} />
      <Typography variant="body2">{texto}</Typography>
    </Box>
  )
}

export default function CalendarGrid({ dataReferencia, visao, eventos, carregando, onSelecionarEvento, onSelecionarDia }) {
  if (carregando) {
    return (
      <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress size={28} />
      </Box>
    )
  }

  if (visao === "semana") {
    return <VisaoSemana dataReferencia={dataReferencia} eventos={eventos} onSelecionarEvento={onSelecionarEvento} />
  }
  if (visao === "dia") {
    return <VisaoDia dataReferencia={dataReferencia} eventos={eventos} onSelecionarEvento={onSelecionarEvento} />
  }
  if (visao === "agenda") {
    return <VisaoAgenda eventos={eventos} onSelecionarEvento={onSelecionarEvento} />
  }
  return (
    <VisaoMes
      dataReferencia={dataReferencia}
      eventos={eventos}
      onSelecionarEvento={onSelecionarEvento}
      onSelecionarDia={onSelecionarDia}
    />
  )
}
