/**
 * Moldura comum das telas de relatorio.
 *
 * Concentra o que os quatro relatorios repetiriam: cabecalho, escolha da
 * incubadora (so o root precisa dela — o admin ja tem a sua), janela de
 * periodo e o botao de exportar.
 *
 * O escopo escolhido chega as telas por render prop, e nao por props soltas,
 * porque o filho so deve renderizar DEPOIS que ha um tenant: assim nao existe
 * o estado intermediario de uma tabela vazia piscando enquanto o root ainda
 * nao escolheu a incubadora.
 */
import { useEffect, useState } from "react"
import { Box, Paper, Typography, TextField, MenuItem, Alert, CircularProgress } from "@mui/material"
import { Business } from "@mui/icons-material"
import AppLayout from "../AppLayout"
import api from "../../services/api"
import { useAuthStore } from "../../store/authStore"

// Janelas oferecidas nos relatorios de periodo.
const PERIODOS = [
  { valor: 30, rotulo: "Últimos 30 dias" },
  { valor: 90, rotulo: "Últimos 90 dias" },
  { valor: 180, rotulo: "Últimos 6 meses" },
  { valor: 365, rotulo: "Últimos 12 meses" },
]

/**
 * @param {object} props
 * @param {string} props.titulo
 * @param {string} props.descricao
 * @param {React.ReactNode} props.icone
 * @param {boolean} [props.periodo] - exibe o seletor de janela
 * @param {(escopo: {idTenant: number, dias: number}) => React.ReactNode} props.children
 */
export default function RelatorioShell({ titulo, descricao, icone, periodo = false, children }) {
  const usuario = useAuthStore((s) => s.usuario)
  const ehRoot = Boolean(usuario?.root)

  const [tenants, setTenants] = useState([])
  const [idTenant, setIdTenant] = useState(ehRoot ? "" : usuario?.id_tenant ?? "")
  const [dias, setDias] = useState(90)

  // O usuario chega do /auth/me depois da primeira renderizacao; sem isto o
  // admin ficaria preso no estado inicial vazio.
  useEffect(() => {
    if (!ehRoot && usuario?.id_tenant) setIdTenant(usuario.id_tenant)
  }, [ehRoot, usuario?.id_tenant])

  // Root: lista de incubadoras para o seletor.
  useEffect(() => {
    if (!ehRoot) return
    api
      .get("/tenants")
      .then(({ data }) => setTenants(data.tenants))
      .catch(() => {})
  }, [ehRoot])

  return (
    <AppLayout>
      <Box>
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 2,
            flexWrap: "wrap",
            mb: 1,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box sx={{ color: "primary.main", display: "flex" }}>{icone}</Box>
            <Typography variant="h4" fontWeight={700}>
              {titulo}
            </Typography>
          </Box>

          <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
            {periodo && (
              <TextField
                data-tour="relatorio-periodo"
                select
                size="small"
                label="Período"
                value={dias}
                onChange={(e) => setDias(Number(e.target.value))}
                sx={{ minWidth: 180 }}
              >
                {PERIODOS.map((p) => (
                  <MenuItem key={p.valor} value={p.valor}>
                    {p.rotulo}
                  </MenuItem>
                ))}
              </TextField>
            )}
          </Box>
        </Box>

        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {descricao}
        </Typography>

        {ehRoot && (
          <Paper data-tour="relatorio-tenant" sx={{ borderRadius: 0, p: { xs: 2, sm: 3 }, mb: 3 }}>
            <TextField
              select
              label="Incubadora"
              fullWidth
              value={idTenant}
              onChange={(e) => setIdTenant(e.target.value)}
              helperText="Selecione a incubadora do relatório."
            >
              {tenants.map((t) => (
                <MenuItem key={t.id_tenant} value={t.id_tenant}>
                  {t.nome}
                </MenuItem>
              ))}
            </TextField>
          </Paper>
        )}

        {!idTenant ? (
          <Paper
            sx={{
              borderRadius: 0,
              p: { xs: 3, sm: 6 },
              textAlign: "center",
              color: "text.secondary",
            }}
          >
            {ehRoot ? (
              <>
                <Business sx={{ fontSize: 48, opacity: 0.4 }} />
                <Typography sx={{ mt: 1 }}>
                  Selecione uma incubadora para ver o relatório.
                </Typography>
              </>
            ) : (
              <CircularProgress />
            )}
          </Paper>
        ) : (
          children({ idTenant, dias })
        )}
      </Box>
    </AppLayout>
  )
}

/** Estados de carregamento/erro/vazio, iguais nos quatro relatorios. */
export function EstadoRelatorio({ carregando, erro, vazio, mensagemVazio, children }) {
  if (carregando) {
    return (
      <Box sx={{ textAlign: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }
  if (erro) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        {erro}
      </Alert>
    )
  }
  if (vazio) {
    return (
      <Paper
        sx={{ borderRadius: 0, p: { xs: 3, sm: 6 }, textAlign: "center", color: "text.secondary" }}
      >
        <Typography>{mensagemVazio}</Typography>
      </Paper>
    )
  }
  return children
}
