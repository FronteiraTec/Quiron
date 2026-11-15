/**
 * Oportunidades: o funil em KANBAN (padrao) ou em LISTA.
 *
 * As duas visualizacoes trabalham sobre a mesma lista, carregada uma vez, e os
 * filtros valem para as duas. A escolha da visualizacao fica guardada no
 * navegador.
 *
 * Mover de etapa e OTIMISTA: o cartao muda de coluna na hora e volta se o
 * servidor recusar. Soltar em Ganho ou Perdido abre o dialogo de encerramento.
 *
 * `?nova=1` abre o cadastro (o atalho do painel).
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Alert, Box, Button, Paper, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material"
import { alpha } from "@mui/material/styles"
import { Add, Handshake, SearchOff, TableRows, ViewKanban } from "@mui/icons-material"
import { useCrm } from "../../components/crm/useCrm"
import KanbanOportunidades from "../../components/crm/KanbanOportunidades"
import DrawerOportunidade from "../../components/crm/DrawerOportunidade"
import DialogEncerrar from "../../components/crm/DialogEncerrar"
import { SituacaoOportunidade, VencimentoTarefa } from "../../components/crm/MarcadoresCrm"
import { AvatarResponsavel } from "../../components/tarefas/MarcadoresTarefa"
import TabelaDados from "../../components/tabela/TabelaDados"
import ToolbarTabela from "../../components/tabela/ToolbarTabela"
import PainelFiltros, { contarFiltros } from "../../components/tabela/PainelFiltros"
import { SITUACAO, dataBR, moeda, moedaCurta } from "../../data/crmMeta"

const CHAVE_VISUAL = "quiron.crm.oportunidades.visual"
const SEM_RESPONSAVEL = "__nenhum__"

function lerVisual() {
  try {
    return window.localStorage.getItem(CHAVE_VISUAL) || "kanban"
  } catch {
    return "kanban"
  }
}

const normalizar = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

export default function CrmOportunidades() {
  const { api, etapas, etapasAtivas, membros, falha, avisar } = useCrm()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  const [visual, setVisual] = useState(lerVisual)
  const [ops, setOps] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [busca, setBusca] = useState("")
  const [filtros, setFiltros] = useState({})
  const [painelAberto, setPainelAberto] = useState(false)
  const [drawer, setDrawer] = useState(null) // { oportunidade?, idEtapaInicial? }
  const [encerrar, setEncerrar] = useState(null) // { modo, op }

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      setOps(await api.oportunidades())
      setErro(null)
    } catch (err) {
      setErro(falha(err, "Não foi possível carregar as oportunidades."))
    } finally {
      setCarregando(false)
    }
  }, [api, falha])

  useEffect(() => {
    carregar()
  }, [carregar])

  useEffect(() => {
    try {
      window.localStorage.setItem(CHAVE_VISUAL, visual)
    } catch {
      // Sem storage: a tela funciona, so nao lembra.
    }
  }, [visual])

  useEffect(() => {
    if (params.get("nova")) {
      setDrawer({})
      setParams({}, { replace: true })
    }
  }, [params, setParams])

  // ------------------------------------------------------------ filtros
  const gruposFiltro = useMemo(() => {
    const grupos = [
      {
        id: "situacao",
        rotulo: "Situação",
        tipo: "checkbox",
        itens: Object.entries(SITUACAO).map(([id, m]) => ({ id, rotulo: m.rotulo })),
      },
      { id: "etapa", rotulo: "Etapa", tipo: "checkbox", itens: etapas.map((e) => ({ id: String(e.id_etapa), rotulo: e.nome })) },
      {
        id: "responsavel",
        rotulo: "Responsável",
        tipo: "checkbox",
        itens: [{ id: SEM_RESPONSAVEL, rotulo: "Sem responsável" }, ...membros.map((m) => ({ id: String(m.id_usuario), rotulo: m.nome }))],
      },
    ]
    const origens = [...new Set(ops.map((o) => o.origem).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"))
    if (origens.length) grupos.push({ id: "origem", rotulo: "Origem", tipo: "checkbox", itens: origens.map((o) => ({ id: o, rotulo: o })) })
    return grupos
  }, [etapas, membros, ops])

  const filtradas = useMemo(() => {
    const termo = normalizar(busca.trim())
    const marcados = (id) => filtros[id] || []
    return ops.filter((o) => {
      if (termo && !normalizar(`${o.titulo} ${o.cliente_nome} ${o.cliente_empresa || ""}`).includes(termo)) return false
      if (marcados("situacao").length && !marcados("situacao").includes(o.situacao)) return false
      if (marcados("etapa").length && !marcados("etapa").includes(String(o.id_etapa))) return false
      if (marcados("responsavel").length) {
        const chave = o.id_responsavel ? String(o.id_responsavel) : SEM_RESPONSAVEL
        if (!marcados("responsavel").includes(chave)) return false
      }
      if (marcados("origem").length && !marcados("origem").includes(o.origem)) return false
      return true
    })
  }, [ops, busca, filtros])

  const totalFiltros = contarFiltros(filtros)
  const filtrando = Boolean(busca.trim() || totalFiltros)

  // -------------------------------------------------------------- acoes
  const substituir = (op) => setOps((lista) => lista.map((o) => (o.id_oportunidade === op.id_oportunidade ? op : o)))

  const mover = async (op, etapa) => {
    const antes = op
    substituir({ ...op, id_etapa: etapa.id_etapa, etapa_nome: etapa.nome, etapa_cor: etapa.cor, etapa_ts: new Date().toISOString() })
    try {
      substituir(await api.moverOportunidade(op.id_oportunidade, etapa.id_etapa))
      avisar("success", `“${op.titulo}” movida para ${etapa.nome}.`)
    } catch (err) {
      substituir(antes)
      avisar("error", falha(err, "Não foi possível mover a oportunidade."))
    }
  }

  const abertas = ops.filter((o) => o.situacao === "ABERTA")
  const valorFunil = abertas.reduce((s, o) => s + (Number(o.valor_estimado) || 0), 0)

  // ------------------------------------------------------------- tabela
  const colunas = useMemo(
    () => [
      {
        chave: "titulo",
        rotulo: "Oportunidade",
        obrigatoria: true,
        largura: 300,
        valorTexto: (o) => o.titulo,
        render: (o) => (
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap>
              {o.titulo}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
              {o.cliente_nome}
            </Typography>
          </Box>
        ),
      },
      {
        chave: "etapa",
        rotulo: "Etapa / situação",
        largura: 190,
        valorOrdenacao: (o) => (o.situacao === "ABERTA" ? o.etapa_ordem : o.situacao === "GANHA" ? 900 : 950),
        valorTexto: (o) => (o.situacao === "ABERTA" ? o.etapa_nome : SITUACAO[o.situacao].rotulo),
        render: (o) => <SituacaoOportunidade situacao={o.situacao} etapa={o.etapa_nome} cor={o.etapa_cor} />,
      },
      {
        chave: "valor",
        rotulo: "Valor",
        largura: 140,
        alinhamento: "right",
        ajuda: "Estimado para as abertas e perdidas; vendido para as ganhas.",
        valorOrdenacao: (o) => (o.situacao === "GANHA" ? o.valor_vendido : o.valor_estimado) ?? -1,
        valorTexto: (o) => moeda(o.situacao === "GANHA" ? o.valor_vendido : o.valor_estimado),
        render: (o) => (
          <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums" }}>
            {moeda(o.situacao === "GANHA" ? o.valor_vendido : o.valor_estimado)}
          </Typography>
        ),
      },
      {
        chave: "probabilidade",
        rotulo: "Probabilidade",
        largura: 120,
        alinhamento: "right",
        valorOrdenacao: (o) => o.probabilidade ?? -1,
        valorTexto: (o) => (o.probabilidade === null ? "" : `${o.probabilidade}%`),
        render: (o) => (o.probabilidade === null ? "—" : `${o.probabilidade}%`),
      },
      {
        chave: "previsao_fechamento",
        rotulo: "Previsão",
        largura: 120,
        valorOrdenacao: (o) => o.previsao_fechamento,
        valorTexto: (o) => dataBR(o.previsao_fechamento),
        render: (o) => dataBR(o.previsao_fechamento) || "—",
      },
      {
        chave: "responsavel",
        rotulo: "Responsável",
        largura: 190,
        valorOrdenacao: (o) => o.responsavel_nome,
        valorTexto: (o) => o.responsavel_nome || "",
        render: (o) => <AvatarResponsavel nome={o.responsavel_nome} foto={o.responsavel_foto} comNome />,
      },
      {
        chave: "proxima",
        rotulo: "Próxima tarefa",
        largura: 220,
        ordenavel: false,
        valorTexto: (o) => o.proxima_tarefa_titulo || "",
        render: (o) =>
          o.situacao !== "ABERTA" ? (
            "—"
          ) : o.proxima_tarefa_titulo ? (
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" noWrap>
                {o.proxima_tarefa_titulo}
              </Typography>
              <VencimentoTarefa tarefa={{ vencimento_ts: o.proxima_tarefa_vencimento, status: "PENDENTE" }} />
            </Box>
          ) : (
            <Typography variant="caption" color="text.secondary">
              Sem próxima tarefa
            </Typography>
          ),
      },
      { chave: "origem", rotulo: "Origem", visivelPadrao: false, largura: 140, valorTexto: (o) => o.origem || "", render: (o) => o.origem || "—" },
      {
        chave: "criado_ts",
        rotulo: "Criada em",
        visivelPadrao: false,
        largura: 120,
        valorOrdenacao: (o) => o.criado_ts,
        valorTexto: (o) => new Date(o.criado_ts).toLocaleDateString("pt-BR"),
        render: (o) => new Date(o.criado_ts).toLocaleDateString("pt-BR"),
      },
    ],
    []
  )

  const vazio = filtrando ? (
    <Box sx={{ py: 2 }}>
      <SearchOff sx={{ fontSize: 32, color: "text.disabled" }} aria-hidden />
      <Typography fontWeight={700} sx={{ mt: 0.5 }}>
        Nenhuma oportunidade corresponde aos filtros
      </Typography>
      <Button size="small" variant="outlined" sx={{ mt: 1.5 }} onClick={() => { setBusca(""); setFiltros({}) }}>
        Limpar filtros
      </Button>
    </Box>
  ) : (
    <EstadoVazio onCriar={() => setDrawer({})} />
  )

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1.5, mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {carregando && ops.length === 0
            ? "Carregando…"
            : `${abertas.length} oportunidade${abertas.length === 1 ? "" : "s"} em andamento · ${moedaCurta(valorFunil)} no funil`}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={visual}
            onChange={(_, v) => v && setVisual(v)}
            aria-label="Modo de visualização"
            sx={{
              "& .MuiToggleButton-root": { gap: 0.75, px: 1.5, textTransform: "none", fontWeight: 600, letterSpacing: 0 },
              "& .MuiToggleButton-root.Mui-selected": {
                bgcolor: (t) => alpha(t.palette.primary.vivo, t.palette.mode === "dark" ? 0.2 : 0.24),
                color: "text.primary",
              },
            }}
          >
            <ToggleButton value="kanban" aria-label="Kanban">
              <ViewKanban sx={{ fontSize: 18 }} />
              <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                Kanban
              </Box>
            </ToggleButton>
            <ToggleButton value="lista" aria-label="Lista">
              <TableRows sx={{ fontSize: 18 }} />
              <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                Lista
              </Box>
            </ToggleButton>
          </ToggleButtonGroup>
          <Button variant="contained" startIcon={<Add />} onClick={() => setDrawer({})}>
            Nova oportunidade
          </Button>
        </Box>
      </Box>

      {erro && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={carregar}>Tentar novamente</Button>}>
          {erro}
        </Alert>
      )}

      <Paper sx={{ borderRadius: 0 }}>
        <ToolbarTabela
          busca={busca}
          onBuscaChange={setBusca}
          placeholderBusca="Pesquisar por oportunidade ou cliente..."
          totalFiltros={totalFiltros}
          onAbrirFiltros={() => setPainelAberto(true)}
        />

        {visual === "kanban" ? (
          !carregando && ops.length === 0 && !erro ? (
            <Box sx={{ p: 4, textAlign: "center" }}>{vazio}</Box>
          ) : (
            <KanbanOportunidades
              etapas={etapasAtivas}
              oportunidades={filtradas}
              carregando={carregando}
              filtrando={filtrando}
              onAbrir={(op) => navigate(`/crm/oportunidades/${op.id_oportunidade}`)}
              onMover={mover}
              onGanhar={(op) => setEncerrar({ modo: "ganhar", op })}
              onPerder={(op) => setEncerrar({ modo: "perder", op })}
              onCriarEm={(etapa) => setDrawer({ idEtapaInicial: etapa.id_etapa })}
            />
          )
        ) : (
          <TabelaDados
            dados={filtradas}
            colunas={colunas}
            chaveId="id_oportunidade"
            chaveStorage="crm.oportunidades"
            ordemInicial="etapa"
            carregando={carregando && ops.length === 0}
            mensagemVazio={vazio}
            onClickLinha={(o) => navigate(`/crm/oportunidades/${o.id_oportunidade}`)}
            larguraMinima={1100}
          />
        )}
      </Paper>

      <PainelFiltros
        aberto={painelAberto}
        onFechar={() => setPainelAberto(false)}
        titulo="Filtrar oportunidades"
        grupos={gruposFiltro}
        selecionados={filtros}
        onAplicar={setFiltros}
        onLimpar={() => setFiltros({})}
      />

      <DrawerOportunidade
        aberto={Boolean(drawer)}
        onFechar={() => setDrawer(null)}
        idEtapaInicial={drawer?.idEtapaInicial}
        onSalvo={(op) => setOps((lista) => [op, ...lista.filter((o) => o.id_oportunidade !== op.id_oportunidade)])}
      />

      <DialogEncerrar
        modo={encerrar?.modo}
        oportunidade={encerrar?.op}
        onFechar={() => setEncerrar(null)}
        onEncerrada={substituir}
      />
    </Box>
  )
}

function EstadoVazio({ onCriar }) {
  return (
    <Box sx={{ py: 2, maxWidth: 460, mx: "auto" }}>
      <Handshake sx={{ fontSize: 36, color: "text.disabled" }} aria-hidden />
      <Typography fontWeight={700} sx={{ mt: 0.5 }}>
        Nenhuma oportunidade ainda
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
        Uma oportunidade é uma venda que vocês querem fechar. Crie a primeira e acompanhe cada passo dela pelo funil —
        o histórico registra tudo sozinho.
      </Typography>
      <Button variant="contained" size="small" startIcon={<Add />} onClick={onCriar}>
        Nova oportunidade
      </Button>
    </Box>
  )
}
