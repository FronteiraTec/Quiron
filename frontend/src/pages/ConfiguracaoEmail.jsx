/**
 * Subpagina de Configuracoes: configuracao de e-mail remetente da
 * incubadora selecionada no ConfiguracoesLayout.
 *
 * Endpoint (autorizacao validada no backend: root ou admin do tenant):
 *   PUT /tenants/:id/config-email -> configuracao de e-mail remetente
 */
import { useEffect, useState } from "react"
import { useOutletContext } from "react-router-dom"
import { Box, Paper, Typography, Grid, TextField, Button, Divider, Alert, CircularProgress } from "@mui/material"
import api from "../services/api"

const CONFIG_EMAIL_VAZIO = { email_remetente_nome: "", email_remetente: "", email_reply_to: "" }

export default function ConfiguracaoEmail() {
  const { idTenant } = useOutletContext()

  const [configEmail, setConfigEmail] = useState(CONFIG_EMAIL_VAZIO)
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState(null) // { tipo, texto }

  useEffect(() => {
    if (!idTenant) return
    setCarregando(true)
    setAviso(null)
    api
      .get(`/tenants/${idTenant}`)
      .then(({ data }) =>
        setConfigEmail({
          email_remetente_nome: data.tenant.email_remetente_nome || "",
          email_remetente: data.tenant.email_remetente || "",
          email_reply_to: data.tenant.email_reply_to || "",
        })
      )
      .catch((err) => setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao carregar a configuracao." }))
      .finally(() => setCarregando(false))
  }, [idTenant])

  const alterarConfigEmail = (campo, valor) => setConfigEmail((f) => ({ ...f, [campo]: valor }))

  const salvarConfigEmail = async (e) => {
    e.preventDefault()
    setAviso(null)
    setSalvando(true)
    try {
      await api.put(`/tenants/${idTenant}/config-email`, configEmail)
      setAviso({ tipo: "success", texto: "Configuracao de e-mail atualizada com sucesso." })
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao salvar a configuracao." })
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) {
    return (
      <Paper sx={{ borderRadius: 0, p: { xs: 3, sm: 6 }, textAlign: "center" }}>
        <CircularProgress />
      </Paper>
    )
  }

  return (
    <>
      {aviso && (
        <Alert severity={aviso.tipo} sx={{ mb: 3 }} onClose={() => setAviso(null)}>
          {aviso.texto}
        </Alert>
      )}

      <Paper sx={{ borderRadius: 0, p: { xs: 2, sm: 3 } }}>
        <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
          Configuracao de e-mail
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Box component="form" onSubmit={salvarConfigEmail}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                label="Nome do remetente"
                fullWidth
                value={configEmail.email_remetente_nome}
                onChange={(e) => alterarConfigEmail("email_remetente_nome", e.target.value)}
                helperText="Ex.: Incubadora XPTO"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="E-mail remetente"
                type="email"
                fullWidth
                value={configEmail.email_remetente}
                onChange={(e) => alterarConfigEmail("email_remetente", e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="E-mail de resposta (reply-to)"
                type="email"
                fullWidth
                value={configEmail.email_reply_to}
                onChange={(e) => alterarConfigEmail("email_reply_to", e.target.value)}
              />
            </Grid>
          </Grid>
          <Box sx={{ mt: 3, textAlign: "right" }}>
            <Button type="submit" variant="contained" disabled={salvando}>
              {salvando ? <CircularProgress size={22} color="inherit" /> : "Salvar"}
            </Button>
          </Box>
        </Box>
      </Paper>
    </>
  )
}
