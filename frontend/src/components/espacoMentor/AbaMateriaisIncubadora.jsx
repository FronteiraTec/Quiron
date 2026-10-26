/**
 * Aba "Materiais da incubadora": o que a coordenacao disponibiliza aos
 * mentores — o guia do mentor, a rubrica de avaliacao, o modelo de relatorio
 * de mentoria (migracao 021).
 *
 * DUAS LEITURAS DA MESMA LISTA, decididas pelas chaves de
 * `mentoria.materiais_incubadora`:
 *   o MENTOR (visualizar) consulta, busca e abre;
 *   a COORDENACAO (criar/editar/excluir) publica, troca o arquivo, arquiva e
 *   exclui — e ve tambem o arquivado, que para o mentor saiu de cena.
 *
 * So quem mentora ve esta lista: as startups nao (o backend recusa). O que e
 * para a startup mora na Biblioteca.
 */
import { useMemo, useState } from "react"
import { Box, Button, Chip, Paper, Typography } from "@mui/material"
import { Add, OpenInNew, EditOutlined, DeleteOutline } from "@mui/icons-material"
import TabelaDados from "../tabela/TabelaDados"
import ToolbarTabela from "../tabela/ToolbarTabela"
import PainelFiltros, { contarFiltros } from "../tabela/PainelFiltros"
import ConfirmDialog from "../programa/ConfirmDialog"
import EmptyState from "../programa/EmptyState"
import IconeFormato from "./IconeFormato"
import DrawerMaterial from "./DrawerMaterial"
import { abrirMaterial } from "./abrirMaterial"
import {
  erroDe,
  materiaisIncubadora,
  urlArquivoDoMaterialIncubadora,
  useMateriaisIncubadora,
} from "../../hooks/useEspacoMentor"
import {
  FORMATOS,
  dataBR,
  filtrarMateriais,
  formatoDoMaterial,
  publicadoHaPouco,
} from "../../data/espacoMentorMeta"
import { formatarTamanho } from "../../services/arquivos"

const FORMATOS_ARQUIVO = ["PDF", "DOCUMENTO", "PLANILHA", "APRESENTACAO", "IMAGEM", "LINK", "ARQUIVO"]

export default function AbaMateriaisIncubadora({
  idTenant,
  versao,
  podeCriar,
  podeEditar,
  podeExcluir,
  onMudou,
  onAviso,
}) {
  const lista = useMateriaisIncubadora({ idTenant, versao })

  const [busca, setBusca] = useState("")
  const [filtros, setFiltros] = useState({})
  const [painelAberto, setPainelAberto] = useState(false)
  const [drawer, setDrawer] = useState(null) // { material } — material null = novo
  const [aExcluir, setAExcluir] = useState(null)

  const filtrados = useMemo(
    () =>
      filtrarMateriais(lista.materiais, {
        busca,
        categorias: filtros.categoria,
        formatos: filtros.formato,
        situacao: filtros.situacao,
      }),
    [lista.materiais, busca, filtros]
  )

  const gruposFiltro = useMemo(
    () => [
      // Arquivado so chega para quem pode editar; para o mentor o grupo nem aparece.
      ...(podeEditar
        ? [
            {
              id: "situacao",
              rotulo: "Situação",
              tipo: "radio",
              itens: [
                { id: "ARQUIVADOS", rotulo: "Arquivados (fora da vista dos mentores)" },
                { id: "TODOS", rotulo: "Publicados e arquivados" },
              ],
            },
          ]
        : []),
      {
        id: "categoria",
        rotulo: "Categoria",
        tipo: "checkbox",
        itens: lista.categorias.map((c) => ({ id: c, rotulo: c })),
      },
      {
        id: "formato",
        rotulo: "Tipo de arquivo",
        tipo: "checkbox",
        itens: FORMATOS_ARQUIVO.map((f) => ({ id: f, rotulo: FORMATOS[f].rotulo })),
      },
    ],
    [lista.categorias, podeEditar]
  )

  const abrir = async (material) => {
    try {
      await abrirMaterial({ ...material, arquivo_url: urlArquivoDoMaterialIncubadora(material) })
    } catch (err) {
      onAviso({ texto: err.message, severidade: "error" })
    }
  }

  const salvo = (material, { novo, arquivado } = {}) => {
    setDrawer(null)
    onMudou()
    if (novo) onAviso({ texto: `"${material.titulo}" foi publicado para os mentores.`, severidade: "success" })
    else if (arquivado === true)
      onAviso({ texto: `"${material.titulo}" saiu da vista dos mentores.`, severidade: "info" })
    else if (arquivado === false)
      onAviso({ texto: `"${material.titulo}" voltou para os mentores.`, severidade: "success" })
    else onAviso({ texto: "Material atualizado.", severidade: "success" })
  }

  const excluirConfirmado = async () => {
    const alvo = aExcluir
    setAExcluir(null)
    try {
      await materiaisIncubadora.excluir(alvo.id_material)
      onMudou()
      onAviso({ texto: `"${alvo.titulo}" foi excluído.`, severidade: "info" })
    } catch (err) {
      onAviso({ texto: erroDe(err, "Não foi possível excluir o material."), severidade: "error" })
    }
  }

  const colunas = [
    {
      chave: "titulo",
      rotulo: "Material",
      obrigatoria: true,
      largura: 380,
      valorTexto: (m) => m.titulo,
      render: (m) => (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
          <IconeFormato item={m} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
              {m.titulo}
            </Typography>
            {m.descricao && (
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block", maxWidth: 340 }}>
                {m.descricao}
              </Typography>
            )}
          </Box>
          {m.arquivado ? (
            <Chip size="small" label="Arquivado" sx={{ ml: 0.5 }} />
          ) : (
            publicadoHaPouco(m.criado_ts) && (
              <Chip size="small" color="primary" variant="outlined" label="Novo" sx={{ ml: 0.5, height: 22 }} />
            )
          )}
        </Box>
      ),
    },
    {
      chave: "categoria",
      rotulo: "Categoria",
      valorTexto: (m) => m.categoria || "",
      render: (m) =>
        m.categoria ? (
          <Chip size="small" variant="outlined" label={m.categoria} />
        ) : (
          <Typography variant="body2" color="text.disabled">
            —
          </Typography>
        ),
    },
    {
      chave: "formato",
      rotulo: "Tipo",
      valorOrdenacao: (m) => FORMATOS[formatoDoMaterial(m)].rotulo,
      valorTexto: (m) => FORMATOS[formatoDoMaterial(m)].rotulo,
      render: (m) => (
        <Typography variant="body2">
          {FORMATOS[formatoDoMaterial(m)].rotulo}
          {m.arquivo_tamanho ? (
            <Typography component="span" variant="caption" color="text.secondary">
              {" "}
              · {formatarTamanho(m.arquivo_tamanho)}
            </Typography>
          ) : null}
        </Typography>
      ),
    },
    {
      chave: "criado_ts",
      rotulo: "Publicado",
      valorOrdenacao: (m) => m.criado_ts,
      valorTexto: (m) => `${dataBR(m.criado_ts)} ${m.criado_por_nome || ""}`.trim(),
      render: (m) => (
        <Box>
          <Typography variant="body2">{dataBR(m.criado_ts)}</Typography>
          {m.criado_por_nome && (
            <Typography variant="caption" color="text.secondary">
              por {m.criado_por_nome}
            </Typography>
          )}
        </Box>
      ),
    },
    {
      chave: "atualizado_ts",
      rotulo: "Atualizado em",
      visivelPadrao: false,
      valorOrdenacao: (m) => m.atualizado_ts,
      valorTexto: (m) => dataBR(m.atualizado_ts),
      render: (m) => <Typography variant="body2">{dataBR(m.atualizado_ts)}</Typography>,
    },
  ]

  const acoes = [
    { rotulo: "Abrir", icone: <OpenInNew fontSize="small" />, onClick: abrir },
    ...(podeEditar
      ? [{ rotulo: "Editar", icone: <EditOutlined fontSize="small" />, onClick: (m) => setDrawer({ material: m }) }]
      : []),
    ...(podeExcluir
      ? [{ rotulo: "Excluir", icone: <DeleteOutline fontSize="small" />, onClick: setAExcluir, cor: "error.main" }]
      : []),
  ]

  const vazia = !lista.carregando && !lista.erro && lista.materiais.length === 0

  return (
    <Box>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {podeCriar
          ? "O que a incubadora disponibiliza aos mentores: guias, rubricas de avaliação, modelos. Só quem mentora vê esta lista, as startups não."
          : "O que a incubadora preparou para apoiar a sua mentoria: guias, rubricas de avaliação e modelos."}
      </Typography>

      {lista.erro ? (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography color="error">{lista.erro}</Typography>
          <Button size="small" onClick={lista.recarregar} sx={{ mt: 1, textTransform: "none" }}>
            Tentar de novo
          </Button>
        </Paper>
      ) : vazia ? (
        <Paper variant="outlined" sx={{ py: 2 }}>
          {podeCriar ? (
            <EmptyState
              variante="programa"
              titulo="Nada publicado para os mentores ainda"
              descricao="Publique aqui o que os mentores precisam para mentorar: o guia do mentor, a rubrica de avaliação das entregas, modelos de relatório."
              acaoTexto="Publicar material"
              onAcao={() => setDrawer({ material: null })}
            />
          ) : (
            <EmptyState
              variante="programa"
              titulo="Nenhum material da incubadora por enquanto"
              descricao="Quando a coordenação publicar guias, rubricas ou modelos para a mentoria, eles aparecem aqui."
            />
          )}
        </Paper>
      ) : (
        <Paper variant="outlined" sx={{ borderRadius: 0 }}>
          <ToolbarTabela
            busca={busca}
            onBuscaChange={setBusca}
            placeholderBusca="Pesquisar por título ou descrição..."
            totalFiltros={contarFiltros(filtros)}
            onAbrirFiltros={() => setPainelAberto(true)}
            acoes={
              podeCriar && (
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<Add />}
                  onClick={() => setDrawer({ material: null })}
                  sx={{ textTransform: "none" }}
                >
                  Publicar material
                </Button>
              )
            }
          />
          <TabelaDados
            dados={filtrados}
            colunas={colunas}
            chaveId="id_material"
            chaveStorage="espaco-mentor.incubadora"
            ordemInicial="criado_ts"
            direcaoInicial="desc"
            carregando={lista.carregando}
            mensagemVazio={
              filtros.situacao === "ARQUIVADOS"
                ? "Nenhum material arquivado."
                : "Nenhum material encontrado com esta busca ou estes filtros."
            }
            onClickLinha={podeEditar ? (m) => setDrawer({ material: m }) : abrir}
            acoes={acoes}
            larguraAcoes={40 * acoes.length + 8}
            larguraMinima={760}
          />
        </Paper>
      )}

      <PainelFiltros
        aberto={painelAberto}
        onFechar={() => setPainelAberto(false)}
        titulo="Filtrar materiais da incubadora"
        grupos={gruposFiltro}
        selecionados={filtros}
        onAplicar={setFiltros}
        onLimpar={() => setFiltros({})}
      />

      <DrawerMaterial
        aberto={Boolean(drawer)}
        material={drawer?.material ?? null}
        idTenant={idTenant}
        categorias={lista.categorias}
        escopo="INCUBADORA"
        onFechar={() => setDrawer(null)}
        onSalvo={salvo}
      />

      <ConfirmDialog
        aberto={Boolean(aExcluir)}
        mensagem={
          aExcluir
            ? `Excluir "${aExcluir.titulo}"? Os mentores perdem o acesso e o arquivo é apagado. Para só tirar de vista por um tempo, use "Arquivar" na edição.`
            : ""
        }
        onConfirmar={excluirConfirmado}
        onCancelar={() => setAExcluir(null)}
      />
    </Box>
  )
}
