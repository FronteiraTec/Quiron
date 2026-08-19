/**
 * Tela "Mensagens" — o canal interno da incubadora, por inteiro.
 *
 * O sino da Navbar mostra o que chegou; esta tela e onde a mensagem se le com
 * calma, se procura o que ja foi lido e — para quem envia — se confere quem
 * recebeu e quem abriu.
 *
 * Duas abas:
 *   Recebidas -> a caixa de entrada de quem esta logado. Nao passa por
 *                permissao (ver mensagemService): receber e do usuario.
 *   Enviadas  -> o historico. Aparece para quem pode ENVIAR (ve as proprias) ou
 *                para quem tem `comunicacao.mensagens.visualizar` (ve as de
 *                todos). O recorte quem faz e o backend.
 *
 * Endpoints: GET /mensagens, GET /mensagens/enviadas, POST /mensagens,
 * POST /mensagens/:id/lida, DELETE /mensagens/:id.
 */
import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Paper,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material"
import {
  Add,
  Delete,
  DoneAll,
  DraftsOutlined,
  ExpandMore,
  MarkEmailUnread,
  PriorityHigh,
  Search,
  Send,
} from "@mui/icons-material"
import { alpha } from "@mui/material/styles"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

import AppLayout from "../components/AppLayout"
import ChipsDestino from "../components/mensagens/destinos"
import NovaMensagemDialog from "../components/mensagens/NovaMensagemDialog"
import { useMensagens, useMensagensEnviadas } from "../hooks/useMensagens"
import { useAuthStore } from "../store/authStore"
import { usePermissaoStore } from "../store/permissaoStore"

/** "12 de março às 09:30" — data por extenso, que e como se lembra de um aviso. */
function quando(ts) {
  return format(new Date(ts), "d 'de' MMMM 'às' HH:mm", { locale: ptBR })
}

function inicial(nome) {
  return (nome || "?").trim().charAt(0).toUpperCase()
}

/** Uma mensagem recebida: fechada mostra o resumo, aberta mostra o texto. */
function MensagemRecebida({ mensagem, expandida, onAlternar }) {
  return (
    <Accordion
      expanded={expandida}
      onChange={onAlternar}
      disableGutters
      elevation={0}
      sx={{
        "&:before": { display: "none" },
        borderBottom: "1px solid",
        borderColor: "divider",
        bgcolor: mensagem.lida ? "transparent" : (t) => alpha(t.palette.primary.main, 0.05),
      }}
    >
      <AccordionSummary expandIcon={<ExpandMore />}>
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", minWidth: 0, flex: 1 }}>
          <Avatar
            src={mensagem.remetente_foto || undefined}
            sx={{
              width: 38,
              height: 38,
              fontSize: 15,
              fontWeight: 700,
              bgcolor: (t) =>
                mensagem.importante ? alpha(t.palette.error.main, 0.16) : alpha(t.palette.primary.main, 0.14),
              color: mensagem.importante ? "error.main" : "primary.main",
            }}
          >
            {inicial(mensagem.remetente_nome)}
          </Avatar>

          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
              {mensagem.importante && <PriorityHigh sx={{ fontSize: 16, color: "error.main" }} />}
              <Typography variant="subtitle2" fontWeight={mensagem.lida ? 600 : 800} noWrap>
                {mensagem.assunto}
              </Typography>
              {!mensagem.lida && <Chip size="small" color="primary" label="Nova" sx={{ height: 20 }} />}
            </Box>
            <Typography variant="caption" color="text.secondary">
              {mensagem.remetente_nome || "Alguém"} · {quando(mensagem.criado_ts)}
            </Typography>
          </Box>
        </Box>
      </AccordionSummary>

      <AccordionDetails sx={{ pl: { sm: 9 } }}>
        <Typography variant="body2" sx={{ whiteSpace: "pre-line", mb: 2 }}>
          {mensagem.corpo}
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, alignItems: "center" }}>
          <Typography variant="caption" color="text.secondary">
            Enviada para:
          </Typography>
          <ChipsDestino destinos={mensagem.destinos} max={6} />
        </Box>
      </AccordionDetails>
    </Accordion>
  )
}

/** Uma mensagem enviada: o alcance dela e quantos ja leram. */
function MensagemEnviada({ mensagem, podeExcluir, onExcluir }) {
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
              {mensagem.assunto}
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
            <Tooltip title="Excluir (some das caixas de entrada)">
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

/** Cabecalho comum das listas: busca + acoes da aba. */
function BarraLista({ busca, onBusca, children }) {
  return (
    <Box sx={{ p: 2, display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
      <TextField
        size="small"
        placeholder="Buscar por assunto, texto ou pessoa..."
        value={busca}
        onChange={(e) => onBusca(e.target.value)}
        InputProps={{ startAdornment: <Search fontSize="small" sx={{ mr: 1, color: "text.disabled" }} /> }}
        sx={{ flex: 1, minWidth: 240 }}
      />
      {children}
    </Box>
  )
}

/** Filtro de texto comum as duas abas. */
function filtrar(mensagens, busca) {
  const termo = busca.trim().toLowerCase()
  if (!termo) return mensagens
  return mensagens.filter((m) =>
    [m.assunto, m.corpo, m.remetente_nome, ...(m.destinos || []).map((d) => d.rotulo)]
      .filter(Boolean)
      .some((t) => String(t).toLowerCase().includes(termo))
  )
}

export default function Mensagens() {
  const usuario = useAuthStore((s) => s.usuario)
  const idTenant = usuario?.id_tenant
  const podeEnviar = usePermissaoStore((s) => s.pode("comunicacao.mensagens.enviar"))
  const podeVerTodas = usePermissaoStore((s) => s.pode("comunicacao.mensagens.visualizar"))
  const podeExcluirTodas = usePermissaoStore((s) => s.pode("comunicacao.mensagens.excluir"))

  const [params, setParams] = useSearchParams()
  const [aba, setAba] = useState("recebidas")
  const [busca, setBusca] = useState("")
  const [compondo, setCompondo] = useState(false)
  // Qual mensagem esta aberta. Vem de "?m=" quando a pessoa chegou pelo sino.
  const [expandida, setExpandida] = useState(() => Number(params.get("m")) || null)

  const recebidas = useMensagens({ idTenant, limite: 200 })
  const enviadas = useMensagensEnviadas({ idTenant, ativo: podeEnviar || podeVerTodas })

  const listaRecebidas = useMemo(() => filtrar(recebidas.mensagens, busca), [recebidas.mensagens, busca])
  const listaEnviadas = useMemo(() => filtrar(enviadas.mensagens, busca), [enviadas.mensagens, busca])

  // Chegou pelo sino com "?m=": abre a mensagem e ja a marca como lida — abrir
  // pelo link e a mesma coisa que abrir pela lista. Espera a lista carregar,
  // porque o alvo pode nao ter chegado ainda no primeiro render.
  useEffect(() => {
    const id = Number(params.get("m"))
    if (!id) return
    const alvo = recebidas.mensagens.find((m) => m.id_mensagem === id)
    if (!alvo) return

    if (!alvo.lida) recebidas.marcarLida(id)
    // Tira o parametro da URL para um F5 nao reabrir o que a pessoa ja fechou.
    const limpos = new URLSearchParams(params)
    limpos.delete("m")
    setParams(limpos, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recebidas.mensagens])

  const alternar = (mensagem) => (_e, aberta) => {
    setExpandida(aberta ? mensagem.id_mensagem : null)
    if (aberta && !mensagem.lida) recebidas.marcarLida(mensagem.id_mensagem)
  }

  const excluir = async (mensagem) => {
    if (!window.confirm(`Excluir "${mensagem.assunto}"? Ela some das caixas de entrada de quem recebeu.`)) return
    try {
      await enviadas.excluir(mensagem.id_mensagem)
      recebidas.recarregar()
    } catch (err) {
      window.alert(err.response?.data?.erro || "Não foi possível excluir a mensagem.")
    }
  }

  const abaEnviadasVisivel = podeEnviar || podeVerTodas

  return (
    <AppLayout>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3, flexWrap: "wrap" }}>
        <Box sx={{ flex: 1, minWidth: 220 }}>
          <Typography variant="h5" fontWeight={800}>
            Mensagens
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Os avisos que circulam dentro da incubadora.
          </Typography>
        </Box>

        {podeEnviar && (
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setCompondo(true)}
            sx={{ textTransform: "none", boxShadow: "none" }}
          >
            Nova mensagem
          </Button>
        )}
      </Box>

      <Paper variant="outlined" sx={{ overflow: "hidden" }}>
        <Tabs
          value={aba}
          onChange={(_e, v) => setAba(v)}
          sx={{ px: 1, "& .MuiTab-root": { textTransform: "none", fontWeight: 600 } }}
        >
          <Tab
            value="recebidas"
            icon={<MarkEmailUnread fontSize="small" />}
            iconPosition="start"
            label={`Recebidas${recebidas.naoLidas ? ` (${recebidas.naoLidas})` : ""}`}
          />
          {abaEnviadasVisivel && (
            <Tab value="enviadas" icon={<Send fontSize="small" />} iconPosition="start" label="Enviadas" />
          )}
        </Tabs>

        <Divider />

        {aba === "recebidas" ? (
          <>
            <BarraLista busca={busca} onBusca={setBusca}>
              {recebidas.naoLidas > 0 && (
                <Button
                  size="small"
                  startIcon={<DoneAll />}
                  onClick={recebidas.marcarTodasLidas}
                  sx={{ textTransform: "none" }}
                >
                  Marcar todas como lidas
                </Button>
              )}
            </BarraLista>
            <Divider />

            {recebidas.carregando ? (
              <Box sx={{ textAlign: "center", py: 6 }}>
                <CircularProgress size={26} />
              </Box>
            ) : recebidas.erro ? (
              <Alert severity="error" sx={{ m: 2 }}>
                {recebidas.erro}
              </Alert>
            ) : listaRecebidas.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 6, color: "text.disabled" }}>
                <DraftsOutlined sx={{ fontSize: 40, opacity: 0.5 }} />
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {busca ? "Nenhuma mensagem encontrada." : "Você ainda não recebeu mensagens."}
                </Typography>
              </Box>
            ) : (
              listaRecebidas.map((m) => (
                <MensagemRecebida
                  key={m.id_mensagem}
                  mensagem={m}
                  expandida={expandida === m.id_mensagem}
                  onAlternar={alternar(m)}
                />
              ))
            )}
          </>
        ) : (
          <>
            <BarraLista busca={busca} onBusca={setBusca} />
            <Divider />

            {enviadas.carregando ? (
              <Box sx={{ textAlign: "center", py: 6 }}>
                <CircularProgress size={26} />
              </Box>
            ) : enviadas.erro ? (
              <Alert severity="error" sx={{ m: 2 }}>
                {enviadas.erro}
              </Alert>
            ) : listaEnviadas.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 6, color: "text.disabled" }}>
                <Send sx={{ fontSize: 40, opacity: 0.5 }} />
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {busca ? "Nenhuma mensagem encontrada." : "Nada enviado por aqui ainda."}
                </Typography>
              </Box>
            ) : (
              listaEnviadas.map((m) => (
                <MensagemEnviada
                  key={m.id_mensagem}
                  mensagem={m}
                  // O autor sempre pode apagar a propria; para apagar a dos
                  // outros e preciso a chave (o backend refaz a checagem).
                  podeExcluir={m.id_remetente === usuario?.id || podeExcluirTodas}
                  onExcluir={excluir}
                />
              ))
            )}
          </>
        )}
      </Paper>

      <NovaMensagemDialog
        aberto={compondo}
        idTenant={idTenant}
        onFechar={() => setCompondo(false)}
        onEnviada={() => {
          enviadas.recarregar()
          setAba("enviadas")
        }}
      />
    </AppLayout>
  )
}
