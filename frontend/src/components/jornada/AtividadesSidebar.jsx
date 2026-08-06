/**
 * Navegador do MODULO aberto (coluna esquerda): lista as ATIVIDADES dele.
 *
 * O incubado ja escolheu a fase e o modulo (telas anteriores); aqui ve so as
 * atividades desse modulo, cada uma com seu estado (StatusPasso). Clicar
 * abre o conteudo da atividade no centro.
 */
import { Box, Typography } from "@mui/material"
import { motion } from "framer-motion"
import StatusPasso from "./StatusPasso"

export default function AtividadesSidebar({ passos, selecionadoId, onSelecionar }) {
  if (!passos.length) {
    return (
      <Box sx={{ p: 2.5, color: "text.secondary" }}>
        <Typography variant="body2">Nenhuma atividade cadastrada neste módulo ainda.</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ height: "100%", overflowY: "auto", py: 1.5 }}>
      {passos.map((p) => {
        const ativo = p.id === selecionadoId
        return (
          <Box
            key={p.id}
            component={motion.div}
            whileHover={{ x: 2 }}
            onClick={() => onSelecionar(p.id)}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              mx: 1,
              px: 1.5,
              py: 1,
              borderRadius: 1.5,
              cursor: "pointer",
              position: "relative",
              bgcolor: ativo ? "action.selected" : "transparent",
              "&:hover": { bgcolor: "action.hover" },
            }}
          >
            {ativo && (
              <Box
                component={motion.div}
                layoutId="atividade-ativa"
                sx={{
                  position: "absolute",
                  left: 0,
                  top: 8,
                  bottom: 8,
                  width: 3,
                  borderRadius: 2,
                  bgcolor: "primary.main",
                }}
              />
            )}
            <StatusPasso status={p.entrega.status} size={18} />
            <Typography
              sx={{
                fontSize: 13.5,
                fontWeight: ativo ? 700 : 500,
                color: ativo ? "text.primary" : "text.secondary",
                lineHeight: 1.3,
              }}
            >
              {p.titulo}
            </Typography>
          </Box>
        )
      })}
    </Box>
  )
}
