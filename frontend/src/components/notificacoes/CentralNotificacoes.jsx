/**
 * CentralNotificacoes - o sino da Navbar, com as duas coisas que avisam.
 *
 *   Mensagens -> o que uma PESSOA enderecou a voce (migracao 012). Estado de
 *                lida no servidor, por mensagem.
 *   Eventos   -> o que a AGENDA ganhou nos ultimos dias. Estado de lida no
 *                localStorage, por marca d'agua (nao ha tabela por evento).
 *
 * Sao abas, e nao uma lista so, porque as duas leituras sao diferentes: a
 * mensagem se abre uma a uma e some da fila; o evento se confere em bloco. O
 * badge, esse sim, soma as duas — quem olha o sino quer saber se ha algo novo,
 * nao de que tipo.
 *
 * MARCAR COMO LIDA. Mensagem so e marcada quando a pessoa CLICA nela (ou usa o
 * "marcar todas"): dizer que leu o que ela nem abriu seria mentir sobre um dado
 * que o remetente ve do outro lado ("3 de 12 leram"). Evento continua marcado
 * ao fechar o painel, como antes — la nao ha o que abrir, a lista inteira ja
 * foi mostrada.
 */
import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Badge,
  Box,
  ButtonBase,
  CircularProgress,
  Divider,
  IconButton,
  Popover,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from "@mui/material"
import {
  NotificationsNone,
  NotificationsOffOutlined,
  DoneAll,
  ChevronRight,
} from "@mui/icons-material"
import ItemEvento from "./ItemEvento"
import ItemMensagem from "./ItemMensagem"
import { useNotificacoesEventos } from "../../hooks/useNotificacoesEventos"
import { useMensagens } from "../../hooks/useMensagens"
import { useAuthStore } from "../../store/authStore"

/** Estado vazio de uma aba. */
function Vazio({ texto }) {
  return (
    <Box sx={{ textAlign: "center", py: 5, px: 2, color: "text.disabled" }}>
      <NotificationsOffOutlined sx={{ fontSize: 36, opacity: 0.5 }} />
      <Typography variant="body2" sx={{ mt: 1 }}>
        {texto}
      </Typography>
    </Box>
  )
}

/** Lista com os tres estados (carregando / erro / vazio) resolvidos num lugar so. */
function Lista({ carregando, erro, vazio, children }) {
  if (carregando) {
    return (
      <Box sx={{ textAlign: "center", py: 5 }}>
        <CircularProgress size={24} />
      </Box>
    )
  }
  if (erro) {
    return (
      <Typography variant="body2" color="error" sx={{ px: 2, py: 4, textAlign: "center" }}>
        {erro}
      </Typography>
    )
  }
  if (vazio) return <Vazio texto={vazio} />
  return children
}

export default function CentralNotificacoes() {
  const navigate = useNavigate()
  const usuario = useAuthStore((s) => s.usuario)

  const mensagens = useMensagens({ idTenant: usuario?.id_tenant })
  const eventos = useNotificacoesEventos({
    idTenant: usuario?.id_tenant,
    idUsuario: usuario?.id,
  })

  const [anchorEl, setAnchorEl] = useState(null)
  const [aba, setAba] = useState("mensagens")
  // Os eventos so sao marcados como lidos se a aba deles chegou a ser aberta —
  // sem isso, abrir o sino para ler uma mensagem apagaria em silencio o aviso
  // de um evento que a pessoa nunca viu.
  const viuEventos = useRef(false)

  const aberto = Boolean(anchorEl)
  const naoLidas = mensagens.naoLidas + eventos.naoLidas

  // Abre na aba que tem novidade: quem clica no sino quer ver o que acendeu o
  // badge, nao a aba que ficou aberta da ultima vez.
  useEffect(() => {
    if (aberto) return
    setAba(mensagens.naoLidas === 0 && eventos.naoLidas > 0 ? "eventos" : "mensagens")
  }, [aberto, mensagens.naoLidas, eventos.naoLidas])

  const abrir = (e) => {
    viuEventos.current = aba === "eventos"
    setAnchorEl(e.currentTarget)
  }

  const fechar = () => {
    setAnchorEl(null)
    if (viuEventos.current && eventos.naoLidas > 0) eventos.marcarTodasLidas()
    viuEventos.current = false
  }

  const trocarAba = (_e, valor) => {
    setAba(valor)
    if (valor === "eventos") viuEventos.current = true
  }

  const abrirMensagem = (mensagem) => {
    if (!mensagem.lida) mensagens.marcarLida(mensagem.id_mensagem)
    fechar()
    // `rota` e opcional: a mensagem pode apontar para a tela do assunto dela
    // (ex.: "/entregas"). Sem rota, abre a CONVERSA com quem escreveu — o
    // clique no aviso ja deixa a pessoa em condicao de responder.
    navigate(mensagem.rota || `/mensagens?c=${mensagem.id_remetente}`)
  }

  const irParaEvento = (evento) => {
    fechar()
    navigate(`/eventos?data=${encodeURIComponent(evento.inicio_ts)}&evento=${evento.id_evento}`)
  }

  const marcarAbaLida = () => {
    if (aba === "mensagens") mensagens.marcarTodasLidas()
    else eventos.marcarTodasLidas()
  }

  const naoLidasDaAba = aba === "mensagens" ? mensagens.naoLidas : eventos.naoLidas

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
              width: 400,
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
        <Box sx={{ px: 2, pt: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1 }}>
            Notificações
          </Typography>
          {naoLidasDaAba > 0 && (
            <Tooltip title="Marcar todas como lidas">
              <IconButton size="small" onClick={marcarAbaLida} aria-label="marcar todas como lidas">
                <DoneAll fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        <Tabs
          value={aba}
          onChange={trocarAba}
          variant="fullWidth"
          sx={{ minHeight: 42, "& .MuiTab-root": { minHeight: 42, textTransform: "none", fontWeight: 600 } }}
        >
          <Tab
            value="mensagens"
            label={
              <Badge badgeContent={mensagens.naoLidas} color="error" max={99} sx={{ pr: mensagens.naoLidas ? 1.5 : 0 }}>
                Mensagens
              </Badge>
            }
          />
          <Tab
            value="eventos"
            label={
              <Badge badgeContent={eventos.naoLidas} color="error" max={99} sx={{ pr: eventos.naoLidas ? 1.5 : 0 }}>
                Eventos
              </Badge>
            }
          />
        </Tabs>

        <Divider />

        <Box sx={{ flex: 1, overflowY: "auto" }}>
          {aba === "mensagens" ? (
            <Lista
              carregando={mensagens.carregando}
              erro={mensagens.erro}
              vazio={mensagens.mensagens.length === 0 ? "Nenhuma mensagem por aqui." : null}
            >
              {mensagens.mensagens.map((m, i) => (
                <Box key={m.id_mensagem}>
                  {i > 0 && <Divider />}
                  <ItemMensagem mensagem={m} onClick={() => abrirMensagem(m)} />
                </Box>
              ))}
            </Lista>
          ) : (
            <Lista
              carregando={eventos.carregando}
              erro={eventos.erro}
              vazio={eventos.notificacoes.length === 0 ? "Nenhum evento novo por aqui." : null}
            >
              {eventos.notificacoes.map((ev, i) => (
                <Box key={ev.id_evento}>
                  {i > 0 && <Divider />}
                  <ItemEvento evento={ev} onClick={() => irParaEvento(ev)} />
                </Box>
              ))}
            </Lista>
          )}
        </Box>

        <Divider />

        {/* Rodape: leva a tela cheia do que a aba mostra. */}
        <ButtonBase
          onClick={() => {
            fechar()
            navigate(aba === "mensagens" ? "/mensagens" : "/eventos")
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
            {aba === "mensagens" ? "Ver todas as mensagens" : "Ver agenda completa"}
          </Typography>
          <ChevronRight fontSize="small" />
        </ButtonBase>
      </Popover>
    </>
  )
}
