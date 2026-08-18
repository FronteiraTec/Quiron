/**
 * Biblioteca de Conhecimento — o acervo reutilizavel da incubadora.
 *
 * Aqui a incubadora GUARDA tudo o que ensina aos incubados: aulas (paginas
 * ricas de blocos), videos, materiais, templates de entregavel e links. Cada
 * conteudo e independente e reutilizavel — os Passos da trilha (Construtor de
 * Programa) apenas o referenciam.
 *
 * Layout: cabecalho com "Novo conteudo" + busca, faixa de filtros (tipo + tag)
 * e uma grade de cards. Editar/criar abre um Drawer lateral (EditorConteudo)
 * que, nas aulas, usa o editor de blocos estilo Notion.
 *
 * Os dados vem da API (/conteudos) via useBiblioteca.
 */
import { useState } from "react"
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
  Stack,
  CircularProgress,
} from "@mui/material"
import { Add, Search, LocalLibrary } from "@mui/icons-material"
import { motion } from "framer-motion"
import AppLayout from "../components/AppLayout"
import ContentCard from "../components/biblioteca/ContentCard"
import EditorConteudo from "../components/biblioteca/EditorConteudo"
import ConfirmDialog from "../components/programa/ConfirmDialog"
import EmptyState from "../components/programa/EmptyState"
import { useBiblioteca } from "../hooks/useBiblioteca"
import { TIPO_CONTEUDO, TIPOS_ORDEM, TAGS } from "../data/bibliotecaMeta"

export default function Biblioteca() {
  const bib = useBiblioteca()

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

  const salvar = async (id, patch) => {
    try {
      const atualizado = await bib.atualizar(id, patch)
      setEditando((atual) =>
        atual && atual.id_conteudo === id ? { ...atual, ...atualizado } : atual
      )
      setToast({ texto: "Conteúdo salvo.", severidade: "success" })
    } catch (err) {
      setToast({
        texto: err.response?.data?.erro || "Erro ao salvar o conteúdo.",
        severidade: "error",
      })
    }
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
            alignItems: { xs: "flex-start", sm: "center" },
            justifyContent: "space-between",
            gap: 2,
            flexWrap: "wrap",
            mb: 0.5,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <LocalLibrary sx={{ color: "primary.main" }} />
            <Typography variant="h4" fontWeight={700}>
              Biblioteca
            </Typography>
          </Box>
          <Button
            data-tour="biblioteca-novo"
            variant="contained"
            startIcon={<Add />}
            onClick={(e) => setNovoMenu(e.currentTarget)}
            sx={{ textTransform: "none" }}
          >
            Novo conteúdo
          </Button>
        </Box>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Tudo o que sua incubadora ensina, em um só lugar. Crie uma vez e reutilize
          em qualquer passo da trilha.
        </Typography>

        {/* Busca */}
        <TextField
          data-tour="biblioteca-busca"
          fullWidth
          size="small"
          placeholder="Buscar por título, resumo ou tag…"
          value={bib.termo}
          onChange={(e) => bib.setTermo(e.target.value)}
          sx={{ mb: 2, maxWidth: 480 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ fontSize: 20 }} />
              </InputAdornment>
            ),
          }}
        />

        {/* Filtro por tipo */}
        <Stack data-tour="biblioteca-tipos" direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: "wrap", gap: 1 }}>
          <FiltroChip
            ativo={bib.tipoFiltro === "TODOS"}
            label={`Todos (${bib.contagem.TODOS || 0})`}
            onClick={() => bib.setTipoFiltro("TODOS")}
          />
          {TIPOS_ORDEM.map((tipo) => (
            <FiltroChip
              key={tipo}
              ativo={bib.tipoFiltro === tipo}
              cor={TIPO_CONTEUDO[tipo].cor}
              label={`${TIPO_CONTEUDO[tipo].plural} (${bib.contagem[tipo] || 0})`}
              onClick={() => bib.setTipoFiltro(tipo)}
            />
          ))}
        </Stack>

        {/* Filtro por tag */}
        <Box data-tour="biblioteca-tags" sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 3 }}>
          <Chip
            label="Todas as tags"
            size="small"
            variant={bib.tagFiltro ? "outlined" : "filled"}
            color={bib.tagFiltro ? "default" : "primary"}
            onClick={() => bib.setTagFiltro(null)}
            sx={{ cursor: "pointer" }}
          />
          {TAGS.map((tag) => (
            <Chip
              key={tag}
              label={tag}
              size="small"
              variant={bib.tagFiltro === tag ? "filled" : "outlined"}
              color={bib.tagFiltro === tag ? "primary" : "default"}
              onClick={() => bib.setTagFiltro(bib.tagFiltro === tag ? null : tag)}
              sx={{ cursor: "pointer" }}
            />
          ))}
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
        ) : bib.filtrados.length === 0 ? (
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
                md: "repeat(3, 1fr)",
              },
            }}
          >
            {bib.filtrados.map((c) => (
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

// Chip de filtro por tipo, com cor de acento opcional.
function FiltroChip({ ativo, label, cor, onClick }) {
  return (
    <Chip
      label={label}
      onClick={onClick}
      variant={ativo ? "filled" : "outlined"}
      sx={{
        cursor: "pointer",
        fontWeight: 600,
        ...(ativo && cor ? { bgcolor: `${cor}1f`, color: cor, borderColor: cor } : {}),
        ...(ativo && !cor ? { bgcolor: "primary.main", color: "primary.contrastText" } : {}),
      }}
    />
  )
}
