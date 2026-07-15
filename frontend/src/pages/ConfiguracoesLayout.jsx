/**
 * Layout da area de Configuracoes da incubadora (tenant) — acessivel ao
 * admin da propria incubadora e ao usuario ROOT.
 *
 * Reune o seletor de incubadora (somente root) e a barra de abas que troca
 * entre as subpaginas (rotas filhas renderizadas via Outlet): Dados
 * cadastrais e Configuracao de e-mail. Permissoes, Usuarios e Grupos ficam
 * na tela "Usuarios" (menu "Incubadora > Usuarios").
 *
 * O admin gerencia sempre a sua propria incubadora (usuario.id_tenant). O
 * root, por nao pertencer a nenhuma incubadora, escolhe qual incubadora
 * configurar num seletor, compartilhado com todas as abas via useOutletContext.
 */
import { useEffect, useState } from "react"
import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { Box, Paper, Typography, TextField, MenuItem, Tabs, Tab } from "@mui/material"
import { Settings, Business } from "@mui/icons-material"
import AppLayout from "../components/AppLayout"
import api from "../services/api"
import { useAuthStore } from "../store/authStore"

const ABAS = [
  { valor: "", rotulo: "Dados cadastrais" },
  { valor: "email", rotulo: "Configuracao de e-mail" },
]

export default function ConfiguracoesLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const usuario = useAuthStore((s) => s.usuario)
  const ehRoot = Boolean(usuario?.root)

  const [tenants, setTenants] = useState([])
  const [idTenant, setIdTenant] = useState(ehRoot ? "" : usuario?.id_tenant ?? "")

  // Root: carrega a lista de incubadoras para o seletor.
  useEffect(() => {
    if (!ehRoot) return
    api
      .get("/tenants")
      .then(({ data }) => setTenants(data.tenants))
      .catch(() => {})
  }, [ehRoot])

  const abaAtual = location.pathname.replace(/^\/configuracoes\/?/, "")

  return (
    <AppLayout>
      <Box sx={{ maxWidth: 1200, mx: "auto" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <Settings sx={{ color: "primary.main" }} />
          <Typography variant="h4" fontWeight={700}>
            Configuracoes
          </Typography>
        </Box>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Dados cadastrais e configuracao de e-mail da incubadora.
        </Typography>

        {ehRoot && (
          <Paper sx={{ borderRadius: 0, p: { xs: 2, sm: 3 }, mb: 3 }}>
            <TextField
              select
              label="Incubadora"
              fullWidth
              value={idTenant}
              onChange={(e) => setIdTenant(e.target.value)}
              helperText="Selecione a incubadora que deseja configurar."
            >
              {tenants.map((t) => (
                <MenuItem key={t.id_tenant} value={t.id_tenant}>
                  {t.nome}
                </MenuItem>
              ))}
            </TextField>
          </Paper>
        )}

        <Paper sx={{ borderRadius: 0, mb: 3 }}>
          <Tabs
            value={abaAtual}
            onChange={(_, valor) => navigate(valor ? `/configuracoes/${valor}` : "/configuracoes")}
            variant="scrollable"
            scrollButtons="auto"
          >
            {ABAS.map((aba) => (
              <Tab key={aba.valor} value={aba.valor} label={aba.rotulo} sx={{ textTransform: "none" }} />
            ))}
          </Tabs>
        </Paper>

        {ehRoot && !idTenant ? (
          <Paper sx={{ borderRadius: 0, p: { xs: 3, sm: 6 }, textAlign: "center", color: "text.secondary" }}>
            <Business sx={{ fontSize: 48, opacity: 0.4 }} />
            <Typography sx={{ mt: 1 }}>Selecione uma incubadora para ver as configuracoes.</Typography>
          </Paper>
        ) : (
          <Outlet context={{ idTenant }} />
        )}
      </Box>
    </AppLayout>
  )
}
