/**
 * Marcar uma oportunidade como GANHA ou PERDIDA.
 *
 * Ganha pede o valor EFETIVAMENTE vendido (comeca com o estimado, e pode ser
 * outro) e a data de fechamento. Perdida pede o motivo — e obrigatorio: uma
 * perda sem motivo nao ensina nada ao proximo vendedor. As duas oferecem
 * cancelar as tarefas que ficaram abertas.
 *
 * Quem grava o encerramento e o historico e o backend, numa transacao.
 */
import { useEffect, useState } from "react"
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  TextField,
  Typography,
} from "@mui/material"
import { EmojiEventsOutlined, ThumbDownAltOutlined } from "@mui/icons-material"
import { CampoDinheiro } from "./FormCrm"
import { useCrm } from "./useCrm"
import { hojeISO, moeda } from "../../data/crmMeta"

const MOTIVOS_COMUNS = ["Preço acima do orçamento", "Escolheu um concorrente", "Sem resposta do cliente", "Projeto adiado", "Não era o momento"]

export default function DialogEncerrar({ modo, oportunidade, onFechar, onEncerrada }) {
  const { api, falha, avisar } = useCrm()
  const aberto = Boolean(modo && oportunidade)
  const ganhar = modo === "ganhar"

  const [valor, setValor] = useState(null)
  const [data, setData] = useState(hojeISO())
  const [motivo, setMotivo] = useState("")
  const [cancelarTarefas, setCancelarTarefas] = useState(false)
  const [erro, setErro] = useState(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (!aberto) return
    setValor(oportunidade.valor_estimado ?? null)
    setData(hojeISO())
    setMotivo("")
    // Perdeu: as tarefas da venda nao tem mais o que fazer. Ganhou: pode haver
    // entrega e pos-venda — a pessoa decide.
    setCancelarTarefas(modo === "perder")
    setErro(null)
  }, [aberto, modo, oportunidade])

  const enviar = async () => {
    if (ganhar && (valor === null || valor === undefined)) {
      setErro("Informe o valor vendido.")
      return
    }
    if (!ganhar && !motivo.trim()) {
      setErro("Conte por que a negociação foi perdida.")
      return
    }
    setEnviando(true)
    setErro(null)
    try {
      const corpo = ganhar
        ? { valor_vendido: valor, fechamento_dt: data, cancelar_tarefas: cancelarTarefas }
        : { motivo_perda: motivo.trim(), fechamento_dt: data, cancelar_tarefas: cancelarTarefas }
      const op = ganhar
        ? await api.ganhar(oportunidade.id_oportunidade, corpo)
        : await api.perder(oportunidade.id_oportunidade, corpo)
      avisar("success", ganhar ? `“${op.titulo}” marcada como ganha.` : `“${op.titulo}” marcada como perdida.`)
      onEncerrada?.(op)
      onFechar()
    } catch (err) {
      setErro(falha(err, "Não foi possível encerrar a oportunidade."))
    } finally {
      setEnviando(false)
    }
  }

  const abertas = oportunidade?.tarefas_abertas || 0
  const diferenca =
    ganhar && valor !== null && oportunidade?.valor_estimado !== null && oportunidade?.valor_estimado !== undefined
      ? valor - oportunidade.valor_estimado
      : 0

  return (
    <Dialog open={aberto} onClose={enviando ? undefined : onFechar} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        {ganhar ? (
          <EmojiEventsOutlined sx={{ color: "success.main" }} aria-hidden />
        ) : (
          <ThumbDownAltOutlined sx={{ color: "error.main" }} aria-hidden />
        )}
        <Box sx={{ minWidth: 0 }}>
          <Typography component="span" sx={{ fontWeight: 700, fontSize: 17, display: "block" }}>
            {ganhar ? "Marcar como ganha" : "Marcar como perdida"}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
            {oportunidade?.titulo}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {erro && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro(null)}>
            {erro}
          </Alert>
        )}

        <Grid container spacing={2}>
          {ganhar ? (
            <>
              <Grid item xs={12} sm={7}>
                <CampoDinheiro
                  label="Valor efetivamente vendido"
                  required
                  autoFocus
                  valor={valor}
                  onChange={setValor}
                  helperText={
                    oportunidade?.valor_estimado !== null && oportunidade?.valor_estimado !== undefined
                      ? `Estimado: ${moeda(oportunidade.valor_estimado)}${
                          diferenca ? ` (${diferenca > 0 ? "+" : "−"}${moeda(Math.abs(diferenca))})` : ""
                        }`
                      : undefined
                  }
                />
              </Grid>
              <Grid item xs={12} sm={5}>
                <TextField
                  label="Data de fechamento"
                  type="date"
                  required
                  fullWidth
                  size="small"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </>
          ) : (
            <>
              <Grid item xs={12}>
                <TextField
                  label="Motivo da perda"
                  required
                  autoFocus
                  fullWidth
                  multiline
                  minRows={3}
                  size="small"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  inputProps={{ maxLength: 500 }}
                  helperText={`${motivo.length}/500`}
                />
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 1 }}>
                  {MOTIVOS_COMUNS.map((m) => (
                    <Chip key={m} label={m} size="small" variant="outlined" onClick={() => setMotivo(m)} />
                  ))}
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Data do encerramento"
                  type="date"
                  fullWidth
                  size="small"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </>
          )}

          {abertas > 0 && (
            <Grid item xs={12}>
              <FormControlLabel
                control={<Checkbox checked={cancelarTarefas} onChange={(e) => setCancelarTarefas(e.target.checked)} />}
                label={`Cancelar ${abertas === 1 ? "a tarefa aberta" : `as ${abertas} tarefas abertas`} desta oportunidade`}
              />
            </Grid>
          )}
        </Grid>

        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
          A oportunidade sai do funil aberto e o encerramento fica no histórico. Se precisar, ela pode ser reaberta depois.
        </Typography>
      </DialogContent>

      <DialogActions>
        <Button onClick={onFechar} disabled={enviando} color="inherit">
          Cancelar
        </Button>
        <Button
          variant="contained"
          color={ganhar ? "success" : "error"}
          onClick={enviar}
          disabled={enviando}
          startIcon={enviando ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {ganhar ? "Confirmar venda" : "Confirmar perda"}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
