/**
 * A sala de video de uma reuniao (/reunioes/:id/sala) — tela cheia, fora do
 * AppLayout.
 *
 * TRES MOMENTOS, nesta ordem:
 *   1. PREPARO: a previa da camera e a escolha de microfone e camera. Aparece
 *      mesmo antes de a sala abrir, com a contagem no lugar do botao.
 *   2. SALA: com o token pedido na hora (POST /reunioes/:id/token), o
 *      <LiveKitRoom> conecta e a SalaConectada desenha a reuniao.
 *   3. SAIU: o motivo (saiu, a reuniao foi encerrada, entrou em outra aba, a
 *      conexao caiu) e o caminho de volta.
 *
 * O token e pedido so no clique de entrar, e um novo a cada entrada: ele vale
 * 10 minutos e so para esta sala (ver reuniaoService.emitirToken).
 *
 * O TEMA E SEMPRE O ESCURO do Quiron, montado com as preferencias da pessoa:
 * video se assiste melhor sobre fundo escuro, e assim menus, campos e
 * dialogos continuam com a identidade do sistema.
 *
 * As escolhas de microfone e camera ficam no navegador (localStorage): sao
 * conveniencia de quem usa, e nao dado de ninguem.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { Link as RouterLink, useParams } from "react-router-dom"
import { Box, Button, CircularProgress, CssBaseline, ThemeProvider, Typography } from "@mui/material"
import { CallEnd, EventBusy, Login, PersonOff, ArrowBack } from "@mui/icons-material"
import { LiveKitRoom } from "@livekit/components-react"
import { DisconnectReason, Room, VideoPresets } from "livekit-client"
import PreEntrada from "../components/reunioes/sala/PreEntrada"
import SalaConectada from "../components/reunioes/sala/SalaConectada"
import { construirTema } from "../theme"
import { usePreferenciaStore } from "../store/preferenciaStore"
import { useAuthStore } from "../store/authStore"
import { codigoErro, mensagemErro, reunioesApi } from "../services/reunioesApi"
import { useAgora, useSondagem } from "../hooks/useSondagem"
import { ehAberta, segundosParaAbrir } from "../data/reuniaoMeta"

const CHAVE_ESCOLHAS = "quiron.reunioes.escolhas"
const PADRAO_ESCOLHAS = { microfone: true, camera: true, idMicrofone: "", idCamera: "" }

function lerEscolhas() {
  try {
    return { ...PADRAO_ESCOLHAS, ...JSON.parse(window.localStorage.getItem(CHAVE_ESCOLHAS) || "{}") }
  } catch {
    return PADRAO_ESCOLHAS
  }
}

function guardarEscolhas(escolhas) {
  try {
    window.localStorage.setItem(CHAVE_ESCOLHAS, JSON.stringify(escolhas))
  } catch {
    // Sem armazenamento (aba privada): a escolha vale so para esta visita.
  }
}

/** O que dizer depois que a conexao terminou. */
function textoDaSaida(motivo, encerreiAgora) {
  if (encerreiAgora) return { titulo: "Você encerrou a reunião", texto: "A sala foi fechada para todos.", Icone: CallEnd, voltar: false }
  switch (motivo) {
    case DisconnectReason.ROOM_DELETED:
      return { titulo: "A reunião foi encerrada", texto: "O anfitrião encerrou a reunião para todos.", Icone: CallEnd, voltar: false }
    case DisconnectReason.DUPLICATE_IDENTITY:
      return { titulo: "Você entrou em outro lugar", texto: "A mesma conta abriu esta sala em outra aba ou dispositivo.", Icone: PersonOff, voltar: true }
    case DisconnectReason.PARTICIPANT_REMOVED:
      return { titulo: "Você saiu da sala", texto: "Sua conexão foi encerrada pela sala.", Icone: PersonOff, voltar: true }
    case DisconnectReason.CLIENT_INITIATED:
      return { titulo: "Você saiu da reunião", texto: "Se foi sem querer, é só voltar.", Icone: CallEnd, voltar: true }
    default:
      return { titulo: "A conexão caiu", texto: "Verifique a internet e tente voltar.", Icone: PersonOff, voltar: true }
  }
}

function Aviso({ Icone, titulo, texto, children }) {
  return (
    <Box sx={{ minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center", p: 3, bgcolor: "background.default", color: "text.primary" }}>
      <Box sx={{ textAlign: "center", maxWidth: 440 }}>
        {Icone && <Icone sx={{ fontSize: 44, color: "text.secondary" }} aria-hidden />}
        <Typography variant="h5" fontWeight={700} sx={{ mt: 1 }}>
          {titulo}
        </Typography>
        {texto && (
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            {texto}
          </Typography>
        )}
        <Box sx={{ display: "flex", gap: 1.5, justifyContent: "center", flexWrap: "wrap", mt: 3 }}>{children}</Box>
      </Box>
    </Box>
  )
}

export default function ReuniaoSala() {
  const { id } = useParams()
  const preferencias = usePreferenciaStore((s) => s.preferencias)
  const tema = useMemo(() => construirTema({ ...preferencias, tema: "escuro" }), [preferencias])
  const usuario = useAuthStore((s) => s.usuario)

  const [reuniao, setReuniao] = useState(null)
  const [recebidoEm, setRecebidoEm] = useState(Date.now())
  const [falha, setFalha] = useState(null)
  const [fase, setFase] = useState("preparo") // preparo | sala | saiu
  const [credenciais, setCredenciais] = useState(null)
  const [entrando, setEntrando] = useState(false)
  const [erroEntrada, setErroEntrada] = useState(null)
  const [saida, setSaida] = useState({ motivo: null, encerreiAgora: false })
  const [escolhas, setEscolhas] = useState(lerEscolhas)
  const agora = useAgora(1000)

  const carregar = useCallback(async () => {
    try {
      const r = await reunioesApi.buscar(id)
      setReuniao(r)
      setRecebidoEm(Date.now())
      if (!r.meu_papel) setFalha("nao_convidado")
      else if (!ehAberta(r)) setFalha("encerrada")
    } catch (err) {
      setFalha(err?.response?.status === 404 ? "nao_encontrada" : "erro")
    }
  }, [id])

  useEffect(() => {
    carregar()
  }, [carregar])
  // Na espera, o "ja estao na sala" e a contagem acompanham o servidor.
  useSondagem(fase === "preparo" ? carregar : null, 30000)

  const mudarEscolhas = (novas) => {
    setEscolhas(novas)
    guardarEscolhas(novas)
  }

  /** Grava o consentimento e devolve-o ja aplicado na reuniao. */
  const mudarConsentimento = useCallback(
    async (aceito) => {
      const consentimento = await reunioesApi.consentir(id, aceito)
      setReuniao((r) => (r ? { ...r, meu_consentimento: consentimento } : r))
      return consentimento
    },
    [id]
  )

  /**
   * Entra na sala. `aceitoGravacao` e a escolha da PreEntrada (undefined
   * quando a reuniao nao grava); so vai ao servidor se mudou.
   */
  const entrar = async (aceitoGravacao) => {
    setEntrando(true)
    setErroEntrada(null)
    try {
      const atual = reuniao?.meu_consentimento
      if (typeof aceitoGravacao === "boolean" && (!atual?.decidido || Boolean(atual.aceito) !== aceitoGravacao)) {
        await mudarConsentimento(aceitoGravacao)
      }
      setCredenciais(await reunioesApi.token(id))
      setSaida({ motivo: null, encerreiAgora: false })
      setFase("sala")
    } catch (err) {
      const codigo = codigoErro(err)
      if (codigo === "REUNIAO_FECHADA") setFalha("encerrada")
      else if (codigo === "NAO_CONVIDADO") setFalha("nao_convidado")
      else setErroEntrada(mensagemErro(err, "Não foi possível entrar na sala."))
      if (codigo === "SALA_AINDA_FECHADA") carregar()
      setFase("preparo")
    } finally {
      setEntrando(false)
    }
  }

  // Uma sala nova a cada entrada, com os dispositivos escolhidos. O eco e
  // cancelado no proprio microfone: e o que a gravacao (Etapa 4) vai usar.
  const room = useMemo(
    () =>
      new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          deviceId: escolhas.idMicrofone || undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        videoCaptureDefaults: {
          deviceId: escolhas.idCamera || undefined,
          resolution: VideoPresets.h720.resolution,
        },
      }),
    // So o token novo cria outra sala; mudar o dispositivo la dentro e pelo
    // menu da barra, sem reconectar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [credenciais]
  )

  const encerrarParaTodos = async () => {
    try {
      await reunioesApi.encerrar(id)
      setSaida({ motivo: null, encerreiAgora: true })
      room.disconnect()
    } catch (err) {
      setErroEntrada(mensagemErro(err, "Não foi possível encerrar a reunião."))
    }
  }

  const voltar = (
    <Button component={RouterLink} to={`/reunioes/${id}`} variant="outlined" startIcon={<ArrowBack />}>
      Ver a reunião
    </Button>
  )

  let conteudo
  if (falha === "nao_encontrada" || falha === "erro") {
    conteudo = (
      <Aviso Icone={EventBusy} titulo={falha === "erro" ? "Não foi possível abrir a sala" : "Reunião não encontrada"} texto={falha === "erro" ? "Tente recarregar a página." : "Ela pode ter sido excluída, ou você não está entre os convidados."}>
        <Button component={RouterLink} to="/reunioes" variant="outlined">
          Ir para Reuniões
        </Button>
      </Aviso>
    )
  } else if (falha === "nao_convidado") {
    conteudo = (
      <Aviso Icone={PersonOff} titulo="Você não está entre os convidados" texto="Só quem foi convidado entra na sala. Peça ao anfitrião para incluir você.">
        {voltar}
      </Aviso>
    )
  } else if (falha === "encerrada" && fase !== "saiu") {
    conteudo = (
      <Aviso Icone={CallEnd} titulo="Esta reunião já terminou" texto={reuniao?.status === "CANCELADA" ? "A reunião foi cancelada." : "A sala foi encerrada."}>
        {voltar}
      </Aviso>
    )
  } else if (!reuniao) {
    conteudo = (
      <Box sx={{ minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "background.default" }}>
        <CircularProgress />
      </Box>
    )
  } else if (fase === "sala" && credenciais) {
    conteudo = (
      <LiveKitRoom
        room={room}
        serverUrl={credenciais.url}
        token={credenciais.token}
        connect
        audio={escolhas.microfone}
        video={escolhas.camera}
        onDisconnected={(motivo) => {
          setSaida((s) => ({ ...s, motivo }))
          setCredenciais(null)
          setFase("saiu")
          carregar()
        }}
        onError={(err) => setErroEntrada(err?.message || "A conexão com a sala falhou.")}
        style={{ height: "100%" }}
      >
        <SalaConectada
          reuniao={reuniao}
          ehAnfitriao={credenciais.papel === "ANFITRIAO"}
          onEncerrar={encerrarParaTodos}
          onMudarConsentimento={mudarConsentimento}
        />
      </LiveKitRoom>
    )
  } else if (fase === "saiu") {
    const t = textoDaSaida(saida.motivo, saida.encerreiAgora)
    const aindaAberta = ehAberta(reuniao) && falha !== "encerrada"
    conteudo = (
      <Aviso Icone={t.Icone} titulo={t.titulo} texto={saida.motivo === DisconnectReason.CLIENT_INITIATED || saida.encerreiAgora ? t.texto : erroEntrada || t.texto}>
        {t.voltar && aindaAberta && (
          <Button variant="contained" startIcon={entrando ? <CircularProgress size={16} color="inherit" /> : <Login />} disabled={entrando} onClick={() => entrar()}>
            Voltar para a sala
          </Button>
        )}
        {voltar}
      </Aviso>
    )
  } else {
    conteudo = (
      <PreEntrada
        reuniao={reuniao}
        nome={usuario?.nome}
        faltam={segundosParaAbrir(reuniao, recebidoEm, agora, reuniao.minutos_antes)}
        entrando={entrando}
        erro={erroEntrada}
        escolhas={escolhas}
        onEscolhas={mudarEscolhas}
        onEntrar={entrar}
      />
    )
  }

  return (
    <ThemeProvider theme={tema}>
      <CssBaseline />
      {/* dvh no celular: o 100vh conta a barra do navegador e esconde os controles. */}
      <Box sx={{ height: "100vh", "@supports (height: 100dvh)": { height: "100dvh" }, overflow: "auto" }}>{conteudo}</Box>
    </ThemeProvider>
  )
}
