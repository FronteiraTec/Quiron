/**
 * Tela intermediaria da Jornada: MODULOS de uma fase, em cartoes.
 *
 * O incubado entra aqui depois de escolher uma fase e ANTES de abrir uma
 * atividade — precisa ver quais modulos a fase tem, nao cair direto numa
 * tarefa. Cada cartao mostra o modulo (`frente`), quantas atividades tem e
 * o progresso; clicar abre as atividades daquele modulo.
 */
import { Box, Typography, LinearProgress } from "@mui/material"
import { ViewModuleOutlined, ArrowForward } from "@mui/icons-material"
import { motion } from "framer-motion"
import StatusPasso from "./StatusPasso"
import { STATUS_CONCLUIDO } from "../../data/jornadaMeta"

export default function ModulosGrid({ modulos, onSelecionar }) {
  if (!modulos.length) {
    return (
      <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
        <ViewModuleOutlined sx={{ fontSize: 40, opacity: 0.4 }} />
        <Typography sx={{ mt: 1 }}>Nenhum módulo cadastrado nesta fase ainda.</Typography>
      </Box>
    )
  }

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "1fr 1fr 1fr" },
        gap: 2.5,
      }}
    >
      {modulos.map((mod, i) => {
        const total = mod.passos.length
        const feitos = mod.passos.filter((p) => STATUS_CONCLUIDO.includes(p.entrega.status)).length
        const pct = total ? Math.round((feitos / total) * 100) : 0

        return (
          <Box
            key={mod.nome}
            component={motion.div}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: i * 0.04 }}
            whileHover={{ y: -3 }}
            onClick={() => onSelecionar(mod.nome)}
            sx={{
              p: 2.75,
              borderRadius: 3,
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "background.paper",
              cursor: "pointer",
              transition: "border-color .15s, box-shadow .15s",
              "&:hover": { borderColor: "primary.main", boxShadow: 2 },
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 1.5 }}>
              <Box
                sx={{
                  display: "grid",
                  placeItems: "center",
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                  flexShrink: 0,
                }}
              >
                <ViewModuleOutlined sx={{ fontSize: 20 }} />
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
                  MÓDULO
                </Typography>
                <Typography sx={{ fontWeight: 800, fontSize: 16.5, lineHeight: 1.2 }}>
                  {mod.nome}
                </Typography>
              </Box>
            </Box>

            {/* Previa das atividades (ate 3) */}
            <Box sx={{ mb: 2 }}>
              {mod.passos.slice(0, 3).map((p) => (
                <Box key={p.id} sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.4 }}>
                  <StatusPasso status={p.entrega.status} size={15} />
                  <Typography variant="body2" color="text.secondary" noWrap sx={{ flex: 1 }}>
                    {p.titulo}
                  </Typography>
                </Box>
              ))}
              {total > 3 && (
                <Typography variant="caption" color="text.disabled" sx={{ pl: 2.75 }}>
                  +{total - 3} atividade{total - 3 !== 1 ? "s" : ""}
                </Typography>
              )}
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
              <LinearProgress
                variant="determinate"
                value={pct}
                sx={{ flex: 1, height: 7, borderRadius: 4, bgcolor: "action.hover" }}
              />
              <Typography variant="caption" sx={{ fontWeight: 800 }}>
                {pct}%
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Typography variant="caption" color="text.secondary">
                {feitos} de {total} atividade{total !== 1 ? "s" : ""} concluída{feitos !== 1 ? "s" : ""}
              </Typography>
              <ArrowForward sx={{ fontSize: 15, color: "text.disabled" }} />
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}
