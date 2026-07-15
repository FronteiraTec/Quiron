/**
 * CalendarSidebar - coluna esquerda (~300px) da tela de Calendario.
 *
 * Reune: busca, lista de "calendarios" (categorias + meus eventos) com
 * checkbox e cor de identificacao, o mini calendario e os proximos eventos.
 */
import { Box, Checkbox, Typography, Divider } from "@mui/material"
import { PersonOutline } from "@mui/icons-material"
import CalendarSearch from "./CalendarSearch"
import MiniCalendar from "./MiniCalendar"
import UpcomingEvents from "./UpcomingEvents"
import { CATEGORIAS, LISTA_CATEGORIAS } from "./categorias"
import { format } from "date-fns"

export default function CalendarSidebar({
  busca,
  onBuscaChange,
  categoriasAtivas,
  onAlternarCategoria,
  somenteMeus,
  onAlternarMeus,
  dataSelecionada,
  onSelecionarData,
  eventos = [],
  onSelecionarEvento,
}) {
  const diasComEvento = new Set(eventos.map((ev) => format(new Date(ev.inicio_ts), "yyyy-MM-dd")))

  return (
    <Box
      sx={{
        width: 300,
        flexShrink: 0,
        height: "100%",
        overflowY: "auto",
        borderRight: "1px solid",
        borderColor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)"),
        bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.015)" : "rgba(15,23,42,0.012)"),
      }}
    >
      <CalendarSearch valor={busca} onChange={onBuscaChange} />

      <Box sx={{ px: 2, py: 1 }}>
        <Typography
          variant="overline"
          sx={{ color: "text.secondary", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em" }}
        >
          Calendarios
        </Typography>

        <Box
          onClick={onAlternarMeus}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            py: 0.25,
            cursor: "pointer",
            borderRadius: "8px",
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          <Checkbox
            size="small"
            checked={somenteMeus}
            icon={<PersonOutline sx={{ fontSize: 18, color: "text.disabled" }} />}
            checkedIcon={<PersonOutline sx={{ fontSize: 18 }} color="primary" />}
            sx={{ p: 0.75 }}
          />
          <Typography variant="body2" fontWeight={somenteMeus ? 700 : 500}>
            Meus eventos
          </Typography>
        </Box>

        {LISTA_CATEGORIAS.map((chave) => {
          const { label, cor } = CATEGORIAS[chave]
          const ativo = categoriasAtivas.has(chave)
          return (
            <Box
              key={chave}
              onClick={() => onAlternarCategoria(chave)}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                py: 0.25,
                cursor: "pointer",
                borderRadius: "8px",
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              <Checkbox
                size="small"
                checked={ativo}
                sx={{
                  p: 0.75,
                  color: cor,
                  "&.Mui-checked": { color: cor },
                }}
              />
              <Typography variant="body2" fontWeight={ativo ? 600 : 500} sx={{ color: ativo ? "text.primary" : "text.disabled" }}>
                {label}
              </Typography>
            </Box>
          )
        })}
      </Box>

      <Divider sx={{ borderColor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)") }} />

      <MiniCalendar
        dataSelecionada={dataSelecionada}
        onSelecionar={onSelecionarData}
        diasComEvento={diasComEvento}
      />

      <Divider sx={{ borderColor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)") }} />

      <UpcomingEvents eventos={eventos} onSelecionar={onSelecionarEvento} />
    </Box>
  )
}
