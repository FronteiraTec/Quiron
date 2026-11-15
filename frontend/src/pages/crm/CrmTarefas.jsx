/**
 * Tarefas do CRM: a area geral, com as tarefas de todas as oportunidades e
 * clientes da startup (e as soltas).
 *
 * Os indicadores do topo FILTRAM, como no quadro de tarefas da incubadora:
 * clicar em "Atrasadas" recorta a lista para elas; clicar de novo devolve
 * tudo. `?recorte=atrasadas` (ou abertas, minhas) chega do painel.
 *
 * A tarefa de uma oportunidade aparece aqui E no detalhe dela — e a mesma
 * linha, e o que muda num lugar aparece no outro.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { Link as RouterLink, useSearchParams } from "react-router-dom"
import { Alert, Box, Button, Link, Paper, Typography } from "@mui/material"
import { Add, AssignmentInd, EventBusy, PendingActions, SearchOff, TaskAlt } from "@mui/icons-material"
import { useCrm } from "../../components/crm/useCrm"
import DrawerTarefaCrm from "../../components/crm/DrawerTarefaCrm"
import { StatusTarefaCrm, VencimentoTarefa } from "../../components/crm/MarcadoresCrm"
import IndicadoresTarefas from "../../components/tarefas/IndicadoresTarefas"
import { AvatarResponsavel, PrioridadeTarefa } from "../../components/tarefas/MarcadoresTarefa"
import TabelaDados from "../../components/tabela/TabelaDados"
import ToolbarTabela from "../../components/tabela/ToolbarTabela"
import PainelFiltros, { contarFiltros } from "../../components/tabela/PainelFiltros"
import { PRIORIDADES_CRM, STATUS_TAREFA, TAREFA_ABERTA, dataHoraBR } from "../../data/crmMeta"
import { prioridade as metaPrioridade } from "../../data/tarefaMeta"

const DIAS_CONCLUIDAS = 7
const SEM_RESPONSAVEL = "__nenhum__"
const RECORTES = ["abertas", "atrasadas", "minhas", "concluidas"]

const normalizar = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

function noRecorte(t, recorte, idUsuario) {
  if (recorte === "abertas") return TAREFA_ABERTA(t.status)
  if (recorte === "atrasadas") return t.atrasada
  if (recorte === "minhas") return TAREFA_ABERTA(t.status) && t.id_responsavel === idUsuario
  if (recorte === "concluidas") {
    return t.status === "CONCLUIDA" && t.concluida_ts && Date.now() - new Date(t.concluida_ts) <= DIAS_CONCLUIDAS * 86400000
  }
  return true
}

export default function CrmTarefas() {
  const { api, membros, idUsuario, falha } = useCrm()
  const [params, setParams] = useSearchParams()

  const [tarefas, setTarefas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [busca, setBusca] = useState("")
  const [filtros, setFiltros] = useState({})
  const [painelAberto, setPainelAberto] = useState(false)
  const [recorte, setRecorte] = useState(() => (RECORTES.includes(params.get("recorte")) ? params.get("recorte") : null))
  const [aberta, setAberta] = useState(undefined) // undefined fechado, null nova

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      setTarefas(await api.tarefas())
      setErro(null)
    } catch (err) {
      setErro(falha(err, "Não foi possível carregar as tarefas."))
    } finally {
      setCarregando(false)
    }
  }, [api, falha])

  useEffect(() => {
    carregar()
  }, [carregar])

  useEffect(() => {
    if (params.get("recorte")) setParams({}, { replace: true })
  }, [params, setParams])

  const contagens = useMemo(
    () => Object.fromEntries(RECORTES.map((r) => [r, tarefas.filter((t) => noRecorte(t, r, idUsuario)).length])),
    [tarefas, idUsuario]
  )

  const indicadores = [
    { id: "abertas", rotulo: "Pendentes", valor: contagens.abertas, icone: <PendingActions sx={{ fontSize: 16 }} />, ajuda: "Pendentes ou em andamento." },
    {
      id: "atrasadas",
      rotulo: "Atrasadas",
      valor: contagens.atrasadas,
      alerta: contagens.atrasadas > 0,
      icone: <EventBusy sx={{ fontSize: 16 }} />,
      ajuda: "Ainda abertas e com o prazo já vencido.",
    },
    { id: "minhas", rotulo: "Sob sua responsabilidade", valor: contagens.minhas, icone: <AssignmentInd sx={{ fontSize: 16 }} />, ajuda: "Abertas e com você como responsável." },
    { id: "concluidas", rotulo: `Concluídas em ${DIAS_CONCLUIDAS} dias`, valor: contagens.concluidas, icone: <TaskAlt sx={{ fontSize: 16 }} /> },
  ]

  const gruposFiltro = useMemo(
    () => [
      { id: "status", rotulo: "Status", tipo: "checkbox", itens: Object.entries(STATUS_TAREFA).map(([id, m]) => ({ id, rotulo: m.rotulo })) },
      { id: "prioridade", rotulo: "Prioridade", tipo: "checkbox", itens: [...PRIORIDADES_CRM].reverse().map((p) => ({ id: p.chave, rotulo: p.rotulo })) },
      {
        id: "responsavel",
        rotulo: "Responsável",
        tipo: "checkbox",
        itens: [{ id: SEM_RESPONSAVEL, rotulo: "Sem responsável" }, ...membros.map((m) => ({ id: String(m.id_usuario), rotulo: m.nome }))],
      },
    ],
    [membros]
  )

  const filtradas = useMemo(() => {
    const termo = normalizar(busca.trim())
    const marcados = (id) => filtros[id] || []
    return tarefas.filter((t) => {
      if (!noRecorte(t, recorte, idUsuario)) return false
      if (termo && !normalizar(`${t.titulo} ${t.cliente_nome || ""} ${t.oportunidade_titulo || ""}`).includes(termo)) return false
      if (marcados("status").length && !marcados("status").includes(t.status)) return false
      if (marcados("prioridade").length && !marcados("prioridade").includes(t.prioridade)) return false
      if (marcados("responsavel").length) {
        const chave = t.id_responsavel ? String(t.id_responsavel) : SEM_RESPONSAVEL
        if (!marcados("responsavel").includes(chave)) return false
      }
      return true
    })
  }, [tarefas, busca, filtros, recorte, idUsuario])

  const colunas = useMemo(
    () => [
      {
        chave: "titulo",
        rotulo: "Tarefa",
        obrigatoria: true,
        largura: 320,
        valorTexto: (t) => t.titulo,
        render: (t) => {
          const encerrada = !TAREFA_ABERTA(t.status)
          return (
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="body2"
                fontWeight={600}
                noWrap
                sx={{ textDecoration: encerrada ? "line-through" : "none", color: encerrada ? "text.secondary" : "text.primary" }}
              >
                {t.titulo}
              </Typography>
              {(t.oportunidade_titulo || t.cliente_nome) && (
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                  {t.oportunidade_titulo && !t.oportunidade_excluida ? (
                    <Link component={RouterLink} to={`/crm/oportunidades/${t.id_oportunidade}`} underline="hover" onClick={(e) => e.stopPropagation()}>
                      {t.oportunidade_titulo}
                    </Link>
                  ) : (
                    t.oportunidade_titulo
                  )}
                  {t.oportunidade_titulo && t.cliente_nome ? " · " : ""}
                  {t.cliente_nome}
                </Typography>
              )}
            </Box>
          )
        },
      },
      {
        chave: "status",
        rotulo: "Status",
        largura: 150,
        valorOrdenacao: (t) => Object.keys(STATUS_TAREFA).indexOf(t.status),
        valorTexto: (t) => STATUS_TAREFA[t.status]?.rotulo || "",
        render: (t) => <StatusTarefaCrm status={t.status} />,
      },
      {
        chave: "prioridade",
        rotulo: "Prioridade",
        largura: 120,
        valorOrdenacao: (t) => metaPrioridade(t.prioridade).peso,
        valorTexto: (t) => metaPrioridade(t.prioridade).rotulo,
        render: (t) => <PrioridadeTarefa chave={t.prioridade} />,
      },
      {
        chave: "responsavel",
        rotulo: "Responsável",
        largura: 190,
        valorOrdenacao: (t) => t.responsavel_nome,
        valorTexto: (t) => t.responsavel_nome || "",
        render: (t) => <AvatarResponsavel nome={t.responsavel_nome} foto={t.responsavel_foto} comNome />,
      },
      {
        chave: "vencimento_ts",
        rotulo: "Vencimento",
        largura: 170,
        valorOrdenacao: (t) => t.vencimento_ts,
        valorTexto: (t) => dataHoraBR(t.vencimento_ts),
        render: (t) => <VencimentoTarefa tarefa={t} mostrarVazio />,
      },
      {
        chave: "criado_ts",
        rotulo: "Criada em",
        visivelPadrao: false,
        largura: 140,
        valorOrdenacao: (t) => t.criado_ts,
        valorTexto: (t) => dataHoraBR(t.criado_ts),
        render: (t) => new Date(t.criado_ts).toLocaleDateString("pt-BR"),
      },
      {
        chave: "concluida_ts",
        rotulo: "Concluída em",
        visivelPadrao: false,
        largura: 140,
        valorOrdenacao: (t) => t.concluida_ts,
        valorTexto: (t) => dataHoraBR(t.concluida_ts),
        render: (t) => (t.concluida_ts ? new Date(t.concluida_ts).toLocaleDateString("pt-BR") : "—"),
      },
    ],
    []
  )

  const totalFiltros = contarFiltros(filtros)
  const filtrando = Boolean(busca.trim() || totalFiltros || recorte)

  const vazio = filtrando ? (
    <Box sx={{ py: 2 }}>
      <SearchOff sx={{ fontSize: 32, color: "text.disabled" }} aria-hidden />
      <Typography fontWeight={700} sx={{ mt: 0.5 }}>
        Nenhuma tarefa corresponde aos filtros
      </Typography>
      <Button size="small" variant="outlined" sx={{ mt: 1.5 }} onClick={() => { setBusca(""); setFiltros({}); setRecorte(null) }}>
        Limpar filtros
      </Button>
    </Box>
  ) : (
    <Box sx={{ py: 2, maxWidth: 420, mx: "auto" }}>
      <TaskAlt sx={{ fontSize: 36, color: "text.disabled" }} aria-hidden />
      <Typography fontWeight={700} sx={{ mt: 0.5 }}>
        Nenhuma tarefa ainda
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
        Ligações, envios de proposta, reuniões: registre o que precisa ser feito, com responsável e prazo.
      </Typography>
      <Button size="small" variant="contained" startIcon={<Add />} onClick={() => setAberta(null)}>
        Nova tarefa
      </Button>
    </Box>
  )

  return (
    <Box>
      {erro && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={carregar}>Tentar novamente</Button>}>
          {erro}
        </Alert>
      )}

      <IndicadoresTarefas
        itens={indicadores}
        ativo={recorte}
        onAlternar={(id) => setRecorte((atual) => (atual === id ? null : id))}
        carregando={carregando && tarefas.length === 0}
      />

      <Paper sx={{ borderRadius: 0 }}>
        <ToolbarTabela
          busca={busca}
          onBuscaChange={setBusca}
          placeholderBusca="Pesquisar por tarefa, cliente ou oportunidade..."
          totalFiltros={totalFiltros}
          onAbrirFiltros={() => setPainelAberto(true)}
          acoes={
            <Button variant="contained" size="small" startIcon={<Add />} onClick={() => setAberta(null)}>
              Nova tarefa
            </Button>
          }
        />
        <TabelaDados
          dados={filtradas}
          colunas={colunas}
          chaveId="id_tarefa"
          chaveStorage="crm.tarefas"
          carregando={carregando && tarefas.length === 0}
          mensagemVazio={vazio}
          onClickLinha={(t) => setAberta(t)}
          larguraMinima={1000}
        />
      </Paper>

      <PainelFiltros
        aberto={painelAberto}
        onFechar={() => setPainelAberto(false)}
        titulo="Filtrar tarefas"
        grupos={gruposFiltro}
        selecionados={filtros}
        onAplicar={setFiltros}
        onLimpar={() => setFiltros({})}
      />

      <DrawerTarefaCrm aberto={aberta !== undefined} onFechar={() => setAberta(undefined)} tarefa={aberta || null} onSalvo={carregar} />
    </Box>
  )
}
