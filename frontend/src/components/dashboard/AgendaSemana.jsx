/**
 * AgendaSemana - widget da tela inicial que lista os eventos de hoje ate o fim
 * da semana, agrupados por dia (Hoje / Amanha / dia da semana).
 *
 * A visibilidade por papel e resolvida no backend (ver useAgendaSemana):
 * admin ve todos os eventos do tenant; mentor e usuario veem apenas os das
 * suas startups + os gerais. Clicar num item leva ao Calendario (pagina
 * Eventos), onde o evento pode ser aberto em detalhe.
 */
import { Box, Paper, Typography, Divider, CircularProgress, Alert, Chip } from "@mui/material"
import { alpha } from "@mui/material/styles"
import { CalendarMonth, EventBusy, ChevronRight, Place } from "@mui/icons-material"
import { format, isToday, isTomorrow, isSameDay } from "date-fns"
import { useNavigate } from "react-router-dom"
import { useCategorias } from "../calendar/categorias"
import { useAgendaSemana } from "../../hooks/useAgendaSemana"
import { horaDoEvento } from "../../utils/horaEvento"

const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]

/** Rotulo do cabecalho de cada grupo de dia. */
function rotuloDia(data) {
  if (isToday(data)) return "Hoje"
  if (isTomorrow(data)) return "Amanhã"
  return `${DIAS_SEMANA[data.getDay()]}, ${format(data, "dd/MM")}`
}

/** Agrupa os eventos por dia, mantendo a ordem cronologica. */
function agruparPorDia(eventos) {
  const ordenados = [...eventos].sort(
    (a, b) => horaDoEvento(a.inicio_ts) - horaDoEvento(b.inicio_ts)
  )
  const grupos = []
  for (const ev of ordenados) {
    const data = horaDoEvento(ev.inicio_ts)
    let grupo = grupos.find((g) => isSameDay(g.data, data))
    if (!grupo) {
      grupo = { data, itens: [] }
      grupos.push(grupo)
    }
    grupo.itens.push(ev)
  }
  return grupos
}

/** Linha secundaria: startups direcionadas (ou "Geral") + local. */
function subtitulo(ev) {
  const startups = ev.startups?.map((s) => s.nome).join(", ")
  return startups || "Geral"
}

function EventoItem({ evento, onClick }) {
  const { categoriaInfo } = useCategorias()
  const { cor, label } = categoriaInfo(evento.categoria)
  const inicio = horaDoEvento(evento.inicio_ts)
  return (
    <Box
      onClick={onClick}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        py: 1,
        px: 1,
        borderRadius: "8px",
        cursor: "pointer",
        "&:hover": { bgcolor: "action.hover" },
      }}
    >
      {/* Barra colorida da categoria */}
      <Box sx={{ width: 4, alignSelf: "stretch", minHeight: 34, borderRadius: 2, bgcolor: cor, flexShrink: 0 }} />

      {/* Horario */}
      <Box sx={{ width: 48, flexShrink: 0 }}>
        <Typography variant="body2" fontWeight={700} lineHeight={1.2}>
          {format(inicio, "HH:mm")}
        </Typography>
      </Box>

      {/* Titulo + subtitulo */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={600} noWrap>
          {evento.titulo}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "text.secondary", minWidth: 0 }}>
          <Typography variant="caption" noWrap>
            {subtitulo(evento)}
          </Typography>
          {evento.local && (
            <>
              <Place sx={{ fontSize: 12, flexShrink: 0 }} />
              <Typography variant="caption" noWrap>
                {evento.local}
              </Typography>
            </>
          )}
        </Box>
      </Box>

      {/* Categoria */}
      <Chip
        label={label}
        size="small"
        sx={{
          flexShrink: 0,
          fontWeight: 600,
          bgcolor: alpha(cor, 0.14),
          color: cor,
          borderRadius: "6px",
          height: 22,
        }}
      />
    </Box>
  )
}

export default function AgendaSemana({ idTenant }) {
  const navigate = useNavigate()
  const { eventos, carregando, erro } = useAgendaSemana(idTenant)
  const grupos = agruparPorDia(eventos)

  const irParaCalendario = () => navigate("/eventos")

  return (
    <Paper sx={{ borderRadius: 0, overflow: "hidden" }}>
      {/* Cabecalho */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 3, py: 2 }}>
        <CalendarMonth color="primary" />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" fontWeight={700} lineHeight={1.2}>
            Agenda da semana
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {carregando
              ? "Carregando..."
              : `${eventos.length} ${eventos.length === 1 ? "evento" : "eventos"} de hoje ao fim da semana`}
          </Typography>
        </Box>
        <Box
          onClick={irParaCalendario}
          sx={{
            display: "flex",
            alignItems: "center",
            color: "primary.main",
            cursor: "pointer",
            fontWeight: 600,
            "&:hover": { textDecoration: "underline" },
          }}
        >
          <Typography variant="body2" fontWeight={600}>
            Ver calendário
          </Typography>
          <ChevronRight fontSize="small" />
        </Box>
      </Box>

      <Divider />

      {/* Corpo */}
      {carregando ? (
        <Box sx={{ textAlign: "center", py: 6 }}>
          <CircularProgress size={28} />
        </Box>
      ) : erro ? (
        <Alert severity="error" sx={{ borderRadius: 0 }}>
          {erro}
        </Alert>
      ) : grupos.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 6, color: "text.disabled" }}>
          <EventBusy sx={{ fontSize: 40, opacity: 0.5 }} />
          <Typography variant="body2" sx={{ mt: 1 }}>
            Nenhum evento agendado para esta semana.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ p: 2 }}>
          {grupos.map((grupo) => (
            <Box key={grupo.data.toISOString()} sx={{ mb: 1.5, "&:last-child": { mb: 0 } }}>
              <Typography
                variant="overline"
                sx={{
                  display: "block",
                  px: 1,
                  color: isToday(grupo.data) ? "primary.main" : "text.secondary",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                }}
              >
                {rotuloDia(grupo.data)}
              </Typography>
              {grupo.itens.map((ev) => (
                <EventoItem key={ev.id_evento} evento={ev} onClick={irParaCalendario} />
              ))}
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  )
}
