/**
 * Business Model Canvas guiado.
 *
 * Reproduz as proporcoes do template classico (grade unica com linhas finas,
 * zonas coloridas e a faixa financeira dividida 50/50 exatamente no meio da
 * Proposta de Valor). Cada bloco tem pergunta-guia, exemplos no placeholder,
 * ajuda contextual (popover), contador de caracteres e salvamento automatico
 * com feedback visual. Um painel lateral mostra o progresso bloco a bloco.
 *
 * API (inalterada): GET /startups/:id/canvas e PUT /startups/:id/canvas/:bloco.
 */
import { useEffect, useMemo, useRef, useState } from "react"
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  IconButton,
  InputBase,
  LinearProgress,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Popover,
  Skeleton,
  Typography,
} from "@mui/material"
import { alpha } from "@mui/material/styles"
import HelpOutlineIcon from "@mui/icons-material/HelpOutline"
import CloudDoneOutlinedIcon from "@mui/icons-material/CloudDoneOutlined"
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined"
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded"
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked"
import CheckRoundedIcon from "@mui/icons-material/CheckRounded"
import TipsAndUpdatesOutlinedIcon from "@mui/icons-material/TipsAndUpdatesOutlined"
import { motion } from "framer-motion"
import api from "../../../services/api"
import { BLOCOS_CANVAS, ZONAS_CANVAS } from "./canvasConfig"

const ATRASO_AUTOSAVE_MS = 900

// Grade do canvas: reproduz as proporcoes do Business Model Canvas oficial
// (Strategyzer) — nas telas grandes, os 5 blocos superiores dividem 10
// colunas em partes iguais e a faixa financeira parte exatamente ao meio
// (5+5), caindo bem no centro da coluna de Proposta de Valor. Em telas
// menores a grade colapsa para 2 colunas e depois 1.
const GRADE_SX = {
  display: "grid",
  gap: "1px",
  bgcolor: "divider",
  border: "1px solid",
  borderColor: "divider",
  borderRadius: 0,
  overflow: "hidden",
  flex: 1,
  minWidth: 0,
  gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(10, 1fr)" },
  gridTemplateAreas: {
    xs: `"proposta" "segmentos" "parcerias" "atividades" "recursos" "relacionamento" "canais" "receita" "custos"`,
    sm: `
      "proposta segmentos"
      "parcerias atividades"
      "recursos relacionamento"
      "canais canais"
      "custos receita"
    `,
    lg: `
      "parcerias parcerias atividades atividades proposta proposta relacionamento relacionamento segmentos segmentos"
      "parcerias parcerias recursos recursos proposta proposta canais canais segmentos segmentos"
      "custos custos custos custos custos receita receita receita receita receita"
    `,
  },
}

// Blocos da faixa financeira ficam mais baixos que os demais, reproduzindo
// a tira mais estreita do template original.
const linhasMinimas = (area) => (area === "custos" || area === "receita" ? 3 : 4)

export default function CanvasBoard({ idStartup }) {
  const [blocos, setBlocos] = useState({})
  const [statusBlocos, setStatusBlocos] = useState({}) // chave -> saving | saved | error
  const [carregando, setCarregando] = useState(true)
  const [aviso, setAviso] = useState(null)
  const [ajuda, setAjuda] = useState(null) // { ancora, bloco }

  const timersRef = useRef({}) // debounce por bloco
  const salvosRef = useRef({}) // ultimo conteudo confirmado no servidor
  const areasRef = useRef({}) // textareas, para foco via checklist

  useEffect(() => {
    setCarregando(true)
    api
      .get(`/startups/${idStartup}/canvas`)
      .then(({ data }) => {
        const mapa = {}
        data.blocos.forEach((b) => (mapa[b.bloco] = b.conteudo))
        setBlocos(mapa)
        salvosRef.current = { ...mapa }
      })
      .catch((err) => setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao carregar o canvas." }))
      .finally(() => setCarregando(false))
  }, [idStartup])

  // Limpa os debounces pendentes ao desmontar.
  useEffect(() => () => Object.values(timersRef.current).forEach(clearTimeout), [])

  const salvarBloco = async (chave, conteudo) => {
    if ((salvosRef.current[chave] || "") === conteudo) {
      setStatusBlocos((s) => ({ ...s, [chave]: "saved" }))
      return
    }
    try {
      await api.put(`/startups/${idStartup}/canvas/${chave}`, { conteudo })
      salvosRef.current[chave] = conteudo
      setStatusBlocos((s) => ({ ...s, [chave]: "saved" }))
    } catch {
      setStatusBlocos((s) => ({ ...s, [chave]: "error" }))
    }
  }

  const aoDigitar = (chave, valor) => {
    setBlocos((b) => ({ ...b, [chave]: valor }))
    setStatusBlocos((s) => ({ ...s, [chave]: "saving" }))
    clearTimeout(timersRef.current[chave])
    timersRef.current[chave] = setTimeout(() => salvarBloco(chave, valor), ATRASO_AUTOSAVE_MS)
  }

  const aoSairDoCampo = (chave, valor) => {
    if (!timersRef.current[chave]) return
    clearTimeout(timersRef.current[chave])
    delete timersRef.current[chave]
    salvarBloco(chave, valor)
  }

  const focarBloco = (chave) => {
    const area = areasRef.current[chave]
    if (!area) return
    area.scrollIntoView({ behavior: "smooth", block: "center" })
    area.focus({ preventScroll: true })
  }

  const preenchidos = useMemo(
    () => BLOCOS_CANVAS.filter((b) => (blocos[b.chave] || "").trim().length > 0).length,
    [blocos]
  )
  const progresso = Math.round((preenchidos / BLOCOS_CANVAS.length) * 100)
  const salvando = Object.values(statusBlocos).some((s) => s === "saving")
  const comErro = Object.values(statusBlocos).some((s) => s === "error")

  if (carregando) return <CanvasSkeleton />

  const blocoAjuda = ajuda ? BLOCOS_CANVAS.find((b) => b.chave === ajuda.bloco) : null

  return (
    <Box>
      {aviso && (
        <Alert severity={aviso.tipo} sx={{ mb: 2 }} onClose={() => setAviso(null)}>
          {aviso.texto}
        </Alert>
      )}

      {/* Cabecalho: progresso + status do salvamento automatico */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2, flexWrap: "wrap" }}>
        <Box sx={{ flex: 1, minWidth: 220 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
            <Typography variant="body2" fontWeight={600}>
              Canvas preenchido
            </Typography>
            <Typography variant="body2" fontWeight={700} color="primary.main">
              {progresso}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progresso}
            sx={{ height: 8, borderRadius: 4, bgcolor: (t) => alpha(t.palette.primary.main, 0.1) }}
          />
        </Box>
        <IndicadorAutoSave salvando={salvando} comErro={comErro} />
      </Box>

      {/* Legenda das zonas classicas do canvas */}
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 1.5 }}>
        {ZONAS_CANVAS.map((z) => (
          <Box key={z.nome} sx={{ display: "flex", alignItems: "center", gap: 0.7 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: z.cor }} />
            <Typography variant="caption" color="text.secondary">
              {z.nome}
            </Typography>
          </Box>
        ))}
      </Box>

      <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
        {/* Grade do canvas */}
        <Box sx={GRADE_SX}>
          {BLOCOS_CANVAS.map((bloco, i) => (
            <BlocoCanvas
              key={bloco.chave}
              bloco={bloco}
              indice={i}
              minRows={linhasMinimas(bloco.area)}
              valor={blocos[bloco.chave] || ""}
              status={statusBlocos[bloco.chave]}
              inputRef={(el) => (areasRef.current[bloco.chave] = el)}
              onDigitar={aoDigitar}
              onSair={aoSairDoCampo}
              onAjuda={(ancora) => setAjuda({ ancora, bloco: bloco.chave })}
            />
          ))}
        </Box>

        {/* Checklist lateral */}
        <ChecklistCanvas blocos={blocos} preenchidos={preenchidos} progresso={progresso} onIr={focarBloco} />
      </Box>

      {/* Ajuda contextual do bloco */}
      <Popover
        open={Boolean(ajuda)}
        anchorEl={ajuda?.ancora}
        onClose={() => setAjuda(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
        slotProps={{ paper: { sx: { maxWidth: 360, p: 2.5, borderRadius: 3 } } }}
      >
        {blocoAjuda && <ConteudoAjuda bloco={blocoAjuda} />}
      </Popover>
    </Box>
  )
}

function IndicadorAutoSave({ salvando, comErro }) {
  if (comErro) {
    return (
      <Chip
        size="small"
        icon={<CloudOffOutlinedIcon />}
        label="Erro ao salvar — revise sua conexão"
        color="warning"
        variant="outlined"
      />
    )
  }
  if (salvando) {
    return (
      <Chip
        size="small"
        icon={<CircularProgress size={12} thickness={5} sx={{ ml: 0.5 }} />}
        label="Salvando..."
        variant="outlined"
        sx={{ color: "text.secondary" }}
      />
    )
  }
  return (
    <Chip
      size="small"
      icon={<CloudDoneOutlinedIcon sx={{ fontSize: 16 }} />}
      label="Salvo automaticamente"
      variant="outlined"
      sx={{ color: "success.main", borderColor: (t) => alpha(t.palette.success.main, 0.4), "& .MuiChip-icon": { color: "success.main" } }}
    />
  )
}

function BlocoCanvas({ bloco, indice, minRows, valor, status, inputRef, onDigitar, onSair, onAjuda }) {
  const Icone = bloco.icone
  return (
    <Box component={motion.div} sx={{ gridArea: bloco.area, display: "flex", minWidth: 0 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, delay: indice * 0.03 }}
    >
      <Paper
        elevation={0}
        square
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          bgcolor: (t) => alpha(bloco.acento, t.palette.mode === "dark" ? 0.1 : 0.05),
          borderTop: `3px solid ${bloco.acento}`,
          transition: "background-color .15s ease",
          "&:hover": { bgcolor: (t) => alpha(bloco.acento, t.palette.mode === "dark" ? 0.17 : 0.09) },
          "&:focus-within": {
            bgcolor: (t) => alpha(bloco.acento, t.palette.mode === "dark" ? 0.2 : 0.11),
            boxShadow: (t) => `inset 0 0 0 2px ${alpha(bloco.acento, 0.4)}`,
          },
        }}
      >
        <Box sx={{ px: 1.5, pt: 1.25 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Box
              sx={{
                width: 26,
                height: 26,
                borderRadius: 1.5,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                bgcolor: alpha(bloco.acento, 0.12),
                color: bloco.acento,
              }}
            >
              <Icone sx={{ fontSize: 16 }} />
            </Box>
            <IconButton
              size="small"
              aria-label={`Ajuda sobre ${bloco.titulo}`}
              onClick={(e) => onAjuda(e.currentTarget)}
              sx={{ color: "text.disabled", p: 0.5, "&:hover": { color: bloco.acento } }}
            >
              <HelpOutlineIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
          <Typography
            variant="subtitle2"
            fontWeight={700}
            sx={{ lineHeight: 1.25, fontSize: 13, mt: 0.5 }}
            title={bloco.titulo}
          >
            {bloco.curto}
          </Typography>
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ px: 1.5, mt: 0.25 }}>
          {bloco.pergunta}
        </Typography>

        <InputBase
          multiline
          minRows={minRows}
          fullWidth
          value={valor}
          placeholder={bloco.placeholder}
          inputRef={inputRef}
          onChange={(e) => onDigitar(bloco.chave, e.target.value)}
          onBlur={(e) => onSair(bloco.chave, e.target.value)}
          sx={{
            px: 1.5,
            py: 1,
            flex: 1,
            alignItems: "flex-start",
            fontSize: 13.5,
            lineHeight: 1.65,
            "& textarea::placeholder": { fontSize: 12.5, opacity: 0.65 },
          }}
        />

        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 1.5, pb: 1 }}>
          <Typography variant="caption" color="text.disabled">
            {valor.length > 0 ? `${valor.length} caracteres` : " "}
          </Typography>
          <StatusBloco status={status} />
        </Box>
      </Paper>
    </Box>
  )
}

function StatusBloco({ status }) {
  if (status === "saving") {
    return (
      <Typography variant="caption" color="text.disabled" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <CircularProgress size={10} thickness={5} /> salvando
      </Typography>
    )
  }
  if (status === "saved") {
    return (
      <Typography variant="caption" color="success.main" sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
        <CheckRoundedIcon sx={{ fontSize: 13 }} /> salvo
      </Typography>
    )
  }
  if (status === "error") {
    return (
      <Typography variant="caption" color="error.main">
        erro ao salvar
      </Typography>
    )
  }
  return null
}

function ChecklistCanvas({ blocos, preenchidos, progresso, onIr }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        width: 230,
        flexShrink: 0,
        borderRadius: 0,
        p: 2,
        position: "sticky",
        top: 16,
        display: { xs: "none", lg: "block" },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
        <Box sx={{ position: "relative", display: "inline-flex" }}>
          <CircularProgress
            variant="determinate"
            value={100}
            size={44}
            thickness={4}
            sx={{ color: (t) => alpha(t.palette.primary.main, 0.12) }}
          />
          <CircularProgress
            variant="determinate"
            value={progresso}
            size={44}
            thickness={4}
            sx={{ position: "absolute", left: 0 }}
          />
          <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
            <Typography variant="caption" fontWeight={700} sx={{ fontSize: 10.5 }}>
              {progresso}%
            </Typography>
          </Box>
        </Box>
        <Box>
          <Typography variant="subtitle2" fontWeight={700}>
            Seu Canvas
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {preenchidos} de {BLOCOS_CANVAS.length} blocos
          </Typography>
        </Box>
      </Box>

      <List dense disablePadding>
        {BLOCOS_CANVAS.map((b) => {
          const feito = (blocos[b.chave] || "").trim().length > 0
          return (
            <ListItemButton key={b.chave} onClick={() => onIr(b.chave)} sx={{ borderRadius: 2, px: 1, py: 0.4 }}>
              <ListItemIcon sx={{ minWidth: 28 }}>
                {feito ? (
                  <CheckCircleRoundedIcon sx={{ fontSize: 18, color: "success.main" }} />
                ) : (
                  <RadioButtonUncheckedIcon sx={{ fontSize: 18, color: "text.disabled" }} />
                )}
              </ListItemIcon>
              <ListItemText
                primary={b.curto}
                primaryTypographyProps={{
                  variant: "body2",
                  color: feito ? "text.primary" : "text.secondary",
                  fontWeight: feito ? 600 : 400,
                }}
              />
            </ListItemButton>
          )
        })}
      </List>

      {progresso === 100 && (
        <Typography variant="caption" sx={{ display: "block", mt: 1, color: "success.main", fontWeight: 600 }}>
          Canvas completo! Revise os blocos com seu mentor.
        </Typography>
      )}
    </Paper>
  )
}

function ConteudoAjuda({ bloco }) {
  return (
    <>
      <Typography variant="subtitle2" fontWeight={700} gutterBottom>
        {bloco.titulo}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {bloco.ajuda.oQueE}
      </Typography>

      <Typography variant="caption" fontWeight={700} color="text.primary">
        Exemplos reais
      </Typography>
      <Box component="ul" sx={{ m: 0, mb: 1.5, pl: 2.25 }}>
        {bloco.ajuda.exemplos.map((ex) => (
          <Typography key={ex} component="li" variant="caption" color="text.secondary" sx={{ lineHeight: 1.7 }}>
            {ex}
          </Typography>
        ))}
      </Box>

      <Typography variant="caption" fontWeight={700} color="text.primary">
        Erros comuns
      </Typography>
      <Box component="ul" sx={{ m: 0, mb: 1.5, pl: 2.25 }}>
        {bloco.ajuda.errosComuns.map((erro) => (
          <Typography key={erro} component="li" variant="caption" color="text.secondary" sx={{ lineHeight: 1.7 }}>
            {erro}
          </Typography>
        ))}
      </Box>

      <Box
        sx={{
          display: "flex",
          gap: 1,
          p: 1.25,
          borderRadius: 2,
          bgcolor: (t) => alpha(t.palette.primary.main, 0.06),
        }}
      >
        <TipsAndUpdatesOutlinedIcon sx={{ fontSize: 18, color: "primary.main", mt: 0.25 }} />
        <Typography variant="caption" sx={{ lineHeight: 1.6 }}>
          {bloco.ajuda.dica}
        </Typography>
      </Box>
    </>
  )
}

function CanvasSkeleton() {
  return (
    <Box>
      <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
        <Skeleton variant="rounded" height={32} sx={{ flex: 1 }} />
        <Skeleton variant="rounded" height={32} width={160} />
      </Box>
      <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
        <Box sx={GRADE_SX}>
          {BLOCOS_CANVAS.map((b) => (
            <Skeleton key={b.chave} variant="rounded" sx={{ gridArea: b.area, minHeight: 150, height: "100%" }} />
          ))}
        </Box>
        <Skeleton variant="rounded" width={230} height={340} sx={{ display: { xs: "none", lg: "block" }, flexShrink: 0 }} />
      </Box>
    </Box>
  )
}
