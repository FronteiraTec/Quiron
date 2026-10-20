/**
 * Quais startups fazem esta trilha.
 *
 * Duas listas numa so tela: quem ja esta matriculado (com o status da
 * matricula) e quem ainda pode entrar. Matricular e desmatricular valem na
 * hora — nao ha botao Salvar, porque nao existe rascunho de turma.
 *
 * Desmatricular NAO apaga entregas: elas apontam para os passos e continuam
 * no banco. Por isso o aviso ao remover fala em "sai da trilha", e nao em
 * "perde o que fez".
 */
import { useCallback, useEffect, useState } from "react"
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Chip,
  Divider,
  CircularProgress,
  Tooltip,
  Alert,
  Stack,
} from "@mui/material"
import {
  Close,
  Groups,
  PersonRemove,
  AddCircleOutline,
  CheckCircle,
  RestartAlt,
} from "@mui/icons-material"
import api from "../../services/api"
import { useAuthStore } from "../../store/authStore"

export default function StartupsDaTrilha({ aberto, trilha, onFechar, onMudou }) {
  const idTenant = useAuthStore((s) => s.usuario?.id_tenant ?? null)

  const [matriculadas, setMatriculadas] = useState([])
  const [todas, setTodas] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState(null)

  const idTrilha = trilha?.id_no

  // `silencioso` recarrega sem trocar as listas pelo spinner — depois de
  // matricular ou tirar, a startup so muda de lista, a tela nao pisca.
  const carregar = useCallback(async ({ silencioso = false } = {}) => {
    if (!idTrilha || !idTenant) return
    if (!silencioso) setCarregando(true)
    try {
      const [r1, r2] = await Promise.all([
        api.get(`/trilha/${idTrilha}/startups`),
        api.get("/startups", { params: { id_tenant: idTenant } }),
      ])
      setMatriculadas(r1.data.startups)
      setTodas(r2.data.startups)
      setErro(null)
    } catch (err) {
      setErro(err.response?.data?.erro || "Erro ao carregar as startups.")
    } finally {
      setCarregando(false)
    }
  }, [idTrilha, idTenant])

  useEffect(() => {
    if (aberto) carregar()
  }, [aberto, carregar])

  const idsMatriculadas = new Set(matriculadas.map((s) => Number(s.id_startup)))
  const disponiveis = todas.filter((s) => !idsMatriculadas.has(Number(s.id_startup)))

  const agir = async (fn) => {
    try {
      await fn()
      await carregar({ silencioso: true })
      onMudou?.()
      setErro(null)
    } catch (err) {
      setErro(err.response?.data?.erro || "Não foi possível concluir a ação.")
    }
  }

  const matricular = (id) =>
    agir(() => api.post(`/trilha/${idTrilha}/startups`, { id_startup: id }))

  const desmatricular = (id) =>
    agir(() => api.delete(`/trilha/${idTrilha}/startups/${id}`))

  const alternarStatus = (s) =>
    agir(() =>
      api.patch(`/trilha/${idTrilha}/startups/${s.id_startup}`, {
        status: s.status === "CONCLUIDA" ? "EM_ANDAMENTO" : "CONCLUIDA",
      })
    )

  return (
    // Altura fixa: as listas rolam dentro do DialogContent, e o modal nao
    // cresce nem encolhe a cada startup que entra ou sai.
    <Dialog
      open={aberto}
      onClose={onFechar}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { height: "min(640px, calc(100% - 64px))" } }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
        <Groups sx={{ color: "primary.main" }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 17 }} noWrap>
            Startups desta trilha
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
            {trilha?.nome}
          </Typography>
        </Box>
        <IconButton onClick={onFechar} size="small">
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {erro && (
          <Alert severity="error" onClose={() => setErro(null)} sx={{ mb: 2, borderRadius: "6px" }}>
            {erro}
          </Alert>
        )}

        {carregando ? (
          <Box sx={{ py: 5, display: "grid", placeItems: "center" }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <>
            <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
              MATRICULADAS ({matriculadas.length})
            </Typography>

            {matriculadas.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                Nenhuma startup nesta trilha ainda.
              </Typography>
            ) : (
              <Stack spacing={1} sx={{ mt: 1, mb: 3 }}>
                {matriculadas.map((s) => (
                  <Box
                    key={s.id_startup}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      p: 1.25,
                      borderRadius: 1.5,
                      border: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 600, fontSize: 14 }} noWrap>
                        {s.nome}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Desde {new Date(s.inicio_ts).toLocaleDateString("pt-BR")}
                      </Typography>
                    </Box>

                    <Chip
                      label={s.status === "CONCLUIDA" ? "concluída" : "em andamento"}
                      size="small"
                      color={s.status === "CONCLUIDA" ? "success" : "primary"}
                      variant={s.status === "CONCLUIDA" ? "filled" : "outlined"}
                      sx={{ height: 22, fontSize: 11, fontWeight: 600 }}
                    />

                    <Tooltip
                      title={s.status === "CONCLUIDA" ? "Reabrir a trilha" : "Marcar como concluída"}
                      arrow
                    >
                      <IconButton size="small" onClick={() => alternarStatus(s)}>
                        {s.status === "CONCLUIDA" ? (
                          <RestartAlt sx={{ fontSize: 18 }} />
                        ) : (
                          <CheckCircle sx={{ fontSize: 18 }} />
                        )}
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Tirar da trilha (as entregas ficam)" arrow>
                      <IconButton
                        size="small"
                        onClick={() => desmatricular(s.id_startup)}
                        sx={{ color: "error.main" }}
                      >
                        <PersonRemove sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                ))}
              </Stack>
            )}

            <Divider sx={{ my: 2 }} />

            <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
              DISPONÍVEIS ({disponiveis.length})
            </Typography>

            {disponiveis.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                Todas as startups da incubadora já estão nesta trilha.
              </Typography>
            ) : (
              <Stack spacing={1} sx={{ mt: 1 }}>
                {disponiveis.map((s) => (
                  <Box
                    key={s.id_startup}
                    onClick={() => matricular(s.id_startup)}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      p: 1.25,
                      borderRadius: 1.5,
                      border: "1px solid",
                      borderColor: "divider",
                      cursor: "pointer",
                      "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
                    }}
                  >
                    <Typography sx={{ flex: 1, fontWeight: 500, fontSize: 14 }} noWrap>
                      {s.nome}
                    </Typography>
                    <AddCircleOutline sx={{ color: "primary.main", fontSize: 20 }} />
                  </Box>
                ))}
              </Stack>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onFechar} sx={{ textTransform: "none" }}>
          Concluir
        </Button>
      </DialogActions>
    </Dialog>
  )
}
