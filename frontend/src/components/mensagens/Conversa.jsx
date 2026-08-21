/**
 * A coluna da direita: a thread aberta, com a caixa de escrever embaixo.
 *
 * Detalhes que fazem parecer um app de mensagem, e nao uma lista de registros:
 * separador de data no meio da rolagem, bolhas coladas quando a mesma pessoa
 * fala em seguida, rolagem que se mantem no fim quando chega algo novo, e Enter
 * que envia (Shift+Enter quebra linha).
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { alpha } from "@mui/material/styles"
import {
  Alert,
  Avatar,
  Box,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material"
import { ArrowBack, Send, ForumOutlined, LockOutlined } from "@mui/icons-material"
import { format, isSameDay, isToday, isYesterday } from "date-fns"
import { ptBR } from "date-fns/locale"
import BolhaMensagem from "./BolhaMensagem"

/** "Hoje", "Ontem", "12 de março de 2026". */
function rotuloData(ts) {
  const data = new Date(ts)
  if (isToday(data)) return "Hoje"
  if (isYesterday(data)) return "Ontem"
  return format(data, "d 'de' MMMM 'de' yyyy", { locale: ptBR })
}

function inicial(nome) {
  return (nome || "?").trim().charAt(0).toUpperCase()
}

const PAPEL = { admin: "Administração", mentor: "Mentoria", usuario: "Incubado" }

/** Nada selecionado — o estado normal ao abrir a tela no desktop. */
export function ConversaVazia() {
  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: "text.disabled",
        px: 4,
        textAlign: "center",
      }}
    >
      <ForumOutlined sx={{ fontSize: 56, opacity: 0.4 }} />
      <Typography variant="body1" sx={{ mt: 2, fontWeight: 600 }}>
        Escolha uma conversa
      </Typography>
      <Typography variant="body2" sx={{ mt: 0.5, maxWidth: 360 }}>
        As mensagens da incubadora aparecem aqui. Responder é privado: só você e a
        pessoa do outro lado veem.
      </Typography>
    </Box>
  )
}

export default function Conversa({
  pessoa,
  mensagens,
  carregando,
  enviando,
  erro,
  podeResponder,
  onResponder,
  onVoltar,
}) {
  const [texto, setTexto] = useState("")
  const fimRef = useRef(null)
  const areaRef = useRef(null)
  // Guarda se a pessoa estava vendo o fim da conversa ANTES da atualizacao: se
  // ela subiu para reler algo antigo, uma mensagem nova nao pode puxar a tela.
  const noFimRef = useRef(true)

  // A caixa de texto zera ao trocar de conversa — o rascunho e daquela conversa.
  useEffect(() => {
    setTexto("")
  }, [pessoa?.id_usuario])

  useLayoutEffect(() => {
    const area = areaRef.current
    if (!area) return
    const distanciaDoFim = area.scrollHeight - area.scrollTop - area.clientHeight
    noFimRef.current = distanciaDoFim < 120
  })

  useEffect(() => {
    if (noFimRef.current) fimRef.current?.scrollIntoView({ block: "end" })
  }, [mensagens])

  const enviar = async () => {
    if (!texto.trim() || enviando) return
    const rascunho = texto
    setTexto("")
    try {
      await onResponder(rascunho)
      noFimRef.current = true
    } catch {
      // Devolve o texto: perder o que foi escrito por causa de uma falha de
      // rede e o pior desfecho possivel numa caixa de mensagem.
      setTexto(rascunho)
    }
  }

  const aoTeclar = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      enviar()
    }
  }

  if (carregando) {
    return (
      <Box sx={{ height: "100%", display: "grid", placeItems: "center" }}>
        <CircularProgress size={26} />
      </Box>
    )
  }

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Cabecalho da conversa */}
      <Box sx={{ px: 2, py: 1.25, display: "flex", alignItems: "center", gap: 1.5, flexShrink: 0 }}>
        {onVoltar && (
          <IconButton size="small" onClick={onVoltar} aria-label="voltar">
            <ArrowBack />
          </IconButton>
        )}
        <Avatar src={pessoa?.foto_url || undefined} sx={{ width: 40, height: 40, fontWeight: 700 }}>
          {inicial(pessoa?.nome)}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" fontWeight={700} noWrap>
            {pessoa?.nome}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {PAPEL[pessoa?.papel] || pessoa?.email}
          </Typography>
        </Box>
      </Box>

      <Divider />

      {/* Mensagens */}
      <Box
        ref={areaRef}
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          py: 2,
          display: "flex",
          flexDirection: "column",
          gap: 0.5,
          bgcolor: (t) =>
            t.palette.mode === "dark"
              ? alpha(t.palette.common.black, 0.2)
              : alpha(t.palette.primary.main, 0.03),
        }}
      >
        {mensagens.length === 0 && (
          <Box sx={{ m: "auto", textAlign: "center", color: "text.disabled", px: 3 }}>
            <Typography variant="body2">Nenhuma mensagem nesta conversa ainda.</Typography>
          </Box>
        )}

        {mensagens.map((m, i) => {
          const anterior = mensagens[i - 1]
          const novaData = !anterior || !isSameDay(new Date(anterior.criado_ts), new Date(m.criado_ts))
          // Falas seguidas da mesma pessoa ficam mais juntas, como num chat.
          const mesmoAutor = anterior && anterior.minha === m.minha && !novaData

          return (
            <Box key={m.id_mensagem} sx={{ mt: novaData ? 1 : mesmoAutor ? 0.25 : 1 }}>
              {novaData && (
                <Box sx={{ display: "flex", justifyContent: "center", my: 1.5 }}>
                  <Chip
                    size="small"
                    label={rotuloData(m.criado_ts)}
                    sx={{ height: 22, fontSize: 11, fontWeight: 600 }}
                  />
                </Box>
              )}
              <BolhaMensagem mensagem={m} />
            </Box>
          )
        })}

        <div ref={fimRef} />
      </Box>

      {erro && (
        <Alert severity="error" sx={{ borderRadius: 0 }}>
          {erro}
        </Alert>
      )}

      {/* Caixa de escrever */}
      <Box sx={{ p: 1.5, display: "flex", gap: 1, alignItems: "flex-end", flexShrink: 0 }}>
        {podeResponder ? (
          <>
            <TextField
              fullWidth
              multiline
              maxRows={5}
              size="small"
              placeholder="Escreva uma mensagem..."
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={aoTeclar}
              InputProps={{ sx: { borderRadius: 4 } }}
            />
            <Tooltip title="Enviar">
              <span>
                <IconButton
                  color="primary"
                  onClick={enviar}
                  disabled={!texto.trim() || enviando}
                  aria-label="enviar mensagem"
                  sx={{
                    bgcolor: "primary.main",
                    color: "primary.contrastText",
                    "&:hover": { bgcolor: "primary.dark" },
                    "&.Mui-disabled": { bgcolor: "action.disabledBackground" },
                  }}
                >
                  {enviando ? <CircularProgress size={20} color="inherit" /> : <Send fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
          </>
        ) : (
          // Sem a chave `comunicacao.mensagens.responder`: a conversa continua
          // legivel, mas a caixa some. Dizer por que e melhor que um campo que
          // aceita texto e falha no envio.
          <Box
            sx={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 1,
              px: 2,
              py: 1.25,
              borderRadius: 4,
              bgcolor: "action.hover",
              color: "text.secondary",
            }}
          >
            <LockOutlined fontSize="small" />
            <Typography variant="caption">
              Sua incubadora não habilitou respostas para o seu perfil.
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  )
}
