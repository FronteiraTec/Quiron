/**
 * Quais trilhas UMA startup pode acessar.
 *
 * E o espelho de programa/StartupsDaTrilha: la se escolhe a turma de uma
 * trilha, aqui as trilhas de uma startup. Os endpoints sao os mesmos
 * (/trilha/:id/startups), so a pergunta muda de lado — por isso nao ha
 * backend novo.
 *
 * O estado de cada trilha sai de GET /trilha/:id/startups, uma chamada por
 * trilha. A incubadora tem poucas trilhas; um endpoint "trilhas da startup"
 * so para evitar tres requisicoes paralelas nao se pagava. (GET
 * /jornada/trilhas responderia, mas cobra vinculo com a startup, nao a
 * permissao da trilha — quem gere o programa sem ser admin levaria 403.)
 *
 * Ligar e desligar valem na hora, como no Construtor. Desligar tira a
 * matricula, NAO as entregas: elas apontam para os passos e voltam a aparecer
 * se a startup for matriculada de novo.
 */
import { useCallback, useEffect, useRef, useState } from "react"
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
  CircularProgress,
  Alert,
  Stack,
  Switch,
} from "@mui/material"
import { Close, AccountTree } from "@mui/icons-material"
import api from "../../services/api"

export default function DialogTrilhasStartup({ aberto, startup, trilhas = [], onFechar, onMudou }) {
  // { [id_no]: matricula | undefined } — a linha de startup_programa, se houver.
  const [matriculas, setMatriculas] = useState({})
  const [carregando, setCarregando] = useState(false)
  // Trilha cujo switch esta salvando, para nao aceitar clique duplo.
  const [salvando, setSalvando] = useState(null)
  const [erro, setErro] = useState(null)
  // A lista da pagina so recarrega ao fechar: recarregar a cada switch trocaria
  // a prop `trilhas` (contagens novas) e a lista daqui piscaria no meio do uso.
  const mudou = useRef(false)

  const idStartup = startup ? Number(startup.id_startup) : null

  // `silencioso` recarrega sem trocar a lista pelo spinner — depois de um
  // switch, o que se quer e ver o chip de status aparecer, nao a tela piscar.
  const carregar = useCallback(async ({ silencioso = false } = {}) => {
    if (!idStartup || trilhas.length === 0) {
      setMatriculas({})
      return
    }
    if (!silencioso) setCarregando(true)
    try {
      const respostas = await Promise.all(
        trilhas.map((t) => api.get(`/trilha/${t.id_no}/startups`))
      )
      const mapa = {}
      trilhas.forEach((t, i) => {
        mapa[t.id_no] = respostas[i].data.startups.find(
          (s) => Number(s.id_startup) === idStartup
        )
      })
      setMatriculas(mapa)
      setErro(null)
    } catch (err) {
      setErro(err.response?.data?.erro || "Erro ao carregar as trilhas da startup.")
    } finally {
      setCarregando(false)
    }
  }, [idStartup, trilhas])

  useEffect(() => {
    if (aberto) carregar()
  }, [aberto, carregar])

  const fechar = () => {
    setErro(null)
    if (mudou.current) onMudou?.()
    mudou.current = false
    onFechar?.()
  }

  const alternar = async (trilha) => {
    const matriculada = Boolean(matriculas[trilha.id_no])
    setSalvando(trilha.id_no)
    try {
      if (matriculada) {
        await api.delete(`/trilha/${trilha.id_no}/startups/${idStartup}`)
      } else {
        await api.post(`/trilha/${trilha.id_no}/startups`, { id_startup: idStartup })
      }
      mudou.current = true
      await carregar({ silencioso: true })
    } catch (err) {
      setErro(err.response?.data?.erro || "Não foi possível alterar a trilha.")
    } finally {
      setSalvando(null)
    }
  }

  const totalHabilitadas = Object.values(matriculas).filter(Boolean).length

  return (
    <Dialog
      open={aberto}
      onClose={fechar}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { height: "min(640px, calc(100% - 64px))" } }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
        <AccountTree sx={{ color: "primary.main" }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 17 }} noWrap>
            Trilhas da startup
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
            {startup?.nome}
          </Typography>
        </Box>
        <IconButton onClick={fechar} size="small">
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {erro && (
          <Alert severity="error" onClose={() => setErro(null)} sx={{ mb: 2, borderRadius: "6px" }}>
            {erro}
          </Alert>
        )}

        {trilhas.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
            Sua incubadora ainda não tem trilhas. Crie uma no Construtor de Programa.
          </Typography>
        ) : carregando ? (
          <Box sx={{ py: 5, display: "grid", placeItems: "center" }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              A startup só enxerga na Jornada as trilhas habilitadas. Desabilitar não apaga as
              entregas, elas voltam se a trilha for habilitada de novo.
            </Typography>

            <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
              HABILITADAS ({totalHabilitadas} DE {trilhas.length})
            </Typography>

            <Stack spacing={1} sx={{ mt: 1 }}>
              {trilhas.map((t) => {
                const m = matriculas[t.id_no]
                return (
                  <Box
                    key={t.id_no}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      p: 1.25,
                      borderRadius: 1.5,
                      border: "1px solid",
                      borderColor: m ? "primary.main" : "divider",
                    }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Typography sx={{ fontWeight: 600, fontSize: 14 }} noWrap>
                          {t.nome}
                        </Typography>
                        {t.padrao && (
                          <Chip
                            label="padrão"
                            size="small"
                            variant="outlined"
                            sx={{ height: 20, fontSize: 10.5 }}
                          />
                        )}
                        {!t.ativo && (
                          <Chip
                            label="inativa"
                            size="small"
                            sx={{ height: 20, fontSize: 10.5 }}
                          />
                        )}
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {t.fases} fase{t.fases === 1 ? "" : "s"} · {t.passos} passo
                        {t.passos === 1 ? "" : "s"}
                        {m && ` · desde ${new Date(m.inicio_ts).toLocaleDateString("pt-BR")}`}
                      </Typography>
                    </Box>

                    {m && (
                      <Chip
                        label={m.status === "CONCLUIDA" ? "concluída" : "em andamento"}
                        size="small"
                        color={m.status === "CONCLUIDA" ? "success" : "primary"}
                        variant={m.status === "CONCLUIDA" ? "filled" : "outlined"}
                        sx={{ height: 22, fontSize: 11, fontWeight: 600 }}
                      />
                    )}

                    <Switch
                      checked={Boolean(m)}
                      onChange={() => alternar(t)}
                      disabled={salvando !== null}
                      inputProps={{ "aria-label": `Habilitar a trilha ${t.nome}` }}
                    />
                  </Box>
                )
              })}
            </Stack>
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={fechar} sx={{ textTransform: "none" }}>
          Concluir
        </Button>
      </DialogActions>
    </Dialog>
  )
}
