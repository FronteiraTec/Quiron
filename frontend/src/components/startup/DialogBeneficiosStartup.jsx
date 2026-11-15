/**
 * Os beneficios que a incubadora concede a UMA startup — hoje, o Mini CRM.
 *
 * Mesmo desenho do DialogTrilhasStartup: um switch por beneficio, que vale na
 * hora. Desligar REVOGA o acesso e preserva os dados: os membros deixam de ver
 * o CRM imediatamente, e tudo volta como estava se o beneficio for concedido de
 * novo. O dialogo diz isso antes do clique, e confirma antes de revogar.
 *
 * A coordenacao nao le o CRM da startup por aqui: clientes e negociacoes sao
 * dela. O unico numero que a incubadora ve e o faturamento em soma, no cadastro
 * da startup (FaturamentoStartup). Aqui so se liga e desliga.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Stack,
  Switch,
  Typography,
} from "@mui/material"
import { CardGiftcard, Close } from "@mui/icons-material"
import api from "../../services/api"

const dataBR = (ts) => (ts ? new Date(ts).toLocaleDateString("pt-BR") : "")

export default function DialogBeneficiosStartup({ aberto, startup, podeGerenciar = false, onFechar, onMudou }) {
  const [beneficios, setBeneficios] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando] = useState(null)
  const [erro, setErro] = useState(null)
  const [revogar, setRevogar] = useState(null)
  const mudou = useRef(false)
  const idStartup = startup?.id_startup

  const carregar = useCallback(async () => {
    if (!idStartup) return
    setCarregando(true)
    try {
      const { data } = await api.get(`/startups/${idStartup}/beneficios`)
      setBeneficios(data.beneficios)
      setErro(null)
    } catch (err) {
      setErro(err.response?.data?.erro || "Erro ao carregar os benefícios da startup.")
    } finally {
      setCarregando(false)
    }
  }, [idStartup])

  useEffect(() => {
    if (aberto) carregar()
  }, [aberto, carregar])

  const fechar = () => {
    setErro(null)
    if (mudou.current) onMudou?.()
    mudou.current = false
    onFechar?.()
  }

  const definir = async (beneficio, ativo) => {
    setSalvando(beneficio.chave)
    setRevogar(null)
    try {
      const { data } = await api.put(`/startups/${idStartup}/beneficios/${beneficio.chave}`, { ativo })
      setBeneficios((lista) => lista.map((b) => (b.chave === beneficio.chave ? data.beneficio : b)))
      mudou.current = true
      setErro(null)
    } catch (err) {
      setErro(err.response?.data?.erro || "Não foi possível alterar o benefício.")
    } finally {
      setSalvando(null)
    }
  }

  return (
    <>
      <Dialog open={aberto} onClose={fechar} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
          <CardGiftcard sx={{ color: "primary.main" }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 17 }} noWrap>
              Benefícios da startup
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
              {startup?.nome}
            </Typography>
          </Box>
          <IconButton onClick={fechar} size="small" aria-label="Fechar">
            <Close fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          {erro && (
            <Alert severity="error" onClose={() => setErro(null)} sx={{ mb: 2, borderRadius: "6px" }}>
              {erro}
            </Alert>
          )}

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Recursos que a incubadora libera para os membros desta startup. Revogar bloqueia o acesso na hora e não
            apaga nada: os dados voltam se o benefício for concedido de novo.
          </Typography>

          {carregando ? (
            <Box sx={{ py: 5, display: "grid", placeItems: "center" }}>
              <CircularProgress size={28} />
            </Box>
          ) : (
            <Stack spacing={1}>
              {beneficios.map((b) => (
                <Box
                  key={b.chave}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    p: 1.5,
                    borderRadius: 1.5,
                    border: "1px solid",
                    borderColor: b.ativo ? "primary.main" : "divider",
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{b.nome}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                      {b.descricao}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                      {b.ativo
                        ? `Concedido em ${dataBR(b.concedido_ts)}${b.concedido_por_nome ? ` por ${b.concedido_por_nome}` : ""}.`
                        : b.ja_concedido
                          ? `Revogado em ${dataBR(b.revogado_ts)}${b.revogado_por_nome ? ` por ${b.revogado_por_nome}` : ""}. Os dados estão preservados.`
                          : "Ainda não concedido."}
                    </Typography>
                  </Box>
                  {salvando === b.chave ? (
                    <CircularProgress size={22} sx={{ mx: 1.5 }} />
                  ) : (
                    <Switch
                      checked={b.ativo}
                      disabled={!podeGerenciar || salvando !== null}
                      onChange={() => (b.ativo ? setRevogar(b) : definir(b, true))}
                      inputProps={{ "aria-label": `${b.ativo ? "Revogar" : "Conceder"} o benefício ${b.nome}` }}
                    />
                  )}
                </Box>
              ))}
            </Stack>
          )}

          {!podeGerenciar && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
              Você pode ver os benefícios, mas conceder e revogar exige a permissão “Benefícios › Conceder e revogar”.
            </Typography>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={fechar} sx={{ textTransform: "none" }}>
            Concluir
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(revogar)} onClose={() => setRevogar(null)}>
        <DialogTitle>Revogar “{revogar?.nome}”?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Os membros de {startup?.nome} deixam de acessar o {revogar?.nome} imediatamente. Nada do que eles
            registraram é apagado: clientes, oportunidades, tarefas e histórico voltam a aparecer se o benefício for
            concedido de novo.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRevogar(null)} color="inherit">
            Cancelar
          </Button>
          <Button color="error" variant="contained" onClick={() => definir(revogar, false)}>
            Revogar acesso
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
