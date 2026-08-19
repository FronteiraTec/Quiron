/**
 * Coluna direita da tela de Mentores: as startups de um mentor.
 *
 * E aqui que o vinculo mentor <-> startup e criado e desfeito. Esse vinculo
 * nao e decorativo: ele decide o que o mentor enxerga (a fila em
 * entregaService.listarFila) e o que ele pode responder
 * (avaliacaoService.garantirPodeAvaliar). Vincular da acesso; desvincular tira.
 *
 * Por isso o desvincular pede confirmacao e diz o que vai acontecer com as
 * entregas que ainda esperam resposta — elas somem da fila dele.
 */
import { useState } from "react"
import {
  Box,
  Typography,
  Avatar,
  Chip,
  Button,
  IconButton,
  TextField,
  MenuItem,
  Tooltip,
  Alert,
  CircularProgress,
  Divider,
} from "@mui/material"
import { SupervisorAccount, LinkOff, Add, RocketLaunch } from "@mui/icons-material"

import ConfirmDialog from "../programa/ConfirmDialog"
import ChipSituacao from "../startup/ChipSituacao"
import { formatarCelular } from "../../utils/mascaras"

function inicial(nome) {
  return (nome || "?").trim().charAt(0).toUpperCase()
}

/** Uma linha da lista de startups acompanhadas. */
function LinhaStartup({ startup, onRemover }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: 3,
        py: 1.5,
        borderTop: "1px solid",
        borderColor: "divider",
        "&:hover .acao-remover": { opacity: 1 },
      }}
    >
      <RocketLaunch sx={{ fontSize: 20, color: "text.secondary", flexShrink: 0 }} />

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography fontWeight={600} noWrap>
          {startup.nome}
        </Typography>
        {startup.pendentes > 0 && (
          <Typography variant="caption" sx={{ color: "#f97316", fontWeight: 700 }}>
            {startup.pendentes}{" "}
            {startup.pendentes === 1 ? "entrega aguardando" : "entregas aguardando"}
          </Typography>
        )}
      </Box>

      <ChipSituacao startup={startup} sx={{ flexShrink: 0 }} />

      <Tooltip title="Desvincular desta startup" arrow>
        <IconButton
          className="acao-remover"
          size="small"
          onClick={() => onRemover(startup)}
          sx={{ opacity: { xs: 1, md: 0.35 }, transition: "opacity .15s", flexShrink: 0 }}
        >
          <LinkOff fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  )
}

export default function MentorPainel({ mentor, detalhe, carregando, onVincular, onDesvincular }) {
  const [aVincular, setAVincular] = useState("")
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(null)
  const [confirmar, setConfirmar] = useState(null)

  if (!mentor) {
    return (
      <Box
        sx={{
          flex: 1,
          display: "grid",
          placeItems: "center",
          p: 4,
          color: "text.secondary",
          textAlign: "center",
        }}
      >
        <Box>
          <SupervisorAccount sx={{ fontSize: 56, opacity: 0.35 }} />
          <Typography sx={{ mt: 1 }}>Selecione um mentor para ver as startups dele.</Typography>
        </Box>
      </Box>
    )
  }

  const startups = detalhe?.startups || []
  const disponiveis = detalhe?.disponiveis || []

  const vincular = async () => {
    if (!aVincular) return
    setSalvando(true)
    setErro(null)
    try {
      await onVincular(mentor.id_usuario, aVincular)
      setAVincular("")
    } catch (err) {
      setErro(err.response?.data?.erro || "Não foi possível vincular a startup.")
    } finally {
      setSalvando(false)
    }
  }

  const desvincular = async () => {
    const alvo = confirmar
    setConfirmar(null)
    setErro(null)
    try {
      await onDesvincular(mentor.id_usuario, alvo.id_startup)
    } catch (err) {
      setErro(err.response?.data?.erro || "Não foi possível desvincular a startup.")
    }
  }

  return (
    <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflowY: "auto" }}>
      {/* ---- Cabecalho: quem e o mentor ---- */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, px: 3, py: 2.5 }}>
        <Avatar
          src={mentor.foto_url || undefined}
          sx={{ width: 52, height: 52, fontSize: 20, bgcolor: "primary.main" }}
        >
          {inicial(mentor.nome)}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" fontWeight={700} noWrap>
            {mentor.nome}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {mentor.email}
            {mentor.celular ? ` · ${formatarCelular(mentor.celular)}` : ""}
          </Typography>
          {mentor.desde && (
            <Typography variant="caption" color="text.secondary">
              Mentor desde {new Date(mentor.desde).toLocaleDateString("pt-BR")}
            </Typography>
          )}
        </Box>
      </Box>

      <Divider />

      {/* ---- Vincular a uma nova startup ---- */}
      <Box sx={{ px: 3, py: 2, display: "flex", gap: 1, alignItems: "flex-start" }}>
        <TextField
          select
          size="small"
          label="Vincular a uma startup"
          value={aVincular}
          onChange={(e) => setAVincular(e.target.value)}
          disabled={disponiveis.length === 0 || salvando}
          helperText={
            disponiveis.length === 0 ? "Este mentor já acompanha todas as startups." : " "
          }
          sx={{ flex: 1, maxWidth: 380 }}
        >
          {disponiveis.map((s) => (
            <MenuItem key={s.id_startup} value={s.id_startup}>
              {s.nome}
            </MenuItem>
          ))}
        </TextField>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={vincular}
          disabled={!aVincular || salvando}
          sx={{ textTransform: "none", boxShadow: "none", mt: 0.25 }}
        >
          Vincular
        </Button>
      </Box>

      {erro && (
        <Alert severity="error" sx={{ mx: 3, mb: 2 }} onClose={() => setErro(null)}>
          {erro}
        </Alert>
      )}

      {/* ---- Startups acompanhadas ---- */}
      <Typography
        variant="overline"
        color="text.secondary"
        sx={{ px: 3, letterSpacing: 0.6, fontWeight: 700 }}
      >
        Acompanha {startups.length} {startups.length === 1 ? "startup" : "startups"}
      </Typography>

      {carregando ? (
        <Box sx={{ textAlign: "center", py: 6 }}>
          <CircularProgress size={28} />
        </Box>
      ) : startups.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 6, px: 4, color: "text.secondary" }}>
          <RocketLaunch sx={{ fontSize: 44, opacity: 0.35 }} />
          <Typography sx={{ mt: 1 }}>Ainda não acompanha nenhuma startup.</Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            Enquanto isso, a fila de entregas dele fica vazia — ele não consegue
            avaliar ninguém.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ mt: 0.5 }}>
          {startups.map((s) => (
            <LinhaStartup key={s.id_startup} startup={s} onRemover={setConfirmar} />
          ))}
        </Box>
      )}

      <ConfirmDialog
        aberto={Boolean(confirmar)}
        titulo="Desvincular mentor"
        mensagem={
          confirmar
            ? `${mentor.nome} deixa de acompanhar a ${confirmar.nome} e perde o acesso para avaliar as entregas dela.` +
              (confirmar.pendentes > 0
                ? ` ${confirmar.pendentes} ${
                    confirmar.pendentes === 1 ? "entrega que espera" : "entregas que esperam"
                  } resposta ${confirmar.pendentes === 1 ? "sai" : "saem"} da fila dele.`
                : "")
            : ""
        }
        confirmarTexto="Desvincular"
        onConfirmar={desvincular}
        onCancelar={() => setConfirmar(null)}
      />
    </Box>
  )
}
