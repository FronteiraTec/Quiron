/**
 * Subpagina de Configuracoes: dados cadastrais (somente leitura) da
 * incubadora selecionada no ConfiguracoesLayout.
 *
 * Endpoint (autorizacao validada no backend: root ou admin do tenant):
 *   GET /tenants/:id -> dados cadastrais
 */
import { useEffect, useState } from "react"
import { useOutletContext } from "react-router-dom"
import { Box, Paper, Typography, Grid, TextField, Chip, Alert, CircularProgress } from "@mui/material"
import api from "../services/api"
import { formatarCelular } from "../utils/mascaras"

export default function DadosCadastrais() {
  const { idTenant } = useOutletContext()

  const [tenant, setTenant] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [aviso, setAviso] = useState(null) // { tipo, texto }

  useEffect(() => {
    if (!idTenant) return
    setCarregando(true)
    setAviso(null)
    api
      .get(`/tenants/${idTenant}`)
      .then(({ data }) => setTenant(data.tenant))
      .catch((err) => {
        setTenant(null)
        setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao carregar a incubadora." })
      })
      .finally(() => setCarregando(false))
  }, [idTenant])

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

      {tenant && (
        <Paper data-tour="dados-cadastrais" sx={{ borderRadius: 0, p: { xs: 2, sm: 3 } }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
            <Typography variant="h6" fontWeight={600}>
              Dados cadastrais
            </Typography>
            <Chip
              size="small"
              label={tenant.ativo ? "Ativa" : "Inativa"}
              color={tenant.ativo ? "success" : "default"}
            />
          </Box>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField label="Nome" fullWidth disabled value={tenant.nome || ""} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="E-mail" fullWidth disabled value={tenant.email || ""} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Celular" fullWidth disabled value={formatarCelular(tenant.celular)} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Local"
                fullWidth
                disabled
                value={[tenant.cidade, tenant.estado, tenant.pais].filter(Boolean).join(" / ")}
              />
            </Grid>
            <Grid item xs={12} sm={6} data-tour="dados-cadastrais-limites">
              <TextField label="Limite de usuários" fullWidth disabled value={tenant.qtd_usuarios ?? ""} />
            </Grid>
            <Grid item xs={12} sm={6} data-tour="dados-cadastrais-limites">
              <TextField label="Limite de startups" fullWidth disabled value={tenant.qtd_startups ?? ""} />
            </Grid>
          </Grid>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: "block" }}>
            Para alterar dados cadastrais ou limites de uso, entre em contato com o suporte da plataforma.
          </Typography>
        </Paper>
      )}
    </>
  )
}
