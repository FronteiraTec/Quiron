/**
 * Eventos (CalendarPage) - centro de planejamento das startups incubadas.
 *
 * Reune tarefas, reunioes, mentorias, eventos, entregas, prazos, workshops,
 * bancas, apresentacoes e vencimentos num unico calendario (tabela "evento",
 * distinguidos pelo campo categoria). Ocupa a viewport inteira (AppLayout em
 * fullBleed): sidebar (busca + eventos do dia + filtros + mini calendario no
 * rodape) e area principal (toolbar + grade do calendario). Clicar num evento
 * abre o EventDrawer (nao um modal).
 */
import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Box, Paper, Alert, IconButton, useTheme, useMediaQuery, Drawer } from "@mui/material"
import { Menu as MenuIcon } from "@mui/icons-material"
import AppLayout from "../components/AppLayout"
import CalendarSidebar from "../components/calendar/CalendarSidebar"
import CalendarToolbar from "../components/calendar/CalendarToolbar"
import CalendarGrid from "../components/calendar/CalendarGrid"
import EventDrawer from "../components/calendar/EventDrawer"
import EventFormDrawer from "../components/calendar/EventFormDrawer"
import { useAuthStore } from "../store/authStore"
import { useEventos } from "../hooks/useEventos"
import api from "../services/api"

export default function Eventos() {
  const usuario = useAuthStore((s) => s.usuario)
  const idTenant = usuario?.id_tenant ?? null
  const nomeTenant = usuario?.tenants?.find((t) => t.id_tenant === idTenant)?.nome

  const theme = useTheme()
  const mdUp = useMediaQuery(theme.breakpoints.up("md"))
  const smUp = useMediaQuery(theme.breakpoints.up("sm"))
  const [sidebarAberta, setSidebarAberta] = useState(true)

  const calendario = useEventos({ idTenant, usuarioId: usuario?.id })

  const [startups, setStartups] = useState([])
  useEffect(() => {
    if (!idTenant) return
    api
      .get("/startups", { params: { id_tenant: idTenant } })
      .then(({ data }) => setStartups(data.startups))
      .catch(() => setStartups([]))
  }, [idTenant])

  // Permissao RBAC "eventos.agenda.criar": so quem tem (ou o root) ve o
  // botao de criar atividade. O backend tambem valida em /eventos (POST).
  const [podeCriar, setPodeCriar] = useState(false)
  useEffect(() => {
    if (usuario?.root) {
      setPodeCriar(true)
      return
    }
    if (!idTenant) return
    api
      .get("/permissoes/minhas", { params: { id_tenant: idTenant } })
      .then(({ data }) => setPodeCriar(data.permissoes.includes("eventos.agenda.criar")))
      .catch(() => setPodeCriar(false))
  }, [idTenant, usuario?.root])

  // --- Drawers de evento (detalhe / criacao-edicao) ---
  const [eventoSelecionado, setEventoSelecionado] = useState(null)
  const [formAberto, setFormAberto] = useState(false)
  const [eventoEditar, setEventoEditar] = useState(null)
  const [dataParaNovo, setDataParaNovo] = useState(null)

  const abrirDetalhe = (evento) => setEventoSelecionado(evento)
  const fecharDetalhe = () => setEventoSelecionado(null)

  // Deep link das notificacoes da Navbar (/eventos?data=<iso>&evento=<id>):
  // posiciona o calendario na data e abre o detalhe assim que o evento chega.
  const [parametros, setParametros] = useSearchParams()
  const dataParam = parametros.get("data")
  const eventoParam = parametros.get("evento")

  useEffect(() => {
    if (!dataParam) return
    const data = new Date(dataParam)
    if (!Number.isNaN(data.getTime())) calendario.irParaData(data)
  }, [dataParam, calendario.irParaData])

  useEffect(() => {
    if (!eventoParam) return
    const alvo = calendario.todosEventos.find((ev) => String(ev.id_evento) === eventoParam)
    if (!alvo) return
    setEventoSelecionado(alvo)
    // Limpa a query para o drawer nao reabrir sozinho depois de fechado.
    setParametros({}, { replace: true })
  }, [eventoParam, calendario.todosEventos, setParametros])

  const abrirNovaAtividade = (data) => {
    setEventoEditar(null)
    setDataParaNovo(data || calendario.dataReferencia)
    setFormAberto(true)
  }

  const abrirEdicao = (evento) => {
    setEventoSelecionado(null)
    setEventoEditar(evento)
    setFormAberto(true)
  }

  const salvarEvento = async (dados) => {
    if (eventoEditar) {
      await calendario.atualizarEvento(eventoEditar.id_evento, dados)
    } else {
      await calendario.criarEvento(dados)
    }
  }

  const excluirEvento = async (evento) => {
    if (!window.confirm(`Excluir a atividade "${evento.titulo}"?`)) return
    await calendario.excluirEvento(evento.id_evento)
    setEventoSelecionado(null)
  }

  const irParaDia = (dia) => {
    calendario.irParaData(dia)
    calendario.setVisao("dia")
  }

  const conteudoSidebar = (
    <CalendarSidebar
      busca={calendario.busca}
      onBuscaChange={calendario.setBusca}
      categoriasAtivas={calendario.categoriasAtivas}
      onAlternarCategoria={calendario.alternarCategoria}
      somenteMeus={calendario.somenteMeus}
      onAlternarMeus={calendario.alternarSomenteMeus}
      dataSelecionada={calendario.dataReferencia}
      onSelecionarData={calendario.irParaData}
      eventos={calendario.eventos}
      todosEventos={calendario.todosEventos}
      onSelecionarEvento={abrirDetalhe}
    />
  )

  return (
    <AppLayout fullBleed>
      <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {!idTenant ? (
          <Alert severity="info" sx={{ m: 3 }}>
            Seu usuario nao esta vinculado a nenhuma incubadora, entao nao ha calendario para exibir.
          </Alert>
        ) : (
          <Paper
            elevation={0}
            sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", borderRadius: 0, overflow: "hidden" }}
          >
            {calendario.aviso && (
              <Alert severity={calendario.aviso.tipo} onClose={calendario.limparAviso} sx={{ borderRadius: 0 }}>
                {calendario.aviso.texto}
              </Alert>
            )}

            <Box sx={{ display: "flex", alignItems: "center" }}>
              {!mdUp && (
                <IconButton sx={{ ml: 1 }} onClick={() => setSidebarAberta((v) => !v)}>
                  <MenuIcon fontSize="small" />
                </IconButton>
              )}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <CalendarToolbar
                  contexto={nomeTenant}
                  dataReferencia={calendario.dataReferencia}
                  visao={calendario.visao}
                  onAnterior={calendario.irAnterior}
                  onProximo={calendario.irProximo}
                  onHoje={calendario.irParaHoje}
                  onMudarVisao={calendario.setVisao}
                  onNovaAtividade={podeCriar ? () => abrirNovaAtividade(calendario.dataReferencia) : null}
                />
              </Box>
            </Box>

            <Box sx={{ flex: 1, minHeight: 0, display: "flex" }}>
              {mdUp ? (
                conteudoSidebar
              ) : smUp ? (
                sidebarAberta && conteudoSidebar
              ) : (
                <Drawer anchor="left" open={sidebarAberta} onClose={() => setSidebarAberta(false)}>
                  {conteudoSidebar}
                </Drawer>
              )}

              {/* O wrapper existe para o tour ter um alvo estavel: cada visao
                  do CalendarGrid renderiza uma raiz diferente. */}
              <Box data-tour="calendario-grade" sx={{ flex: 1, minWidth: 0, display: "flex" }}>
                <CalendarGrid
                  dataReferencia={calendario.dataReferencia}
                  visao={calendario.visao}
                  eventos={calendario.eventos}
                  carregando={calendario.carregando}
                  onSelecionarEvento={abrirDetalhe}
                  onSelecionarDia={irParaDia}
                />
              </Box>
            </Box>
          </Paper>
        )}
      </Box>

      <EventDrawer
        evento={eventoSelecionado}
        aberto={Boolean(eventoSelecionado)}
        onClose={fecharDetalhe}
        onEditar={abrirEdicao}
        onExcluir={excluirEvento}
        usuarioId={usuario?.id}
      />

      <EventFormDrawer
        aberto={formAberto}
        onClose={() => setFormAberto(false)}
        onSalvar={salvarEvento}
        startups={startups}
        eventoEditar={eventoEditar}
        dataInicial={dataParaNovo}
      />
    </AppLayout>
  )
}
