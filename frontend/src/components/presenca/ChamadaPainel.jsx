/**
 * Coluna direita da tela de Presenca: a lista de chamada de um evento.
 *
 * Quem aparece aqui e o PUBLICO do evento (membros ativos das startups
 * convidadas), nao quem confirmou — a chamada existe justamente para registrar
 * quem apareceu sem ter confirmado e quem confirmou e nao foi.
 *
 * Tres estados por pessoa, e a diferenca entre dois deles importa:
 *   presente = true   -> esteve la
 *   presente = false  -> faltou (foi conferido)
 *   sem linha (null)  -> ainda nao foi conferido
 * "Faltou" e "ainda nao conferi" nao sao a mesma coisa, e o relatorio de
 * engajamento so conta como presenca o primeiro caso.
 */
import { useMemo, useState } from "react"
import {
  Box,
  Typography,
  Avatar,
  Chip,
  Button,
  TextField,
  InputAdornment,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Alert,
  CircularProgress,
  Divider,
} from "@mui/material"
import { Search, HowToReg, EventAvailable } from "@mui/icons-material"
import { useCategorias } from "../calendar/categorias"

// Como cada resposta ao convite (RSVP) aparece na chamada. `null` = nao
// respondeu, que e o caso mais comum e por isso nao vira chip nenhum.
const RSVP = {
  CONFIRMADO: { label: "Confirmou", cor: "success" },
  RECUSADO: { label: "Recusou", cor: "default" },
  TALVEZ: { label: "Talvez", cor: "warning" },
}

function inicial(nome) {
  return (nome || "?").trim().charAt(0).toUpperCase()
}

/** Uma pessoa da chamada. */
function LinhaPessoa({ pessoa, salvando, onMarcar }) {
  const rsvp = RSVP[pessoa.confirmacao]
  const estado = pessoa.presente === true ? "presente" : pessoa.presente === false ? "ausente" : null

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: 3,
        py: 1.25,
        borderTop: "1px solid",
        borderColor: "divider",
        opacity: salvando ? 0.6 : 1,
        transition: "opacity .15s",
      }}
    >
      <Avatar
        src={pessoa.foto_url || undefined}
        sx={{ width: 34, height: 34, fontSize: 14, bgcolor: "primary.main", flexShrink: 0 }}
      >
        {inicial(pessoa.nome)}
      </Avatar>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography fontWeight={600} noWrap>
          {pessoa.nome}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap component="div">
          {(pessoa.startups || []).map((s) => s.nome).join(", ")}
        </Typography>
      </Box>

      {rsvp && (
        <Chip size="small" variant="outlined" label={rsvp.label} color={rsvp.cor} sx={{ flexShrink: 0 }} />
      )}

      {pessoa.checkin_ts && pessoa.marcado_por_nome && (
        <Tooltip
          title={`Marcado por ${pessoa.marcado_por_nome} em ${new Date(
            pessoa.checkin_ts
          ).toLocaleString("pt-BR")}`}
          arrow
        >
          <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
            ⓘ
          </Typography>
        </Tooltip>
      )}

      <ToggleButtonGroup
        size="small"
        exclusive
        value={estado}
        onChange={(_, novo) => {
          // Clicar no botao ja ativo devolve null: tratamos como "sem mudanca"
          // em vez de desmarcar, porque nao ha como voltar ao estado "nao
          // conferido" depois de gravar a linha.
          if (novo) onMarcar(pessoa.id_usuario, novo === "presente")
        }}
        sx={{ flexShrink: 0 }}
      >
        <ToggleButton
          value="presente"
          sx={{
            textTransform: "none",
            px: 1.5,
            "&.Mui-selected": {
              bgcolor: "success.main",
              color: "success.contrastText",
              "&:hover": { bgcolor: "success.dark" },
            },
          }}
        >
          Presente
        </ToggleButton>
        <ToggleButton
          value="ausente"
          sx={{
            textTransform: "none",
            px: 1.5,
            "&.Mui-selected": {
              bgcolor: "text.disabled",
              color: "background.paper",
              "&:hover": { bgcolor: "text.secondary" },
            },
          }}
        >
          Faltou
        </ToggleButton>
      </ToggleButtonGroup>
    </Box>
  )
}

export default function ChamadaPainel({ chamada, carregando, salvandoIds, onMarcar }) {
  const [busca, setBusca] = useState("")
  const [filtroStartup, setFiltroStartup] = useState("todas")
  const [erro, setErro] = useState(null)
  const { categoriaInfo } = useCategorias()

  const evento = chamada?.evento
  const publico = useMemo(() => chamada?.publico || [], [chamada])

  // As startups do filtro saem do proprio publico: so faz sentido filtrar por
  // quem foi convidado para ESTE evento.
  const startups = useMemo(() => {
    const mapa = new Map()
    for (const p of publico) {
      for (const s of p.startups || []) mapa.set(s.id_startup, s.nome)
    }
    return [...mapa.entries()]
      .map(([id_startup, nome]) => ({ id_startup, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [publico])

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return publico.filter((p) => {
      if (filtroStartup !== "todas") {
        const pertence = (p.startups || []).some((s) => String(s.id_startup) === String(filtroStartup))
        if (!pertence) return false
      }
      if (termo && !`${p.nome} ${p.email}`.toLowerCase().includes(termo)) return false
      return true
    })
  }, [publico, busca, filtroStartup])

  const presentes = useMemo(() => publico.filter((p) => p.presente === true).length, [publico])
  const naoConferidos = useMemo(() => publico.filter((p) => p.presente == null).length, [publico])

  // As acoes em lote agem sobre o que esta VISIVEL: se o admin filtrou por uma
  // startup, "marcar confirmados" nao pode sair marcando gente que ele nem esta
  // vendo. Por isso os rotulos trazem o numero.
  const confirmadosPendentes = useMemo(
    () => visiveis.filter((p) => p.confirmacao === "CONFIRMADO" && p.presente !== true),
    [visiveis]
  )
  const semMarcacao = useMemo(() => visiveis.filter((p) => p.presente == null), [visiveis])

  const marcarLote = async (pessoas, presente) => {
    setErro(null)
    try {
      await onMarcar(pessoas.map((p) => p.id_usuario), presente)
    } catch (err) {
      setErro(err.response?.data?.erro || "Não foi possível marcar a presença.")
    }
  }

  const marcarUm = async (idUsuario, presente) => {
    setErro(null)
    try {
      await onMarcar([idUsuario], presente)
    } catch (err) {
      setErro(err.response?.data?.erro || "Não foi possível marcar a presença.")
    }
  }

  if (!evento) {
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
          <HowToReg sx={{ fontSize: 56, opacity: 0.35 }} />
          <Typography sx={{ mt: 1 }}>Selecione um evento para fazer a chamada.</Typography>
        </Box>
      </Box>
    )
  }

  const meta = categoriaInfo(evento.categoria)

  return (
    <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflowY: "auto" }}>
      {/* ---- Cabecalho: qual evento ---- */}
      <Box sx={{ px: 3, py: 2.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <meta.Icone sx={{ fontSize: 20, color: meta.cor }} />
          <Typography variant="h6" fontWeight={700} noWrap>
            {evento.titulo}
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          {new Date(evento.inicio_ts).toLocaleString("pt-BR", {
            day: "2-digit",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
          {evento.local ? ` · ${evento.local}` : ""}
        </Typography>

        <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mt: 1.5, flexWrap: "wrap" }}>
          <Typography variant="h5" fontWeight={700}>
            {presentes}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            de {publico.length} {publico.length === 1 ? "convidado" : "convidados"} presentes
          </Typography>
          {naoConferidos > 0 && (
            <Typography variant="body2" sx={{ color: "#f97316", fontWeight: 700 }}>
              · {naoConferidos} sem conferir
            </Typography>
          )}
        </Box>
      </Box>

      <Divider />

      {/* ---- Filtros + acoes em lote ---- */}
      <Box sx={{ px: 3, py: 2, display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
        <TextField
          placeholder="Buscar pessoa..."
          size="small"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          sx={{ flex: 1, minWidth: 200 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          select
          size="small"
          value={filtroStartup}
          onChange={(e) => setFiltroStartup(e.target.value)}
          sx={{ minWidth: 170 }}
        >
          <MenuItem value="todas">Todas as startups</MenuItem>
          {startups.map((s) => (
            <MenuItem key={s.id_startup} value={String(s.id_startup)}>
              {s.nome}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      <Box sx={{ px: 3, pb: 2, display: "flex", gap: 1, flexWrap: "wrap" }}>
        <Tooltip title="Quem respondeu que ia e ainda não foi marcado como presente" arrow>
          <span>
            <Button
              size="small"
              variant="outlined"
              startIcon={<EventAvailable />}
              disabled={confirmadosPendentes.length === 0}
              onClick={() => marcarLote(confirmadosPendentes, true)}
              sx={{ textTransform: "none" }}
            >
              Presentes os {confirmadosPendentes.length} que confirmaram
            </Button>
          </span>
        </Tooltip>
        <Tooltip title="Fecha a chamada: quem não foi conferido vira falta" arrow>
          <span>
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              disabled={semMarcacao.length === 0}
              onClick={() => marcarLote(semMarcacao, false)}
              sx={{ textTransform: "none" }}
            >
              Faltou quem sobrou ({semMarcacao.length})
            </Button>
          </span>
        </Tooltip>
      </Box>

      {erro && (
        <Alert severity="error" sx={{ mx: 3, mb: 2 }} onClose={() => setErro(null)}>
          {erro}
        </Alert>
      )}

      {/* ---- A chamada ---- */}
      {carregando ? (
        <Box sx={{ textAlign: "center", py: 6 }}>
          <CircularProgress size={28} />
        </Box>
      ) : visiveis.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 6, px: 4, color: "text.secondary" }}>
          <HowToReg sx={{ fontSize: 44, opacity: 0.35 }} />
          <Typography sx={{ mt: 1 }}>
            {publico.length === 0
              ? "Nenhum convidado para este evento."
              : "Ninguém corresponde ao filtro."}
          </Typography>
          {publico.length === 0 && (
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              O público são os membros ativos das startups convidadas — sem
              membros ativos, não há chamada a fazer.
            </Typography>
          )}
        </Box>
      ) : (
        <Box>
          {visiveis.map((p) => (
            <LinhaPessoa
              key={p.id_usuario}
              pessoa={p}
              salvando={salvandoIds.has(p.id_usuario)}
              onMarcar={marcarUm}
            />
          ))}
        </Box>
      )}
    </Box>
  )
}
