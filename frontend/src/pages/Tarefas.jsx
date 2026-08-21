/**
 * Tela "Tarefas" — a gestao interna da incubadora.
 *
 * DUAS VISUALIZACOES SOBRE O MESMO CONJUNTO, e a troca entre elas nao recarrega
 * nada: a lista vem inteira uma vez e as duas trabalham em memoria.
 *
 *   TABELA (padrao)  responde "o que existe": ordena por qualquer coluna,
 *                    compara, seleciona em lote, exporta. E o padrao do sistema
 *                    — a mesma TabelaDados de Startups, com as mesmas colunas
 *                    configuraveis e a mesma persistencia de layout.
 *   KANBAN           responde "como esta indo": onde o trabalho empilhou, o que
 *                    ninguem puxou, o que atravessou a semana parado. Aqui o
 *                    status se muda arrastando, que e o gesto que a pergunta
 *                    pede.
 *
 * A ESCOLHA FICA GUARDADA no navegador, por incubadora e por pessoa: quem
 * trabalha no quadro nao quer reabrir na tabela toda manha, e vice-versa.
 *
 * QUEM VE O QUE: `tarefas.tarefas.visualizar` da o quadro inteiro; sem a chave,
 * a pessoa ve as tarefas em que esta envolvida e a tela DIZ isso — uma lista
 * curta sem explicacao parece uma incubadora parada, nao um recorte. Quem
 * decide o recorte e o backend (ver tarefaService); aqui so avisamos.
 *
 * OS CAMPOS PERSONALIZAVEIS VIRAM COLUNA E VIRAM FILTRO, um a um, exatamente
 * como em Startups: a incubadora que criou "Centro de custo" quer listar por
 * ele. O tipo do campo decide o filtro (categoria vira lista de marcar,
 * monetario vira intervalo, texto vira busca) — ver utils/camposExtras.
 *
 * Endpoints (via useTarefas):
 *   GET    /tarefas?id_tenant=       -> a lista, com o vocabulario resolvido
 *   POST   /tarefas                  -> cria
 *   PUT    /tarefas/:id              -> atualiza
 *   PATCH  /tarefas/:id/mover        -> o arrasto do kanban e a acao em massa
 *   DELETE /tarefas/:id              -> exclui
 */
import { useEffect, useMemo, useState } from "react"
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material"
import {
  Add,
  AssignmentInd,
  EventBusy,
  PlaylistAddCheck,
  SwapHoriz,
  TableRows,
  TaskAlt,
  ViewKanban,
} from "@mui/icons-material"
import AppLayout from "../components/AppLayout"
import { useAuthStore } from "../store/authStore"
import { usePermissaoStore } from "../store/permissaoStore"
import { useTarefaConfigStore } from "../store/tarefaConfigStore"
import { useTarefas } from "../hooks/useTarefas"
import TabelaDados from "../components/tabela/TabelaDados"
import ToolbarTabela from "../components/tabela/ToolbarTabela"
import PainelFiltros, { contarFiltros } from "../components/tabela/PainelFiltros"
import AtualizacaoMassa from "../components/tabela/AtualizacaoMassa"
import { exportarTabelaCsv } from "../components/tabela/exportarTabela"
import KpiRow from "../components/relatorios/KpiRow"
import QuadroKanban from "../components/tarefas/QuadroKanban"
import { SeloAnexos } from "../components/tarefas/AnexosTarefa"
import DrawerTarefa from "../components/tarefas/DrawerTarefa"
import { PRIORIDADES, prioridade as metaPrioridade, prazoBR, situacaoPrazo } from "../data/tarefaMeta"
import {
  PREFIXO_FILTRO_EXTRA,
  casaFiltroCampoExtra,
  formatarCampoExtra,
  grupoFiltroCampoExtra,
  valorOrdenacaoCampoExtra,
} from "../utils/camposExtras"

/** Onde fica guardada a visualizacao escolhida. */
const CHAVE_VISUAL = "quiron.tarefas.visual"

/** Quem nao tem responsavel precisa de um id proprio no filtro: "" nao agrupa. */
const SEM_RESPONSAVEL = "__sem__"

export default function Tarefas() {
  const usuario = useAuthStore((s) => s.usuario)
  const idTenant = usuario?.id_tenant ?? null

  // O backend continua sendo quem autoriza — isto so evita oferecer o que
  // responderia 403. A resposta vai no proprio seletor para a tela se redesenhar
  // quando as permissoes terminarem de carregar.
  const podeCriar = usePermissaoStore((s) => s.pode("tarefas.tarefas.criar"))
  const podeEditar = usePermissaoStore((s) => s.pode("tarefas.tarefas.editar"))
  const podeExcluir = usePermissaoStore((s) => s.pode("tarefas.tarefas.excluir"))
  const podeExportar = usePermissaoStore((s) => s.pode("tarefas.tarefas.exportar"))

  const colunas0 = useTarefaConfigStore((s) => s.status) || []
  const campos = useTarefaConfigStore((s) => s.campos) || []

  const {
    tarefas, resumo, pessoas, startups, carregando, erro, limparErro,
    carregarCompleta, criar, atualizar, excluir, mover, moverVarias,
  } = useTarefas(idTenant)

  // O ESCOPO vem do backend, e nao do store de permissoes: e ele quem recorta a
  // lista, e a tela nao deve poder discordar do que recebeu.
  const soAsMinhas = resumo?.escopo === "MINHAS"

  const [visual, setVisual] = useState(
    () => window.localStorage.getItem(CHAVE_VISUAL) || "tabela"
  )
  const [busca, setBusca] = useState("")
  const [filtros, setFiltros] = useState({})
  const [painelAberto, setPainelAberto] = useState(false)
  const [aviso, setAviso] = useState(null)

  const [selecionados, setSelecionados] = useState([])
  const [ancoraMassa, setAncoraMassa] = useState(null)
  const [aplicandoMassa, setAplicandoMassa] = useState(false)

  // As colunas na tela, para a exportacao sair igual ao que esta sendo lido.
  const [colunasVisiveis, setColunasVisiveis] = useState([])

  const [drawerAberto, setDrawerAberto] = useState(false)
  const [tarefaEditando, setTarefaEditando] = useState(null)
  const [statusInicial, setStatusInicial] = useState(null)

  useEffect(() => {
    try {
      window.localStorage.setItem(CHAVE_VISUAL, visual)
    } catch {
      // Modo privado ou quota estourada: a tela funciona, so nao lembra.
    }
  }, [visual])

  // ---------------------------------------------------------------- colunas
  const colunasTabela = useMemo(() => {
    const fixas = [
      {
        chave: "titulo",
        rotulo: "Tarefa",
        obrigatoria: true,
        largura: 320,
        valorTexto: (t) => t.titulo,
        render: (t) => (
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="body2"
              fontWeight={600}
              noWrap
              sx={{
                textDecoration: t.status_categoria === "CONCLUIDA" ? "line-through" : "none",
                color: t.status_categoria === "CONCLUIDA" ? "text.secondary" : "text.primary",
              }}
            >
              {t.titulo}
            </Typography>
            {/* A startup responde a pergunta seguinte mais frequente sobre uma
                tarefa: sobre quem ela e. */}
            {t.startup_nome && (
              <Typography variant="caption" color="text.secondary" noWrap>
                {t.startup_nome}
              </Typography>
            )}
          </Box>
        ),
      },
      {
        chave: "status",
        rotulo: "Coluna",
        largura: 150,
        valorOrdenacao: (t) => t.status_ordem ?? 99,
        valorTexto: (t) => t.status_rotulo || t.status || "",
        render: (t) =>
          t.status_rotulo ? (
            <Chip
              size="small"
              label={t.status_rotulo}
              sx={{ bgcolor: t.status_cor, color: "#fff", fontWeight: 600 }}
            />
          ) : (
            "—"
          ),
      },
      {
        chave: "prioridade",
        rotulo: "Prioridade",
        largura: 130,
        // Pelo PESO, e nao pelo rotulo: alfabeticamente "Alta" viria antes de
        // "Urgente", que e o contrario do que a coluna existe para mostrar.
        valorOrdenacao: (t) => metaPrioridade(t.prioridade).peso,
        valorTexto: (t) => metaPrioridade(t.prioridade).rotulo,
        render: (t) => {
          const p = metaPrioridade(t.prioridade)
          return (
            <Chip
              size="small"
              variant="outlined"
              label={p.rotulo}
              sx={{ borderColor: p.cor, color: p.cor, fontWeight: 600 }}
            />
          )
        },
      },
      {
        chave: "responsavel",
        rotulo: "Responsável",
        largura: 200,
        valorOrdenacao: (t) => t.responsavel_nome,
        valorTexto: (t) => t.responsavel_nome || "",
        render: (t) =>
          t.responsavel_nome ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
              <Avatar sx={{ width: 24, height: 24, fontSize: 10, fontWeight: 700 }}>
                {t.responsavel_nome.trim().charAt(0).toUpperCase()}
              </Avatar>
              <Typography variant="body2" noWrap>
                {t.responsavel_nome}
              </Typography>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Sem responsável
            </Typography>
          ),
      },
      {
        chave: "prazo",
        rotulo: "Prazo",
        largura: 150,
        valorOrdenacao: (t) => (t.prazo ? String(t.prazo).slice(0, 10) : null),
        valorTexto: (t) => prazoBR(t.prazo),
        render: (t) => {
          const p = situacaoPrazo(t)
          if (p.tipo === "sem-prazo") return "—"
          return (
            <Tooltip title={prazoBR(t.prazo)}>
              <Typography variant="body2" sx={{ color: p.cor }}>
                {p.tipo === "atrasada" || p.tipo === "hoje" || p.tipo === "proxima"
                  ? p.rotulo
                  : prazoBR(t.prazo)}
              </Typography>
            </Tooltip>
          )
        },
      },
      // As colunas abaixo existem, mas nao abrem a tabela: sao dado de ficha,
      // procurado quando se procura.
      {
        chave: "total_anexos",
        rotulo: "Anexos",
        visivelPadrao: false,
        largura: 90,
        alinhamento: "center",
        valorOrdenacao: (t) => t.total_anexos || 0,
        valorTexto: (t) => String(t.total_anexos || 0),
        render: (t) => (t.total_anexos ? <SeloAnexos total={t.total_anexos} /> : "—"),
      },
      {
        chave: "startup_nome",
        rotulo: "Startup",
        visivelPadrao: false,
        largura: 200,
        valorTexto: (t) => t.startup_nome || "",
        render: (t) => t.startup_nome || "—",
      },
      {
        chave: "criado_por_nome",
        rotulo: "Criada por",
        visivelPadrao: false,
        largura: 180,
        valorTexto: (t) => t.criado_por_nome || "",
        render: (t) => t.criado_por_nome || "—",
      },
      {
        chave: "criado_ts",
        rotulo: "Criada em",
        visivelPadrao: false,
        largura: 130,
        valorOrdenacao: (t) => t.criado_ts,
        valorTexto: (t) => (t.criado_ts ? new Date(t.criado_ts).toLocaleDateString("pt-BR") : ""),
        render: (t) => (t.criado_ts ? new Date(t.criado_ts).toLocaleDateString("pt-BR") : "—"),
      },
      {
        chave: "concluida_ts",
        rotulo: "Concluída em",
        visivelPadrao: false,
        largura: 140,
        valorOrdenacao: (t) => t.concluida_ts,
        valorTexto: (t) =>
          t.concluida_ts ? new Date(t.concluida_ts).toLocaleDateString("pt-BR") : "",
        render: (t) =>
          t.concluida_ts ? new Date(t.concluida_ts).toLocaleDateString("pt-BR") : "—",
      },
    ]

    // Um campo personalizavel = uma coluna. Entram VISIVEIS: a incubadora nao
    // cadastrou o campo para escondermos o resultado dele — e quem achar a
    // tabela larga demais desliga o que nao usa em "Gerenciar colunas", e a
    // escolha fica guardada.
    const extras = campos.map((campo) => {
      const numerico = campo.tipo === "NUMERICO" || campo.tipo === "MONETARIO"
      const ler = (t) => (t.campos_extras || {})[campo.chave]
      return {
        chave: PREFIXO_FILTRO_EXTRA + campo.chave,
        rotulo: campo.rotulo,
        largura: 160,
        alinhamento: numerico ? "right" : "left",
        valorOrdenacao: (t) => valorOrdenacaoCampoExtra(campo, ler(t)),
        valorTexto: (t) => formatarCampoExtra(campo, ler(t)) || "",
        render: (t) => formatarCampoExtra(campo, ler(t)) || "—",
      }
    })

    return [...fixas, ...extras]
  }, [campos])

  // ---------------------------------------------------------------- filtros
  const gruposFiltro = useMemo(() => {
    const grupos = []

    if (colunas0.length > 0) {
      grupos.push({
        id: "status",
        rotulo: "Coluna",
        tipo: "checkbox",
        itens: colunas0.map((s) => ({ id: s.chave, rotulo: s.rotulo })),
      })
    }

    grupos.push({
      id: "prioridade",
      rotulo: "Prioridade",
      tipo: "checkbox",
      itens: PRIORIDADES.map((p) => ({ id: p.chave, rotulo: p.rotulo })),
    })

    // Os responsaveis saem das PESSOAS DA EQUIPE, e nao das tarefas: filtrar
    // por quem ainda nao recebeu nada e uma pergunta legitima ("o Joao esta com
    // o que?" e "o Joao esta sem nada?" sao a mesma consulta).
    if (pessoas.length > 0) {
      grupos.push({
        id: "responsavel",
        rotulo: "Responsável",
        tipo: "checkbox",
        itens: [
          { id: SEM_RESPONSAVEL, rotulo: "Sem responsável" },
          ...pessoas.map((p) => ({ id: String(p.id_usuario), rotulo: p.nome })),
        ],
      })
    }

    // A startup sai das TAREFAS: listar as 40 startups da incubadora quando 3
    // aparecem em tarefas seria um grupo de rolagem quase todo inutil.
    const comStartup = [...new Set(tarefas.map((t) => t.id_startup).filter(Boolean))]
    if (comStartup.length > 0) {
      grupos.push({
        id: "startup",
        rotulo: "Startup",
        tipo: "checkbox",
        itens: comStartup.map((id) => ({
          id: String(id),
          rotulo: tarefas.find((t) => t.id_startup === id)?.startup_nome || String(id),
        })),
      })
    }

    grupos.push({ id: "prazo", rotulo: "Prazo", tipo: "data" })

    campos.forEach((campo) => {
      const grupo = grupoFiltroCampoExtra(campo)
      if (grupo) grupos.push(grupo)
    })

    return grupos
  }, [colunas0, pessoas, tarefas, campos])

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()

    return tarefas.filter((t) => {
      if (termo) {
        const casaTitulo = t.titulo.toLowerCase().includes(termo)
        const casaDescricao = (t.descricao || "").toLowerCase().includes(termo)
        const casaResponsavel = (t.responsavel_nome || "").toLowerCase().includes(termo)
        const casaStartup = (t.startup_nome || "").toLowerCase().includes(termo)
        if (!casaTitulo && !casaDescricao && !casaResponsavel && !casaStartup) return false
      }

      const statusSel = filtros.status || []
      if (statusSel.length && !statusSel.includes(t.status)) return false

      const prioridadesSel = filtros.prioridade || []
      if (prioridadesSel.length && !prioridadesSel.includes(t.prioridade)) return false

      const responsaveisSel = filtros.responsavel || []
      if (responsaveisSel.length) {
        const chave = t.id_responsavel ? String(t.id_responsavel) : SEM_RESPONSAVEL
        if (!responsaveisSel.includes(chave)) return false
      }

      const startupsSel = filtros.startup || []
      if (startupsSel.length && !startupsSel.includes(String(t.id_startup))) return false

      // O <input type="date"> devolve YYYY-MM-DD e o prazo comeca do mesmo
      // jeito: comparar os dez primeiros caracteres compara as datas sem
      // arrastar fuso horario para dentro do filtro.
      const periodo = filtros.prazo
      if (periodo?.de || periodo?.ate) {
        const dia = (t.prazo || "").slice(0, 10)
        if (!dia) return false
        if (periodo.de && dia < periodo.de) return false
        if (periodo.ate && dia > periodo.ate) return false
      }

      return campos.every((campo) => {
        const selecao = filtros[PREFIXO_FILTRO_EXTRA + campo.chave]
        return casaFiltroCampoExtra(campo, (t.campos_extras || {})[campo.chave], selecao)
      })
    })
  }, [tarefas, busca, filtros, campos])

  // ------------------------------------------------------------------ acoes
  const abrirNova = (status = null) => {
    setTarefaEditando(null)
    setStatusInicial(status)
    setDrawerAberto(true)
  }

  /**
   * Editar exige a tarefa COMPLETA: a listagem nao traz a lista de anexos (so a
   * contagem), e abrir o painel com o que a linha tem faria o salvar apagar os
   * anexos — o mesmo tropeco que os contatos do cadastro de startup evitam.
   */
  const abrirTarefa = async (tarefa) => {
    try {
      setTarefaEditando(await carregarCompleta(tarefa.id_tarefa))
      setStatusInicial(null)
      setDrawerAberto(true)
    } catch (err) {
      setAviso({
        tipo: "error",
        texto: err.response?.data?.erro || "Não foi possível abrir a tarefa.",
      })
    }
  }

  const salvarTarefa = async (dados) => {
    if (tarefaEditando) {
      await atualizar(tarefaEditando.id_tarefa, dados)
      setAviso({ tipo: "success", texto: "Tarefa atualizada." })
    } else {
      await criar(dados)
      setAviso({ tipo: "success", texto: "Tarefa criada." })
    }
  }

  const excluirTarefa = async (idTarefa) => {
    await excluir(idTarefa)
    setAviso({ tipo: "success", texto: "Tarefa excluída." })
  }

  /**
   * O arrasto de um cartao. `mover` relanca o erro (a acao em massa precisa
   * conta-lo); aqui, onde o gesto e de um cartao so, o aviso na tela e o
   * suficiente — o hook ja recarregou e o cartao voltou para o lugar.
   */
  const moverCartao = async (idTarefa, status, ordem) => {
    try {
      await mover(idTarefa, status, ordem)
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Não foi possível mover a tarefa." })
    }
  }

  /**
   * Mudar a coluna de varias de uma vez.
   *
   * Uma chamada por tarefa, e nao um endpoint de lote: PATCH /:id/mover ja
   * existe e e ele quem deriva a conclusao da categoria do status. O que falha
   * e reportado — mover 8 de 10 e dizer "pronto" seria pior do que nao ter o
   * botao.
   *
   * `ordem: 9999` joga todas no FIM da coluna de destino (o backend limita o
   * indice ao tamanho da lista): mandar 20 tarefas para o topo do quadro
   * empurraria para baixo justamente o que estava sendo trabalhado.
   */
  const aplicarStatusEmMassa = async ({ status }) => {
    if (!status) return
    setAplicandoMassa(true)
    const total = selecionados.length
    const { movidas, falhas, erro: erroLote } = await moverVarias(selecionados, status, 9999)
    setAplicandoMassa(false)
    setAncoraMassa(null)

    if (falhas === 0) {
      const rotulo = colunas0.find((s) => s.chave === status)?.rotulo || status
      setAviso({
        tipo: "success",
        texto: `${total} tarefa${total > 1 ? "s" : ""} movida${total > 1 ? "s" : ""} para "${rotulo}".`,
      })
      setSelecionados([])
    } else {
      setAviso({
        tipo: movidas === 0 ? "error" : "warning",
        texto: erroLote || `Não foi possível mover ${falhas} de ${total} tarefas.`,
      })
    }
  }

  /**
   * Esta pessoa pode mexer NESTE cartao?
   *
   * Por cartao, e nao por tela: quem tem a chave `editar` mexe em tudo, e quem
   * nao tem ainda mexe nas tarefas de que e responsavel — e a mesma regra que o
   * backend aplica. Uma resposta unica para a tela inteira obrigaria a escolher
   * entre travar o arrasto de quem tem direito ou oferece-lo a quem levaria 403.
   */
  const podeMexer = (tarefa) =>
    podeEditar || Number(tarefa?.id_responsavel) === Number(usuario?.id)

  const totalFiltros = contarFiltros(filtros)

  // O kanban desenha as tarefas ja filtradas: os filtros valem para as duas
  // visualizacoes, senao trocar de aba mudaria o conjunto sob os pes de quem
  // acabou de filtrar.
  const botaoNova = podeCriar ? (
    <Button variant="contained" size="small" startIcon={<Add />} onClick={() => abrirNova()}>
      Nova tarefa
    </Button>
  ) : null

  return (
    <AppLayout>
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <TaskAlt sx={{ color: "primary.main" }} />
            <Typography variant="h4" fontWeight={700}>
              Tarefas
            </Typography>
          </Box>

          <ToggleButtonGroup
            size="small"
            exclusive
            value={visual}
            onChange={(_, novo) => novo && setVisual(novo)}
            aria-label="Modo de visualização"
          >
            <ToggleButton value="tabela" aria-label="Tabela">
              <TableRows sx={{ fontSize: 18, mr: 0.5 }} /> Tabela
            </ToggleButton>
            <ToggleButton value="kanban" aria-label="Kanban">
              <ViewKanban sx={{ fontSize: 18, mr: 0.5 }} /> Kanban
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          O que a equipe da incubadora tem para fazer — em lista ou no quadro.
        </Typography>

        {resumo && (
          <KpiRow
            itens={[
              {
                rotulo: soAsMinhas ? "Tarefas suas em aberto" : "Tarefas em aberto",
                valor: resumo.abertas,
                icone: <PlaylistAddCheck sx={{ fontSize: 16 }} />,
                ajuda: "Tudo que não está numa coluna marcada como concluída.",
              },
              {
                rotulo: "Com o prazo vencido",
                valor: resumo.atrasadas,
                // A cor sozinha nao carrega o alerta: vem com icone e rotulo.
                cor: resumo.atrasadas > 0 ? "error.main" : undefined,
                icone: <EventBusy sx={{ fontSize: 16 }} />,
                ajuda: "Ainda abertas e com prazo anterior a hoje. Tarefa entregue com atraso não conta aqui.",
              },
              {
                rotulo: "Sob sua responsabilidade",
                valor: resumo.minhas,
                icone: <AssignmentInd sx={{ fontSize: 16 }} />,
              },
            ]}
          />
        )}

        {/* Uma lista curta sem explicacao parece uma incubadora parada. Este
            aviso e a diferenca entre "nao ha tarefas" e "estas sao as suas". */}
        {soAsMinhas && !carregando && (
          <Alert severity="info" sx={{ mb: 3 }}>
            Você está vendo as tarefas em que está envolvido — as que são sua responsabilidade e as
            que você criou. Para acompanhar o quadro inteiro da incubadora é preciso a permissão
            "Ver as tarefas de toda a incubadora".
          </Alert>
        )}

        {(aviso || erro) && (
          <Alert
            severity={erro ? "error" : aviso.tipo}
            sx={{ mb: 3 }}
            onClose={() => {
              setAviso(null)
              limparErro()
            }}
          >
            {erro || aviso.texto}
          </Alert>
        )}

        <Paper sx={{ borderRadius: 0 }}>
          <ToolbarTabela
            busca={busca}
            onBuscaChange={setBusca}
            placeholderBusca="Pesquisar por título, descrição, responsável ou startup..."
            totalFiltros={totalFiltros}
            onAbrirFiltros={() => setPainelAberto(true)}
            totalSelecionados={visual === "tabela" ? selecionados.length : 0}
            onLimparSelecao={() => setSelecionados([])}
            acoesMassa={
              <Button
                size="small"
                variant="outlined"
                startIcon={<SwapHoriz />}
                onClick={(e) => setAncoraMassa(e.currentTarget)}
              >
                Mover para
              </Button>
            }
            onExportar={
              podeExportar
                ? () => exportarTabelaCsv("tarefas", colunasTabela, colunasVisiveis, filtradas)
                : undefined
            }
            acoes={botaoNova}
          />

          {visual === "tabela" ? (
            <TabelaDados
              dados={filtradas}
              colunas={colunasTabela}
              chaveId="id_tarefa"
              chaveStorage="tarefas"
              ordemInicial="status"
              carregando={carregando}
              mensagemVazio="Nenhuma tarefa encontrada."
              onClickLinha={abrirTarefa}
              onColunasVisiveisChange={setColunasVisiveis}
              // A selecao existe para a acao em massa, que muda a coluna de
              // varias de uma vez: sem a chave de editar as dos outros, ela nao
              // levaria a lugar nenhum.
              selecionavel={podeEditar}
              selecionados={selecionados}
              onSelecionadosChange={setSelecionados}
            />
          ) : (
            <QuadroKanban
              colunas={colunas0}
              tarefas={filtradas}
              onAbrirTarefa={abrirTarefa}
              onCriarEm={abrirNova}
              onMover={moverCartao}
              podeCriar={podeCriar}
              // Por cartao: quem e responsavel arrasta o proprio mesmo sem a
              // chave `editar`, que e o que o backend permite. Ver podeMexer.
              podeMover={podeMexer}
            />
          )}
        </Paper>
      </Box>

      <PainelFiltros
        aberto={painelAberto}
        onFechar={() => setPainelAberto(false)}
        titulo="Filtrar tarefas"
        grupos={gruposFiltro}
        selecionados={filtros}
        onAplicar={setFiltros}
        onLimpar={() => setFiltros({})}
      />

      <AtualizacaoMassa
        ancora={ancoraMassa}
        onFechar={() => setAncoraMassa(null)}
        totalSelecionados={selecionados.length}
        aplicando={aplicandoMassa}
        campos={[
          {
            chave: "status",
            rotulo: "Coluna",
            opcoes: colunas0.map((s) => ({ valor: s.chave, rotulo: s.rotulo })),
          },
        ]}
        onAplicar={aplicarStatusEmMassa}
      />

      <DrawerTarefa
        aberto={drawerAberto}
        onFechar={() => setDrawerAberto(false)}
        idTenant={idTenant}
        tarefa={tarefaEditando}
        statusInicial={statusInicial}
        pessoas={pessoas}
        startups={startups}
        podeExcluir={podeExcluir}
        onSalvar={salvarTarefa}
        onExcluir={excluirTarefa}
      />
    </AppLayout>
  )
}
