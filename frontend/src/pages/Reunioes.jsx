/**
 * Reunioes por video: a lista, em duas abas — Proximas (agendadas e em
 * andamento, da mais cedo para a mais tarde) e Historico (encerradas e
 * canceladas, da mais recente para a mais antiga).
 *
 * QUEM VE O QUE e decidido no backend (reuniaoService): com a chave
 * `reunioes.reunioes.visualizar`, todas da incubadora; sem ela, as reunioes
 * para as quais a pessoa foi convidada. A tela diz qual dos dois e, para a
 * lista curta nao parecer uma incubadora parada.
 *
 * A lista e sondada a cada 30 s enquanto a aba esta visivel: e o que faz a
 * "Sala aberta" e o "na sala" aparecerem sem recarregar.
 *
 * Endpoints: GET /reunioes, GET /reunioes/disponibilidade (via reuniaoStore).
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Alert,
  Avatar,
  Box,
  Button,
  Link,
  Paper,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from "@mui/material"
import { Add, GraphicEq, Login, SearchOff, VideoCall } from "@mui/icons-material"
import AppLayout from "../components/AppLayout"
import TabelaDados from "../components/tabela/TabelaDados"
import ToolbarTabela from "../components/tabela/ToolbarTabela"
import DialogReuniao from "../components/reunioes/DialogReuniao"
import { CategoriaReuniao, SituacaoReuniao } from "../components/reunioes/MarcadoresReuniao"
import { useAuthStore } from "../store/authStore"
import { usePermissaoStore } from "../store/permissaoStore"
import { useReuniaoStore } from "../store/reuniaoStore"
import { mensagemErro, reunioesApi } from "../services/reunioesApi"
import { useAgora, useSondagem } from "../hooks/useSondagem"
import { iniciais, podeEntrarAgora, quando, separarPorAba, situacao } from "../data/reuniaoMeta"

const SONDAGEM_MS = 30000

const normalizar = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

export default function Reunioes() {
  const navigate = useNavigate()
  const usuario = useAuthStore((s) => s.usuario)
  const idTenant = usuario?.id_tenant
  const pode = usePermissaoStore((s) => s.pode)
  usePermissaoStore((s) => s.chaves) // re-render quando as chaves chegarem
  const disponivel = useReuniaoStore((s) => s.disponivel)
  const minutosAntes = useReuniaoStore((s) => s.minutosAntes)

  const [dados, setDados] = useState({ reunioes: [], escopo: null })
  const [recebidoEm, setRecebidoEm] = useState(Date.now())
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [aba, setAba] = useState("proximas")
  const [busca, setBusca] = useState("")
  const [criando, setCriando] = useState(false)
  const agora = useAgora(15000)

  const carregar = useCallback(async () => {
    if (!idTenant) return
    try {
      const r = await reunioesApi.listar(idTenant)
      setDados(r)
      setRecebidoEm(Date.now())
      setErro(null)
    } catch (err) {
      setErro(mensagemErro(err, "Não foi possível carregar as reuniões."))
    } finally {
      setCarregando(false)
    }
  }, [idTenant])

  useEffect(() => {
    setCarregando(true)
    carregar()
  }, [carregar])
  useSondagem(carregar, SONDAGEM_MS)

  const { proximas, historico } = useMemo(() => separarPorAba(dados.reunioes || []), [dados.reunioes])
  const daAba = aba === "proximas" ? proximas : historico

  const filtradas = useMemo(() => {
    const termo = normalizar(busca.trim())
    if (!termo) return daAba
    return daAba.filter((r) => normalizar(`${r.titulo} ${r.startup_nome || ""} ${r.anfitriao_nome || ""}`).includes(termo))
  }, [daAba, busca])

  const podeCriar = pode("reunioes.reunioes.criar") && disponivel !== false

  const colunas = useMemo(
    () => [
      {
        chave: "titulo",
        rotulo: "Reunião",
        obrigatoria: true,
        largura: 300,
        valorTexto: (r) => r.titulo,
        render: (r) => (
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap>
              {r.titulo}
            </Typography>
            <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", mt: 0.25 }}>
              <CategoriaReuniao reuniao={r} />
              {r.meu_papel === "ANFITRIAO" && (
                <Typography variant="caption" color="text.secondary">
                  você é o anfitrião
                </Typography>
              )}
            </Box>
          </Box>
        ),
      },
      {
        chave: "inicio_ts",
        rotulo: "Quando",
        largura: 220,
        valorOrdenacao: (r) => r.inicio_ts,
        valorTexto: (r) => quando(r),
        render: (r) => (
          <Typography variant="body2" sx={{ textTransform: "capitalize" }}>
            {quando(r)}
          </Typography>
        ),
      },
      {
        chave: "situacao",
        rotulo: "Situação",
        largura: 150,
        valorOrdenacao: (r) => situacao(r, recebidoEm, agora, minutosAntes).rotulo,
        valorTexto: (r) => situacao(r, recebidoEm, agora, minutosAntes).rotulo,
        render: (r) => (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <SituacaoReuniao reuniao={r} recebidoEm={recebidoEm} agora={agora} minutosAntes={minutosAntes} />
            {r.na_sala > 0 && (
              <Tooltip title={`${r.na_sala} pessoa(s) na sala agora`}>
                <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, color: "success.main", fontSize: 13, fontWeight: 600 }}>
                  <GraphicEq sx={{ fontSize: 16 }} aria-hidden />
                  {r.na_sala}
                </Box>
              </Tooltip>
            )}
          </Box>
        ),
      },
      {
        chave: "startup_nome",
        rotulo: "Startup",
        largura: 180,
        valorTexto: (r) => r.startup_nome || "",
        render: (r) => r.startup_nome || <Typography variant="body2" color="text.disabled">—</Typography>,
      },
      {
        chave: "anfitriao_nome",
        rotulo: "Anfitrião",
        largura: 190,
        valorTexto: (r) => r.anfitriao_nome || "",
        render: (r) => (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
            <Avatar src={r.anfitriao_foto || undefined} sx={{ width: 26, height: 26, fontSize: 11 }}>
              {iniciais(r.anfitriao_nome)}
            </Avatar>
            <Typography variant="body2" noWrap>
              {r.anfitriao_nome}
            </Typography>
          </Box>
        ),
      },
      {
        chave: "total_participantes",
        rotulo: "Pessoas",
        alinhamento: "right",
        largura: 100,
        valorTexto: (r) => String(r.total_participantes ?? ""),
        render: (r) => r.total_participantes,
      },
      {
        chave: "entrar",
        rotulo: "",
        ordenavel: false,
        obrigatoria: true,
        largura: 130,
        alinhamento: "right",
        valorTexto: () => "",
        render: (r) =>
          podeEntrarAgora(r, recebidoEm, agora, minutosAntes) ? (
            <Button
              size="small"
              variant="contained"
              startIcon={<Login />}
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/reunioes/${r.id_reuniao}/sala`)
              }}
            >
              Entrar
            </Button>
          ) : null,
      },
    ],
    [recebidoEm, agora, minutosAntes, navigate]
  )

  const vazio = busca.trim() ? (
    <Box sx={{ py: 2 }}>
      <SearchOff sx={{ fontSize: 32, color: "text.disabled" }} aria-hidden />
      <Typography fontWeight={700} sx={{ mt: 0.5 }}>
        Nenhuma reunião corresponde à busca
      </Typography>
      <Button size="small" variant="outlined" sx={{ mt: 1.5 }} onClick={() => setBusca("")}>
        Limpar busca
      </Button>
    </Box>
  ) : (
    <Box sx={{ py: 2, maxWidth: 440, mx: "auto" }}>
      <VideoCall sx={{ fontSize: 36, color: "text.disabled" }} aria-hidden />
      <Typography fontWeight={700} sx={{ mt: 0.5 }}>
        {aba === "proximas" ? "Nenhuma reunião marcada" : "Nenhuma reunião no histórico"}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: podeCriar && aba === "proximas" ? 1.5 : 0 }}>
        {aba === "proximas"
          ? podeCriar
            ? "Marque uma mentoria ou reunião: o convite vai por e-mail e a sala abre aqui, 15 minutos antes."
            : "Quando alguém convidar você para uma reunião, ela aparece aqui."
          : "As reuniões encerradas e canceladas ficam guardadas aqui."}
      </Typography>
      {podeCriar && aba === "proximas" && (
        <Button size="small" variant="contained" startIcon={<Add />} onClick={() => setCriando(true)}>
          Nova reunião
        </Button>
      )}
    </Box>
  )

  return (
    <AppLayout>
      <Box>
        <Box sx={{ display: "flex", alignItems: { xs: "flex-start", sm: "center" }, justifyContent: "space-between", flexWrap: "wrap", gap: 2, mb: 2.5 }}>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <VideoCall sx={{ color: "primary.main" }} aria-hidden />
              <Typography variant="h4" component="h1" fontWeight={700}>
                Reuniões
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Mentorias e reuniões por vídeo, dentro do Quíron.
            </Typography>
          </Box>
          {podeCriar && (
            <Button variant="contained" startIcon={<Add />} onClick={() => setCriando(true)}>
              Nova reunião
            </Button>
          )}
        </Box>

        {disponivel === false && (
          <Alert severity="info" sx={{ mb: 2 }}>
            As reuniões por vídeo não estão configuradas nesta instalação. O histórico continua disponível.
          </Alert>
        )}
        {erro && (
          <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={carregar}>Tentar novamente</Button>}>
            {erro}
          </Alert>
        )}

        <Paper sx={{ borderRadius: 0 }}>
          <Tabs value={aba} onChange={(_, v) => setAba(v)} sx={{ px: 2, borderBottom: 1, borderColor: "divider" }}>
            <Tab value="proximas" label={`Próximas${proximas.length ? ` (${proximas.length})` : ""}`} />
            <Tab value="historico" label="Histórico" />
          </Tabs>
          <ToolbarTabela
            busca={busca}
            onBuscaChange={setBusca}
            placeholderBusca="Pesquisar por título, startup ou anfitrião..."
          />
          <TabelaDados
            dados={filtradas}
            colunas={colunas}
            chaveId="id_reuniao"
            chaveStorage="reunioes"
            carregando={carregando && !dados.reunioes?.length}
            mensagemVazio={vazio}
            onClickLinha={(r) => navigate(`/reunioes/${r.id_reuniao}`)}
            larguraMinima={1000}
          />
        </Paper>

        {dados.escopo === "MINHAS" && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
            Você vê as reuniões para as quais foi convidado.
          </Typography>
        )}
        {podeCriar && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
            Vai usar um navegador ou dispositivo novo?{" "}
            <Link component="button" variant="caption" onClick={() => navigate("/reunioes/diagnostico")}>
              Teste câmera, microfone e gravação aqui
            </Link>
            .
          </Typography>
        )}
      </Box>

      <DialogReuniao
        aberto={criando}
        reuniao={null}
        onFechar={() => setCriando(false)}
        onSalvo={(r) => {
          setCriando(false)
          navigate(`/reunioes/${r.id_reuniao}`)
        }}
      />
    </AppLayout>
  )
}
