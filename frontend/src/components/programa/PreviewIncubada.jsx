/**
 * "Visualizar como incubada": overlay em tela cheia que mostra a trilha do jeito
 * que a startup a vera — experiencia estilo plataforma de cursos (Alura).
 *
 * Layout:
 *   - Sidebar esquerda: fases -> modulos -> tarefas (navegacao da trilha)
 *   - Area central: o conteudo da tarefa selecionada, com progresso simulado
 *
 * So itens ATIVOS aparecem (o que estiver inativo fica oculto para a startup).
 * E puramente visual: o "concluir" apenas marca localmente para dar a sensacao.
 */
import { useEffect, useMemo, useState } from "react"
import {
  Box,
  Typography,
  IconButton,
  Button,
  LinearProgress,
  Chip,
  Divider,
  Avatar,
  Stack,
  Link,
} from "@mui/material"
import {
  Close,
  Visibility,
  CheckCircle,
  RadioButtonUnchecked,
  PlayCircleOutline,
  Schedule,
  Timelapse,
  Inventory2,
  ExpandMore,
  ChevronRight,
  EmojiEvents,
  OpenInNew,
} from "@mui/icons-material"
import { motion, AnimatePresence } from "framer-motion"
import { TIPO_META } from "../../data/trilhaMeta"
import { TIPO_CONTEUDO } from "../../data/bibliotecaMeta"
import api from "../../services/api"

export default function PreviewIncubada({ programa, onFechar }) {
  // Apenas conteudo ativo — assim a incubadora ve exatamente o que a startup ve.
  const fasesAtivas = useMemo(
    () =>
      (programa.filhos ?? [])
        .filter((f) => f.ativo)
        .map((f) => ({
          ...f,
          modulos: (f.filhos ?? [])
            .filter((m) => m.ativo)
            .map((m) => ({ ...m, tarefas: (m.filhos ?? []).filter((t) => t.ativo) })),
        })),
    [programa]
  )

  // Lista linear de passos (para navegacao anterior/proximo e progresso).
  const tarefas = useMemo(() => {
    const arr = []
    fasesAtivas.forEach((f) =>
      f.modulos.forEach((m) =>
        m.tarefas.forEach((t) => arr.push({ ...t, fase: f.nome, modulo: m.nome }))
      )
    )
    return arr
  }, [fasesAtivas])

  const [atualId, setAtualId] = useState(tarefas[0]?.id_no ?? null)
  const [concluidas, setConcluidas] = useState(() => new Set())
  const [modulosAbertos, setModulosAbertos] = useState(
    () => new Set(fasesAtivas.flatMap((f) => f.modulos.map((m) => m.id_no)))
  )

  const atual = tarefas.find((t) => t.id_no === atualId) || null
  const indiceAtual = tarefas.findIndex((t) => t.id_no === atualId)
  const progresso = tarefas.length ? (concluidas.size / tarefas.length) * 100 : 0

  // Conteudos da Biblioteca vinculados ao passo atual (o que a incubadora
  // ensina). Vem do servidor, ja que o vinculo vive em trilha_conteudo.
  const [conteudosAtual, setConteudosAtual] = useState([])

  useEffect(() => {
    if (!atual) {
      setConteudosAtual([])
      return
    }

    let cancelado = false
    api
      .get(`/trilha/${atual.id_no}/conteudos`)
      .then(({ data }) => {
        if (!cancelado) setConteudosAtual(data.conteudos)
      })
      .catch(() => {
        if (!cancelado) setConteudosAtual([])
      })

    return () => {
      cancelado = true
    }
  }, [atual])

  const alternarModulo = (id) =>
    setModulosAbertos((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  const concluir = () => {
    if (!atual) return
    setConcluidas((s) => new Set(s).add(atual.id_no))
    // Avança automaticamente para a proxima tarefa, como numa trilha real.
    const prox = tarefas[indiceAtual + 1]
    if (prox) setAtualId(prox.id_no)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1300,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box sx={{ position: "absolute", inset: 0, bgcolor: "background.default" }} />

      {/* Topbar do modo aluno */}
      <Box
        sx={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 2,
          px: 3,
          py: 1.5,
          bgcolor: "background.paper",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Chip
          icon={<Visibility />}
          label="Pre-visualizacao — modo incubada"
          size="small"
          color="primary"
          sx={{ fontWeight: 600 }}
        />
        <Typography sx={{ fontWeight: 700, flex: 1 }} noWrap>
          {programa.nome}
        </Typography>
        <Box sx={{ width: 160, display: { xs: "none", md: "block" } }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.25 }}>
            <Typography variant="caption" color="text.secondary">
              Progresso
            </Typography>
            <Typography variant="caption" fontWeight={700}>
              {Math.round(progresso)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progresso}
            sx={{ height: 6, borderRadius: 3 }}
          />
        </Box>
        <Button
          onClick={onFechar}
          startIcon={<Close />}
          variant="outlined"
          sx={{ textTransform: "none", borderRadius: "6px" }}
        >
          Sair da previa
        </Button>
      </Box>

      {/* Corpo: navegacao + conteudo */}
      <Box sx={{ position: "relative", flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Sidebar da trilha */}
        <Box
          sx={{
            width: 320,
            flexShrink: 0,
            overflowY: "auto",
            bgcolor: "background.paper",
            borderRight: "1px solid",
            borderColor: "divider",
            display: { xs: "none", md: "block" },
            py: 1,
          }}
        >
          {fasesAtivas.map((fase) => (
            <Box key={fase.id_no} sx={{ mb: 1 }}>
              <Typography
                variant="overline"
                sx={{ px: 2, color: "text.secondary", fontWeight: 700 }}
              >
                {fase.nome}
              </Typography>
              {fase.modulos.map((mod) => {
                const aberto = modulosAbertos.has(mod.id_no)
                return (
                  <Box key={mod.id_no}>
                    <Box
                      onClick={() => alternarModulo(mod.id_no)}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        px: 2,
                        py: 0.75,
                        cursor: "pointer",
                        "&:hover": { bgcolor: "action.hover" },
                      }}
                    >
                      {aberto ? (
                        <ExpandMore sx={{ fontSize: 18, color: "text.secondary" }} />
                      ) : (
                        <ChevronRight sx={{ fontSize: 18, color: "text.secondary" }} />
                      )}
                      <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{mod.nome}</Typography>
                    </Box>
                    <AnimatePresence initial={false}>
                      {aberto && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.18 }}
                          style={{ overflow: "hidden" }}
                        >
                          {mod.tarefas.map((t) => {
                            const feito = concluidas.has(t.id_no)
                            const ativo = t.id_no === atualId
                            return (
                              <Box
                                key={t.id_no}
                                onClick={() => setAtualId(t.id_no)}
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 1,
                                  pl: 5,
                                  pr: 2,
                                  py: 0.75,
                                  cursor: "pointer",
                                  borderLeft: "3px solid",
                                  borderColor: ativo ? "primary.main" : "transparent",
                                  bgcolor: ativo ? "action.selected" : "transparent",
                                  "&:hover": { bgcolor: "action.hover" },
                                }}
                              >
                                {feito ? (
                                  <CheckCircle sx={{ fontSize: 18, color: "success.main" }} />
                                ) : (
                                  <RadioButtonUnchecked
                                    sx={{ fontSize: 18, color: "text.disabled" }}
                                  />
                                )}
                                <Typography
                                  sx={{
                                    fontSize: 13.5,
                                    color: feito ? "text.secondary" : "text.primary",
                                    textDecoration: feito ? "line-through" : "none",
                                  }}
                                >
                                  {t.nome}
                                </Typography>
                              </Box>
                            )
                          })}
                          {mod.tarefas.length === 0 && (
                            <Typography
                              variant="caption"
                              sx={{ pl: 5, color: "text.disabled", display: "block", py: 0.5 }}
                            >
                              Sem tarefas ainda
                            </Typography>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Box>
                )
              })}
              <Divider sx={{ mt: 1 }} />
            </Box>
          ))}
        </Box>

        {/* Conteudo da tarefa */}
        <Box sx={{ flex: 1, overflowY: "auto", px: { xs: 3, md: 6 }, py: 4 }}>
          {!atual ? (
            <Box sx={{ maxWidth: 620, mx: "auto", textAlign: "center", py: 10 }}>
              <EmojiEvents sx={{ fontSize: 56, color: "primary.main", opacity: 0.6 }} />
              <Typography variant="h5" fontWeight={700} sx={{ mt: 2 }}>
                Trilha ainda vazia
              </Typography>
              <Typography color="text.secondary">
                Adicione fases, modulos e tarefas ativos para que a startup veja conteudo aqui.
              </Typography>
            </Box>
          ) : (
            <motion.div
              key={atual.id_no}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <Box sx={{ maxWidth: 720, mx: "auto" }}>
                <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
                  <Chip label={atual.fase} size="small" variant="outlined" />
                  <Chip label={atual.modulo} size="small" variant="outlined" />
                </Box>
                <Typography variant="h4" fontWeight={800} sx={{ mb: 1 }}>
                  {atual.nome}
                </Typography>

                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 3, color: "text.secondary" }}>
                  {atual.cargaHoraria && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <Timelapse sx={{ fontSize: 18 }} />
                      <Typography variant="body2">{atual.cargaHoraria}</Typography>
                    </Box>
                  )}
                  {atual.prazo && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <Schedule sx={{ fontSize: 18 }} />
                      <Typography variant="body2">
                        Prazo {new Date(atual.prazo).toLocaleDateString("pt-BR")}
                      </Typography>
                    </Box>
                  )}
                </Box>

                {/* Player/placeholder de conteudo */}
                <Box
                  sx={{
                    aspectRatio: "16 / 7",
                    borderRadius: "8px",
                    display: "grid",
                    placeItems: "center",
                    color: "text.secondary",
                    bgcolor: "action.hover",
                    border: "1px solid",
                    borderColor: "divider",
                    mb: 3,
                  }}
                >
                  <Box sx={{ textAlign: "center" }}>
                    <PlayCircleOutline sx={{ fontSize: 56, opacity: 0.6 }} />
                    <Typography sx={{ opacity: 0.8 }}>Conteudo da tarefa</Typography>
                  </Box>
                </Box>

                <Typography sx={{ color: "text.secondary", mb: 3, lineHeight: 1.7 }}>
                  {atual.descricao || "Esta tarefa ainda nao possui descricao. Assim que a incubadora preencher os detalhes, eles aparecerao aqui para a startup."}
                </Typography>

                {conteudosAtual.length > 0 && (
                  <Box sx={{ mb: 3 }}>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontWeight: 700, display: "block", mb: 1 }}
                    >
                      CONTEUDO DA INCUBADORA
                    </Typography>
                    <Stack spacing={1.5}>
                      {conteudosAtual.map((c) => {
                        const cmeta = TIPO_CONTEUDO[c.tipo]
                        const CIcone = cmeta.icon
                        const card = (
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1.5,
                              p: 1.75,
                              borderRadius: "8px",
                              border: "1px solid",
                              borderColor: "divider",
                              transition: "border-color .15s",
                              "&:hover": { borderColor: `${cmeta.cor}66` },
                            }}
                          >
                            <Box
                              sx={{
                                display: "grid",
                                placeItems: "center",
                                width: 38,
                                height: 38,
                                borderRadius: 1.5,
                                bgcolor: `${cmeta.cor}1f`,
                                color: cmeta.cor,
                                flexShrink: 0,
                              }}
                            >
                              <CIcone sx={{ fontSize: 20 }} />
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography sx={{ fontWeight: 700, fontSize: 14 }} noWrap>
                                {c.titulo}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                noWrap
                                sx={{ display: "block" }}
                              >
                                {cmeta.label} · {c.resumo}
                              </Typography>
                            </Box>
                            <OpenInNew sx={{ fontSize: 16, color: "text.disabled" }} />
                          </Box>
                        )
                        return c.url ? (
                          <Link key={c.id_conteudo} href={c.url} target="_blank" rel="noopener" underline="none">
                            {card}
                          </Link>
                        ) : (
                          <Box key={c.id_conteudo}>{card}</Box>
                        )
                      })}
                    </Stack>
                  </Box>
                )}

                {atual.entregavel && (
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      p: 2,
                      borderRadius: "8px",
                      bgcolor: "action.hover",
                      mb: 3,
                    }}
                  >
                    <Avatar variant="rounded" sx={{ bgcolor: `${TIPO_META.tarefa.cor}22`, color: TIPO_META.tarefa.cor }}>
                      <Inventory2 />
                    </Avatar>
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>
                        ENTREGAVEL
                      </Typography>
                      <Typography>{atual.entregavel}</Typography>
                    </Box>
                  </Box>
                )}

                {/* Navegacao anterior / concluir / proximo */}
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, mt: 4 }}>
                  <Button
                    disabled={indiceAtual <= 0}
                    onClick={() => setAtualId(tarefas[indiceAtual - 1].id_no)}
                    sx={{ textTransform: "none" }}
                  >
                    Anterior
                  </Button>
                  <Button
                    onClick={concluir}
                    variant="contained"
                    startIcon={<CheckCircle />}
                    disabled={concluidas.has(atual.id_no)}
                    sx={{ textTransform: "none", borderRadius: "6px" }}
                  >
                    {concluidas.has(atual.id_no) ? "Concluida" : "Marcar como concluida"}
                  </Button>
                  <Button
                    disabled={indiceAtual >= tarefas.length - 1}
                    onClick={() => setAtualId(tarefas[indiceAtual + 1].id_no)}
                    sx={{ textTransform: "none" }}
                  >
                    Proximo
                  </Button>
                </Box>
              </Box>
            </motion.div>
          )}
        </Box>
      </Box>
    </motion.div>
  )
}
