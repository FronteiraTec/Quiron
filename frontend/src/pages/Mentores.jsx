/**
 * Tela "Mentores" — quem mentora na incubadora.
 *
 * ERA MESTRE-DETALHE (lista a esquerda, startups do selecionado a direita), e
 * existia para uma decisao so: distribuir startups. Isso deixava a coordenacao
 * sem responder as perguntas que ela faz ANTES de distribuir — de onde esse
 * mentor vem, do que ele entende, que demanda ele topa, quanto tempo tem, se
 * atende presencial, e ha quanto tempo ele nao aparece. Uma coluna fixa de 360px
 * nao cabe isso, e nem toda incubadora acompanha pelos mesmos campos.
 *
 * ENTAO VIROU TABELA (TabelaDados), no mesmo molde de Startups: cada incubadora
 * escolhe as colunas que ve, em que ordem, e a escolha fica guardada no
 * navegador. A distribuicao continua sendo o caminho principal — clicar na
 * linha abre o painel do mentor direto na aba "Startups", que e onde o vinculo
 * e feito. Ver DrawerMentor.
 *
 * TRES ORIGENS NA MESMA LINHA, e vale saber qual e qual ao ler:
 *   CADASTRO   o que a coordenacao digitou (mentor_perfil, migracao 016)
 *   CARGA      startups acompanhadas e entregas paradas na fila dele
 *   HISTORICO  ultima mentoria e quantas no periodo, contadas da AGENDA
 *
 * O HISTORICO NAO SE DIGITA AQUI: sao as atividades de categoria Mentoria que
 * ja aconteceram e apontam para o mentor. Quem preenche essa coluna e quem
 * marca as atividades no calendario — por isso a coluna tem tooltip dizendo de
 * onde ela vem, senao ela pareceria um campo que ninguem preencheu.
 *
 * OS FILTROS DE TEXTO SAEM DOS PROPRIOS DADOS (vinculo, area, especialidades,
 * demandas), como o filtro de UF em Startups: nao ha cadastro de especialidade,
 * e listar um vocabulario fixo seria oferecer filtro para o que ninguem usa.
 *
 * Endpoints: ver hooks/useMentores.
 */
import { useMemo, useState } from "react"
import {
  Alert,
  Box,
  Button,
  Chip,
  Link,
  MenuItem,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material"
import { Add, EditOutlined, SupervisorAccount, SwapHoriz } from "@mui/icons-material"

import AppLayout from "../components/AppLayout"
import DrawerMentor from "../components/mentores/DrawerMentor"
import ChipSituacaoMentor from "../components/mentores/ChipSituacaoMentor"
import { FORMATOS, SITUACOES, rotuloFormato, rotuloSituacao } from "../components/mentores/vocabulario"
import TabelaDados from "../components/tabela/TabelaDados"
import ToolbarTabela from "../components/tabela/ToolbarTabela"
import PainelFiltros, { contarFiltros } from "../components/tabela/PainelFiltros"
import AtualizacaoMassa from "../components/tabela/AtualizacaoMassa"
import { exportarTabelaCsv } from "../components/tabela/exportarTabela"
import { useMentores, DIAS_PADRAO } from "../hooks/useMentores"
import { useAuthStore } from "../store/authStore"
import { usePermissaoStore } from "../store/permissaoStore"
import { formatarCelular } from "../utils/mascaras"

/**
 * As janelas oferecidas para "mentorias no periodo".
 *
 * Faixa, e nao um numero fixo, porque a pergunta muda com o programa: um ciclo
 * trimestral le 90 dias, um anual le 365. Trocar aqui refaz a consulta — a
 * contagem e do banco, nao do que ja esta na tela.
 */
const PERIODOS = [
  { dias: 30, rotulo: "30 dias" },
  { dias: 90, rotulo: "90 dias" },
  { dias: 180, rotulo: "6 meses" },
  { dias: 365, rotulo: "12 meses" },
]

const dataBR = (ts) => (ts ? new Date(ts).toLocaleDateString("pt-BR") : "")

/** Os valores de um campo de texto que estao EM USO, para virarem filtro. */
function valoresEmUso(linhas, ler) {
  return [...new Set(linhas.flatMap((linha) => ler(linha) || []).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "pt-BR", { sensitivity: "base" })
  )
}

/**
 * Lista de tags numa celula: as duas primeiras e um "+N".
 *
 * Duas porque a coluna tem 220px e a terceira tag ja quebraria a linha. O resto
 * fica no tooltip, e a lista inteira sai na exportacao — a tabela e para
 * varrer, o cadastro e para ler.
 */
function CelulaTags({ tags = [] }) {
  if (tags.length === 0) return "—"
  const visiveis = tags.slice(0, 2)
  const restantes = tags.length - visiveis.length

  return (
    <Tooltip title={tags.join(" · ")} arrow>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "nowrap" }}>
        {visiveis.map((tag) => (
          <Chip key={tag} size="small" variant="outlined" label={tag} sx={{ maxWidth: 110 }} />
        ))}
        {restantes > 0 && (
          <Typography variant="caption" color="text.secondary">
            +{restantes}
          </Typography>
        )}
      </Box>
    </Tooltip>
  )
}

export default function Mentores() {
  const usuario = useAuthStore((s) => s.usuario)
  const idTenant = usuario?.id_tenant ?? null

  // O backend continua sendo quem autoriza — isto so evita oferecer o que
  // responderia 403. Vai no proprio seletor para a tela se redesenhar quando as
  // permissoes terminarem de carregar.
  const podeCriar = usePermissaoStore((s) => s.pode("startups.mentores.criar"))
  const podeEditar = usePermissaoStore((s) => s.pode("startups.mentores.editar"))
  const podeExportar = usePermissaoStore((s) => s.pode("startups.mentores.exportar"))

  const [dias, setDias] = useState(DIAS_PADRAO)
  const {
    mentores,
    diasAplicados,
    carregando,
    erro,
    recarregar,
    buscarDetalhe,
    criarMentor,
    salvarPerfil,
    alterarSituacao,
    vincular,
    desvincular,
  } = useMentores(idTenant, dias)

  const [busca, setBusca] = useState("")
  const [filtros, setFiltros] = useState({})
  const [painelAberto, setPainelAberto] = useState(false)
  const [aviso, setAviso] = useState(null)

  const [selecionados, setSelecionados] = useState([])
  const [ancoraMassa, setAncoraMassa] = useState(null)
  const [aplicandoMassa, setAplicandoMassa] = useState(false)

  const [colunasVisiveis, setColunasVisiveis] = useState([])

  // O drawer: qual mentor, em que aba, e as startups dele (carregadas so quando
  // abre — a listagem nao as traz). `criando` e o mesmo drawer sem mentor
  // nenhum: ele serve para cadastrar e para editar (ver DrawerMentor).
  const [aberto, setAberto] = useState(null)
  const [criando, setCriando] = useState(false)
  const [abaInicial, setAbaInicial] = useState("startups")
  const [detalhe, setDetalhe] = useState(null)
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)

  const mentorAberto = useMemo(
    () => mentores.find((m) => m.id_usuario === aberto) || null,
    [mentores, aberto]
  )

  // ---------------------------------------------------------------- colunas
  const colunas = useMemo(
    () => [
      {
        chave: "nome",
        rotulo: "Mentor",
        obrigatoria: true,
        largura: 240,
        valorTexto: (m) => m.nome,
        render: (m) => (
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap>
              {m.nome}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap component="div">
              {m.email}
            </Typography>
          </Box>
        ),
      },
      {
        chave: "situacao",
        rotulo: "Status",
        largura: 130,
        valorOrdenacao: (m) => rotuloSituacao(m.situacao),
        valorTexto: (m) => rotuloSituacao(m.situacao),
        render: (m) => <ChipSituacaoMentor situacao={m.situacao} />,
      },
      {
        chave: "vinculo",
        rotulo: "Vínculo institucional",
        largura: 190,
        valorTexto: (m) => m.vinculo || "",
        render: (m) => m.vinculo || "—",
      },
      {
        chave: "area",
        rotulo: "Área / departamento",
        largura: 180,
        valorTexto: (m) => m.area || "",
        render: (m) => m.area || "—",
      },
      {
        chave: "especialidades",
        rotulo: "Especialidades",
        largura: 220,
        ordenavel: false,
        valorTexto: (m) => (m.especialidades || []).join(" · "),
        render: (m) => <CelulaTags tags={m.especialidades} />,
      },
      {
        chave: "demandas",
        rotulo: "Demandas que atende",
        largura: 220,
        ordenavel: false,
        valorTexto: (m) => (m.demandas || []).join(" · "),
        render: (m) => <CelulaTags tags={m.demandas} />,
      },
      {
        chave: "horas_mes",
        rotulo: "Disponibilidade",
        ajuda: "Horas por mês que o mentor declarou ter. É estimativa, não medição.",
        largura: 150,
        alinhamento: "right",
        valorOrdenacao: (m) => m.horas_mes,
        valorTexto: (m) => (m.horas_mes == null ? "" : `${m.horas_mes} h/mês`),
        render: (m) => (m.horas_mes == null ? "—" : `${m.horas_mes} h/mês`),
      },
      {
        chave: "formato",
        rotulo: "Formato",
        largura: 130,
        valorOrdenacao: (m) => rotuloFormato(m.formato),
        valorTexto: (m) => rotuloFormato(m.formato),
        render: (m) => <Chip size="small" variant="outlined" label={rotuloFormato(m.formato)} />,
      },
      {
        chave: "ultima_mentoria_ts",
        rotulo: "Última mentoria",
        ajuda:
          "A atividade de Mentoria mais recente da agenda que já aconteceu e tem este mentor como responsável.",
        largura: 150,
        valorOrdenacao: (m) => m.ultima_mentoria_ts,
        valorTexto: (m) => dataBR(m.ultima_mentoria_ts),
        render: (m) =>
          m.ultima_mentoria_ts ? (
            dataBR(m.ultima_mentoria_ts)
          ) : (
            <Typography variant="caption" color="text.secondary">
              nenhuma registrada
            </Typography>
          ),
      },
      {
        chave: "mentorias_periodo",
        // O rotulo carrega a janela: "12" sem periodo nao quer dizer nada, e a
        // janela e escolhida na barra acima da tabela.
        rotulo: `Mentorias (${diasAplicados}d)`,
        ajuda:
          "Atividades de Mentoria da agenda, já ocorridas, com este mentor como responsável, dentro do período escolhido na barra acima.",
        largura: 150,
        alinhamento: "right",
        valorOrdenacao: (m) => m.mentorias_periodo,
        valorTexto: (m) => String(m.mentorias_periodo ?? 0),
        render: (m) => m.mentorias_periodo ?? 0,
      },
      {
        chave: "startups",
        rotulo: "Startups",
        ajuda: "Quantas startups o mentor acompanha. É esse vínculo que recorta a fila dele.",
        largura: 120,
        alinhamento: "right",
        valorOrdenacao: (m) => m.startups,
        valorTexto: (m) => String(m.startups ?? 0),
        // Zero em laranja: e o unico estado desta tela que sempre pede uma
        // acao — o mentor sem vinculo entra no sistema e ve a fila vazia, sem
        // nenhuma pista de que falta alguem liga-lo a uma startup.
        render: (m) =>
          m.startups === 0 ? (
            <Typography variant="body2" sx={{ color: "#f97316", fontWeight: 700 }}>
              nenhuma
            </Typography>
          ) : (
            m.startups
          ),
      },
      {
        chave: "pendentes",
        rotulo: "Na fila",
        ajuda: "Entregas enviadas pelas startups dele que ainda esperam avaliação.",
        largura: 120,
        alinhamento: "right",
        valorOrdenacao: (m) => m.pendentes,
        valorTexto: (m) => String(m.pendentes ?? 0),
        render: (m) =>
          m.pendentes > 0 ? (
            <Typography variant="body2" sx={{ color: "#f97316", fontWeight: 700 }}>
              {m.pendentes}
            </Typography>
          ) : (
            0
          ),
      },
      // As de baixo nao abrem a tabela: sao dado de ficha, procurado quando se
      // procura, e cada uma ligada de saida empurraria a carga para fora da tela.
      {
        chave: "contato",
        rotulo: "Contato",
        visivelPadrao: false,
        largura: 230,
        ordenavel: false,
        valorTexto: (m) => [m.email, formatarCelular(m.celular || "")].filter(Boolean).join(" · "),
        render: (m) => (
          <Box sx={{ minWidth: 0 }}>
            <Link
              href={`mailto:${m.email}`}
              variant="body2"
              onClick={(e) => e.stopPropagation()}
              noWrap
            >
              {m.email}
            </Link>
            {m.celular && (
              <Typography variant="caption" color="text.secondary" noWrap component="div">
                {formatarCelular(m.celular)}
              </Typography>
            )}
          </Box>
        ),
      },
      {
        chave: "observacoes",
        rotulo: "Observações da coordenação",
        visivelPadrao: false,
        largura: 280,
        valorTexto: (m) => m.observacoes || "",
        render: (m) =>
          m.observacoes ? (
            <Tooltip title={m.observacoes} arrow>
              <Typography variant="body2" noWrap sx={{ maxWidth: 260 }}>
                {m.observacoes}
              </Typography>
            </Tooltip>
          ) : (
            "—"
          ),
      },
      {
        chave: "desde",
        rotulo: "Mentor desde",
        visivelPadrao: false,
        largura: 140,
        valorOrdenacao: (m) => m.desde,
        valorTexto: (m) => dataBR(m.desde),
        render: (m) => dataBR(m.desde) || "—",
      },
    ],
    [diasAplicados]
  )

  // ---------------------------------------------------------------- filtros
  const gruposFiltro = useMemo(() => {
    const grupos = [
      {
        id: "situacao",
        rotulo: "Status",
        tipo: "checkbox",
        itens: SITUACOES.map((s) => ({ id: s.chave, rotulo: s.rotulo })),
      },
      {
        id: "formato",
        rotulo: "Formato",
        tipo: "checkbox",
        itens: FORMATOS.map((f) => ({ id: f.chave, rotulo: f.rotulo })),
      },
      {
        // A pergunta que abre esta tela. Radio, e nao duas caixas: marcar as
        // duas seria o mesmo que nao filtrar.
        id: "carga",
        rotulo: "Carga",
        tipo: "radio",
        itens: [
          { id: "sem", rotulo: "Sem startup vinculada" },
          { id: "com", rotulo: "Com pelo menos uma" },
          { id: "fila", rotulo: "Com entrega esperando resposta" },
        ],
      },
    ]

    // Os quatro abaixo saem dos PROPRIOS DADOS: nao ha cadastro de
    // especialidade nem de vinculo, e um grupo vazio nao teria item para marcar.
    const porDados = [
      { id: "especialidade", rotulo: "Especialidades", ler: (m) => m.especialidades },
      { id: "demanda", rotulo: "Demandas que atende", ler: (m) => m.demandas },
      { id: "vinculo", rotulo: "Vínculo institucional", ler: (m) => (m.vinculo ? [m.vinculo] : []) },
      { id: "area", rotulo: "Área / departamento", ler: (m) => (m.area ? [m.area] : []) },
    ]
    porDados.forEach(({ id, rotulo, ler }) => {
      const valores = valoresEmUso(mentores, ler)
      if (valores.length > 0) {
        grupos.push({
          id,
          rotulo,
          tipo: "checkbox",
          itens: valores.map((valor) => ({ id: valor, rotulo: valor })),
        })
      }
    })

    grupos.push({ id: "horas", rotulo: "Disponibilidade", tipo: "intervalo", sufixo: "h/mês" })
    grupos.push({ id: "mentorias", rotulo: `Mentorias (${diasAplicados}d)`, tipo: "intervalo" })
    grupos.push({ id: "ultima_mentoria", rotulo: "Última mentoria", tipo: "data" })

    return grupos
  }, [mentores, diasAplicados])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()

    // Uma tag marcada casa quando ESTA na lista do mentor; um mentor sem tag
    // nenhuma nunca casa. Comparacao por texto exato — os valores do filtro sao
    // os proprios valores gravados.
    const casaLista = (selecao, lista) =>
      !selecao?.length || (lista || []).some((valor) => selecao.includes(valor))

    const dentroDoIntervalo = (faixa, valor) => {
      if (!faixa?.min && !faixa?.max) return true
      if (valor == null) return false
      if (faixa.min !== "" && faixa.min != null && valor < Number(faixa.min)) return false
      if (faixa.max !== "" && faixa.max != null && valor > Number(faixa.max)) return false
      return true
    }

    return mentores.filter((m) => {
      if (termo) {
        const alvo = [
          m.nome,
          m.email,
          m.vinculo,
          m.area,
          ...(m.especialidades || []),
          ...(m.demandas || []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
        if (!alvo.includes(termo)) return false
      }

      const situacoesSel = filtros.situacao || []
      if (situacoesSel.length && !situacoesSel.includes(m.situacao)) return false

      const formatosSel = filtros.formato || []
      if (formatosSel.length && !formatosSel.includes(m.formato)) return false

      if (filtros.carga === "sem" && m.startups > 0) return false
      if (filtros.carga === "com" && m.startups === 0) return false
      if (filtros.carga === "fila" && !(m.pendentes > 0)) return false

      if (!casaLista(filtros.especialidade, m.especialidades)) return false
      if (!casaLista(filtros.demanda, m.demandas)) return false
      if (!casaLista(filtros.vinculo, m.vinculo ? [m.vinculo] : [])) return false
      if (!casaLista(filtros.area, m.area ? [m.area] : [])) return false

      if (!dentroDoIntervalo(filtros.horas, m.horas_mes)) return false
      if (!dentroDoIntervalo(filtros.mentorias, m.mentorias_periodo ?? 0)) return false

      // O <input type="date"> devolve YYYY-MM-DD e o timestamp comeca do mesmo
      // jeito: comparar os dez primeiros caracteres compara as datas sem
      // arrastar fuso horario para dentro do filtro.
      const periodo = filtros.ultima_mentoria
      if (periodo?.de || periodo?.ate) {
        const dia = (m.ultima_mentoria_ts || "").slice(0, 10)
        if (!dia) return false
        if (periodo.de && dia < periodo.de) return false
        if (periodo.ate && dia > periodo.ate) return false
      }

      return true
    })
  }, [mentores, busca, filtros])

  const sugestoes = useMemo(
    () => ({
      especialidades: valoresEmUso(mentores, (m) => m.especialidades),
      demandas: valoresEmUso(mentores, (m) => m.demandas),
    }),
    [mentores]
  )

  const semStartups = useMemo(() => mentores.filter((m) => m.startups === 0).length, [mentores])

  // ------------------------------------------------------------------ acoes
  const abrirCadastro = () => {
    setAberto(null)
    setDetalhe(null)
    setCriando(true)
  }

  const fecharDrawer = () => {
    setAberto(null)
    setCriando(false)
  }

  /**
   * Cadastra o mentor e FECHA o painel.
   *
   * Nao emenda no vinculo com startups porque a linha dele so existe depois que
   * a listagem recarrega — e manter o drawer aberto no intervalo o faria piscar
   * entre "cadastro novo" e "mentor recem-criado". O aviso diz o proximo passo,
   * que e um clique na linha.
   *
   * Deixa o erro subir: quem o mostra e o proprio drawer, no formulario em que
   * a pessoa acabou de digitar.
   */
  const cadastrarMentor = async (dados) => {
    const novo = await criarMentor(dados)
    setCriando(false)
    setAviso({
      tipo: "success",
      texto:
        `${novo.nome} entrou na incubadora como mentor e terá de trocar a senha provisória ` +
        `no primeiro acesso. Clique na linha dele para vincular as startups que vai acompanhar.`,
    })
  }

  const abrirMentor = async (mentor, aba) => {
    setCriando(false)
    setAbaInicial(aba)
    setAberto(mentor.id_usuario)
    setDetalhe(null)
    setCarregandoDetalhe(true)
    try {
      setDetalhe(await buscarDetalhe(mentor.id_usuario))
    } catch {
      setDetalhe(null)
    } finally {
      setCarregandoDetalhe(false)
    }
  }

  // Depois de vincular/desvincular o painel precisa ser relido: as duas listas
  // (acompanha e disponiveis) trocam de lado. O hook ja recarregou a listagem.
  const aplicarVinculo = async (acao, idUsuario, idStartup) => {
    await acao(idUsuario, idStartup)
    setDetalhe(await buscarDetalhe(idUsuario))
  }

  /**
   * Status em massa.
   *
   * Uma chamada por mentor, e nao um endpoint de lote — mesmo desenho da lista
   * de startups. O que falha e reportado: mudar 8 de 10 e dizer "pronto" seria
   * pior do que nao ter o botao.
   */
  const aplicarSituacaoEmMassa = async ({ situacao }) => {
    if (!situacao) return
    setAplicandoMassa(true)
    const resultados = await Promise.allSettled(
      selecionados.map((id) => alterarSituacao(id, situacao))
    )
    const falhas = resultados.filter((r) => r.status === "rejected")
    setAplicandoMassa(false)
    setAncoraMassa(null)

    if (falhas.length === 0) {
      setAviso({
        tipo: "success",
        texto: `${selecionados.length} mentor${selecionados.length > 1 ? "es" : ""} marcado${
          selecionados.length > 1 ? "s" : ""
        } como "${rotuloSituacao(situacao)}".`,
      })
      setSelecionados([])
    } else {
      setAviso({
        tipo: falhas.length === resultados.length ? "error" : "warning",
        texto:
          falhas[0].reason?.response?.data?.erro ||
          `Não foi possível alterar o status de ${falhas.length} de ${resultados.length} mentores.`,
      })
    }
    // Sempre recarrega, mesmo com falha parcial: a tabela precisa mostrar o
    // que de fato ficou gravado, e nao o que foi pedido.
    recarregar()
  }

  const totalFiltros = contarFiltros(filtros)

  return (
    <AppLayout>
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <SupervisorAccount sx={{ color: "primary.main" }} />
            <Typography variant="h4" fontWeight={700}>
              Mentores
            </Typography>
          </Box>
          {podeCriar && (
            <Button
              data-tour="mentores-novo"
              variant="contained"
              startIcon={<Add />}
              onClick={abrirCadastro}
            >
              Novo Mentor
            </Button>
          )}
        </Box>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Quem mentora na incubadora: o que cada um atende, quanto tem de agenda e quais startups
          acompanha.
        </Typography>

        <Box
          data-tour="mentores-resumo"
          sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap", mb: 2 }}
        >
          <Typography variant="h5" fontWeight={700}>
            {mentores.length}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {mentores.length === 1 ? "mentor" : "mentores"}
          </Typography>
          {semStartups > 0 && (
            <Typography variant="body2" sx={{ color: "#f97316", fontWeight: 700 }}>
              · {semStartups} sem startup
            </Typography>
          )}
        </Box>

        {erro && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {erro}
          </Alert>
        )}

        {aviso && (
          <Alert severity={aviso.tipo} sx={{ mb: 3 }} onClose={() => setAviso(null)}>
            {aviso.texto}
          </Alert>
        )}

        <Paper data-tour="mentores-lista" sx={{ borderRadius: 0 }}>
          <ToolbarTabela
            busca={busca}
            onBuscaChange={setBusca}
            placeholderBusca="Pesquisar por nome, e-mail, especialidade ou demanda..."
            propsBusca={{ "data-tour": "mentores-busca" }}
            totalFiltros={totalFiltros}
            onAbrirFiltros={() => setPainelAberto(true)}
            propsBotaoFiltro={{ "data-tour": "mentores-filtros" }}
            totalSelecionados={selecionados.length}
            onLimparSelecao={() => setSelecionados([])}
            acoesMassa={
              <Button
                size="small"
                variant="outlined"
                startIcon={<SwapHoriz />}
                onClick={(e) => setAncoraMassa(e.currentTarget)}
              >
                Alterar status
              </Button>
            }
            onExportar={
              podeExportar
                ? () => exportarTabelaCsv("mentores", colunas, colunasVisiveis, filtrados)
                : undefined
            }
            acoes={
              <TextField
                select
                size="small"
                label="Mentorias"
                value={dias}
                onChange={(e) => setDias(Number(e.target.value))}
                sx={{ minWidth: 140 }}
                data-tour="mentores-periodo"
              >
                {PERIODOS.map((p) => (
                  <MenuItem key={p.dias} value={p.dias}>
                    {p.rotulo}
                  </MenuItem>
                ))}
              </TextField>
            }
          />

          <TabelaDados
            dados={filtrados}
            colunas={colunas}
            chaveId="id_usuario"
            chaveStorage="mentores"
            ordemInicial="nome"
            carregando={carregando}
            mensagemVazio={
              podeCriar
                ? "Nenhum mentor encontrado. Use “Novo Mentor” para cadastrar, ou defina o papel “mentor” para alguém que já está na incubadora, em Usuários."
                : "Nenhum mentor encontrado. Mentor é um papel: defina “mentor” para um usuário em Usuários e ele aparece aqui."
            }
            onClickLinha={(m) => abrirMentor(m, "startups")}
            onColunasVisiveisChange={setColunasVisiveis}
            selecionavel={podeEditar}
            selecionados={selecionados}
            onSelecionadosChange={setSelecionados}
            larguraAcoes={56}
            acoes={[
              {
                rotulo: podeEditar ? "Editar cadastro" : "Ver cadastro",
                icone: <EditOutlined fontSize="small" />,
                onClick: (m) => abrirMentor(m, "cadastro"),
              },
            ]}
          />
        </Paper>
      </Box>

      <PainelFiltros
        aberto={painelAberto}
        onFechar={() => setPainelAberto(false)}
        titulo="Filtrar mentores"
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
            chave: "situacao",
            rotulo: "Status",
            opcoes: SITUACOES.map((s) => ({ valor: s.chave, rotulo: s.rotulo })),
          },
        ]}
        onAplicar={aplicarSituacaoEmMassa}
      />

      <DrawerMentor
        aberto={criando || Boolean(mentorAberto)}
        onFechar={fecharDrawer}
        mentor={criando ? null : mentorAberto}
        detalhe={detalhe}
        carregandoDetalhe={carregandoDetalhe}
        abaInicial={abaInicial}
        sugestoes={sugestoes}
        podeEditar={podeEditar}
        onCriar={cadastrarMentor}
        onSalvar={salvarPerfil}
        onVincular={(idUsuario, idStartup) => aplicarVinculo(vincular, idUsuario, idStartup)}
        onDesvincular={(idUsuario, idStartup) => aplicarVinculo(desvincular, idUsuario, idStartup)}
      />
    </AppLayout>
  )
}
