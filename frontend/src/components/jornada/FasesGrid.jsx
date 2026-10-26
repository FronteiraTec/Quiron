/**
 * Tela inicial da Jornada: cartoes de FASE (estagio), na ordem da trilha.
 *
 * Cada fase e uma faixa larga no estilo "continue de onde parou": barra de
 * progresso fina no topo, faixa colorida a esquerda, icone + rotulo da fase,
 * o botao de acao a direita e, no rodape, a atividade em que a equipe parou.
 *
 * Fases ja alcancadas mostram progresso e sao clicaveis; fases ainda nao
 * alcancadas aparecem BLOQUEADAS (esmaecidas, com cadeado e o requisito),
 * ja que o incubado so entra nelas quando a fase anterior avanca o
 * suficiente. Ao clicar numa fase desbloqueada, o incubado ve os modulos e
 * atividades dela (proxima tela).
 */
import { Box, Typography, LinearProgress, Button, Tooltip } from "@mui/material"
import { Lock, PlayArrow, Replay } from "@mui/icons-material"
import { motion } from "framer-motion"
import { STATUS_ESTAGIO } from "../../data/jornadaMeta"

const LARGURA_FAIXA = 6 // faixa colorida na lateral esquerda do cartao

/**
 * A atividade em que a equipe parou dentro da fase: primeiro o que precisa de
 * ajuste, depois o rascunho, depois a primeira ainda nao iniciada. Mesma
 * ordem que o hook usa para sugerir o "proximo passo" da jornada inteira.
 */
function atividadeAtual(est) {
  const por = (status) => est.passos.find((p) => p.entrega.status === status)
  return por("AJUSTE") || por("RASCUNHO") || por("NAO_INICIADA") || null
}

export default function FasesGrid({ estagios, progressoEstagio, faseSugeridaId, onSelecionar }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {estagios.map((est, i) => {
        const meta = STATUS_ESTAGIO[est.status]
        const Icone = meta.icon
        const bloqueado = est.status === "BLOQUEADO"
        const prog = progressoEstagio(est)
        const nModulos = new Set(est.passos.map((p) => p.frente || "Geral")).size
        const sugerida = !bloqueado && est.id === faseSugeridaId
        const atual = bloqueado ? null : atividadeAtual(est)
        const concluida = !bloqueado && prog.total > 0 && prog.pct === 100

        return (
          <Box
            key={est.id}
            component={motion.div}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: i * 0.04 }}
            whileHover={bloqueado ? undefined : { y: -2 }}
            onClick={() => !bloqueado && onSelecionar(est.id)}
            sx={{
              position: "relative",
              overflow: "hidden",
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
            {/* Faixa colorida da lateral: a cor conta o estado da fase */}
            <Box
              sx={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: LARGURA_FAIXA,
                bgcolor: meta.cor,
              }}
            />

            <Box sx={{ pl: `${LARGURA_FAIXA + 24}px`, pr: 3, py: 2.5 }}>
              {/* Progresso da fase, fino, no topo */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2.25 }}>
                <LinearProgress
                  variant="determinate"
                  value={bloqueado ? 0 : prog.pct}
                  sx={{
                    flex: 1,
                    height: 4,
                    borderRadius: 4,
                    bgcolor: "action.hover",
                    "& .MuiLinearProgress-bar": { bgcolor: meta.cor },
                  }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                  {bloqueado ? "0" : prog.pct}%
                </Typography>
              </Box>

              {/* Linha principal: icone + fase + acao */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  flexWrap: { xs: "wrap", sm: "nowrap" },
                }}
              >
                <Box
                  sx={{
                    display: "grid",
                    placeItems: "center",
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    border: "2px solid",
                    borderColor: meta.cor,
                    bgcolor: `${meta.cor}1f`,
                    color: meta.cor,
                    flexShrink: 0,
                  }}
                >
                  {bloqueado ? <Lock sx={{ fontSize: 22 }} /> : <Icone sx={{ fontSize: 22 }} />}
                </Box>

                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary",
                      fontWeight: 700,
                      letterSpacing: 1,
                      textTransform: "uppercase",
                    }}
                  >
                    Fase {i + 1}
                  </Typography>
                  <Typography sx={{ fontWeight: 800, fontSize: 17, lineHeight: 1.25 }}>
                    {est.nome}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {est.resumo}
                  </Typography>
                </Box>

                {bloqueado ? (
                  <Tooltip
                    title={est.requisito || "Conclua a fase anterior para desbloquear."}
                    arrow
                  >
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.75,
                        px: 2,
                        py: 1.25,
                        borderRadius: 1.5,
                        bgcolor: "action.hover",
                        color: "text.secondary",
                        flexShrink: 0,
                      }}
                    >
                      <Lock sx={{ fontSize: 18 }} />
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        Bloqueada
                      </Typography>
                    </Box>
                  </Tooltip>
                ) : (
                  <Button
                    variant="contained"
                    disableElevation
                    startIcon={concluida ? <Replay /> : <PlayArrow />}
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelecionar(est.id)
                    }}
                    sx={{
                      flexShrink: 0,
                      px: 3,
                      py: 1.25,
                      borderRadius: 1.5,
                      textTransform: "none",
                      fontWeight: 700,
                      fontSize: 15,
                    }}
                  >
                    {concluida ? "Revisar fase" : sugerida ? "Continuar onde parou" : "Abrir fase"}
                  </Button>
                )}
              </Box>

              {/* Rodape: onde a equipe parou nesta fase */}
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }} noWrap>
                {bloqueado ? (
                  <>
                    <Box component="span" sx={{ fontWeight: 700, color: "text.primary" }}>
                      Para desbloquear:
                    </Box>{" "}
                    {est.requisito || "conclua a fase anterior."}
                  </>
                ) : prog.total === 0 ? (
                  "Sem atividades ainda"
                ) : (
                  <>
                    <Box component="span" sx={{ fontWeight: 700, color: "text.primary" }}>
                      {atual ? "Atividade atual:" : "Fase concluída:"}
                    </Box>{" "}
                    {atual ? atual.titulo : est.nome}, {nModulos} módulo
                    {nModulos !== 1 ? "s" : ""} · {prog.feitos}/{prog.total} atividade
                    {prog.total !== 1 ? "s" : ""}
                  </>
                )}
              </Typography>
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}
