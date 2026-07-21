/**
 * CalendarSidebar - coluna esquerda (~300px) da tela de Calendario.
 *
 * Ordem das secoes (de cima para baixo): busca, eventos do dia selecionado,
 * filtros (meus eventos + categorias) e o mini calendario ancorado no rodape.
 * A faixa do meio rola sozinha para que o mini calendario fique sempre visivel.
 */
import { Box, Checkbox, Typography, Divider, Accordion, AccordionSummary, AccordionDetails } from "@mui/material"
import { PersonOutline, ExpandMore } from "@mui/icons-material"
import CalendarSearch from "./CalendarSearch"
import MiniCalendar from "./MiniCalendar"
import DayEvents from "./DayEvents"
import { useCategorias } from "./categorias"
import { format } from "date-fns"

const bordaSutil = (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)")

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
  todosEventos = [],
  onSelecionarEvento,
}) {
  // Pontinhos do mini calendario: usam a lista sem filtro, para nao sumirem
  // quando o usuario restringe as categorias.
  const diasComEvento = new Set(todosEventos.map((ev) => format(new Date(ev.inicio_ts), "yyyy-MM-dd")))

  const { categorias } = useCategorias()
  const filtrando = somenteMeus || categoriasAtivas.size < categorias.length

  return (
    <Box
      sx={{
        width: 300,
        flexShrink: 0,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid",
        borderColor: bordaSutil,
        bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.015)" : "rgba(15,23,42,0.012)"),
      }}
    >
      <CalendarSearch valor={busca} onChange={onBuscaChange} />

      {/* Faixa rolavel: agenda do dia + filtros */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <DayEvents dia={dataSelecionada} eventos={eventos} onSelecionar={onSelecionarEvento} />

        <Divider sx={{ borderColor: bordaSutil }} />

        <Accordion
          data-tour="calendario-filtros"
          defaultExpanded
          disableGutters
          square
          elevation={0}
          sx={{ bgcolor: "transparent", "&:before": { display: "none" } }}
        >
          <AccordionSummary
            expandIcon={<ExpandMore sx={{ fontSize: 18 }} />}
            sx={{
              px: 2,
              minHeight: 36,
              "& .MuiAccordionSummary-content": { my: 0.5, alignItems: "center", gap: 1 },
            }}
          >
            <Typography
              variant="overline"
              sx={{ color: "text.secondary", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em" }}
            >
              Filtros
            </Typography>
            {/* Marcador para o usuario nao esquecer que ha filtro ativo com o painel fechado */}
            {filtrando && (
              <Typography
                variant="caption"
                sx={{
                  px: 0.75,
                  borderRadius: "999px",
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                {categoriasAtivas.size}/{categorias.length}
              </Typography>
            )}
          </AccordionSummary>

          <AccordionDetails sx={{ px: 2, pt: 0, pb: 1.5 }}>
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

            {categorias.map(({ chave, rotulo: label, cor }) => {
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
                  <Typography
                    variant="body2"
                    fontWeight={ativo ? 600 : 500}
                    sx={{ color: ativo ? "text.primary" : "text.disabled" }}
                  >
                    {label}
                  </Typography>
                </Box>
              )
            })}
          </AccordionDetails>
        </Accordion>
      </Box>

      {/* Ancorado no rodape */}
      <Box data-tour="calendario-mini" sx={{ flexShrink: 0, borderTop: "1px solid", borderColor: bordaSutil }}>
        <MiniCalendar
          dataSelecionada={dataSelecionada}
          onSelecionar={onSelecionarData}
          diasComEvento={diasComEvento}
        />
      </Box>
    </Box>
  )
}
