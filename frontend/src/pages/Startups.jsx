/**
 * Tela "Startups" - lista das startups da incubadora (visao admin/mentor).
 *
 * A LISTA E UMA TABELA (TabelaDados), e nao mais uma pilha de cartoes: com o
 * cadastro completo — endereco, tipo, situacao e os campos que cada incubadora
 * inventa — nao existe um conjunto de colunas que sirva para todas. A tabela
 * deixa cada incubadora escolher o que ver, em que ordem, e guarda a escolha no
 * navegador. Ver TabelaDados.
 *
 * OS CAMPOS PERSONALIZAVEIS VIRAM COLUNA E VIRAM FILTRO, um a um: a incubadora
 * que criou "Setor" quer listar por setor, nao abrir 40 cadastros para
 * descobrir quais sao AgriTech. O tipo do campo decide o filtro (categoria vira
 * lista de marcar, monetario vira intervalo, texto vira busca) — ver
 * utils/camposExtras.
 *
 * Os FILTROS moraram numa fileira de seletores acima da lista. Viraram um
 * painel lateral (PainelFiltros) porque a fileira crescia com o cadastro: fase,
 * tipo e status ja eram tres, e cada campo personalizavel acrescenta o seu.
 *
 * TIPO e STATUS sao vocabulario de cada incubadora (startup_tipo /
 * startup_situacao, migracao 010), lidos do startupConfigStore.
 *
 * Endpoints:
 *   GET   /startups?id_tenant=      -> lista (com fase_atual e progresso_pct)
 *   GET   /startups/:id             -> cadastro completo, para editar
 *   PATCH /startups/:id/situacao    -> status em massa
 *   GET   /trilha?id_tenant=        -> arvore da trilha; as fases saem dela (filtro)
 *   GET   /trilha/programas         -> trilhas, para o seletor do cadastro
 */
import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  LinearProgress,
  Alert,
  Link,
} from "@mui/material"
import { Add, EditOutlined, RocketLaunch, SwapHoriz } from "@mui/icons-material"
import AppLayout from "../components/AppLayout"
import api from "../services/api"
import { useAuthStore } from "../store/authStore"
import { useStartupConfigStore } from "../store/startupConfigStore"
import { usePermissaoStore } from "../store/permissaoStore"
import DrawerCadastroStartup from "../components/startup/DrawerCadastroStartup"
import ChipSituacao from "../components/startup/ChipSituacao"
import TabelaDados from "../components/tabela/TabelaDados"
import ToolbarTabela from "../components/tabela/ToolbarTabela"
import PainelFiltros, { contarFiltros } from "../components/tabela/PainelFiltros"
import AtualizacaoMassa from "../components/tabela/AtualizacaoMassa"
import { exportarTabelaCsv } from "../components/tabela/exportarTabela"
import { formatarCnpj, somenteDigitos } from "../utils/mascaras"
import {
  PREFIXO_FILTRO_EXTRA,
  casaFiltroCampoExtra,
  formatarCampoExtra,
  grupoFiltroCampoExtra,
  valorOrdenacaoCampoExtra,
} from "../utils/camposExtras"

/** Startup sem fase pendente na trilha ja passou por todas: esta graduada. */
const faseDaStartup = (s) => s.fase_atual || "Graduada"

const dataBR = (ts) => (ts ? new Date(ts).toLocaleDateString("pt-BR") : "")

export default function Startups() {
  const navigate = useNavigate()
  const usuario = useAuthStore((s) => s.usuario)
  const idTenant = usuario?.id_tenant ?? null

  // As acoes que a listagem passou a oferecer (editar o cadastro, mudar o
  // status de varias de uma vez, exportar) nao valem para todo mundo: mentor
  // costuma so acompanhar. O backend continua sendo quem autoriza — isto aqui
  // so evita oferecer o que responderia 403. A resposta vai no proprio seletor
  // para a tela se redesenhar quando as permissoes terminarem de carregar.
  const podeEditar = usePermissaoStore((s) => s.pode("startups.startups.editar"))
  const podeExportar = usePermissaoStore((s) => s.pode("startups.startups.exportar"))

  const tipos = useStartupConfigStore((s) => s.tipos) || []
  const situacoes = useStartupConfigStore((s) => s.situacoes) || []
  const campos = useStartupConfigStore((s) => s.campos) || []

  const [startups, setStartups] = useState([])
  const [fases, setFases] = useState([])
  // Trilhas da incubadora, para o seletor do cadastro.
  const [trilhas, setTrilhas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [aviso, setAviso] = useState(null)

  const [busca, setBusca] = useState("")
  // { [idDoGrupo]: valor } — o que o PainelFiltros devolveu no ultimo "Aplicar".
  const [filtros, setFiltros] = useState({})
  const [painelAberto, setPainelAberto] = useState(false)

  const [selecionados, setSelecionados] = useState([])
  const [ancoraMassa, setAncoraMassa] = useState(null)
  const [aplicandoMassa, setAplicandoMassa] = useState(false)

  // As colunas na tela, para a exportacao sair igual ao que esta sendo lido.
  const [colunasVisiveis, setColunasVisiveis] = useState([])

  const [drawerAberto, setDrawerAberto] = useState(false)
  // Preenchido so na edicao: o cadastro completo (com contatos) da startup
  // clicada, que a listagem nao traz.
  const [startupEditando, setStartupEditando] = useState(null)

  const carregar = async () => {
    if (!idTenant) {
      setCarregando(false)
      return
    }
    setCarregando(true)
    try {
      const [startupsRes, trilhaRes, programasRes] = await Promise.all([
        api.get("/startups", { params: { id_tenant: idTenant } }),
        api.get("/trilha", { params: { id_tenant: idTenant } }),
        api.get("/trilha/programas", { params: { id_tenant: idTenant } }),
      ])
      setStartups(startupsRes.data.startups)
      // As fases do filtro sao os filhos diretos das trilhas. Com varias
      // trilhas o filtro passa a listar as fases de todas — o nome da fase e
      // o que a linha da tabela mostra, e ele nao diz de qual trilha veio.
      setFases(trilhaRes.data.trilha.flatMap((programa) => programa.filhos || []))
      setTrilhas(programasRes.data.programas)
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao carregar as startups." })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idTenant])

  // ---------------------------------------------------------------- colunas
  const colunas = useMemo(() => {
    const fixas = [
      {
        chave: "nome",
        rotulo: "Startup",
        obrigatoria: true,
        largura: 260,
        valorTexto: (s) => s.nome,
        render: (s) => (
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap>
              {s.nome}
            </Typography>
            {/* A cidade responde a pergunta mais frequente sobre uma startup
                depois do nome, e agora ha onde guarda-la. */}
            {(s.cidade || s.uf) && (
              <Typography variant="caption" color="text.secondary" noWrap>
                {[s.cidade, s.uf].filter(Boolean).join(" / ")}
              </Typography>
            )}
          </Box>
        ),
      },
      {
        chave: "fase_atual",
        rotulo: "Fase",
        largura: 170,
        valorOrdenacao: faseDaStartup,
        valorTexto: faseDaStartup,
        render: (s) => <Chip size="small" variant="outlined" label={faseDaStartup(s)} />,
      },
      {
        chave: "tipo",
        rotulo: "Tipo",
        largura: 140,
        valorOrdenacao: (s) => s.tipo_rotulo,
        valorTexto: (s) => s.tipo_rotulo || "",
        render: (s) =>
          s.tipo_rotulo ? (
            <Chip
              size="small"
              variant="outlined"
              label={s.tipo_rotulo}
              sx={{ borderColor: s.tipo_cor, color: s.tipo_cor }}
            />
          ) : (
            "—"
          ),
      },
      {
        chave: "situacao",
        rotulo: "Status",
        largura: 130,
        valorOrdenacao: (s) => s.situacao_rotulo || s.status,
        valorTexto: (s) => s.situacao_rotulo || s.status || "",
        render: (s) => <ChipSituacao startup={s} />,
      },
      {
        chave: "progresso_pct",
        rotulo: "Progresso",
        largura: 200,
        valorOrdenacao: (s) => s.progresso_pct,
        valorTexto: (s) => `${s.progresso_pct}%`,
        render: (s) => (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 140 }}>
            <LinearProgress
              variant="determinate"
              value={s.progresso_pct}
              sx={{ flex: 1, height: 8, borderRadius: 4 }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ width: 36, textAlign: "right" }}>
              {s.progresso_pct}%
            </Typography>
          </Box>
        ),
      },
      // As colunas abaixo existem, mas nao abrem a tabela: sao dado de ficha,
      // procurado quando se procura, e cada uma ligada de saida empurraria o
      // progresso para fora da tela.
      {
        chave: "cnpj",
        rotulo: "CNPJ",
        visivelPadrao: false,
        largura: 170,
        valorTexto: (s) => formatarCnpj(s.cnpj) || "",
        render: (s) => formatarCnpj(s.cnpj) || "—",
      },
      {
        chave: "email",
        rotulo: "E-mail",
        visivelPadrao: false,
        largura: 220,
        valorTexto: (s) => s.email || "",
        render: (s) =>
          s.email ? (
            <Link
              href={`mailto:${s.email}`}
              variant="body2"
              onClick={(e) => e.stopPropagation()}
              noWrap
            >
              {s.email}
            </Link>
          ) : (
            "—"
          ),
      },
      {
        chave: "cidade",
        rotulo: "Cidade",
        visivelPadrao: false,
        largura: 160,
        valorTexto: (s) => [s.cidade, s.uf].filter(Boolean).join(" / "),
        render: (s) => [s.cidade, s.uf].filter(Boolean).join(" / ") || "—",
      },
      {
        chave: "criado_ts",
        rotulo: "Cadastro",
        visivelPadrao: false,
        largura: 120,
        valorOrdenacao: (s) => s.criado_ts,
        valorTexto: (s) => dataBR(s.criado_ts),
        render: (s) => dataBR(s.criado_ts) || "—",
      },
    ]

    // Um campo personalizavel = uma coluna. Entram VISIVEIS: a incubadora nao
    // cadastrou o campo para escondermos o resultado dele — e quem achar a
    // tabela larga demais desliga o que nao usa em "Gerenciar colunas", e a
    // escolha fica guardada.
    const extras = campos.map((campo) => {
      const numerico = campo.tipo === "NUMERICO" || campo.tipo === "MONETARIO"
      const ler = (s) => (s.campos_extras || {})[campo.chave]
      return {
        chave: PREFIXO_FILTRO_EXTRA + campo.chave,
        rotulo: campo.rotulo,
        largura: 160,
        alinhamento: numerico ? "right" : "left",
        valorOrdenacao: (s) => valorOrdenacaoCampoExtra(campo, ler(s)),
        valorTexto: (s) => formatarCampoExtra(campo, ler(s)) || "",
        render: (s) => formatarCampoExtra(campo, ler(s)) || "—",
      }
    })

    return [...fixas, ...extras]
  }, [campos])

  // ---------------------------------------------------------------- filtros
  const gruposFiltro = useMemo(() => {
    const grupos = []

    // Duas trilhas podem ter fases de mesmo nome; o filtro compara por nome.
    const nomesFases = [...new Set(fases.map((f) => f.nome))]
    grupos.push({
      id: "fase",
      rotulo: "Fase",
      tipo: "checkbox",
      itens: [
        ...nomesFases.map((nome) => ({ id: nome, rotulo: nome })),
        { id: "Graduada", rotulo: "Graduada" },
      ],
    })

    // Sem tipo cadastrado o grupo nao teria item nenhum para marcar.
    if (tipos.length > 0) {
      grupos.push({
        id: "tipo",
        rotulo: "Tipo",
        tipo: "checkbox",
        itens: tipos.map((t) => ({ id: t.chave, rotulo: t.rotulo })),
      })
    }

    if (situacoes.length > 0) {
      grupos.push({
        id: "situacao",
        rotulo: "Status",
        tipo: "checkbox",
        itens: situacoes.map((s) => ({ id: s.chave, rotulo: s.rotulo })),
      })
    }

    // UF sai dos proprios dados: nao ha cadastro de estados, e listar as 27
    // quando a incubadora atende duas seria um grupo de rolagem inutil.
    const ufs = [...new Set(startups.map((s) => s.uf).filter(Boolean))].sort()
    if (ufs.length > 1) {
      grupos.push({
        id: "uf",
        rotulo: "UF",
        tipo: "checkbox",
        itens: ufs.map((uf) => ({ id: uf, rotulo: uf })),
      })
    }

    grupos.push({ id: "criado", rotulo: "Data de cadastro", tipo: "data" })

    campos.forEach((campo) => {
      const grupo = grupoFiltroCampoExtra(campo)
      if (grupo) grupos.push(grupo)
    })

    return grupos
  }, [fases, tipos, situacoes, campos, startups])

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    // O CNPJ e guardado sem mascara: comparar so os digitos faz a busca
    // funcionar tanto com "12.345" quanto com "12345".
    const termoDigitos = somenteDigitos(termo)

    return startups.filter((s) => {
      if (termo) {
        const casaNome = s.nome.toLowerCase().includes(termo)
        const casaEmail = (s.email || "").toLowerCase().includes(termo)
        const casaCnpj = termoDigitos && (s.cnpj || "").includes(termoDigitos)
        if (!casaNome && !casaEmail && !casaCnpj) return false
      }

      const fasesSel = filtros.fase || []
      if (fasesSel.length && !fasesSel.includes(faseDaStartup(s))) return false

      const tiposSel = filtros.tipo || []
      if (tiposSel.length && !tiposSel.includes(s.tipo)) return false

      const situacoesSel = filtros.situacao || []
      if (situacoesSel.length && !situacoesSel.includes(s.situacao)) return false

      const ufsSel = filtros.uf || []
      if (ufsSel.length && !ufsSel.includes(s.uf)) return false

      // O <input type="date"> devolve YYYY-MM-DD e o timestamp comeca do mesmo
      // jeito: comparar os dez primeiros caracteres compara as datas sem
      // arrastar fuso horario para dentro do filtro.
      const periodo = filtros.criado
      if (periodo?.de || periodo?.ate) {
        const dia = (s.criado_ts || "").slice(0, 10)
        if (!dia) return false
        if (periodo.de && dia < periodo.de) return false
        if (periodo.ate && dia > periodo.ate) return false
      }

      return campos.every((campo) => {
        const selecao = filtros[PREFIXO_FILTRO_EXTRA + campo.chave]
        return casaFiltroCampoExtra(campo, (s.campos_extras || {})[campo.chave], selecao)
      })
    })
  }, [startups, busca, filtros, campos])

  // ------------------------------------------------------------- acoes
  const abrirCadastro = () => {
    setStartupEditando(null)
    setDrawerAberto(true)
  }

  /**
   * Editar exige o cadastro COMPLETO: a listagem nao traz os contatos, e abrir
   * o painel com o que a linha tem faria o salvar apagar a lista de contatos.
   */
  const editarStartup = async (linha) => {
    try {
      const { data } = await api.get(`/startups/${linha.id_startup}`)
      setStartupEditando(data.startup)
      setDrawerAberto(true)
    } catch (err) {
      setAviso({
        tipo: "error",
        texto: err.response?.data?.erro || "Erro ao abrir o cadastro da startup.",
      })
    }
  }

  /**
   * Status em massa.
   *
   * Uma chamada por startup, e nao um endpoint de lote: PATCH /:id/situacao ja
   * existe e e ele quem deriva o `status` do ciclo da situacao (ver
   * startupRepository). O que falha e reportado — mudar 8 de 10 e dizer "pronto"
   * seria pior do que nao ter o botao.
   */
  const aplicarSituacaoEmMassa = async ({ situacao }) => {
    if (!situacao) return
    setAplicandoMassa(true)
    const resultados = await Promise.allSettled(
      selecionados.map((id) => api.patch(`/startups/${id}/situacao`, { situacao }))
    )
    const falhas = resultados.filter((r) => r.status === "rejected")
    setAplicandoMassa(false)
    setAncoraMassa(null)

    if (falhas.length === 0) {
      const rotulo = situacoes.find((s) => s.chave === situacao)?.rotulo || situacao
      setAviso({
        tipo: "success",
        texto: `${selecionados.length} startup${selecionados.length > 1 ? "s" : ""} marcada${
          selecionados.length > 1 ? "s" : ""
        } como "${rotulo}".`,
      })
      setSelecionados([])
    } else {
      setAviso({
        tipo: falhas.length === resultados.length ? "error" : "warning",
        texto:
          falhas[0].reason?.response?.data?.erro ||
          `Nao foi possivel alterar o status de ${falhas.length} de ${resultados.length} startups.`,
      })
    }
    carregar()
  }

  const totalFiltros = contarFiltros(filtros)

  return (
    <AppLayout>
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <RocketLaunch sx={{ color: "primary.main" }} />
            <Typography variant="h4" fontWeight={700}>
              Startups
            </Typography>
          </Box>
          <Button
            data-tour="startups-nova"
            variant="contained"
            startIcon={<Add />}
            onClick={abrirCadastro}
          >
            Nova Startup
          </Button>
        </Box>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Acompanhe todas as startups incubadas e o progresso de cada uma na trilha.
        </Typography>

        {aviso && (
          <Alert severity={aviso.tipo} sx={{ mb: 3 }} onClose={() => setAviso(null)}>
            {aviso.texto}
          </Alert>
        )}

        <Paper data-tour="startups-lista" sx={{ borderRadius: 0 }}>
          <ToolbarTabela
            busca={busca}
            onBuscaChange={setBusca}
            placeholderBusca="Pesquisar por nome, CNPJ ou e-mail..."
            propsBusca={{ "data-tour": "startups-busca" }}
            totalFiltros={totalFiltros}
            onAbrirFiltros={() => setPainelAberto(true)}
            propsBotaoFiltro={{ "data-tour": "startups-filtros" }}
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
                ? () => exportarTabelaCsv("startups", colunas, colunasVisiveis, filtradas)
                : undefined
            }
          />

          <TabelaDados
            dados={filtradas}
            colunas={colunas}
            chaveId="id_startup"
            chaveStorage="startups"
            ordemInicial="nome"
            carregando={carregando}
            mensagemVazio="Nenhuma startup encontrada."
            onClickLinha={(s) => navigate(`/startups/${s.uuid}`)}
            onColunasVisiveisChange={setColunasVisiveis}
            selecionavel={podeEditar}
            selecionados={selecionados}
            onSelecionadosChange={setSelecionados}
            larguraAcoes={56}
            acoes={
              podeEditar
                ? [
                    {
                      rotulo: "Editar cadastro",
                      icone: <EditOutlined fontSize="small" />,
                      onClick: editarStartup,
                    },
                  ]
                : undefined
            }
          />
        </Paper>
      </Box>

      <PainelFiltros
        aberto={painelAberto}
        onFechar={() => setPainelAberto(false)}
        titulo="Filtrar startups"
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
            opcoes: situacoes.map((s) => ({ valor: s.chave, rotulo: s.rotulo })),
          },
        ]}
        onAplicar={aplicarSituacaoEmMassa}
      />

      <DrawerCadastroStartup
        aberto={drawerAberto}
        onFechar={() => setDrawerAberto(false)}
        idTenant={idTenant}
        startup={startupEditando}
        trilhas={trilhas}
        onSalvo={carregar}
      />
    </AppLayout>
  )
}
