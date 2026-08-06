/**
 * Painel direito do passo: o "impacto na empresa" e o contexto de progresso.
 *
 * Responde, sem o incubado precisar perguntar: o que isto muda na minha startup
 * (area do Blueprint), o que desbloqueia, que competencias desenvolve, quem e o
 * mentor e o historico da entrega. E o que transforma "tarefa" em "evolucao".
 */
import { Box, Typography, LinearProgress, Chip, Avatar, Divider, Stack } from "@mui/material"
import {
  Insights,
  LockOpen,
  School,
  History as HistoryIcon,
} from "@mui/icons-material"

const HIST_ROTULO = {
  criada: "Iniciada",
  rascunho: "Rascunho salvo",
  enviada: "Enviada para avaliação",
  aprovada: "Aprovada pelo mentor",
  ajuste: "Ajuste solicitado",
}

export default function PassoImpacto({ passo, mentor, progresso }) {
  return (
    <Box sx={{ height: "100%", overflowY: "auto", p: 2.5 }}>
      <Stack spacing={3}>
        {/* Progresso do modulo */}
        <Secao icone={<Insights sx={{ fontSize: 18 }} />} titulo="Progresso do módulo">
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <LinearProgress
              variant="determinate"
              value={progresso.pct}
              sx={{ flex: 1, height: 8, borderRadius: 4, bgcolor: "action.hover" }}
            />
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              {progresso.pct}%
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            {progresso.feitos} de {progresso.total} passos concluídos
          </Typography>
        </Secao>

        {/* Area da empresa que este passo constroi */}
        <Secao icone={<Insights sx={{ fontSize: 18 }} />} titulo="Constrói na sua empresa">
          <Chip
            label={passo.area}
            sx={{ fontWeight: 700, bgcolor: "primary.main", color: "primary.contrastText" }}
          />
        </Secao>

        {/* Desbloqueia */}
        {passo.desbloqueia?.length > 0 && (
          <Secao icone={<LockOpen sx={{ fontSize: 18 }} />} titulo="Desbloqueia depois">
            <Stack spacing={0.5}>
              {passo.desbloqueia.map((d) => (
                <Box key={d} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: "text.disabled" }} />
                  <Typography variant="body2">{d}</Typography>
                </Box>
              ))}
            </Stack>
          </Secao>
        )}

        {/* Competencias */}
        {passo.competencias?.length > 0 && (
          <Secao icone={<School sx={{ fontSize: 18 }} />} titulo="Competências">
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
              {passo.competencias.map((c) => (
                <Chip key={c} label={c} size="small" variant="outlined" />
              ))}
            </Box>
          </Secao>
        )}

        <Divider />

        {/* Mentor */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box sx={{ position: "relative" }}>
            <Avatar sx={{ width: 40, height: 40, bgcolor: "secondary.main" }}>
              {mentor.nome.charAt(0)}
            </Avatar>
            {mentor.online && (
              <Box
                sx={{
                  position: "absolute",
                  right: 0,
                  bottom: 0,
                  width: 11,
                  height: 11,
                  borderRadius: "50%",
                  bgcolor: "success.main",
                  border: "2px solid",
                  borderColor: "background.paper",
                }}
              />
            )}
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{mentor.nome}</Typography>
            <Typography variant="caption" color="text.secondary">
              Mentora {mentor.online ? "· disponível" : ""}
            </Typography>
          </Box>
        </Box>

        {/* Historico */}
        {passo.entrega.historico?.length > 0 && (
          <Secao icone={<HistoryIcon sx={{ fontSize: 18 }} />} titulo="Histórico">
            <Stack spacing={1}>
              {passo.entrega.historico.map((h, i) => (
                <Box key={i} sx={{ display: "flex", gap: 1.5 }}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      bgcolor: "primary.main",
                      mt: 0.6,
                      flexShrink: 0,
                    }}
                  />
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {HIST_ROTULO[h.tipo] || h.tipo}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {h.data}
                      {h.por ? ` · ${h.por}` : ""}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Stack>
          </Secao>
        )}
      </Stack>
    </Box>
  )
}

function Secao({ icone, titulo, children }) {
  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 1, color: "text.secondary" }}>
        {icone}
        <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.3 }}>
          {titulo.toUpperCase()}
        </Typography>
      </Box>
      {children}
    </Box>
  )
}
