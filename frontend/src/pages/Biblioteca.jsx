/**
 * Biblioteca de Conhecimento — o que cada trilha tem de material, por fase.
 *
 * Ate a mudanca do Construtor, a Biblioteca era onde o material NASCIA ("Novo
 * conteudo") e o passo da trilha so apontava para ele. Agora o material nasce
 * na fase, no Construtor, e aqui e o lugar de OLHAR: escolhe-se a trilha e os
 * materiais aparecem agrupados pelas fases dela. "Fora das trilhas" junta o
 * que nao esta em fase nenhuma (o acervo antigo, copias), para nada sumir.
 *
 * Abrir um card ainda leva ao editor: corrigir um material nao deveria exigir
 * voltar ao Construtor e achar a fase dele.
 *
 * Dados: /trilha/programas (as trilhas), /trilha/:id/materiais (as fases da
 * trilha com seus materiais) e /conteudos (o acervo, que traz os `usos` que o
 * card mostra e diz o que esta fora das trilhas).
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Box,
  Typography,
  Button,
  TextField,
  InputAdornment,
  Chip,
  Snackbar,
  Alert,
  Stack,
  CircularProgress,
} from "@mui/material"
import { AccountTree, Search, LocalLibrary } from "@mui/icons-material"
import AppLayout from "../components/AppLayout"
import ContentCard from "../components/biblioteca/ContentCard"
import EditorConteudo from "../components/biblioteca/EditorConteudo"
import ConfirmDialog from "../components/programa/ConfirmDialog"
import EmptyState from "../components/programa/EmptyState"
import api from "../services/api"
import { useAuthStore } from "../store/authStore"
import { TIPO_META } from "../data/trilhaMeta"

// Valor do seletor para o que nao esta em trilha nenhuma.
const FORA = "fora"

export default function Biblioteca() {
  const idTenant = useAuthStore((s) => s.usuario?.id_tenant ?? null)
  const navigate = useNavigate()

  const [trilhas, setTrilhas] = useState([])
  const [trilhaSel, setTrilhaSel] = useState(null) // id_no da trilha | FORA
  const [fases, setFases] = useState([]) // da trilha selecionada
  const [acervo, setAcervo] = useState([]) // /conteudos, com `usos`
  const [carregando, setCarregando] = useState(true)
  const [carregandoFases, setCarregandoFases] = useState(false)
  const [erro, setErro] = useState(null)
  const [termo, setTermo] = useState("")

  const [editando, setEditando] = useState(null)
  const [confirmar, setConfirmar] = useState(null)
  const [toast, setToast] = useState(null)

  const carregarAcervo = useCallback(async () => {
    const { data } = await api.get("/conteudos", { params: { id_tenant: idTenant } })
    setAcervo(data.conteudos)
  }, [idTenant])

  // Trilhas + acervo, uma vez. Abre a trilha padrao (ou a primeira).
  useEffect(() => {
    if (!idTenant) return
    let cancelado = false
    setCarregando(true)
    Promise.all([
      api.get("/trilha/programas", { params: { id_tenant: idTenant } }),
      api.get("/conteudos", { params: { id_tenant: idTenant } }),
    ])
      .then(([t, c]) => {
        if (cancelado) return
        setTrilhas(t.data.programas)
        setAcervo(c.data.conteudos)
        const inicial = t.data.programas.find((p) => p.padrao) ?? t.data.programas[0]
        setTrilhaSel(inicial ? inicial.id_no : FORA)
        setErro(null)
      })
      .catch((err) => {
        if (!cancelado) setErro(err.response?.data?.erro || "Erro ao carregar a biblioteca.")
      })
      .finally(() => {
        if (!cancelado) setCarregando(false)
      })
    return () => {
      cancelado = true
    }
  }, [idTenant])

  const carregarFases = useCallback(async (idTrilha) => {
    if (!idTrilha || idTrilha === FORA) {
      setFases([])
      return
    }
    setCarregandoFases(true)
    try {
      const { data } = await api.get(`/trilha/${idTrilha}/materiais`)
      setFases(data.fases)
    } catch (err) {
      setFases([])
      setToast({ texto: err.response?.data?.erro || "Erro ao carregar as fases.", severidade: "error" })
    } finally {
      setCarregandoFases(false)
    }
  }, [])

  useEffect(() => {
    carregarFases(trilhaSel)
  }, [trilhaSel, carregarFases])

  // O card precisa do conteudo completo do acervo (usos, data); o endpoint de
  // materiais traz so o essencial.
  const porId = useMemo(() => new Map(acervo.map((c) => [c.id_conteudo, c])), [acervo])
  const casa = useCallback(
    (c) => {
      const t = termo.trim().toLowerCase()
      if (!t) return true
      return (
        c.titulo?.toLowerCase().includes(t) ||
        c.resumo?.toLowerCase().includes(t) ||
        (c.tags || []).some((tag) => tag.toLowerCase().includes(t))
      )
    },
    [termo]
  )

  const secoes = useMemo(() => {
    if (trilhaSel === FORA) {
      return [
        {
          id: FORA,
          nome: "Materiais fora das trilhas",
          conteudos: acervo.filter((c) => !c.usos?.length).filter(casa),
        },
      ]
    }
    return fases.map((f) => ({
      id: f.id_no,
      nome: f.nome,
      ativo: f.ativo,
      conteudos: f.conteudos.map((c) => porId.get(c.id_conteudo) ?? c).filter(casa),
    }))
  }, [trilhaSel, fases, acervo, porId, casa])

  const foraDasTrilhas = acervo.filter((c) => !c.usos?.length).length

  /** Abre o editor. O card nao traz os blocos da aula; busca o completo. */
  const abrir = async (conteudo) => {
    setEditando(conteudo)
    try {
      const { data } = await api.get(`/conteudos/${conteudo.id_conteudo}`)
      setEditando(data.conteudo)
    } catch {
      setToast({ texto: "Erro ao carregar o conteúdo.", severidade: "error" })
    }
  }

  /** O editor grava sozinho; o erro sobe para ele marcar o estado e tentar de novo. */
  const salvar = async (id, patch) => {
    await api.patch(`/conteudos/${id}`, patch)
  }

  const fecharEditor = async () => {
    setEditando(null)
    // Titulo e logo podem ter mudado.
    await Promise.all([carregarAcervo(), carregarFases(trilhaSel)]).catch(() => {})
  }

  const duplicar = async (conteudo) => {
    try {
      await api.post(`/conteudos/${conteudo.id_conteudo}/duplicar`)
      await carregarAcervo()
      setToast({
        texto: "Conteúdo duplicado. A cópia está em \"Fora das trilhas\".",
        severidade: "success",
      })
    } catch (err) {
      setToast({ texto: err.response?.data?.erro || "Erro ao duplicar.", severidade: "error" })
    }
  }

  /**
   * Exclui de fato. O servidor recusa (409) conteudo em uso numa fase, e a
   * confirmacao avisa antes.
   */
  const excluirConfirmado = async () => {
    const alvo = confirmar
    setConfirmar(null)
    try {
      await api.delete(`/conteudos/${alvo.id_conteudo}`)
      await carregarAcervo()
      setToast({ texto: `"${alvo.titulo || "Conteúdo"}" excluído.`, severidade: "info" })
    } catch (err) {
      setToast({
        texto: err.response?.data?.erro || "Erro ao excluir o conteúdo.",
        severidade: "error",
      })
    }
  }

  const totalNaTela = secoes.reduce((n, s) => n + s.conteudos.length, 0)

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
            data-tour="biblioteca-construtor"
            variant="outlined"
            startIcon={<AccountTree />}
            onClick={() => navigate("/programa")}
            sx={{ textTransform: "none" }}
          >
            Adicionar material no Construtor
          </Button>
        </Box>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          O material de cada trilha, separado pelas fases. Para adicionar um material,
          abra a fase no Construtor.
        </Typography>

        {/* Trilha */}
        <Stack
          data-tour="biblioteca-trilhas"
          direction="row"
          sx={{ mb: 2, flexWrap: "wrap", gap: 1 }}
        >
          {trilhas.map((t) => (
            <FiltroChip
              key={t.id_no}
              ativo={trilhaSel === t.id_no}
              cor={TIPO_META.PROGRAMA.cor}
              label={t.nome}
              onClick={() => setTrilhaSel(t.id_no)}
            />
          ))}
          <FiltroChip
            ativo={trilhaSel === FORA}
            label={`Fora das trilhas (${foraDasTrilhas})`}
            onClick={() => setTrilhaSel(FORA)}
          />
        </Stack>

        {/* Busca */}
        <TextField
          data-tour="biblioteca-busca"
          fullWidth
          size="small"
          placeholder="Buscar por título, resumo ou tag…"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          sx={{ mb: 3, maxWidth: 480 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ fontSize: 20 }} />
              </InputAdornment>
            ),
          }}
        />

        {carregando || carregandoFases ? (
          <Box sx={{ py: 8, display: "grid", placeItems: "center" }}>
            <CircularProgress />
          </Box>
        ) : erro ? (
          <Alert severity="error" sx={{ borderRadius: "6px" }}>
            {erro}
          </Alert>
        ) : secoes.length === 0 ? (
          <Box sx={{ py: 8, display: "grid", placeItems: "center" }}>
            <EmptyState
              variante="fases"
              titulo="Esta trilha ainda não tem fases"
              descricao="Crie as fases no Construtor e adicione os materiais de cada uma."
            />
          </Box>
        ) : termo.trim() && totalNaTela === 0 ? (
          <Box sx={{ py: 8, display: "grid", placeItems: "center" }}>
            <EmptyState
              variante="busca"
              titulo="Nada encontrado"
              descricao={`Nenhum material corresponde a "${termo}".`}
            />
          </Box>
        ) : (
          <Stack data-tour="biblioteca-grade" spacing={4}>
            {secoes.map((secao) => (
              <Box key={secao.id}>
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 1.5 }}>
                  <Typography variant="h6" fontWeight={700} sx={{ opacity: secao.ativo === false ? 0.55 : 1 }}>
                    {secao.nome}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {secao.conteudos.length} material{secao.conteudos.length === 1 ? "" : "is"}
                    {secao.ativo === false ? " · fase inativa" : ""}
                  </Typography>
                </Box>
                {secao.conteudos.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    {secao.id === FORA
                      ? "Todo o acervo está em alguma fase."
                      : "Nenhum material nesta fase ainda."}
                  </Typography>
                ) : (
                  <Box
                    sx={{
                      display: "grid",
                      gap: 2,
                      gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" },
                    }}
                  >
                    {secao.conteudos.map((c) => (
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
            ))}
          </Stack>
        )}
      </Box>

      {/* Editor lateral */}
      <EditorConteudo conteudo={editando} onSalvar={salvar} onFechar={fecharEditor} />

      {/* Confirmacao de exclusao */}
      <ConfirmDialog
        aberto={Boolean(confirmar)}
        mensagem={
          confirmar
            ? confirmar.usos?.length
              ? `"${confirmar.titulo || "Este conteúdo"}" está em ${
                  confirmar.usos.length
                } fase(s) de trilha. Tire-o das fases no Construtor antes de excluir.`
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

// Chip de filtro, com cor de acento opcional.
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
