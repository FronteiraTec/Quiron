/**
 * Uma reuniao: os dados, os convidados (com quem esta na sala agora), quem
 * entrou e saiu, e as acoes — entrar, editar, cancelar, excluir, encerrar.
 * Com a Etapa 4: se a reuniao grava, a escolha da propria pessoa sobre a
 * gravacao da fala dela e, depois do encerramento, a transcricao.
 *
 * O QUE CADA UM PODE FAZER vem do servidor, em `permissoes` (ver
 * reuniaoService.montarDetalhe): a tela so mostra o botao que nao daria 403.
 * A unica conta feita aqui e a contagem para a sala abrir, a partir do
 * `segundos_para_inicio` que o servidor mandou.
 *
 * Sondada a cada 30 s enquanto visivel, como a lista.
 */
import { useCallback, useEffect, useState } from "react"
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom"
import {
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Link,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material"
import {
  AccessTime,
  ArrowBack,
  CallEnd,
  DeleteOutline,
  Edit,
  EventBusy,
  FiberManualRecord,
  Login,
  MicOff,
  Person,
  RocketLaunch,
  VideoCall,
} from "@mui/icons-material"
import AppLayout from "../components/AppLayout"
import DialogReuniao from "../components/reunioes/DialogReuniao"
import TranscricaoReuniao from "../components/reunioes/TranscricaoReuniao"
import { CategoriaReuniao, SituacaoReuniao } from "../components/reunioes/MarcadoresReuniao"
import { mensagemErro, reunioesApi } from "../services/reunioesApi"
import { useAgora, useSondagem } from "../hooks/useSondagem"
import {
  PAPEIS_INCUBADORA,
  contagem,
  duracao,
  ehAberta,
  iniciais,
  instanteBR,
  motivoSemGravacao,
  quando,
  segundosParaAbrir,
} from "../data/reuniaoMeta"

const SONDAGEM_MS = 30000

/**
 * A gravacao no detalhe: se a reuniao grava e, para o convidado de uma
 * reuniao aberta, a escolha dele — que da para mudar daqui, antes de entrar.
 */
function Gravacao({ reuniao, onMudar }) {
  const [mudando, setMudando] = useState(false)
  const [erro, setErro] = useState(null)
  const g = reuniao.gravacao
  if (!g?.disponivel) {
    return (
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", color: "text.secondary" }}>
        <MicOff sx={{ fontSize: 18 }} aria-hidden />
        <Typography variant="body2">{motivoSemGravacao(g)}</Typography>
      </Box>
    )
  }
  const c = reuniao.meu_consentimento
  const podeMudar = Boolean(reuniao.meu_papel) && ehAberta(reuniao)
  const mudar = async () => {
    setMudando(true)
    setErro(null)
    try {
      await onMudar(!c?.aceito)
    } catch (err) {
      setErro(mensagemErro(err, "Não foi possível mudar agora."))
    } finally {
      setMudando(false)
    }
  }
  return (
    <Box>
      <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
        <FiberManualRecord sx={{ fontSize: 14, color: "error.main", mt: 0.4 }} aria-hidden />
        <Typography variant="body2">
          A fala de quem aceitar é gravada e transcrita à noite por {g.provedor_rotulo}.
          {podeMudar && (
            <>
              {" "}
              <strong>
                {!c?.decidido
                  ? "Você escolhe ao entrar na sala."
                  : c.aceito
                    ? "A sua fala será gravada."
                    : "A sua fala não será gravada."}
              </strong>
            </>
          )}
        </Typography>
      </Box>
      {podeMudar && c?.decidido && (
        <Button size="small" sx={{ mt: 0.5, ml: 2.5 }} onClick={mudar} disabled={mudando}>
          {c.aceito ? "Não gravar a minha fala" : "Gravar a minha fala"}
        </Button>
      )}
      {erro && (
        <Typography variant="caption" color="error" component="p" sx={{ ml: 2.5 }}>
          {erro}
        </Typography>
      )}
    </Box>
  )
}

function Campo({ icone, rotulo, children }) {
  return (
    <Box sx={{ display: "flex", gap: 1.5, py: 1 }}>
      <Box sx={{ color: "text.disabled", display: "flex", mt: 0.25 }}>{icone}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" component="div">
          {rotulo}
        </Typography>
        <Typography variant="body2" fontWeight={500} component="div">
          {children}
        </Typography>
      </Box>
    </Box>
  )
}

/** As confirmacoes das acoes que nao se desfazem. */
const CONFIRMACOES = {
  cancelar: {
    titulo: "Cancelar a reunião?",
    texto: "Ela sai da Agenda e do Google Agenda dos convidados, e fica no histórico como cancelada.",
    botao: "Cancelar reunião",
  },
  excluir: {
    titulo: "Excluir a reunião?",
    texto: "A reunião e os convites são apagados. Isso não se desfaz.",
    botao: "Excluir",
  },
  encerrar: {
    titulo: "Encerrar a reunião para todos?",
    texto: "Quem estiver na sala será desconectado, e ninguém mais entra.",
    botao: "Encerrar para todos",
  },
}

export default function ReuniaoDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [reuniao, setReuniao] = useState(null)
  const [recebidoEm, setRecebidoEm] = useState(Date.now())
  const [erro, setErro] = useState(null)
  const [naoEncontrada, setNaoEncontrada] = useState(false)
  const [editando, setEditando] = useState(false)
  const [confirmar, setConfirmar] = useState(null) // "cancelar" | "excluir" | "encerrar"
  const [agindo, setAgindo] = useState(false)
  const agora = useAgora(1000)

  const carregar = useCallback(async () => {
    try {
      const r = await reunioesApi.buscar(id)
      setReuniao(r)
      setRecebidoEm(Date.now())
      setErro(null)
    } catch (err) {
      if (err?.response?.status === 404) setNaoEncontrada(true)
      else setErro(mensagemErro(err, "Não foi possível carregar a reunião."))
    }
  }, [id])

  useEffect(() => {
    setReuniao(null)
    setNaoEncontrada(false)
    carregar()
  }, [carregar])
  useSondagem(carregar, SONDAGEM_MS)

  const agir = async () => {
    const acao = confirmar
    setAgindo(true)
    try {
      if (acao === "excluir") {
        await reunioesApi.excluir(reuniao.id_reuniao)
        navigate("/reunioes")
        return
      }
      if (acao === "cancelar") setReuniao(await reunioesApi.cancelar(reuniao.id_reuniao))
      if (acao === "encerrar") {
        await reunioesApi.encerrar(reuniao.id_reuniao)
        await carregar()
      }
      setConfirmar(null)
    } catch (err) {
      setErro(mensagemErro(err))
      setConfirmar(null)
    } finally {
      setAgindo(false)
    }
  }

  if (naoEncontrada) {
    return (
      <AppLayout>
        <Box sx={{ maxWidth: 480, mx: "auto", textAlign: "center", py: 6 }}>
          <EventBusy sx={{ fontSize: 40, color: "text.disabled" }} aria-hidden />
          <Typography variant="h6" fontWeight={700} sx={{ mt: 1 }}>
            Reunião não encontrada
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
            Ela pode ter sido excluída, ou você não está entre os convidados.
          </Typography>
          <Button component={RouterLink} to="/reunioes" variant="outlined">
            Ver minhas reuniões
          </Button>
        </Box>
      </AppLayout>
    )
  }

  if (!reuniao) {
    return (
      <AppLayout>
        {erro ? <Alert severity="error">{erro}</Alert> : <CircularProgress sx={{ display: "block", mx: "auto", my: 6 }} />}
      </AppLayout>
    )
  }

  const { permissoes } = reuniao
  const faltam = segundosParaAbrir(reuniao, recebidoEm, agora, reuniao.minutos_antes)
  const salaAberta = faltam !== null && faltam <= 0
  const convidado = Boolean(reuniao.meu_papel)
  const presentes = reuniao.participantes.filter((p) => p.na_sala).length

  return (
    <AppLayout>
      <Box sx={{ maxWidth: 1100, mx: "auto" }}>
        <Link component={RouterLink} to="/reunioes" underline="hover" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, mb: 2, fontSize: 14 }}>
          <ArrowBack sx={{ fontSize: 16 }} /> Reuniões
        </Link>

        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2, mb: 2.5 }}>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", mb: 1 }}>
              <CategoriaReuniao reuniao={reuniao} />
              <SituacaoReuniao reuniao={reuniao} recebidoEm={recebidoEm} agora={agora} minutosAntes={reuniao.minutos_antes} />
            </Box>
            <Typography variant="h4" component="h1" fontWeight={700} sx={{ wordBreak: "break-word" }}>
              {reuniao.titulo}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5, textTransform: "capitalize" }}>
              {quando(reuniao)}
            </Typography>
          </Box>

          {convidado && ehAberta(reuniao) && (
            <Box sx={{ textAlign: "right" }}>
              <Button
                size="large"
                variant="contained"
                startIcon={<Login />}
                disabled={!permissoes.entrar && !salaAberta}
                onClick={() => navigate(`/reunioes/${reuniao.id_reuniao}/sala`)}
              >
                Entrar na sala
              </Button>
              <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.75 }}>
                {salaAberta
                  ? presentes > 0
                    ? `${presentes} ${presentes === 1 ? "pessoa está" : "pessoas estão"} na sala`
                    : "A sala está aberta"
                  : `A sala abre ${contagem(faltam)}`}
              </Typography>
            </Box>
          )}
        </Box>

        {erro && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro(null)}>
            {erro}
          </Alert>
        )}

        {(permissoes.editar || permissoes.cancelar || permissoes.excluir || permissoes.encerrar) && (
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2.5 }}>
            {permissoes.editar && (
              <Button variant="outlined" startIcon={<Edit />} onClick={() => setEditando(true)}>
                Editar
              </Button>
            )}
            {permissoes.encerrar && reuniao.status === "EM_ANDAMENTO" && (
              <Button variant="outlined" color="error" startIcon={<CallEnd />} onClick={() => setConfirmar("encerrar")}>
                Encerrar para todos
              </Button>
            )}
            {permissoes.cancelar && (
              <Button variant="outlined" color="warning" startIcon={<EventBusy />} onClick={() => setConfirmar("cancelar")}>
                Cancelar reunião
              </Button>
            )}
            {permissoes.excluir && (
              <Button variant="outlined" color="error" startIcon={<DeleteOutline />} onClick={() => setConfirmar("excluir")}>
                Excluir
              </Button>
            )}
          </Box>
        )}

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.3fr 1fr" }, gap: 2.5, alignItems: "start" }}>
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Campo icone={<AccessTime fontSize="small" />} rotulo="Quando">
              <Box component="span" sx={{ textTransform: "capitalize" }}>
                {quando(reuniao)}
              </Box>
            </Campo>
            <Campo icone={<Person fontSize="small" />} rotulo="Anfitrião">
              {reuniao.anfitriao_nome}
            </Campo>
            <Campo icone={<RocketLaunch fontSize="small" />} rotulo="Startup">
              {reuniao.startup_nome || "Sem startup"}
            </Campo>
            <Campo icone={<VideoCall fontSize="small" />} rotulo="Onde">
              Sala de vídeo do Quíron · abre {reuniao.minutos_antes} min antes
            </Campo>
            {reuniao.status === "ENCERRADA" && (
              <Campo icone={<CallEnd fontSize="small" />} rotulo="Encerrada">
                {instanteBR(reuniao.encerrada_ts)}
                {reuniao.encerrada_por_nome ? ` por ${reuniao.encerrada_por_nome}` : " — a sala fechou quando todos saíram"}
              </Campo>
            )}

            {reuniao.descricao && (
              <>
                <Divider sx={{ my: 1.5 }} />
                <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.5 }}>
                  Pauta
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                  {reuniao.descricao}
                </Typography>
              </>
            )}

            <Divider sx={{ my: 1.5 }} />
            <Gravacao
              reuniao={reuniao}
              onMudar={async (aceito) => {
                const consentimento = await reunioesApi.consentir(reuniao.id_reuniao, aceito)
                setReuniao((r) => ({ ...r, meu_consentimento: consentimento }))
              }}
            />
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
              Convidados ({reuniao.participantes.length})
            </Typography>
            <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 1.25 }}>
              {reuniao.participantes.map((p) => (
                <Box component="li" key={p.id_usuario} sx={{ display: "flex", gap: 1.25, alignItems: "center" }}>
                  <Badge
                    overlap="circular"
                    variant="dot"
                    color="success"
                    invisible={!p.na_sala}
                    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                  >
                    <Avatar src={p.foto_url || undefined} sx={{ width: 34, height: 34, fontSize: 13 }}>
                      {iniciais(p.nome)}
                    </Avatar>
                  </Badge>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" fontWeight={600} noWrap>
                      {p.nome}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap component="div">
                      {[p.papel === "ANFITRIAO" ? "Anfitrião" : null, PAPEIS_INCUBADORA[p.papel_incubadora], p.na_sala ? "na sala" : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Paper>
        </Box>

        <TranscricaoReuniao reuniao={reuniao} onAtualizar={carregar} />

        {reuniao.sessoes && reuniao.sessoes.length > 0 && (
          <Paper variant="outlined" sx={{ mt: 2.5, overflowX: "auto" }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ px: 2.5, pt: 2 }}>
              Quem entrou e saiu
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ px: 2.5, display: "block" }}>
              Cada conexão à sala. Quem caiu e voltou aparece mais de uma vez.
            </Typography>
            <Table size="small" sx={{ mt: 1 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Pessoa</TableCell>
                  <TableCell>Entrou</TableCell>
                  <TableCell>Saiu</TableCell>
                  <TableCell align="right">Tempo</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {reuniao.sessoes.map((s) => (
                  <TableRow key={s.id_sessao}>
                    <TableCell>{s.nome || <Typography variant="body2" color="text.disabled">Desconhecido</Typography>}</TableCell>
                    <TableCell>{instanteBR(s.entrou_ts)}</TableCell>
                    <TableCell>{s.saiu_ts ? instanteBR(s.saiu_ts) : <Typography variant="body2" color="success.main">na sala</Typography>}</TableCell>
                    <TableCell align="right">{duracao(s.duracao_s)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        )}
      </Box>

      <DialogReuniao
        aberto={editando}
        reuniao={reuniao}
        onFechar={() => setEditando(false)}
        onSalvo={(r) => {
          setEditando(false)
          setReuniao(r)
          setRecebidoEm(Date.now())
        }}
      />

      <Dialog open={Boolean(confirmar)} onClose={agindo ? undefined : () => setConfirmar(null)}>
        {confirmar && (
          <>
            <DialogTitle>{CONFIRMACOES[confirmar].titulo}</DialogTitle>
            <DialogContent>
              <DialogContentText>{CONFIRMACOES[confirmar].texto}</DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setConfirmar(null)} disabled={agindo}>
                Voltar
              </Button>
              <Button
                color={confirmar === "cancelar" ? "warning" : "error"}
                variant="contained"
                onClick={agir}
                disabled={agindo}
                startIcon={agindo ? <CircularProgress size={16} /> : null}
              >
                {CONFIRMACOES[confirmar].botao}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </AppLayout>
  )
}
