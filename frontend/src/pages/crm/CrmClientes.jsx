/**
 * Clientes: a carteira da startup, na TabelaDados do sistema (ordenacao,
 * paginacao, colunas configuraveis, exportacao). Busca por nome, e-mail,
 * empresa ou documento; filtros por status, tipo de pessoa e origem.
 *
 * `?novo=1` abre o cadastro (o atalho do painel).
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Alert, Box, Button, Link, Paper, Tooltip, Typography } from "@mui/material"
import { Add, Business, PeopleOutline, Person, SearchOff, WhatsApp } from "@mui/icons-material"
import { useCrm } from "../../components/crm/useCrm"
import DrawerCliente from "../../components/crm/DrawerCliente"
import { StatusCliente } from "../../components/crm/MarcadoresCrm"
import TabelaDados from "../../components/tabela/TabelaDados"
import ToolbarTabela from "../../components/tabela/ToolbarTabela"
import PainelFiltros, { contarFiltros } from "../../components/tabela/PainelFiltros"
import { exportarTabelaCsv } from "../../components/tabela/exportarTabela"
import { STATUS_CLIENTE, TIPO_PESSOA, formatarDocumento, formatarTelefone, linkWhatsapp, moeda } from "../../data/crmMeta"

const normalizar = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

export default function CrmClientes() {
  const { api, falha } = useCrm()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  const [clientes, setClientes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [busca, setBusca] = useState("")
  const [filtros, setFiltros] = useState({})
  const [painelAberto, setPainelAberto] = useState(false)
  const [drawerAberto, setDrawerAberto] = useState(false)
  const [colunasVisiveis, setColunasVisiveis] = useState([])

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      setClientes(await api.clientes())
      setErro(null)
    } catch (err) {
      setErro(falha(err, "Não foi possível carregar os clientes."))
    } finally {
      setCarregando(false)
    }
  }, [api, falha])

  useEffect(() => {
    carregar()
  }, [carregar])

  useEffect(() => {
    if (params.get("novo")) {
      setDrawerAberto(true)
      setParams({}, { replace: true })
    }
  }, [params, setParams])

  const colunas = useMemo(
    () => [
      {
        chave: "nome",
        rotulo: "Cliente",
        obrigatoria: true,
        largura: 280,
        valorTexto: (c) => c.nome,
        render: (c) => {
          const Icone = c.tipo_pessoa === "PJ" ? Business : Person
          const sub = c.tipo_pessoa === "PF" ? [c.cargo, c.empresa].filter(Boolean).join(" · ") : ""
          return (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
              <Icone sx={{ fontSize: 18, color: "text.secondary", flexShrink: 0 }} aria-hidden />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" fontWeight={600} noWrap>
                  {c.nome}
                </Typography>
                {sub && (
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                    {sub}
                  </Typography>
                )}
              </Box>
            </Box>
          )
        },
      },
      {
        chave: "tipo_pessoa",
        rotulo: "Tipo",
        largura: 140,
        valorTexto: (c) => TIPO_PESSOA[c.tipo_pessoa]?.rotulo || "",
        render: (c) => TIPO_PESSOA[c.tipo_pessoa]?.rotulo,
      },
      {
        chave: "email",
        rotulo: "E-mail",
        largura: 220,
        valorTexto: (c) => c.email || "",
        render: (c) =>
          c.email ? (
            <Link href={`mailto:${c.email}`} underline="hover" onClick={(e) => e.stopPropagation()} noWrap sx={{ display: "block" }}>
              {c.email}
            </Link>
          ) : (
            "—"
          ),
      },
      {
        chave: "telefone",
        rotulo: "Telefone",
        largura: 170,
        valorTexto: (c) => formatarTelefone(c.telefone || c.whatsapp) || "",
        render: (c) => (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <span>{formatarTelefone(c.telefone || c.whatsapp) || "—"}</span>
            {c.whatsapp && (
              <Tooltip title={`WhatsApp ${formatarTelefone(c.whatsapp)}`}>
                <Link
                  href={linkWhatsapp(c.whatsapp)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Abrir conversa no WhatsApp com ${c.nome}`}
                  sx={{ display: "inline-flex", color: "success.main" }}
                >
                  <WhatsApp sx={{ fontSize: 17 }} />
                </Link>
              </Tooltip>
            )}
          </Box>
        ),
      },
      {
        chave: "empresa",
        rotulo: "Empresa",
        largura: 170,
        valorTexto: (c) => (c.tipo_pessoa === "PF" ? c.empresa || "" : ""),
        render: (c) => (c.tipo_pessoa === "PF" ? c.empresa || "—" : "—"),
      },
      { chave: "origem", rotulo: "Origem", largura: 140, valorTexto: (c) => c.origem || "", render: (c) => c.origem || "—" },
      {
        chave: "status",
        rotulo: "Status",
        largura: 140,
        valorOrdenacao: (c) => ["LEAD", "ATIVO", "INATIVO"].indexOf(c.status),
        valorTexto: (c) => STATUS_CLIENTE[c.status]?.rotulo || "",
        render: (c) => <StatusCliente status={c.status} />,
      },
      {
        chave: "oportunidades_abertas",
        rotulo: "Em negociação",
        largura: 150,
        alinhamento: "right",
        ajuda: "Oportunidades abertas e o valor estimado delas.",
        valorOrdenacao: (c) => c.valor_em_aberto,
        valorTexto: (c) => String(c.oportunidades_abertas),
        render: (c) =>
          c.oportunidades_abertas ? (
            <Box>
              <Typography variant="body2">{c.oportunidades_abertas}</Typography>
              <Typography variant="caption" color="text.secondary">
                {moeda(c.valor_em_aberto)}
              </Typography>
            </Box>
          ) : (
            "—"
          ),
      },
      {
        chave: "documento",
        rotulo: "CPF/CNPJ",
        visivelPadrao: false,
        largura: 170,
        valorTexto: (c) => formatarDocumento(c.documento),
        render: (c) => formatarDocumento(c.documento) || "—",
      },
      {
        chave: "criado_ts",
        rotulo: "Cadastrado em",
        largura: 140,
        valorOrdenacao: (c) => c.criado_ts,
        valorTexto: (c) => new Date(c.criado_ts).toLocaleDateString("pt-BR"),
        render: (c) => new Date(c.criado_ts).toLocaleDateString("pt-BR"),
      },
    ],
    []
  )

  const gruposFiltro = useMemo(() => {
    const grupos = [
      { id: "status", rotulo: "Status", tipo: "checkbox", itens: Object.entries(STATUS_CLIENTE).map(([id, m]) => ({ id, rotulo: m.rotulo })) },
      { id: "tipo", rotulo: "Tipo de pessoa", tipo: "checkbox", itens: Object.entries(TIPO_PESSOA).map(([id, m]) => ({ id, rotulo: m.rotulo })) },
    ]
    const origens = [...new Set(clientes.map((c) => c.origem).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"))
    if (origens.length) grupos.push({ id: "origem", rotulo: "Origem", tipo: "checkbox", itens: origens.map((o) => ({ id: o, rotulo: o })) })
    grupos.push({ id: "cadastro", rotulo: "Data de cadastro", tipo: "data" })
    return grupos
  }, [clientes])

  const filtrados = useMemo(() => {
    const termo = normalizar(busca.trim())
    const termoDigitos = busca.replace(/\D/g, "")
    const marcados = (id) => filtros[id] || []
    const periodo = filtros.cadastro || {}
    return clientes.filter((c) => {
      if (termo) {
        const texto = normalizar(`${c.nome} ${c.email || ""} ${c.empresa || ""}`)
        const porDoc = termoDigitos.length >= 3 && (c.documento || "").includes(termoDigitos)
        if (!texto.includes(termo) && !porDoc) return false
      }
      if (marcados("status").length && !marcados("status").includes(c.status)) return false
      if (marcados("tipo").length && !marcados("tipo").includes(c.tipo_pessoa)) return false
      if (marcados("origem").length && !marcados("origem").includes(c.origem)) return false
      const dia = new Date(c.criado_ts).toLocaleDateString("en-CA")
      if (periodo.de && dia < periodo.de) return false
      if (periodo.ate && dia > periodo.ate) return false
      return true
    })
  }, [clientes, busca, filtros])

  const totalFiltros = contarFiltros(filtros)
  const filtrando = Boolean(busca.trim() || totalFiltros)

  const vazio = filtrando ? (
    <Box sx={{ py: 2 }}>
      <SearchOff sx={{ fontSize: 32, color: "text.disabled" }} aria-hidden />
      <Typography fontWeight={700} color="text.primary" sx={{ mt: 0.5 }}>
        Nenhum cliente corresponde aos filtros
      </Typography>
      <Button size="small" variant="outlined" sx={{ mt: 1.5 }} onClick={() => { setBusca(""); setFiltros({}) }}>
        Limpar filtros
      </Button>
    </Box>
  ) : (
    <Box sx={{ py: 2, maxWidth: 440, mx: "auto" }}>
      <PeopleOutline sx={{ fontSize: 36, color: "text.disabled" }} aria-hidden />
      <Typography fontWeight={700} color="text.primary" sx={{ mt: 0.5 }}>
        Nenhum cliente cadastrado
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
        Cadastre as pessoas e empresas com quem a startup negocia. Cada cliente pode ter várias oportunidades — ou
        nenhuma, enquanto for só um contato.
      </Typography>
      <Button size="small" variant="contained" startIcon={<Add />} onClick={() => setDrawerAberto(true)}>
        Novo cliente
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
      <Paper sx={{ borderRadius: 0 }}>
        <ToolbarTabela
          busca={busca}
          onBuscaChange={setBusca}
          placeholderBusca="Pesquisar por nome, e-mail, empresa ou documento..."
          totalFiltros={totalFiltros}
          onAbrirFiltros={() => setPainelAberto(true)}
          onExportar={() => exportarTabelaCsv("clientes", colunas, colunasVisiveis, filtrados)}
          acoes={
            <Button variant="contained" size="small" startIcon={<Add />} onClick={() => setDrawerAberto(true)}>
              Novo cliente
            </Button>
          }
        />
        <TabelaDados
          dados={filtrados}
          colunas={colunas}
          chaveId="id_cliente"
          chaveStorage="crm.clientes"
          ordemInicial="nome"
          carregando={carregando && clientes.length === 0}
          mensagemVazio={vazio}
          onClickLinha={(c) => navigate(`/crm/clientes/${c.id_cliente}`)}
          onColunasVisiveisChange={setColunasVisiveis}
          larguraMinima={1100}
        />
      </Paper>

      <PainelFiltros
        aberto={painelAberto}
        onFechar={() => setPainelAberto(false)}
        titulo="Filtrar clientes"
        grupos={gruposFiltro}
        selecionados={filtros}
        onAplicar={setFiltros}
        onLimpar={() => setFiltros({})}
      />

      <DrawerCliente
        aberto={drawerAberto}
        onFechar={() => setDrawerAberto(false)}
        onSalvo={(c) => navigate(`/crm/clientes/${c.id_cliente}`)}
      />
    </Box>
  )
}
