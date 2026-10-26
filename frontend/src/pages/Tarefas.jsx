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
 *                    status se muda arrastando (ou pelo menu do cartao, para
 *                    quem usa teclado ou toque).
 *
 * A ESCOLHA FICA GUARDADA no navegador, por incubadora e por pessoa: quem
 * trabalha no quadro nao quer reabrir na tabela toda manha, e vice-versa.
 *
 * OS INDICADORES DO TOPO FILTRAM. Clicar em "Atrasadas" recorta as duas
 * visualizacoes para elas; o recorte aparece como chip na barra, junto dos
 * filtros do painel, e "Limpar filtros" desfaz tudo de uma vez. Os numeros sao
 * contados sobre a mesma lista que a tela desenha — ver filtrosTarefas.
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
 *   GET    /tarefas/resumo           -> o ESCOPO da lista (todas ou as minhas)
 *   POST   /tarefas                  -> cria
 *   PUT    /tarefas/:id              -> atualiza
 *   PATCH  /tarefas/:id/mover        -> o arrasto do kanban e a acao em massa
 *   DELETE /tarefas/:id              -> exclui
 */
import { useEffect, useMemo, useRef, useState } from "react"
import {
  Alert,
  Box,
  Button,
  Paper,
  Snackbar,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material"
import { alpha } from "@mui/material/styles"
import {
  Add,
  AssignmentInd,
  Business,
  ErrorOutline,
  EventBusy,
  PendingActions,
  Refresh,
  SearchOff,
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
import PainelFiltros, { contarFiltros } from "../components/tabela/PainelFiltros"
import AtualizacaoMassa from "../components/tabela/AtualizacaoMassa"
import { exportarTabelaCsv } from "../components/tabela/exportarTabela"
import QuadroKanban from "../components/tarefas/QuadroKanban"
import { SeloAnexos } from "../components/tarefas/AnexosTarefa"
import DrawerTarefa from "../components/tarefas/DrawerTarefa"
import BarraTarefas from "../components/tarefas/BarraTarefas"
import IndicadoresTarefas from "../components/tarefas/IndicadoresTarefas"
import {
  AvatarResponsavel,
  PrazoTarefa,
  PrioridadeTarefa,
  StatusTarefa,
} from "../components/tarefas/MarcadoresTarefa"
import {
  DIAS_CONCLUIDAS,
  SEM_RESPONSAVEL,
  chipsDosFiltros,
  contarRecortes,
  filtrarTarefas,
} from "../components/tarefas/filtrosTarefas"
import { PRIORIDADES, prioridade as metaPrioridade, prazoBR } from "../data/tarefaMeta"
import {
  PREFIXO_FILTRO_EXTRA,
  formatarCampoExtra,
  grupoFiltroCampoExtra,
  valorOrdenacaoCampoExtra,
} from "../utils/camposExtras"

/** Onde fica guardada a visualizacao escolhida. */
const CHAVE_VISUAL = "quiron.tarefas.visual"

/** O nome de cada recorte quando ele vira chip na barra de filtros. */
const ROTULO_RECORTE = {
  abertas: "Em aberto",
  atrasadas: "Atrasadas",
  minhas: "Sob sua responsabilidade",
  concluidas: `Concluídas nos últimos ${DIAS_CONCLUIDAS} dias`,
}

function lerVisual() {
  try {
    return window.localStorage.getItem(CHAVE_VISUAL) || "tabela"
  } catch {
    return "tabela"
  }
}

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

  // null = o vocabulario ainda nao chegou (ver tarefaConfigStore). O quadro
  // desenha esqueleto em vez de "nenhuma coluna configurada".
  const statusConfig = useTarefaConfigStore((s) => s.status)
  const colunas0 = statusConfig || []
  const campos = useTarefaConfigStore((s) => s.campos) || []

  const {
    tarefas, resumo, pessoas, startups, carregando, erro, recarregar,
    carregarCompleta, criar, atualizar, excluir, mover, moverVarias,
  } = useTarefas(idTenant)

  // O ESCOPO vem do backend, e nao do store de permissoes: e ele quem recorta a
  // lista, e a tela nao deve poder discordar do que recebeu.
  const soAsMinhas = resumo?.escopo === "MINHAS"

  const [visual, setVisual] = useState(lerVisual)
  const [busca, setBusca] = useState("")
  const [filtros, setFiltros] = useState({})
  // O indicador clicado: uma chave de RECORTES, ou null.
  const [recorte, setRecorte] = useState(null)
  const [painelAberto, setPainelAberto] = useState(false)

  // O retorno das acoes (salvou, moveu, falhou) num aviso flutuante: um Alert
  // no topo da pagina ficaria fora da tela de quem arrastou um cartao la
  // embaixo, e empurraria o quadro inteiro para baixo ao aparecer.
  const [aviso, setAviso] = useState(null)
  const [avisoAberto, setAvisoAberto] = useState(false)
  const avisar = (tipo, texto) => {
    setAviso({ tipo, texto })
    setAvisoAberto(true)
  }

  const [selecionados, setSelecionados] = useState([])
  const [ancoraMassa, setAncoraMassa] = useState(null)
  const [aplicandoMassa, setAplicandoMassa] = useState(false)

  // As colunas na tela, para a exportacao sair igual ao que esta sendo lido.
  const [colunasVisiveis, setColunasVisiveis] = useState([])

  const [drawerAberto, setDrawerAberto] = useState(false)
  const [tarefaEditando, setTarefaEditando] = useState(null)
  const [carregandoTarefa, setCarregandoTarefa] = useState(false)
  const [statusInicial, setStatusInicial] = useState(null)
  // Cada abertura do painel ganha um numero: a resposta de uma tarefa clicada
  // antes nao pode sobrescrever a que foi clicada depois.
  const aberturaAtual = useRef(0)

  useEffect(() => {
    try {
      window.localStorage.setItem(CHAVE_VISUAL, visual)
    } catch {
      // Modo privado ou quota estourada: a tela funciona, so nao lembra.
    }
  }, [visual])

  // ------------------------------------------------------------ indicadores
  // `agora` acompanha a lista: cada recarga recalcula a janela de 7 dias.
  const contexto = useMemo(
    () => ({ idUsuario: usuario?.id ?? null, agora: Date.now() }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [usuario?.id, tarefas]
  )
  const contagens = useMemo(() => contarRecortes(tarefas, contexto), [tarefas, contexto])
  const carregandoInicial = carregando && tarefas.length === 0

  const indicadores = [
    {
      id: "abertas",
      rotulo: soAsMinhas ? "Suas em aberto" : "Em aberto",
      valor: contagens.abertas,
      icone: <PendingActions sx={{ fontSize: 16 }} />,
      ajuda: "Tudo que não está numa coluna de conclusão.",
    },
    {
      id: "atrasadas",
      rotulo: "Atrasadas",
      valor: contagens.atrasadas,
      // A cor sozinha nao carrega o alerta: vem com icone, faixa e rotulo.
      alerta: contagens.atrasadas > 0,
      icone: <EventBusy sx={{ fontSize: 16 }} />,
      ajuda: "Ainda abertas e com prazo anterior a hoje. Tarefa entregue com atraso não conta aqui.",
    },
    {
      id: "minhas",
      rotulo: "Sob sua responsabilidade",
      valor: contagens.minhas,
      icone: <AssignmentInd sx={{ fontSize: 16 }} />,
      ajuda: "Abertas e com você como responsável.",
    },
    {
      id: "concluidas",
      rotulo: `Concluídas em ${DIAS_CONCLUIDAS} dias`,
      valor: contagens.concluidas,
      icone: <TaskAlt sx={{ fontSize: 16 }} />,
      ajuda: `Entraram numa coluna de conclusão nos últimos ${DIAS_CONCLUIDAS} dias.`,
    },
  ]

  // ---------------------------------------------------------------- colunas
  const colunasTabela = useMemo(() => {
    const fixas = [
      {
        chave: "titulo",
        rotulo: "Tarefa",
        obrigatoria: true,
        largura: 340,
        valorTexto: (t) => t.titulo,
        render: (t) => {
          const concluida = t.status_categoria === "CONCLUIDA"
          return (
            <Box sx={{ minWidth: 0 }}>
              {/* Um <button> sem onClick proprio: o Enter dispara o clique, que
                  sobe ate a linha e abre a tarefa. E o que torna a tabela
                  navegavel por teclado sem mexer na TabelaDados. */}
              <Box
                component="button"
                type="button"
                sx={{
                  all: "unset",
                  display: "block",
                  maxWidth: "100%",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  lineHeight: 1.43,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  textDecoration: concluida ? "line-through" : "none",
                  color: concluida ? "text.secondary" : "text.primary",
                  borderRadius: 0.5,
                  "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
                }}
              >
                {t.titulo}
              </Box>
              {/* A startup responde a pergunta seguinte mais frequente sobre
                  uma tarefa: sobre quem ela e. */}
              {(t.startup_nome || t.total_anexos > 0) && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0, mt: 0.25 }}>
                  {t.startup_nome && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
                      <Business sx={{ fontSize: 13, color: "text.secondary", flexShrink: 0 }} aria-hidden />
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {t.startup_nome}
                      </Typography>
                    </Box>
                  )}
                  <SeloAnexos total={t.total_anexos} />
                </Box>
              )}
            </Box>
          )
        },
      },
      {
        chave: "status",
        rotulo: "Status",
        largura: 160,
        valorOrdenacao: (t) => t.status_ordem ?? 99,
        valorTexto: (t) => t.status_rotulo || t.status || "",
        render: (t) => <StatusTarefa rotulo={t.status_rotulo} cor={t.status_cor} />,
      },
      {
        chave: "prioridade",
        rotulo: "Prioridade",
        largura: 130,
        // Pelo PESO, e nao pelo rotulo: alfabeticamente "Alta" viria antes de
        // "Urgente", que e o contrario do que a coluna existe para mostrar.
        valorOrdenacao: (t) => metaPrioridade(t.prioridade).peso,
        valorTexto: (t) => metaPrioridade(t.prioridade).rotulo,
        render: (t) => <PrioridadeTarefa chave={t.prioridade} />,
      },
      {
        chave: "responsavel",
        rotulo: "Responsável",
        largura: 200,
        valorOrdenacao: (t) => t.responsavel_nome,
        valorTexto: (t) => t.responsavel_nome || "",
        render: (t) => <AvatarResponsavel nome={t.responsavel_nome} foto={t.responsavel_foto} comNome />,
      },
      {
        chave: "prazo",
        rotulo: "Prazo",
        largura: 160,
        valorOrdenacao: (t) => (t.prazo ? String(t.prazo).slice(0, 10) : null),
        valorTexto: (t) => prazoBR(t.prazo),
        render: (t) => <PrazoTarefa tarefa={t} variante="tabela" />,
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
        rotulo: "Status",
        tipo: "checkbox",
        itens: colunas0.map((s) => ({ id: s.chave, rotulo: s.rotulo })),
      })
    }

    grupos.push({
      id: "prioridade",
      rotulo: "Prioridade",
      tipo: "checkbox",
      // Do mais urgente para o menos: e a ordem em que se procura.
      itens: [...PRIORIDADES].reverse().map((p) => ({ id: p.chave, rotulo: p.rotulo })),
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
        itens: comStartup
          .map((id) => ({
            id: String(id),
            rotulo: tarefas.find((t) => t.id_startup === id)?.startup_nome || String(id),
          }))
          .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR")),
      })
    }

    grupos.push({ id: "prazo", rotulo: "Prazo", tipo: "data" })

    campos.forEach((campo) => {
      const grupo = grupoFiltroCampoExtra(campo)
      if (grupo) grupos.push(grupo)
    })

    return grupos
  }, [colunas0, pessoas, tarefas, campos])

  // Os filtros que ganham botao proprio na barra. O status so na tabela: no
  // quadro, as colunas JA sao o status.
  const gruposRapidos = gruposFiltro.filter((g) =>
    (visual === "tabela" ? ["status", "prioridade", "responsavel", "startup"] : ["prioridade", "responsavel", "startup"]).includes(g.id)
  )

  const filtradas = useMemo(
    () => filtrarTarefas(tarefas, { busca, filtros, recorte, campos, contexto }),
    [tarefas, busca, filtros, recorte, campos, contexto]
  )

  const totalFiltros = contarFiltros(filtros)
  const filtrando = Boolean(busca.trim() || recorte || totalFiltros)

  const chips = [
    ...(recorte
      ? [{ chave: `recorte:${recorte}`, rotulo: ROTULO_RECORTE[recorte], destaque: true, onRemover: () => setRecorte(null) }]
      : []),
    ...chipsDosFiltros(gruposFiltro, filtros).map((chip) => ({
      chave: chip.chave,
      rotulo: chip.rotulo,
      onRemover: () => setFiltros((atuais) => chip.remover(atuais)),
    })),
  ]

  const limparTudo = () => {
    setFiltros({})
    setRecorte(null)
    setBusca("")
  }

  // ------------------------------------------------------------------ acoes
  const rotuloDaColuna = (chave) => colunas0.find((s) => s.chave === chave)?.rotulo || chave

  const abrirNova = (status = null) => {
    aberturaAtual.current += 1
    setTarefaEditando(null)
    setCarregandoTarefa(false)
    setStatusInicial(status)
    setDrawerAberto(true)
  }

  /**
   * Editar exige a tarefa COMPLETA: a listagem nao traz a lista de anexos (so a
   * contagem), e abrir o painel com o que a linha tem faria o salvar apagar os
   * anexos — o mesmo tropeco que os contatos do cadastro de startup evitam.
   *
   * O painel abre NA HORA, com esqueleto e o salvar travado, e se preenche
   * quando a tarefa chega: esperar a resposta com a tela parada parecia clique
   * perdido.
   */
  const abrirTarefa = async (linha) => {
    const minha = (aberturaAtual.current += 1)
    setTarefaEditando(linha)
    setStatusInicial(null)
    setCarregandoTarefa(true)
    setDrawerAberto(true)
    try {
      const completa = await carregarCompleta(linha.id_tarefa)
      if (minha !== aberturaAtual.current) return
      setTarefaEditando(completa)
    } catch (err) {
      if (minha !== aberturaAtual.current) return
      setDrawerAberto(false)
      avisar("error", err.response?.data?.erro || "Não foi possível abrir a tarefa.")
    } finally {
      if (minha === aberturaAtual.current) setCarregandoTarefa(false)
    }
  }

  const fecharDrawer = () => {
    aberturaAtual.current += 1
    setDrawerAberto(false)
    setCarregandoTarefa(false)
  }

  // `criarOutra`: o painel continua aberto e ja diz, ele mesmo, que salvou.
  const salvarTarefa = async (dados, { criarOutra = false } = {}) => {
    if (tarefaEditando) {
      await atualizar(tarefaEditando.id_tarefa, dados)
      avisar("success", "Tarefa atualizada.")
    } else {
      await criar(dados)
      if (!criarOutra) avisar("success", "Tarefa criada.")
    }
  }

  const excluirTarefa = async (idTarefa) => {
    await excluir(idTarefa)
    avisar("success", "Tarefa excluída.")
  }

  /**
   * O arrasto de um cartao (ou o "Mover para" do menu dele). `mover` relanca o
   * erro (a acao em massa precisa conta-lo); aqui, onde o gesto e de um cartao
   * so, o aviso e o suficiente — o hook ja recarregou e o cartao voltou para o
   * lugar.
   */
  const moverCartao = async (idTarefa, status, ordem) => {
    const tarefa = tarefas.find((t) => t.id_tarefa === idTarefa)
    const trocouDeColuna = tarefa && tarefa.status !== status
    try {
      await mover(idTarefa, status, ordem)
      // Reordenar dentro da mesma coluna nao merece aviso: o cartao no lugar
      // novo ja e o retorno.
      if (trocouDeColuna) avisar("success", `“${tarefa.titulo}” movida para ${rotuloDaColuna(status)}.`)
    } catch (err) {
      avisar("error", err.response?.data?.erro || "Não foi possível mover a tarefa.")
    }
  }

  /**
   * Mudar o status de varias de uma vez.
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
      avisar(
        "success",
        `${total} tarefa${total > 1 ? "s" : ""} movida${total > 1 ? "s" : ""} para "${rotuloDaColuna(status)}".`
      )
      setSelecionados([])
    } else {
      avisar(movidas === 0 ? "error" : "warning", erroLote || `Não foi possível mover ${falhas} de ${total} tarefas.`)
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

  /**
   * Exporta o que esta filtrado, nas colunas da tabela. No kanban a tabela
   * nao esta montada e nao informou as colunas visiveis: ai valem as colunas
   * padrao, em vez de uma planilha sem coluna nenhuma.
   */
  const exportar = () => {
    const chaves = colunasVisiveis.length
      ? colunasVisiveis
      : colunasTabela.filter((c) => c.visivelPadrao !== false).map((c) => c.chave)
    exportarTabelaCsv("tarefas", colunasTabela, chaves, filtradas)
  }

  const vazio = (
    <EstadoVazio
      filtrando={filtrando}
      soAsMinhas={soAsMinhas}
      podeCriar={podeCriar}
      onLimpar={limparTudo}
      onCriar={() => abrirNova()}
    />
  )

  return (
    <AppLayout>
      <Box>
        {/* CABECALHO compacto: titulo e descricao a esquerda; a troca de
            visualizacao e a acao principal a direita, sempre a vista. */}
        <Box
          sx={{
            display: "flex",
            alignItems: { xs: "flex-start", sm: "center" },
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 2,
            mb: 2.5,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <TaskAlt sx={{ color: "primary.main" }} aria-hidden />
              <Typography variant="h4" component="h1" fontWeight={700}>
                Tarefas
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              O trabalho da equipe e das startups: quem faz, até quando e em que pé está.
            </Typography>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={visual}
              onChange={(_, novo) => novo && setVisual(novo)}
              aria-label="Modo de visualização"
              sx={{
                "& .MuiToggleButton-root": {
                  gap: 0.75,
                  px: 1.5,
                  textTransform: "none",
                  fontWeight: 600,
                  letterSpacing: 0,
                },
                "& .MuiToggleButton-root.Mui-selected": {
                  bgcolor: (t) => alpha(t.palette.primary.vivo, t.palette.mode === "dark" ? 0.2 : 0.24),
                  color: "text.primary",
                  "&:hover": {
                    bgcolor: (t) => alpha(t.palette.primary.vivo, t.palette.mode === "dark" ? 0.28 : 0.32),
                  },
                },
              }}
            >
              <ToggleButton value="tabela" aria-label="Tabela">
                <TableRows sx={{ fontSize: 18 }} />
                <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                  Tabela
                </Box>
              </ToggleButton>
              <ToggleButton value="kanban" aria-label="Kanban">
                <ViewKanban sx={{ fontSize: 18 }} />
                <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                  Kanban
                </Box>
              </ToggleButton>
            </ToggleButtonGroup>

            {podeCriar && (
              <Button variant="contained" startIcon={<Add />} onClick={() => abrirNova()}>
                Nova tarefa
              </Button>
            )}
          </Box>
        </Box>

        {/* Uma lista curta sem explicacao parece uma incubadora parada. Este
            aviso e a diferenca entre "nao ha tarefas" e "estas sao as suas". */}
        {soAsMinhas && !carregandoInicial && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Você está vendo as tarefas em que está envolvido, as que são sua responsabilidade e as
            que você criou. Para acompanhar o quadro inteiro da incubadora é preciso a permissão
            "Ver as tarefas de toda a incubadora".
          </Alert>
        )}

        {!erro && (
          <IndicadoresTarefas
            itens={indicadores}
            ativo={recorte}
            onAlternar={(id) => setRecorte((atual) => (atual === id ? null : id))}
            carregando={carregandoInicial}
          />
        )}

        <Paper sx={{ borderRadius: 0 }}>
          {erro ? (
            <Box role="alert" sx={{ px: 3, py: 6, textAlign: "center" }}>
              <ErrorOutline sx={{ fontSize: 36, color: "error.main" }} aria-hidden />
              <Typography fontWeight={700} sx={{ mt: 1 }}>
                Não foi possível carregar as tarefas
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
                {erro}
              </Typography>
              <Button variant="outlined" startIcon={<Refresh />} onClick={recarregar}>
                Tentar novamente
              </Button>
            </Box>
          ) : (
            <>
              <BarraTarefas
                busca={busca}
                onBuscaChange={setBusca}
                gruposRapidos={gruposRapidos}
                filtros={filtros}
                onFiltrosChange={setFiltros}
                totalFiltros={totalFiltros}
                totalFiltrosOcultos={contarFiltros(
                  Object.fromEntries(
                    Object.entries(filtros).filter(([id]) => !gruposRapidos.some((g) => g.id === id))
                  )
                )}
                onAbrirFiltros={() => setPainelAberto(true)}
                chips={chips}
                onLimparTudo={limparTudo}
                totalVisiveis={filtradas.length}
                totalGeral={tarefas.length}
                carregando={carregandoInicial}
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
                onExportar={podeExportar ? exportar : undefined}
              />

              {visual === "tabela" ? (
                <TabelaDados
                  dados={filtradas}
                  colunas={colunasTabela}
                  chaveId="id_tarefa"
                  chaveStorage="tarefas"
                  ordemInicial="status"
                  carregando={carregandoInicial}
                  mensagemVazio={vazio}
                  onClickLinha={abrirTarefa}
                  onColunasVisiveisChange={setColunasVisiveis}
                  // A selecao existe para a acao em massa, que muda o status de
                  // varias de uma vez: sem a chave de editar as dos outros, ela
                  // nao levaria a lugar nenhum.
                  selecionavel={podeEditar}
                  selecionados={selecionados}
                  onSelecionadosChange={setSelecionados}
                />
              ) : (
                <QuadroKanban
                  colunas={colunas0}
                  // O kanban desenha as tarefas ja filtradas: os filtros valem
                  // para as duas visualizacoes, senao trocar de aba mudaria o
                  // conjunto sob os pes de quem acabou de filtrar.
                  tarefas={filtradas}
                  carregando={carregandoInicial || statusConfig === null}
                  filtrando={filtrando}
                  onAbrirTarefa={abrirTarefa}
                  onCriarEm={abrirNova}
                  onMover={moverCartao}
                  podeCriar={podeCriar}
                  // Por cartao: quem e responsavel arrasta o proprio mesmo sem a
                  // chave `editar`, que e o que o backend permite. Ver podeMexer.
                  podeMover={podeMexer}
                />
              )}
            </>
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
            rotulo: "Status",
            opcoes: colunas0.map((s) => ({ valor: s.chave, rotulo: s.rotulo })),
          },
        ]}
        onAplicar={aplicarStatusEmMassa}
      />

      <DrawerTarefa
        aberto={drawerAberto}
        onFechar={fecharDrawer}
        idTenant={idTenant}
        tarefa={tarefaEditando}
        carregando={carregandoTarefa}
        statusInicial={statusInicial}
        pessoas={pessoas}
        startups={startups}
        podeExcluir={podeExcluir}
        onSalvar={salvarTarefa}
        onExcluir={excluirTarefa}
      />

      <Snackbar
        open={avisoAberto}
        autoHideDuration={aviso?.tipo === "success" ? 4000 : 8000}
        onClose={(_, motivo) => motivo !== "clickaway" && setAvisoAberto(false)}
        // A esquerda: o painel de cadastro abre a direita, e um aviso no
        // centro cobriria os botoes do rodape dele.
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Alert
          severity={aviso?.tipo || "success"}
          variant="filled"
          onClose={() => setAvisoAberto(false)}
          sx={{ width: "100%", alignItems: "center" }}
        >
          {aviso?.texto}
        </Alert>
      </Snackbar>
    </AppLayout>
  )
}

/**
 * O que a tabela diz quando nao ha linha. Tres situacoes, tres proximos passos:
 * o filtro escondeu tudo (limpar), a incubadora nao tem tarefa (criar), ou a
 * pessoa ve so as suas e nao tem nenhuma.
 */
function EstadoVazio({ filtrando, soAsMinhas, podeCriar, onLimpar, onCriar }) {
  if (filtrando) {
    return (
      <Box sx={{ py: 2 }}>
        <SearchOff sx={{ fontSize: 32, color: "text.disabled" }} aria-hidden />
        <Typography fontWeight={700} color="text.primary" sx={{ mt: 0.5 }}>
          Nenhuma tarefa corresponde aos filtros
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, mb: 1.5 }}>
          Ajuste a pesquisa ou remova algum filtro para ver mais resultados.
        </Typography>
        <Button size="small" variant="outlined" onClick={onLimpar}>
          Limpar filtros
        </Button>
      </Box>
    )
  }

  return (
    <Box sx={{ py: 2 }}>
      <TaskAlt sx={{ fontSize: 32, color: "text.disabled" }} aria-hidden />
      <Typography fontWeight={700} color="text.primary" sx={{ mt: 0.5 }}>
        {soAsMinhas ? "Nenhuma tarefa sua por aqui" : "Nenhuma tarefa cadastrada"}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, mb: podeCriar ? 1.5 : 0 }}>
        {soAsMinhas
          ? "Quando alguém atribuir uma tarefa a você, ela aparece aqui."
          : "Registre o que a equipe precisa fazer, com responsável e prazo, nada se perde."}
      </Typography>
      {podeCriar && (
        <Button size="small" variant="contained" startIcon={<Add />} onClick={onCriar}>
          Nova tarefa
        </Button>
      )}
    </Box>
  )
}
