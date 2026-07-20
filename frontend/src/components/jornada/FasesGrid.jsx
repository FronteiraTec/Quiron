/**
 * Tela inicial da Jornada: cartoes de FASE (estagio), na ordem da trilha.
 *
 * Fases ja alcancadas mostram progresso e sao clicaveis; fases ainda nao
 * alcancadas aparecem BLOQUEADAS (esmaecidas, com cadeado e o requisito),
 * ja que o incubado so entra nelas quando a fase anterior avanca o
 * suficiente. Ao clicar numa fase desbloqueada, o incubado ve os modulos e
 * atividades dela (proxima tela).
 */
import { Box, Typography, LinearProgress, Chip, Tooltip } from "@mui/material"
import { Lock, ArrowForward } from "@mui/icons-material"
import { motion } from "framer-motion"
import { STATUS_ESTAGIO } from "../../data/jornadaMeta"

export default function FasesGrid({ estagios, progressoEstagio, faseSugeridaId, onSelecionar }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "1fr 1fr 1fr" },
        gap: 2.5,
      }}
    >
      {estagios.map((est, i) => {
        const meta = STATUS_ESTAGIO[est.status]
        const Icone = meta.icon
        const bloqueado = est.status === "BLOQUEADO"
        const prog = progressoEstagio(est)
        const nModulos = new Set(est.passos.map((p) => p.frente || "Geral")).size
        const sugerida = !bloqueado && est.id === faseSugeridaId

        return (
          <Box
            key={est.id}
            component={motion.div}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: i * 0.04 }}
            whileHover={bloqueado ? undefined : { y: -3 }}
            onClick={() => !bloqueado && onSelecionar(est.id)}
            sx={{
              position: "relative",
              p: 2.75,
              borderRadius: 3,
              border: "1px solid",
              borderColor: sugerida ? "primary.main" : "divider",
              bgcolor: "background.paper",
              cursor: bloqueado ? "default" : "pointer",
              opacity: bloqueado ? 0.6 : 1,
              transition: "border-color .15s, box-shadow .15s",
              boxShadow: sugerida ? 3 : 0,
              "&:hover": bloqueado ? {} : { borderColor: "primary.main", boxShadow: 2 },
            }}
          >
            {/* Numero da fase + icone de status */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 1.5 }}>
              <Box
                sx={{
                  display: "grid",
                  placeItems: "center",
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  bgcolor: `${meta.cor}1f`,
                  color: meta.cor,
                  flexShrink: 0,
                }}
              >
                {bloqueado ? <Lock sx={{ fontSize: 20 }} /> : <Icone sx={{ fontSize: 20 }} />}
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
                  FASE {i + 1}
                </Typography>
                <Typography sx={{ fontWeight: 800, fontSize: 16.5, lineHeight: 1.2 }}>
                  {est.nome}
                </Typography>
              </Box>
              {sugerida && (
                <Chip
                  label="Continuar"
                  size="small"
                  color="primary"
                  sx={{ fontWeight: 700, height: 22 }}
                />
              )}
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: 40 }}>
              {est.resumo}
            </Typography>

            {bloqueado ? (
              <Tooltip title={est.requisito || "Conclua a fase anterior para desbloquear."} arrow>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.75,
                    px: 1.25,
                    py: 0.75,
                    borderRadius: 1.5,
                    bgcolor: "action.hover",
                    color: "text.secondary",
                  }}
                >
                  <Lock sx={{ fontSize: 15 }} />
                  <Typography variant="caption" sx={{ fontWeight: 600 }} noWrap>
                    {est.requisito || "Bloqueada"}
                  </Typography>
                </Box>
              </Tooltip>
            ) : (
              <>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                  <LinearProgress
                    variant="determinate"
                    value={prog.pct}
                    sx={{
                      flex: 1,
                      height: 7,
                      borderRadius: 4,
                      bgcolor: "action.hover",
                      "& .MuiLinearProgress-bar": { bgcolor: meta.cor },
                    }}
                  />
                  <Typography variant="caption" sx={{ fontWeight: 800 }}>
                    {prog.pct}%
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Typography variant="caption" color="text.secondary">
                    {prog.total > 0
                      ? `${nModulos} modulo${nModulos !== 1 ? "s" : ""} · ${prog.total} atividade${prog.total !== 1 ? "s" : ""}`
                      : "Sem atividades ainda"}
                  </Typography>
                  <ArrowForward sx={{ fontSize: 15, color: "text.disabled" }} />
                </Box>
              </>
            )}
          </Box>
        )
      })}
    </Box>
  )
}
