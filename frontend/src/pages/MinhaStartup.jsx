/**
 * Tela "Minha Startup" - visao do membro de uma startup incubada.
 *
 * Reune quatro blocos:
 *   - Membros: lista/adiciona/remove membros da startup do usuario logado.
 *   - Modelos: modelos graficos de gestao (Business Model Canvas, Matriz GUT, 5W2H).
 *   - Fases concluidas: fases da trilha ja aprovadas para esta startup.
 *   - Evolucao: o Blueprint das fases, o radar de maturidade e a linha do tempo
 *     (era a tela "Minha Empresa", que virou aba para nao ter duas telas
 *     concorrentes falando da mesma startup).
 *
 * A startup do usuario logado e resolvida via GET /startups/minha (nao ha
 * id_startup no token/authStore ainda).
 */
import { useEffect, useState } from "react"
import { Box, Paper, Typography, Tabs, Tab, Chip, Alert, CircularProgress } from "@mui/material"
import { RocketLaunch, Groups, ViewModule, CheckCircle, AutoAwesome } from "@mui/icons-material"
import AppLayout from "../components/AppLayout"
import api from "../services/api"
import { useAuthStore } from "../store/authStore"
import AbaMembros from "../components/startup/AbaMembros"
import AbaModelos from "../components/startup/AbaModelos"
import AbaFasesConcluidas from "../components/startup/AbaFasesConcluidas"
import AbaEvolucao from "../components/startup/AbaEvolucao"

export default function MinhaStartup() {
  const usuario = useAuthStore((s) => s.usuario)
  const idTenant = usuario?.id_tenant ?? null

  const [startup, setStartup] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [aba, setAba] = useState("membros")

  useEffect(() => {
    if (!idTenant) {
      setCarregando(false)
      return
    }
    setCarregando(true)
    api
      .get("/startups/minha", { params: { id_tenant: idTenant } })
      .then(({ data }) => setStartup(data.startup))
      .catch((err) => setErro(err.response?.data?.erro || "Erro ao carregar sua startup."))
      .finally(() => setCarregando(false))
  }, [idTenant])

  return (
    <AppLayout>
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <RocketLaunch sx={{ color: "primary.main" }} />
          <Typography variant="h4" fontWeight={700}>
            Minha Startup
          </Typography>
        </Box>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Gerencie os membros, os modelos de gestão e acompanhe as fases já concluídas da sua startup.
        </Typography>

        {carregando ? (
          <Box sx={{ textAlign: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        ) : !idTenant || erro || !startup ? (
          <Alert severity="info">
            {erro || "Você ainda não está vinculado a nenhuma startup."}
          </Alert>
        ) : (
          <>
            <Paper sx={{ borderRadius: 0, p: 2, mb: 3, display: "flex", alignItems: "center", gap: 2 }}>
              <Typography variant="h6" fontWeight={700} sx={{ flex: 1 }}>
                {startup.nome}
              </Typography>
              {startup.lider && <Chip size="small" label="Você e o líder" color="primary" />}
              <Chip
                size="small"
                label={startup.status}
                color={startup.status === "ATIVA" ? "success" : "default"}
              />
            </Paper>

            <Paper sx={{ borderRadius: 0, overflow: "hidden" }}>
              <Tabs
                value={aba}
                onChange={(_, v) => setAba(v)}
                sx={{ borderBottom: 1, borderColor: "divider", px: 2 }}
              >
                <Tab value="membros" label="Membros" icon={<Groups />} iconPosition="start" />
                <Tab value="modelos" label="Modelos" icon={<ViewModule />} iconPosition="start" />
                <Tab value="fases" label="Fases concluídas" icon={<CheckCircle />} iconPosition="start" />
                <Tab value="evolucao" label="Evolução" icon={<AutoAwesome />} iconPosition="start" />
              </Tabs>
              <Box sx={{ p: 3 }}>
                {aba === "membros" && <AbaMembros idStartup={startup.id_startup} idTenant={idTenant} />}
                {aba === "modelos" && <AbaModelos idStartup={startup.id_startup} />}
                {aba === "fases" && <AbaFasesConcluidas idStartup={startup.id_startup} />}
                {aba === "evolucao" && <AbaEvolucao />}
              </Box>
            </Paper>
          </>
        )}
      </Box>
    </AppLayout>
  )
}
