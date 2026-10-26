/**
 * Aba "Materiais compartilhados": tudo o que o mentor entregou, e o que as
 * startups que ele acompanha receberam de outros mentores.
 *
 * As duas coisas juntas de proposito: quem acompanha a mesma startup que um
 * colega precisa saber o que ela ja recebeu, para nao mandar o mesmo modelo
 * duas vezes ou um contraditorio. O filtro "Autoria" separa quando a pergunta
 * e so "o que EU mandei". Editar e remover continuam so do autor.
 *
 * A coluna Situacao diz se a startup ainda ve o material (ver
 * SITUACOES em data/espacoMentorMeta.js).
 */
import { useMemo, useState } from "react"
import { Box, Chip, Paper, Tooltip, Typography } from "@mui/material"
import { VisibilityOutlined, EditOutlined, DeleteOutline } from "@mui/icons-material"
import TabelaDados from "../tabela/TabelaDados"
import ToolbarTabela from "../tabela/ToolbarTabela"
import PainelFiltros, { contarFiltros } from "../tabela/PainelFiltros"
import { exportarTabelaCsv } from "../tabela/exportarTabela"
import EmptyState from "../programa/EmptyState"
import IconeFormato from "./IconeFormato"
import { useCompartilhamentos } from "../../hooks/useEspacoMentor"
import {
  FINALIDADES,
  SITUACOES,
  dataBR,
  filtrarCompartilhamentos,
  rotuloEtapa,
} from "../../data/espacoMentorMeta"

/** Os valores distintos de um campo, para montar um grupo de filtro. */
function distintos(lista, id, rotulo) {
  const mapa = new Map()
  for (const item of lista) if (!mapa.has(item[id])) mapa.set(item[id], item[rotulo])
  return [...mapa].map(([chave, texto]) => ({ id: chave, rotulo: texto })).sort((a, b) => a.rotulo.localeCompare(b.rotulo))
}

export default function AbaCompartilhados({ idTenant, versao, onAbrir, onEditar, onRemover }) {
  const { compartilhamentos, carregando, erro } = useCompartilhamentos({ idTenant, versao })

  const [busca, setBusca] = useState("")
  const [filtros, setFiltros] = useState({})
  const [painelAberto, setPainelAberto] = useState(false)
  const [colunasVisiveis, setColunasVisiveis] = useState([])

  const filtrados = useMemo(
    () =>
      filtrarCompartilhamentos(compartilhamentos, {
        busca,
        startups: filtros.startup,
        trilhas: filtros.trilha,
        finalidades: filtros.finalidade,
        origens: filtros.origem,
        situacoes: filtros.situacao,
        autoria: filtros.autoria,
      }),
    [compartilhamentos, busca, filtros]
  )

  const gruposFiltro = useMemo(
    () => [
      { id: "startup", rotulo: "Startup", tipo: "checkbox", itens: distintos(compartilhamentos, "id_startup", "startup_nome") },
      { id: "trilha", rotulo: "Trilha", tipo: "checkbox", itens: distintos(compartilhamentos, "id_programa", "programa_nome") },
      {
        id: "finalidade",
        rotulo: "Finalidade",
        tipo: "checkbox",
        itens: Object.entries(FINALIDADES).map(([id, f]) => ({ id, rotulo: f.rotulo })),
      },
      {
        id: "origem",
        rotulo: "Origem do material",
        tipo: "checkbox",
        itens: [
          { id: "PESSOAL", rotulo: "Biblioteca pessoal" },
          { id: "INSTITUCIONAL", rotulo: "Biblioteca da incubadora" },
        ],
      },
      {
        id: "situacao",
        rotulo: "Situação",
        tipo: "checkbox",
        itens: Object.entries(SITUACOES).map(([id, s]) => ({ id, rotulo: s.rotulo })),
      },
      {
        id: "autoria",
        rotulo: "Autoria",
        tipo: "radio",
        itens: [
          { id: "MEUS", rotulo: "Compartilhados por mim" },
          { id: "OUTROS", rotulo: "Por outros mentores" },
        ],
      },
    ],
    [compartilhamentos]
  )

  const colunas = [
    {
      chave: "titulo",
      rotulo: "Material",
      obrigatoria: true,
      largura: 300,
      valorTexto: (c) => c.titulo,
      render: (c) => (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
          <IconeFormato item={c} tamanho={28} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
              {c.titulo}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {c.origem === "INSTITUCIONAL" ? "Biblioteca da incubadora" : "Biblioteca pessoal"}
              {c.material_arquivado ? " · arquivado" : ""}
            </Typography>
          </Box>
        </Box>
      ),
    },
    {
      chave: "startup_nome",
      rotulo: "Empreendimento",
      render: (c) => <Typography variant="body2">{c.startup_nome}</Typography>,
    },
    {
      chave: "etapa",
      rotulo: "Trilha e etapa",
      valorOrdenacao: (c) => `${c.programa_nome} ${rotuloEtapa(c)}`,
      valorTexto: (c) => `${c.programa_nome} › ${rotuloEtapa(c)}`,
      render: (c) => (
        <Box>
          <Typography variant="body2">{rotuloEtapa(c)}</Typography>
          <Typography variant="caption" color="text.secondary">
            {c.programa_nome}
          </Typography>
        </Box>
      ),
    },
    {
      chave: "finalidade",
      rotulo: "Finalidade",
      valorTexto: (c) => FINALIDADES[c.finalidade]?.rotulo,
      render: (c) => {
        const f = FINALIDADES[c.finalidade]
        return f ? (
          <Chip size="small" label={f.rotulo} sx={{ fontWeight: 700, bgcolor: `${f.cor}1f`, color: f.cor }} />
        ) : null
      },
    },
    {
      chave: "criado_ts",
      rotulo: "Disponibilizado em",
      valorOrdenacao: (c) => c.criado_ts,
      valorTexto: (c) => dataBR(c.criado_ts),
      render: (c) => <Typography variant="body2">{dataBR(c.criado_ts)}</Typography>,
    },
    {
      chave: "autor",
      rotulo: "Autor",
      valorOrdenacao: (c) => c.compartilhado_por_nome || "",
      valorTexto: (c) => c.compartilhado_por_nome || "",
      render: (c) => (
        <Typography variant="body2" sx={{ fontWeight: c.meu ? 600 : 400 }}>
          {c.meu ? "Você" : c.compartilhado_por_nome || "—"}
        </Typography>
      ),
    },
    {
      chave: "orientacao",
      rotulo: "Orientação",
      ordenavel: false,
      largura: 260,
      valorTexto: (c) => c.orientacao || "",
      render: (c) =>
        c.orientacao ? (
          <Tooltip title={<Box sx={{ whiteSpace: "pre-wrap" }}>{c.orientacao}</Box>} arrow>
            <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 260, fontStyle: "italic" }}>
              {c.orientacao}
            </Typography>
          </Tooltip>
        ) : (
          <Typography variant="body2" color="text.disabled">
            —
          </Typography>
        ),
    },
    {
      chave: "situacao",
      rotulo: "Situação",
      ajuda: "Se a startup ainda vê o material, e onde.",
      valorTexto: (c) => SITUACOES[c.situacao]?.rotulo,
      render: (c) => {
        const s = SITUACOES[c.situacao]
        return s ? (
          <Tooltip title={s.ajuda} arrow>
            <Chip size="small" label={s.rotulo} sx={{ fontWeight: 700, bgcolor: `${s.cor}1f`, color: s.cor }} />
          </Tooltip>
        ) : null
      },
    },
  ]

  if (!carregando && !erro && compartilhamentos.length === 0) {
    return (
      <Paper variant="outlined" sx={{ py: 2 }}>
        <EmptyState
          variante="selecao"
          titulo="Nenhum material compartilhado ainda"
          descricao="Em “Meus incubados”, escolha uma startup e um ponto da trilha dela para entregar um material, da sua biblioteca ou da biblioteca da incubadora."
        />
      </Paper>
    )
  }

  return (
    <Box>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        O que você entregou às startups e o que elas receberam de outros mentores que as acompanham.
      </Typography>
      {erro && (
        <Typography color="error" sx={{ mb: 2 }}>
          {erro}
        </Typography>
      )}
      <Paper variant="outlined" sx={{ borderRadius: 0 }}>
        <ToolbarTabela
          busca={busca}
          onBuscaChange={setBusca}
          placeholderBusca="Pesquisar por material, startup ou orientação..."
          totalFiltros={contarFiltros(filtros)}
          onAbrirFiltros={() => setPainelAberto(true)}
          onExportar={() =>
            exportarTabelaCsv("materiais-compartilhados", colunas, colunasVisiveis, filtrados)
          }
        />
        <TabelaDados
          dados={filtrados}
          colunas={colunas}
          chaveId="id_compartilhamento"
          chaveStorage="espaco-mentor.compartilhados"
          ordemInicial="criado_ts"
          direcaoInicial="desc"
          carregando={carregando}
          mensagemVazio="Nenhum compartilhamento encontrado com esta busca ou estes filtros."
          onClickLinha={onAbrir}
          onColunasVisiveisChange={setColunasVisiveis}
          larguraAcoes={124}
          acoes={[
            { rotulo: "Ver material", icone: <VisibilityOutlined fontSize="small" />, onClick: onAbrir },
            {
              rotulo: "Editar orientação",
              icone: <EditOutlined fontSize="small" />,
              onClick: onEditar,
              desabilitada: (c) => !c.meu || !c.acompanha,
            },
            {
              rotulo: "Remover da startup",
              icone: <DeleteOutline fontSize="small" />,
              onClick: onRemover,
              desabilitada: (c) => !c.meu,
              cor: "error.main",
            },
          ]}
        />
      </Paper>

      <PainelFiltros
        aberto={painelAberto}
        onFechar={() => setPainelAberto(false)}
        titulo="Filtrar compartilhamentos"
        grupos={gruposFiltro}
        selecionados={filtros}
        onAplicar={setFiltros}
        onLimpar={() => setFiltros({})}
      />
    </Box>
  )
}
