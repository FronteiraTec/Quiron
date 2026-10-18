/**
 * Editar um compartilhamento ja feito: a orientacao e a finalidade.
 *
 * O lugar (startup, trilha, etapa) e o material nao mudam aqui: mudar qualquer
 * um deles e entregar outra coisa, ou em outro lugar — e isso e remover e
 * compartilhar de novo, para a startup ver uma entrega nova e nao uma que mudou
 * de lugar sem aviso.
 */
import { useEffect, useState } from "react"
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from "@mui/material"
import { compartilhamentos as apiCompartilhamentos, erroDe } from "../../hooks/useEspacoMentor"
import { FINALIDADES, MAX_ORIENTACAO, rotuloEtapa } from "../../data/espacoMentorMeta"

export default function DialogEditarCompartilhamento({ item, onFechar, onSalvo }) {
  const [orientacao, setOrientacao] = useState("")
  const [finalidade, setFinalidade] = useState("REFERENCIA")
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    if (!item) return
    setOrientacao(item.orientacao || "")
    setFinalidade(item.finalidade || "REFERENCIA")
    setErro(null)
  }, [item])

  const ehPasso = item?.etapa_tipo === "PASSO"

  const salvar = async () => {
    setSalvando(true)
    setErro(null)
    try {
      const salvo = await apiCompartilhamentos.atualizar(item.id_compartilhamento, {
        orientacao: orientacao.trim(),
        finalidade,
      })
      onSalvo(salvo)
    } catch (err) {
      setErro(erroDe(err, "Não foi possível salvar."))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={Boolean(item)} onClose={salvando ? undefined : onFechar} fullWidth maxWidth="sm">
      <DialogTitle component="div" sx={{ pb: 0.5 }}>
        <Typography component="h2" sx={{ fontWeight: 800, fontSize: 18 }}>
          Editar compartilhamento
        </Typography>
        {item && (
          <Typography variant="body2" color="text.secondary">
            {item.titulo} → {item.startup_nome} · {item.programa_nome} › {rotuloEtapa(item)}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        {erro && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {erro}
          </Alert>
        )}
        <RadioGroup value={finalidade} onChange={(e) => setFinalidade(e.target.value)} sx={{ my: 1.5 }}>
          {Object.entries(FINALIDADES).map(([chave, meta]) => (
            <FormControlLabel
              key={chave}
              value={chave}
              disabled={chave === "ATIVIDADE" && !ehPasso}
              control={<Radio size="small" />}
              label={
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {meta.rotulo}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {chave === "ATIVIDADE" && !ehPasso
                      ? "Só um material compartilhado num passo pode apoiar uma atividade."
                      : meta.descricao}
                  </Typography>
                </Box>
              }
              sx={{ alignItems: "flex-start", mb: 0.5, "& .MuiRadio-root": { pt: 0.5 } }}
            />
          ))}
        </RadioGroup>
        <TextField
          label="Orientação para a startup"
          fullWidth
          multiline
          minRows={3}
          value={orientacao}
          onChange={(e) => setOrientacao(e.target.value)}
          error={orientacao.length > MAX_ORIENTACAO}
          helperText={`${orientacao.length}/${MAX_ORIENTACAO}`}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onFechar} disabled={salvando} sx={{ textTransform: "none" }}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={salvar}
          disabled={salvando || orientacao.length > MAX_ORIENTACAO}
          startIcon={salvando ? <CircularProgress size={16} color="inherit" /> : null}
          sx={{ textTransform: "none", fontWeight: 700 }}
        >
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  )
}
