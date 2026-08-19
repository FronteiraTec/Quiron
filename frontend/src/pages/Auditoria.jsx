/**
 * Subpagina de Configuracoes: auditoria da incubadora selecionada no
 * ConfiguracoesLayout.
 *
 * Registra quem fez o que e quando. Fica em Configuracoes, e nao em
 * Relatorios, porque nao e material de gestao do programa: e o registro de
 * conformidade que se consulta quando ha uma pergunta especifica ("quem
 * apagou este passo?"), ao lado das demais chaves administrativas.
 *
 * Usa a TabelaDados como as demais listagens. Aqui a paginacao e o que mais
 * pesa: sao ate 300 registros, e a tela desenhava os 300 de uma vez.
 *
 * Endpoint: GET /auditlogs?id_tenant=&limite=
 */
import { useEffect, useMemo, useState } from "react"
import { useOutletContext } from "react-router-dom"
import { Alert, Box, Chip, Paper, Typography } from "@mui/material"
import api from "../services/api"
import TabelaDados from "../components/tabela/TabelaDados"
import ToolbarTabela from "../components/tabela/ToolbarTabela"
import PainelFiltros, { contarFiltros } from "../components/tabela/PainelFiltros"
import { exportarTabelaCsv } from "../components/tabela/exportarTabela"

// Quantos registros trazer. A auditoria cresce sem parar; sem um teto a tela
// tentaria desenhar o historico inteiro da incubadora.
const LIMITE = 300

// Cor por tipo de acao: destrutivo se destaca, leitura/criacao ficam neutras.
const COR_ACAO = { EXCLUIR: "error", DELETE: "error", REMOVER: "error", CRIAR: "success", ATUALIZAR: "info" }

const dataHora = (ts) => (ts ? new Date(ts).toLocaleString("pt-BR") : "")

export default function Auditoria() {
  const { idTenant } = useOutletContext()

  const [logs, setLogs] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState(null)

  const [busca, setBusca] = useState("")
  const [filtros, setFiltros] = useState({})
  const [painelAberto, setPainelAberto] = useState(false)
  const [colunasVisiveis, setColunasVisiveis] = useState([])

  useEffect(() => {
    if (!idTenant) return
    setCarregando(true)
    setErro(null)
    api
      .get("/auditlogs", { params: { id_tenant: idTenant, limite: LIMITE } })
      .then(({ data }) => setLogs(data.logs))
      .catch((err) => {
        setLogs([])
        setErro(err.response?.data?.erro || "Erro ao carregar a auditoria.")
      })
      .finally(() => setCarregando(false))
  }, [idTenant])

  const colunas = useMemo(
    () => [
      {
        chave: "criado_ts",
        rotulo: "Quando",
        obrigatoria: true,
        largura: 170,
        alinhamento: "right",
        valorOrdenacao: (l) => l.criado_ts,
        valorTexto: (l) => dataHora(l.criado_ts),
        render: (l) => dataHora(l.criado_ts),
      },
      {
        chave: "acao",
        rotulo: "Ação",
        largura: 140,
        valorTexto: (l) => l.acao || "",
        render: (l) => (
          <Chip
            size="small"
            label={l.acao}
            color={COR_ACAO[String(l.acao).toUpperCase()] || "default"}
            variant="outlined"
          />
        ),
      },
      {
        chave: "entidade",
        rotulo: "Entidade",
        largura: 200,
        valorTexto: (l) => [l.entidade, l.entidade_id && `#${l.entidade_id}`].filter(Boolean).join(" "),
        render: (l) => (
          <>
            {l.entidade}
            {l.entidade_id && (
              <Typography component="span" variant="caption" color="text.secondary">
                {" "}
                #{l.entidade_id}
              </Typography>
            )}
          </>
        ),
      },
      { chave: "descricao", rotulo: "Descrição", valorTexto: (l) => l.descricao || "" },
    ],
    []
  )

  // As entidades e as acoes do filtro saem dos proprios registros: os dois
  // catalogos crescem junto com o sistema sem precisar ser mantidos a mao aqui.
  const grupos = useMemo(() => {
    const lista = (campo) => [...new Set(logs.map((l) => l[campo]).filter(Boolean))].sort()
    return [
      {
        id: "entidade",
        rotulo: "Entidade",
        tipo: "checkbox",
        itens: lista("entidade").map((e) => ({ id: e, rotulo: e })),
      },
      {
        id: "acao",
        rotulo: "Ação",
        tipo: "checkbox",
        itens: lista("acao").map((a) => ({ id: a, rotulo: a })),
      },
      { id: "quando", rotulo: "Período", tipo: "data" },
    ]
  }, [logs])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return logs.filter((l) => {
      const entidades = filtros.entidade || []
      if (entidades.length && !entidades.includes(l.entidade)) return false

      const acoes = filtros.acao || []
      if (acoes.length && !acoes.includes(l.acao)) return false

      const periodo = filtros.quando
      if (periodo?.de || periodo?.ate) {
        const dia = (l.criado_ts || "").slice(0, 10)
        if (!dia) return false
        if (periodo.de && dia < periodo.de) return false
        if (periodo.ate && dia > periodo.ate) return false
      }

      if (!termo) return true
      return [l.acao, l.entidade, l.entidade_id, l.descricao]
        .filter(Boolean)
        .some((campo) => String(campo).toLowerCase().includes(termo))
    })
  }, [logs, busca, filtros])

  return (
    <>
      {erro && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {erro}
        </Alert>
      )}

      <Paper data-tour="auditoria-tabela" sx={{ borderRadius: 0 }}>
        <ToolbarTabela
          busca={busca}
          onBuscaChange={setBusca}
          placeholderBusca="Buscar por ação, entidade ou descrição..."
          propsBusca={{ "data-tour": "auditoria-busca" }}
          totalFiltros={contarFiltros(filtros)}
          onAbrirFiltros={() => setPainelAberto(true)}
          propsBotaoFiltro={{ "data-tour": "auditoria-entidade" }}
          onExportar={() => exportarTabelaCsv("auditoria", colunas, colunasVisiveis, filtrados)}
        />

        <TabelaDados
          dados={filtrados}
          colunas={colunas}
          chaveId="id_log"
          chaveStorage="auditoria"
          // O registro mais recente e o que se procura em nove de cada dez
          // consultas — a lista ja vem assim do backend, e a tabela mantem.
          ordemInicial="criado_ts"
          direcaoInicial="desc"
          carregando={carregando}
          larguraMinima={760}
          mensagemVazio={
            logs.length === 0
              ? "Nenhuma ação registrada nesta incubadora ainda."
              : "Nenhum registro corresponde ao filtro."
          }
          onColunasVisiveisChange={setColunasVisiveis}
        />

        {logs.length === LIMITE && (
          <Box sx={{ px: 2, pb: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Limitado aos {LIMITE} registros mais recentes.
            </Typography>
          </Box>
        )}
      </Paper>

      <PainelFiltros
        aberto={painelAberto}
        onFechar={() => setPainelAberto(false)}
        titulo="Filtrar auditoria"
        grupos={grupos}
        selecionados={filtros}
        onAplicar={setFiltros}
        onLimpar={() => setFiltros({})}
      />
    </>
  )
}
