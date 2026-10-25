/**
 * Biblioteca de Conhecimento — o acervo reutilizavel da incubadora.
 *
 * Aqui a incubadora GUARDA tudo o que ensina aos incubados: aulas (paginas
 * ricas de blocos), videos, materiais, templates de entregavel e links. Cada
 * conteudo e independente e reutilizavel — os Passos da trilha (Construtor de
 * Programa) apenas o referenciam.
 *
 * Layout: cabecalho com "Novo conteudo"; busca + botao "Filtros" (trilha e tag
 * num popover, para nao disputar espaco com a busca); chips de tipo; e a secao
 * de conteudos, com total, ordenacao e a grade de cards. Editar/criar abre o
 * editor em tela cheia (EditorConteudo)
 * que, nas aulas, usa o editor de blocos (components/editor/, motor BlockNote).
 *
 * Os dados vem da API (/conteudos) via useBiblioteca.
 */
import { useEffect, useMemo, useState } from "react"
import {
  Box,
  Typography,
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  TextField,
  InputAdornment,
  Chip,
  Snackbar,
  Alert,
  CircularProgress,
  Badge,
  Divider,
  Popover,
} from "@mui/material"
import { alpha } from "@mui/material/styles"
import { Add, Search, Tune, ExpandMore } from "@mui/icons-material"
import { motion } from "framer-motion"
import AppLayout from "../components/AppLayout"
import ContentCard from "../components/biblioteca/ContentCard"
import EditorConteudo from "../components/biblioteca/EditorConteudo"
import ConfirmDialog from "../components/programa/ConfirmDialog"
import EmptyState from "../components/programa/EmptyState"
import { useBiblioteca } from "../hooks/useBiblioteca"
import { useAuthStore } from "../store/authStore"
import api from "../services/api"
import { TIPO_CONTEUDO, TIPOS_ORDEM, TAGS } from "../data/bibliotecaMeta"

// Ordenacoes da grade. Feitas no cliente: o servidor ja devolve a lista
// filtrada (por atualizacao, a mais recente primeiro), e reordenar o que esta
// na tela nao justifica outra requisicao.
const ORDENACOES = {
  RECENTES: { label: "Recentes", comparar: null },
  TITULO: {
    label: "Título (A–Z)",
    comparar: (a, b) => (a.titulo || "").localeCompare(b.titulo || "", "pt-BR"),
  },
  MAIS_USADOS: {
    label: "Mais usados",
    comparar: (a, b) => (b.usos?.length || 0) - (a.usos?.length || 0),
  },
}

export default function Biblioteca() {
  const bib = useBiblioteca()
  const idTenant = useAuthStore((s) => s.usuario?.id_tenant ?? null)

  // Trilhas do tenant, para o filtro. Quem ve a Biblioteca sem permissao de
  // ver as trilhas leva 403 aqui — o filtro so some, a tela segue normal.
  const [trilhas, setTrilhas] = useState([])
  useEffect(() => {
    if (!idTenant) return
    api
      .get("/trilha/programas", { params: { id_tenant: idTenant } })
      .then(({ data }) => setTrilhas(data.programas))
      .catch(() => setTrilhas([]))
  }, [idTenant])

  const [filtrosAncora, setFiltrosAncora] = useState(null)
  const filtrosAtivos = (bib.tagFiltro ? 1 : 0) + (bib.trilhaFiltro ? 1 : 0)

  const [ordem, setOrdem] = useState("RECENTES")
  const [ordemAncora, setOrdemAncora] = useState(null)
  const ordenados = useMemo(() => {
    const { comparar } = ORDENACOES[ordem]
    return comparar ? [...bib.filtrados].sort(comparar) : bib.filtrados
  }, [bib.filtrados, ordem])

  const [novoMenu, setNovoMenu] = useState(null)
  const [editando, setEditando] = useState(null) // conteudo aberto no Drawer
  const [confirmar, setConfirmar] = useState(null) // conteudo a excluir
  const [toast, setToast] = useState(null)

  const criar = async (tipo) => {
    setNovoMenu(null)
    try {
      setEditando(await bib.criar(tipo))
    } catch (err) {
      setToast({
        texto: err.response?.data?.erro || "Erro ao criar o conteúdo.",
        severidade: "error",
      })
    }
  }

  /**
   * Abre o editor. O card da listagem nao traz os blocos da aula (a lista
   * ficaria pesada a toa), entao o conteudo completo e buscado aqui.
   */
  const abrir = async (conteudo) => {
    setEditando(conteudo) // resposta imediata, com o que ja temos
    try {
      setEditando(await bib.carregarCompleto(conteudo.id_conteudo))
    } catch {
      setToast({ texto: "Erro ao carregar o conteúdo.", severidade: "error" })
    }
  }

  /**
   * Grava as alteracoes do editor.
   *
   * NAO avisa em caso de sucesso: quem salva e o proprio editor, sozinho, a
   * cada pausa na digitacao — um toast por gravacao viraria um desfile de
   * "Conteúdo salvo" no canto da tela. O aviso de estado fica dentro do
   * editor (IndicadorSalvamento).
   *
   * O erro SOBE em vez de virar toast aqui: o editor precisa saber que a
   * gravacao falhou para marcar o estado e tentar de novo.
   *
   * Tambem nao mexe em `editando`: devolver o conteudo gravado para o editor
   * reiniciaria o formulario no meio da digitacao seguinte.
   */
  const salvar = async (id, patch) => {
    await bib.atualizar(id, patch)
  }

  const duplicar = async (conteudo) => {
    try {
      await bib.duplicar(conteudo.id_conteudo)
      setToast({ texto: "Conteúdo duplicado.", severidade: "success" })
    } catch (err) {
      setToast({
        texto: err.response?.data?.erro || "Erro ao duplicar.",
        severidade: "error",
      })
    }
  }

  /**
   * Exclui de fato. Nao ha "Desfazer" como antes: com o conteudo no servidor,
   * desfazer significaria recriar registro e blocos com outros ids, e qualquer
   * passo que o referenciava continuaria orfao. Em vez disso o servidor recusa
   * (409) a exclusao de conteudo em uso, e a confirmacao avisa antes.
   */
  const excluirConfirmado = async () => {
    const alvo = confirmar
    setConfirmar(null)

    const r = await bib.excluir(alvo.id_conteudo)

    if (!r.ok) {
      setToast({ texto: r.erro, severidade: "error" })
      return
    }

    if (editando?.id_conteudo === alvo.id_conteudo) setEditando(null)
    setToast({
      texto: `"${alvo.titulo || "Conteúdo"}" excluído.`,
      severidade: "info",
    })
  }

  return (
    <AppLayout>
      <Box>
        {/* Cabecalho */}
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 2,
            flexWrap: "wrap",
            mb: 3,
          }}
        >
          <Box>
            <Typography variant="h4" fontWeight={700}>
              Biblioteca
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              Materiais e ferramentas para apoiar a jornada das startups.
            </Typography>
          </Box>
          <Button
            data-tour="biblioteca-novo"
            variant="contained"
            startIcon={<Add />}
            onClick={(e) => setNovoMenu(e.currentTarget)}
            sx={{ textTransform: "none", fontWeight: 700, borderRadius: 999, px: 2.5, py: 1 }}
          >
            Novo conteúdo
          </Button>
        </Box>

        {/* Busca + botao de filtros (trilha e tag ficam no popover) */}
        <Box sx={{ display: "flex", gap: 1.5, mb: 2 }}>
          <TextField
            data-tour="biblioteca-busca"
            fullWidth
            placeholder="Buscar materiais, assuntos ou palavras-chave…"
            value={bib.termo}
            onChange={(e) => bib.setTermo(e.target.value)}
            InputProps={{
              sx: { borderRadius: 2.5 },
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ fontSize: 20 }} />
                </InputAdornment>
              ),
            }}
          />
          <Badge badgeContent={filtrosAtivos} color="primary">
            <Button
              data-tour="biblioteca-filtros"
              variant="outlined"
              color="inherit"
              startIcon={<Tune />}
              onClick={(e) => setFiltrosAncora(e.currentTarget)}
              sx={{
                textTransform: "none",
                fontWeight: 600,
                borderRadius: 2.5,
                borderColor: "divider",
                height: "100%",
                px: 2,
                whiteSpace: "nowrap",
              }}
            >
              Filtros
            </Button>
          </Badge>
        </Box>

        {/* Filtro por tipo */}
        <Box data-tour="biblioteca-tipos" sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          <FiltroChip
            ativo={bib.tipoFiltro === "TODOS"}
            label="Todos os conteúdos"
            onClick={() => bib.setTipoFiltro("TODOS")}
          />
          {TIPOS_ORDEM.map((tipo) => (
            <FiltroChip
              key={tipo}
              ativo={bib.tipoFiltro === tipo}
              label={TIPO_CONTEUDO[tipo].plural}
              onClick={() => bib.setTipoFiltro(tipo)}
            />
          ))}
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Cabecalho da secao: total + ordenacao */}
        <Box
          sx={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 2,
            flexWrap: "wrap",
            mb: 2,
          }}
        >
          <Typography variant="h6" fontWeight={700}>
            Conteúdos da biblioteca
          </Typography>
          <Typography variant="body2" color="text.secondary" component="div">
            {ordenados.length} {ordenados.length === 1 ? "conteúdo" : "conteúdos"} · Ordenar por:{" "}
            <Box
              component="button"
              type="button"
              onClick={(e) => setOrdemAncora(e.currentTarget)}
              sx={{
                font: "inherit",
                color: "text.primary",
                fontWeight: 600,
                bgcolor: "transparent",
                border: 0,
                p: 0,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                verticalAlign: "bottom",
                "&:hover": { textDecoration: "underline" },
              }}
            >
              {ORDENACOES[ordem].label}
              <ExpandMore sx={{ fontSize: 18 }} />
            </Box>
          </Typography>
        </Box>

        {/* Grade de cards */}
        {bib.carregando ? (
          <Box sx={{ py: 8, display: "grid", placeItems: "center" }}>
            <CircularProgress />
          </Box>
        ) : bib.erro ? (
          <Alert severity="error" sx={{ borderRadius: "6px" }}>
            {bib.erro}
          </Alert>
        ) : ordenados.length === 0 ? (
          <Box sx={{ py: 8, display: "grid", placeItems: "center" }}>
            <EmptyState
              variante="selecao"
              titulo="Nenhum conteúdo aqui"
              descricao="Ajuste os filtros ou crie um novo conteúdo para começar seu acervo."
            />
          </Box>
        ) : (
          <Box
            component={motion.div}
            layout
            data-tour="biblioteca-grade"
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, 1fr)",
                lg: "repeat(3, 1fr)",
              },
            }}
          >
            {ordenados.map((c) => (
              <ContentCard
                key={c.id_conteudo}
                conteudo={c}
                onAbrir={abrir}
                onDuplicar={duplicar}
                onExcluir={setConfirmar}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* Popover de filtros: trilha + tag */}
      <Popover
        open={Boolean(filtrosAncora)}
        anchorEl={filtrosAncora}
        onClose={() => setFiltrosAncora(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{
          sx: { mt: 1, p: 2, width: 340, maxWidth: "calc(100vw - 32px)", borderRadius: 2 },
        }}
      >
        {trilhas.length > 0 && (
          <TextField
            select
            fullWidth
            size="small"
            label="Trilha"
            value={bib.trilhaFiltro ?? ""}
            onChange={(e) => bib.setTrilhaFiltro(e.target.value || null)}
            sx={{ mb: 2 }}
            SelectProps={{ displayEmpty: true }}
            InputLabelProps={{ shrink: true }}
          >
            <MenuItem value="">Todas as trilhas</MenuItem>
            {trilhas.map((t) => (
              <MenuItem key={t.id_no} value={t.id_no}>
                {t.nome}
              </MenuItem>
            ))}
            <MenuItem value="SEM_TRILHA">
              <em>Sem trilha (não usado em nenhum passo)</em>
            </MenuItem>
          </TextField>
        )}

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontWeight: 600, display: "block", mb: 1 }}
        >
          Tema
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
          {TAGS.map((tag) => (
            <FiltroChip
              key={tag}
              ativo={bib.tagFiltro === tag}
              label={tag}
              onClick={() => bib.setTagFiltro(bib.tagFiltro === tag ? null : tag)}
            />
          ))}
        </Box>

        {filtrosAtivos > 0 && (
          <Button
            size="small"
            onClick={() => {
              bib.setTagFiltro(null)
              bib.setTrilhaFiltro(null)
            }}
            sx={{ mt: 2, textTransform: "none" }}
          >
            Limpar filtros
          </Button>
        )}
      </Popover>

      {/* Menu de ordenacao */}
      <Menu anchorEl={ordemAncora} open={Boolean(ordemAncora)} onClose={() => setOrdemAncora(null)}>
        {Object.entries(ORDENACOES).map(([chave, o]) => (
          <MenuItem
            key={chave}
            selected={chave === ordem}
            onClick={() => {
              setOrdem(chave)
              setOrdemAncora(null)
            }}
          >
            {o.label}
          </MenuItem>
        ))}
      </Menu>

      {/* Menu "Novo conteudo" */}
      <Menu anchorEl={novoMenu} open={Boolean(novoMenu)} onClose={() => setNovoMenu(null)}>
        {TIPOS_ORDEM.map((tipo) => {
          const meta = TIPO_CONTEUDO[tipo]
          const I = meta.icon
          return (
            <MenuItem key={tipo} onClick={() => criar(tipo)}>
              <ListItemIcon>
                <I fontSize="small" sx={{ color: meta.cor }} />
              </ListItemIcon>
              <ListItemText primary={meta.label} secondary={meta.descricao} />
            </MenuItem>
          )
        })}
      </Menu>

      {/* Editor lateral */}
      <EditorConteudo
        conteudo={editando}
        onSalvar={salvar}
        onFechar={() => setEditando(null)}
      />

      {/* Confirmacao de exclusao */}
      <ConfirmDialog
        aberto={Boolean(confirmar)}
        mensagem={
          confirmar
            ? confirmar.usos?.length
              ? `"${confirmar.titulo || "Este conteúdo"}" é usado em ${
                  confirmar.usos.length
                } passo(s) da trilha. Desvincule-o antes de excluir.`
              : confirmar.compartilhamentos > 0
                ? // Compartilhado por mentores (Espaco do Mentor): o vinculo sai
                  // junto com o conteudo, e quem exclui precisa saber disso antes.
                  `Excluir "${confirmar.titulo || "este conteúdo"}"? Mentores o compartilharam com startups ${
                    confirmar.compartilhamentos
                  } vez(es) — esses compartilhamentos também serão removidos, e as startups deixam de vê-lo. Esta ação não pode ser desfeita.`
                : `Excluir "${confirmar.titulo || "este conteúdo"}"? Esta ação não pode ser desfeita.`
            : ""
        }
        onConfirmar={excluirConfirmado}
        onCancelar={() => setConfirmar(null)}
      />

      {/* Toast */}
      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={toast?.severidade === "error" ? 6000 : 3000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {toast ? (
          <Alert
            severity={toast.severidade}
            variant="filled"
            onClose={() => setToast(null)}
            sx={{ borderRadius: "6px", alignItems: "center" }}
          >
            {toast.texto}
          </Alert>
        ) : (
          <span />
        )}
      </Snackbar>
    </AppLayout>
  )
}

// Chip de filtro (tipo e tag): neutro quando inativo, tingido com a cor
// principal quando ativo.
function FiltroChip({ ativo, label, onClick }) {
  return (
    <Chip
      label={label}
      size="small"
      onClick={onClick}
      sx={{
        height: 26,
        fontWeight: 600,
        "& .MuiChip-label": { px: 1.25 },
        ...(ativo
          ? {
              bgcolor: (t) => alpha(t.palette.primary.main, 0.16),
              color: "primary.main",
              "&:hover": { bgcolor: (t) => alpha(t.palette.primary.main, 0.24) },
            }
          : { bgcolor: "action.selected" }),
      }}
    />
  )
}
