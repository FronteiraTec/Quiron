/**
 * Tela "Mensagens" — o canal interno da incubadora, em formato de chat.
 *
 * Duas visoes:
 *
 *   Conversas      -> a experiencia principal: lista de interlocutores a
 *                     esquerda, thread a direita, caixa de escrever embaixo.
 *                     Responder e privado — so voce e a pessoa do outro lado.
 *   Avisos enviados-> o lado administrativo do envio em massa: para quem foi e
 *                     quantos leram. So para quem pode enviar (as proprias) ou
 *                     tem `comunicacao.mensagens.visualizar` (as de todos).
 *
 * O aviso disparado para uma startup inteira aparece como uma conversa com CADA
 * membro: e o desenho escolhido para a resposta nao virar grupo. Ver o
 * cabecalho de mensagemService.
 *
 * Endpoints: /mensagens/conversas[...], /mensagens/enviadas, POST /mensagens.
 */
import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  Paper,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material"
import {
  Add,
  Delete,
  ExpandMore,
  Forum,
  PriorityHigh,
  Search,
  Send,
} from "@mui/icons-material"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

import AppLayout from "../components/AppLayout"
import ChipsDestino from "../components/mensagens/destinos"
import NovaMensagemDialog from "../components/mensagens/NovaMensagemDialog"
import ListaConversas from "../components/mensagens/ListaConversas"
import Conversa, { ConversaVazia } from "../components/mensagens/Conversa"
import { useConversas, useConversa } from "../hooks/useConversas"
import { useMensagensEnviadas } from "../hooks/useMensagens"
import { useAuthStore } from "../store/authStore"
import { usePermissaoStore } from "../store/permissaoStore"

/** "12 de março às 09:30". */
function quando(ts) {
  return format(new Date(ts), "d 'de' MMMM 'às' HH:mm", { locale: ptBR })
}

/** Um aviso no historico de envios: para quem foi e quantos leram. */
function AvisoEnviado({ mensagem, podeExcluir, onExcluir }) {
  const lidas = mensagem.total_lidas
  const total = mensagem.total_destinatarios

  return (
    <Accordion
      disableGutters
      elevation={0}
      sx={{ "&:before": { display: "none" }, borderBottom: "1px solid", borderColor: "divider" }}
    >
      <AccordionSummary expandIcon={<ExpandMore />}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
            {mensagem.importante && <PriorityHigh sx={{ fontSize: 16, color: "error.main" }} />}
            <Typography variant="subtitle2" fontWeight={700} noWrap>
              {mensagem.assunto || mensagem.corpo}
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            {mensagem.remetente_nome || "Autor removido"} · {quando(mensagem.criado_ts)} ·{" "}
            <Box component="span" sx={{ color: lidas === total ? "success.main" : "text.secondary" }}>
              {lidas} de {total} leram
            </Box>
          </Typography>
        </Box>
      </AccordionSummary>

      <AccordionDetails>
        <Typography variant="body2" sx={{ whiteSpace: "pre-line", mb: 2 }}>
          {mensagem.corpo}
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, alignItems: "center" }}>
          <Typography variant="caption" color="text.secondary">
            Enviada para:
          </Typography>
          <ChipsDestino destinos={mensagem.destinos} max={6} />
          <Box sx={{ flex: 1 }} />
          {podeExcluir && (
            <Tooltip title="Excluir (some das conversas de quem recebeu)">
              <IconButton size="small" color="error" onClick={() => onExcluir(mensagem)}>
                <Delete fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </AccordionDetails>
    </Accordion>
  )
}

/** A aba "Avisos enviados". */
function PainelEnviados({ enviadas, busca, onBusca, usuario, podeExcluirTodas, onExcluir }) {
  const termo = busca.trim().toLowerCase()
  const lista = termo
    ? enviadas.mensagens.filter((m) =>
        [m.assunto, m.corpo, m.remetente_nome, ...(m.destinos || []).map((d) => d.rotulo)]
          .filter(Boolean)
          .some((t) => String(t).toLowerCase().includes(termo))
      )
    : enviadas.mensagens

  return (
    <Box sx={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
      <Box sx={{ p: 2 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Buscar por assunto, texto ou destinatário..."
          value={busca}
          onChange={(e) => onBusca(e.target.value)}
          InputProps={{ startAdornment: <Search fontSize="small" sx={{ mr: 1, color: "text.disabled" }} /> }}
        />
      </Box>
      <Divider />

      {enviadas.carregando ? (
        <Box sx={{ textAlign: "center", py: 6 }}>
          <CircularProgress size={26} />
        </Box>
      ) : enviadas.erro ? (
        <Alert severity="error" sx={{ m: 2 }}>
          {enviadas.erro}
        </Alert>
      ) : lista.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 6, color: "text.disabled" }}>
          <Send sx={{ fontSize: 40, opacity: 0.5 }} />
          <Typography variant="body2" sx={{ mt: 1 }}>
            {busca ? "Nenhum aviso encontrado." : "Nada enviado por aqui ainda."}
          </Typography>
        </Box>
      ) : (
        lista.map((m) => (
          <AvisoEnviado
            key={m.id_mensagem}
            mensagem={m}
            // O autor sempre pode apagar o proprio; para apagar o dos outros e
            // preciso a chave (o backend refaz a checagem).
            podeExcluir={m.id_remetente === usuario?.id || podeExcluirTodas}
            onExcluir={onExcluir}
          />
        ))
      )}
    </Box>
  )
}

export default function Mensagens() {
  const usuario = useAuthStore((s) => s.usuario)
  const idTenant = usuario?.id_tenant
  const podeEnviar = usePermissaoStore((s) => s.pode("comunicacao.mensagens.enviar"))
  const podeResponder = usePermissaoStore((s) => s.pode("comunicacao.mensagens.responder"))
  const podeVerTodas = usePermissaoStore((s) => s.pode("comunicacao.mensagens.visualizar"))
  const podeExcluirTodas = usePermissaoStore((s) => s.pode("comunicacao.mensagens.excluir"))

  const theme = useTheme()
  const mdUp = useMediaQuery(theme.breakpoints.up("md"))

  const [params, setParams] = useSearchParams()
  const [aba, setAba] = useState("conversas")
  const [busca, setBusca] = useState("")
  const [buscaEnviados, setBuscaEnviados] = useState("")
  const [compondo, setCompondo] = useState(false)
  // Com quem estou falando. "?c=" vem do sino, que leva direto a conversa.
  const [aberta, setAberta] = useState(() => Number(params.get("c")) || null)

  const lista = useConversas({ idTenant })
  const thread = useConversa({ idTenant, idOutro: aberta })
  const enviadas = useMensagensEnviadas({ idTenant, ativo: podeEnviar || podeVerTodas })

  const abaEnviadosVisivel = podeEnviar || podeVerTodas

  // Abrir a conversa ja marca como lida no backend; a lista da esquerda precisa
  // acompanhar, ou o badge fica aceso sobre a tela que a pessoa esta lendo.
  useEffect(() => {
    if (aberta) lista.zerarNaoLidas(aberta)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta, thread.mensagens.length])

  // Limpa o "?c=" depois de usado, para um F5 nao reabrir o que foi fechado.
  useEffect(() => {
    if (!params.get("c")) return
    const limpos = new URLSearchParams(params)
    limpos.delete("c")
    setParams(limpos, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const responder = async (corpo) => {
    await thread.responder(corpo)
    // A lista reordena: a conversa respondida sobe para o topo com a fala nova.
    lista.recarregar()
  }

  const excluirAviso = async (mensagem) => {
    const rotulo = mensagem.assunto || mensagem.corpo.slice(0, 40)
    if (!window.confirm(`Excluir "${rotulo}"? Ela some das conversas de quem recebeu.`)) return
    try {
      await enviadas.excluir(mensagem.id_mensagem)
      lista.recarregar()
      thread.recarregar()
    } catch (err) {
      window.alert(err.response?.data?.erro || "Não foi possível excluir a mensagem.")
    }
  }

  // No celular a tela e uma so: ou a lista, ou a conversa aberta.
  const mostrarLista = mdUp || !aberta
  const mostrarThread = mdUp || Boolean(aberta)

  return (
    <AppLayout fullBleed>
      <Box sx={{ p: 2, pb: 0, display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="h5" fontWeight={800}>
            Mensagens
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Converse com a incubadora. As respostas são privadas.
          </Typography>
        </Box>

        {abaEnviadosVisivel && (
          <Tabs
            value={aba}
            onChange={(_e, v) => setAba(v)}
            sx={{ minHeight: 40, "& .MuiTab-root": { minHeight: 40, textTransform: "none", fontWeight: 600 } }}
          >
            <Tab value="conversas" icon={<Forum fontSize="small" />} iconPosition="start" label="Conversas" />
            <Tab value="enviados" icon={<Send fontSize="small" />} iconPosition="start" label="Avisos enviados" />
          </Tabs>
        )}

        {podeEnviar && (
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setCompondo(true)}
            sx={{ textTransform: "none", boxShadow: "none" }}
          >
            Novo aviso
          </Button>
        )}
      </Box>

      <Paper
        variant="outlined"
        sx={{ flex: 1, m: 2, display: "flex", overflow: "hidden", minHeight: 0 }}
      >
        {aba === "conversas" ? (
          <>
            {mostrarLista && (
              <Box
                sx={{
                  width: { xs: "100%", md: 340 },
                  flexShrink: 0,
                  borderRight: { md: "1px solid" },
                  borderColor: { md: "divider" },
                  minHeight: 0,
                }}
              >
                <ListaConversas
                  conversas={lista.conversas}
                  carregando={lista.carregando}
                  ativa={aberta}
                  onAbrir={setAberta}
                  busca={busca}
                  onBusca={setBusca}
                />
              </Box>
            )}

            {mostrarThread && (
              <Box sx={{ flex: 1, minWidth: 0, minHeight: 0 }}>
                {aberta ? (
                  <Conversa
                    pessoa={thread.pessoa}
                    mensagens={thread.mensagens}
                    carregando={thread.carregando}
                    enviando={thread.enviando}
                    erro={thread.erro}
                    podeResponder={podeResponder}
                    onResponder={responder}
                    onVoltar={mdUp ? null : () => setAberta(null)}
                  />
                ) : (
                  <ConversaVazia />
                )}
              </Box>
            )}
          </>
        ) : (
          <PainelEnviados
            enviadas={enviadas}
            busca={buscaEnviados}
            onBusca={setBuscaEnviados}
            usuario={usuario}
            podeExcluirTodas={podeExcluirTodas}
            onExcluir={excluirAviso}
          />
        )}
      </Paper>

      <NovaMensagemDialog
        aberto={compondo}
        idTenant={idTenant}
        onFechar={() => setCompondo(false)}
        onEnviada={() => {
          lista.recarregar()
          enviadas.recarregar()
        }}
      />
    </AppLayout>
  )
}
