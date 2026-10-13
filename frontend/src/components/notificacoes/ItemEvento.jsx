/**
 * Uma linha do sino: evento criado recentemente na agenda.
 *
 * Veio de NotificacoesEventos.jsx, que era o sino inteiro quando evento era a
 * unica coisa que notificava. Com as mensagens internas (migracao 012) o sino
 * passou a ter duas abas, e cada tipo de item virou um componente proprio.
 */
import { alpha } from "@mui/material/styles"
import { Box, ButtonBase, Typography } from "@mui/material"
import { Place } from "@mui/icons-material"
import { format, formatDistanceToNow, isToday, isTomorrow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { useCategorias } from "../calendar/categorias"
import { horaDoEvento } from "../../utils/horaEvento"

/** "Hoje as 14:00" / "Amanha as 09:30" / "12 de marco as 09:30". */
function quandoAcontece(inicioTs) {
  const data = horaDoEvento(inicioTs)
  const hora = format(data, "HH:mm")
  if (isToday(data)) return `Hoje às ${hora}`
  if (isTomorrow(data)) return `Amanhã às ${hora}`
  return `${format(data, "d 'de' MMMM", { locale: ptBR })} às ${hora}`
}

/** "ha 2 horas", "ha 3 dias" - quando o evento entrou no calendario. */
function quandoFoiCriado(criadoTs) {
  return formatDistanceToNow(new Date(criadoTs), { addSuffix: true, locale: ptBR })
}

export default function ItemEvento({ evento, onClick }) {
  const { categoriaInfo } = useCategorias()
  const { cor, label, Icone } = categoriaInfo(evento.categoria)
  const alvo = evento.startups?.map((s) => s.nome).join(", ")

  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        width: "100%",
        px: 2,
        py: 1.5,
        gap: 1.5,
        textAlign: "left",
        alignItems: "flex-start",
        justifyContent: "flex-start",
        bgcolor: evento.lida ? "transparent" : (t) => alpha(t.palette.primary.main, 0.06),
        "&:hover": { bgcolor: "action.hover" },
      }}
    >
      {/* Icone da categoria */}
      <Box
        sx={{
          width: 36,
          height: 36,
          flexShrink: 0,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          bgcolor: alpha(cor, 0.14),
          color: cor,
        }}
      >
        <Icone fontSize="small" />
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={evento.lida ? 500 : 700} noWrap>
          {evento.titulo}
        </Typography>

        <Typography variant="caption" sx={{ display: "block", color: cor, fontWeight: 600 }}>
          {label} - {quandoAcontece(evento.inicio_ts)}
        </Typography>

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "text.secondary", minWidth: 0 }}>
          <Typography variant="caption" noWrap>
            {alvo || "Geral"}
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

        <Typography variant="caption" color="text.disabled">
          {evento.criado_por_nome ? `Criado por ${evento.criado_por_nome} ` : "Criado "}
          {quandoFoiCriado(evento.criado_ts)}
        </Typography>
      </Box>

      {/* Ponto de nao lida */}
      {!evento.lida && (
        <Box sx={{ width: 8, height: 8, mt: 1, borderRadius: "50%", bgcolor: "primary.main", flexShrink: 0 }} />
      )}
    </ButtonBase>
  )
}
