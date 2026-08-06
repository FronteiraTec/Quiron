/**
 * NotificacoesEventos - sino da Navbar com os eventos criados recentemente.
 *
 * O badge conta as notificacoes ainda nao lidas (ver useNotificacoesEventos).
 * Clicar em um item leva ao Calendario (pagina Eventos) na data do evento -
 * a pagina le `?data=` para ja abrir no dia certo.
 */
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { alpha } from "@mui/material/styles"
import {
  Badge,
  Box,
  ButtonBase,
  CircularProgress,
  Divider,
  IconButton,
  Popover,
  Tooltip,
  Typography,
} from "@mui/material"
import {
  NotificationsNone,
  NotificationsOffOutlined,
  DoneAll,
  ChevronRight,
  Place,
} from "@mui/icons-material"
import { format, formatDistanceToNow, isToday, isTomorrow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { useCategorias } from "./calendar/categorias"
import { useNotificacoesEventos } from "../hooks/useNotificacoesEventos"
import { useAuthStore } from "../store/authStore"

/** "Hoje as 14:00" / "Amanha as 09:30" / "12 de marco as 09:30". */
function quandoAcontece(inicioTs) {
  const data = new Date(inicioTs)
  const hora = format(data, "HH:mm")
  if (isToday(data)) return `Hoje às ${hora}`
  if (isTomorrow(data)) return `Amanhã às ${hora}`
  return `${format(data, "d 'de' MMMM", { locale: ptBR })} às ${hora}`
}

/** "ha 2 horas", "ha 3 dias" - quando o evento entrou no calendario. */
function quandoFoiCriado(criadoTs) {
  return formatDistanceToNow(new Date(criadoTs), { addSuffix: true, locale: ptBR })
}

function Notificacao({ evento, onClick }) {
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

export default function NotificacoesEventos() {
  const navigate = useNavigate()
  const usuario = useAuthStore((s) => s.usuario)
  const { notificacoes, naoLidas, carregando, erro, marcarTodasLidas } = useNotificacoesEventos({
    idTenant: usuario?.id_tenant,
    idUsuario: usuario?.id,
  })

  const [anchorEl, setAnchorEl] = useState(null)
  const aberto = Boolean(anchorEl)

  const abrir = (e) => setAnchorEl(e.currentTarget)

  // A leitura e marcada ao fechar, e nao ao abrir: assim os itens novos ficam
  // destacados enquanto o painel esta aberto.
  const fechar = () => {
    setAnchorEl(null)
    if (naoLidas > 0) marcarTodasLidas()
  }

  const irParaEvento = (evento) => {
    fechar()
    navigate(`/eventos?data=${encodeURIComponent(evento.inicio_ts)}&evento=${evento.id_evento}`)
  }

  return (
    <>
      <Tooltip title="Notificações">
        <IconButton size="large" color="inherit" onClick={abrir} aria-label="notificações">
          <Badge badgeContent={naoLidas} color="error" max={99}>
            <NotificationsNone />
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={aberto}
        anchorEl={anchorEl}
        onClose={fechar}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: (t) => ({
              mt: 1.5,
              width: 380,
              maxWidth: "calc(100vw - 32px)",
              maxHeight: "min(70vh, 560px)",
              borderRadius: `${Math.max(t.shape.borderRadius, 12)}px`,
              border: "1px solid",
              borderColor: "divider",
              display: "flex",
              flexDirection: "column",
              boxShadow:
                t.palette.mode === "dark"
                  ? "0 16px 40px rgba(0,0,0,0.55)"
                  : "0 16px 40px rgba(15,23,42,0.14)",
            }),
          },
        }}
      >
        {/* Cabecalho */}
        <Box sx={{ px: 2, py: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight={700}>
              Notificações
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Eventos criados nos últimos dias
            </Typography>
          </Box>
          {naoLidas > 0 && (
            <Tooltip title="Marcar todas como lidas">
              <IconButton size="small" onClick={marcarTodasLidas} aria-label="marcar todas como lidas">
                <DoneAll fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        <Divider />

        {/* Lista */}
        <Box sx={{ flex: 1, overflowY: "auto" }}>
          {carregando ? (
            <Box sx={{ textAlign: "center", py: 5 }}>
              <CircularProgress size={24} />
            </Box>
          ) : erro ? (
            <Typography variant="body2" color="error" sx={{ px: 2, py: 4, textAlign: "center" }}>
              {erro}
            </Typography>
          ) : notificacoes.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 5, px: 2, color: "text.disabled" }}>
              <NotificationsOffOutlined sx={{ fontSize: 36, opacity: 0.5 }} />
              <Typography variant="body2" sx={{ mt: 1 }}>
                Nenhum evento novo por aqui.
              </Typography>
            </Box>
          ) : (
            notificacoes.map((ev, i) => (
              <Box key={ev.id_evento}>
                {i > 0 && <Divider />}
                <Notificacao evento={ev} onClick={() => irParaEvento(ev)} />
              </Box>
            ))
          )}
        </Box>

        <Divider />

        {/* Rodape */}
        <ButtonBase
          onClick={() => {
            fechar()
            navigate("/eventos")
          }}
          sx={{
            py: 1.25,
            gap: 0.5,
            color: "primary.main",
            fontWeight: 600,
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          <Typography variant="body2" fontWeight={600}>
            Ver agenda completa
          </Typography>
          <ChevronRight fontSize="small" />
        </ButtonBase>
      </Popover>
    </>
  )
}
