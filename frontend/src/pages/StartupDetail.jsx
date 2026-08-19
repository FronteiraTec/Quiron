/**
 * Tela de detalhe de uma startup (visao admin/mentor da incubadora).
 *
 * Cabecalho com nome, data de entrada, fase atual, tipo, status e progresso na
 * trilha, alem de acoes (editar o cadastro, trocar o status). Abaixo, as abas:
 * Cadastro (os dados que o formulario grava), Membros, Modelos e Fases
 * concluidas.
 *
 * A EDICAO abre o MESMO painel lateral do cadastro novo, e nao um dialogo
 * proprio: manter dois formularios para o mesmo cadastro garantiria que um
 * campo novo entrasse em um e faltasse no outro.
 *
 * O STATUS deixou de ser um menu de tres itens fixos (Ativar/Pausar/Encerrar):
 * agora e a lista de situacoes que a incubadora cadastrou. O estado de ciclo —
 * o que diz se a startup ainda esta no programa — sai da situacao escolhida, no
 * backend.
 *
 * Endpoints:
 *   GET   /startups/:id          -> dados + contatos + fase_atual/progresso_pct
 *   PATCH /startups/:id/situacao -> troca o status
 */
import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Chip,
  LinearProgress,
  Alert,
  CircularProgress,
  ListItemIcon,
} from "@mui/material"
import {
  RocketLaunch,
  Groups,
  ViewModule,
  CheckCircle,
  Edit,
  MoreVert,
  ArrowBack,
  Badge,
  Circle,
} from "@mui/icons-material"
import AppLayout from "../components/AppLayout"
import api from "../services/api"
import AbaCadastro from "../components/startup/AbaCadastro"
import AbaMembros from "../components/startup/AbaMembros"
import AbaModelos from "../components/startup/AbaModelos"
import AbaFasesConcluidas from "../components/startup/AbaFasesConcluidas"
import ChipSituacao from "../components/startup/ChipSituacao"
import DrawerCadastroStartup from "../components/startup/DrawerCadastroStartup"
import { useStartupConfigStore } from "../store/startupConfigStore"

export default function StartupDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const situacoes = useStartupConfigStore((s) => s.situacoes) || []

  const [startup, setStartup] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [aviso, setAviso] = useState(null)
  const [aba, setAba] = useState("cadastro")

  const [drawerAberto, setDrawerAberto] = useState(false)
  const [menuAncora, setMenuAncora] = useState(null)

  const carregar = async () => {
    setCarregando(true)
    try {
      const { data } = await api.get(`/startups/${id}`)
      setStartup(data.startup)
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao carregar a startup." })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const trocarSituacao = async (chave) => {
    setMenuAncora(null)
    setAviso(null)
    try {
      await api.patch(`/startups/${id}/situacao`, { situacao: chave })
      await carregar()
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao alterar o status." })
    }
  }

  if (carregando) {
    return (
      <AppLayout>
        <Box sx={{ textAlign: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      </AppLayout>
    )
  }

  if (!startup) {
    return (
      <AppLayout>
        <Alert severity="error">{aviso?.texto || "Startup não encontrada."}</Alert>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <Box>
        <Button startIcon={<ArrowBack />} onClick={() => navigate("/startups")} sx={{ mb: 2 }}>
          Voltar
        </Button>

        {aviso && (
          <Alert severity={aviso.tipo} sx={{ mb: 3 }} onClose={() => setAviso(null)}>
            {aviso.texto}
          </Alert>
        )}

        <Paper sx={{ borderRadius: 0, p: 3, mb: 3 }}>
          <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
              <RocketLaunch sx={{ color: "primary.main", fontSize: 32 }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h4" fontWeight={700} noWrap>
                  {startup.nome}
                </Typography>
                <Typography color="text.secondary">
                  Startup incubada desde{" "}
                  {startup.criado_ts ? new Date(startup.criado_ts).toLocaleDateString("pt-BR") : "-"}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: "flex", gap: 1, flexShrink: 0 }}>
              <Button
                data-tour="startup-editar"
                variant="outlined"
                startIcon={<Edit />}
                onClick={() => setDrawerAberto(true)}
              >
                Editar
              </Button>
              <IconButton data-tour="startup-status" onClick={(e) => setMenuAncora(e.currentTarget)}>
                <MoreVert />
              </IconButton>
              <Menu anchorEl={menuAncora} open={Boolean(menuAncora)} onClose={() => setMenuAncora(null)}>
                {/* O status atual continua na lista, desabilitado: some-lo
                    faria a posicao dos itens mudar de startup para startup. */}
                {situacoes.map((s) => (
                  <MenuItem
                    key={s.chave}
                    disabled={s.chave === startup.situacao}
                    onClick={() => trocarSituacao(s.chave)}
                  >
                    <ListItemIcon>
                      <Circle sx={{ fontSize: 12, color: s.cor }} />
                    </ListItemIcon>
                    {s.rotulo}
                  </MenuItem>
                ))}
                {situacoes.length === 0 && (
                  <MenuItem disabled>Nenhum status cadastrado.</MenuItem>
                )}
              </Menu>
            </Box>
          </Box>

          <Box
            data-tour="startup-progresso"
            sx={{ display: "flex", alignItems: "center", gap: 2, mt: 3, flexWrap: "wrap" }}
          >
            <Chip label={startup.fase_atual || "Graduada"} variant="outlined" />
            {startup.tipo_rotulo && (
              <Chip
                icon={<Badge sx={{ fontSize: 16 }} />}
                label={startup.tipo_rotulo}
                variant="outlined"
                sx={{ borderColor: startup.tipo_cor, color: startup.tipo_cor }}
              />
            )}
            <ChipSituacao startup={startup} size="medium" />
            <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: 1, minWidth: 180 }}>
              <LinearProgress
                variant="determinate"
                value={startup.progresso_pct}
                sx={{ flex: 1, height: 10, borderRadius: 5 }}
              />
              <Typography variant="body2" color="text.secondary" sx={{ width: 44, textAlign: "right" }}>
                {startup.progresso_pct}%
              </Typography>
            </Box>
          </Box>
        </Paper>

        <Paper sx={{ borderRadius: 0, overflow: "hidden" }}>
          <Tabs
            value={aba}
            onChange={(_, v) => setAba(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ borderBottom: 1, borderColor: "divider", px: 2 }}
          >
            <Tab data-tour="startup-aba-cadastro" value="cadastro" label="Cadastro" icon={<Badge />} iconPosition="start" />
            <Tab data-tour="startup-aba-membros" value="membros" label="Membros" icon={<Groups />} iconPosition="start" />
            <Tab data-tour="startup-aba-modelos" value="modelos" label="Modelos" icon={<ViewModule />} iconPosition="start" />
            <Tab data-tour="startup-aba-fases" value="fases" label="Fases concluídas" icon={<CheckCircle />} iconPosition="start" />
          </Tabs>
          <Box data-tour="startup-conteudo" sx={{ p: 3 }}>
            {aba === "cadastro" && <AbaCadastro startup={startup} />}
            {aba === "membros" && <AbaMembros idStartup={startup.id_startup} idTenant={startup.id_tenant} />}
            {aba === "modelos" && <AbaModelos idStartup={startup.id_startup} />}
            {aba === "fases" && <AbaFasesConcluidas idStartup={startup.id_startup} />}
          </Box>
        </Paper>
      </Box>

      <DrawerCadastroStartup
        aberto={drawerAberto}
        onFechar={() => setDrawerAberto(false)}
        idTenant={startup.id_tenant}
        startup={startup}
        onSalvo={carregar}
      />
    </AppLayout>
  )
}
