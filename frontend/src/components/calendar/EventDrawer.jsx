/**
 * EventDrawer - painel lateral com o detalhe de um evento (nao usa modal).
 * Mostra titulo, descricao, startup, mentor, data/horario, local,
 * participantes e anexos, com acoes de editar/excluir.
 */
import { useEffect, useState } from "react"
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Button,
  Divider,
  Avatar,
  AvatarGroup,
  Link,
  Chip,
  CircularProgress,
} from "@mui/material"
import {
  Close,
  Edit,
  DeleteOutline,
  RocketLaunch,
  Person,
  CalendarToday,
  AccessTime,
  Place,
  AttachFile,
  Check,
} from "@mui/icons-material"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import api from "../../services/api"
import { categoriaInfo } from "./categorias"

function Campo({ icone, rotulo, children }) {
  if (!children) return null
  return (
    <Box sx={{ display: "flex", gap: 1.5, mb: 2 }}>
      <Box sx={{ color: "text.disabled", display: "flex", mt: 0.25 }}>{icone}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
          {rotulo}
        </Typography>
        <Typography variant="body2" fontWeight={500}>
          {children}
        </Typography>
      </Box>
    </Box>
  )
}

export default function EventDrawer({ evento, aberto, onClose, onEditar, onExcluir, usuarioId }) {
  const [participantes, setParticipantes] = useState([])
  const [confirmando, setConfirmando] = useState(false)

  useEffect(() => {
    if (!aberto || !evento) return
    api
      .get(`/eventos/${evento.id_evento}/participantes`)
      .then(({ data }) => setParticipantes(data.participantes))
      .catch(() => setParticipantes([]))
  }, [aberto, evento])

  if (!evento) return null
  const { label, cor, Icone } = categoriaInfo(evento.categoria)
  const meuStatus = participantes.find((p) => p.id_usuario === usuarioId)?.status

  const confirmar = async (status) => {
    setConfirmando(true)
    try {
      await api.post(`/eventos/${evento.id_evento}/confirmar`, { status })
      const { data } = await api.get(`/eventos/${evento.id_evento}/participantes`)
      setParticipantes(data.participantes)
    } finally {
      setConfirmando(false)
    }
  }

  return (
    <Drawer anchor="right" open={aberto} onClose={onClose}>
      <Box sx={{ width: 400, maxWidth: "100vw", height: "100%", display: "flex", flexDirection: "column" }}>
        {/* Cabecalho */}
        <Box sx={{ p: 3, pb: 2 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <Chip
              icon={<Icone sx={{ fontSize: 16 }} />}
              label={label}
              size="small"
              sx={{ bgcolor: `${cor}1f`, color: cor, fontWeight: 700 }}
            />
            <IconButton size="small" onClick={onClose}>
              <Close fontSize="small" />
            </IconButton>
          </Box>
          <Typography variant="h6" fontWeight={700} sx={{ mt: 1.5 }}>
            {evento.titulo}
          </Typography>
        </Box>

        <Divider />

        {/* Corpo */}
        <Box sx={{ flex: 1, overflowY: "auto", p: 3 }}>
          <Campo icone={<CalendarToday fontSize="small" />} rotulo="Data">
            <Box sx={{ textTransform: "capitalize" }}>
              {format(new Date(evento.inicio_ts), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </Box>
          </Campo>
          <Campo icone={<AccessTime fontSize="small" />} rotulo="Horario">
            {format(new Date(evento.inicio_ts), "HH:mm")}
            {evento.fim_ts ? ` - ${format(new Date(evento.fim_ts), "HH:mm")}` : ""}
          </Campo>
          <Campo icone={<Place fontSize="small" />} rotulo="Local">
            {evento.local}
          </Campo>
          <Campo icone={<RocketLaunch fontSize="small" />} rotulo="Startups">
            {evento.startups?.length ? (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.25 }}>
                {evento.startups.map((s) => (
                  <Chip key={s.id_startup} size="small" label={s.nome} />
                ))}
              </Box>
            ) : (
              "Todas as startups incubadas"
            )}
          </Campo>
          <Campo icone={<Person fontSize="small" />} rotulo="Mentor">
            {evento.mentor_nome}
          </Campo>

          {evento.descricao && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                Descricao
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                {evento.descricao}
              </Typography>
            </>
          )}

          <Divider sx={{ my: 2 }} />

          {/* Participantes */}
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
            Participantes
          </Typography>
          {participantes.length === 0 ? (
            <Typography variant="body2" color="text.disabled" sx={{ mb: 1 }}>
              Ninguem confirmou presenca ainda.
            </Typography>
          ) : (
            <AvatarGroup max={6} sx={{ justifyContent: "flex-end", mb: 1 }}>
              {participantes.map((p) => (
                <Avatar key={p.id_usuario} src={p.foto_url || undefined} sx={{ width: 30, height: 30, fontSize: 13 }}>
                  {p.nome.charAt(0).toUpperCase()}
                </Avatar>
              ))}
            </AvatarGroup>
          )}

          <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
            <Button
              size="small"
              variant={meuStatus === "CONFIRMADO" ? "contained" : "outlined"}
              startIcon={confirmando ? <CircularProgress size={14} /> : <Check sx={{ fontSize: 16 }} />}
              disabled={confirmando}
              onClick={() => confirmar("CONFIRMADO")}
            >
              Confirmar presenca
            </Button>
          </Box>

          {/* Anexos */}
          {Array.isArray(evento.anexos) && evento.anexos.length > 0 && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                Anexos
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                {evento.anexos.map((anexo, i) => (
                  <Link
                    key={i}
                    href={anexo.url}
                    target="_blank"
                    rel="noreferrer"
                    sx={{ display: "flex", alignItems: "center", gap: 1, fontSize: 13.5 }}
                  >
                    <AttachFile sx={{ fontSize: 16 }} />
                    {anexo.nome || anexo.url}
                  </Link>
                ))}
              </Box>
            </>
          )}

          {evento.criado_por_nome && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="caption" color="text.disabled" sx={{ display: "block" }}>
                Criado por {evento.criado_por_nome} em{" "}
                {format(new Date(evento.criado_ts), "d 'de' MMMM 'de' yyyy 'as' HH:mm", { locale: ptBR })}
                {evento.atualizado_ts && evento.atualizado_ts !== evento.criado_ts && (
                  <>
                    {" "}
                    · editado em{" "}
                    {format(new Date(evento.atualizado_ts), "d 'de' MMMM 'as' HH:mm", { locale: ptBR })}
                  </>
                )}
              </Typography>
            </>
          )}
        </Box>

        <Divider />

        {/* Acoes */}
        <Box sx={{ p: 2, display: "flex", gap: 1 }}>
          <Button fullWidth variant="outlined" startIcon={<Edit />} onClick={() => onEditar(evento)}>
            Editar
          </Button>
          <Button fullWidth variant="outlined" color="error" startIcon={<DeleteOutline />} onClick={() => onExcluir(evento)}>
            Excluir
          </Button>
        </Box>
      </Box>
    </Drawer>
  )
}
